-- ============================================================================
-- 020_indexes_and_rls_isolation.sql
--
-- Three improvements in one migration:
--
-- PART 1 — Indexes
--   Add missing indexes not covered by migration 008:
--   bookings.created_by, expenses.date, and all booking-linked child table FKs.
--
-- PART 2 — Backfill created_by on legacy bookings
--   Instructions + commented UPDATE statement.
--   Run manually after finding your admin UUID in Supabase Auth dashboard.
--
-- PART 3 — RLS user isolation for booking-linked tables
--   Tables currently have "Non-chef full access" (migration 019) which blocks
--   chefs but does not isolate rows per user.
--   New policies combine both guards:
--     (a) current_app_role() <> 'chef'          ← chef lockdown (from 019)
--     (b) booking.created_by = auth.uid()        ← per-user isolation (new)
--
--   Tables inheriting isolation through bookings.app_id (TEXT FK):
--     customer_payments, expenses, event_menus
--   Tables inheriting isolation through bookings.id (UUID FK):
--     shopping_lists, shopping_list_items, reconciliations,
--     labor_payments, profit_distribution_overrides
--
--   Tables LEFT UNCHANGED (business-wide shared resources):
--     staff, money_rules, app_settings, menu_items,
--     owner_profit_payouts, retained_earnings_transactions
--     (these use migration 019's "Non-chef full access" — appropriate for
--      a single-tenant app where all owners share the same catalog & config)
--
-- PART 4 — updated_at auto-trigger
--   Ensures updated_at is always current on row changes.
--   Prevents stale timestamps from manual or ORM updates that omit the field.
-- ============================================================================


-- ============================================================================
-- PREREQUISITES (idempotent — safe to run even if 014/019 already applied)
-- ============================================================================

-- From migration 014: audit columns on bookings (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    COMMENT ON COLUMN bookings.created_by IS 'auth.users.id of the user who created this booking. NULL for legacy rows.';
    COMMENT ON COLUMN bookings.updated_by IS 'auth.users.id of the last user who modified this booking.';
  END IF;
END $$;

-- From migration 019: role helper function used by all RLS policies below
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt()->'app_metadata'->>'role', ''));
$$;

-- From migrations 004 + 009: ensure booking_id columns are TEXT not UUID.
-- Migrations 004/009 may not have been applied to this database.
-- If booking_id is still UUID, the RLS policy comparison
--   "b.app_id (TEXT) = booking_id (UUID)" fails with operator error 42883.
-- This block detects the column type and converts only if needed (idempotent).
DO $$
DECLARE
  _type text;
BEGIN
  -- customer_payments.booking_id (migration 004)
  SELECT data_type INTO _type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'customer_payments'
    AND column_name  = 'booking_id';
  IF _type = 'uuid' THEN
    ALTER TABLE customer_payments DROP CONSTRAINT IF EXISTS customer_payments_booking_id_fkey;
    ALTER TABLE customer_payments ALTER COLUMN booking_id TYPE TEXT USING booking_id::TEXT;
    RAISE NOTICE 'customer_payments.booking_id: converted UUID → TEXT';
  END IF;

  -- expenses.booking_id (migration 004)
  SELECT data_type INTO _type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'expenses'
    AND column_name  = 'booking_id';
  IF _type = 'uuid' THEN
    ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_booking_id_fkey;
    ALTER TABLE expenses ALTER COLUMN booking_id TYPE TEXT USING booking_id::TEXT;
    RAISE NOTICE 'expenses.booking_id: converted UUID → TEXT';
  END IF;

  -- event_menus.booking_id (migration 009)
  SELECT data_type INTO _type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'event_menus'
    AND column_name  = 'booking_id';
  IF _type = 'uuid' THEN
    ALTER TABLE event_menus DROP CONSTRAINT IF EXISTS event_menus_booking_id_fkey;
    ALTER TABLE event_menus ALTER COLUMN booking_id TYPE TEXT USING booking_id::TEXT;
    RAISE NOTICE 'event_menus.booking_id: converted UUID → TEXT';
  END IF;
END $$;


-- From migration 011: shopping_list_items table (may not exist yet)
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id  UUID        NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  category          TEXT        NOT NULL DEFAULT 'food',
  unit              TEXT        NOT NULL DEFAULT 'lb',
  qty               NUMERIC(12,4) NOT NULL DEFAULT 1,
  calculated_qty    NUMERIC(12,4),
  override_qty      NUMERIC(12,4),
  final_qty         NUMERIC(12,4) GENERATED ALWAYS AS (COALESCE(override_qty, calculated_qty, qty)) STORED,
  is_generated      BOOLEAN     NOT NULL DEFAULT false,
  is_overridden     BOOLEAN     NOT NULL DEFAULT false,
  source            TEXT,
  unit_cost         NUMERIC(12,4),
  purchased         BOOLEAN     NOT NULL DEFAULT false,
  notes             TEXT,
  sort_order        INT         NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shopping_list_items_source_check
    CHECK (source IS NULL OR source IN ('menu', 'manual'))
);

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS shopping_list_items_shopping_list_id_idx
  ON shopping_list_items (shopping_list_id);


-- ============================================================================
-- PART 1: INDEXES
-- ============================================================================

-- bookings.created_by — used in every RLS policy subquery in this migration
CREATE INDEX IF NOT EXISTS bookings_created_by_idx
  ON bookings (created_by);

-- expenses.date — date-range filtering in reports
CREATE INDEX IF NOT EXISTS expenses_date_idx
  ON expenses (date);

-- FK indexes on booking-linked child tables (not in migration 008)
CREATE INDEX IF NOT EXISTS labor_payments_booking_id_idx
  ON labor_payments (booking_id);

CREATE INDEX IF NOT EXISTS reconciliations_booking_id_idx
  ON reconciliations (booking_id);

CREATE INDEX IF NOT EXISTS shopping_lists_booking_id_idx
  ON shopping_lists (booking_id);

CREATE INDEX IF NOT EXISTS profit_dist_booking_id_idx
  ON profit_distribution_overrides (booking_id);


-- ============================================================================
-- PART 2: BACKFILL created_by ON LEGACY BOOKINGS
-- ============================================================================
-- Legacy bookings (created before migration 014) have created_by = NULL.
-- Until backfilled, the policies below allow any authenticated user to access
-- them (the OR created_by IS NULL arm).
--
-- HOW TO FIND YOUR ADMIN UUID:
--   Supabase Dashboard → Authentication → Users → copy the UUID of your
--   primary admin account.
--
-- HOW TO BACKFILL:
--   Run the UPDATE below in a new SQL Editor query AFTER this migration runs.
--   Replace <your-admin-uuid> with the actual UUID (keep the single quotes).
--
-- UPDATE bookings
--   SET created_by = '<your-admin-uuid>'
-- WHERE created_by IS NULL;
--
-- Once backfilled, the OR created_by IS NULL arms in the policies below
-- become dead code. A future migration (021) can remove them to tighten
-- security further.
-- ============================================================================


-- ============================================================================
-- PART 3: RLS USER ISOLATION FOR BOOKING-LINKED TABLES
-- ============================================================================

-- ─── Helper: reusable IS NULL arm explanation ─────────────────────────────
-- The pattern (b.created_by = auth.uid() OR b.created_by IS NULL) means:
--   • Own bookings      → access granted
--   • Legacy bookings   → access granted until backfill runs
--   • Other user's rows → access denied


-- ─── customer_payments ───────────────────────────────────────────────────
-- booking_id TEXT → bookings.app_id

DROP POLICY IF EXISTS "Non-chef full access" ON customer_payments;

CREATE POLICY "Non-chef access own customer_payments" ON customer_payments
  FOR ALL TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.app_id = customer_payments.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  )
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.app_id = customer_payments.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  );


-- ─── expenses ────────────────────────────────────────────────────────────
-- booking_id TEXT → bookings.app_id (nullable — NULL = general overhead)
-- Overhead expenses (no booking) are visible to all non-chef authenticated users.

DROP POLICY IF EXISTS "Non-chef full access" ON expenses;

CREATE POLICY "Non-chef access own expenses" ON expenses
  FOR ALL TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND (
      expenses.booking_id IS NULL          -- general overhead: shared across owners
      OR EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.app_id = expenses.booking_id
          AND (b.created_by = auth.uid() OR b.created_by IS NULL)
      )
    )
  )
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND (
      expenses.booking_id IS NULL
      OR EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.app_id = expenses.booking_id
          AND (b.created_by = auth.uid() OR b.created_by IS NULL)
      )
    )
  );


-- ─── event_menus ─────────────────────────────────────────────────────────
-- booking_id TEXT → bookings.app_id
-- Anon insert preserved for public inquiry form (migration 008 policy kept).

DROP POLICY IF EXISTS "Authenticated full access" ON event_menus;

CREATE POLICY "Non-chef access own event_menus" ON event_menus
  FOR ALL TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.app_id = event_menus.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  )
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.app_id = event_menus.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  );

-- Anon insert for public inquiry form — untouched from migration 008
-- (policy "Anon inquiry menu insert" remains in place)


-- ─── shopping_lists ───────────────────────────────────────────────────────
-- booking_id UUID → bookings.id

DROP POLICY IF EXISTS "Authenticated full access" ON shopping_lists;

CREATE POLICY "Non-chef access own shopping_lists" ON shopping_lists
  FOR ALL TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = shopping_lists.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  )
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = shopping_lists.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  );


-- ─── shopping_list_items ──────────────────────────────────────────────────
-- shopping_list_id UUID → shopping_lists.id → bookings.id (2-level join)

DROP POLICY IF EXISTS "Allow all for anon"        ON shopping_list_items;  -- migration 011
DROP POLICY IF EXISTS "shopping_list_items_auth_all" ON shopping_list_items; -- migration 013
DROP POLICY IF EXISTS "Authenticated full access" ON shopping_list_items;  -- migration 016

CREATE POLICY "Non-chef access own shopping_list_items" ON shopping_list_items
  FOR ALL TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM shopping_lists sl
      JOIN bookings b ON b.id = sl.booking_id
      WHERE sl.id = shopping_list_items.shopping_list_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  )
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM shopping_lists sl
      JOIN bookings b ON b.id = sl.booking_id
      WHERE sl.id = shopping_list_items.shopping_list_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  );


-- ─── reconciliations ─────────────────────────────────────────────────────
-- booking_id UUID → bookings.id

DROP POLICY IF EXISTS "Non-chef full access" ON reconciliations;

CREATE POLICY "Non-chef access own reconciliations" ON reconciliations
  FOR ALL TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = reconciliations.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  )
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = reconciliations.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  );


-- ─── labor_payments ───────────────────────────────────────────────────────
-- booking_id UUID → bookings.id

DROP POLICY IF EXISTS "Non-chef full access" ON labor_payments;

CREATE POLICY "Non-chef access own labor_payments" ON labor_payments
  FOR ALL TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = labor_payments.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  )
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = labor_payments.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  );


-- ─── profit_distribution_overrides ───────────────────────────────────────
-- booking_id UUID → bookings.id

DROP POLICY IF EXISTS "Non-chef full access" ON profit_distribution_overrides;

CREATE POLICY "Non-chef access own profit_dist" ON profit_distribution_overrides
  FOR ALL TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = profit_distribution_overrides.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  )
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = profit_distribution_overrides.booking_id
        AND (b.created_by = auth.uid() OR b.created_by IS NULL)
    )
  );


-- ============================================================================
-- PART 4: updated_at AUTO-TRIGGER
-- ============================================================================
-- Ensures updated_at is always set to NOW() on any UPDATE, even if the caller
-- omits the column. Prevents stale timestamps from partial updates.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply trigger to all tables with an updated_at column

CREATE OR REPLACE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER staff_set_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER menu_items_set_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER event_menus_set_updated_at
  BEFORE UPDATE ON event_menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER shopping_lists_set_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER shopping_list_items_set_updated_at
  BEFORE UPDATE ON shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER reconciliations_set_updated_at
  BEFORE UPDATE ON reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER money_rules_set_updated_at
  BEFORE UPDATE ON money_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER profit_dist_set_updated_at
  BEFORE UPDATE ON profit_distribution_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

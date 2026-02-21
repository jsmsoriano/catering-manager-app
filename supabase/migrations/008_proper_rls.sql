-- Migration 008: Replace permissive RLS policies with proper role-based access control
-- + Add indexes on frequently filtered/sorted columns
--
-- Problem: All 13 tables had USING (true) WITH CHECK (true) — effectively no security.
-- Fix: Anon users can only INSERT inquiry bookings. Everything else requires auth.

-- ─── Drop all existing open policies ─────────────────────────────────────────

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ─── Bookings ─────────────────────────────────────────────────────────────────
-- Anon: INSERT only when source = 'inquiry' (public inquiry form)
-- Authenticated: full CRUD

CREATE POLICY "Anon inquiry insert" ON bookings
  FOR INSERT TO anon
  WITH CHECK (source = 'inquiry');

CREATE POLICY "Authenticated full access" ON bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── event_menus ─────────────────────────────────────────────────────────────
-- Anon: INSERT allowed (companion to inquiry booking insert)
-- Authenticated: full CRUD

CREATE POLICY "Anon inquiry menu insert" ON event_menus
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON event_menus
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── All other tables: authenticated only ────────────────────────────────────

CREATE POLICY "Authenticated full access" ON staff
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON customer_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON money_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON shopping_lists
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON menu_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON reconciliations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON labor_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON owner_profit_payouts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON retained_earnings_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON profit_distribution_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
-- Add indexes on columns used for filtering, sorting, and foreign key lookups.

CREATE INDEX IF NOT EXISTS bookings_event_date_idx        ON bookings (event_date);
CREATE INDEX IF NOT EXISTS bookings_status_idx             ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_source_idx             ON bookings (source);
CREATE INDEX IF NOT EXISTS bookings_app_id_idx             ON bookings (app_id);
CREATE INDEX IF NOT EXISTS bookings_pipeline_status_idx    ON bookings (pipeline_status);
CREATE INDEX IF NOT EXISTS expenses_booking_id_idx         ON expenses (booking_id);
CREATE INDEX IF NOT EXISTS cust_pay_booking_id_idx         ON customer_payments (booking_id);
CREATE INDEX IF NOT EXISTS event_menus_booking_id_idx      ON event_menus (booking_id);

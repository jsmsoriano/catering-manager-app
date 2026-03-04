-- ============================================================================
-- 019_chef_role_access_lockdown.sql
-- Phase 1 chef portal hardening:
-- 1) Restrict chef access to only assigned bookings + own staff row.
-- 2) Block chef role from sensitive finance/config tables.
-- 3) Keep current behavior for non-chef authenticated users.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt()->'app_metadata'->>'role', ''));
$$;

-- ─── Staff policies ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access" ON staff;

CREATE POLICY "Non-chef full access" ON staff
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

CREATE POLICY "Chef read own staff profile" ON staff
  FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'chef'
    AND lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

-- ─── Bookings policies ───────────────────────────────────────────────────────
-- Replace migration 015's broad authenticated policies with role-aware rules.

DROP POLICY IF EXISTS "Users read own bookings" ON bookings;
DROP POLICY IF EXISTS "Users insert own bookings" ON bookings;
DROP POLICY IF EXISTS "Users update own bookings" ON bookings;
DROP POLICY IF EXISTS "Users delete own bookings" ON bookings;

CREATE POLICY "Non-chef read own bookings" ON bookings
  FOR SELECT TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

CREATE POLICY "Non-chef insert own bookings" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

CREATE POLICY "Non-chef update own bookings" ON bookings
  FOR UPDATE TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND (created_by = auth.uid() OR created_by IS NULL)
  )
  WITH CHECK (
    public.current_app_role() <> 'chef'
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

CREATE POLICY "Non-chef delete own bookings" ON bookings
  FOR DELETE TO authenticated
  USING (
    public.current_app_role() <> 'chef'
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

CREATE POLICY "Chef read assigned bookings" ON bookings
  FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'chef'
    AND EXISTS (
      SELECT 1
      FROM staff s
      WHERE lower(s.email) = lower(coalesce(auth.jwt()->>'email', ''))
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(coalesce(bookings.staff_assignments, '[]'::jsonb)) AS assignment
          WHERE assignment->>'staffId' = s.app_id
        )
    )
  );

-- ─── Sensitive tables: non-chef only ────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated full access" ON money_rules;
CREATE POLICY "Non-chef full access" ON money_rules
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

DROP POLICY IF EXISTS "Authenticated full access" ON expenses;
CREATE POLICY "Non-chef full access" ON expenses
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

DROP POLICY IF EXISTS "Authenticated full access" ON customer_payments;
CREATE POLICY "Non-chef full access" ON customer_payments
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

DROP POLICY IF EXISTS "Authenticated full access" ON app_settings;
CREATE POLICY "Non-chef full access" ON app_settings
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

DROP POLICY IF EXISTS "Authenticated full access" ON reconciliations;
CREATE POLICY "Non-chef full access" ON reconciliations
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

DROP POLICY IF EXISTS "Authenticated full access" ON labor_payments;
CREATE POLICY "Non-chef full access" ON labor_payments
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

DROP POLICY IF EXISTS "Authenticated full access" ON owner_profit_payouts;
CREATE POLICY "Non-chef full access" ON owner_profit_payouts
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

DROP POLICY IF EXISTS "Authenticated full access" ON retained_earnings_transactions;
CREATE POLICY "Non-chef full access" ON retained_earnings_transactions
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

DROP POLICY IF EXISTS "Authenticated full access" ON profit_distribution_overrides;
CREATE POLICY "Non-chef full access" ON profit_distribution_overrides
  FOR ALL TO authenticated
  USING (public.current_app_role() <> 'chef')
  WITH CHECK (public.current_app_role() <> 'chef');

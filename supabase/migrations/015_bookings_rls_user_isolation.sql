-- ============================================================================
-- 015_bookings_rls_user_isolation.sql
-- Replace the permissive "Authenticated full access" policy on bookings with
-- per-user scoped policies using the created_by column added in migration 014.
--
-- Policy logic:
--   - created_by = auth.uid()  → user's own booking
--   - created_by IS NULL       → legacy row (imported before migration 014,
--                                 or created via the public inquiry form)
--                                 Any authenticated user can read/write these
--                                 until a backfill assigns them to an owner.
-- ============================================================================

-- ─── Drop the blanket policy from migration 008 ───────────────────────────

DROP POLICY IF EXISTS "Authenticated full access" ON bookings;

-- ─── Replacement: four operation-specific policies ────────────────────────

-- SELECT: own rows + legacy (NULL created_by)
CREATE POLICY "Users read own bookings" ON bookings
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL);

-- INSERT: can only create rows stamped with their own uid, or NULL (inquiry path)
CREATE POLICY "Users insert own bookings" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- UPDATE: own rows + legacy
CREATE POLICY "Users update own bookings" ON bookings
  FOR UPDATE TO authenticated
  USING  (created_by = auth.uid() OR created_by IS NULL)
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- DELETE: own rows + legacy
CREATE POLICY "Users delete own bookings" ON bookings
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL);

-- ─── Notes ────────────────────────────────────────────────────────────────
-- The "Anon inquiry insert" policy from migration 008 is untouched — anon
-- users can still submit the public inquiry form (source = 'inquiry').
--
-- To backfill created_by on legacy rows, run:
--   UPDATE bookings SET created_by = '<owner-user-uuid>' WHERE created_by IS NULL;
-- After the backfill the NULL arm of these policies can be dropped.

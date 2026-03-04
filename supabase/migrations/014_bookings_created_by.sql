-- ============================================================================
-- 014_bookings_created_by.sql
-- Add created_by / updated_by audit columns to bookings.
-- Prepares for user-scoped RLS once multi-user access is needed.
-- ============================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for future RLS policy: USING (created_by = auth.uid())
CREATE INDEX IF NOT EXISTS bookings_created_by_idx ON bookings (created_by);

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON COLUMN bookings.created_by IS 'auth.users.id of the user who created this booking. NULL for bookings imported before this migration or created via the public inquiry form.';
COMMENT ON COLUMN bookings.updated_by IS 'auth.users.id of the last user who modified this booking.';

-- ─── RLS: no policy change yet ────────────────────────────────────────────────
-- Current policy remains: authenticated full access (true).
-- When multi-user access is needed, replace with:
--
--   CREATE POLICY "Users can access their own bookings" ON bookings
--     FOR ALL TO authenticated
--     USING (created_by = auth.uid())
--     WITH CHECK (created_by = auth.uid());
--
-- Until then, the column is populated by the app but not enforced by DB.

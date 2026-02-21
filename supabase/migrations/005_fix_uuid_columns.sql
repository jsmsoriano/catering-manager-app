-- Migration 005: Fix UUID columns that store app string IDs (not real UUIDs)
-- reconciliation_id, staffing_profile_id, and menu_id in bookings are UUID columns
-- but the app stores string IDs like "recon-1234567" or "staffing-abc".

ALTER TABLE bookings
  ALTER COLUMN reconciliation_id   TYPE TEXT USING reconciliation_id::TEXT,
  ALTER COLUMN staffing_profile_id TYPE TEXT USING staffing_profile_id::TEXT,
  ALTER COLUMN menu_id             TYPE TEXT USING menu_id::TEXT;

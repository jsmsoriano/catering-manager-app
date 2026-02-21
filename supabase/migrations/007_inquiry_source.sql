-- Add source column to bookings to distinguish public inquiry submissions
-- 'inquiry' = submitted via public /inquiry form (unauthenticated)
-- null / missing = created by admin

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN bookings.source IS 'inquiry = public form submission; null = admin-created';

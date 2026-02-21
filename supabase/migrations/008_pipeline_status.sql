-- CRM pipeline columns for Kanban board
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pipeline_status TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pipeline_status_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.pipeline_status IS 'CRM stage: inquiry, quote_sent, deposit_pending, booked, completed';
COMMENT ON COLUMN bookings.pipeline_status_updated_at IS 'When pipeline_status was last changed';

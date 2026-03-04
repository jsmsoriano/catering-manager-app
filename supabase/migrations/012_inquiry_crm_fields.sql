-- Inquiry CRM fields + pipeline extension
-- Defensive: some environments may not have run 008_pipeline_status.sql yet.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pipeline_status TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pipeline_status_updated_at TIMESTAMPTZ;

-- Ensure pipeline comments reflect current allowed app values.
COMMENT ON COLUMN bookings.pipeline_status IS
  'CRM stage: inquiry, quote_sent, deposit_pending, booked, completed, declined';

-- Lead ops fields for owner workflow.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS inquiry_score INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source_channel TEXT;

-- Helpful indexes for inbox/pipeline filtering.
CREATE INDEX IF NOT EXISTS bookings_next_follow_up_at_idx ON bookings (next_follow_up_at);
CREATE INDEX IF NOT EXISTS bookings_last_contacted_at_idx ON bookings (last_contacted_at);
CREATE INDEX IF NOT EXISTS bookings_source_channel_idx ON bookings (source_channel);

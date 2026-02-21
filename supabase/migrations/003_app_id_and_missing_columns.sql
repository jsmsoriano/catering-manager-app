-- Migration 003: app_id columns + missing booking/staff fields
-- app_id stores the app's own string IDs (non-UUID) so existing data can be upserted
-- without changing the app's ID scheme.

-- ─── app_id columns ────────────────────────────────────────────────────────────
ALTER TABLE bookings          ADD COLUMN IF NOT EXISTS app_id TEXT UNIQUE;
ALTER TABLE staff             ADD COLUMN IF NOT EXISTS app_id TEXT UNIQUE;
ALTER TABLE expenses          ADD COLUMN IF NOT EXISTS app_id TEXT UNIQUE;
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS app_id TEXT UNIQUE;

-- ─── Booking fields missing from migration 001 ────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_type    TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_value   NUMERIC(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS locked           BOOLEAN;

-- ─── Staff pay/cap fields missing from migration 001 ─────────────────────────
ALTER TABLE staff ADD COLUMN IF NOT EXISTS ownership_share NUMERIC(6,4);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS base_pay_type   TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS base_pay_rate   NUMERIC(10,2);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS cap_percent     NUMERIC(6,4);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS cap_amount      NUMERIC(10,2);

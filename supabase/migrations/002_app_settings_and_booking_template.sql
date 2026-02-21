-- Business template (app_settings) and booking template fields
-- Run in Supabase Dashboard: SQL Editor → New query → paste → Run

-- app_settings: single row (id = 'default'), stores BusinessTemplateConfig in settings JSONB
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON app_settings FOR ALL USING (true) WITH CHECK (true);

-- Seed default row so app can read/update
INSERT INTO app_settings (id, settings, updated_at)
VALUES ('default', '{}', NOW())
ON CONFLICT (id) DO NOTHING;

-- Add template-related columns to bookings (nullable for existing rows)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT;

-- Optional: comment for future multi-tenant (e.g. org_id)
-- ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS org_id TEXT;

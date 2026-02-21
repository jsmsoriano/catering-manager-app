-- Migration 006: Add missing staff columns that were skipped if the table pre-existed
-- migration 001 used CREATE TABLE IF NOT EXISTS, so existing tables kept their old schema.

ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_photo          TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_summary        TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS secondary_roles        TEXT[]   DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS status                 TEXT     NOT NULL DEFAULT 'active';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_owner               BOOLEAN  NOT NULL DEFAULT false;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS owner_role             TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS weekly_availability    JSONB    NOT NULL DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS weekly_availability_hours JSONB DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS unavailable_dates      TEXT[]   DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hourly_rate            NUMERIC(10,2);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS notes                  TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hire_date              DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS created_at             TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE staff ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ DEFAULT NOW();

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

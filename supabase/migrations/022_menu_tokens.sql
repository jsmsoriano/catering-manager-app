-- ============================================================================
-- 022_menu_tokens.sql
-- Customer-facing per-guest menu collection for hibachi private dinner events.
-- Admin generates a token URL → client fills in each guest's order.
-- ============================================================================

CREATE TABLE IF NOT EXISTS menu_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT NOT NULL UNIQUE,            -- URL-safe UUID used in /menu/[token]
  booking_id    TEXT NOT NULL,                   -- matches Booking.id (app_id)
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'submitted' | 'reopened'

  -- Snapshot of booking info + template config sent to client (no pricing)
  snapshot      JSONB NOT NULL DEFAULT '{}',

  -- Guest selections submitted by client (array of GuestMenuSelection)
  submissions   JSONB,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ
);

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE menu_tokens ENABLE ROW LEVEL SECURITY;

-- Public read by token (no auth — URL is the secret)
CREATE POLICY "menu_tokens_public_read"
  ON menu_tokens FOR SELECT
  USING (true);

-- Public submit (unauthenticated client submits their order)
CREATE POLICY "menu_tokens_public_update"
  ON menu_tokens FOR UPDATE
  USING (true);

-- Only authenticated admins can create menu token links
CREATE POLICY "menu_tokens_auth_insert"
  ON menu_tokens FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_menu_tokens_token      ON menu_tokens(token);
CREATE INDEX IF NOT EXISTS idx_menu_tokens_booking_id ON menu_tokens(booking_id);
CREATE INDEX IF NOT EXISTS idx_menu_tokens_status     ON menu_tokens(status);

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE  menu_tokens             IS 'Customer-facing per-guest menu collection links for hibachi private dinner events';
COMMENT ON COLUMN menu_tokens.token       IS 'UUID used as public URL slug — /menu/[token]';
COMMENT ON COLUMN menu_tokens.booking_id  IS 'References Booking.id stored in client localStorage';
COMMENT ON COLUMN menu_tokens.snapshot    IS 'Booking info + template config (no pricing) sent to client';
COMMENT ON COLUMN menu_tokens.submissions IS 'Array of GuestMenuSelection submitted by client';
COMMENT ON COLUMN menu_tokens.status      IS 'pending = link sent; submitted = client submitted orders; reopened = admin reset for edits';

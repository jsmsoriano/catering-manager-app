-- ============================================================================
-- 010_proposal_tokens.sql
-- Shareable proposal/quote links for catering clients.
-- Admin generates a token-based URL → client views quote and accepts online.
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT NOT NULL UNIQUE,        -- URL-safe UUID used in /proposal/[token]
  booking_id  TEXT NOT NULL,               -- app-level booking ID (matches Booking.id in localStorage)
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'expired'

  -- Point-in-time snapshot of booking at proposal send time
  snapshot    JSONB NOT NULL DEFAULT '{}',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ                  -- null = no expiry
);

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE proposal_tokens ENABLE ROW LEVEL SECURITY;

-- Anyone can read a proposal by token (public proposal URL — no auth required)
CREATE POLICY "proposal_tokens_public_read"
  ON proposal_tokens FOR SELECT
  USING (true);

-- Only authenticated users (admin) can create proposals
CREATE POLICY "proposal_tokens_auth_insert"
  ON proposal_tokens FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users (admin) can update proposals
CREATE POLICY "proposal_tokens_auth_update"
  ON proposal_tokens FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_proposal_tokens_token      ON proposal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_proposal_tokens_booking_id ON proposal_tokens(booking_id);
CREATE INDEX IF NOT EXISTS idx_proposal_tokens_status     ON proposal_tokens(status);

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE  proposal_tokens          IS 'Shareable quote/proposal links sent to catering clients';
COMMENT ON COLUMN proposal_tokens.token    IS 'UUID used as public URL slug — /proposal/[token]';
COMMENT ON COLUMN proposal_tokens.booking_id IS 'References Booking.id stored in client localStorage';
COMMENT ON COLUMN proposal_tokens.snapshot IS 'Point-in-time booking snapshot: customerName, eventDate, pricing, menu summary, etc.';
COMMENT ON COLUMN proposal_tokens.status   IS 'pending = sent, not yet accepted; accepted = client clicked Accept; expired = manually expired';

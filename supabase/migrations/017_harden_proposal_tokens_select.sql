-- ============================================================================
-- 017_harden_proposal_tokens_select.sql
-- Remove anonymous table-wide reads on proposal_tokens.
--
-- Public proposal access must happen through server endpoints using
-- SUPABASE_SERVICE_ROLE_KEY and token-scoped queries.
-- ============================================================================

DROP POLICY IF EXISTS "proposal_tokens_public_read" ON proposal_tokens;

CREATE POLICY "proposal_tokens_auth_select"
  ON proposal_tokens FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- 018_drop_proposal_tokens_public_read.sql
-- Reconcile final proposal_tokens SELECT policies.
--
-- The public proposal page fetches via GET /api/proposals/public/[token], which
-- uses the service-role client and validates token/expiry. Anon no longer needs
-- direct read access. Without this policy, anyone with the anon key can no longer
-- hit PostgREST and dump all proposal_tokens.
-- ============================================================================

DROP POLICY IF EXISTS "proposal_tokens_public_read" ON proposal_tokens;

-- Keep authenticated SELECT available for internal app workflows.
DROP POLICY IF EXISTS "proposal_tokens_auth_select" ON proposal_tokens;
CREATE POLICY "proposal_tokens_auth_select"
  ON proposal_tokens FOR SELECT TO authenticated
  USING (true);

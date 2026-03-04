# Security Deploy Checklist

## Required before deploy
1. Set environment variables on your host:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BYPASS_AUTH=false`
   - `NEXT_PUBLIC_SITE_URL=https://your-app-domain`
   - `RESEND_ALLOWED_EMAIL_DOMAINS=yourcustomerdomain.com,...` (required for `POST /api/emails/send-public` in production)
   - `ADMIN_EMAILS=owner@yourcompany.com,...` (recommended bootstrap admin fallback)

2. Apply database migration:
   - [`supabase/migrations/017_harden_proposal_tokens_select.sql`](/Users/soriano/Documents/catering-manager-app/supabase/migrations/017_harden_proposal_tokens_select.sql)
   - [`supabase/migrations/018_drop_proposal_tokens_public_read.sql`](/Users/soriano/Documents/catering-manager-app/supabase/migrations/018_drop_proposal_tokens_public_read.sql)

3. Verify protected endpoints:
   - `GET /api/proposals/public/:token` returns one proposal by token only.
   - `POST /api/proposals/accept` works for valid token.
   - `POST /api/proposals/update-guests` works for valid token.
   - `POST /api/proposals/request-menu-change` works for valid token.
   - `POST /api/proposals/menu-change-status` rejects non-admin/manager users.

4. Confirm abuse controls:
   - `POST /api/emails/send-public` rate limits after repeated calls.
   - In production, `POST /api/emails/send-public` returns `503` if `RESEND_ALLOWED_EMAIL_DOMAINS` is unset.

5. Confirm diagnostics are locked down:
   - `/api/supabase-status` and `/api/supabase-db-test` return `401/403` for non-admin.

## Manual SQL execution (Supabase SQL Editor)
Run:

```sql
-- 017_harden_proposal_tokens_select.sql + 018_drop_proposal_tokens_public_read.sql
DROP POLICY IF EXISTS "proposal_tokens_public_read" ON proposal_tokens;

CREATE POLICY "proposal_tokens_auth_select"
  ON proposal_tokens FOR SELECT TO authenticated
  USING (true);
```

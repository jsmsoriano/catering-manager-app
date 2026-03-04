# Supabase schema and testing

## 1. Apply the schema in Supabase

1. Open your project: [Supabase Dashboard](https://app.supabase.com) → select **catering-manager-app** (or your project).
2. Go to **SQL Editor** → **New query**.
3. Apply migration files in order (`001` → latest), including:
   - `migrations/017_harden_proposal_tokens_select.sql`
   - `migrations/018_drop_proposal_tokens_public_read.sql`
4. Click **Run** for each migration. All tables, indexes, and RLS policies will be created (or skipped if already applied).

## 2. Test the database from the app

With the app running (`npm run dev`), call:

```bash
curl http://localhost:3000/api/supabase-db-test
```

Or open in the browser: **http://localhost:3000/api/supabase-db-test**

You should get JSON like:

```json
{
  "ok": true,
  "message": "Database schema is present; all tables accessible.",
  "tables": {
    "money_rules": { "exists": true },
    "menu_items": { "exists": true },
    "staff": { "exists": true },
    ...
  }
}
```

If a table is missing, that table will have `"exists": false` and an `"error"` field with the PostgREST message. Run the migration SQL in the Dashboard and call the test again.

## 3. Env required

Ensure `.env.local` has:

- `NEXT_PUBLIC_SUPABASE_URL` = your project URL (e.g. `https://xxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your project anon key
- `SUPABASE_SERVICE_ROLE_KEY` = your project service role key (server-only; never expose to browser)
- `BYPASS_AUTH=false` for production
- `NEXT_PUBLIC_SITE_URL=https://your-app-domain` for proposal link generation
- `RESEND_ALLOWED_EMAIL_DOMAINS=...` for public inquiry email restrictions
- `ADMIN_EMAILS=owner@...` for bootstrap admin access fallback

From Supabase: **Project Settings** → **API** → Project URL and anon public key.

# Supabase schema and testing

## 1. Apply the schema in Supabase

1. Open your project: [Supabase Dashboard](https://app.supabase.com) → select **catering-manager-app** (or your project).
2. Go to **SQL Editor** → **New query**.
3. Copy the contents of `migrations/001_initial_schema.sql` and paste into the editor.
4. Click **Run**. All tables and RLS policies will be created (or skipped if they already exist).

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

From Supabase: **Project Settings** → **API** → Project URL and anon public key.

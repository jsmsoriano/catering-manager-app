# Supabase Setup Guide

This project now includes a production-safe Supabase baseline for:

- Browser client auth calls
- Server-side Supabase access in App Router
- Middleware session refresh
- Admin/service-role access (server-only)
- Starter SQL migration with RLS policies

## 1) Configure environment variables

Copy `.env.example` to `.env.local` and fill in values from your Supabase project:

```bash
cp .env.example .env.local
```

Required values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

## 2) Apply migrations

Migration files are in `supabase/migrations/`.

Current baseline migration:

- `20260215120000_create_profiles.sql`

Apply this SQL in one of two ways:

1. **Supabase Dashboard SQL Editor** (paste and run)
2. **Supabase CLI** (if installed in your environment)

## 3) Auth flow wiring

Implemented routes and utilities:

- `app/login/page.tsx` - magic link login form
- `app/auth/callback/route.ts` - exchanges auth code/token and redirects
- `proxy.ts` - refreshes Supabase auth session cookies

## 4) Supabase clients

- `lib/supabase/client.ts` - browser client (`createBrowserClient`)
- `lib/supabase/server.ts` - server client (`createServerClient`)
- `lib/supabase/admin.ts` - admin client (`createClient` with service role key)
- `lib/supabase/require-user.ts` - helper to gate server routes/pages

## 5) Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Keep all admin operations in server-only code paths.
- Use RLS for every table in `public`.
- Treat `auth.uid()` as the canonical identity source for row ownership.

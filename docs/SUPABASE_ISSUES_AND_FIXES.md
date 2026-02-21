# Supabase issues and fixes

## 1. **event_menus.booking_id type mismatch (fixed)**

**Issue:** `event_menus.booking_id` is UUID (references `bookings(id)`), but the app uses `app_id` (e.g. `booking-123`) as the booking identifier everywhere. On the Inquiries page, guest menu is loaded with:

```ts
.eq('booking_id', selectedId)  // selectedId is app_id (string)
```

So the query never matches, because `booking_id` in the DB is the internal UUID, not `app_id`. Guest menu for inquiries would never load from Supabase.

**Fix:** Migration 009 changes `event_menus.booking_id` to TEXT and stores `app_id`. The public inquiry form now inserts `event_menus` with `booking_id: bookingId` (app_id). Inquiries page already passes app_id, so the query works.

**Note:** After 009, existing `event_menus` rows (if any) will have `booking_id` as the UUID cast to text, not app_id. Those rows will not match app queries by app_id. If you have existing data, run a one-time update to set `booking_id = b.app_id` from `bookings b` where `b.id::text = event_menus.booking_id`.

---

## 2. **Pipeline columns (migration 008)**

**Requirement:** For pipeline Kanban and inquiry form to work with Supabase, run migration **008_pipeline_status.sql** so that `bookings` has:

- `pipeline_status` TEXT  
- `pipeline_status_updated_at` TIMESTAMPTZ  

Without it, inquiry form insert and booking sync upserts that send these columns will fail.

---

## 3. **Environment variables**

The app expects:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If either is missing, `createClient()` returns `null` and Supabase is effectively disabled (e.g. sync and inquiry submit will fail or fall back).

---

## 4. **RLS and policies**

All tables use a permissive policy: `"Allow all for anon"` with `USING (true) WITH CHECK (true)`. This is suitable for development or a single-tenant app with auth handled in the app. For production multi-tenant or stricter security, you should replace these with policies that restrict by `auth.uid()` or similar.

---

## 5. **Summary**

| Item | Status |
|------|--------|
| event_menus.booking_id vs app_id | Fixed in migration 009 + inquiry form + code uses app_id |
| pipeline_status columns | Ensure migration 008 is applied |
| Env vars | Document and set in deployment |
| RLS | Currently permissive; tighten for production if needed |

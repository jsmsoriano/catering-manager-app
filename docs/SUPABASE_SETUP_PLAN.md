# Plan: Set Up App to Use Supabase

This plan migrates the catering app from **localStorage** to **Supabase** (PostgreSQL + optional Auth) while keeping existing TypeScript types and app behavior.

---

## 1. Current State Summary

| Storage key | Entity | Used in | Storage module / inline |
|------------|--------|---------|--------------------------|
| `bookings` | `Booking[]` | Bookings, Reports, Reconcile, Shopping, Menu, Dashboard | Inline + [`lib/storage.ts`] pattern |
| `menuItems` | `MenuItem[]` | Menus, Booking Menu | Inline in `app/menus/page.tsx`, `app/bookings/menu/page.tsx` |
| `staff` | `StaffMember[]` | Staff, Bookings, Reports, Reconcile | Inline in `app/staff/page.tsx`, profile |
| `expenses` | `Expense[]` | Expenses, Reconcile, Shopping | `app/expenses/page.tsx` |
| `inventoryItems` | `InventoryItem[]` | Expenses (Inventory tab) | `app/expenses/page.tsx` |
| `inventoryTransactions` | `InventoryTransaction[]` | Expenses | `app/expenses/page.tsx` |
| `reconciliations` | `EventReconciliation[]` | Reconcile | `app/bookings/reconcile/page.tsx` |
| `eventMenus` | `EventMenu[]` | Booking Menu | `app/bookings/menu/page.tsx` |
| `shoppingLists` | `ShoppingList[]` | Shopping, Expenses | [`lib/shoppingStorage.ts`] |
| `moneyRules` | `MoneyRules` (single object) | Calculator, Reconcile, Reports, Business Rules | [`lib/moneyRules.ts`] |
| `laborPayments` | `LaborPaymentRecord[]` | Reports (owner-monthly) | [`lib/financeStorage.ts`] |
| `ownerProfitPayouts` | `OwnerProfitPayoutRecord[]` | Reports | `lib/financeStorage.ts` |
| `retainedEarningsTransactions` | `RetainedEarningsTransaction[]` | Reports | `lib/financeStorage.ts` |
| `profitDistributionOverrides` | `ProfitDistributionOverride[]` | Reports (owner-monthly) | `lib/financeStorage.ts` |
| `customerPayments` | `CustomerPaymentRecord[]` | (available for future use) | `lib/financeStorage.ts` |

Existing Supabase setup:

- [`lib/supabase/client.ts`](lib/supabase/client.ts) – browser client
- [`lib/supabase/server.ts`](lib/supabase/server.ts) – server client (cookies)
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- No auth or tables in use yet

---

## 2. Architecture Decisions

- **Database**: Supabase (PostgreSQL). One project; one schema (e.g. `public`).
- **Auth (v1)**: Optional. You can keep the app single-tenant (no login) and use the anon key with Row Level Security (RLS) disabled or permissive, then add Supabase Auth later for multi-user.
- **Data access**: Prefer **server-side** reads/writes (Server Components, Server Actions, or API routes that use `createClient()` from `lib/supabase/server.ts`) so the anon key never does cross-user writes. Client can still call Server Actions or API routes.
- **Migration path**: Introduce a **data layer** (e.g. `lib/db/` or `lib/supabase/queries/`) that mirrors current “load/save” semantics. Pages and existing libs (e.g. `moneyRules`, `shoppingStorage`, `financeStorage`) switch to this layer; localStorage remains as fallback or is removed once Supabase is verified.

---

## 3. Supabase Project Setup

1. **Create project** (if not already): [Supabase Dashboard](https://app.supabase.com) → New project.
2. **Env**: Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already documented in `.env.example`).
3. **Verify**: Use existing `GET /api/supabase-status` to confirm client and connectivity.

---

## 4. Database Schema (Tables)

Create tables that match your TypeScript entities. Use `id` (uuid) primary keys and `created_at` / `updated_at` where applicable. Prefer one table per entity; use JSONB for nested structures (e.g. arrays of assignments, availability) to avoid a huge number of tables in v1.

Suggested table list (names and columns aligned with `lib/*Types.ts`):

| Table | Purpose | Key columns / JSONB |
|-------|---------|----------------------|
| `bookings` | All booking records | Columns for scalar fields; `staff_assignments` JSONB; `menu_pricing_snapshot` JSONB |
| `menu_items` | Catalog of menu items | id, name, category, description, price_per_serving, cost_per_serving, is_available, dietary_tags, allergens |
| `staff` | Staff members | id, name, email, phone, profile_photo (text URL or storage path), profile_summary, primary_role, secondary_roles[], status, is_owner, owner_role, weekly_availability JSONB, weekly_availability_hours JSONB, unavailable_dates[], hourly_rate, notes |
| `expenses` | Expense records | id, date, category, amount, description, booking_id, receipt_photo (text or storage ref), notes, source, source_id |
| `inventory_items` | Inventory master | id, name, category, unit, current_stock, par_level, reorder_point, avg_unit_cost, ... |
| `inventory_transactions` | Stock movements | id, item_id, type, quantity, unit_cost, date, notes, ... |
| `reconciliations` | Event reconciliations | id, booking_id, status, actual_* fields, actual_labor_entries JSONB, notes, reconciled_at, created_at, updated_at |
| `event_menus` | Per-booking guest menus | id, booking_id, guest_selections JSONB, created_at, updated_at |
| `shopping_lists` | Per-booking shopping | id, booking_id, status, notes, planned_at, purchased_at, locked_at, created_at, updated_at |
| `shopping_list_items` | Line items for a list | id, shopping_list_id, name, category, planned_qty, planned_unit, actual_qty, actual_unit_cost, purchased, notes |
| `money_rules` | Single config row | id (e.g. `default`), rules JSONB (full MoneyRules), updated_at |
| `labor_payments` | Labor payment records | id, booking_id, event_date, event_time, customer_name, staff_id, staff_name, staff_role, chef_role, amount, recorded_at |
| `owner_profit_payouts` | Owner payout records | id, owner_role, amount, payout_date, notes, created_at |
| `retained_earnings_transactions` | Retained earnings | id, type, amount, transaction_date, notes, created_at |
| `profit_distribution_overrides` | Per-booking overrides | id, booking_id, chef_payouts, owner_a_payout, owner_b_payout, retained_earnings, distribution_status, notes, updated_at |
| `customer_payments` | Customer payment records | id, booking_id, payment_date, amount, type, method, notes, recorded_at |

Implementation options:

- **Option A**: Hand-written SQL migrations in Supabase (Dashboard SQL editor or `supabase/migrations/` if you use Supabase CLI).
- **Option B**: Define tables via Dashboard Table Editor, then export SQL for version control.

Recommendation: Use **Supabase CLI** (`supabase init`, `supabase migration new <name>`) so schema is in repo and repeatable.

---

## 5. Row Level Security (RLS)

- **Phase 1 (single-tenant, no auth)**: Either disable RLS on all tables or add a single policy per table that allows all for anon (e.g. `true` for SELECT/INSERT/UPDATE/DELETE). This matches “one business, one browser” usage.
- **Phase 2 (multi-user later)**: Enable Supabase Auth, add a `user_id` or `tenant_id` (or both) to tables, and restrict policies to `auth.uid()` or tenant. No code change needed in this plan for Phase 2 beyond adding columns and policies.

---

## 6. Data Access Layer

Introduce a single place that talks to Supabase so the rest of the app does not depend on localStorage vs Supabase.

- **Location**: e.g. `lib/db/` or `lib/supabase/data/`.
- **Pattern**: One module per domain (or one module per table), with functions like:
  - `getBookings(): Promise<Booking[]>`
  - `saveBookings(data: Booking[]): Promise<void>` or `upsertBooking(b: Booking): Promise<void>` and `deleteBooking(id): Promise<void>`
  - Same for staff, menu_items, expenses, etc.
- **Server-only**: These functions should use `createClient()` from `lib/supabase/server.ts` and only be called from Server Components, Server Actions, or API routes. This keeps the anon key usage on the server and avoids exposing table structure to the client.
- **Client usage**: Pages that today read/write localStorage in `useEffect` or event handlers will instead:
  - Call **Server Actions** (e.g. `getBookings()`, `saveBooking(booking)`), or
  - Call **API routes** (e.g. `GET /api/bookings`, `POST /api/bookings`) that use the same data layer.

Concrete steps:

1. Add `lib/db/bookings.ts` (or `lib/supabase/queries/bookings.ts`) with server-only functions that select/insert/update/delete `bookings` and return `Booking[]` / single `Booking`.
2. Map TypeScript `Booking` to table columns (and JSONB) in both directions.
3. Repeat for each entity (staff, menu_items, expenses, …).
4. For `money_rules`: one row (e.g. `id = 'default'`); `getMoneyRules()` / `saveMoneyRules(rules)`.
5. Keep existing types in `lib/*Types.ts`; the data layer only does serialization/deserialization (e.g. `staff_assignments` ↔ `Booking.staffAssignments`).

---

## 7. API Surface (Server Actions vs API Routes)

- **Prefer Server Actions** for mutations and simple reads from forms/lists: e.g. `saveBooking(booking)`, `getBookings()`, `getStaff()`. Next.js 16 supports them; no need for separate API route files for every entity.
- **Use API routes** where you need:
  - Non-form callers (e.g. external or script),
  - Or a single route that returns multiple resources (e.g. report payload).
- Example: Bookings page can call `const bookings = await getBookings();` in a Server Component, or call a Server Action from a Client Component after a form submit. Reconcile page can call `getReconciliations()`, `saveReconciliations(...)` via Server Actions.

You can keep `/api/supabase-status` as-is for health checks.

---

## 8. Migration Order (by dependency)

Suggested order so that dependencies are available in Supabase before code expects them:

1. **money_rules** – no foreign keys; used everywhere.
2. **menu_items** – no FKs; used by bookings and event menus.
3. **staff** – no FKs; used by bookings and reports.
4. **bookings** – central; referenced by event_menus, shopping_lists, reconciliations, expenses, finance tables.
5. **event_menus** – `booking_id` → bookings.
6. **shopping_lists** + **shopping_list_items** – `booking_id` → bookings.
7. **expenses** – optional `booking_id` → bookings.
8. **inventory_items** + **inventory_transactions** – optional for v1.
9. **reconciliations** – `booking_id` → bookings.
10. **labor_payments**, **profit_distribution_overrides**, **owner_profit_payouts**, **retained_earnings_transactions**, **customer_payments** – all can reference `booking_id` or stand alone.

For a minimal first slice: **money_rules**, **menu_items**, **staff**, **bookings**. Then add **event_menus**, **shopping_lists** (+ items), **expenses**, **reconciliations**, then the rest.

---

## 9. Per-Page / Per-Module Changes (high level)

- **Dashboard** (`app/page.tsx`): Replace `localStorage.getItem('bookings')` with data from Server Component or Server Action (e.g. `getBookings()`).
- **Bookings** (`app/bookings/page.tsx`): Load/save via `getBookings()` / `saveBookings()` or `upsertBooking`; remove direct localStorage.
- **Menus** (`app/menus/page.tsx`): Load/save `menu_items` via new data layer; remove `menuItems` localStorage.
- **Staff** (`app/staff/page.tsx`, profile): Load/save staff via data layer.
- **Expenses** (`app/expenses/page.tsx`): Load/save expenses, inventory items, inventory transactions via data layer.
- **Booking subpages** (menu, shopping, reconcile): Load/save event_menus, shopping_lists, reconciliations, and any booking updates via data layer.
- **Reports** (dashboard, business-summary, owner-monthly, comparative): Read bookings, staff, expenses, money_rules, finance tables from data layer (read-only for most reports).
- **Business Rules** (`app/business-rules/page.tsx`): Load/save `money_rules` via data layer; can keep `lib/moneyRules.ts` but have it call the data layer instead of localStorage.
- **lib/moneyRules.ts**: Replace `localStorage.getItem('moneyRules')` / `setItem` with async get/set that call the data layer (or move logic into Server Actions and call from client).
- **lib/shoppingStorage.ts**: Replace with functions that call the data layer (or thin wrappers that call Server Actions).
- **lib/financeStorage.ts**: Same – replace localStorage with data layer / Server Actions.

Shared helpers (e.g. `safeJsonParse`, `canUseBrowserStorage`) can remain for any client-side-only fallback or be removed once everything is server-backed.

---

## 10. Optional: Auth and Multi-Tenancy

- **Later**: Enable Supabase Auth (e.g. email/password or magic link). Add `user_id` (and optionally `tenant_id`) to all tables. Update RLS so each user (or tenant) sees only their rows.
- **App**: Add login/signup UI, protect routes with middleware that checks `auth.getSession()`, and pass user/tenant into data layer for scoping. Not required for the initial “use Supabase as backend” migration.

---

## 11. Optional: Migrate Existing localStorage Data

- **Export script**: In browser console or a one-off page, read all localStorage keys above, JSON.stringify, and let the user download a file.
- **Import script**: Server Action or API route that reads the uploaded file (or pasted JSON), validates shape, and inserts into Supabase via the data layer (with conflict handling, e.g. on `id` or skip existing).
- Alternatively: manual data entry or re-creating a small set of test data in Supabase after schema is created.

---

## 12. Checklist Summary

- [ ] Supabase project created; env vars set; `/api/supabase-status` returns ok.
- [ ] Schema: tables created (migrations or Dashboard); RLS set for single-tenant (permissive or off).
- [ ] Data layer: `lib/db/` (or `lib/supabase/data/`) with server-only load/save for each entity.
- [ ] Money rules: table + get/set; `lib/moneyRules.ts` or business-rules page uses data layer.
- [ ] Bookings: table + get/upsert/delete; bookings page and all booking-dependent pages use data layer.
- [ ] Staff, menu_items, expenses, reconciliations, event_menus, shopping_lists (+ items), finance tables: same pattern.
- [ ] Remove or guard localStorage usage so production uses Supabase only (or keep localStorage as dev fallback behind a flag).
- [ ] (Optional) Export/import script for existing localStorage data.
- [ ] (Later) Auth + RLS by user/tenant.

This plan gets the app running on Supabase with the same behavior as today, and leaves a clear path to add auth and multi-tenancy later.

-- ============================================================================
-- 013_restore_fk_constraints.sql
-- Restore FK constraints and NOT NULL guarantees that were dropped when
-- booking_id columns were converted from UUID to TEXT in migrations 004 and 009.
-- Also fixes the overly-permissive RLS policy on shopping_list_items (migration 011).
-- ============================================================================

-- ─── Restore NOT NULL on booking_id columns ───────────────────────────────────

-- customer_payments: payments always belong to a booking
ALTER TABLE customer_payments
  ALTER COLUMN booking_id SET NOT NULL;

-- event_menus: menu selections always belong to a booking
ALTER TABLE event_menus
  ALTER COLUMN booking_id SET NOT NULL;

-- expenses.booking_id intentionally left nullable — general expenses may have no booking.

-- ─── Restore FK constraints (TEXT → bookings.app_id) ─────────────────────────

ALTER TABLE customer_payments
  ADD CONSTRAINT customer_payments_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(app_id) ON DELETE CASCADE;

-- expenses: nullable FK — set null instead of cascading on delete
ALTER TABLE expenses
  ADD CONSTRAINT expenses_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(app_id) ON DELETE SET NULL;

ALTER TABLE event_menus
  ADD CONSTRAINT event_menus_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(app_id) ON DELETE CASCADE;

-- ─── Fix shopping_list_items RLS (replaces overly-open policy from 011) ───────
-- Migration 011 granted full CRUD to anon, contradicting the stricter model
-- established in 008. Align with the rest of the schema.

DROP POLICY IF EXISTS "Allow all for anon" ON shopping_list_items;

-- Authenticated users (admin) have full access
CREATE POLICY "shopping_list_items_auth_all"
  ON shopping_list_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Anonymous users: no direct access — items are managed server-side only
-- (The shopping list generate endpoint is authenticated; anon users never
--  write items directly. Remove the anon INSERT if that changes.)

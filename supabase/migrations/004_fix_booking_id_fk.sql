-- Migration 004: Fix booking_id FK constraints in customer_payments and expenses
-- The app uses string IDs (e.g. 'booking-1234567') not UUIDs, so the FK reference
-- to bookings(id) UUID causes a type mismatch when syncing from localStorage.

-- customer_payments: drop UUID FK, convert to TEXT (still required — payments always have a booking)
ALTER TABLE customer_payments
  DROP CONSTRAINT IF EXISTS customer_payments_booking_id_fkey;

ALTER TABLE customer_payments
  ALTER COLUMN booking_id TYPE TEXT USING booking_id::TEXT;

-- expenses: drop UUID FK, convert to TEXT (nullable — general expenses may have no booking)
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_booking_id_fkey;

ALTER TABLE expenses
  ALTER COLUMN booking_id TYPE TEXT USING booking_id::TEXT;

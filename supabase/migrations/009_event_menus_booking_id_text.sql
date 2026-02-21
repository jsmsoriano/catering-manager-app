-- event_menus.booking_id: use app_id (TEXT) so the app can query by booking app_id
-- The app identifies bookings by app_id everywhere; UUID was only used for FK.
-- Align with customer_payments and expenses which already use TEXT booking_id.

ALTER TABLE event_menus
  DROP CONSTRAINT IF EXISTS event_menus_booking_id_fkey;

ALTER TABLE event_menus
  ALTER COLUMN booking_id TYPE TEXT USING booking_id::TEXT;

COMMENT ON COLUMN event_menus.booking_id IS 'bookings.app_id (string), not bookings.id (UUID)';

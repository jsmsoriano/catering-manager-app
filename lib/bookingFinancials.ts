import { calculateEventFinancials } from './moneyRules';
import type { Booking } from './bookingTypes';
import type { EventFinancials, MoneyRules } from './types';

export type BookingPricingSource = 'rules' | 'menu';

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getBookingPricingSource(booking: Booking): BookingPricingSource {
  return booking.menuPricingSnapshot ? 'menu' : 'rules';
}

export function calculateBookingFinancials(
  booking: Booking,
  rules: MoneyRules
): { financials: EventFinancials; pricingSource: BookingPricingSource } {
  const snapshot = booking.menuPricingSnapshot;

  const financials = calculateEventFinancials(
    {
      adults: booking.adults,
      children: booking.children,
      eventType: booking.eventType,
      eventDate: parseLocalDate(booking.eventDate),
      distanceMiles: booking.distanceMiles,
      premiumAddOn: booking.premiumAddOn,
      staffingProfileId: booking.staffingProfileId,
      subtotalOverride: snapshot?.subtotalOverride,
      foodCostOverride: snapshot?.foodCostOverride,
    },
    rules
  );

  return {
    financials,
    pricingSource: getBookingPricingSource(booking),
  };
}

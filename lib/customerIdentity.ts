import type { Booking } from './bookingTypes';

export type CustomerId = string;

export function normalizePhone(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function normalizeCustomerId(phone: string, email: string): CustomerId {
  const p = normalizePhone(phone ?? '');
  if (p.length >= 7) return `phone:${p}`;
  const e = (email ?? '').trim().toLowerCase();
  return e ? `email:${e}` : 'unknown';
}

export function getBookingCustomerId(booking: Pick<Booking, 'customerPhone' | 'customerEmail' | 'customerId'>): CustomerId {
  if (booking.customerId && booking.customerId !== 'unknown') return booking.customerId;
  return normalizeCustomerId(booking.customerPhone ?? '', booking.customerEmail ?? '');
}

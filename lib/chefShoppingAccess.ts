import type { Booking } from './bookingTypes';
import { bookingHasStaff } from './chefIdentity';

function parseEventDateLocal(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Chef can access event shopping list only when:
 * - booking is assigned to that chef
 * - booking is not cancelled
 * - event date is today or in the future
 */
export function canChefAccessShopping(
  booking: Pick<Booking, 'eventDate' | 'status' | 'staffAssignments'>,
  chefStaffId: string | null,
  now: Date = new Date()
): boolean {
  if (!chefStaffId) return false;
  if (booking.status === 'cancelled') return false;
  const eventDate = parseEventDateLocal(booking.eventDate);
  const todayStart = startOfLocalDay(now);
  if (eventDate.getTime() < todayStart.getTime()) return false;
  return bookingHasStaff(booking.staffAssignments, chefStaffId);
}


/**
 * Staff availability checks for event scheduling.
 * Staff can set: weeklyAvailability (which days), weeklyAvailabilityHours (time window per day), and unavailableDates (all-day blacklist).
 */

import type { StaffMember } from './staffTypes';
import type { DayOfWeek } from './staffTypes';
import { DEFAULT_WEEKLY_AVAILABILITY_HOURS } from './staffTypes';

const JS_DAY_TO_DOW: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Parse "YYYY-MM-DD" and "HH:mm" into a comparable form.
 * eventTime is e.g. "18:00". We treat it as the start of the event; staff must be available at that time.
 */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Returns true if the staff member is available for an event on the given date and time.
 * - Event date must not be in unavailableDates.
 * - Day of week must be available in weeklyAvailability.
 * - If weeklyAvailabilityHours is set, event time must fall within [startTime, endTime] for that day.
 */
export function isStaffAvailableForEvent(
  staff: StaffMember,
  eventDate: string,
  eventTime: string
): boolean {
  // All-day blacklist
  const unavailable = staff.unavailableDates ?? [];
  if (unavailable.includes(eventDate)) return false;

  const date = new Date(eventDate + 'T12:00:00');
  const dayOfWeek = JS_DAY_TO_DOW[date.getDay()];
  const weekly = staff.weeklyAvailability ?? {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true,
  };
  if (!weekly[dayOfWeek]) return false;

  const hours = staff.weeklyAvailabilityHours ?? DEFAULT_WEEKLY_AVAILABILITY_HOURS;
  const window = hours[dayOfWeek];
  if (window?.startTime != null && window?.endTime != null) {
    const eventMins = parseTimeToMinutes(eventTime);
    const startMins = parseTimeToMinutes(window.startTime);
    const endMins = parseTimeToMinutes(window.endTime);
    if (eventMins < startMins || eventMins > endMins) return false;
  }

  return true;
}

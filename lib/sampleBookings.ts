import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import {
  DEFAULT_DEPOSIT_PERCENT,
  calculatePrepPurchaseByDate,
  normalizeBookingWorkflowFields,
} from './bookingWorkflow';
import { calculateEventFinancials } from './moneyRules';
import type { Booking } from './bookingTypes';
import type { EventType, MoneyRules } from './types';

interface SampleSlot {
  dayOffset: number;
  time: string;
  label: 'weekday-dinner' | 'weekend-lunch' | 'weekend-dinner';
}

interface BuildSampleBookingOptions {
  weekIndex: number;
  slotIndex: number;
  eventDate: Date;
  time: string;
  label: SampleSlot['label'];
  rules: MoneyRules;
}

const SAMPLE_SLOTS: SampleSlot[] = [
  { dayOffset: 1, time: '18:00', label: 'weekday-dinner' }, // Tuesday dinner
  { dayOffset: 2, time: '18:30', label: 'weekday-dinner' }, // Wednesday dinner
  { dayOffset: 3, time: '19:00', label: 'weekday-dinner' }, // Thursday dinner
  { dayOffset: 5, time: '12:30', label: 'weekend-lunch' }, // Saturday lunch
  { dayOffset: 6, time: '18:30', label: 'weekend-dinner' }, // Sunday dinner
];

const CUSTOMER_NAMES = [
  'Sarah Johnson',
  'Michael Chen',
  'Emily Rodriguez',
  'David Kim',
  'Jessica Martinez',
  'Christopher Lee',
  'Amanda Wilson',
  'James Taylor',
  'Jennifer Brown',
  'Robert Garcia',
  'Lisa Anderson',
  'William Thomas',
  'Mary Jackson',
  'Daniel White',
  'Patricia Harris',
  'Matthew Martin',
  'Linda Thompson',
  'Joseph Moore',
  'Barbara Clark',
  'Richard Lewis',
  'Olivia Walker',
  'Ethan Hall',
  'Chloe Adams',
  'Noah Scott',
  'Grace Carter',
  'Mason Evans',
  'Lily Turner',
  'Lucas Parker',
  'Avery Collins',
  'Benjamin Murphy',
];

const LOCATIONS = [
  'Downtown Convention Center',
  'Seaside Resort & Spa',
  'Mountain View Lodge',
  'Historic Estate Gardens',
  'Riverside Pavilion',
  'Urban Loft Space',
  'Lakeside Country Club',
  'Botanical Gardens',
  'Rooftop Terrace Venue',
  'Beach House Retreat',
  'Private Residence - Hills',
  'Corporate Office Complex',
  'Art Gallery Downtown',
  'Vineyard Estate',
  'Golf Course Clubhouse',
  'Sunset Marina Venue',
  'Cedar Point Event Barn',
  'Grandview Hotel Ballroom',
];

const NOTES = [
  'Client requested mixed protein options.',
  'Nut-free menu requested for all guests.',
  'Birthday setup at patio section.',
  'Corporate invoice required after service.',
  'Vegetarian and kids table included.',
  'Late setup access starts 90 minutes before service.',
  'Anniversary event with premium add-ons.',
  '',
  '',
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function randInt(min: number, max: number, seed: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function pickEventType(label: SampleSlot['label'], seed: number): EventType {
  if (label === 'weekend-lunch') {
    return seededRandom(seed + 11) > 0.45 ? 'buffet' : 'private-dinner';
  }
  if (label === 'weekend-dinner') {
    return seededRandom(seed + 17) > 0.6 ? 'buffet' : 'private-dinner';
  }
  return seededRandom(seed + 23) > 0.82 ? 'buffet' : 'private-dinner';
}

function getGuestCounts(label: SampleSlot['label'], eventType: EventType, seed: number) {
  if (eventType === 'buffet') {
    const adults = label === 'weekend-lunch' ? randInt(30, 70, seed + 31) : randInt(35, 90, seed + 37);
    const children = randInt(0, 15, seed + 41);
    return { adults, children };
  }

  if (label === 'weekend-lunch') {
    return {
      adults: randInt(16, 28, seed + 43),
      children: randInt(2, 10, seed + 47),
    };
  }
  if (label === 'weekend-dinner') {
    return {
      adults: randInt(18, 34, seed + 53),
      children: randInt(0, 8, seed + 59),
    };
  }

  return {
    adults: randInt(12, 26, seed + 61),
    children: randInt(0, 6, seed + 67),
  };
}

function getStatus(eventDate: Date): Booking['status'] {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const inTwoWeeks = addDays(todayStart, 14);

  if (eventDate < todayStart) return 'completed';
  if (eventDate <= inTwoWeeks) return 'confirmed';
  return 'pending';
}

function buildSampleBooking(options: BuildSampleBookingOptions): Booking {
  const { weekIndex, slotIndex, eventDate, time, label, rules } = options;
  const seed = (weekIndex + 1) * 101 + slotIndex * 37;
  const eventType = pickEventType(label, seed);
  const { adults, children } = getGuestCounts(label, eventType, seed);
  const distanceMiles = randInt(8, 45, seed + 71);
  const premiumAddOn = seededRandom(seed + 73) > 0.7 ? randInt(5, 18, seed + 79) : 0;

  const financials = calculateEventFinancials(
    {
      adults,
      children,
      eventType,
      eventDate,
      distanceMiles,
      premiumAddOn,
    },
    rules
  );

  const customerIdx = (weekIndex * SAMPLE_SLOTS.length + slotIndex) % CUSTOMER_NAMES.length;
  const locationIdx = (weekIndex * 7 + slotIndex * 3) % LOCATIONS.length;
  const customerName = CUSTOMER_NAMES[customerIdx];
  const emailSafeName = customerName.toLowerCase().replace(/\s+/g, '.');
  const createdAt = addDays(eventDate, -21).toISOString();
  const status = getStatus(eventDate);
  const depositAmount = Math.round((financials.totalCharged * (DEFAULT_DEPOSIT_PERCENT / 100)) * 100) / 100;
  const amountPaid =
    status === 'completed'
      ? financials.totalCharged
      : status === 'confirmed' && seededRandom(seed + 131) > 0.3
        ? depositAmount
        : 0;

  return normalizeBookingWorkflowFields({
    id: `sample-booking-${format(eventDate, 'yyyyMMdd')}-${slotIndex}`,
    eventType,
    eventDate: format(eventDate, 'yyyy-MM-dd'),
    eventTime: time,
    customerName,
    customerEmail: `${emailSafeName}@example.com`,
    customerPhone: `(${randInt(200, 899, seed + 83)}) ${randInt(200, 899, seed + 89)}-${randInt(1000, 9999, seed + 97)}`,
    adults,
    children,
    location: LOCATIONS[locationIdx],
    distanceMiles,
    premiumAddOn,
    subtotal: financials.subtotal,
    gratuity: financials.gratuity,
    distanceFee: financials.distanceFee,
    total: financials.totalCharged,
    status,
    serviceStatus: status,
    depositPercent: DEFAULT_DEPOSIT_PERCENT,
    depositAmount,
    amountPaid,
    confirmedAt:
      status === 'confirmed' || status === 'completed'
        ? addDays(eventDate, -21).toISOString()
        : undefined,
    prepPurchaseByDate: calculatePrepPurchaseByDate(format(eventDate, 'yyyy-MM-dd')),
    notes: NOTES[(weekIndex + slotIndex) % NOTES.length],
    createdAt,
    updatedAt: new Date().toISOString(),
  });
}

export function generateSampleBookings(
  rules: MoneyRules,
  options: { weeks?: number; weeksBack?: number } = {}
): Booking[] {
  const weeks = options.weeks ?? 12;
  const weeksBack = options.weeksBack ?? 8;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const firstWeek = addWeeks(weekStart, -weeksBack);
  const sampleBookings: Booking[] = [];

  for (let week = 0; week < weeks; week++) {
    const currentWeekStart = addWeeks(firstWeek, week);
    SAMPLE_SLOTS.forEach((slot, slotIndex) => {
      const eventDate = addDays(currentWeekStart, slot.dayOffset);
      sampleBookings.push(
        buildSampleBooking({
          weekIndex: week,
          slotIndex,
          eventDate,
          time: slot.time,
          label: slot.label,
          rules,
        })
      );
    });
  }

  return sampleBookings.sort((a, b) => {
    const aKey = `${a.eventDate}T${a.eventTime}`;
    const bKey = `${b.eventDate}T${b.eventTime}`;
    return aKey.localeCompare(bKey);
  });
}

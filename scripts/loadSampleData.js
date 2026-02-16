// Sample Booking Loader for Catering App
// Run this entire script in the browser console.
// It creates a structured sample schedule:
// - 5 bookings/week
// - 1 weekend lunch
// - 1 weekend dinner
// - 3 weekday dinners

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function seededRandom(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function randInt(min, max, seed) {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

const customerNames = [
  'Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Kim',
  'Jessica Martinez', 'Christopher Lee', 'Amanda Wilson', 'James Taylor',
  'Jennifer Brown', 'Robert Garcia', 'Lisa Anderson', 'William Thomas',
  'Mary Jackson', 'Daniel White', 'Patricia Harris', 'Matthew Martin',
  'Linda Thompson', 'Joseph Moore', 'Barbara Clark', 'Richard Lewis',
  'Olivia Walker', 'Ethan Hall', 'Chloe Adams', 'Noah Scott'
];

const locations = [
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
];

const slots = [
  { dayOffset: 1, time: '18:00', label: 'weekday-dinner' }, // Tue dinner
  { dayOffset: 2, time: '18:30', label: 'weekday-dinner' }, // Wed dinner
  { dayOffset: 3, time: '19:00', label: 'weekday-dinner' }, // Thu dinner
  { dayOffset: 5, time: '12:30', label: 'weekend-lunch' },  // Sat lunch
  { dayOffset: 6, time: '18:30', label: 'weekend-dinner' }, // Sun dinner
];

function pickEventType(label, seed) {
  if (label === 'weekend-lunch') return seededRandom(seed + 11) > 0.45 ? 'buffet' : 'private-dinner';
  if (label === 'weekend-dinner') return seededRandom(seed + 17) > 0.6 ? 'buffet' : 'private-dinner';
  return seededRandom(seed + 23) > 0.82 ? 'buffet' : 'private-dinner';
}

function getGuestCounts(label, eventType, seed) {
  if (eventType === 'buffet') {
    const adults = label === 'weekend-lunch' ? randInt(30, 70, seed + 31) : randInt(35, 90, seed + 37);
    const children = randInt(0, 15, seed + 41);
    return { adults, children };
  }

  if (label === 'weekend-lunch') {
    return { adults: randInt(16, 28, seed + 43), children: randInt(2, 10, seed + 47) };
  }
  if (label === 'weekend-dinner') {
    return { adults: randInt(18, 34, seed + 53), children: randInt(0, 8, seed + 59) };
  }
  return { adults: randInt(12, 26, seed + 61), children: randInt(0, 6, seed + 67) };
}

function getStatus(eventDate) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const inTwoWeeks = addDays(todayStart, 14);
  if (eventDate < todayStart) return 'completed';
  if (eventDate <= inTwoWeeks) return 'confirmed';
  return 'pending';
}

function estimateTotals(eventType, adults, children, premiumAddOn, distanceMiles) {
  const basePrice = eventType === 'private-dinner' ? 95 : 75;
  const childPrice = basePrice * 0.5;
  const guestCount = adults + children;
  const subtotal = adults * basePrice + children * childPrice + premiumAddOn * guestCount;
  const gratuity = subtotal * 0.2;
  let distanceFee = 0;
  if (distanceMiles > 25) {
    distanceFee = 50 + Math.ceil((distanceMiles - 25) / 25) * 25;
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gratuity: Math.round(gratuity * 100) / 100,
    distanceFee,
    total: Math.round((subtotal + gratuity + distanceFee) * 100) / 100,
  };
}

function generateSampleBookings(options = {}) {
  const weeks = options.weeks || 12;
  const weeksBack = options.weeksBack || 8;
  const weekStart = startOfWeekMonday(new Date());
  const firstWeek = addWeeks(weekStart, -weeksBack);
  const bookings = [];

  for (let week = 0; week < weeks; week++) {
    const currentWeekStart = addWeeks(firstWeek, week);

    slots.forEach((slot, slotIndex) => {
      const seed = (week + 1) * 101 + slotIndex * 37;
      const eventDate = addDays(currentWeekStart, slot.dayOffset);
      const eventType = pickEventType(slot.label, seed);
      const { adults, children } = getGuestCounts(slot.label, eventType, seed);
      const distanceMiles = randInt(8, 45, seed + 71);
      const premiumAddOn = seededRandom(seed + 73) > 0.7 ? randInt(5, 18, seed + 79) : 0;
      const totals = estimateTotals(eventType, adults, children, premiumAddOn, distanceMiles);

      const customerIndex = (week * slots.length + slotIndex) % customerNames.length;
      const locationIndex = (week * 7 + slotIndex * 3) % locations.length;
      const customerName = customerNames[customerIndex];
      const safeName = customerName.toLowerCase().replace(/\s+/g, '.');

      bookings.push({
        id: `sample-booking-${toIsoDate(eventDate)}-${slotIndex}`,
        eventType,
        eventDate: toIsoDate(eventDate),
        eventTime: slot.time,
        customerName,
        customerEmail: `${safeName}@example.com`,
        customerPhone: `(${randInt(200, 899, seed + 83)}) ${randInt(200, 899, seed + 89)}-${randInt(1000, 9999, seed + 97)}`,
        adults,
        children,
        location: locations[locationIndex],
        distanceMiles,
        premiumAddOn,
        subtotal: totals.subtotal,
        gratuity: totals.gratuity,
        distanceFee: totals.distanceFee,
        total: totals.total,
        status: getStatus(eventDate),
        notes: '',
        createdAt: addDays(eventDate, -21).toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  }

  return bookings.sort((a, b) => `${a.eventDate}T${a.eventTime}`.localeCompare(`${b.eventDate}T${b.eventTime}`));
}

const sampleBookings = generateSampleBookings({ weeks: 12, weeksBack: 8 });
localStorage.setItem('bookings', JSON.stringify(sampleBookings));
window.dispatchEvent(new Event('bookingsUpdated'));

console.log('✅ Loaded sample bookings for testing.');
console.log(`📅 Total bookings: ${sampleBookings.length}`);
console.log(`🍱 Private dinners: ${sampleBookings.filter((b) => b.eventType === 'private-dinner').length}`);
console.log(`🥢 Buffets: ${sampleBookings.filter((b) => b.eventType === 'buffet').length}`);
console.log(`✅ Completed: ${sampleBookings.filter((b) => b.status === 'completed').length}`);
console.log(`🟦 Confirmed: ${sampleBookings.filter((b) => b.status === 'confirmed').length}`);
console.log(`🟨 Pending: ${sampleBookings.filter((b) => b.status === 'pending').length}`);

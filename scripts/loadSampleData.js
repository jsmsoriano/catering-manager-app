// Sample Data Generator for Catering App
// Run this in the browser console to load 20 sample bookings

function generateSampleBookings() {
  const customerNames = [
    'Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Kim',
    'Jessica Martinez', 'Christopher Lee', 'Amanda Wilson', 'James Taylor',
    'Jennifer Brown', 'Robert Garcia', 'Lisa Anderson', 'William Thomas',
    'Mary Jackson', 'Daniel White', 'Patricia Harris', 'Matthew Martin',
    'Linda Thompson', 'Joseph Moore', 'Barbara Clark', 'Richard Lewis'
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
    'Golf Course Clubhouse'
  ];

  const eventTypes = ['private-dinner', 'buffet-catering'];
  const statuses = ['pending', 'confirmed', 'completed', 'completed'];

  const bookings = [];
  const today = new Date();

  for (let i = 0; i < 20; i++) {
    // Generate dates spread across last 3 months and next 2 months
    const daysOffset = Math.floor(Math.random() * 150) - 90; // -90 to +60 days
    const eventDate = new Date(today);
    eventDate.setDate(today.getDate() + daysOffset);

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    // Generate realistic guest counts
    let adults, children;
    if (eventType === 'private-dinner') {
      adults = Math.floor(Math.random() * 35) + 10; // 10-45 adults
      children = Math.random() > 0.6 ? Math.floor(Math.random() * 8) : 0; // 0-8 children
    } else {
      adults = Math.floor(Math.random() * 80) + 30; // 30-110 adults
      children = Math.random() > 0.5 ? Math.floor(Math.random() * 15) : 0; // 0-15 children
    }

    const distanceMiles = Math.floor(Math.random() * 40) + 5; // 5-45 miles
    const premiumAddOn = Math.random() > 0.7 ? Math.floor(Math.random() * 15) + 5 : 0; // 0 or 5-20

    // Determine status based on date
    let status;
    if (daysOffset < -30) {
      status = 'completed';
    } else if (daysOffset < 0) {
      status = Math.random() > 0.3 ? 'completed' : 'confirmed';
    } else if (daysOffset < 7) {
      status = 'confirmed';
    } else {
      status = Math.random() > 0.5 ? 'confirmed' : 'pending';
    }

    // Calculate pricing (using default rules - 85 for private, 65 for buffet)
    const basePrice = eventType === 'private-dinner' ? 85 : 65;
    const childPrice = basePrice * 0.5;
    const subtotal = (adults * basePrice) + (children * childPrice) + (premiumAddOn * (adults + children));
    const gratuity = subtotal * 0.20;

    // Distance fee calculation
    let distanceFee = 0;
    if (distanceMiles > 20) {
      distanceFee = 50;
      const extraMiles = distanceMiles - 20;
      const increments = Math.ceil(extraMiles / 5);
      distanceFee += increments * 25;
    }

    const total = subtotal + gratuity + distanceFee;

    const customerIndex = i % customerNames.length;
    const locationIndex = Math.floor(Math.random() * locations.length);

    const notes = [
      'Client prefers gluten-free options',
      'Vegetarian menu requested',
      'Corporate event - invoice required',
      'Birthday celebration',
      'Anniversary dinner',
      'Wedding rehearsal dinner',
      'Holiday party',
      'Client has dietary restrictions',
      'Outdoor setup preferred',
      'Indoor backup required',
      '',
      '',
      ''
    ];

    const booking = {
      id: `booking-${Date.now()}-${i}`,
      eventType,
      eventDate: eventDate.toISOString().split('T')[0],
      eventTime: ['17:00', '18:00', '18:30', '19:00'][Math.floor(Math.random() * 4)],
      customerName: customerNames[customerIndex],
      customerEmail: `${customerNames[customerIndex].toLowerCase().replace(' ', '.')}@email.com`,
      customerPhone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      adults,
      children,
      location: locations[locationIndex],
      distanceMiles,
      premiumAddOn,
      subtotal: Math.round(subtotal * 100) / 100,
      gratuity: Math.round(gratuity * 100) / 100,
      distanceFee,
      total: Math.round(total * 100) / 100,
      status,
      notes: notes[Math.floor(Math.random() * notes.length)],
      createdAt: new Date(eventDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    bookings.push(booking);
  }

  // Sort by date
  bookings.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

  return bookings;
}

// Generate and save bookings
const sampleBookings = generateSampleBookings();
localStorage.setItem('bookings', JSON.stringify(sampleBookings));
window.dispatchEvent(new Event('bookingsUpdated'));

console.log('✅ Successfully loaded 20 sample bookings!');
console.log('📊 Summary:');
console.log(`   - Private Dinners: ${sampleBookings.filter(b => b.eventType === 'private-dinner').length}`);
console.log(`   - Buffet Events: ${sampleBookings.filter(b => b.eventType === 'buffet-catering').length}`);
console.log(`   - Pending: ${sampleBookings.filter(b => b.status === 'pending').length}`);
console.log(`   - Confirmed: ${sampleBookings.filter(b => b.status === 'confirmed').length}`);
console.log(`   - Completed: ${sampleBookings.filter(b => b.status === 'completed').length}`);
console.log(`   - Total Revenue: $${sampleBookings.reduce((sum, b) => sum + b.total, 0).toLocaleString()}`);
console.log('\n🔄 Navigate to /bookings or /reports to see your data!');

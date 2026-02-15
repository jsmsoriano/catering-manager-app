'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Booking } from '@/lib/bookingTypes';
import type { EventMenu, GuestMenuSelection, ProteinType } from '@/lib/menuTypes';

const proteinOptions: { value: ProteinType; label: string }[] = [
  { value: 'chicken', label: 'Chicken' },
  { value: 'steak', label: 'Steak' },
  { value: 'shrimp', label: 'Shrimp' },
  { value: 'scallops', label: 'Scallops' },
];

export default function BookingMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading menu...</div>
        </div>
      }
    >
      <BookingMenuContent />
    </Suspense>
  );
}

function BookingMenuContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get('bookingId');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [existingMenu, setExistingMenu] = useState<EventMenu | null>(null);
  const [guestSelections, setGuestSelections] = useState<GuestMenuSelection[]>([]);
  const [menuStep, setMenuStep] = useState(1);

  // Load booking and existing menu
  useEffect(() => {
    if (!bookingId) {
      alert('No booking ID provided');
      router.push('/bookings');
      return;
    }

    // Load booking
    const bookingsData = localStorage.getItem('bookings');
    if (bookingsData) {
      const bookings: Booking[] = JSON.parse(bookingsData);
      const foundBooking = bookings.find((b) => b.id === bookingId);

      if (!foundBooking) {
        alert('Booking not found');
        router.push('/bookings');
        return;
      }

      setBooking(foundBooking);

      // Load existing menu if it exists
      if (foundBooking.menuId) {
        const menusData = localStorage.getItem('eventMenus');
        if (menusData) {
          const menus: EventMenu[] = JSON.parse(menusData);
          const foundMenu = menus.find((m) => m.id === foundBooking.menuId);
          if (foundMenu) {
            setExistingMenu(foundMenu);
            setGuestSelections(foundMenu.guestSelections);
            return;
          }
        }
      }

      // Initialize empty guest selections based on guest count
      const totalGuests = foundBooking.adults + foundBooking.children;
      const initialSelections: GuestMenuSelection[] = [];

      for (let i = 0; i < totalGuests; i++) {
        initialSelections.push({
          id: `guest-${i + 1}`,
          guestName: '',
          isAdult: i < foundBooking.adults, // First N guests are adults
          protein1: 'chicken',
          protein2: 'steak',
          wantsFriedRice: true,
          wantsNoodles: true,
          wantsSalad: true,
          wantsVeggies: true,
          specialRequests: '',
          allergies: '',
        });
      }

      setGuestSelections(initialSelections);
    }
  }, [bookingId, router]);

  const updateGuestSelection = (
    index: number,
    field: keyof GuestMenuSelection,
    value: any
  ) => {
    const updated = [...guestSelections];
    updated[index] = { ...updated[index], [field]: value };
    setGuestSelections(updated);
  };

  const menuStepLabels = ['Guest Details', 'Meal Preferences', 'Review'];

  const goToNextStep = () => {
    if (menuStep === 1) {
      const missingNames = guestSelections.filter((g) => !g.guestName.trim());
      if (missingNames.length > 0) {
        alert(`Please enter names for all ${missingNames.length} guest(s)`);
        return;
      }
    }
    setMenuStep((prev) => Math.min(prev + 1, menuStepLabels.length));
  };

  const goToPreviousStep = () => {
    setMenuStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSave = () => {
    if (!booking || !bookingId) return;

    // Validate that all guests have names
    const missingNames = guestSelections.filter((g) => !g.guestName.trim());
    if (missingNames.length > 0) {
      alert(`Please enter names for all ${missingNames.length} guest(s)`);
      return;
    }

    // Create or update menu
    const menuId = existingMenu?.id || `menu-${Date.now()}`;
    const menu: EventMenu = {
      id: menuId,
      bookingId: bookingId,
      guestSelections: guestSelections,
      createdAt: existingMenu?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save menu
    const menusData = localStorage.getItem('eventMenus');
    let menus: EventMenu[] = menusData ? JSON.parse(menusData) : [];

    if (existingMenu) {
      menus = menus.map((m) => (m.id === menuId ? menu : m));
    } else {
      menus.push(menu);
    }

    localStorage.setItem('eventMenus', JSON.stringify(menus));

    // Update booking with menuId
    const bookingsData = localStorage.getItem('bookings');
    if (bookingsData) {
      const bookings: Booking[] = JSON.parse(bookingsData);
      const updatedBookings = bookings.map((b) =>
        b.id === bookingId ? { ...b, menuId: menuId } : b
      );
      localStorage.setItem('bookings', JSON.stringify(updatedBookings));
      window.dispatchEvent(new Event('bookingsUpdated'));
    }

    alert('Menu saved successfully!');
    router.push('/bookings');
  };

  const summary = useMemo(() => {
    const proteinCounts: Record<ProteinType, number> = {
      chicken: 0,
      steak: 0,
      shrimp: 0,
      scallops: 0,
    };

    guestSelections.forEach((guest) => {
      proteinCounts[guest.protein1]++;
      proteinCounts[guest.protein2]++;
    });

    return {
      totalGuests: guestSelections.length,
      adults: guestSelections.filter((g) => g.isAdult).length,
      children: guestSelections.filter((g) => !g.isAdult).length,
      proteinCounts,
      friedRice: guestSelections.filter((g) => g.wantsFriedRice).length,
      noodles: guestSelections.filter((g) => g.wantsNoodles).length,
      salad: guestSelections.filter((g) => g.wantsSalad).length,
      veggies: guestSelections.filter((g) => g.wantsVeggies).length,
    };
  }, [guestSelections]);

  if (!booking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg text-zinc-600 dark:text-zinc-400">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Guest Menu Selection
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {booking.customerName} - {booking.eventDate} at {booking.eventTime}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              {booking.adults} Adults, {booking.children} Children
            </p>
          </div>
          <button
            onClick={() => router.push('/bookings')}
            className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
            <h3 className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
              Total Protein Selections
            </h3>
            <p className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {summary.totalGuests * 2}
            </p>
            <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
              {summary.totalGuests} guests × 2 proteins
            </p>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
            <h3 className="text-sm font-medium text-red-900 dark:text-red-200">
              Chicken & Steak
            </h3>
            <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
              {summary.proteinCounts.chicken + summary.proteinCounts.steak}
            </p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              {summary.proteinCounts.chicken} chicken, {summary.proteinCounts.steak} steak
            </p>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
            <h3 className="text-sm font-medium text-orange-900 dark:text-orange-200">
              Shrimp & Scallops
            </h3>
            <p className="mt-2 text-2xl font-bold text-orange-600 dark:text-orange-400">
              {summary.proteinCounts.shrimp + summary.proteinCounts.scallops}
            </p>
            <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
              {summary.proteinCounts.shrimp} shrimp, {summary.proteinCounts.scallops} scallops
            </p>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/20">
            <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
              Sides Needed
            </h3>
            <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
              Rice: {summary.friedRice} | Noodles: {summary.noodles}
            </p>
            <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
              Salad: {summary.salad} | Veggies: {summary.veggies}
            </p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-2">
          {menuStepLabels.map((label, idx) => {
            const stepNumber = idx + 1;
            const isCurrent = menuStep === stepNumber;
            const isComplete = menuStep > stepNumber;
            return (
              <div
                key={label}
                className={`rounded-md px-2 py-2 text-center text-xs font-semibold ${
                  isCurrent
                    ? 'bg-indigo-600 text-white'
                    : isComplete
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {stepNumber}. {label}
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          {menuStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Step 1: Guest Details
              </h2>
              {guestSelections.map((guest, index) => (
                <div
                  key={guest.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
                >
                  <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Guest #{index + 1}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Guest Name *
                      </label>
                      <input
                        type="text"
                        value={guest.guestName}
                        onChange={(e) =>
                          updateGuestSelection(index, 'guestName', e.target.value)
                        }
                        placeholder="Enter name"
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Type
                      </label>
                      <select
                        value={guest.isAdult ? 'adult' : 'child'}
                        onChange={(e) =>
                          updateGuestSelection(index, 'isAdult', e.target.value === 'adult')
                        }
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        <option value="adult">Adult</option>
                        <option value="child">Child</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Protein 1
                      </label>
                      <select
                        value={guest.protein1}
                        onChange={(e) =>
                          updateGuestSelection(index, 'protein1', e.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        {proteinOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Protein 2
                      </label>
                      <select
                        value={guest.protein2}
                        onChange={(e) =>
                          updateGuestSelection(index, 'protein2', e.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        {proteinOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {menuStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Step 2: Meal Preferences
              </h2>
              {guestSelections.map((guest, index) => (
                <div
                  key={guest.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
                >
                  <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {guest.guestName || `Guest #${index + 1}`}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={guest.wantsFriedRice}
                          onChange={(e) =>
                            updateGuestSelection(index, 'wantsFriedRice', e.target.checked)
                          }
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
                        />
                        Fried Rice
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={guest.wantsNoodles}
                          onChange={(e) =>
                            updateGuestSelection(index, 'wantsNoodles', e.target.checked)
                          }
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
                        />
                        Noodles
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={guest.wantsSalad}
                          onChange={(e) =>
                            updateGuestSelection(index, 'wantsSalad', e.target.checked)
                          }
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
                        />
                        Salad
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={guest.wantsVeggies}
                          onChange={(e) =>
                            updateGuestSelection(index, 'wantsVeggies', e.target.checked)
                          }
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
                        />
                        Veggies
                      </label>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Special Requests
                        </label>
                        <textarea
                          value={guest.specialRequests}
                          onChange={(e) =>
                            updateGuestSelection(index, 'specialRequests', e.target.value)
                          }
                          placeholder="Special requests..."
                          rows={2}
                          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Allergies
                        </label>
                        <textarea
                          value={guest.allergies}
                          onChange={(e) =>
                            updateGuestSelection(index, 'allergies', e.target.value)
                          }
                          placeholder="Allergies..."
                          rows={2}
                          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {menuStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Step 3: Review & Save
              </h2>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {summary.totalGuests} guests ({summary.adults} adults / {summary.children} children)
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Rice: {summary.friedRice}, Noodles: {summary.noodles}, Salad: {summary.salad}, Veggies: {summary.veggies}
                </p>
              </div>
              <div className="space-y-2">
                {guestSelections.map((guest, index) => (
                  <div
                    key={guest.id}
                    className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700"
                  >
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {guest.guestName || `Guest #${index + 1}`} ({guest.isAdult ? 'Adult' : 'Child'})
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Proteins: {guest.protein1}, {guest.protein2}
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                      Sides: {guest.wantsFriedRice ? 'Rice ' : ''}{guest.wantsNoodles ? 'Noodles ' : ''}{guest.wantsSalad ? 'Salad ' : ''}{guest.wantsVeggies ? 'Veggies' : ''}
                    </p>
                    {(guest.specialRequests || guest.allergies) && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {guest.specialRequests && `Notes: ${guest.specialRequests}. `}
                        {guest.allergies && `Allergies: ${guest.allergies}.`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => router.push('/bookings')}
            className="rounded-md border border-zinc-300 px-6 py-3 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          {menuStep > 1 && (
            <button
              onClick={goToPreviousStep}
              className="rounded-md border border-zinc-300 px-6 py-3 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Back
            </button>
          )}
          {menuStep < menuStepLabels.length ? (
            <button
              onClick={goToNextStep}
              className="rounded-md bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="rounded-md bg-emerald-600 px-6 py-3 text-white hover:bg-emerald-700"
            >
              Save Menu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

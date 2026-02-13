'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking, BookingStatus, BookingFormData} from '@/lib/bookingTypes';

export default function BookingsPage() {
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | BookingStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [formData, setFormData] = useState<BookingFormData>({
    eventType: 'private-dinner',
    eventDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    eventTime: '18:00',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    adults: 15,
    children: 0,
    location: '',
    distanceMiles: 10,
    premiumAddOn: 0,
    notes: '',
  });

  // Load bookings
  useEffect(() => {
    const loadBookings = () => {
      const saved = localStorage.getItem('bookings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          console.log('📅 Bookings: Loaded', parsed.length, 'bookings from localStorage');
          setBookings(parsed);
        } catch (e) {
          console.error('Failed to load bookings:', e);
        }
      }
    };

    loadBookings();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bookings') {
        console.log('📅 Bookings: Detected storage change (cross-tab)');
        loadBookings();
      }
    };

    const handleCustomStorageChange = () => {
      console.log('📅 Bookings: Detected bookingsUpdated event (same-tab)');
      loadBookings();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bookingsUpdated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingsUpdated', handleCustomStorageChange);
    };
  }, []);

  const saveBookings = (newBookings: Booking[]) => {
    console.log('📅 Bookings: Saving', newBookings.length, 'bookings to localStorage');
    setBookings(newBookings);
    localStorage.setItem('bookings', JSON.stringify(newBookings));
    console.log('📅 Bookings: Dispatching bookingsUpdated event');
    window.dispatchEvent(new Event('bookingsUpdated'));
  };

  const filteredBookings = useMemo(() => {
    let result = bookings;

    if (filterStatus !== 'all') {
      result = result.filter((b) => b.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.customerName.toLowerCase().includes(query) ||
          b.customerEmail.toLowerCase().includes(query) ||
          b.location.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
  }, [bookings, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const totalRevenue = bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.total, 0);

    return { pending, confirmed, completed, totalRevenue };
  }, [bookings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const financials = calculateEventFinancials(
      {
        adults: formData.adults,
        children: formData.children,
        eventType: formData.eventType,
        eventDate: new Date(formData.eventDate),
        distanceMiles: formData.distanceMiles,
        premiumAddOn: formData.premiumAddOn,
      },
      rules
    );

    const booking: Booking = {
      id: selectedBooking?.id || `booking-${Date.now()}`,
      eventType: formData.eventType,
      eventDate: formData.eventDate,
      eventTime: formData.eventTime,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      adults: formData.adults,
      children: formData.children,
      location: formData.location,
      distanceMiles: formData.distanceMiles,
      premiumAddOn: formData.premiumAddOn,
      subtotal: financials.subtotal,
      gratuity: financials.gratuity,
      distanceFee: financials.distanceFee,
      total: financials.totalCharged,
      status: selectedBooking?.status || 'pending',
      notes: formData.notes,
      createdAt: selectedBooking?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isEditing && selectedBooking) {
      saveBookings(bookings.map((b) => (b.id === selectedBooking.id ? booking : b)));
    } else {
      saveBookings([...bookings, booking]);
    }

    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedBooking(null);
    setIsEditing(false);
    setFormData({
      eventType: 'private-dinner',
      eventDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      eventTime: '18:00',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      adults: 15,
      children: 0,
      location: '',
      distanceMiles: 10,
      premiumAddOn: 0,
      notes: '',
    });
  };

  const handleDelete = () => {
    if (selectedBooking && confirm(`Delete booking for ${selectedBooking.customerName}?`)) {
      saveBookings(bookings.filter((b) => b.id !== selectedBooking.id));
      setShowModal(false);
      resetForm();
    }
  };

  const updateBookingStatus = (booking: Booking, newStatus: BookingStatus) => {
    saveBookings(
      bookings.map((b) =>
        b.id === booking.id
          ? { ...b, status: newStatus, updatedAt: new Date().toISOString() }
          : b
      )
    );
  };

  const statusColors: Record<BookingStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400',
  };

  return (
    <div className="h-full p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Bookings Management
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Manage event bookings and customer information
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          + New Booking
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900 dark:bg-yellow-950/20">
          <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
            Pending
          </h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {stats.pending}
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
            Confirmed
          </h3>
          <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
            {stats.confirmed}
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
          <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Completed
          </h3>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </p>
        </div>

        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/20">
          <h3 className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            Total Revenue
          </h3>
          <p className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              viewMode === 'table'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            📋 Table
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              viewMode === 'calendar'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            📅 Calendar
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'pending'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'confirmed'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            Confirmed
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'completed'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            Completed
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by customer or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {/* Calendar Header */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
              className="rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Previous
            </button>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {format(calendarMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              className="rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Next →
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {(() => {
              const monthStart = startOfMonth(calendarMonth);
              const monthEnd = endOfMonth(calendarMonth);
              const calendarStart = startOfWeek(monthStart);
              const calendarEnd = endOfWeek(monthEnd);
              const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

              return calendarDays.map((day) => {
                const isCurrentMonth = day >= monthStart && day <= monthEnd;
                const dayBookings = filteredBookings.filter((booking) =>
                  isSameDay(new Date(booking.eventDate), day)
                );

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[100px] rounded-lg border p-2 ${
                      isCurrentMonth
                        ? 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800'
                        : 'border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50'
                    }`}
                  >
                    <div
                      className={`mb-1 text-sm ${
                        isCurrentMonth
                          ? 'font-medium text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-400 dark:text-zinc-600'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayBookings.map((booking) => (
                        <button
                          key={booking.id}
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsEditing(true);
                            setFormData({
                              eventType: booking.eventType,
                              eventDate: booking.eventDate,
                              eventTime: booking.eventTime,
                              customerName: booking.customerName,
                              customerEmail: booking.customerEmail,
                              customerPhone: booking.customerPhone,
                              adults: booking.adults,
                              children: booking.children,
                              location: booking.location,
                              distanceMiles: booking.distanceMiles,
                              premiumAddOn: booking.premiumAddOn,
                              notes: booking.notes,
                            });
                            setShowModal(true);
                          }}
                          className={`w-full rounded px-1 py-0.5 text-left text-xs ${
                            statusColors[booking.status]
                          } truncate hover:opacity-80`}
                          title={`${booking.customerName} - ${booking.eventTime}`}
                        >
                          {booking.eventTime} {booking.customerName.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Calendar Legend */}
          <div className="mt-6 flex flex-wrap gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-yellow-100 dark:bg-yellow-900/30"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-blue-100 dark:bg-blue-900/30"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-emerald-100 dark:bg-emerald-900/30"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-zinc-100 dark:bg-zinc-800"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Cancelled</span>
            </div>
          </div>
        </div>
      ) : (
        /* Bookings Table */
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Event Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Guests
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    {searchQuery || filterStatus !== 'all'
                      ? 'No bookings match your filters'
                      : 'No bookings yet. Click "+ New Booking" to get started!'}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-4 text-sm text-zinc-900 dark:text-zinc-100">
                      {format(new Date(booking.eventDate), 'MMM dd, yyyy')}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {booking.eventTime}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {booking.customerName}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {booking.customerEmail}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                      {booking.eventType === 'private-dinner' ? 'Private' : 'Buffet'}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                      {booking.adults + booking.children}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        ({booking.adults}A + {booking.children}C)
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(booking.total)}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <select
                        value={booking.status}
                        onChange={(e) =>
                          updateBookingStatus(booking, e.target.value as BookingStatus)
                        }
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          statusColors[booking.status]
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-right text-sm">
                      <div className="flex justify-end gap-3">
                        {booking.eventType === 'private-dinner' && (
                          <Link
                            href={`/bookings/menu?bookingId=${booking.id}`}
                            className={`${
                              booking.menuId
                                ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'
                                : 'text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300'
                            }`}
                            title={booking.menuId ? 'Edit menu' : 'Create menu'}
                          >
                            {booking.menuId ? '📋 Menu' : '➕ Menu'}
                          </Link>
                        )}
                        <button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsEditing(true);
                            setFormData({
                              eventType: booking.eventType,
                              eventDate: booking.eventDate,
                              eventTime: booking.eventTime,
                              customerName: booking.customerName,
                              customerEmail: booking.customerEmail,
                              customerPhone: booking.customerPhone,
                              adults: booking.adults,
                              children: booking.children,
                              location: booking.location,
                              distanceMiles: booking.distanceMiles,
                              premiumAddOn: booking.premiumAddOn,
                              notes: booking.notes,
                            });
                            setShowModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {isEditing ? 'Edit Booking' : 'New Booking'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-zinc-500 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                  Customer Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) =>
                        setFormData({ ...formData, customerName: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, customerEmail: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.customerPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, customerPhone: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Event Details */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                  Event Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Event Type *
                    </label>
                    <select
                      value={formData.eventType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eventType: e.target.value as 'private-dinner' | 'buffet',
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      <option value="private-dinner">Private Dinner</option>
                      <option value="buffet">Buffet</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Event Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.eventDate}
                      onChange={(e) =>
                        setFormData({ ...formData, eventDate: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Event Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.eventTime}
                      onChange={(e) =>
                        setFormData({ ...formData, eventTime: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Adults *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.adults}
                      onChange={(e) =>
                        setFormData({ ...formData, adults: parseInt(e.target.value) || 1 })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Children
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.children}
                      onChange={(e) =>
                        setFormData({ ...formData, children: parseInt(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Distance (miles)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.distanceMiles}
                      onChange={(e) =>
                        setFormData({ ...formData, distanceMiles: parseInt(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Premium Add-on ($/guest)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.premiumAddOn}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          premiumAddOn: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Special requests, dietary restrictions, etc."
                />
              </div>

              {/* Menu Link */}
              {isEditing && selectedBooking && formData.eventType === 'private-dinner' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                        Guest Menu
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        {selectedBooking.menuId
                          ? 'Menu selections have been configured for this event.'
                          : 'No menu configured yet. Set up guest-by-guest protein and side selections.'}
                      </p>
                    </div>
                    <Link
                      href={`/bookings/menu?bookingId=${selectedBooking.id}`}
                      className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                        selectedBooking.menuId
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {selectedBooking.menuId ? 'Edit Menu' : 'Create Menu'}
                    </Link>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between">
                <div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                      Delete Booking
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                  >
                    {isEditing ? 'Update Booking' : 'Create Booking'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

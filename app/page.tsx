'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, isWithinInterval, isToday, isTomorrow } from 'date-fns';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking } from '@/lib/bookingTypes';
import {
  CalendarDaysIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CalculatorIcon,
  DocumentChartBarIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function DashboardPage() {
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Load bookings and listen for updates
  useEffect(() => {
    const loadBookings = () => {
      const saved = localStorage.getItem('bookings');
      if (saved) {
        try {
          setBookings(JSON.parse(saved));
        } catch {
          // ignore parse errors
        }
      }
    };

    loadBookings();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bookings') loadBookings();
    };
    const handleCustomEvent = () => loadBookings();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bookingsUpdated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingsUpdated', handleCustomEvent);
    };
  }, []);

  // Dashboard computed data
  const dashboard = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Current month bookings (non-cancelled)
    const monthBookings = bookings.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return isWithinInterval(d, { start: monthStart, end: monthEnd }) && b.status !== 'cancelled';
    });

    // Financials for month
    let totalRevenue = 0;
    let totalCosts = 0;
    let totalGrossProfit = 0;
    let ownerADist = 0;
    let ownerBDist = 0;
    let privateCount = 0;
    let buffetCount = 0;
    const statusCounts = { pending: 0, confirmed: 0, completed: 0 };

    monthBookings.forEach((booking) => {
      const fin = calculateEventFinancials(
        {
          adults: booking.adults,
          children: booking.children,
          eventType: booking.eventType,
          eventDate: parseLocalDate(booking.eventDate),
          distanceMiles: booking.distanceMiles,
          premiumAddOn: booking.premiumAddOn,
          staffingProfileId: booking.staffingProfileId,
        },
        rules
      );
      totalRevenue += fin.subtotal + fin.distanceFee;
      totalCosts += fin.totalCosts + fin.totalLaborPaid;
      totalGrossProfit += fin.grossProfit;
      ownerADist += fin.ownerADistribution;
      ownerBDist += fin.ownerBDistribution;

      if (booking.eventType === 'private-dinner') privateCount++;
      else buffetCount++;

      if (booking.status === 'pending') statusCounts.pending++;
      if (booking.status === 'confirmed') statusCounts.confirmed++;
      if (booking.status === 'completed') statusCounts.completed++;
    });

    const profitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    // Upcoming events (confirmed or pending, future dates, across all months)
    const upcoming = bookings
      .filter((b) => {
        const d = parseLocalDate(b.eventDate);
        return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) &&
          (b.status === 'confirmed' || b.status === 'pending');
      })
      .sort((a, b) => parseLocalDate(a.eventDate).getTime() - parseLocalDate(b.eventDate).getTime())
      .slice(0, 5)
      .map((b) => {
        const fin = calculateEventFinancials(
          {
            adults: b.adults,
            children: b.children,
            eventType: b.eventType,
            eventDate: parseLocalDate(b.eventDate),
            distanceMiles: b.distanceMiles,
            premiumAddOn: b.premiumAddOn,
            staffingProfileId: b.staffingProfileId,
          },
          rules
        );
        return {
          id: b.id,
          date: b.eventDate,
          customer: b.customerName,
          type: b.eventType,
          guests: b.adults + b.children,
          total: fin.totalCharged,
          status: b.status,
        };
      });

    // Action items
    const todayEvents = bookings.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return isToday(d) && b.status !== 'cancelled';
    });
    const tomorrowEvents = bookings.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return isTomorrow(d) && b.status !== 'cancelled';
    });
    const pendingBookings = bookings.filter((b) => b.status === 'pending');

    // Confirmed upcoming count (this month only)
    const upcomingConfirmedCount = monthBookings.filter(
      (b) => b.status === 'confirmed' && parseLocalDate(b.eventDate) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ).length;

    return {
      upcomingConfirmedCount,
      totalRevenue,
      totalCosts,
      totalGrossProfit,
      profitMargin,
      pendingCount: statusCounts.pending,
      statusCounts,
      privateCount,
      buffetCount,
      totalEvents: monthBookings.length,
      ownerADist,
      ownerBDist,
      upcoming,
      todayEvents,
      tomorrowEvents,
      pendingBookings,
    };
  }, [bookings, rules]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Upcoming Events */}
          <div className="rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/50">
                <CalendarDaysIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Upcoming Events</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {dashboard.upcomingConfirmedCount}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">confirmed this month</p>
              </div>
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/50">
                <BanknotesIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Monthly Revenue</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(dashboard.totalRevenue)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">from {dashboard.totalEvents} events</p>
              </div>
            </div>
          </div>

          {/* Monthly Profit */}
          <div className="rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2.5 dark:bg-purple-950/50">
                <ArrowTrendingUpIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Monthly Profit</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(dashboard.totalGrossProfit)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  {dashboard.profitMargin.toFixed(0)}% margin
                </p>
              </div>
            </div>
          </div>

          {/* Pending Bookings */}
          <div className="rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/50">
                <ClockIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Pending Bookings</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {dashboard.pendingBookings.length}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">awaiting confirmation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Events Table */}
        <div className="rounded-xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Upcoming Events
            </h2>
            <Link
              href="/bookings"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              View All
            </Link>
          </div>
          {dashboard.upcoming.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Guests</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Total</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {dashboard.upcoming.map((event) => (
                    <tr key={event.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                        {format(parseLocalDate(event.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {event.customer}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          event.type === 'private-dinner'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                            : 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300'
                        }`}>
                          {event.type === 'private-dinner' ? 'Private' : 'Buffet'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-zinc-700 dark:text-zinc-300">
                        {event.guests}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(event.total)}
                      </td>
                      <td className="px-6 py-3 text-center text-sm">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          event.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}>
                          {event.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <CalendarDaysIcon className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No upcoming events</p>
              <Link
                href="/bookings"
                className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                Create a booking
              </Link>
            </div>
          )}
        </div>

        {/* Monthly Snapshot + Action Items */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Snapshot */}
          <div className="rounded-xl border border-zinc-200/60 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Monthly Snapshot
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Event Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Event Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Total Events</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">{dashboard.totalEvents}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Confirmed</span>
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {dashboard.statusCounts.confirmed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Completed</span>
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      {dashboard.statusCounts.completed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Pending</span>
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      {dashboard.statusCounts.pending}
                    </span>
                  </div>
                  <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">Private</span>
                      <span className="text-zinc-900 dark:text-zinc-100">{dashboard.privateCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">Buffet</span>
                      <span className="text-zinc-900 dark:text-zinc-100">{dashboard.buffetCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Financials</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Revenue</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(dashboard.totalRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Costs</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(dashboard.totalCosts)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Gross Profit</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(dashboard.totalGrossProfit)}</span>
                  </div>
                  <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">Owner A Dist.</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(dashboard.ownerADist)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">Owner B Dist.</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(dashboard.ownerBDist)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div className="rounded-xl border border-zinc-200/60 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Action Items
            </h2>
            <div className="space-y-3">
              {dashboard.todayEvents.length > 0 && (
                <div className="rounded-xl bg-blue-50/80 p-4 dark:bg-blue-950/30">
                  <div className="flex items-start gap-3">
                    <CalendarDaysIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        {dashboard.todayEvents.length} event{dashboard.todayEvents.length > 1 ? 's' : ''} today
                      </p>
                      <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                        {dashboard.todayEvents.map((e) => e.customerName).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {dashboard.tomorrowEvents.length > 0 && (
                <div className="rounded-xl bg-indigo-50/80 p-4 dark:bg-indigo-950/30">
                  <div className="flex items-start gap-3">
                    <CalendarDaysIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                        {dashboard.tomorrowEvents.length} event{dashboard.tomorrowEvents.length > 1 ? 's' : ''} tomorrow
                      </p>
                      <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                        {dashboard.tomorrowEvents.map((e) => e.customerName).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {dashboard.pendingBookings.length > 0 && (
                <Link href="/bookings" className="block">
                  <div className="rounded-xl bg-amber-50/80 p-4 transition-colors hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                          {dashboard.pendingBookings.length} booking{dashboard.pendingBookings.length > 1 ? 's' : ''} awaiting confirmation
                        </p>
                        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                          Click to review pending bookings
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {dashboard.todayEvents.length === 0 &&
                dashboard.tomorrowEvents.length === 0 &&
                dashboard.pendingBookings.length === 0 && (
                  <div className="rounded-xl bg-emerald-50/80 p-4 dark:bg-emerald-950/30">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                        All clear! No urgent items.
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Link
            href="/bookings"
            className="group rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
          >
            <CalendarDaysIcon className="h-6 w-6 text-zinc-400 transition-colors group-hover:text-indigo-600 dark:text-zinc-500 dark:group-hover:text-indigo-400" />
            <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">New Booking</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Create an event</p>
          </Link>

          <Link
            href="/calculator"
            className="group rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
          >
            <CalculatorIcon className="h-6 w-6 text-zinc-400 transition-colors group-hover:text-indigo-600 dark:text-zinc-500 dark:group-hover:text-indigo-400" />
            <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">Calculator</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Estimate profitability</p>
          </Link>

          <Link
            href="/reports"
            className="group rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
          >
            <DocumentChartBarIcon className="h-6 w-6 text-zinc-400 transition-colors group-hover:text-indigo-600 dark:text-zinc-500 dark:group-hover:text-indigo-400" />
            <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">Reports</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">View analytics</p>
          </Link>

          <Link
            href="/business-rules"
            className="group rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
          >
            <CogIcon className="h-6 w-6 text-zinc-400 transition-colors group-hover:text-indigo-600 dark:text-zinc-500 dark:group-hover:text-indigo-400" />
            <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">Business Rules</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure pricing</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

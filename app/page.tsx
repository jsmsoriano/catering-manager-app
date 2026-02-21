'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, isWithinInterval, isToday, isTomorrow, startOfDay, endOfDay } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { useAuth } from '@/components/AuthProvider';
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

function getDefaultPeriod() {
  const now = new Date();
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
  };
}

function getDisplayName(user: { user_metadata?: { full_name?: string; name?: string }; email?: string | null } | null): string {
  if (!user) return 'there';
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user.email ?? 'there';
}

function getAvatarUrl(user: { user_metadata?: { avatar_url?: string; picture?: string } } | null): string | null {
  if (!user?.user_metadata) return null;
  const meta = user.user_metadata as { avatar_url?: string; picture?: string };
  return meta?.avatar_url ?? meta?.picture ?? null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [periodStart, setPeriodStart] = useState<string>(() =>
    format(getDefaultPeriod().start, 'yyyy-MM-dd')
  );
  const [periodEnd, setPeriodEnd] = useState<string>(() =>
    format(getDefaultPeriod().end, 'yyyy-MM-dd')
  );

  const setPeriodToCurrentMonth = () => {
    const { start, end } = getDefaultPeriod();
    setPeriodStart(format(start, 'yyyy-MM-dd'));
    setPeriodEnd(format(end, 'yyyy-MM-dd'));
  };

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

  // Dashboard computed data (filtered by selected period)
  const dashboard = useMemo(() => {
    const now = new Date();
    const rangeStart = startOfDay(parseLocalDate(periodStart));
    const rangeEnd = endOfDay(parseLocalDate(periodEnd));

    // Bookings in selected period (non-cancelled)
    const periodBookings = bookings.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return isWithinInterval(d, { start: rangeStart, end: rangeEnd }) && b.status !== 'cancelled';
    });

    // Financials for month
    let totalRevenue = 0;
    let totalCosts = 0;
    let totalGrossProfit = 0;
    let privateCount = 0;
    let buffetCount = 0;
    const statusCounts = { pending: 0, confirmed: 0, completed: 0 };

    periodBookings.forEach((booking) => {
      const { financials: fin } = calculateBookingFinancials(booking, rules);
      totalRevenue += fin.subtotal + fin.distanceFee;
      totalCosts += fin.totalCosts + fin.totalLaborPaid;
      totalGrossProfit += fin.grossProfit;

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
        const { financials: fin } = calculateBookingFinancials(b, rules);
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

    // Confirmed upcoming count (in period, from today onward)
    const todayStart = startOfDay(now);
    const upcomingConfirmedCount = periodBookings.filter(
      (b) => b.status === 'confirmed' && parseLocalDate(b.eventDate) >= todayStart
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
      totalEvents: periodBookings.length,
      upcoming,
      todayEvents,
      tomorrowEvents,
      pendingBookings,
    };
  }, [bookings, rules, periodStart, periodEnd]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header: profile + greeting */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-border bg-card-elevated">
              {getAvatarUrl(user) ? (
                <Image
                  src={getAvatarUrl(user)!}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-text-muted">
                  {user ? (getDisplayName(user)[0]?.toUpperCase() ?? '?') : '?'}
                </span>
              )}
            </div>
            <div>
              <p className="text-xl font-semibold text-text-primary">
                Hi {getDisplayName(user)},
              </p>
              <p className="text-text-secondary">
                Here is your business snapshot.
              </p>
            </div>
          </div>
          {/* Period filter */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <span className="text-sm font-medium text-text-secondary">Period</span>
            <div className="flex items-center gap-2">
              <label htmlFor="dashboard-period-start" className="sr-only">From</label>
              <input
                id="dashboard-period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-text-muted">to</span>
              <label htmlFor="dashboard-period-end" className="sr-only">To</label>
              <input
                id="dashboard-period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              type="button"
              onClick={setPeriodToCurrentMonth}
              className="rounded border border-border bg-card-elevated px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-card-elevated/80 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              This month
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Upcoming Events */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-soft-bg p-2.5">
                <CalendarDaysIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Upcoming Events</p>
                <p className="text-2xl font-bold text-text-primary">
                  {dashboard.upcomingConfirmedCount}
                </p>
                <p className="text-xs text-text-muted">confirmed in period</p>
              </div>
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-soft-bg p-2.5">
                <BanknotesIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Revenue</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(dashboard.totalRevenue)}
                </p>
                <p className="text-xs text-text-muted">from {dashboard.totalEvents} events</p>
              </div>
            </div>
          </div>

          {/* Monthly Profit */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-soft-bg p-2.5">
                <ArrowTrendingUpIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Profit</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(dashboard.totalGrossProfit)}
                </p>
                <p className="text-xs text-text-muted">
                  {dashboard.profitMargin.toFixed(0)}% margin
                </p>
              </div>
            </div>
          </div>

          {/* Pending Bookings */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-soft-bg p-2.5">
                <ClockIcon className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Pending Bookings</p>
                <p className="text-2xl font-bold text-text-primary">
                  {dashboard.pendingBookings.length}
                </p>
                <p className="text-xs text-text-muted">awaiting confirmation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Events Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Upcoming Events
            </h2>
            <Link
              href="/bookings"
              className="text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent"
            >
              View All
            </Link>
          </div>
          {dashboard.upcoming.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-text-muted">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-text-muted">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-text-muted">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-text-muted">Guests</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-text-muted">Total</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase text-text-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dashboard.upcoming.map((event) => (
                    <tr key={event.id} className="hover:bg-card-elevated">
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-text-primary">
                        {format(parseLocalDate(event.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-text-primary">
                        {event.customer}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          event.type === 'private-dinner'
                            ? 'bg-accent-soft-bg text-accent'
                            : 'bg-accent-soft-bg/50 text-text-secondary'
                        }`}>
                          {event.type === 'private-dinner' ? 'Private' : 'Buffet'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-text-secondary">
                        {event.guests}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-text-primary">
                        {formatCurrency(event.total)}
                      </td>
                      <td className={`border-l-2 pl-4 px-6 py-3 text-center text-sm ${event.status === 'confirmed' ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
                        <span className={`text-xs font-medium ${
                          event.status === 'confirmed'
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-amber-700 dark:text-amber-300'
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
              <CalendarDaysIcon className="mx-auto h-10 w-10 text-text-muted" />
              <p className="mt-3 text-sm text-text-secondary">No upcoming events</p>
              <Link
                href="/bookings"
                className="mt-2 inline-block text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent"
              >
                Create a booking
              </Link>
            </div>
          )}
        </div>

        {/* Monthly Snapshot + Action Items */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Snapshot */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-text-primary">
              Period Snapshot
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Event Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-text-secondary">Event Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Total Events</span>
                    <span className="font-semibold text-text-primary">{dashboard.totalEvents}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Confirmed</span>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      {dashboard.statusCounts.confirmed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Completed</span>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {dashboard.statusCounts.completed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Pending</span>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      {dashboard.statusCounts.pending}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">Private</span>
                      <span className="text-text-primary">{dashboard.privateCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">Buffet</span>
                      <span className="text-text-primary">{dashboard.buffetCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-text-secondary">Financials</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Revenue</span>
                    <span className="font-medium text-text-primary">{formatCurrency(dashboard.totalRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Costs</span>
                    <span className="font-medium text-text-primary">{formatCurrency(dashboard.totalCosts)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Gross Profit</span>
                    <span className="font-semibold text-success">{formatCurrency(dashboard.totalGrossProfit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-text-primary">
              Action Items
            </h2>
            <div className="space-y-3">
              {dashboard.todayEvents.length > 0 && (
                <div className="rounded-xl bg-info/20 p-4">
                  <div className="flex items-start gap-3">
                    <CalendarDaysIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-info" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {dashboard.todayEvents.length} event{dashboard.todayEvents.length > 1 ? 's' : ''} today
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {dashboard.todayEvents.map((e) => e.customerName).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {dashboard.tomorrowEvents.length > 0 && (
                <div className="rounded-xl bg-accent-soft-bg p-4">
                  <div className="flex items-start gap-3">
                    <CalendarDaysIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {dashboard.tomorrowEvents.length} event{dashboard.tomorrowEvents.length > 1 ? 's' : ''} tomorrow
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {dashboard.tomorrowEvents.map((e) => e.customerName).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {dashboard.pendingBookings.length > 0 && (
                <Link href="/bookings" className="block">
                  <div className="rounded-xl bg-warning/20 p-4 transition-colors hover:bg-warning/30">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {dashboard.pendingBookings.length} booking{dashboard.pendingBookings.length > 1 ? 's' : ''} awaiting confirmation
                        </p>
                        <p className="mt-0.5 text-xs text-text-secondary">
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
                  <div className="rounded-xl bg-success/20 p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="h-5 w-5 text-success" />
                      <p className="text-sm font-medium text-text-primary">
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
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-accent hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent"
          >
            <CalendarDaysIcon className="h-6 w-6 text-text-muted transition-colors group-hover:text-accent" />
            <p className="mt-2 text-sm font-medium text-text-primary">New Booking</p>
            <p className="text-xs text-text-secondary">Create an event</p>
          </Link>

          <Link
            href="/calculator"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-accent hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent"
          >
            <CalculatorIcon className="h-6 w-6 text-text-muted transition-colors group-hover:text-accent" />
            <p className="mt-2 text-sm font-medium text-text-primary">Calculator</p>
            <p className="text-xs text-text-secondary">Estimate profitability</p>
          </Link>

          <Link
            href="/reports"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-accent hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent"
          >
            <DocumentChartBarIcon className="h-6 w-6 text-text-muted transition-colors group-hover:text-accent" />
            <p className="mt-2 text-sm font-medium text-text-primary">Reports</p>
            <p className="text-xs text-text-secondary">View analytics</p>
          </Link>

          <Link
            href="/business-rules"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-accent hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent"
          >
            <CogIcon className="h-6 w-6 text-text-muted transition-colors group-hover:text-accent" />
            <p className="mt-2 text-sm font-medium text-text-primary">Business Rules</p>
            <p className="text-xs text-text-secondary">Configure pricing</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

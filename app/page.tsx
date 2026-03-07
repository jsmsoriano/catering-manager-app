'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isWithinInterval, isToday, isTomorrow, startOfDay, endOfDay, eachWeekOfInterval, isSameDay } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { useAuth } from '@/components/AuthProvider';
import { useBookingsQuery } from '@/lib/hooks/useBookingsQuery';
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

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
  const { bookings } = useBookingsQuery();
  const [mounted, setMounted] = useState(false);
  const [periodStart, setPeriodStart] = useState<string>(() =>
    format(getDefaultPeriod().start, 'yyyy-MM-dd')
  );
  const [periodEnd, setPeriodEnd] = useState<string>(() =>
    format(getDefaultPeriod().end, 'yyyy-MM-dd')
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const setPeriodToCurrentMonth = () => {
    const { start, end } = getDefaultPeriod();
    setPeriodStart(format(start, 'yyyy-MM-dd'));
    setPeriodEnd(format(end, 'yyyy-MM-dd'));
  };

  // Dashboard computed data (filtered by selected period)
  const dashboard = useMemo(() => {
    const now = new Date();
    const list = Array.isArray(bookings) ? bookings : [];
    let rangeStart: Date;
    let rangeEnd: Date;
    try {
      rangeStart = startOfDay(parseLocalDate(periodStart));
      rangeEnd = endOfDay(parseLocalDate(periodEnd));
      if (Number.isNaN(rangeStart.getTime())) rangeStart = startOfMonth(now);
      if (Number.isNaN(rangeEnd.getTime())) rangeEnd = endOfMonth(now);
    } catch {
      rangeStart = startOfMonth(now);
      rangeEnd = endOfMonth(now);
    }

    // Bookings in selected period (non-cancelled)
    const periodBookings = list.filter((b) => {
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
    const n = periodBookings.length;
    const avgRevenuePerEvent = n > 0 ? totalRevenue / n : 0;
    const avgProfitPerEvent = n > 0 ? totalGrossProfit / n : 0;

    // Upcoming events (confirmed or pending, future dates, across all months)
    const upcoming = list
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
    const todayEvents = list.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return isToday(d) && b.status !== 'cancelled';
    });
    const tomorrowEvents = list.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return isTomorrow(d) && b.status !== 'cancelled';
    });
    const pendingBookings = list.filter((b) => b.status === 'pending');

    // Pending $ at stake (quotes awaiting confirmation)
    let pendingRevenue = 0;
    pendingBookings.forEach((b) => {
      const { financials: fin } = calculateBookingFinancials(b, rules);
      pendingRevenue += fin.totalCharged;
    });

    // This week / next week (load and revenue — how caterers plan)
    const weekOpt = { weekStartsOn: 0 as const };
    const thisWeekStart = startOfWeek(now, weekOpt);
    const thisWeekEnd = endOfWeek(now, weekOpt);
    const nextWeekStart = addDays(thisWeekEnd, 1);
    const nextWeekEnd = endOfWeek(nextWeekStart, weekOpt);
    const thisWeekBookings = list.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return isWithinInterval(d, { start: thisWeekStart, end: thisWeekEnd }) && b.status !== 'cancelled';
    });
    const nextWeekBookings = list.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return isWithinInterval(d, { start: nextWeekStart, end: nextWeekEnd }) && b.status !== 'cancelled';
    });
    let thisWeekRevenue = 0;
    let thisWeekGuests = 0;
    thisWeekBookings.forEach((b) => {
      const { financials: fin } = calculateBookingFinancials(b, rules);
      thisWeekRevenue += fin.totalCharged;
      thisWeekGuests += b.adults + b.children;
    });
    let nextWeekRevenue = 0;
    let nextWeekGuests = 0;
    nextWeekBookings.forEach((b) => {
      const { financials: fin } = calculateBookingFinancials(b, rules);
      nextWeekRevenue += fin.totalCharged;
      nextWeekGuests += b.adults + b.children;
    });
    const thisWeek = { events: thisWeekBookings.length, guests: thisWeekGuests, revenue: thisWeekRevenue };
    const nextWeek = { events: nextWeekBookings.length, guests: nextWeekGuests, revenue: nextWeekRevenue };

    const todayStart = startOfDay(now);

    // Next 7 calendar days (not including today)
    const upcoming7: { date: string; label: string; bookings: typeof list }[] = [];
    for (let i = 1; i <= 7; i++) {
      const day = addDays(todayStart, i);
      const dayBookings = list.filter((b) => isSameDay(parseLocalDate(b.eventDate), day) && b.status !== 'cancelled');
      upcoming7.push({
        date: format(day, 'yyyy-MM-dd'),
        label: format(day, 'EEE, MMM d'),
        bookings: dayBookings,
      });
    }

    // Confirmed revenue in the next 30 days (cash flow)
    const thirtyDaysOut = addDays(todayStart, 30);
    const upcomingConfirmed = list.filter((b) => {
      const d = parseLocalDate(b.eventDate);
      return b.status === 'confirmed' && isWithinInterval(d, { start: todayStart, end: thirtyDaysOut });
    });
    let upcoming30DayRevenue = 0;
    upcomingConfirmed.forEach((b) => {
      const { financials: fin } = calculateBookingFinancials(b, rules);
      upcoming30DayRevenue += fin.totalCharged;
    });
    const upcoming30DayEventCount = upcomingConfirmed.length;

    // Confirmed upcoming count (in period, from today onward)
    const upcomingConfirmedCount = periodBookings.filter(
      (b) => b.status === 'confirmed' && parseLocalDate(b.eventDate) >= todayStart
    ).length;

    // Revenue by week (for chart)
    const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 0 });
    const revenueByWeek = weeks.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekBookings = periodBookings.filter((b) => {
        const d = parseLocalDate(b.eventDate);
        return isWithinInterval(d, { start: weekStart, end: endOfDay(weekEnd) });
      });
      let rev = 0;
      let profit = 0;
      weekBookings.forEach((b) => {
        const { financials: fin } = calculateBookingFinancials(b, rules);
        rev += fin.subtotal + fin.distanceFee;
        profit += fin.grossProfit;
      });
      return {
        weekLabel: format(weekStart, 'MMM d'),
        revenue: rev,
        profit,
        events: weekBookings.length,
      };
    });

    // Event mix for pie (Private vs Buffet)
    const eventMixData = [
      { name: 'Private', value: privateCount, fill: 'var(--color-accent)' },
      { name: 'Buffet', value: buffetCount, fill: 'var(--color-text-muted)' },
    ].filter((d) => d.value > 0);

    return {
      upcomingConfirmedCount,
      totalRevenue,
      totalCosts,
      totalGrossProfit,
      profitMargin,
      pendingCount: statusCounts.pending,
      pendingRevenue,
      statusCounts,
      privateCount,
      buffetCount,
      totalEvents: periodBookings.length,
      avgRevenuePerEvent,
      avgProfitPerEvent,
      upcoming,
      upcoming7,
      todayEvents,
      tomorrowEvents,
      pendingBookings,
      revenueByWeek,
      eventMixData,
      thisWeek,
      nextWeek,
      upcoming30DayRevenue,
      upcoming30DayEventCount,
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

        {/* Today's Events — prominent banner when events exist today */}
        {dashboard.todayEvents.length > 0 && (
          <div className="rounded-xl border border-info/40 bg-info/10 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="h-5 w-5 text-info" />
                <h2 className="text-base font-semibold text-text-primary">
                  Today — {format(new Date(), 'EEEE, MMMM d')}
                </h2>
              </div>
              <Link href="/bookings?filter=confirmed" className="text-xs font-medium text-accent hover:text-accent-hover">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {dashboard.todayEvents.map((b) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-accent/40 hover:bg-card-elevated"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${b.status === 'confirmed' ? 'bg-accent' : 'bg-warning'}`} />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{b.customerName}</p>
                      <p className="text-xs text-text-muted">
                        {b.eventTime} · {b.adults + b.children} guests · {b.location || 'No location'}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    b.status === 'confirmed' ? 'bg-accent/10 text-accent' : 'bg-warning/10 text-warning'
                  }`}>
                    {b.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* MTD Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Confirmed this period */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-soft-bg p-2.5">
                <CalendarDaysIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Confirmed</p>
                <p className="text-2xl font-bold text-text-primary">
                  {dashboard.upcomingConfirmedCount}
                </p>
                <p className="text-xs text-text-muted">upcoming in period</p>
              </div>
            </div>
          </div>

          {/* Revenue MTD */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-soft-bg p-2.5">
                <BanknotesIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Revenue MTD</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(dashboard.totalRevenue)}
                </p>
                <p className="text-xs text-text-muted">from {dashboard.totalEvents} events</p>
              </div>
            </div>
          </div>

          {/* Profit MTD */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-soft-bg p-2.5">
                <ArrowTrendingUpIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Profit MTD</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(dashboard.totalGrossProfit)}
                </p>
                <p className="text-xs text-text-muted">
                  {dashboard.profitMargin.toFixed(0)}% margin
                </p>
              </div>
            </div>
          </div>

          {/* Pending Leads */}
          <Link href="/bookings?filter=leads" className="block">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-warning/40">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-warning/10 p-2.5">
                  <ClockIcon className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Pending Leads</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {dashboard.pendingBookings.length}
                  </p>
                  <p className="text-xs text-text-muted">
                    {dashboard.pendingRevenue > 0 ? formatCurrency(dashboard.pendingRevenue) + ' at stake' : 'awaiting confirmation'}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Upcoming 7 days */}
        {dashboard.upcoming7.some((d) => d.bookings.length > 0) && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">Next 7 days</h2>
              <Link href="/bookings" className="text-xs font-medium text-accent hover:text-accent-hover">
                View all events
              </Link>
            </div>
            <div className="space-y-1">
              {dashboard.upcoming7.filter((d) => d.bookings.length > 0).map((day) => (
                <div key={day.date} className="flex items-start gap-4 rounded-lg px-3 py-2.5 hover:bg-card-elevated">
                  <div className="w-24 shrink-0">
                    <p className="text-xs font-semibold text-text-secondary">{day.label}</p>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {day.bookings.map((b) => (
                      <Link
                        key={b.id}
                        href={`/bookings/${b.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card-elevated px-2.5 py-1 text-xs font-medium text-text-primary hover:border-accent/40"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${b.status === 'confirmed' ? 'bg-accent' : 'bg-warning'}`} />
                        {b.customerName}
                        <span className="text-text-muted">· {b.adults + b.children}g</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* This week / Next week — load at a glance */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-text-primary">This week & next</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-card-elevated/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">This week</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{dashboard.thisWeek.events} events</p>
              <p className="text-sm text-text-secondary">{dashboard.thisWeek.guests} guests · {formatCurrency(dashboard.thisWeek.revenue)}</p>
            </div>
            <div className="rounded-lg bg-card-elevated/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Next week</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{dashboard.nextWeek.events} events</p>
              <p className="text-sm text-text-secondary">{dashboard.nextWeek.guests} guests · {formatCurrency(dashboard.nextWeek.revenue)}</p>
            </div>
          </div>
          {dashboard.upcoming30DayRevenue > 0 && (
            <p className="mt-3 border-t border-border pt-3 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Next 30 days (confirmed):</span> {formatCurrency(dashboard.upcoming30DayRevenue)} from {dashboard.upcoming30DayEventCount} events
            </p>
          )}
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

        {/* Charts — render only after mount to avoid Recharts SSR/hydration issues */}
        {mounted && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue over time (by week in period) */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Revenue by week
            </h2>
            {dashboard.revenueByWeek.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.revenueByWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-card-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--color-text-primary)' }}
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), '']}
                      labelFormatter={(label) => `Week of ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="var(--color-accent)" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" fill="var(--color-success)" name="Profit" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-text-muted">No events in this period</p>
            )}
          </div>

          {/* Event mix: Private vs Buffet */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Event mix
            </h2>
            {dashboard.eventMixData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboard.eventMixData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={80}
                      paddingAngle={2}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {dashboard.eventMixData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-card-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                      formatter={(value) => [Number(value ?? 0), 'Events']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-text-muted">No events in this period</p>
            )}
          </div>
        </div>
        )}

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
                  {dashboard.totalEvents > 0 && (
                    <div className="border-t border-border pt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">Avg per event</span>
                        <span className="text-text-muted">—</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-text-muted">
                        <span>Revenue</span>
                        <span>{formatCurrency(dashboard.avgRevenuePerEvent)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-text-muted">
                        <span>Profit</span>
                        <span>{formatCurrency(dashboard.avgProfitPerEvent)}</span>
                      </div>
                    </div>
                  )}
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

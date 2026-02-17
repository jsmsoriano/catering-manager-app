'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking, BookingStatus } from '@/lib/bookingTypes';

// Helper to parse date strings as local dates (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function BusinessSummaryPage() {
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Load bookings and listen for updates
  useEffect(() => {
    const loadBookings = () => {
      const saved = localStorage.getItem('bookings');
      if (saved) {
        try {
          setBookings(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load bookings:', e);
        }
      }
    };

    // Initial load
    loadBookings();

    // Listen for storage changes (cross-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bookings') {
        loadBookings();
      }
    };

    // Listen for custom events (same-tab updates)
    const handleCustomStorageChange = () => {
      loadBookings();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bookingsUpdated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingsUpdated', handleCustomStorageChange);
    };
  }, []);

  // Filter bookings for selected date range
  const monthBookings = useMemo(() => {
    const rangeStart = parseLocalDate(startDate);
    const rangeEnd = parseLocalDate(endDate);

    return bookings.filter((booking) => {
      const bookingDate = parseLocalDate(booking.eventDate);
      return (
        isWithinInterval(bookingDate, { start: rangeStart, end: rangeEnd }) &&
        booking.status !== 'cancelled'
      );
    });
  }, [bookings, startDate, endDate]);

  // Calculate comprehensive business metrics
  const businessData = useMemo(() => {
    let totalRevenue = 0;
    let totalFoodCost = 0;
    let totalLaborCost = 0;
    let totalDistanceCost = 0;
    let totalSuppliesCost = 0;
    let totalProfit = 0;
    let totalOwnerDistribution = 0;
    let businessRetained = 0;

    // Event type breakdown
    let privateDinnerRevenue = 0;
    let privateDinnerCost = 0;
    let privateDinnerCount = 0;

    let buffetRevenue = 0;
    let buffetCost = 0;
    let buffetCount = 0;

    // Guest stats
    let totalGuests = 0;
    let totalAdults = 0;
    let totalChildren = 0;

    monthBookings.forEach((booking) => {
      const { financials } = calculateBookingFinancials(booking, rules);

      // Aggregate totals
      totalRevenue += financials.totalCharged;
      totalFoodCost += financials.foodCost;
      totalLaborCost += financials.totalLaborPaid;
      totalDistanceCost += financials.distanceFee;
      totalSuppliesCost += financials.suppliesCost;
      totalProfit += financials.grossProfit;
      totalOwnerDistribution += financials.distributionAmount;
      businessRetained += financials.retainedAmount;

      // Event type breakdown
      const eventCost =
        financials.foodCost +
        financials.totalLaborPaid +
        financials.distanceFee +
        financials.suppliesCost;

      if (booking.eventType === 'private-dinner') {
        privateDinnerRevenue += financials.totalCharged;
        privateDinnerCost += eventCost;
        privateDinnerCount++;
      } else {
        buffetRevenue += financials.totalCharged;
        buffetCost += eventCost;
        buffetCount++;
      }

      // Guest counts
      totalGuests += booking.adults + booking.children;
      totalAdults += booking.adults;
      totalChildren += booking.children;
    });

    const totalCost = totalFoodCost + totalLaborCost + totalDistanceCost + totalSuppliesCost;
    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const avgRevenuePerEvent = monthBookings.length > 0 ? totalRevenue / monthBookings.length : 0;
    const avgProfitPerEvent = monthBookings.length > 0 ? grossProfit / monthBookings.length : 0;
    const avgGuestsPerEvent = monthBookings.length > 0 ? totalGuests / monthBookings.length : 0;

    // Calculate profit margins by event type
    const privateDinnerMargin =
      privateDinnerRevenue > 0
        ? ((privateDinnerRevenue - privateDinnerCost) / privateDinnerRevenue) * 100
        : 0;
    const buffetMargin =
      buffetRevenue > 0 ? ((buffetRevenue - buffetCost) / buffetRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      profitMargin,
      totalFoodCost,
      totalLaborCost,
      totalDistanceCost,
      totalSuppliesCost,
      totalProfit,
      totalOwnerDistribution,
      businessRetained,
      avgRevenuePerEvent,
      avgProfitPerEvent,
      avgGuestsPerEvent,
      eventCount: monthBookings.length,
      totalGuests,
      totalAdults,
      totalChildren,
      privateDinner: {
        count: privateDinnerCount,
        revenue: privateDinnerRevenue,
        cost: privateDinnerCost,
        profit: privateDinnerRevenue - privateDinnerCost,
        margin: privateDinnerMargin,
        avgRevenue: privateDinnerCount > 0 ? privateDinnerRevenue / privateDinnerCount : 0,
      },
      buffet: {
        count: buffetCount,
        revenue: buffetRevenue,
        cost: buffetCost,
        profit: buffetRevenue - buffetCost,
        margin: buffetMargin,
        avgRevenue: buffetCount > 0 ? buffetRevenue / buffetCount : 0,
      },
    };
  }, [monthBookings, rules]);

  // Calculate booking status breakdown
  const statusBreakdown = useMemo(() => {
    const rangeStart = parseLocalDate(startDate);
    const rangeEnd = parseLocalDate(endDate);

    const allRangeBookings = bookings.filter((booking) => {
      const bookingDate = parseLocalDate(booking.eventDate);
      return isWithinInterval(bookingDate, { start: rangeStart, end: rangeEnd });
    });

    const statusCounts: Record<BookingStatus, number> = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    allRangeBookings.forEach((booking) => {
      statusCounts[booking.status]++;
    });

    const total = allRangeBookings.length;
    const conversionRate = total > 0 ? ((statusCounts.completed / total) * 100).toFixed(1) : '0.0';
    const cancellationRate = total > 0 ? ((statusCounts.cancelled / total) * 100).toFixed(1) : '0.0';

    return {
      statusCounts,
      total,
      conversionRate,
      cancellationRate,
    };
  }, [bookings, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header - Hide on print */}
      <div className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-text-primary">
          Business Financial Summary
        </h1>
        <p className="mt-2 text-text-secondary">
          Comprehensive analysis of business performance and financial health
        </p>
      </div>

      {/* Filters - Hide on print */}
      <div className="mb-8 flex flex-wrap gap-4 print:hidden">
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={() => {
              const today = new Date();
              setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
            }}
            className="rounded-md border border-border bg-card-elevated px-4 py-2 text-text-secondary hover:bg-card"
          >
            This Month
          </button>
          <button
            onClick={handlePrint}
            className="rounded-md bg-card-elevated px-4 py-2 text-text-primary hover:bg-card"
          >
            🖨️ Print Report
          </button>
        </div>
      </div>

      {/* Report Content - Print friendly */}
      <div className="space-y-8 rounded-lg border border-border bg-card p-8 dark:border-border  print:border-0 print:shadow-none">
        {/* Print Header */}
        <div className="hidden border-b border-border pb-6 print:block">
          <div className="mb-4 flex justify-center">
            <Image
              src="/hibachisun.png"
              alt="Hibachi A Go Go"
              width={200}
              height={60}
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-center text-xl font-semibold text-text-primary">
            Business Financial Summary
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-text-secondary">
            <div>
              <strong>Report Period:</strong> {format(parseLocalDate(startDate), 'MMM d, yyyy')} - {format(parseLocalDate(endDate), 'MMM d, yyyy')}
            </div>
            <div>
              <strong>Generated:</strong> {format(new Date(), 'PPP')}
            </div>
            <div>
              <strong>Total Events:</strong> {businessData.eventCount}
            </div>
            <div>
              <strong>Total Revenue:</strong> {formatCurrency(businessData.totalRevenue)}
            </div>
          </div>
        </div>

        {monthBookings.length > 0 ? (
          <>
            {/* Key Performance Indicators */}
            <div>
              <h3 className="mb-4 text-xl font-semibold text-text-primary">
                Key Performance Indicators
              </h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20 print:border-blue-300">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    Total Revenue
                  </p>
                  <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(businessData.totalRevenue)}
                  </p>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                    {formatCurrency(businessData.avgRevenuePerEvent)} avg/event
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20 print:border-emerald-300">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                    Gross Profit
                  </p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(businessData.grossProfit)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    {businessData.profitMargin.toFixed(1)}% margin
                  </p>
                </div>

                <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-900 dark:bg-purple-950/20 print:border-purple-300">
                  <p className="text-sm font-medium text-purple-900 dark:text-purple-200">
                    Total Cost
                  </p>
                  <p className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(businessData.totalCost)}
                  </p>
                  <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                    {businessData.totalRevenue > 0
                      ? ((businessData.totalCost / businessData.totalRevenue) * 100).toFixed(1)
                      : 0}
                    % of revenue
                  </p>
                </div>

                <div className="rounded-lg border border-orange-200 bg-orange-50 p-6 dark:border-orange-900 dark:bg-orange-950/20 print:border-orange-300">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                    Events Completed
                  </p>
                  <p className="mt-2 text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {businessData.eventCount}
                  </p>
                  <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
                    {businessData.totalGuests} total guests
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue & Profit */}
              <div className="rounded-lg border border-border bg-card-elevated p-6">
                <h4 className="mb-4 text-lg font-semibold text-text-primary">
                  Revenue & Profit
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Total Revenue</span>
                    <span className="font-semibold text-text-primary">
                      {formatCurrency(businessData.totalRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Total Costs</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      -{formatCurrency(businessData.totalCost)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 border-border">
                    <div className="flex justify-between">
                      <span className="font-medium text-text-primary">
                        Gross Profit
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(businessData.grossProfit)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs">
                      <span className="text-text-secondary">Profit Margin</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {businessData.profitMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border pt-2 text-xs border-border">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Avg Revenue/Event</span>
                      <span className="text-text-primary">
                        {formatCurrency(businessData.avgRevenuePerEvent)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Avg Profit/Event</span>
                      <span className="text-text-primary">
                        {formatCurrency(businessData.avgProfitPerEvent)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Avg Guests/Event</span>
                      <span className="text-text-primary">
                        {businessData.avgGuestsPerEvent.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="rounded-lg border border-border bg-card-elevated p-6">
                <h4 className="mb-4 text-lg font-semibold text-text-primary">
                  Cost Breakdown
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-text-secondary">Food Cost</span>
                      <span className="font-semibold text-text-primary">
                        {formatCurrency(businessData.totalFoodCost)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-red-500"
                        style={{
                          width: `${
                            businessData.totalCost > 0
                              ? (businessData.totalFoodCost / businessData.totalCost) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      {businessData.totalCost > 0
                        ? ((businessData.totalFoodCost / businessData.totalCost) * 100).toFixed(1)
                        : 0}
                      % of total costs
                    </p>
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-text-secondary">Labor Cost</span>
                      <span className="font-semibold text-text-primary">
                        {formatCurrency(businessData.totalLaborCost)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-orange-500"
                        style={{
                          width: `${
                            businessData.totalCost > 0
                              ? (businessData.totalLaborCost / businessData.totalCost) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      {businessData.totalCost > 0
                        ? ((businessData.totalLaborCost / businessData.totalCost) * 100).toFixed(1)
                        : 0}
                      % of total costs
                    </p>
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-text-secondary">Supplies Cost</span>
                      <span className="font-semibold text-text-primary">
                        {formatCurrency(businessData.totalSuppliesCost)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-yellow-500"
                        style={{
                          width: `${
                            businessData.totalCost > 0
                              ? (businessData.totalSuppliesCost / businessData.totalCost) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      {businessData.totalCost > 0
                        ? ((businessData.totalSuppliesCost / businessData.totalCost) * 100).toFixed(
                            1
                          )
                        : 0}
                      % of total costs
                    </p>
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-text-secondary">Distance Cost</span>
                      <span className="font-semibold text-text-primary">
                        {formatCurrency(businessData.totalDistanceCost)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${
                            businessData.totalCost > 0
                              ? (businessData.totalDistanceCost / businessData.totalCost) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      {businessData.totalCost > 0
                        ? ((businessData.totalDistanceCost / businessData.totalCost) * 100).toFixed(
                            1
                          )
                        : 0}
                      % of total costs
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Type Performance */}
            <div>
              <h3 className="mb-4 text-xl font-semibold text-text-primary">
                Event Type Performance
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Private Dinner */}
                <div className="rounded-lg border border-border bg-card p-6  ">
                  <h4 className="mb-4 text-lg font-semibold text-text-primary">
                    Private Dinner
                  </h4>
                  <div className="space-y-3">
                    <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                        Total Revenue
                      </p>
                      <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(businessData.privateDinner.revenue)}
                      </p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Events</span>
                        <span className="font-semibold text-text-primary">
                          {businessData.privateDinner.count}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Avg Revenue</span>
                        <span className="font-semibold text-text-primary">
                          {formatCurrency(businessData.privateDinner.avgRevenue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Total Cost</span>
                        <span className="font-semibold text-text-primary">
                          {formatCurrency(businessData.privateDinner.cost)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2 ">
                        <span className="font-medium text-text-primary">
                          Profit
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(businessData.privateDinner.profit)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Profit Margin</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {businessData.privateDinner.margin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buffet Catering */}
                <div className="rounded-lg border border-border bg-card p-6  ">
                  <h4 className="mb-4 text-lg font-semibold text-text-primary">
                    Buffet Catering
                  </h4>
                  <div className="space-y-3">
                    <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/20">
                      <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                        Total Revenue
                      </p>
                      <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(businessData.buffet.revenue)}
                      </p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Events</span>
                        <span className="font-semibold text-text-primary">
                          {businessData.buffet.count}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Avg Revenue</span>
                        <span className="font-semibold text-text-primary">
                          {formatCurrency(businessData.buffet.avgRevenue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Total Cost</span>
                        <span className="font-semibold text-text-primary">
                          {formatCurrency(businessData.buffet.cost)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2 ">
                        <span className="font-medium text-text-primary">
                          Profit
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(businessData.buffet.profit)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Profit Margin</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {businessData.buffet.margin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Type Comparison */}
              {businessData.privateDinner.count > 0 && businessData.buffet.count > 0 && (
                <div className="mt-6 rounded-lg border border-border bg-card-elevated p-6">
                  <h4 className="mb-4 text-sm font-semibold text-text-primary">
                    Event Type Distribution
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-text-secondary">Private Dinner</span>
                        <span className="font-medium text-text-primary">
                          {(
                            (businessData.privateDinner.count / businessData.eventCount) *
                            100
                          ).toFixed(1)}
                          % ({businessData.privateDinner.count} events)
                        </span>
                      </div>
                      <div className="h-4 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                          style={{
                            width: `${
                              (businessData.privateDinner.count / businessData.eventCount) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-text-secondary">Buffet Catering</span>
                        <span className="font-medium text-text-primary">
                          {((businessData.buffet.count / businessData.eventCount) * 100).toFixed(
                            1
                          )}
                          % ({businessData.buffet.count} events)
                        </span>
                      </div>
                      <div className="h-4 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                          style={{
                            width: `${(businessData.buffet.count / businessData.eventCount) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Booking Status Overview */}
            <div className="rounded-lg border border-border bg-card-elevated p-6">
              <h3 className="mb-4 text-xl font-semibold text-text-primary">
                Booking Status Overview
              </h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm font-medium text-text-secondary">Pending</p>
                  <p className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                    {statusBreakdown.statusCounts.pending}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Confirmed</p>
                  <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {statusBreakdown.statusCounts.confirmed}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Completed</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {statusBreakdown.statusCounts.completed}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Cancelled</p>
                  <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                    {statusBreakdown.statusCounts.cancelled}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 border-t border-border pt-4 border-border sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-text-secondary">
                    Completion Rate
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {statusBreakdown.conversionRate}%
                  </p>
                  <p className="text-xs text-text-muted">
                    {statusBreakdown.statusCounts.completed} of {statusBreakdown.total} bookings
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-secondary">
                    Cancellation Rate
                  </p>
                  <p className="mt-1 text-lg font-bold text-red-600 dark:text-red-400">
                    {statusBreakdown.cancellationRate}%
                  </p>
                  <p className="text-xs text-text-muted">
                    {statusBreakdown.statusCounts.cancelled} of {statusBreakdown.total} bookings
                  </p>
                </div>
              </div>
            </div>

            {/* Profit Distribution */}
            <div className="rounded-lg border border-border bg-card-elevated p-6">
              <h3 className="mb-4 text-xl font-semibold text-text-primary">
                Profit Distribution Summary
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-text-secondary">
                    Gross Profit (After All Costs)
                  </span>
                  <span className="font-semibold text-text-primary">
                    {formatCurrency(businessData.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-secondary">
                    Distributed to Owners ({rules.profitDistribution.ownerDistributionPercent}%)
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(businessData.totalOwnerDistribution)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 border-border">
                  <span className="text-sm font-medium text-text-secondary">
                    Business Retained ({rules.profitDistribution.businessRetainedPercent}%)
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(businessData.businessRetained)}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="mt-8 rounded-lg border border-border bg-card-elevated p-6">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Key Business Insights
              </h3>
              <div className="space-y-3 text-sm text-text-secondary">
                <div>
                  <strong className="text-text-primary">Profitability:</strong>
                  <p>
                    The business achieved a {businessData.profitMargin.toFixed(1)}% gross profit
                    margin, generating {formatCurrency(businessData.grossProfit)} in profit from{' '}
                    {formatCurrency(businessData.totalRevenue)} in revenue.
                  </p>
                </div>
                <div>
                  <strong className="text-text-primary">Event Performance:</strong>
                  <p>
                    {businessData.privateDinner.count > 0 && businessData.buffet.count > 0 ? (
                      <>
                        Private Dinner events generated{' '}
                        {formatCurrency(businessData.privateDinner.avgRevenue)} per event (
                        {businessData.privateDinner.margin.toFixed(1)}% margin) while Buffet
                        Catering averaged {formatCurrency(businessData.buffet.avgRevenue)} per event
                        ({businessData.buffet.margin.toFixed(1)}% margin).
                      </>
                    ) : businessData.privateDinner.count > 0 ? (
                      <>
                        All events were Private Dinners, averaging{' '}
                        {formatCurrency(businessData.privateDinner.avgRevenue)} per event with a{' '}
                        {businessData.privateDinner.margin.toFixed(1)}% profit margin.
                      </>
                    ) : (
                      <>
                        All events were Buffet Catering, averaging{' '}
                        {formatCurrency(businessData.buffet.avgRevenue)} per event with a{' '}
                        {businessData.buffet.margin.toFixed(1)}% profit margin.
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <strong className="text-text-primary">Cost Structure:</strong>
                  <p>
                    Food costs represent{' '}
                    {businessData.totalCost > 0
                      ? ((businessData.totalFoodCost / businessData.totalCost) * 100).toFixed(1)
                      : 0}
                    % of total costs, while labor represents{' '}
                    {businessData.totalCost > 0
                      ? ((businessData.totalLaborCost / businessData.totalCost) * 100).toFixed(1)
                      : 0}
                    %.
                  </p>
                </div>
                {statusBreakdown.total > 0 && (
                  <div>
                    <strong className="text-text-primary">Booking Metrics:</strong>
                    <p>
                      {statusBreakdown.conversionRate}% of bookings were completed, with a{' '}
                      {statusBreakdown.cancellationRate}% cancellation rate.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-card-elevated p-12 text-center">
            <p className="text-text-secondary">
              No events found for {format(parseLocalDate(startDate), 'MMM d, yyyy')} - {format(parseLocalDate(endDate), 'MMM d, yyyy')}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Create bookings in the Bookings page to see business summary data here.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-text-muted ">
          <p>
            This report is generated based on current Business Rules settings. Historical events may
            have used different rates.
          </p>
          <p className="mt-2">
            Report generated on {format(new Date(), 'PPP')} at {format(new Date(), 'p')}
          </p>
        </div>
      </div>
    </div>
  );
}

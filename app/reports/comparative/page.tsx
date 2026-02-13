'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { OwnerRole } from '@/lib/types';

// Helper to parse date strings as local dates (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface OwnerStats {
  totalLaborEarnings: number;
  totalProfitDistribution: number;
  grandTotal: number;
  eventCount: number;
  eventsWorked: number;
  averagePerEvent: number;
  roleBreakdown: Record<string, number>;
}

export default function ComparativeReportPage() {
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));

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

  // Filter bookings for selected month
  const monthBookings = useMemo(() => {
    const monthStart = startOfMonth(parseLocalDate(selectedMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);

    return bookings.filter((booking) => {
      const bookingDate = parseLocalDate(booking.eventDate);
      return (
        isWithinInterval(bookingDate, { start: monthStart, end: monthEnd }) &&
        booking.status !== 'cancelled'
      );
    });
  }, [bookings, selectedMonth]);

  // Calculate stats for a specific owner
  const calculateOwnerStats = (ownerRole: OwnerRole): OwnerStats => {
    let totalLaborEarnings = 0;
    let totalProfitDistribution = 0;
    let eventsWorked = 0;
    const roleBreakdown: Record<string, number> = {};

    monthBookings.forEach((booking) => {
      const financials = calculateEventFinancials(
        {
          adults: booking.adults,
          children: booking.children,
          eventType: booking.eventType,
          eventDate: parseLocalDate(booking.eventDate),
          distanceMiles: booking.distanceMiles,
          premiumAddOn: booking.premiumAddOn,
        },
        rules
      );

      // Find owner's labor compensation
      const ownerLabor = financials.laborCompensation.find(
        (comp) => comp.ownerRole === ownerRole
      );

      const laborPay = ownerLabor?.finalPay || 0;
      const profitShare =
        ownerRole === 'owner-a'
          ? financials.ownerADistribution
          : financials.ownerBDistribution;

      totalLaborEarnings += laborPay;
      totalProfitDistribution += profitShare;

      if (ownerLabor) {
        eventsWorked++;
        roleBreakdown[ownerLabor.role] = (roleBreakdown[ownerLabor.role] || 0) + 1;
      }
    });

    return {
      totalLaborEarnings,
      totalProfitDistribution,
      grandTotal: totalLaborEarnings + totalProfitDistribution,
      eventCount: monthBookings.length,
      eventsWorked,
      averagePerEvent:
        eventsWorked > 0 ? (totalLaborEarnings + totalProfitDistribution) / eventsWorked : 0,
      roleBreakdown,
    };
  };

  const ownerAStats = useMemo(() => calculateOwnerStats('owner-a'), [monthBookings, rules]);
  const ownerBStats = useMemo(() => calculateOwnerStats('owner-b'), [monthBookings, rules]);

  // Calculate comparison metrics
  const comparisonMetrics = useMemo(() => {
    const totalCompensation = ownerAStats.grandTotal + ownerBStats.grandTotal;
    const ownerAPercent =
      totalCompensation > 0 ? (ownerAStats.grandTotal / totalCompensation) * 100 : 0;
    const ownerBPercent =
      totalCompensation > 0 ? (ownerBStats.grandTotal / totalCompensation) * 100 : 0;

    return {
      totalCompensation,
      ownerAPercent,
      ownerBPercent,
      laborDifference: ownerAStats.totalLaborEarnings - ownerBStats.totalLaborEarnings,
      profitDifference:
        ownerAStats.totalProfitDistribution - ownerBStats.totalProfitDistribution,
      totalDifference: ownerAStats.grandTotal - ownerBStats.grandTotal,
      participationDifference: ownerAStats.eventsWorked - ownerBStats.eventsWorked,
    };
  }, [ownerAStats, ownerBStats]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header - Hide on print */}
      <div className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Comparative Owner Report
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Side-by-side comparison of owner compensation and participation
        </p>
      </div>

      {/* Filters - Hide on print */}
      <div className="mb-8 flex flex-wrap gap-4 print:hidden">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Month
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handlePrint}
            className="rounded-md bg-zinc-600 px-4 py-2 text-white hover:bg-zinc-700"
          >
            🖨️ Print Report
          </button>
        </div>
      </div>

      {/* Report Content - Print friendly */}
      <div className="space-y-8 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 print:border-0 print:shadow-none">
        {/* Print Header */}
        <div className="hidden border-b border-zinc-300 pb-6 print:block">
          <h1 className="text-3xl font-bold text-zinc-900">Hibachi A Go Go</h1>
          <h2 className="mt-2 text-xl font-semibold text-zinc-700">
            Comparative Owner Report
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-zinc-600">
            <div>
              <strong>Report Period:</strong> {format(parseLocalDate(selectedMonth + '-01'), 'MMMM yyyy')}
            </div>
            <div>
              <strong>Generated:</strong> {format(new Date(), 'PPP')}
            </div>
            <div>
              <strong>Total Events:</strong> {monthBookings.length}
            </div>
            <div>
              <strong>Total Compensation:</strong>{' '}
              {formatCurrency(comparisonMetrics.totalCompensation)}
            </div>
          </div>
        </div>

        {monthBookings.length > 0 ? (
          <>
            {/* Overall Comparison */}
            <div>
              <h3 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Total Compensation Overview
              </h3>
              <div className="space-y-4">
                {/* Owner A Bar */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      Owner A (Head Chef) - {rules.profitDistribution.ownerAEquityPercent}% Equity
                    </span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(ownerAStats.grandTotal)}
                    </span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                      style={{ width: `${comparisonMetrics.ownerAPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {comparisonMetrics.ownerAPercent.toFixed(1)}% of total compensation
                  </p>
                </div>

                {/* Owner B Bar */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      Owner B (Operations) - {rules.profitDistribution.ownerBEquityPercent}% Equity
                    </span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(ownerBStats.grandTotal)}
                    </span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                      style={{ width: `${comparisonMetrics.ownerBPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {comparisonMetrics.ownerBPercent.toFixed(1)}% of total compensation
                  </p>
                </div>

                {/* Difference */}
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Compensation Difference:
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        comparisonMetrics.totalDifference > 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {comparisonMetrics.totalDifference > 0 ? 'Owner A +' : 'Owner B +'}
                      {formatCurrency(Math.abs(comparisonMetrics.totalDifference))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Side-by-Side Stats */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Owner A Column */}
              <div className="space-y-6">
                <div className="border-b border-zinc-200 pb-4 dark:border-zinc-700">
                  <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    Owner A (Head Chef)
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {rules.profitDistribution.ownerAEquityPercent}% Equity Share
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                      Total Compensation
                    </p>
                    <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(ownerAStats.grandTotal)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-700 dark:text-zinc-300">Labor Earnings</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerAStats.totalLaborEarnings)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        Profit Distribution
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerAStats.totalProfitDistribution)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Participation
                    </p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Events Worked</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {ownerAStats.eventsWorked} / {ownerAStats.eventCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Avg per Event</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(ownerAStats.averagePerEvent)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {Object.keys(ownerAStats.roleBreakdown).length > 0 && (
                    <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Role Distribution
                      </p>
                      <div className="mt-2 space-y-1">
                        {Object.entries(ownerAStats.roleBreakdown).map(([role, count]) => (
                          <div key={role} className="flex justify-between text-sm">
                            <span className="text-zinc-600 dark:text-zinc-400">
                              {role === 'lead-chef'
                                ? 'Lead Chef'
                                : role === 'assistant-chef'
                                ? 'Assistant Chef'
                                : role}
                            </span>
                            <span className="font-medium text-zinc-900 dark:text-zinc-50">
                              {count}x
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner B Column */}
              <div className="space-y-6">
                <div className="border-b border-zinc-200 pb-4 dark:border-zinc-700">
                  <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    Owner B (Operations)
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {rules.profitDistribution.ownerBEquityPercent}% Equity Share
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                      Total Compensation
                    </p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(ownerBStats.grandTotal)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-700 dark:text-zinc-300">Labor Earnings</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerBStats.totalLaborEarnings)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        Profit Distribution
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerBStats.totalProfitDistribution)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Participation
                    </p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Events Worked</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {ownerBStats.eventsWorked} / {ownerBStats.eventCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">Avg per Event</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(ownerBStats.averagePerEvent)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {Object.keys(ownerBStats.roleBreakdown).length > 0 && (
                    <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Role Distribution
                      </p>
                      <div className="mt-2 space-y-1">
                        {Object.entries(ownerBStats.roleBreakdown).map(([role, count]) => (
                          <div key={role} className="flex justify-between text-sm">
                            <span className="text-zinc-600 dark:text-zinc-400">
                              {role === 'lead-chef'
                                ? 'Lead Chef'
                                : role === 'assistant-chef'
                                ? 'Assistant Chef'
                                : role}
                            </span>
                            <span className="font-medium text-zinc-900 dark:text-zinc-50">
                              {count}x
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detailed Comparison Table */}
            <div className="mt-8">
              <h3 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Detailed Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b-2 border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">
                        Metric
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                        Owner A
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        Owner B
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                        Difference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        Labor Earnings
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerAStats.totalLaborEarnings)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerBStats.totalLaborEarnings)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {comparisonMetrics.laborDifference >= 0 ? '+' : ''}
                        {formatCurrency(comparisonMetrics.laborDifference)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        Profit Distribution
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerAStats.totalProfitDistribution)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerBStats.totalProfitDistribution)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {comparisonMetrics.profitDifference >= 0 ? '+' : ''}
                        {formatCurrency(comparisonMetrics.profitDifference)}
                      </td>
                    </tr>
                    <tr className="bg-zinc-50 font-semibold dark:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                        Total Compensation
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
                        {formatCurrency(ownerAStats.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(ownerBStats.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {comparisonMetrics.totalDifference >= 0 ? '+' : ''}
                        {formatCurrency(comparisonMetrics.totalDifference)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        Events Worked
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {ownerAStats.eventsWorked}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {ownerBStats.eventsWorked}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {comparisonMetrics.participationDifference >= 0 ? '+' : ''}
                        {comparisonMetrics.participationDifference}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        Average per Event Worked
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerAStats.averagePerEvent)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(ownerBStats.averagePerEvent)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {ownerAStats.averagePerEvent - ownerBStats.averagePerEvent >= 0
                          ? '+'
                          : ''}
                        {formatCurrency(
                          ownerAStats.averagePerEvent - ownerBStats.averagePerEvent
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Insights */}
            <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800">
              <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Key Insights
              </h3>
              <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                <div>
                  <strong className="text-zinc-900 dark:text-zinc-50">
                    Compensation Split:
                  </strong>
                  <p>
                    Owner A received {comparisonMetrics.ownerAPercent.toFixed(1)}% of total
                    compensation while Owner B received {comparisonMetrics.ownerBPercent.toFixed(1)}%
                    . This reflects both labor participation and equity distribution.
                  </p>
                </div>
                <div>
                  <strong className="text-zinc-900 dark:text-zinc-50">
                    Participation Rates:
                  </strong>
                  <p>
                    Owner A worked {ownerAStats.eventsWorked} events (
                    {monthBookings.length > 0
                      ? ((ownerAStats.eventsWorked / monthBookings.length) * 100).toFixed(0)
                      : 0}
                    %) while Owner B worked {ownerBStats.eventsWorked} events (
                    {monthBookings.length > 0
                      ? ((ownerBStats.eventsWorked / monthBookings.length) * 100).toFixed(0)
                      : 0}
                    %) of the total {monthBookings.length} events.
                  </p>
                </div>
                <div>
                  <strong className="text-zinc-900 dark:text-zinc-50">Labor vs Profit:</strong>
                  <p>
                    Labor earnings represent working income, while profit distribution is based on
                    equity ownership. Both owners receive profit distributions regardless of
                    participation, but labor earnings depend on events worked.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">
              No events found for {format(parseLocalDate(selectedMonth + '-01'), 'MMMM yyyy')}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Create bookings in the Bookings page to see comparison data here.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
          <p>
            This report is generated based on current Money Rules settings. Historical events may
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

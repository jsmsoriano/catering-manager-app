'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { OwnerRole } from '@/lib/types';
import type { StaffMember as StaffRecord } from '@/lib/staffTypes';
import { CHEF_ROLE_TO_STAFF_ROLE, STAFF_ROLE_TO_CHEF_ROLE } from '@/lib/staffTypes';

// Helper to parse date strings as local dates (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function OwnerMonthlyReportPage() {
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [selectedOwner, setSelectedOwner] = useState<OwnerRole>('owner-a');

  // Load bookings and staff, listen for updates
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

    const loadStaff = () => {
      const saved = localStorage.getItem('staff');
      if (saved) {
        try {
          setStaffRecords(JSON.parse(saved));
        } catch { /* ignore */ }
      }
    };

    loadBookings();
    loadStaff();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bookings') loadBookings();
      if (e.key === 'staff') loadStaff();
    };

    const handleBookingsUpdate = () => loadBookings();
    const handleStaffUpdate = () => loadStaff();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bookingsUpdated', handleBookingsUpdate);
    window.addEventListener('staffUpdated', handleStaffUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingsUpdated', handleBookingsUpdate);
      window.removeEventListener('staffUpdated', handleStaffUpdate);
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

  // Build staff ID lookup for resolving assignments
  const staffById = useMemo(() => {
    const map = new Map<string, StaffRecord>();
    staffRecords.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffRecords]);

  // Build role-based owner lookup (chefRole → staff record) as fallback
  const ownerRoleLookup = useMemo(() => {
    const lookup = new Map<string, StaffRecord>();
    staffRecords
      .filter((s) => s.isOwner && s.ownerRole === selectedOwner && s.status === 'active')
      .forEach((s) => {
        const chefRole = STAFF_ROLE_TO_CHEF_ROLE[s.primaryRole];
        if (chefRole) {
          lookup.set(chefRole, s);
        }
      });
    return lookup;
  }, [staffRecords, selectedOwner]);

  const ROLE_LABELS: Record<string, string> = {
    lead: 'Lead Chef',
    overflow: 'Overflow Chef',
    full: 'Full Chef',
    buffet: 'Buffet Chef',
    assistant: 'Assistant',
  };

  // Calculate detailed compensation
  const reportData = useMemo(() => {
    let totalLaborEarnings = 0;
    let totalProfitDistribution = 0;
    const eventDetails: Array<{
      date: string;
      customer: string;
      eventType: string;
      guests: number;
      role: string;
      laborPay: number;
      profitShare: number;
      total: number;
    }> = [];

    monthBookings.forEach((booking) => {
      const { financials } = calculateBookingFinancials(booking, rules);

      // Find the owner's labor compensation entry
      let ownerLaborPay = 0;
      let ownerRole = 'N/A';
      let foundOwnerLabor = false;

      // Priority 1: Check booking.staffAssignments for the selected owner
      if (booking.staffAssignments) {
        for (let compIdx = 0; compIdx < financials.laborCompensation.length; compIdx++) {
          if (foundOwnerLabor) break;
          const comp = financials.laborCompensation[compIdx];
          const staffRole = CHEF_ROLE_TO_STAFF_ROLE[comp.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
          if (!staffRole) continue;

          // Count same-role positions before this index
          let sameRoleIndex = 0;
          for (let i = 0; i < compIdx; i++) {
            if (financials.laborCompensation[i].role === comp.role) sameRoleIndex++;
          }

          // Find the nth assignment matching this role
          let matchCount = 0;
          const assignment = booking.staffAssignments.find((a) => {
            if (a.role === staffRole) {
              if (matchCount === sameRoleIndex) return true;
              matchCount++;
            }
            return false;
          });

          if (assignment) {
            const staffRecord = staffById.get(assignment.staffId);
            if (staffRecord && staffRecord.isOwner && staffRecord.ownerRole === selectedOwner) {
              ownerLaborPay = comp.finalPay;
              ownerRole = ROLE_LABELS[comp.role] || comp.role;
              foundOwnerLabor = true;
            }
          }
        }
      }

      // Priority 2: Fallback to role-based owner matching
      if (!foundOwnerLabor) {
        for (const comp of financials.laborCompensation) {
          const ownerStaff = ownerRoleLookup.get(comp.role);
          if (ownerStaff) {
            ownerLaborPay = comp.finalPay;
            ownerRole = ROLE_LABELS[comp.role] || comp.role;
            foundOwnerLabor = true;
            break;
          }
        }
      }

      const profitShare =
        selectedOwner === 'owner-a'
          ? financials.ownerADistribution
          : financials.ownerBDistribution;

      totalLaborEarnings += ownerLaborPay;
      totalProfitDistribution += profitShare;

      eventDetails.push({
        date: booking.eventDate,
        customer: booking.customerName,
        eventType:
          booking.eventType === 'private-dinner' ? 'Private Dinner' : 'Buffet Catering',
        guests: booking.adults + booking.children,
        role: ownerRole,
        laborPay: ownerLaborPay,
        profitShare,
        total: ownerLaborPay + profitShare,
      });
    });

    return {
      totalLaborEarnings,
      totalProfitDistribution,
      grandTotal: totalLaborEarnings + totalProfitDistribution,
      eventDetails,
      eventCount: monthBookings.length,
      averagePerEvent:
        monthBookings.length > 0
          ? (totalLaborEarnings + totalProfitDistribution) / monthBookings.length
          : 0,
    };
  }, [monthBookings, rules, selectedOwner, staffById, ownerRoleLookup]);

  const handlePrint = () => {
    window.print();
  };

  const ownerName = selectedOwner === 'owner-a' ? 'Owner A (Head Chef)' : 'Owner B (Assistant/Operations)';
  const equityPercent =
    selectedOwner === 'owner-a'
      ? rules.profitDistribution.ownerAEquityPercent
      : rules.profitDistribution.ownerBEquityPercent;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header - Hide on print */}
      <div className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Owner Distribution Summary
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Detailed breakdown of labor earnings and profit distributions
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
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Owner
          </label>
          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value as OwnerRole)}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="owner-a">Owner A (Head Chef - {rules.profitDistribution.ownerAEquityPercent}%)</option>
            <option value="owner-b">Owner B (Operations - {rules.profitDistribution.ownerBEquityPercent}%)</option>
          </select>
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
            Owner Distribution Summary
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-zinc-600">
            <div>
              <strong>Report Period:</strong> {format(parseLocalDate(selectedMonth + '-01'), 'MMMM yyyy')}
            </div>
            <div>
              <strong>Owner:</strong> {ownerName}
            </div>
            <div>
              <strong>Generated:</strong> {format(new Date(), 'PPP')}
            </div>
            <div>
              <strong>Equity Share:</strong> {equityPercent}%
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20 print:border-blue-300">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Total Labor Earnings
            </h3>
            <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(reportData.totalLaborEarnings)}
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              From {reportData.eventCount} events worked
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20 print:border-emerald-300">
            <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
              Profit Distribution
            </h3>
            <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(reportData.totalProfitDistribution)}
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              {equityPercent}% equity share
            </p>
          </div>

          <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-900 dark:bg-purple-950/20 print:border-purple-300">
            <h3 className="text-sm font-medium text-purple-900 dark:text-purple-200">
              Total Compensation
            </h3>
            <p className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(reportData.grandTotal)}
            </p>
            <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
              {formatCurrency(reportData.averagePerEvent)} avg/event
            </p>
          </div>
        </div>

        {/* Event-by-Event Breakdown */}
        {reportData.eventDetails.length > 0 ? (
          <div className="mt-8">
            <h3 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Event-by-Event Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b-2 border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">
                      Date
                    </th>
                    <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">
                      Customer
                    </th>
                    <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                      Guests
                    </th>
                    <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">
                      Role
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                      Labor Pay
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                      Profit Share
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {reportData.eventDetails.map((event, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                        {format(parseLocalDate(event.date), 'MMM d')}
                      </td>
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                        {event.customer}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {event.eventType}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                        {event.guests}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {event.role}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(event.laborPay)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(event.profitShare)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(event.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-zinc-300 bg-zinc-100 font-semibold dark:border-zinc-700 dark:bg-zinc-800">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50"
                    >
                      Totals:
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(reportData.totalLaborEarnings)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(reportData.totalProfitDistribution)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(reportData.grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-zinc-600 dark:text-zinc-400">
              No events found for {format(parseLocalDate(selectedMonth + '-01'), 'MMMM yyyy')}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Create bookings in the Bookings page to see compensation data here.
            </p>
          </div>
        )}

        {/* Profit Distribution Explanation */}
        {reportData.eventDetails.length > 0 && (
          <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              How Your Compensation is Calculated
            </h3>
            <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
              <div>
                <strong className="text-zinc-900 dark:text-zinc-50">Labor Earnings:</strong>
                <p>
                  As a working chef/staff member, you earn a percentage of each event's revenue plus
                  your share of gratuity. This varies by your role (lead chef, assistant, etc.) and
                  is subject to caps configured in Business Rules.
                </p>
              </div>
              <div>
                <strong className="text-zinc-900 dark:text-zinc-50">Profit Distribution:</strong>
                <p>
                  As a {equityPercent}% owner, you receive your equity share of monthly profits.
                  Profits are calculated after all costs (food, labor, supplies) are paid. The
                  business retains {rules.profitDistribution.businessRetainedPercent}% for reserves,
                  and the remaining {rules.profitDistribution.ownerDistributionPercent}% is
                  distributed to owners based on equity.
                </p>
              </div>
              <div className="border-t border-zinc-300 pt-3 dark:border-zinc-600">
                <strong className="text-zinc-900 dark:text-zinc-50">Total Compensation</strong> =
                Labor Earnings (as worker) + Profit Distribution (as owner)
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
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

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
import type {
  OwnerProfitPayoutRecord,
  RetainedEarningsTransaction,
  RetainedEarningsTransactionType,
} from '@/lib/financeTypes';
import {
  loadOwnerProfitPayouts,
  saveOwnerProfitPayouts,
  loadRetainedEarningsTransactions,
  saveRetainedEarningsTransactions,
} from '@/lib/financeStorage';

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
  const [ownerProfitPayouts, setOwnerProfitPayouts] = useState<OwnerProfitPayoutRecord[]>([]);
  const [retainedTransactions, setRetainedTransactions] = useState<RetainedEarningsTransaction[]>([]);
  const [profitPayoutForm, setProfitPayoutForm] = useState({
    ownerRole: 'owner-a' as OwnerRole,
    amount: '',
    payoutDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [retainedForm, setRetainedForm] = useState({
    type: 'withdrawal' as RetainedEarningsTransactionType,
    amount: '',
    transactionDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

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

  useEffect(() => {
    const loadPayouts = () => {
      setOwnerProfitPayouts(loadOwnerProfitPayouts());
    };
    const loadRetained = () => {
      setRetainedTransactions(loadRetainedEarningsTransactions());
    };

    loadPayouts();
    loadRetained();

    window.addEventListener('ownerProfitPayoutsUpdated', loadPayouts);
    window.addEventListener('retainedEarningsUpdated', loadRetained);

    return () => {
      window.removeEventListener('ownerProfitPayoutsUpdated', loadPayouts);
      window.removeEventListener('retainedEarningsUpdated', loadRetained);
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

  const selectedMonthRange = useMemo(() => {
    const start = startOfMonth(parseLocalDate(selectedMonth + '-01'));
    const end = endOfMonth(start);
    return { start, end };
  }, [selectedMonth]);

  const profitTrackerData = useMemo(() => {
    const completedBookings = bookings.filter((booking) => booking.status === 'completed');

    let ownerAEarnedLifetime = 0;
    let ownerBEarnedLifetime = 0;
    let retainedEarnedLifetime = 0;
    let grossProfitLifetime = 0;

    let ownerAEarnedMonth = 0;
    let ownerBEarnedMonth = 0;
    let retainedEarnedMonth = 0;
    let grossProfitMonth = 0;

    completedBookings.forEach((booking) => {
      const { financials } = calculateBookingFinancials(booking, rules);
      ownerAEarnedLifetime += financials.ownerADistribution;
      ownerBEarnedLifetime += financials.ownerBDistribution;
      retainedEarnedLifetime += financials.retainedAmount;
      grossProfitLifetime += financials.grossProfit;

      const bookingDate = parseLocalDate(booking.eventDate);
      if (isWithinInterval(bookingDate, selectedMonthRange)) {
        ownerAEarnedMonth += financials.ownerADistribution;
        ownerBEarnedMonth += financials.ownerBDistribution;
        retainedEarnedMonth += financials.retainedAmount;
        grossProfitMonth += financials.grossProfit;
      }
    });

    const payoutTotals = ownerProfitPayouts.reduce(
      (acc, payout) => {
        const amount = payout.amount;
        if (payout.ownerRole === 'owner-a') acc.ownerALifetime += amount;
        else acc.ownerBLifetime += amount;

        const payoutDate = parseLocalDate(payout.payoutDate);
        if (isWithinInterval(payoutDate, selectedMonthRange)) {
          if (payout.ownerRole === 'owner-a') acc.ownerAMonth += amount;
          else acc.ownerBMonth += amount;
        }
        return acc;
      },
      { ownerALifetime: 0, ownerBLifetime: 0, ownerAMonth: 0, ownerBMonth: 0 }
    );

    const retainedTotals = retainedTransactions.reduce(
      (acc, tx) => {
        if (tx.type === 'deposit') acc.lifetimeDeposits += tx.amount;
        else acc.lifetimeWithdrawals += tx.amount;

        const txDate = parseLocalDate(tx.transactionDate);
        if (isWithinInterval(txDate, selectedMonthRange)) {
          if (tx.type === 'deposit') acc.monthDeposits += tx.amount;
          else acc.monthWithdrawals += tx.amount;
        }
        return acc;
      },
      { lifetimeDeposits: 0, lifetimeWithdrawals: 0, monthDeposits: 0, monthWithdrawals: 0 }
    );

    return {
      ownerAEarnedLifetime,
      ownerBEarnedLifetime,
      retainedEarnedLifetime,
      grossProfitLifetime,
      ownerAEarnedMonth,
      ownerBEarnedMonth,
      retainedEarnedMonth,
      grossProfitMonth,
      ownerAPaidLifetime: payoutTotals.ownerALifetime,
      ownerBPaidLifetime: payoutTotals.ownerBLifetime,
      ownerAPaidMonth: payoutTotals.ownerAMonth,
      ownerBPaidMonth: payoutTotals.ownerBMonth,
      ownerAOutstandingLifetime: ownerAEarnedLifetime - payoutTotals.ownerALifetime,
      ownerBOutstandingLifetime: ownerBEarnedLifetime - payoutTotals.ownerBLifetime,
      ownerAOutstandingMonth: ownerAEarnedMonth - payoutTotals.ownerAMonth,
      ownerBOutstandingMonth: ownerBEarnedMonth - payoutTotals.ownerBMonth,
      retainedManualDepositsLifetime: retainedTotals.lifetimeDeposits,
      retainedManualWithdrawalsLifetime: retainedTotals.lifetimeWithdrawals,
      retainedManualDepositsMonth: retainedTotals.monthDeposits,
      retainedManualWithdrawalsMonth: retainedTotals.monthWithdrawals,
      retainedExpectedBalanceLifetime:
        retainedEarnedLifetime + retainedTotals.lifetimeDeposits - retainedTotals.lifetimeWithdrawals,
      retainedExpectedBalanceMonth:
        retainedEarnedMonth + retainedTotals.monthDeposits - retainedTotals.monthWithdrawals,
      completedEventCount: completedBookings.length,
      completedEventCountMonth: completedBookings.filter((booking) =>
        isWithinInterval(parseLocalDate(booking.eventDate), selectedMonthRange)
      ).length,
    };
  }, [bookings, rules, ownerProfitPayouts, retainedTransactions, selectedMonthRange]);

  const handleAddOwnerPayout = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(profitPayoutForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid payout amount greater than 0.');
      return;
    }

    const next: OwnerProfitPayoutRecord = {
      id: `owner-payout-${Date.now()}`,
      ownerRole: profitPayoutForm.ownerRole,
      amount,
      payoutDate: profitPayoutForm.payoutDate,
      notes: profitPayoutForm.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [...ownerProfitPayouts, next].sort((a, b) => a.payoutDate.localeCompare(b.payoutDate));
    setOwnerProfitPayouts(updated);
    saveOwnerProfitPayouts(updated);
    setProfitPayoutForm({
      ownerRole: profitPayoutForm.ownerRole,
      amount: '',
      payoutDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const handleAddRetainedTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(retainedForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid retained-earnings transaction amount greater than 0.');
      return;
    }

    const next: RetainedEarningsTransaction = {
      id: `retained-tx-${Date.now()}`,
      type: retainedForm.type,
      amount,
      transactionDate: retainedForm.transactionDate,
      notes: retainedForm.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [...retainedTransactions, next].sort((a, b) =>
      a.transactionDate.localeCompare(b.transactionDate)
    );
    setRetainedTransactions(updated);
    saveRetainedEarningsTransactions(updated);
    setRetainedForm({
      type: retainedForm.type,
      amount: '',
      transactionDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

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

        {/* Profit Tracker Section */}
        <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Profit Tracker
          </h3>
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            Tracks earned profit allocations from completed events versus what has been paid out to owners, plus retained earnings movements for bank reconciliation.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Owner A Outstanding (Lifetime)</p>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(profitTrackerData.ownerAOutstandingLifetime)}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Earned {formatCurrency(profitTrackerData.ownerAEarnedLifetime)} · Paid {formatCurrency(profitTrackerData.ownerAPaidLifetime)}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Owner B Outstanding (Lifetime)</p>
              <p className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(profitTrackerData.ownerBOutstandingLifetime)}
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                Earned {formatCurrency(profitTrackerData.ownerBEarnedLifetime)} · Paid {formatCurrency(profitTrackerData.ownerBPaidLifetime)}
              </p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/20">
              <p className="text-xs font-medium text-purple-800 dark:text-purple-300">Retained Expected Balance (Lifetime)</p>
              <p className="mt-1 text-xl font-bold text-purple-700 dark:text-purple-300">
                {formatCurrency(profitTrackerData.retainedExpectedBalanceLifetime)}
              </p>
              <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">
                Earned {formatCurrency(profitTrackerData.retainedEarnedLifetime)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Selected Month Snapshot</p>
              <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
                {format(parseLocalDate(selectedMonth + '-01'), 'MMMM yyyy')}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                {profitTrackerData.completedEventCountMonth} completed events
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <form onSubmit={handleAddOwnerPayout} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h4 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Record Owner Profit Payout</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Owner</label>
                  <select
                    value={profitPayoutForm.ownerRole}
                    onChange={(e) =>
                      setProfitPayoutForm({ ...profitPayoutForm, ownerRole: e.target.value as OwnerRole })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="owner-a">Owner A</option>
                    <option value="owner-b">Owner B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Payout Date</label>
                  <input
                    type="date"
                    required
                    value={profitPayoutForm.payoutDate}
                    onChange={(e) => setProfitPayoutForm({ ...profitPayoutForm, payoutDate: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={profitPayoutForm.amount}
                    onChange={(e) => setProfitPayoutForm({ ...profitPayoutForm, amount: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Notes</label>
                  <input
                    type="text"
                    value={profitPayoutForm.notes}
                    onChange={(e) => setProfitPayoutForm({ ...profitPayoutForm, notes: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    placeholder="Bank transfer reference, memo, etc."
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Save Owner Payout
              </button>
            </form>

            <form onSubmit={handleAddRetainedTransaction} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h4 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Record Retained Earnings Transaction</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Type</label>
                  <select
                    value={retainedForm.type}
                    onChange={(e) =>
                      setRetainedForm({ ...retainedForm, type: e.target.value as RetainedEarningsTransactionType })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="deposit">Deposit to retained account</option>
                    <option value="withdrawal">Withdrawal from retained account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Transaction Date</label>
                  <input
                    type="date"
                    required
                    value={retainedForm.transactionDate}
                    onChange={(e) => setRetainedForm({ ...retainedForm, transactionDate: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={retainedForm.amount}
                    onChange={(e) => setRetainedForm({ ...retainedForm, amount: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Notes</label>
                  <input
                    type="text"
                    value={retainedForm.notes}
                    onChange={(e) => setRetainedForm({ ...retainedForm, notes: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    placeholder="Reason for retained movement"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save Retained Transaction
              </button>
            </form>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h4 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Owner Profit Payout Log</h4>
              {ownerProfitPayouts.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No owner profit payouts recorded yet.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 dark:border-zinc-700">
                      <tr>
                        <th className="py-2">Date</th>
                        <th className="py-2">Owner</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {ownerProfitPayouts
                        .slice()
                        .reverse()
                        .map((payout) => (
                          <tr key={payout.id}>
                            <td className="py-2">{format(parseLocalDate(payout.payoutDate), 'MMM d, yyyy')}</td>
                            <td className="py-2">{payout.ownerRole === 'owner-a' ? 'Owner A' : 'Owner B'}</td>
                            <td className="py-2 text-right font-medium">{formatCurrency(payout.amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h4 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">Retained Earnings Transaction Log</h4>
              {retainedTransactions.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No retained earnings transactions recorded yet.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 dark:border-zinc-700">
                      <tr>
                        <th className="py-2">Date</th>
                        <th className="py-2">Type</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {retainedTransactions
                        .slice()
                        .reverse()
                        .map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2">{format(parseLocalDate(tx.transactionDate), 'MMM d, yyyy')}</td>
                            <td className="py-2">{tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</td>
                            <td className="py-2 text-right font-medium">{formatCurrency(tx.amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

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

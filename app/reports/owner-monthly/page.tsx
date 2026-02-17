'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { endOfMonth, format, isWithinInterval, startOfMonth } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking, BookingStatus } from '@/lib/bookingTypes';
import type {
  DistributionStatus,
  ProfitDistributionOverride,
  RetainedEarningsTransaction,
} from '@/lib/financeTypes';
import {
  PROFIT_DISTRIBUTION_OVERRIDES_KEY,
  RETAINED_EARNINGS_KEY,
  loadProfitDistributionOverrides,
  saveProfitDistributionOverrides,
  loadRetainedEarningsTransactions,
} from '@/lib/financeStorage';

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const STATUS_BADGE: Record<BookingStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-card-elevated text-text-primary',
};

const DISTRIBUTION_STATUS_BADGE: Record<DistributionStatus, string> = {
  draft: 'bg-card-elevated text-text-primary',
  posted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const DISTRIBUTION_STATUS_LABEL: Record<DistributionStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
  paid: 'Paid',
};

interface DistributionRow {
  bookingId: string;
  eventDate: string;
  eventTime: string;
  customerName: string;
  eventType: 'private-dinner' | 'buffet';
  bookingStatus: BookingStatus;
  distributionStatus: DistributionStatus;
  guests: number;
  autoTotalProfit: number;
  autoChefPayouts: number;
  autoOwnerAPayout: number;
  autoOwnerBPayout: number;
  autoRetainedEarnings: number;
  appliedChefPayouts: number;
  appliedOwnerAPayout: number;
  appliedOwnerBPayout: number;
  appliedRetainedEarnings: number;
  appliedTotalProfit: number;
  chefPayoutEdited: boolean;
  ownerAPayoutEdited: boolean;
  ownerBPayoutEdited: boolean;
  retainedEarningsEdited: boolean;
  notes?: string;
}

interface DistributionSummary {
  eventCount: number;
  totalProfitEarned: number;
  totalProfitRecorded: number;
  chefEarned: number;
  chefRecorded: number;
  ownerAEarned: number;
  ownerARecorded: number;
  ownerBEarned: number;
  ownerBRecorded: number;
  retainedEarned: number;
  retainedRecorded: number;
}

interface RetainedLogRow {
  id: string;
  date: string;
  source: 'event-distribution' | 'manual';
  bookingId?: string;
  eventLabel: string;
  amount: number;
  notes?: string;
}

function buildSummary(rows: DistributionRow[]): DistributionSummary {
  return rows.reduce<DistributionSummary>(
    (acc, row) => {
      acc.eventCount += 1;
      acc.totalProfitEarned += row.autoTotalProfit;
      acc.totalProfitRecorded += row.appliedTotalProfit;
      acc.chefEarned += row.autoChefPayouts;
      acc.chefRecorded += row.appliedChefPayouts;
      acc.ownerAEarned += row.autoOwnerAPayout;
      acc.ownerARecorded += row.appliedOwnerAPayout;
      acc.ownerBEarned += row.autoOwnerBPayout;
      acc.ownerBRecorded += row.appliedOwnerBPayout;
      acc.retainedEarned += row.autoRetainedEarnings;
      acc.retainedRecorded += row.appliedRetainedEarnings;
      return acc;
    },
    {
      eventCount: 0,
      totalProfitEarned: 0,
      totalProfitRecorded: 0,
      chefEarned: 0,
      chefRecorded: 0,
      ownerAEarned: 0,
      ownerARecorded: 0,
      ownerBEarned: 0,
      ownerBRecorded: 0,
      retainedEarned: 0,
      retainedRecorded: 0,
    }
  );
}

export default function OwnerMonthlyReportPage() {
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [overrides, setOverrides] = useState<ProfitDistributionOverride[]>([]);
  const [retainedTransactions, setRetainedTransactions] = useState<RetainedEarningsTransaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const [editingRow, setEditingRow] = useState<DistributionRow | null>(null);
  const [editForm, setEditForm] = useState({
    chefPayouts: '',
    ownerAPayout: '',
    ownerBPayout: '',
    retainedEarnings: '',
    distributionStatus: 'draft' as DistributionStatus,
    notes: '',
  });

  useEffect(() => {
    const loadBookings = () => {
      const saved = localStorage.getItem('bookings');
      if (!saved) {
        setBookings([]);
        return;
      }
      try {
        setBookings(JSON.parse(saved));
      } catch {
        setBookings([]);
      }
    };

    loadBookings();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'bookings') loadBookings();
    };
    const handleCustom = () => loadBookings();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('bookingsUpdated', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bookingsUpdated', handleCustom);
    };
  }, []);

  useEffect(() => {
    const loadOverrides = () => setOverrides(loadProfitDistributionOverrides());
    loadOverrides();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === PROFIT_DISTRIBUTION_OVERRIDES_KEY) loadOverrides();
    };
    const handleCustom = () => loadOverrides();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('profitDistributionOverridesUpdated', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('profitDistributionOverridesUpdated', handleCustom);
    };
  }, []);

  useEffect(() => {
    const loadRetained = () => setRetainedTransactions(loadRetainedEarningsTransactions());
    loadRetained();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === RETAINED_EARNINGS_KEY) loadRetained();
    };
    const handleCustom = () => loadRetained();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('retainedEarningsUpdated', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('retainedEarningsUpdated', handleCustom);
    };
  }, []);

  const selectedMonthRange = useMemo(() => {
    const start = startOfMonth(parseLocalDate(`${selectedMonth}-01`));
    const end = endOfMonth(start);
    return { start, end };
  }, [selectedMonth]);

  const monthRows = useMemo(() => {
    const overrideByBookingId = new Map(overrides.map((override) => [override.bookingId, override]));

    return bookings
      .filter((booking) => booking.status !== 'cancelled')
      .filter((booking) => isWithinInterval(parseLocalDate(booking.eventDate), selectedMonthRange))
      .map((booking) => {
        const { financials } = calculateBookingFinancials(booking, rules);
        const override = overrideByBookingId.get(booking.id);

        const appliedChefPayouts = override?.chefPayouts ?? financials.totalLaborPaid;
        const appliedOwnerAPayout = override?.ownerAPayout ?? financials.ownerADistribution;
        const appliedOwnerBPayout = override?.ownerBPayout ?? financials.ownerBDistribution;
        const appliedRetainedEarnings = override?.retainedEarnings ?? financials.retainedAmount;
        const distributionStatus = override?.distributionStatus ?? 'draft';

        return {
          bookingId: booking.id,
          eventDate: booking.eventDate,
          eventTime: booking.eventTime,
          customerName: booking.customerName,
          eventType: booking.eventType,
          bookingStatus: booking.status,
          distributionStatus,
          guests: booking.adults + booking.children,
          autoTotalProfit: financials.grossProfit,
          autoChefPayouts: financials.totalLaborPaid,
          autoOwnerAPayout: financials.ownerADistribution,
          autoOwnerBPayout: financials.ownerBDistribution,
          autoRetainedEarnings: financials.retainedAmount,
          appliedChefPayouts,
          appliedOwnerAPayout,
          appliedOwnerBPayout,
          appliedRetainedEarnings,
          appliedTotalProfit: appliedOwnerAPayout + appliedOwnerBPayout + appliedRetainedEarnings,
          chefPayoutEdited: Math.abs(appliedChefPayouts - financials.totalLaborPaid) > 0.009,
          ownerAPayoutEdited: Math.abs(appliedOwnerAPayout - financials.ownerADistribution) > 0.009,
          ownerBPayoutEdited: Math.abs(appliedOwnerBPayout - financials.ownerBDistribution) > 0.009,
          retainedEarningsEdited: Math.abs(appliedRetainedEarnings - financials.retainedAmount) > 0.009,
          notes: override?.notes,
        } satisfies DistributionRow;
      })
      .sort((a, b) => {
        const aKey = `${a.eventDate}T${a.eventTime}`;
        const bKey = `${b.eventDate}T${b.eventTime}`;
        return aKey.localeCompare(bKey);
      });
  }, [bookings, overrides, rules, selectedMonthRange]);

  const completedRows = useMemo(
    () => monthRows.filter((row) => row.bookingStatus === 'completed'),
    [monthRows]
  );

  const summary = useMemo(() => buildSummary(completedRows), [completedRows]);

  const retainedLogRows = useMemo(() => {
    const eventRows: RetainedLogRow[] = completedRows.map((row) => ({
      id: `event-${row.bookingId}`,
      date: row.eventDate,
      source: 'event-distribution',
      bookingId: row.bookingId,
      eventLabel: `${row.customerName} (${format(parseLocalDate(row.eventDate), 'MMM d')})`,
      amount: row.appliedRetainedEarnings,
      notes: row.notes,
    }));

    const manualRows: RetainedLogRow[] = retainedTransactions
      .filter((tx) => isWithinInterval(parseLocalDate(tx.transactionDate), selectedMonthRange))
      .map((tx) => ({
        id: `manual-${tx.id}`,
        date: tx.transactionDate,
        source: 'manual',
        eventLabel: tx.type === 'deposit' ? 'Manual deposit' : 'Manual withdrawal',
        amount: tx.type === 'deposit' ? tx.amount : -tx.amount,
        notes: tx.notes,
      }));

    return [...eventRows, ...manualRows].sort((a, b) => {
      if (a.date === b.date) return a.id.localeCompare(b.id);
      return b.date.localeCompare(a.date);
    });
  }, [completedRows, retainedTransactions, selectedMonthRange]);

  const openEditModal = (row: DistributionRow) => {
    setEditingRow(row);
    setEditForm({
      chefPayouts: row.appliedChefPayouts.toFixed(2),
      ownerAPayout: row.appliedOwnerAPayout.toFixed(2),
      ownerBPayout: row.appliedOwnerBPayout.toFixed(2),
      retainedEarnings: row.appliedRetainedEarnings.toFixed(2),
      distributionStatus: row.distributionStatus,
      notes: row.notes ?? '',
    });
  };

  const closeEditModal = () => {
    setEditingRow(null);
    setEditForm({
      chefPayouts: '',
      ownerAPayout: '',
      ownerBPayout: '',
      retainedEarnings: '',
      distributionStatus: 'draft',
      notes: '',
    });
  };

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    const chefPayouts = parseFloat(editForm.chefPayouts);
    const ownerAPayout = parseFloat(editForm.ownerAPayout);
    const ownerBPayout = parseFloat(editForm.ownerBPayout);
    const retainedEarnings = parseFloat(editForm.retainedEarnings);

    const values = [chefPayouts, ownerAPayout, ownerBPayout, retainedEarnings];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      alert('All payout fields must be valid numbers greater than or equal to 0.');
      return;
    }

    const nextOverride: ProfitDistributionOverride = {
      id: `distribution-${editingRow.bookingId}`,
      bookingId: editingRow.bookingId,
      chefPayouts,
      ownerAPayout,
      ownerBPayout,
      retainedEarnings,
      distributionStatus: editForm.distributionStatus,
      notes: editForm.notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = overrides.findIndex((override) => override.bookingId === editingRow.bookingId);
    const updated = [...overrides];
    if (existingIdx >= 0) updated[existingIdx] = nextOverride;
    else updated.push(nextOverride);

    setOverrides(updated);
    saveProfitDistributionOverrides(updated);
    closeEditModal();
  };

  const handleResetToAutomatic = () => {
    if (!editingRow) return;
    const updated = overrides.filter((override) => override.bookingId !== editingRow.bookingId);
    setOverrides(updated);
    saveProfitDistributionOverrides(updated);
    closeEditModal();
  };

  const handlePrint = () => window.print();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-text-primary">
          Owner Profit Distribution
        </h1>
        <p className="mt-2 text-text-secondary">
          Automatic distributions use your preset percentages. Edit any event row when reconciliation
          needs a one-off adjustment.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 print:hidden">
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            Report Month
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="mt-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
          />
        </div>
        <button
          onClick={handlePrint}
          className="rounded-md bg-card-elevated px-4 py-2 text-text-primary hover:bg-card"
        >
          Print
        </button>
        <Link
          href="/bookings"
          className="rounded-md bg-accent px-4 py-2 text-white hover:bg-indigo-700"
        >
          View Bookings
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm dark:border-indigo-900 dark:bg-indigo-950/20">
        <p className="font-semibold text-indigo-900 dark:text-indigo-200">Preset Distribution Rules</p>
        <p className="mt-1 text-indigo-800 dark:text-indigo-300">
          Owner pool: {rules.profitDistribution.ownerDistributionPercent}% of gross profit →
          {' '}Owner A {rules.profitDistribution.ownerAEquityPercent}% / Owner B {rules.profitDistribution.ownerBEquityPercent}%.
          {' '}Retained earnings: {rules.profitDistribution.businessRetainedPercent}% of gross profit.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Total Profit</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(summary.totalProfitRecorded)}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            auto {formatCurrency(summary.totalProfitEarned)}
          </p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Total Chef Payouts</p>
          <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">
            {formatCurrency(summary.chefRecorded)}
          </p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
            auto {formatCurrency(summary.chefEarned)}
          </p>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-5 dark:border-purple-900 dark:bg-purple-950/20">
          <p className="text-sm font-medium text-purple-900 dark:text-purple-200">Total Retained Earnings</p>
          <p className="mt-2 text-2xl font-bold text-purple-700 dark:text-purple-300">
            {formatCurrency(summary.retainedRecorded)}
          </p>
          <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">
            auto {formatCurrency(summary.retainedEarned)}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Total Events Completed</p>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">
            {summary.eventCount}
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            {format(parseLocalDate(`${selectedMonth}-01`), 'MMMM yyyy')}
          </p>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 ">
          <h2 className="text-lg font-semibold text-text-primary">Distribution Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-elevated">
              <tr className="border-b border-border ">
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 text-right font-semibold">Events Completed</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Profit (Earned / Recorded)</th>
                <th className="px-4 py-3 text-right font-semibold">Chef (Earned / Recorded)</th>
                <th className="px-4 py-3 text-right font-semibold">Owner A (Earned / Recorded)</th>
                <th className="px-4 py-3 text-right font-semibold">Owner B (Earned / Recorded)</th>
                <th className="px-4 py-3 text-right font-semibold">Retained (Earned / Recorded)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-3 font-medium text-text-primary">
                  {format(parseLocalDate(`${selectedMonth}-01`), 'MMMM yyyy')}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">{summary.eventCount}</td>
                <td className="px-4 py-3 text-right text-text-secondary">
                  {formatCurrency(summary.totalProfitEarned)} / {formatCurrency(summary.totalProfitRecorded)}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">
                  {formatCurrency(summary.chefEarned)} / {formatCurrency(summary.chefRecorded)}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">
                  {formatCurrency(summary.ownerAEarned)} / {formatCurrency(summary.ownerARecorded)}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">
                  {formatCurrency(summary.ownerBEarned)} / {formatCurrency(summary.ownerBRecorded)}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">
                  {formatCurrency(summary.retainedEarned)} / {formatCurrency(summary.retainedRecorded)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 ">
          <h2 className="text-lg font-semibold text-text-primary">
            Event Payouts Summary
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Event status tracks operations; distribution status tracks accounting progress (Draft,
            Posted, Paid).
          </p>
        </div>
        {monthRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            No events found in {format(parseLocalDate(`${selectedMonth}-01`), 'MMMM yyyy')}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-card-elevated">
                <tr className="border-b border-border ">
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 text-right font-semibold">Guests</th>
                  <th className="px-4 py-3 text-center font-semibold">Event Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Distribution</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Profit</th>
                  <th className="px-4 py-3 text-right font-semibold">Chef Payouts</th>
                  <th className="px-4 py-3 text-right font-semibold">Owner A</th>
                  <th className="px-4 py-3 text-right font-semibold">Owner B</th>
                  <th className="px-4 py-3 text-right font-semibold">Retained Earnings</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthRows.map((row) => (
                  <tr key={row.bookingId}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/bookings?bookingId=${row.bookingId}`}
                        className="font-medium text-accent hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        {row.customerName}
                      </Link>
                      <div className="text-xs text-text-muted">
                        {format(parseLocalDate(row.eventDate), 'MMM d, yyyy')} at {row.eventTime} ·{' '}
                        {row.eventType === 'private-dinner' ? 'Private Dinner' : 'Buffet'} · {row.guests}{' '}
                        guests
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {row.guests}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${STATUS_BADGE[row.bookingStatus]}`}>
                        {row.bookingStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          DISTRIBUTION_STATUS_BADGE[row.distributionStatus]
                        }`}
                      >
                        {DISTRIBUTION_STATUS_LABEL[row.distributionStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(row.appliedTotalProfit)}
                      {Math.abs(row.appliedTotalProfit - row.autoTotalProfit) > 0.009 && (
                        <div className="text-xs text-text-muted">
                          auto {formatCurrency(row.autoTotalProfit)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(row.appliedChefPayouts)}
                      {row.chefPayoutEdited && (
                        <div className="text-xs text-text-muted">
                          auto {formatCurrency(row.autoChefPayouts)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(row.appliedOwnerAPayout)}
                      {row.ownerAPayoutEdited && (
                        <div className="text-xs text-text-muted">
                          auto {formatCurrency(row.autoOwnerAPayout)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(row.appliedOwnerBPayout)}
                      {row.ownerBPayoutEdited && (
                        <div className="text-xs text-text-muted">
                          auto {formatCurrency(row.autoOwnerBPayout)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(row.appliedRetainedEarnings)}
                      {row.retainedEarningsEdited && (
                        <div className="text-xs text-text-muted">
                          auto {formatCurrency(row.autoRetainedEarnings)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(row)}
                        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 ">
          <h2 className="text-lg font-semibold text-text-primary">
            Retained Earnings Transaction Log
          </h2>
        </div>
        {retainedLogRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            No retained earnings transactions for this month.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-card-elevated">
                <tr className="border-b border-border ">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {retainedLogRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-text-secondary">
                      {format(parseLocalDate(row.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.source === 'event-distribution' ? 'Event distribution' : 'Manual transaction'}
                    </td>
                    <td className="px-4 py-3">
                      {row.bookingId ? (
                        <Link
                          href={`/bookings?bookingId=${row.bookingId}`}
                          className="text-accent hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          {row.eventLabel}
                        </Link>
                      ) : (
                        <span className="text-text-secondary">{row.eventLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-text-secondary">
                      {row.amount < 0 ? '-' : ''}
                      {formatCurrency(Math.abs(row.amount))}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-text-primary">
                Manage Distribution Record
              </h3>
              <button
                onClick={closeEditModal}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-text-secondary">
              {editingRow.customerName} · {format(parseLocalDate(editingRow.eventDate), 'MMM d, yyyy')} at{' '}
              {editingRow.eventTime}
            </p>

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Distribution Status
                </label>
                <select
                  value={editForm.distributionStatus}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      distributionStatus: e.target.value as DistributionStatus,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-card-elevated"
                >
                  <option value="draft">Draft</option>
                  <option value="posted">Posted</option>
                  <option value="paid">Paid</option>
                </select>
                <p className="mt-1 text-xs text-text-muted">
                  This accounting status is independent from the event status.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Chef Payouts
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.chefPayouts}
                    onChange={(e) => setEditForm({ ...editForm, chefPayouts: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-card-elevated"
                  />
                  <p className="mt-1 text-xs text-text-muted">Auto: {formatCurrency(editingRow.autoChefPayouts)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Owner A Payout
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.ownerAPayout}
                    onChange={(e) => setEditForm({ ...editForm, ownerAPayout: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-card-elevated"
                  />
                  <p className="mt-1 text-xs text-text-muted">Auto: {formatCurrency(editingRow.autoOwnerAPayout)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Owner B Payout
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.ownerBPayout}
                    onChange={(e) => setEditForm({ ...editForm, ownerBPayout: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-card-elevated"
                  />
                  <p className="mt-1 text-xs text-text-muted">Auto: {formatCurrency(editingRow.autoOwnerBPayout)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Retained Earnings
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.retainedEarnings}
                    onChange={(e) => setEditForm({ ...editForm, retainedEarnings: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-card-elevated"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Auto: {formatCurrency(editingRow.autoRetainedEarnings)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-card-elevated"
                  placeholder="Optional reconciliation note"
                />
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  onClick={handleResetToAutomatic}
                  className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary bg-card-elevated hover:bg-card"
                >
                  Reset to Auto + Draft
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary bg-card-elevated hover:bg-card"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Save Distribution
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

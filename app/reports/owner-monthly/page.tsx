'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { endOfMonth, format, isWithinInterval, startOfMonth } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { ProfitDistributionOverride } from '@/lib/financeTypes';
import {
  PROFIT_DISTRIBUTION_OVERRIDES_KEY,
  loadProfitDistributionOverrides,
  saveProfitDistributionOverrides,
} from '@/lib/financeStorage';

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface DistributionRow {
  bookingId: string;
  eventDate: string;
  eventTime: string;
  customerName: string;
  eventType: 'private-dinner' | 'buffet';
  guests: number;
  autoChefPayouts: number;
  autoOwnerAPayout: number;
  autoOwnerBPayout: number;
  autoRetainedEarnings: number;
  appliedChefPayouts: number;
  appliedOwnerAPayout: number;
  appliedOwnerBPayout: number;
  appliedRetainedEarnings: number;
  notes?: string;
  isEdited: boolean;
}

interface DistributionSnapshot {
  eventCount: number;
  chefEarned: number;
  chefRecorded: number;
  ownerAEarned: number;
  ownerARecorded: number;
  ownerBEarned: number;
  ownerBRecorded: number;
  retainedEarned: number;
  retainedRecorded: number;
}

function buildSnapshot(rows: DistributionRow[]): DistributionSnapshot {
  return rows.reduce<DistributionSnapshot>(
    (acc, row) => {
      acc.eventCount += 1;
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
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const [editingRow, setEditingRow] = useState<DistributionRow | null>(null);
  const [editForm, setEditForm] = useState({
    chefPayouts: '',
    ownerAPayout: '',
    ownerBPayout: '',
    retainedEarnings: '',
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

  const selectedMonthRange = useMemo(() => {
    const start = startOfMonth(parseLocalDate(`${selectedMonth}-01`));
    const end = endOfMonth(start);
    return { start, end };
  }, [selectedMonth]);

  const allDistributionRows = useMemo(() => {
    const overrideByBookingId = new Map(overrides.map((override) => [override.bookingId, override]));

    return bookings
      .filter((booking) => booking.status === 'completed')
      .map((booking) => {
        const { financials } = calculateBookingFinancials(booking, rules);
        const override = overrideByBookingId.get(booking.id);

        return {
          bookingId: booking.id,
          eventDate: booking.eventDate,
          eventTime: booking.eventTime,
          customerName: booking.customerName,
          eventType: booking.eventType,
          guests: booking.adults + booking.children,
          autoChefPayouts: financials.totalLaborPaid,
          autoOwnerAPayout: financials.ownerADistribution,
          autoOwnerBPayout: financials.ownerBDistribution,
          autoRetainedEarnings: financials.retainedAmount,
          appliedChefPayouts: override?.chefPayouts ?? financials.totalLaborPaid,
          appliedOwnerAPayout: override?.ownerAPayout ?? financials.ownerADistribution,
          appliedOwnerBPayout: override?.ownerBPayout ?? financials.ownerBDistribution,
          appliedRetainedEarnings: override?.retainedEarnings ?? financials.retainedAmount,
          notes: override?.notes,
          isEdited: Boolean(override),
        } satisfies DistributionRow;
      })
      .sort((a, b) => {
        const aKey = `${a.eventDate}T${a.eventTime}`;
        const bKey = `${b.eventDate}T${b.eventTime}`;
        return aKey.localeCompare(bKey);
      });
  }, [bookings, overrides, rules]);

  const monthRows = useMemo(
    () =>
      allDistributionRows.filter((row) =>
        isWithinInterval(parseLocalDate(row.eventDate), selectedMonthRange)
      ),
    [allDistributionRows, selectedMonthRange]
  );

  const summary = useMemo(
    () => ({
      month: buildSnapshot(monthRows),
      lifetime: buildSnapshot(allDistributionRows),
    }),
    [allDistributionRows, monthRows]
  );

  const openEditModal = (row: DistributionRow) => {
    setEditingRow(row);
    setEditForm({
      chefPayouts: row.appliedChefPayouts.toFixed(2),
      ownerAPayout: row.appliedOwnerAPayout.toFixed(2),
      ownerBPayout: row.appliedOwnerBPayout.toFixed(2),
      retainedEarnings: row.appliedRetainedEarnings.toFixed(2),
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
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Owner Profit Distribution
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Automatic event-level distributions based on your configured percentages. Edit any event
          record when bank reconciliation requires adjustments.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 print:hidden">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Report Month
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <button
          onClick={handlePrint}
          className="rounded-md bg-zinc-600 px-4 py-2 text-white hover:bg-zinc-700"
        >
          Print
        </button>
        <Link
          href="/bookings"
          className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          View Bookings
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm dark:border-indigo-900 dark:bg-indigo-950/20">
        <p className="font-semibold text-indigo-900 dark:text-indigo-200">Preset Distribution Rules</p>
        <p className="mt-1 text-indigo-800 dark:text-indigo-300">
          Owner pool: {rules.profitDistribution.ownerDistributionPercent}% of gross profit
          {' '}→ Owner A {rules.profitDistribution.ownerAEquityPercent}% / Owner B {rules.profitDistribution.ownerBEquityPercent}%.
          {' '}Retained earnings: {rules.profitDistribution.businessRetainedPercent}% of gross profit.
        </p>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Distribution Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 text-right font-semibold">Events</th>
                <th className="px-4 py-3 text-right font-semibold">Chef Payouts (Earned / Recorded)</th>
                <th className="px-4 py-3 text-right font-semibold">Owner A (Earned / Recorded)</th>
                <th className="px-4 py-3 text-right font-semibold">Owner B (Earned / Recorded)</th>
                <th className="px-4 py-3 text-right font-semibold">Retained (Earned / Recorded)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {[
                { label: format(parseLocalDate(`${selectedMonth}-01`), 'MMMM yyyy'), data: summary.month },
                { label: 'Lifetime', data: summary.lifetime },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{row.label}</td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{row.data.eventCount}</td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {formatCurrency(row.data.chefEarned)} / {formatCurrency(row.data.chefRecorded)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {formatCurrency(row.data.ownerAEarned)} / {formatCurrency(row.data.ownerARecorded)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {formatCurrency(row.data.ownerBEarned)} / {formatCurrency(row.data.ownerBRecorded)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {formatCurrency(row.data.retainedEarned)} / {formatCurrency(row.data.retainedRecorded)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Event-Level Profit Distribution (one record per completed event)
          </h2>
        </div>
        {monthRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No completed events in {format(parseLocalDate(`${selectedMonth}-01`), 'MMMM yyyy')}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 text-right font-semibold">Chef Payouts</th>
                  <th className="px-4 py-3 text-right font-semibold">Owner A</th>
                  <th className="px-4 py-3 text-right font-semibold">Owner B</th>
                  <th className="px-4 py-3 text-right font-semibold">Retained Earnings</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {monthRows.map((row) => (
                  <tr key={row.bookingId}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/bookings/reconcile?bookingId=${row.bookingId}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        {row.customerName}
                      </Link>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {format(parseLocalDate(row.eventDate), 'MMM d, yyyy')} at {row.eventTime} · {row.eventType === 'private-dinner' ? 'Private Dinner' : 'Buffet'} · {row.guests} guests
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(row.appliedChefPayouts)}
                      {row.isEdited && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          auto {formatCurrency(row.autoChefPayouts)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(row.appliedOwnerAPayout)}
                      {row.isEdited && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          auto {formatCurrency(row.autoOwnerAPayout)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(row.appliedOwnerBPayout)}
                      {row.isEdited && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          auto {formatCurrency(row.autoOwnerBPayout)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(row.appliedRetainedEarnings)}
                      {row.isEdited && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          auto {formatCurrency(row.autoRetainedEarnings)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          row.isEdited
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        }`}
                      >
                        {row.isEdited ? 'Edited' : 'Auto'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(row)}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Edit Profit Distribution Record
              </h3>
              <button
                onClick={closeEditModal}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {editingRow.customerName} · {format(parseLocalDate(editingRow.eventDate), 'MMM d, yyyy')} at{' '}
              {editingRow.eventTime}
            </p>

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Chef Payouts
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.chefPayouts}
                    onChange={(e) => setEditForm({ ...editForm, chefPayouts: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Auto: {formatCurrency(editingRow.autoChefPayouts)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Owner A Payout
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.ownerAPayout}
                    onChange={(e) => setEditForm({ ...editForm, ownerAPayout: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Auto: {formatCurrency(editingRow.autoOwnerAPayout)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Owner B Payout
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.ownerBPayout}
                    onChange={(e) => setEditForm({ ...editForm, ownerBPayout: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Auto: {formatCurrency(editingRow.autoOwnerBPayout)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Retained Earnings
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.retainedEarnings}
                    onChange={(e) => setEditForm({ ...editForm, retainedEarnings: e.target.value })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Auto: {formatCurrency(editingRow.autoRetainedEarnings)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="Optional reconciliation note"
                />
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  onClick={handleResetToAutomatic}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Reset to Automatic
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { loadFromStorage } from '@/lib/storage';
import { getBookingServiceStatus, toLocalDateISO } from '@/lib/bookingWorkflow';
import type { Booking, BookingStatus } from '@/lib/bookingTypes';

const EVENT_STATUS_TEXT: Record<BookingStatus, string> = {
  pending: 'text-amber-700 dark:text-amber-300',
  confirmed: 'text-blue-700 dark:text-blue-300',
  completed: 'text-emerald-700 dark:text-emerald-300',
  cancelled: 'text-slate-600 dark:text-slate-400',
};

// ─── Invoice status ───────────────────────────────────────────────────────────

type InvoiceStatus = 'overdue' | 'outstanding' | 'partial' | 'paid' | 'draft';
type FilterTab = 'all' | 'outstanding' | 'paid' | 'draft';

function getInvoiceStatus(booking: Booking): InvoiceStatus {
  const today = toLocalDateISO(new Date());
  const balance = Math.max(0, booking.total - (booking.amountPaid ?? 0));
  if (balance <= 0 && (booking.amountPaid ?? 0) > 0) return 'paid';
  const overdue =
    (booking.paymentStatus === 'deposit-due' &&
      booking.depositDueDate != null &&
      booking.depositDueDate < today) ||
    (booking.paymentStatus === 'balance-due' &&
      booking.balanceDueDate != null &&
      booking.balanceDueDate < today);
  if (overdue) return 'overdue';
  if ((booking.amountPaid ?? 0) > 0) return 'partial';
  if (
    booking.paymentStatus === 'deposit-due' ||
    booking.paymentStatus === 'balance-due'
  )
    return 'outstanding';
  return 'draft';
}

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  overdue:     'bg-danger/10 text-danger',
  outstanding: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  partial:     'bg-info/10 text-info',
  paid:        'bg-success/10 text-success',
  draft:       'bg-card-elevated text-text-muted',
};
const STATUS_LABEL: Record<InvoiceStatus, string> = {
  overdue: 'Overdue', outstanding: 'Outstanding', partial: 'Partial',
  paid: 'Paid', draft: 'Draft',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string; // tailwind text color class
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const invoices = useMemo(() =>
    loadFromStorage<Booking[]>('bookings', []).filter(
      (b) => b.source !== 'inquiry' && getBookingServiceStatus(b) !== 'cancelled'
    ),
  []);

  const stats = useMemo(() => {
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let paidCount = 0;
    for (const b of invoices) {
      const status = getInvoiceStatus(b);
      const balance = Math.max(0, b.total - (b.amountPaid ?? 0));
      if (status !== 'paid' && status !== 'draft') totalOutstanding += balance;
      if (status === 'overdue') totalOverdue += balance;
      if (status === 'paid') paidCount++;
    }
    return { totalOutstanding, totalOverdue, paidCount };
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = invoices;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => b.customerName.toLowerCase().includes(q));
    }

    if (filter === 'outstanding') {
      list = list.filter((b) => {
        const s = getInvoiceStatus(b);
        return s === 'overdue' || s === 'outstanding' || s === 'partial';
      });
    } else if (filter === 'paid') {
      list = list.filter((b) => getInvoiceStatus(b) === 'paid');
    } else if (filter === 'draft') {
      list = list.filter((b) => getInvoiceStatus(b) === 'draft');
    }

    return [...list].sort((a, z) => z.eventDate.localeCompare(a.eventDate));
  }, [invoices, filter, search]);

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',         label: 'All' },
    { key: 'outstanding', label: 'Outstanding' },
    { key: 'paid',        label: 'Paid' },
    { key: 'draft',       label: 'Draft' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Invoices</h1>
        <p className="mt-1 text-sm text-text-muted">
          {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          {stats.totalOutstanding > 0 &&
            ` · ${formatCurrency(stats.totalOutstanding)} outstanding`}
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Invoices"
          value={invoices.length.toString()}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats.totalOutstanding)}
          accent={stats.totalOutstanding > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(stats.totalOverdue)}
          accent={stats.totalOverdue > 0 ? 'text-danger' : undefined}
        />
        <StatCard
          label="Paid"
          value={`${stats.paidCount}`}
          sub={stats.paidCount > 0 ? 'invoice' + (stats.paidCount !== 1 ? 's' : '') : undefined}
          accent="text-success"
        />
      </div>

      {/* Filters + search */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-card-elevated p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {/* Invoice table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Customer
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted sm:table-cell">
                  Event Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Balance
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Event status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Payment status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((booking) => {
                const balance = Math.max(0, booking.total - (booking.amountPaid ?? 0));
                const status = getInvoiceStatus(booking);
                return (
                  <tr key={booking.id} className="hover:bg-card-elevated/50">
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      #{booking.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{booking.customerName}</p>
                      <p className="mt-0.5 text-xs text-text-muted sm:hidden">
                        {format(new Date(booking.eventDate + 'T00:00:00'), 'MMM d, yyyy')}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                      {format(new Date(booking.eventDate + 'T00:00:00'), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text-primary">
                      {formatCurrency(balance)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${EVENT_STATUS_TEXT[getBookingServiceStatus(booking)]}`}>
                        {getBookingServiceStatus(booking).charAt(0).toUpperCase() + getBookingServiceStatus(booking).slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/invoices/${booking.id}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-card-elevated hover:text-text-primary"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm text-text-muted">
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

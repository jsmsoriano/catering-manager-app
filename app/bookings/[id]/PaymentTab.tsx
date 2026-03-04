'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/moneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { BookingFormData } from './bookingFormTypes';

interface PaymentTabProps {
  booking: Booking;
  formData: BookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>;
  saveError: string | null;
  onSave: (e: React.FormEvent) => void;
  onBack: () => void;
  defaultDepositPercent: number;
}

export function PaymentTab({
  booking,
  formData,
  setFormData,
  saveError,
  onSave,
  onBack,
  defaultDepositPercent,
}: PaymentTabProps) {
  const effectiveDepositPct = formData.depositPercent ?? defaultDepositPercent;
  const depositAmount =
    booking.depositAmount ??
    Math.round((booking.total ?? 0) * (effectiveDepositPct / 100) * 100) / 100;
  const amountPaid = booking.amountPaid ?? 0;
  const isDepositPaid = amountPaid >= depositAmount - 0.009;

  return (
    <form onSubmit={onSave} className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
      <h2 className="text-lg font-semibold text-text-primary">Payment terms</h2>
      <p className="text-sm text-text-muted">
        Set deposit and balance due dates. These can be sent with the proposal and used for payment tracking.
      </p>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-text-secondary">Deposit status</h3>
        <p className="mt-1 text-sm text-text-primary">
          {isDepositPaid ? 'Deposit Received' : 'Deposit Pending'}
        </p>
        {amountPaid > 0 && (
          <p className="mt-0.5 text-xs text-text-muted">Amount paid: {formatCurrency(amountPaid)}</p>
        )}
        {!isDepositPaid && (
          <p className="mt-2">
            <Link
              href={`/bookings?openPayment=${booking.id}`}
              className="text-sm font-medium text-accent hover:text-accent-hover hover:underline"
            >
              Record payment
            </Link>
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-text-secondary">Deposit %</label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={effectiveDepositPct}
            onChange={(e) => {
              const pct = parseFloat(e.target.value) || 0;
              const total = booking.total ?? 0;
              setFormData((p) => ({
                ...p,
                depositPercent: pct,
                depositAmount: Math.round(total * (pct / 100) * 100) / 100,
              }));
            }}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Deposit amount ($)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={formData.depositAmount ?? Math.round((booking.total ?? 0) * (effectiveDepositPct / 100) * 100) / 100}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                depositAmount: e.target.value === '' ? undefined : parseFloat(e.target.value),
              }))
            }
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
          <p className="mt-1 text-xs text-text-muted">Total: {formatCurrency(booking.total ?? 0)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Deposit due date</label>
          <input
            type="date"
            value={formData.depositDueDate}
            onChange={(e) => setFormData((p) => ({ ...p, depositDueDate: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Balance due date</label>
          <input
            type="date"
            value={formData.balanceDueDate}
            onChange={(e) => setFormData((p) => ({ ...p, balanceDueDate: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
          <p className="mt-1 text-xs text-text-muted">Often the event date: {booking.eventDate ?? '—'}</p>
        </div>
      </div>
      {saveError && <p className="text-sm text-danger">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
        >
          Back
        </button>
        <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          Save Payment Terms
        </button>
      </div>
    </form>
  );
}

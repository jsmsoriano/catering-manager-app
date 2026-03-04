'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/moneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { MenuStatus, EventTabId } from './bookingFormTypes';

interface ReviewTabProps {
  booking: Booking;
  menuStatus: MenuStatus | null;
  menuReadyForConfirmation: boolean;
  saveError: string | null;
  confirmSuccess: boolean;
  defaultDepositPercent: number;
  onBack: () => void;
  onConfirm: () => void;
  onSaveAsDraft: () => void;
  onGoToTab: (tab: EventTabId) => void;
}

export function ReviewTab({
  booking,
  menuStatus,
  menuReadyForConfirmation,
  saveError,
  confirmSuccess,
  defaultDepositPercent,
  onBack,
  onConfirm,
  onSaveAsDraft,
  onGoToTab,
}: ReviewTabProps) {
  const depositAmount =
    booking.depositAmount ??
    Math.round((booking.total ?? 0) * ((booking.depositPercent ?? defaultDepositPercent) / 100) * 100) / 100;
  const amountPaid = booking.amountPaid ?? 0;
  const paymentRecorded = amountPaid >= depositAmount - 0.009;

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
      <h2 className="text-lg font-semibold text-text-primary">Summary & Confirm</h2>

      {confirmSuccess ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-success/15 px-4 py-3 text-sm font-medium text-success">
            Event confirmed. Payment terms have been set and the booking is ready for proposals and payments.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/bookings"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Back to Events
            </Link>
            <Link
              href={`/bookings/${booking.id}`}
              className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
            >
              View booking
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            Review the details below. Save as draft to keep the event pending, or confirm once the deposit has been recorded.
          </p>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-medium text-text-primary">Contact</h3>
              <p className="mt-1 text-text-secondary">{booking.customerName} · {booking.customerEmail}</p>
              {booking.customerPhone && <p className="text-text-muted">{booking.customerPhone}</p>}
              <p className="text-text-muted">{booking.location}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-medium text-text-primary">Event details</h3>
              <p className="mt-1 text-text-secondary">
                {booking.eventDate} at {booking.eventTime} · {booking.eventType}
              </p>
              <p className="text-text-muted">
                {booking.adults} adults, {booking.children ?? 0} children · Total {formatCurrency(booking.total)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-medium text-text-primary">Payment terms</h3>
              <p className="mt-1 text-text-secondary">
                Deposit: {booking.depositPercent ?? defaultDepositPercent}% ({formatCurrency(booking.depositAmount ?? 0)})
                {booking.depositDueDate && ` · Due ${booking.depositDueDate}`}
              </p>
              <p className="text-text-muted">
                Balance due{booking.balanceDueDate ? ` ${booking.balanceDueDate}` : ' (event date)'}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-medium text-text-primary">Menu</h3>
              <p className="mt-1 text-text-secondary">
                {menuStatus?.exists
                  ? booking.eventType === 'private-dinner'
                    ? `${menuStatus.guestsDone}/${menuStatus.totalGuests} guests`
                    : `${menuStatus.itemCount} item(s)`
                  : 'No menu yet'}
              </p>
              {menuStatus?.exists && (
                <p className="mt-1 text-xs text-text-muted">
                  Approval: {menuStatus.approvalStatus ?? 'draft'}
                </p>
              )}
              {!menuReadyForConfirmation && (
                <p className="mt-1 text-xs text-warning">
                  Menu must be created and approved before confirmation.
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-medium text-text-primary">Staff</h3>
              <p className="mt-1 text-text-secondary">
                {booking.staffAssignments?.length
                  ? `${booking.staffAssignments.length} assignment(s)`
                  : 'Not assigned'}
              </p>
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
            <button
              type="button"
              onClick={onSaveAsDraft}
              className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
            >
              Save as draft
            </button>
            {paymentRecorded && menuReadyForConfirmation ? (
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Confirm Event
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onGoToTab(!menuReadyForConfirmation ? 'menu' : 'payment')}
                className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
              >
                {!menuReadyForConfirmation ? 'Complete Menu First' : 'Record Deposit First'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

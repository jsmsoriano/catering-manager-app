'use client';

import type { Booking } from '@/lib/bookingTypes';
import CRMPanel from '@/components/CRMPanel';
import { getBookingCustomerId } from '@/lib/customerIdentity';

interface CrmTabProps {
  booking: Booking;
  onContinue: () => void;
}

export function CrmTab({ booking, onContinue }: CrmTabProps) {
  return (
    <div className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
      <h2 className="text-lg font-semibold text-text-primary">Activity</h2>
      <p className="text-sm text-text-muted">
        Track follow-ups, reminders, and event-level communication history.
      </p>
      <CRMPanel
        title="Event Activity"
        bookingId={booking.id}
        customerId={getBookingCustomerId(booking)}
        scope="event"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Continue to Summary Tab
        </button>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { UsersIcon } from '@heroicons/react/24/outline';

interface StaffTabProps {
  bookingId: string;
  onBack: () => void;
}

export function StaffTab({ bookingId, onBack }: StaffTabProps) {
  return (
    <div className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
      <h2 className="text-lg font-semibold text-text-primary">Staff assignments</h2>
      <p className="text-sm text-text-muted">
        Assign staff to this event. Manage roles and pay on the staff assignment page.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/bookings/staff?bookingId=${bookingId}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card-elevated"
        >
          <UsersIcon className="h-4 w-4" />
          Manage staff assignments
        </Link>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
        >
          Back
        </button>
      </div>
    </div>
  );
}

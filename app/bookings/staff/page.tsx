'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, UsersIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { parseISO } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { getBookingServiceStatus } from '@/lib/bookingWorkflow';
import type { Booking } from '@/lib/bookingTypes';
import type { StaffMember as StaffRecord, StaffAssignment } from '@/lib/staffTypes';
import { CHEF_ROLE_TO_STAFF_ROLE } from '@/lib/staffTypes';
import type { EventFinancials } from '@/lib/types';

const CHEF_ROLE_LABELS: Record<string, string> = {
  lead: 'Lead Chef',
  full: 'Full Chef',
  buffet: 'Buffet Chef',
  assistant: 'Assistant',
};

interface StaffConflict {
  staffId: string;
  staffName: string;
  conflictingBooking: Booking;
}

function getUniqueAssignedStaffIds(assignments: StaffAssignment[] | undefined): string[] {
  if (!assignments?.length) return [];
  const seen = new Set<string>();
  return assignments.filter((a) => {
    if (seen.has(a.staffId)) return false;
    seen.add(a.staffId);
    return true;
  }).map((a) => a.staffId);
}

function findAssignmentForPosition(
  assignments: StaffAssignment[] | undefined,
  financials: EventFinancials,
  positionIndex: number
): StaffAssignment | undefined {
  if (!assignments?.length) return undefined;
  const position = financials.staffingPlan.staff[positionIndex];
  const staffRole = CHEF_ROLE_TO_STAFF_ROLE[position.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
  if (!staffRole) return undefined;
  let sameRoleIndex = 0;
  for (let i = 0; i < positionIndex; i++) {
    if (financials.staffingPlan.staff[i].role === position.role) sameRoleIndex++;
  }
  let matchCount = 0;
  return assignments.find((a) => {
    if (a.role === staffRole) {
      if (matchCount === sameRoleIndex) return true;
      matchCount++;
    }
    return false;
  });
}

function BookingStaffContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get('bookingId');
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);
  const [staffingProfileId, setStaffingProfileId] = useState<string | undefined>(undefined);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[] | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  const booking = useMemo(
    () => (bookingId ? bookings.find((b) => b.id === bookingId) ?? null : null),
    [bookings, bookingId]
  );

  useEffect(() => {
    const raw = localStorage.getItem('bookings');
    setBookings(raw ? JSON.parse(raw) : []);
    const onUpdate = () => setBookings(JSON.parse(localStorage.getItem('bookings') || '[]'));
    window.addEventListener('storage', onUpdate);
    window.addEventListener('bookingsUpdated', onUpdate);
    return () => {
      window.removeEventListener('storage', onUpdate);
      window.removeEventListener('bookingsUpdated', onUpdate);
    };
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('staff');
    setStaffRecords(raw ? JSON.parse(raw) : []);
    const onUpdate = () => setStaffRecords(JSON.parse(localStorage.getItem('staff') || '[]'));
    window.addEventListener('storage', onUpdate);
    window.addEventListener('staffUpdated', onUpdate);
    return () => {
      window.removeEventListener('storage', onUpdate);
      window.removeEventListener('staffUpdated', onUpdate);
    };
  }, []);

  useEffect(() => {
    if (booking) {
      setStaffingProfileId(booking.staffingProfileId);
      setStaffAssignments(booking.staffAssignments ? [...booking.staffAssignments] : undefined);
    }
  }, [booking?.id]);

  const financials = useMemo(() => {
    if (!booking) return null;
    const { financials: f } = calculateBookingFinancials(booking, rules);
    return f;
  }, [booking, rules]);

  const financialsWithProfile = useMemo(() => {
    if (!booking) return null;
    return calculateBookingFinancials(
      { ...booking, staffingProfileId, staffAssignments: staffAssignments ?? undefined },
      rules
    ).financials;
  }, [booking, rules, staffingProfileId, staffAssignments]);

  const staffById = useMemo(() => {
    const map = new Map<string, StaffRecord>();
    staffRecords.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffRecords]);

  const findStaffConflicts = (
    eventDate: string,
    eventTime: string,
    assignedStaffIds: string[],
    excludeBookingId: string
  ): StaffConflict[] => {
    if (assignedStaffIds.length === 0) return [];
    const assignedSet = new Set(assignedStaffIds);
    const conflicts: StaffConflict[] = [];
    const seen = new Set<string>();
    bookings.forEach((other) => {
      if (other.id === excludeBookingId) return;
      if (getBookingServiceStatus(other) === 'cancelled') return;
      if (other.eventDate !== eventDate || other.eventTime !== eventTime) return;
      const otherAssignments = other.id === bookingId ? staffAssignments : other.staffAssignments;
      if (!otherAssignments?.length) return;
      otherAssignments.forEach((a) => {
        if (!assignedSet.has(a.staffId)) return;
        const key = `${a.staffId}:${other.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        conflicts.push({
          staffId: a.staffId,
          staffName: staffById.get(a.staffId)?.name ?? `Staff ${a.staffId}`,
          conflictingBooking: other,
        });
      });
    });
    return conflicts;
  };

  const selectedStaffIds = useMemo(
    () => new Set(getUniqueAssignedStaffIds(staffAssignments)),
    [staffAssignments]
  );

  const getAvailableStaff = (chefRole: string, currentlyAssignedId?: string): StaffRecord[] => {
    const staffRole = CHEF_ROLE_TO_STAFF_ROLE[chefRole as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
    if (!staffRole) return [];
    const roleMatches = (s: StaffRecord) =>
      s.primaryRole === staffRole || (s.secondaryRoles ?? []).includes(staffRole);
    let list = staffRecords.filter((s) => s.status === 'active' && roleMatches(s));
    list = list.filter((s) => {
      const conflicts = findStaffConflicts(
        booking!.eventDate,
        booking!.eventTime,
        [s.id],
        booking!.id
      );
      return conflicts.length === 0;
    });
    if (currentlyAssignedId) {
      const current = staffRecords.find((s) => s.id === currentlyAssignedId);
      if (current && roleMatches(current) && !list.some((s) => s.id === currentlyAssignedId)) {
        list = [current, ...list];
      }
    }
    return list;
  };

  const findAssignmentForPositionIdx = (positionIndex: number) =>
    findAssignmentForPosition(staffAssignments, financialsWithProfile!, positionIndex);

  const updateAssignment = (positionIndex: number, staffId: string) => {
    if (!financialsWithProfile) return;
    const position = financialsWithProfile.staffingPlan.staff[positionIndex];
    const staffRole = CHEF_ROLE_TO_STAFF_ROLE[position.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
    const estimatedPay = financialsWithProfile.laborCompensation[positionIndex]?.finalPay ?? 0;
    let sameRoleIndex = 0;
    for (let i = 0; i < positionIndex; i++) {
      if (financialsWithProfile.staffingPlan.staff[i].role === position.role) sameRoleIndex++;
    }
    const assignments = [...(staffAssignments ?? [])];
    let matchCount = 0;
    const existingIdx = assignments.findIndex((a) => {
      if (a.role === staffRole) {
        if (matchCount === sameRoleIndex) return true;
        matchCount++;
      }
      return false;
    });

    if (!staffId) {
      if (existingIdx >= 0) assignments.splice(existingIdx, 1);
    } else {
      const dupIdx = assignments.findIndex((a, i) => i !== existingIdx && a.staffId === staffId);
      if (dupIdx >= 0) {
        const name = staffById.get(staffId)?.name ?? 'This staff member';
        alert(`${name} is already assigned to another position for this booking.`);
        return;
      }
      const newA: StaffAssignment = { staffId, role: staffRole, estimatedPay, status: 'scheduled' };
      if (existingIdx >= 0) assignments[existingIdx] = newA;
      else assignments.push(newA);
    }
    setStaffAssignments(assignments.length > 0 ? assignments : undefined);
  };

  const handleSave = () => {
    if (!booking) return;
    const updated: Booking = {
      ...booking,
      staffingProfileId,
      staffAssignments: staffAssignments ?? undefined,
      updatedAt: new Date().toISOString(),
    };
    const list = bookings.map((b) => (b.id === booking.id ? updated : b));
    localStorage.setItem('bookings', JSON.stringify(list));
    window.dispatchEvent(new Event('bookingsUpdated'));
    setSaved(true);
    setTimeout(() => router.push('/bookings'), 1500);
  };

  if (!bookingId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-text-muted">Missing booking ID.</p>
        <Link href="/bookings" className="ml-4 text-accent hover:underline">Back to Events</Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-text-muted">Booking not found.</p>
        <Link href="/bookings" className="ml-4 text-accent hover:underline">Back to Events</Link>
      </div>
    );
  }

  const eventDate = format(parseISO(booking.eventDate), 'MMM d, yyyy');
  const guests = booking.adults + (booking.children ?? 0);
  const hasStaffSection = financialsWithProfile && financialsWithProfile.staffingPlan.staff.length > 0;

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Staff assignments</h1>
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Events
          </Link>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card-elevated p-4">
          <p className="text-sm font-medium text-text-primary">{booking.customerName}</p>
          <p className="text-sm text-text-muted">{eventDate} · {guests} guests</p>
        </div>

        {(rules.staffing.profiles ?? []).length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-secondary">Staffing profile</label>
            <select
              value={staffingProfileId ?? ''}
              onChange={(e) => {
                setStaffingProfileId(e.target.value || undefined);
                setStaffAssignments(undefined);
              }}
              className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
            >
              <option value="">Auto (best match)</option>
              {(rules.staffing.profiles ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.minGuests}–{p.maxGuests === 9999 ? '∞' : p.maxGuests} guests)
                </option>
              ))}
            </select>
          </div>
        )}

        {hasStaffSection && (
          <div className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-text-primary">
              <UsersIcon className="h-5 w-5" />
              Assign staff
            </h2>
            <p className="mb-4 text-xs text-text-muted">
              Assign each role. Conflicts with other events on the same date/time are excluded from the list.
            </p>
            <div className="space-y-3">
              {financialsWithProfile.staffingPlan.staff.map((position, idx) => {
                const assignment = findAssignmentForPositionIdx(idx);
                const available = getAvailableStaff(position.role, assignment?.staffId);
                const laborComp = financialsWithProfile.laborCompensation[idx];
                return (
                  <div
                    key={`${position.role}-${idx}`}
                    className="flex items-center gap-4 rounded-lg border border-border bg-card-elevated px-4 py-3"
                  >
                    <div className="min-w-[140px]">
                      <div className="text-sm font-medium text-text-primary">
                        {CHEF_ROLE_LABELS[position.role] || position.role}
                      </div>
                      {laborComp && (
                        <div className="text-xs text-text-muted">
                          Est. {formatCurrency(laborComp.finalPay)}
                        </div>
                      )}
                    </div>
                    <select
                      value={assignment?.staffId ?? ''}
                      onChange={(e) => updateAssignment(idx, e.target.value)}
                      className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-card-elevated"
                    >
                      <option value="">Unassigned</option>
                      {available.map((staff) => (
                        <option
                          key={staff.id}
                          value={staff.id}
                          disabled={selectedStaffIds.has(staff.id) && assignment?.staffId !== staff.id}
                        >
                          {staff.name}
                          {selectedStaffIds.has(staff.id) && assignment?.staffId !== staff.id ? ' (assigned elsewhere)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {staffRecords.filter((s) => s.status === 'active').length === 0 && (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                No active staff. Add staff on the Staff page first.
              </p>
            )}
          </div>
        )}

        {!hasStaffSection && financialsWithProfile && (
          <p className="mb-6 text-sm text-text-muted">
            No staff positions for this event size/type. Adjust guest count or event type on the event to see roles.
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {saved ? 'Saved — redirecting…' : 'Save assignments'}
          </button>
          <Link
            href="/bookings"
            className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingStaffPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm text-text-muted">Loading…</p></div>}>
      <BookingStaffContent />
    </Suspense>
  );
}

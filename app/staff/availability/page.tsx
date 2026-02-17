'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  addDays,
  isBefore,
  isSameDay,
} from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon, UserGroupIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { StaffMember } from '@/lib/staffTypes';
import { ROLE_LABELS } from '@/lib/staffTypes';

function loadStaff(): StaffMember[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('staff');
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as StaffMember[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toLocalDateISO(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function StaffAvailabilityContent() {
  const searchParams = useSearchParams();
  const staffIdFromUrl = searchParams.get('staffId');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(() => staffIdFromUrl ?? '');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedAvailableDates, setSelectedAvailableDates] = useState<string[]>([]);

  useEffect(() => {
    const load = () => {
      const list = loadStaff();
      setStaff(list);
      if (list.length === 0) return;
      const urlIdValid = staffIdFromUrl && list.some((s) => s.id === staffIdFromUrl);
      setSelectedStaffId((current) => {
        if (urlIdValid) return staffIdFromUrl!;
        if (current && list.some((s) => s.id === current)) return current;
        return list[0].id;
      });
    };
    load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'staff') load();
    };
    const onCustom = () => load();
    window.addEventListener('storage', onStorage);
    window.addEventListener('staffUpdated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('staffUpdated', onCustom);
    };
  }, [staffIdFromUrl]);

  const selectedStaff = staff.find((s) => s.id === selectedStaffId);

  // Clear session selection when switching staff
  useEffect(() => {
    setSelectedAvailableDates([]);
  }, [selectedStaffId]);

  const toggleDate = (dateStr: string) => {
    setSelectedAvailableDates((prev) => {
      const has = prev.includes(dateStr);
      if (has) return prev.filter((d) => d !== dateStr);
      return [...prev, dateStr].sort();
    });
  };

  const handleSave = () => {
    if (!selectedStaff || selectedAvailableDates.length === 0) return;
    const unavailable = Array.isArray(selectedStaff.unavailableDates) ? selectedStaff.unavailableDates : [];
    const selectedSet = new Set(selectedAvailableDates);
    const nextUnavailable = unavailable.filter((d) => !selectedSet.has(d));
    const updated: StaffMember = {
      ...selectedStaff,
      unavailableDates: nextUnavailable,
      updatedAt: new Date().toISOString(),
    };
    const newStaff = staff.map((s) => (s.id === selectedStaff.id ? updated : s));
    setStaff(newStaff);
    localStorage.setItem('staff', JSON.stringify(newStaff));
    window.dispatchEvent(new Event('staffUpdated'));
    setSelectedAvailableDates([]);
  };

  const handleClearMonth = () => {
    if (!selectedStaff) return;
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const monthDateStrs: string[] = [];
    let d = start;
    while (isBefore(d, end) || isSameDay(d, end)) {
      monthDateStrs.push(toLocalDateISO(d));
      d = addDays(d, 1);
    }
    const unavailable = Array.isArray(selectedStaff.unavailableDates) ? selectedStaff.unavailableDates : [];
    const existingSet = new Set(unavailable);
    monthDateStrs.forEach((dateStr) => existingSet.add(dateStr));
    const nextUnavailable = Array.from(existingSet).sort();
    const updated: StaffMember = {
      ...selectedStaff,
      unavailableDates: nextUnavailable,
      updatedAt: new Date().toISOString(),
    };
    const newStaff = staff.map((s) => (s.id === selectedStaff.id ? updated : s));
    setStaff(newStaff);
    localStorage.setItem('staff', JSON.stringify(newStaff));
    window.dispatchEvent(new Event('staffUpdated'));
    setSelectedAvailableDates((prev) => prev.filter((d) => !monthDateStrs.includes(d)));
  };

  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Staff Availability</h1>
            <p className="mt-2 text-text-secondary">
              Mark dates when staff are unavailable. They will not be selectable for events on those dates.
            </p>
          </div>
          <Link
            href="/staff"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-card-elevated"
          >
            <UserGroupIcon className="h-4 w-4" />
            Back to Staff
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <label htmlFor="staff-select" className="block text-sm font-medium text-text-secondary">
              Select staff member
            </label>
            <select
              id="staff-select"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">— Select —</option>
              {staff.filter((s) => s.status === 'active').map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.primaryRole ? ` (${ROLE_LABELS[s.primaryRole]})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedStaff ? (
            <>
              <p className="mb-4 text-sm text-text-muted">
                Click dates to mark them as <strong>available</strong> (green). Click again to deselect. When done, click Save to apply. Unmarked or red dates remain unavailable for assignment.
              </p>

              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((m) => addMonths(m, -1))}
                  className="rounded p-2 text-text-secondary hover:bg-card-elevated hover:text-text-primary"
                  aria-label="Previous month"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold text-text-primary">
                  {format(calendarMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearMonth}
                    className="rounded border border-border bg-card-elevated px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-border"
                  >
                    Clear month
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                    className="rounded p-2 text-text-secondary hover:bg-card-elevated hover:text-text-primary"
                    aria-label="Next month"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {weekDays.map((day) => (
                        <th
                          key={day}
                          className="border border-border bg-card-elevated px-2 py-2 text-center text-xs font-medium text-text-muted"
                        >
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => (
                      <tr key={weekIdx}>
                        {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day) => {
                          const dateStr = toLocalDateISO(day);
                          const isSelectedThisSession = selectedAvailableDates.includes(dateStr);
                          const unavailableList = Array.isArray(selectedStaff.unavailableDates) ? selectedStaff.unavailableDates : [];
                          const isSavedUnavailable = unavailableList.includes(dateStr);
                          const isCurrentMonth = isSameMonth(day, calendarMonth);
                          // Gray = in unavailable list (and not selected to flip). Green = selected OR not in unavailable list.
                          const isGreen = isSelectedThisSession || !isSavedUnavailable;
                          return (
                            <td
                              key={dateStr}
                              className="min-w-[2.75rem] border border-border p-0.5 align-top"
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (isCurrentMonth) toggleDate(dateStr);
                                }}
                                className={`flex h-12 w-full min-h-12 items-center justify-center rounded-lg text-sm font-medium transition-colors select-none ${
                                  !isCurrentMonth
                                    ? 'cursor-default bg-transparent text-text-muted'
                                    : isGreen
                                      ? 'bg-success/30 text-success hover:bg-success/40'
                                      : 'bg-card-elevated text-text-secondary hover:bg-border'
                                } ${isCurrentMonth ? 'cursor-pointer' : 'cursor-default'}`}
                                title={
                                  !isCurrentMonth
                                    ? ''
                                    : isGreen
                                      ? 'Available (click to mark unavailable)'
                                      : 'Click to select as available'
                                }
                              >
                                {format(day, 'd')}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded bg-card-elevated" /> Gray — unavailable
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded bg-success/30" /> Green — available (stays after save)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={selectedAvailableDates.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4" />
                  Save {selectedAvailableDates.length} day{selectedAvailableDates.length !== 1 ? 's' : ''} as available
                </button>
              </div>
            </>
          ) : (
            <p className="text-text-muted">
              Select a staff member to manage their availability, or add staff on the Staff page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StaffAvailabilityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-text-muted">
          Loading…
        </div>
      }
    >
      <StaffAvailabilityContent />
    </Suspense>
  );
}

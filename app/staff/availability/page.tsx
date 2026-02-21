'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
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
import type { StaffMember, DayOfWeek } from '@/lib/staffTypes';
import { ROLE_LABELS } from '@/lib/staffTypes';

// ─── Staff color palette for "All Staff" view ─────────────────────────────────

const STAFF_PALETTE = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-orange-500',
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function loadStaff(): StaffMember[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('staff');
    if (!saved) return [];
    const parsed = JSON.parse(saved) as StaffMember[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toLocalDateISO(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function isStaffAvailableOnDate(member: StaffMember, date: Date): boolean {
  const dayName = format(date, 'EEEE').toLowerCase() as DayOfWeek;
  if (!member.weeklyAvailability?.[dayName]) return false;
  const iso = toLocalDateISO(date);
  const unavailable = Array.isArray(member.unavailableDates) ? member.unavailableDates : [];
  return !unavailable.includes(iso);
}

// ─── Main content (wrapped in Suspense for useSearchParams) ───────────────────

function TeamCalendarContent() {
  const searchParams = useSearchParams();
  const staffIdFromUrl = searchParams.get('staffId');

  const [staff, setStaff] = useState<StaffMember[]>([]);
  // filterMode: 'all' = all-staff view; any other string = staffId for individual view
  const [filterMode, setFilterMode] = useState<string>(staffIdFromUrl ?? 'all');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedAvailableDates, setSelectedAvailableDates] = useState<string[]>([]);

  // Load staff + listen for updates
  useEffect(() => {
    const load = () => {
      const list = loadStaff();
      setStaff(list);
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
  }, []);

  // Clear unsaved selections when switching filter
  useEffect(() => {
    setSelectedAvailableDates([]);
  }, [filterMode]);

  const activeStaff = useMemo(() => staff.filter((s) => s.status === 'active'), [staff]);
  const selectedStaff = filterMode !== 'all' ? staff.find((s) => s.id === filterMode) : null;

  // Calendar grid
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ── Individual mode handlers ────────────────────────────────────────────────

  const toggleDate = (dateStr: string) => {
    setSelectedAvailableDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
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
    setSelectedAvailableDates((prev) => prev.filter((dd) => !monthDateStrs.includes(dd)));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Team Calendar</h1>
            <p className="mt-1 text-sm text-text-secondary">
              View all staff availability or manage individual schedules.
            </p>
          </div>
          <Link
            href="/staff"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-card-elevated"
          >
            <UserGroupIcon className="h-4 w-4" />
            Back to Team
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-6">
          {/* Controls row: filter dropdown + month navigation */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            {/* Filter dropdown */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-text-secondary">View:</label>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="all">All Staff</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.primaryRole ? ` (${ROLE_LABELS[s.primaryRole]})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Month navigation */}
            <div className="flex items-center gap-2">
              {filterMode !== 'all' && selectedStaff && (
                <button
                  type="button"
                  onClick={handleClearMonth}
                  className="rounded border border-border bg-card-elevated px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-border"
                >
                  Clear month
                </button>
              )}
              <button
                type="button"
                onClick={() => setCalendarMonth((m) => addMonths(m, -1))}
                className="rounded p-2 text-text-secondary hover:bg-card-elevated hover:text-text-primary"
                aria-label="Previous month"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <h2 className="min-w-[140px] text-center text-base font-semibold text-text-primary">
                {format(calendarMonth, 'MMMM yyyy')}
              </h2>
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

          {/* Individual mode instructions */}
          {filterMode !== 'all' && selectedStaff && (
            <p className="mb-4 rounded-lg bg-card-elevated px-4 py-2.5 text-sm text-text-secondary">
              Gray = unavailable. Click gray dates to mark them available, then click{' '}
              <strong>Save</strong>. Use <strong>Clear month</strong> to block all days in this month.
            </p>
          )}

          {/* ── Calendar grid ── */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
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
                      const isCurrentMonth = isSameMonth(day, calendarMonth);

                      // ── All Staff mode ──────────────────────────────────────
                      if (filterMode === 'all') {
                        const availableStaff = isCurrentMonth
                          ? activeStaff.filter((m) => isStaffAvailableOnDate(m, day))
                          : [];
                        const shown = availableStaff.slice(0, 4);
                        const overflow = availableStaff.length - 4;

                        return (
                          <td
                            key={dateStr}
                            className={`border border-border p-1.5 align-top ${
                              isCurrentMonth ? 'bg-card' : 'bg-card-elevated/40'
                            }`}
                            style={{ minWidth: '3.5rem', height: '5rem' }}
                          >
                            <p
                              className={`mb-1.5 text-xs font-medium ${
                                isCurrentMonth ? 'text-text-secondary' : 'text-text-muted'
                              }`}
                            >
                              {format(day, 'd')}
                            </p>
                            {isCurrentMonth && (
                              <div className="flex flex-wrap gap-0.5">
                                {shown.map((member) => {
                                  const idx = activeStaff.indexOf(member);
                                  return (
                                    <span
                                      key={member.id}
                                      title={member.name}
                                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ${
                                        STAFF_PALETTE[idx % STAFF_PALETTE.length]
                                      }`}
                                    >
                                      {getInitials(member.name)}
                                    </span>
                                  );
                                })}
                                {overflow > 0 && (
                                  <span className="inline-flex h-5 items-center rounded-full bg-card-elevated px-1 text-[8px] text-text-muted">
                                    +{overflow}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      }

                      // ── Individual mode ─────────────────────────────────────
                      if (!selectedStaff) {
                        return <td key={dateStr} className="border border-border p-0.5" />;
                      }

                      const isSelectedThisSession = selectedAvailableDates.includes(dateStr);
                      const unavailableList = Array.isArray(selectedStaff.unavailableDates)
                        ? selectedStaff.unavailableDates
                        : [];
                      const isSavedUnavailable = unavailableList.includes(dateStr);
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
                            className={`flex h-12 min-h-12 w-full select-none items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                              !isCurrentMonth
                                ? 'cursor-default bg-transparent text-text-muted'
                                : isGreen
                                  ? 'cursor-pointer bg-success/30 text-success hover:bg-success/40'
                                  : 'cursor-pointer bg-card-elevated text-text-secondary hover:bg-border'
                            }`}
                            title={
                              !isCurrentMonth
                                ? ''
                                : isGreen
                                  ? 'Available — click to mark unavailable'
                                  : 'Unavailable — click to mark available'
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

          {/* Footer: legend + actions */}
          <div className="mt-5">
            {filterMode === 'all' ? (
              /* All-staff legend */
              activeStaff.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                    Staff Legend
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {activeStaff.map((member, i) => (
                      <div key={member.id} className="flex items-center gap-1.5">
                        <span
                          className={`h-3 w-3 rounded-full ${STAFF_PALETTE[i % STAFF_PALETTE.length]}`}
                        />
                        <span className="text-xs text-text-secondary">{member.name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    Dots = staff available that day based on weekly schedule and blocked dates. Select
                    a person from the filter to edit their schedule.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  No active staff found. Add staff on the{' '}
                  <Link href="/staff" className="text-accent hover:underline">
                    Team page
                  </Link>
                  .
                </p>
              )
            ) : (
              /* Individual mode legend + save */
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-text-secondary">
                    <span className="h-4 w-4 rounded border border-border bg-card-elevated" />
                    Unavailable
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-text-secondary">
                    <span className="h-4 w-4 rounded bg-success/30" />
                    Available
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={selectedAvailableDates.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4" />
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function TeamCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-text-muted">Loading…</div>
      }
    >
      <TeamCalendarContent />
    </Suspense>
  );
}

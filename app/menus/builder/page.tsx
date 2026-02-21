'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ClipboardDocumentListIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { Booking } from '@/lib/bookingTypes';
import { loadFromStorage } from '@/lib/storage';
import { getBookingServiceStatus } from '@/lib/bookingWorkflow';
import { useTemplateConfig } from '@/lib/useTemplateConfig';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEventDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return format(new Date(y, m - 1, d), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

type MenuStatus = 'ready' | 'none';

function getMenuStatus(booking: Booking): MenuStatus {
  if (booking.menuId || booking.cateringMenuId) return 'ready';
  return 'none';
}

// ─── Booking row ─────────────────────────────────────────────────────────────

function BookingMenuRow({
  booking,
  eventTypeLabel,
}: {
  booking: Booking;
  eventTypeLabel: string;
}) {
  const totalGuests = booking.adults + (booking.children ?? 0);
  const status = getMenuStatus(booking);

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:bg-card-elevated">
      {/* Date */}
      <div className="w-28 shrink-0">
        <p className="text-sm font-medium text-text-primary">{formatEventDate(booking.eventDate)}</p>
        {booking.eventTime && (
          <p className="text-xs text-text-muted">{booking.eventTime}</p>
        )}
      </div>

      {/* Customer */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{booking.customerName}</p>
        <p className="truncate text-xs text-text-muted">{booking.location || 'No location set'}</p>
      </div>

      {/* Event type + guests */}
      <div className="hidden w-40 shrink-0 sm:block">
        <p className="text-xs text-text-secondary">{eventTypeLabel}</p>
        <p className="text-xs text-text-muted">{totalGuests} guest{totalGuests !== 1 ? 's' : ''}</p>
      </div>

      {/* Menu status */}
      <div className="w-24 shrink-0 text-center">
        {status === 'ready' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            <CheckCircleIcon className="h-3 w-3" />
            Menu Set
          </span>
        ) : (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            No Menu
          </span>
        )}
      </div>

      {/* Action */}
      <Link
        href={`/bookings/menu?bookingId=${booking.id}`}
        className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
      >
        {status === 'ready' ? 'Edit Menu' : 'Build Menu'}
      </Link>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function WorkflowSection({
  title,
  description,
  accent,
  bookings,
  getLabel,
  emptyMessage,
}: {
  title: string;
  description: string;
  accent: string;
  bookings: Booking[];
  getLabel: (booking: Booking) => string;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card-elevated">
      {/* Section header */}
      <div className={`rounded-t-xl border-b border-border px-5 py-4 ${accent}`}>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs opacity-80">{description}</p>
      </div>

      {/* Booking rows */}
      <div className="space-y-2 p-3">
        {bookings.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">{emptyMessage}</p>
        ) : (
          bookings.map((b) => (
            <BookingMenuRow key={b.id} booking={b} eventTypeLabel={getLabel(b)} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MenuBuilderPage() {
  const { config } = useTemplateConfig();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');

  useEffect(() => {
    const load = () => {
      const all = loadFromStorage<Booking[]>('bookings', []);
      setBookings(all);
    };
    load();
    window.addEventListener('bookingsUpdated', load);
    return () => window.removeEventListener('bookingsUpdated', load);
  }, []);

  // Helper: label for an event type from template config
  const getEventTypeLabel = (eventTypeId: string): string =>
    config.eventTypes.find((et) => et.id === eventTypeId)?.label ??
    eventTypeId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Active (non-cancelled, non-inquiry) bookings, sorted by event date asc
  const activeBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().slice(0, 10);

    return bookings
      .filter((b) => {
        if (b.source === 'inquiry') return false;
        const svc = getBookingServiceStatus(b);
        if (svc === 'cancelled') return false;
        if (filter === 'upcoming' && b.eventDate < todayISO) return false;
        return true;
      })
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [bookings, filter]);

  // Split by workflow type
  // 'private-dinner' = Hibachi per-guest workflow
  // Everything else = Catering bulk workflow
  const hibachiBookings = useMemo(
    () => activeBookings.filter((b) => b.eventType === 'private-dinner'),
    [activeBookings]
  );

  const cateringBookings = useMemo(
    () => activeBookings.filter((b) => b.eventType !== 'private-dinner'),
    [activeBookings]
  );

  const totalWithMenu = useMemo(
    () => activeBookings.filter((b) => getMenuStatus(b) === 'ready').length,
    [activeBookings]
  );

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-6 w-6 text-accent" />
              <h1 className="text-2xl font-bold text-text-primary">Menu Builder</h1>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Select an event to build or edit its menu. Hibachi and catering events use different workflows.
            </p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 text-sm">
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
              <p className="text-lg font-bold text-text-primary">{activeBookings.length}</p>
              <p className="text-xs text-text-muted">Events</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
              <p className="text-lg font-bold text-success">{totalWithMenu}</p>
              <p className="text-xs text-text-muted">Menus Set</p>
            </div>
            <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 px-3 py-2 text-center dark:border-amber-500/30 dark:bg-amber-500/5">
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {activeBookings.length - totalWithMenu}
              </p>
              <p className="text-xs text-text-muted">Need Menu</p>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setFilter('upcoming')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === 'upcoming'
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            All Events
          </button>
        </div>

        {/* Two workflow sections */}
        <div className="space-y-6">
          {/* Hibachi workflow */}
          <WorkflowSection
            title="🔥 Hibachi Private Dinners"
            description="Per-guest menu — each guest selects 2 proteins + sides + upgrades (Filet Mignon, Scallops, etc.)"
            accent="bg-orange-500/10 text-orange-700 dark:text-orange-300"
            bookings={hibachiBookings}
            getLabel={(b) => getEventTypeLabel(b.eventType)}
            emptyMessage="No hibachi private dinner events found."
          />

          {/* Catering workflow */}
          <WorkflowSection
            title="🍽 Catering Events"
            description="Bulk menu — select dishes from the catalog by category, set servings per item, track food cost and revenue."
            accent="bg-blue-500/10 text-blue-700 dark:text-blue-300"
            bookings={cateringBookings}
            getLabel={(b) => getEventTypeLabel(b.eventType)}
            emptyMessage="No catering events found."
          />
        </div>

        {/* Hint */}
        <p className="mt-6 text-center text-xs text-text-muted">
          To add an event,{' '}
          <Link href="/bookings" className="text-accent underline-offset-2 hover:underline">
            create a booking
          </Link>{' '}
          first. The menu workflow is determined by event type.
        </p>
      </div>
    </div>
  );
}

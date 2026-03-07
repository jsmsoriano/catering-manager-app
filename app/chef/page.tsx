'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type ChefEvent = {
  id: string;
  customerName: string;
  eventDate: string;
  eventTime: string;
  location: string;
  guests: number;
  status: string;
  paymentStatus: string | null;
  subtotal: number;
  gratuity: number;
  total: number;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ChefPage() {
  const [events, setEvents] = useState<ChefEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/chef/events', { cache: 'no-store' });
        const body = (await res.json()) as { events?: ChefEvent[]; error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Failed to load events');
        if (active) setEvents(body.events ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const { upcoming, completed } = useMemo(() => {
    const upcomingRows = events.filter((e) => e.eventDate >= today);
    const completedRows = events.filter((e) => e.eventDate < today);
    return { upcoming: upcomingRows, completed: completedRows };
  }, [events, today]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Assigned Events</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Chef-scoped view. Only events assigned to your staff profile are shown.
        </p>
        <Link
          href="/chef/shopping"
          className="mt-3 inline-block rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card hover:text-text-primary"
        >
          Open Chef Shopping Lists
        </Link>
      </div>

      {loading && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-text-secondary">
          Loading events...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="rounded-lg border border-border bg-card p-4 text-sm text-text-secondary">
                No upcoming assigned events.
              </p>
            ) : (
              <div className="grid gap-3">
                {upcoming.map((event) => (
                  <article key={event.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-text-primary">{event.customerName}</p>
                        <p className="text-sm text-text-secondary">
                          {event.eventDate} {event.eventTime ? `at ${event.eventTime}` : ''} • {event.guests} guests
                        </p>
                        <p className="text-sm text-text-secondary">{event.location || 'No location set'}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-text-secondary">Status: {event.status}</p>
                        <p className="font-medium text-text-primary">{formatMoney(event.total)}</p>
                        <Link
                          href={`/chef/event-summary/${event.id}`}
                          className="mt-2 inline-block text-xs text-accent hover:text-accent-hover"
                        >
                          View summary
                        </Link>
                        <Link
                          href={`/bookings/shopping?bookingId=${event.id}`}
                          className="ml-3 mt-2 inline-block text-xs text-accent hover:text-accent-hover"
                        >
                          Shopping list
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">Completed</h2>
            {completed.length === 0 ? (
              <p className="rounded-lg border border-border bg-card p-4 text-sm text-text-secondary">
                No completed assigned events.
              </p>
            ) : (
              <div className="grid gap-3">
                {completed.map((event) => (
                  <article key={event.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-text-primary">{event.customerName}</p>
                        <p className="text-sm text-text-secondary">
                          {event.eventDate} • {event.guests} guests
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-text-secondary">Status: {event.status}</p>
                        <p className="font-medium text-text-primary">{formatMoney(event.total)}</p>
                        <Link
                          href={`/chef/event-summary/${event.id}`}
                          className="mt-2 inline-block text-xs text-accent hover:text-accent-hover"
                        >
                          View summary
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

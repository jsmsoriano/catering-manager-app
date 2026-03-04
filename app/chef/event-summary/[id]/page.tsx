'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type SummaryPayload = {
  event: {
    id: string;
    customerName: string;
    eventDate: string;
    eventTime: string;
    location: string;
    guests: number;
    status: string;
    subtotal: number;
    gratuity: number;
    total: number;
    notes: string;
  };
  financials: {
    totalStaffCompensation: number;
    foodCost: number;
    suppliesCost: number;
    transportationCost: number;
    totalCosts: number;
    grossProfit: number;
  };
  staff: Array<{
    role: string;
    roleLabel: string;
    name: string;
    basePay: number;
    gratuityShare: number;
    totalPay: number;
  }>;
};

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ChefEventSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const [eventId, setEventId] = useState<string>('');
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    params.then(({ id }) => {
      if (!active) return;
      setEventId(id);
    });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/chef/events/${eventId}/summary`, { cache: 'no-store' });
        const body = (await res.json()) as SummaryPayload & { error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Failed to load summary');
        if (active) setData(body);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load summary');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [eventId]);

  const totalComp = useMemo(() => data?.staff.reduce((sum, s) => sum + s.totalPay, 0) ?? 0, [data]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Event Summary</h1>
        <Link
          href="/chef"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Back to events
        </Link>
      </div>

      {loading && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-text-secondary">
          Loading event summary...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-text-primary">{data.event.customerName}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {data.event.eventDate} {data.event.eventTime ? `at ${data.event.eventTime}` : ''} • {data.event.guests} guests
            </p>
            <p className="text-sm text-text-secondary">{data.event.location || 'No location set'}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
              <div>
                <span className="text-text-secondary">Subtotal:</span>{' '}
                <span className="font-medium text-text-primary">{money(data.event.subtotal)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Gratuity:</span>{' '}
                <span className="font-medium text-text-primary">{money(data.event.gratuity)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Total:</span>{' '}
                <span className="font-medium text-text-primary">{money(data.event.total)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-text-primary">Staff Compensation</h2>
            <div className="mt-3 space-y-2">
              {data.staff.map((s) => (
                <div key={`${s.role}-${s.name}`} className="rounded-md border border-border bg-card-elevated p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-text-primary">{s.name}</p>
                    <p className="text-sm font-semibold text-text-primary">{money(s.totalPay)}</p>
                  </div>
                  <p className="text-sm text-text-secondary">{s.roleLabel}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Base {money(s.basePay)} • Gratuity {money(s.gratuityShare)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              Total staff compensation: <span className="font-medium text-text-primary">{money(totalComp)}</span>
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-text-primary">Cost & Profit</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div>
                <span className="text-text-secondary">Food cost:</span>{' '}
                <span className="font-medium text-text-primary">{money(data.financials.foodCost)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Supplies:</span>{' '}
                <span className="font-medium text-text-primary">{money(data.financials.suppliesCost)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Transportation:</span>{' '}
                <span className="font-medium text-text-primary">{money(data.financials.transportationCost)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Total costs:</span>{' '}
                <span className="font-medium text-text-primary">{money(data.financials.totalCosts)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Gross profit:</span>{' '}
                <span className="font-medium text-text-primary">{money(data.financials.grossProfit)}</span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

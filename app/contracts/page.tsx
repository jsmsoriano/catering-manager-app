'use client';

import Link from 'next/link';
import { useFeatureFlags } from '@/lib/useFeatureFlags';

export default function ContractsPage() {
  const { productProfile } = useFeatureFlags();

  if (productProfile !== 'catering_pro') {
    return (
      <div className="min-h-screen p-8">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold text-text-primary">Contracts</h1>
          <p className="mt-2 text-sm text-text-muted">
            Contracts is available for the Professional Caterers profile only.
          </p>
          <Link
            href="/settings?tab=admin"
            className="mt-4 inline-block rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
          >
            Open Profile Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Contracts</h1>
            <p className="mt-1 text-sm text-text-muted">
              Create, send, and track event contracts with client signatures.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-text-primary">Template Library</h2>
            <p className="mt-2 text-sm text-text-muted">
              Save contract templates with reusable clauses, payment terms, and cancellation policies.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              New Template
            </button>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-text-primary">Sent Contracts</h2>
            <p className="mt-2 text-sm text-text-muted">
              Track delivery status, opened timestamps, and pending signatures for active events.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
            >
              View Queue
            </button>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-text-primary">Signature Status</h2>
            <p className="mt-2 text-sm text-text-muted">
              See unsigned contracts, signed dates, and audit details by booking.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
            >
              Review Signatures
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

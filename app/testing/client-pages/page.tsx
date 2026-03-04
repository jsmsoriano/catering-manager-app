'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientPagesTestingPage() {
  const router = useRouter();
  const [proposalToken, setProposalToken] = useState('');

  const openProposalPortal = () => {
    const token = proposalToken.trim();
    if (!token) return;
    router.push(`/proposal/${token}`);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Client-Facing Pages (Testing)</h1>
          <p className="mt-2 text-sm text-text-muted">
            Use these links for testing customer-facing pages. In production, customers access these via emailed links.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Inquiry forms</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/inquiry"
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
            >
              Open Classic Inquiry
            </Link>
            <Link
              href="/inquiry-chat"
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
            >
              Open Q&A Inquiry
            </Link>
            <Link
              href="/order"
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
            >
              Open Online Ordering
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Proposal / Client Portal</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Paste a proposal token generated from Send Quote, then open the customer portal page.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={proposalToken}
              onChange={(e) => setProposalToken(e.target.value)}
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
              className="flex-1 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
            />
            <button
              type="button"
              onClick={openProposalPortal}
              disabled={!proposalToken.trim()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              Open Client Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

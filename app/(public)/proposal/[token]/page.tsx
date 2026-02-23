'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ProposalToken } from '@/lib/proposalTypes';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProposalPage() {
  const params = useParams();
  const token = params.token as string;

  const [proposal, setProposal] = useState<ProposalToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      if (!supabase) { setNotFound(true); setLoading(false); return; }

      const { data, error } = await supabase
        .from('proposal_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        // Map snake_case DB columns to camelCase
        setProposal({
          id: data.id,
          token: data.token,
          bookingId: data.booking_id,
          status: data.status,
          snapshot: data.snapshot,
          createdAt: data.created_at,
          acceptedAt: data.accepted_at,
          expiresAt: data.expires_at,
        });
        if (data.status === 'accepted') setAccepted(true);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await fetch('/api/proposals/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setAccepted(true);
        if (proposal) setProposal({ ...proposal, status: 'accepted' });
      }
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-text-muted">Loading proposal…</p>
      </div>
    );
  }

  if (notFound || !proposal) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="text-5xl">📋</div>
        <h1 className="text-xl font-bold text-text-primary">Proposal Not Found</h1>
        <p className="max-w-sm text-sm text-text-secondary">
          This proposal link may have expired or is no longer valid. Please contact us for assistance.
        </p>
      </div>
    );
  }

  const { snapshot } = proposal;
  const guests = snapshot.adults + (snapshot.children ?? 0);

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            {snapshot.businessName}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-text-primary">Your Event Proposal</h1>
          <p className="mt-1 text-sm text-text-muted">
            Prepared for {snapshot.customerName} · {formatDate(snapshot.eventDate)}
          </p>
        </div>

        {/* Accepted banner */}
        {accepted && (
          <div className="mb-6 rounded-lg bg-success/10 border border-success/30 px-5 py-4 text-center">
            <p className="text-base font-semibold text-success">Proposal Accepted!</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              Thank you, {snapshot.customerName}. We look forward to your event!
            </p>
          </div>
        )}

        {/* Event Details */}
        <div className="mb-5 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-text-muted">Event Details</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-text-muted">Date</p>
              <p className="font-medium text-text-primary">{formatDate(snapshot.eventDate)}</p>
            </div>
            <div>
              <p className="text-text-muted">Time</p>
              <p className="font-medium text-text-primary">{snapshot.eventTime || '—'}</p>
            </div>
            <div>
              <p className="text-text-muted">Location</p>
              <p className="font-medium text-text-primary">{snapshot.location || '—'}</p>
            </div>
            <div>
              <p className="text-text-muted">Guests</p>
              <p className="font-medium text-text-primary">
                {snapshot.adults} adult{snapshot.adults !== 1 ? 's' : ''}
                {(snapshot.children ?? 0) > 0 ? `, ${snapshot.children} child${snapshot.children !== 1 ? 'ren' : ''}` : ''}
                {' '}({guests} total)
              </p>
            </div>
            <div>
              <p className="text-text-muted">Service Type</p>
              <p className="font-medium text-text-primary capitalize">{snapshot.eventType}</p>
            </div>
          </div>
        </div>

        {/* Menu Summary */}
        {snapshot.menuSummary && (
          <div className="mb-5 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">Menu Overview</h2>
            <p className="whitespace-pre-wrap text-sm text-text-secondary">{snapshot.menuSummary}</p>
          </div>
        )}

        {/* Pricing */}
        <div className="mb-5 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-text-muted">Pricing</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Subtotal</span>
              <span className="text-text-primary">{formatCurrency(snapshot.subtotal)}</span>
            </div>
            {snapshot.distanceFee > 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Distance Fee</span>
                <span className="text-text-primary">{formatCurrency(snapshot.distanceFee)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-secondary">Gratuity</span>
              <span className="text-text-primary">{formatCurrency(snapshot.gratuity)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span className="text-text-primary">Total</span>
              <span className="text-lg text-text-primary">{formatCurrency(snapshot.total)}</span>
            </div>
          </div>
        </div>

        {/* Deposit / Balance */}
        {(snapshot.depositAmount || snapshot.depositDueDate || snapshot.balanceDueDate) && (
          <div className="mb-5 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-text-muted">Payment Schedule</h2>
            <div className="space-y-2 text-sm">
              {snapshot.depositAmount && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    Deposit due{snapshot.depositDueDate ? ` by ${formatDate(snapshot.depositDueDate)}` : ''}
                  </span>
                  <span className="text-text-primary">{formatCurrency(snapshot.depositAmount)}</span>
                </div>
              )}
              {snapshot.balanceDueDate && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    Balance due by {formatDate(snapshot.balanceDueDate)}
                  </span>
                  <span className="text-text-primary">
                    {formatCurrency(snapshot.total - (snapshot.depositAmount ?? 0))}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {snapshot.notes && (
          <div className="mb-5 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-text-secondary">{snapshot.notes}</p>
          </div>
        )}

        {/* Accept CTA */}
        {!accepted && proposal.status !== 'expired' && (
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-6 text-center">
            <p className="mb-1 text-base font-semibold text-text-primary">Ready to book?</p>
            <p className="mb-4 text-sm text-text-secondary">
              Click below to accept this proposal and confirm your event.
            </p>
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-60"
            >
              {accepting ? 'Confirming…' : 'Accept Proposal'}
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-text-muted">
          {snapshot.businessName} · Sent {formatDate(snapshot.sentAt.split('T')[0])}
        </p>

      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { ProposalToken } from '@/lib/proposalTypes';
import { calculateGuestChangeCutoffISO, isGuestChangeLocked } from '@/lib/guestChangePolicy';
import { calculateMenuChangeCutoffISO, isMenuChangeLocked } from '@/lib/menuChangePolicy';
import { getLocalProposalToken, updateLocalProposalSnapshot, updateLocalProposalStatus } from '@/lib/localProposalTokens';

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

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/** Safe logo URL for <img src>: only https: or data:image/ (inline images). */
function safeLogoUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim().toLowerCase();
  if (t.startsWith('https://')) return url;
  if (t.startsWith('data:image/')) return url;
  return null;
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
  const [editingAdults, setEditingAdults] = useState(1);
  const [editingChildren, setEditingChildren] = useState(0);
  const [savingGuests, setSavingGuests] = useState(false);
  const [guestMessage, setGuestMessage] = useState<string | null>(null);
  const [menuRequestNote, setMenuRequestNote] = useState('');
  const [savingMenuRequest, setSavingMenuRequest] = useState(false);
  const [menuRequestMessage, setMenuRequestMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const local = getLocalProposalToken(token);
      if (local) {
        setProposal(local);
        if (local.status === 'accepted') setAccepted(true);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/proposals/public/${encodeURIComponent(token)}`);
      if (!res.ok) {
        setNotFound(true);
      } else {
        const payload = await res.json().catch(() => ({ proposal: null as ProposalToken | null }));
        if (!payload?.proposal) {
          setNotFound(true);
        } else {
          setProposal(payload.proposal);
          if (payload.proposal.status === 'accepted') setAccepted(true);
        }
      }
      setLoading(false);
    };
    load();
  }, [token]);

  useEffect(() => {
    if (!proposal) return;
    setEditingAdults(proposal.snapshot.adults);
    setEditingChildren(proposal.snapshot.children ?? 0);
    setMenuRequestNote(proposal.snapshot.menuChangeRequestNote ?? '');
  }, [proposal]);

  const handleAccept = async () => {
    if (token.startsWith('local-')) {
      const updated = updateLocalProposalStatus(token, 'accepted');
      if (updated) {
        setProposal(updated);
        setAccepted(true);
      }
      return;
    }
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
  const cutoffAt = snapshot.guestChangeCutoffAt || calculateGuestChangeCutoffISO(snapshot.eventDate);
  const guestLocked = isGuestChangeLocked({
    eventDate: snapshot.eventDate,
    guestCountLockedAt: snapshot.guestCountLockedAt,
    guestChangeCutoffAt: cutoffAt,
  });
  const guests = snapshot.adults + (snapshot.children ?? 0);
  const menuCutoffAt = snapshot.menuChangeCutoffAt || calculateMenuChangeCutoffISO(snapshot.eventDate);
  const menuLocked = isMenuChangeLocked({
    eventDate: snapshot.eventDate,
    menuChangeLockedAt: snapshot.menuChangeLockedAt,
    menuChangeCutoffAt: menuCutoffAt,
  });
  const logoUrl = safeLogoUrl(snapshot.logoUrl);

  const handleSubmitMenuRequest = async () => {
    const note = menuRequestNote.trim();
    if (!note) {
      setMenuRequestMessage('Please enter the menu updates you want.');
      return;
    }
    setSavingMenuRequest(true);
    setMenuRequestMessage(null);
    try {
      if (token.startsWith('local-')) {
        const now = new Date().toISOString();
        const locked = isMenuChangeLocked({
          nowIso: now,
          eventDate: snapshot.eventDate,
          menuChangeLockedAt: snapshot.menuChangeLockedAt,
          menuChangeCutoffAt: menuCutoffAt,
        });
        const updated = updateLocalProposalSnapshot(token, (prev) => ({
          ...prev,
          menuChangeCutoffAt: prev.menuChangeCutoffAt || menuCutoffAt,
          menuChangeRequestStatus: 'pending',
          menuChangeRequestNote: note,
          menuChangeRequestedAt: now,
          menuChangeRequestLate: locked,
          menuChangeLockedAt: locked ? prev.menuChangeLockedAt ?? now : undefined,
          menuChangeLockedReason: locked
            ? prev.menuChangeLockedReason ?? 'Menu self-service changes are locked 2 days before the event.'
            : undefined,
          menuChangeResolvedAt: undefined,
          menuChangeResolvedBy: undefined,
          menuChangeResolutionNote: undefined,
          requiresReview: true,
        }));
        if (updated) setProposal(updated);
        setMenuRequestMessage(
          locked
            ? 'Late menu request submitted. Our team will review based on staff and supply availability.'
            : 'Menu change request submitted. Our team will review and confirm updates.'
        );
        return;
      }

      const res = await fetch('/api/proposals/request-menu-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, note }),
      });
      const payload = await res.json().catch(() => ({} as { error?: string; locked?: boolean; snapshot?: ProposalToken['snapshot'] }));
      if (!res.ok) {
        setMenuRequestMessage(payload.error || 'Could not submit menu change request.');
        return;
      }
      if (payload.snapshot) {
        setProposal((prev) => (prev ? { ...prev, snapshot: payload.snapshot } : prev));
      }
      setMenuRequestMessage(
        payload.locked
          ? 'Late menu request submitted. Our team will review based on staff and supply availability.'
          : 'Menu change request submitted. Our team will review and confirm updates.'
      );
    } finally {
      setSavingMenuRequest(false);
    }
  };

  const handleSaveGuestCount = async () => {
    setSavingGuests(true);
    setGuestMessage(null);
    try {
      const res = await fetch('/api/proposals/update-guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          adults: Math.max(1, Math.round(editingAdults)),
          children: Math.max(0, Math.round(editingChildren)),
        }),
      });
      const payload = await res.json().catch(() => ({} as { error?: string; snapshot?: ProposalToken['snapshot'] }));
      if (!res.ok) {
        setGuestMessage(payload.error || 'Could not save guest count.');
        if (res.status === 409) {
          setProposal((prev) =>
            prev
              ? {
                  ...prev,
                  snapshot: {
                    ...prev.snapshot,
                    guestCountLockedAt: prev.snapshot.guestCountLockedAt ?? new Date().toISOString(),
                  },
                }
              : prev
          );
        }
        return;
      }
      if (payload.snapshot) {
        setProposal((prev) => (prev ? { ...prev, snapshot: payload.snapshot } : prev));
      }
      setGuestMessage('Guest count updated. We will review staffing and pricing changes.');
    } finally {
      setSavingGuests(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8 text-center">
          {logoUrl && (
            <div className="mb-3 flex justify-center">
              <img src={logoUrl} alt={snapshot.businessName} className="h-14 w-auto max-w-[220px] object-contain" />
            </div>
          )}
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

        {/* Guest Change Window */}
        <div className="mb-5 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">Guest Count Window</h2>
          {!guestLocked ? (
            <p className="mb-4 text-sm text-text-secondary">
              You can update guest count until <span className="font-medium text-text-primary">{formatDateTime(cutoffAt)}</span>.
            </p>
          ) : (
            <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
              Guest count is now locked. Contact us directly for urgent changes.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Adults</label>
              <input
                type="number"
                min={1}
                value={editingAdults}
                disabled={guestLocked}
                onChange={(e) => setEditingAdults(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Children</label>
              <input
                type="number"
                min={0}
                value={editingChildren}
                disabled={guestLocked}
                onChange={(e) => setEditingChildren(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
          {!guestLocked && (
            <button
              type="button"
              onClick={handleSaveGuestCount}
              disabled={savingGuests}
              className="mt-4 inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
            >
              {savingGuests ? 'Saving…' : 'Save Guest Count'}
            </button>
          )}
          {guestMessage && (
            <p className={`mt-3 text-sm ${guestLocked ? 'text-amber-700 dark:text-amber-400' : 'text-text-secondary'}`}>
              {guestMessage}
            </p>
          )}
        </div>

        {/* Menu Summary */}
        <div className="mb-5 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">Menu Change Requests</h2>
          {!menuLocked ? (
            <p className="mb-4 text-sm text-text-secondary">
              Self-service menu change requests are open until <span className="font-medium text-text-primary">{formatDateTime(menuCutoffAt)}</span>.
            </p>
          ) : (
            <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
              {snapshot.menuChangeLockedReason || 'Menu self-service changes are locked 2 days before the event.'}
              {' '}You can still submit a late request and we will review availability.
            </p>
          )}
          <label className="mb-1 block text-xs font-medium text-text-secondary">Requested menu updates</label>
          <textarea
            rows={3}
            value={menuRequestNote}
            onChange={(e) => setMenuRequestNote(e.target.value)}
            placeholder="Example: Swap 4 guests from steak to chicken, no mushrooms on veggies."
            className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmitMenuRequest}
              disabled={savingMenuRequest}
              className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
            >
              {savingMenuRequest ? 'Submitting…' : menuLocked ? 'Submit Late Request' : 'Submit Menu Request'}
            </button>
            {snapshot.menuChangeRequestStatus && snapshot.menuChangeRequestStatus !== 'none' && (
              <span className="text-xs font-medium text-text-muted">
                Status: {snapshot.menuChangeRequestStatus}
              </span>
            )}
          </div>
          {menuRequestMessage && (
            <p className="mt-3 text-sm text-text-secondary">{menuRequestMessage}</p>
          )}
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

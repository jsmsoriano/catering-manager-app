'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ClipboardDocumentListIcon, PaperAirplaneIcon, LinkIcon } from '@heroicons/react/24/outline';
import type { Booking } from '@/lib/bookingTypes';
import type { MoneyRules } from '@/lib/types';
import type { ProposalSnapshot } from '@/lib/proposalTypes';
import { DEFAULT_PRIVATE_DINNER_TEMPLATE, type PrivateDinnerTemplate } from '@/lib/menuTypes';
import InlineEventMenuComposer from '@/components/event-menu/InlineEventMenuComposer';
import type { MenuStatus, TemplateMenu } from './bookingFormTypes';

function loadPrivateDinnerTemplate(): PrivateDinnerTemplate {
  if (typeof window === 'undefined') return DEFAULT_PRIVATE_DINNER_TEMPLATE;
  try {
    const raw = localStorage.getItem('privateDinnerTemplate');
    return raw ? (JSON.parse(raw) as PrivateDinnerTemplate) : DEFAULT_PRIVATE_DINNER_TEMPLATE;
  } catch {
    return DEFAULT_PRIVATE_DINNER_TEMPLATE;
  }
}

interface MenuTabProps {
  booking: Booking;
  rules: MoneyRules;
  menuStatus: MenuStatus | null;
  templateMenus: TemplateMenu[];
  proposalSnapshot: ProposalSnapshot | null;
  menuChangeActionLoading: boolean;
  menuChangeActionMessage: string | null;
  canManageMenuRequests: boolean;
  onResolveMenuChange: (status: 'approved' | 'declined') => Promise<void>;
  onCloneTemplate: (template: TemplateMenu) => void;
}

export function MenuTab({
  booking,
  rules,
  menuStatus,
  templateMenus,
  proposalSnapshot,
  menuChangeActionLoading,
  menuChangeActionMessage,
  canManageMenuRequests,
  onResolveMenuChange,
  onCloneTemplate,
}: MenuTabProps) {
  const [menuLinkUrl, setMenuLinkUrl] = useState<string | null>(null);
  const [sendingMenuLink, setSendingMenuLink] = useState(false);
  const [menuLinkError, setMenuLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isPrivateDinner = booking.eventType === 'private-dinner';

  const handleSendMenuLink = async () => {
    if (!booking.customerEmail || !isPrivateDinner) return;
    setSendingMenuLink(true);
    setMenuLinkError(null);
    try {
      const template = loadPrivateDinnerTemplate();
      const snapshot = {
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        eventDate: booking.eventDate,
        eventTime: booking.eventTime,
        location: booking.location,
        adults: booking.adults,
        children: booking.children ?? 0,
        businessName: 'Hibachi A Go Go',
        baseProteins: template.baseProteins
          .filter((p) => p.enabled)
          .map(({ protein, label }) => ({ protein, label })),
        upgradeProteins: template.upgrades
          .filter((u) => u.enabled)
          .map(({ protein, label }) => ({ protein, label })),
        inclusions: template.inclusions,
      };
      const res = await fetch('/api/menu-token/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, snapshot }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMenuLinkError(err.error ?? 'Failed to generate menu link.');
        return;
      }
      const { url } = await res.json();
      setMenuLinkUrl(url);
    } catch {
      setMenuLinkError('Network error. Please try again.');
    } finally {
      setSendingMenuLink(false);
    }
  };

  const handleCopy = () => {
    if (!menuLinkUrl) return;
    navigator.clipboard.writeText(menuLinkUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card-elevated p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Menu creation</h2>
        {menuStatus && (
          menuStatus.exists ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                {booking.eventType === 'private-dinner'
                  ? `${menuStatus.guestsDone}/${menuStatus.totalGuests} guests`
                  : `${menuStatus.itemCount} item${menuStatus.itemCount !== 1 ? 's' : ''}`}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  menuStatus.approvalStatus === 'approved'
                    ? 'bg-success/15 text-success'
                    : menuStatus.approvalStatus === 'ready'
                    ? 'bg-info/15 text-info'
                    : 'bg-warning/15 text-warning'
                }`}
              >
                {menuStatus.approvalStatus === 'approved'
                  ? 'Approved'
                  : menuStatus.approvalStatus === 'ready'
                  ? 'Ready'
                  : 'Draft'}
              </span>
            </div>
          ) : (
            <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
              No menu yet
            </span>
          )
        )}
      </div>

      {proposalSnapshot?.menuChangeRequestNote && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">Client menu change request</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                proposalSnapshot.menuChangeRequestStatus === 'approved'
                  ? 'bg-success/15 text-success'
                  : proposalSnapshot.menuChangeRequestStatus === 'declined'
                  ? 'bg-danger/15 text-danger'
                  : 'bg-warning/15 text-warning'
              }`}
            >
              {proposalSnapshot.menuChangeRequestStatus ?? 'pending'}
            </span>
            {proposalSnapshot.menuChangeRequestLate && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
                Late request
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">
            {proposalSnapshot.menuChangeRequestNote}
          </p>
          {proposalSnapshot.menuChangeRequestedAt && (
            <p className="mt-2 text-xs text-text-muted">
              Requested {new Date(proposalSnapshot.menuChangeRequestedAt).toLocaleString()}
            </p>
          )}
          {proposalSnapshot.menuChangeResolvedAt && (
            <p className="mt-1 text-xs text-text-muted">
              Resolved {new Date(proposalSnapshot.menuChangeResolvedAt).toLocaleString()}
              {proposalSnapshot.menuChangeResolvedBy ? ` by ${proposalSnapshot.menuChangeResolvedBy}` : ''}
              {proposalSnapshot.menuChangeResolutionNote ? ` · ${proposalSnapshot.menuChangeResolutionNote}` : ''}
            </p>
          )}
          {proposalSnapshot.menuChangeRequestStatus === 'pending' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canManageMenuRequests ? (
                <>
                  <button
                    type="button"
                    onClick={() => onResolveMenuChange('approved')}
                    disabled={menuChangeActionLoading}
                    className="rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    Approve request
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveMenuChange('declined')}
                    disabled={menuChangeActionLoading}
                    className="rounded-md border border-border bg-card-elevated px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-card disabled:opacity-60"
                  >
                    Decline request
                  </button>
                </>
              ) : (
                <p className="text-xs text-text-muted">Manager/admin approval required.</p>
              )}
            </div>
          )}
          {menuChangeActionMessage && (
            <p className="mt-2 text-xs text-text-secondary">{menuChangeActionMessage}</p>
          )}
        </div>
      )}

      <InlineEventMenuComposer booking={booking} rules={rules} />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/bookings/menu?bookingId=${booking.id}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-card-elevated"
        >
          <ClipboardDocumentListIcon className="h-4 w-4" />
          Open Full Menu Editor
        </Link>
      </div>

      {/* ── Customer Menu Link (private dinner only) ── */}
      {isPrivateDinner && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Customer Menu Form</p>
              <p className="text-xs text-text-muted">Send a link to the client to collect each guest&apos;s order.</p>
            </div>
            <button
              type="button"
              onClick={handleSendMenuLink}
              disabled={sendingMenuLink || !booking.customerEmail}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PaperAirplaneIcon className="h-3.5 w-3.5" />
              {sendingMenuLink ? 'Generating…' : menuLinkUrl ? 'Regenerate Link' : 'Generate Link'}
            </button>
          </div>

          {!booking.customerEmail && (
            <p className="text-xs text-warning">A customer email is required to generate a menu link.</p>
          )}

          {menuLinkError && (
            <p className="mt-2 text-xs text-danger">{menuLinkError}</p>
          )}

          {menuLinkUrl && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-card-elevated px-3 py-2">
              <LinkIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="flex-1 truncate text-xs text-text-secondary">{menuLinkUrl}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/10"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <a
                href={menuLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                Open ↗
              </a>
            </div>
          )}
        </div>
      )}

      {templateMenus.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-text-secondary">Or use a saved template:</p>
          <div className="space-y-2">
            {templateMenus.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md bg-card-elevated px-3 py-2">
                <span className="text-sm text-text-primary">{t.name}</span>
                <button
                  type="button"
                  onClick={() => onCloneTemplate(t)}
                  className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90"
                >
                  Use this menu
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

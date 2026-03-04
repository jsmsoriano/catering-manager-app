'use client';

import Link from 'next/link';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import type { Booking } from '@/lib/bookingTypes';
import type { MoneyRules } from '@/lib/types';
import type { ProposalSnapshot } from '@/lib/proposalTypes';
import InlineEventMenuComposer from '@/components/event-menu/InlineEventMenuComposer';
import type { MenuStatus, TemplateMenu } from './bookingFormTypes';

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

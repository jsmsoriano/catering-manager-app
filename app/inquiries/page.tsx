'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  InboxIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  MapPinIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import { useBookingsQuery } from '@/lib/hooks/useBookingsQuery';
import {
  normalizeBookingWorkflowFields,
  getBookingServiceStatus,
  toLocalDateISO,
} from '@/lib/bookingWorkflow';
import type { Booking } from '@/lib/bookingTypes';
import type { EventMenu, GuestMenuSelection } from '@/lib/menuTypes';
import type { ProposalSnapshot } from '@/lib/proposalTypes';
import { calculateGuestChangeCutoffISO } from '@/lib/guestChangePolicy';
import { calculateMenuChangeCutoffISO } from '@/lib/menuChangePolicy';
import { createLocalProposalToken } from '@/lib/localProposalTokens';
import { loadProposalWriterConfig } from '@/lib/proposalWriter';
import CRMPanel from '@/components/CRMPanel';
import { normalizeCustomerId } from '@/lib/useCustomers';
import { addCrmActivity } from '@/lib/crmStorage';
import { appendQuoteRevision } from '@/lib/quoteRevisionLog';
import QuoteVersionHistory from '@/components/QuoteVersionHistory';
import { runPipelineStageAutomation } from '@/lib/crmAutomation';
import { getLeadSourceLabel } from '@/lib/leadSources';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertType =
  | 'overdue-deposit'
  | 'deposit-soon'
  | 'overdue-balance'
  | 'balance-soon'
  | 'no-staff'
  | 'prep-deadline'
  | 'event-tomorrow';

interface SmartAlert {
  id: string;
  booking: Booking;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  emailType?: 'deposit_reminder' | 'balance_reminder';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const EVENT_LABELS: Record<string, string> = {
  'private-dinner': 'Private Dinner',
  'buffet':         'Buffet',
};

// ─── Alert style maps ────────────────────────────────────────────────────────

const SEVERITY_BORDER: Record<AlertSeverity, string> = {
  critical: 'border-danger/40 bg-danger/5',
  warning:  'border-amber-400/40 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5',
  info:     'border-border bg-card-elevated',
};

const SEVERITY_TITLE: Record<AlertSeverity, string> = {
  critical: 'text-danger',
  warning:  'text-amber-700 dark:text-amber-400',
  info:     'text-text-primary',
};

const SEVERITY_ICON: Record<AlertSeverity, React.ReactElement> = {
  critical: <ExclamationTriangleIcon className="h-5 w-5 text-danger shrink-0" />,
  warning:  <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0" />,
  info:     <BellAlertIcon className="h-5 w-5 text-accent shrink-0" />,
};

function buildTestInquiry(idSuffix: number, daysOut: number): Booking {
  const now = new Date();
  const eventDate = new Date(now.getTime() + daysOut * 24 * 60 * 60 * 1000);
  const isoDate = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
  const createdAt = new Date(now.getTime() - idSuffix * 60 * 60 * 1000).toISOString();
  const isPrivateDinner = idSuffix % 2 === 0;
  const adults = isPrivateDinner ? 18 : 50;
  const children = isPrivateDinner ? 2 : 0;
  const subtotal = isPrivateDinner ? 1240 : 1600;
  const gratuity = Math.round(subtotal * 0.2 * 100) / 100;
  const distanceFee = 45;
  const total = subtotal + gratuity + distanceFee;
  const depositAmount = Math.round(total * 0.3 * 100) / 100;
  const depositDueDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const depositDueIso = `${depositDueDate.getFullYear()}-${String(depositDueDate.getMonth() + 1).padStart(2, '0')}-${String(depositDueDate.getDate()).padStart(2, '0')}`;
  const occasion = isPrivateDinner ? 'Birthday Party' : 'Corporate Event';
  const noteLines = [
    `Occasion: ${occasion}`,
    isPrivateDinner
      ? 'Guest requested premium proteins and extra garlic butter.'
      : 'Buffet setup requested. No chef entertainment/show.',
    'One guest has shellfish allergy.',
  ];

  return normalizeBookingWorkflowFields({
    id: `inquiry-test-${Date.now()}-${idSuffix}`,
    eventType: isPrivateDinner ? 'private-dinner' : 'buffet',
    eventDate: isoDate,
    eventTime: isPrivateDinner ? '18:00' : '17:30',
    customerName: isPrivateDinner ? `Jane Birthday ${idSuffix}` : `Acme Corporate ${idSuffix}`,
    customerEmail: `test${idSuffix}@example.com`,
    customerPhone: '(555)-555-5555',
    adults,
    children,
    location: '123 Test Ave, Test City',
    distanceMiles: 10,
    premiumAddOn: 0,
    subtotal,
    gratuity,
    distanceFee,
    total,
    status: 'pending',
    serviceStatus: 'pending',
    depositPercent: 30,
    depositAmount,
    depositDueDate: depositDueIso,
    balanceDueDate: isoDate,
    notes: noteLines.join('\n'),
    source: 'inquiry',
    pipeline_status: 'inquiry',
    pipeline_status_updated_at: createdAt,
    sourceChannel: 'test-seed',
    nextFollowUpAt: calculateGuestChangeCutoffISO(isoDate),
    createdAt,
    updatedAt: createdAt,
  });
}

// ─── Inquiry row ──────────────────────────────────────────────────────────────

function InquiryRow({
  inquiry,
  selected,
  onClick,
}: {
  inquiry: Booking;
  selected: boolean;
  onClick: () => void;
}) {
  const isNew = !inquiry.notes?.includes('[reviewed]');
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-card-elevated ${
        selected ? 'border-l-2 border-l-accent bg-accent/5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-text-primary">{inquiry.customerName}</p>
            {isNew && (
              <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                NEW
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {formatDate(inquiry.eventDate)} · {inquiry.adults + inquiry.children} guests
          </p>
        </div>
        <p className="shrink-0 text-xs text-text-muted">{formatDateTime(inquiry.createdAt)}</p>
      </div>
    </button>
  );
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  sendingId,
  onSendReminder,
}: {
  alert: SmartAlert;
  sendingId: string | null;
  onSendReminder: (alert: SmartAlert) => void;
}) {
  const isSending = sendingId === alert.id;
  const hasEmail = !!alert.booking.customerEmail;
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${SEVERITY_BORDER[alert.severity]}`}>
      {SEVERITY_ICON[alert.severity]}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${SEVERITY_TITLE[alert.severity]}`}>{alert.title}</p>
        <p className="text-xs text-text-muted">
          {alert.booking.customerName} · {formatDate(alert.booking.eventDate)}
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">{alert.detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {alert.emailType && hasEmail && (
          <button
            type="button"
            disabled={isSending}
            onClick={() => onSendReminder(alert)}
            className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
            title={`Send reminder to ${alert.booking.customerEmail}`}
          >
            {isSending ? 'Sending…' : 'Send Reminder'}
          </button>
        )}
        <Link
          href={alert.actionHref}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-card-elevated"
        >
          {alert.actionLabel} →
        </Link>
      </div>
    </div>
  );
}

// ─── Notifications Content ────────────────────────────────────────────────────

function NotificationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'alerts' ? 'alerts' : 'inquiries';

  const { loading: authLoading } = useAuth();
  const { config } = useTemplateConfig();

  const { bookings: allBookings, saveBooking, addBooking } = useBookingsQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guestMenu, setGuestMenu] = useState<GuestMenuSelection[] | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [reminderToast, setReminderToast] = useState<string | null>(null);
  const [seedingInquiries, setSeedingInquiries] = useState(false);
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);
  const [quotePreviewSnapshot, setQuotePreviewSnapshot] = useState<ProposalSnapshot | null>(null);
  const [quoteSendToEmail, setQuoteSendToEmail] = useState('');
  const [quoteRevisionReason, setQuoteRevisionReason] = useState('');


  // ── Inquiries ──────────────────────────────────────────────────────────────
  const inquiries = useMemo(
    () =>
      allBookings
        .filter((b) => b.source === 'inquiry')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allBookings]
  );

  const selectedInquiry = useMemo(
    () => inquiries.find((i) => i.id === selectedId) ?? null,
    [inquiries, selectedId]
  );
  const selectedInquiryCustomerId = useMemo(
    () =>
      selectedInquiry
        ? normalizeCustomerId(selectedInquiry.customerPhone ?? '', selectedInquiry.customerEmail ?? '')
        : undefined,
    [selectedInquiry]
  );

  // Auto-select first inquiry on load
  useEffect(() => {
    if (activeTab === 'inquiries' && inquiries.length > 0 && selectedId === null) {
      setSelectedId(inquiries[0].id);
    }
  }, [inquiries, selectedId, activeTab]);

  // Load guest menu from Supabase when selection changes
  useEffect(() => {
    if (!selectedId) { setGuestMenu(null); return; }
    setGuestMenu(null);
    setMenuLoading(true);

    const supabase = createClient();
    if (!supabase) { setMenuLoading(false); return; }

    supabase
      .from('event_menus')
      .select('guest_selections')
      .eq('booking_id', selectedId)
      .maybeSingle()
      .then(({ data }) => {
        setGuestMenu(data?.guest_selections ?? null);
        setMenuLoading(false);
      });
  }, [selectedId]);

  // ── Smart Alerts ───────────────────────────────────────────────────────────
  const alerts = useMemo((): SmartAlert[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = toLocalDateISO(today);
    const results: SmartAlert[] = [];

    for (const raw of allBookings) {
      const b = normalizeBookingWorkflowFields(raw);
      const svc = getBookingServiceStatus(b);

      // Skip inquiries, cancelled, completed, locked
      if (b.source === 'inquiry') continue;
      if (svc === 'cancelled' || svc === 'completed') continue;
      if (b.locked) continue;

      const href = `/bookings?bookingId=${b.id}`;

      // Overdue deposit
      if (b.paymentStatus === 'deposit-due' && b.depositDueDate && b.depositDueDate < todayISO) {
        const days = differenceInCalendarDays(today, parseISO(b.depositDueDate));
        results.push({
          id: `${b.id}:overdue-deposit`, booking: b, type: 'overdue-deposit', severity: 'critical',
          title: 'Deposit Overdue',
          detail: `Was due ${formatDate(b.depositDueDate)} · ${days} day${days !== 1 ? 's' : ''} ago`,
          actionLabel: 'Record Payment', actionHref: href,
          emailType: 'deposit_reminder',
        });
      // Deposit due soon (within 3 days, not overdue)
      } else if (b.paymentStatus === 'deposit-due' && b.depositDueDate && b.depositDueDate >= todayISO) {
        const days = differenceInCalendarDays(parseISO(b.depositDueDate), today);
        if (days <= 3) {
          results.push({
            id: `${b.id}:deposit-soon`, booking: b, type: 'deposit-soon', severity: 'warning',
            title: 'Deposit Due Soon',
            detail: `Due in ${days} day${days !== 1 ? 's' : ''} (${formatDate(b.depositDueDate)})`,
            actionLabel: 'Record Payment', actionHref: href,
            emailType: 'deposit_reminder',
          });
        }
      }

      // Overdue balance
      if (b.paymentStatus === 'balance-due' && b.balanceDueDate && b.balanceDueDate < todayISO) {
        const days = differenceInCalendarDays(today, parseISO(b.balanceDueDate));
        results.push({
          id: `${b.id}:overdue-balance`, booking: b, type: 'overdue-balance', severity: 'critical',
          title: 'Balance Overdue',
          detail: `Was due ${formatDate(b.balanceDueDate)} · ${days} day${days !== 1 ? 's' : ''} ago`,
          actionLabel: 'Record Payment', actionHref: href,
          emailType: 'balance_reminder',
        });
      // Balance due soon (within 5 days)
      } else if (b.paymentStatus === 'balance-due' && b.balanceDueDate && b.balanceDueDate >= todayISO) {
        const days = differenceInCalendarDays(parseISO(b.balanceDueDate), today);
        if (days <= 5) {
          results.push({
            id: `${b.id}:balance-soon`, booking: b, type: 'balance-soon', severity: 'warning',
            title: 'Balance Due Soon',
            detail: `Due in ${days} day${days !== 1 ? 's' : ''} (${formatDate(b.balanceDueDate)})`,
            actionLabel: 'Record Payment', actionHref: href,
            emailType: 'balance_reminder',
          });
        }
      }

      // No staff assigned — confirmed event within 14 days
      if (svc === 'confirmed' && (!b.staffAssignments || b.staffAssignments.length === 0)) {
        const days = differenceInCalendarDays(parseISO(b.eventDate), today);
        if (days >= 0 && days <= 14) {
          results.push({
            id: `${b.id}:no-staff`, booking: b, type: 'no-staff', severity: 'warning',
            title: 'No Staff Assigned',
            detail: `Event in ${days} day${days !== 1 ? 's' : ''} — no staff assigned yet`,
            actionLabel: 'Edit Booking', actionHref: href,
          });
        }
      }

      // Prep purchase deadline today or passed
      if (b.prepPurchaseByDate && b.prepPurchaseByDate <= todayISO && svc === 'confirmed') {
        const days = differenceInCalendarDays(today, parseISO(b.prepPurchaseByDate));
        results.push({
          id: `${b.id}:prep-deadline`, booking: b, type: 'prep-deadline', severity: 'warning',
          title: 'Prep Deadline Passed',
          detail: `Buy ingredients by ${formatDate(b.prepPurchaseByDate)}${days > 0 ? ` · ${days} day${days !== 1 ? 's' : ''} ago` : ''}`,
          actionLabel: 'Shopping List', actionHref: `/bookings/shopping?bookingId=${b.id}`,
        });
      }

      // Event tomorrow
      const daysToEvent = differenceInCalendarDays(parseISO(b.eventDate), today);
      if (daysToEvent === 1 && svc === 'confirmed') {
        results.push({
          id: `${b.id}:event-tomorrow`, booking: b, type: 'event-tomorrow', severity: 'info',
          title: 'Event Tomorrow',
          detail: `${b.adults + (b.children ?? 0)} guests · ${b.location || 'No location set'}`,
          actionLabel: 'View Booking', actionHref: href,
        });
      }
    }

    // Sort: critical → warning → info, then by eventDate ascending
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return results.sort((a, z) =>
      order[a.severity] !== order[z.severity]
        ? order[a.severity] - order[z.severity]
        : a.booking.eventDate.localeCompare(z.booking.eventDate)
    );
  }, [allBookings]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!selectedInquiry) return;
    setConverting(true);
    const now = new Date().toISOString();
    const prevStage = selectedInquiry.pipeline_status ?? 'inquiry';
    const updated = {
      ...selectedInquiry,
      source: undefined,
      pipeline_status: 'qualified' as const,
      pipeline_status_updated_at: now,
      updatedAt: now,
    };
    await saveBooking(updated as Booking);
    runPipelineStageAutomation({
      booking: updated as Booking,
      prevStage,
      nextStage: 'qualified',
    });
    addCrmActivity({
      bookingId: selectedInquiry.id,
      customerId: normalizeCustomerId(selectedInquiry.customerPhone ?? '', selectedInquiry.customerEmail ?? ''),
      type: 'booking_converted',
      text: 'Inquiry converted to booking.',
    });
    setSelectedId(null);
    setConverting(false);
    router.push(`/bookings?bookingId=${selectedInquiry.id}`);
  };

  const handleQualifyLead = () => {
    if (!selectedInquiry) return;
    const now = new Date().toISOString();
    const prevStage = selectedInquiry.pipeline_status ?? 'inquiry';
    const updated = {
      ...selectedInquiry,
      pipeline_status: 'qualified' as const,
      pipeline_status_updated_at: now,
      updatedAt: now,
    };
    saveBooking(updated as Booking);
    runPipelineStageAutomation({
      booking: updated as Booking,
      prevStage,
      nextStage: 'qualified',
    });
    addCrmActivity({
      bookingId: selectedInquiry.id,
      customerId: normalizeCustomerId(selectedInquiry.customerPhone ?? '', selectedInquiry.customerEmail ?? ''),
      type: 'note',
      text: 'Lead qualified after inquiry review.',
    });
    setReminderToast('Lead moved to Qualified stage.');
    setTimeout(() => setReminderToast(null), 2400);
  };

  const handleStartFollowUp = () => {
    if (!selectedInquiry) return;
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const updated = {
      ...selectedInquiry,
      pipeline_status: 'follow_up' as const,
      pipeline_status_updated_at: now,
      lastContactedAt: now,
      nextFollowUpAt: tomorrow,
      updatedAt: now,
    };
    saveBooking(updated as Booking);
    addCrmActivity({
      bookingId: selectedInquiry.id,
      customerId: normalizeCustomerId(selectedInquiry.customerPhone ?? '', selectedInquiry.customerEmail ?? ''),
      type: 'email',
      text: 'Follow-up sequence started.',
    });
    setReminderToast('Lead moved to Follow-up stage.');
    setTimeout(() => setReminderToast(null), 2400);
  };

  const handleSeedTestInquiries = async () => {
    setSeedingInquiries(true);
    const seeded = [buildTestInquiry(1, 7), buildTestInquiry(2, 14), buildTestInquiry(3, 21)];
    await Promise.all(seeded.map((b) => addBooking(b)));
    const firstSeeded = seeded[0]?.id ?? null;
    if (firstSeeded) setSelectedId(firstSeeded);
    setReminderToast('Loaded 3 test inquiries.');
    setTimeout(() => setReminderToast(null), 2200);
    setSeedingInquiries(false);
  };

  const buildQuoteSnapshot = (inquiry: Booking, nowIso: string): ProposalSnapshot => ({
    customerName: inquiry.customerName,
    customerEmail: inquiry.customerEmail,
    eventDate: inquiry.eventDate,
    eventTime: inquiry.eventTime || '18:00',
    location: inquiry.location || '',
    adults: inquiry.adults,
    children: inquiry.children ?? 0,
    eventType: EVENT_LABELS[inquiry.eventType] ?? inquiry.eventType,
    subtotal: inquiry.subtotal ?? 0,
    gratuity: inquiry.gratuity ?? 0,
    distanceFee: inquiry.distanceFee ?? 0,
    total: inquiry.total ?? 0,
    depositAmount: inquiry.depositAmount,
    depositDueDate: inquiry.depositDueDate,
    balanceDueDate: inquiry.balanceDueDate,
    notes: inquiry.notes,
    businessName: config.businessName || 'Your Caterer',
    logoUrl: config.logoUrl,
    sentAt: nowIso,
    quoteVersion: inquiry.quoteVersion ?? 1,
    guestChangeCutoffAt: calculateGuestChangeCutoffISO(inquiry.eventDate),
    menuChangeCutoffAt: calculateMenuChangeCutoffISO(inquiry.eventDate),
  });

  const handleOpenQuotePreview = () => {
    if (!selectedInquiry) return;
    const snapshot = buildQuoteSnapshot(selectedInquiry, new Date().toISOString());
    setQuotePreviewSnapshot(snapshot);
    setQuoteSendToEmail(selectedInquiry.customerEmail ?? '');
    setQuoteRevisionReason('');
    setQuotePreviewOpen(true);
  };

  const handleSendQuote = async () => {
    if (!selectedInquiry) return;
    setQuotePreviewOpen(false);
    setSendingQuote(true);

    const now = new Date().toISOString();
    const followUpAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const businessName = config.businessName || 'Your Caterer';
    const isRevision = !!selectedInquiry.proposalToken;
    const currentQuoteVersion = selectedInquiry.quoteVersion ?? (isRevision ? 1 : 0);
    const nextQuoteVersion = isRevision ? Math.max(2, currentQuoteVersion + 1) : 1;

    let proposalToken = selectedInquiry.proposalToken;
    let proposalSentAt = selectedInquiry.proposalSentAt;
    let statusMessage = isRevision ? 'Quote updated.' : 'Quote marked as sent.';

    if (selectedInquiry.customerEmail) {
      const snapshot: ProposalSnapshot =
        quotePreviewSnapshot && quotePreviewSnapshot.customerEmail === selectedInquiry.customerEmail
          ? {
              ...quotePreviewSnapshot,
              sentAt: now,
              businessName,
              quoteVersion: nextQuoteVersion,
              quoteRevisionReason: isRevision ? quoteRevisionReason.trim() || 'Pricing/details updated' : undefined,
            }
          : buildQuoteSnapshot(selectedInquiry, now);

      const proposalRes = await fetch(isRevision ? '/api/proposals/update' : '/api/proposals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRevision
            ? { token: selectedInquiry.proposalToken, snapshot }
            : { snapshot, bookingId: selectedInquiry.id }
        ),
      });

      if (proposalRes.ok) {
        const payload = await proposalRes.json();
        const token = payload.token as string;
        const url = payload.url as string;
        proposalToken = token;
        proposalSentAt = now;

        const emailRes = await fetch('/api/emails/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'proposal',
            booking: {
              ...selectedInquiry,
              customerEmail: quoteSendToEmail.trim() || selectedInquiry.customerEmail,
            },
            businessName,
            logoUrl: config.logoUrl,
            proposalUrl: url,
            snapshot,
            proposalContent: loadProposalWriterConfig(),
          }),
        });

        if (emailRes.ok) {
          const payload = await emailRes.json().catch(() => ({} as { deliveredTo?: string }));
          statusMessage = isRevision
            ? `Quote v${nextQuoteVersion} sent to ${payload.deliveredTo ?? selectedInquiry.customerEmail}.`
            : `Quote sent to ${payload.deliveredTo ?? selectedInquiry.customerEmail}.`;
        } else {
          const err = await emailRes.json().catch(() => ({} as { error?: string }));
          statusMessage = isRevision
            ? `Quote v${nextQuoteVersion} updated, but email failed${err.error ? `: ${err.error}` : '.'}`
            : `Quote marked sent, but email failed${err.error ? `: ${err.error}` : '.'}`;
        }
      } else {
        const err = await proposalRes.json().catch(() => ({} as { error?: string }));
        const local = createLocalProposalToken({
          bookingId: selectedInquiry.id,
          snapshot,
        });
        proposalToken = local.token;
        proposalSentAt = now;
        statusMessage = isRevision
          ? `Quote v${nextQuoteVersion} saved using local test link.`
          : 'Quote marked sent using local test link. Use Open Client Portal to preview.';
      }
    } else {
      statusMessage = 'Quote marked as sent (no customer email on file).';
    }

    const updated = {
      ...selectedInquiry,
      pipeline_status: 'quote_sent' as const,
      pipeline_status_updated_at: now,
      proposalToken,
      proposalSentAt: proposalSentAt ?? now,
      lastContactedAt: now,
      nextFollowUpAt: followUpAt,
      quoteVersion: nextQuoteVersion,
      quoteRevisionCount: Math.max(0, nextQuoteVersion - 1),
      lastQuoteRevisionReason: isRevision ? quoteRevisionReason.trim() || 'Pricing/details updated' : undefined,
      lastQuoteRevisedAt: isRevision ? now : undefined,
      updatedAt: now,
    };
    await saveBooking(updated as Booking);
    runPipelineStageAutomation({
      booking: updated as Booking,
      prevStage: selectedInquiry.pipeline_status ?? 'inquiry',
      nextStage: 'quote_sent',
    });
    appendQuoteRevision({
      bookingId: selectedInquiry.id,
      quoteVersion: nextQuoteVersion,
      sentAt: now,
      sentTo: quoteSendToEmail.trim() || selectedInquiry.customerEmail || undefined,
      reason: isRevision ? quoteRevisionReason.trim() || 'Pricing/details updated' : 'Initial quote',
      mode: isRevision ? 'revision' : 'initial',
    });
    addCrmActivity({
      bookingId: selectedInquiry.id,
      customerId: normalizeCustomerId(selectedInquiry.customerPhone ?? '', selectedInquiry.customerEmail ?? ''),
      type: 'quote_sent',
      text: statusMessage,
    });

    setReminderToast(statusMessage);
    setTimeout(() => setReminderToast(null), 4000);
    setSendingQuote(false);
  };

  const handleDecline = async () => {
    if (!selectedInquiry) return;
    setDeclining(true);
    const now = new Date().toISOString();
    const updated = {
      ...selectedInquiry,
      status: 'cancelled' as const,
      source: 'inquiry-declined',
      pipeline_status: 'declined' as const,
      pipeline_status_updated_at: now,
      updatedAt: now,
    };
    await saveBooking(updated as Booking);
    addCrmActivity({
      bookingId: selectedInquiry.id,
      customerId: normalizeCustomerId(selectedInquiry.customerPhone ?? '', selectedInquiry.customerEmail ?? ''),
      type: 'inquiry_declined',
      text: 'Inquiry marked as declined.',
    });
    setSelectedId(null);
    setDeclining(false);
  };

  const handleSendReminder = async (alert: SmartAlert) => {
    if (!alert.emailType || !alert.booking.customerEmail) return;
    setSendingReminderId(alert.id);
    try {
      await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: alert.emailType,
          booking: alert.booking,
          businessName: config.businessName || 'Your Caterer',
        }),
      });
      setReminderToast(`Reminder sent to ${alert.booking.customerEmail}`);
      setTimeout(() => setReminderToast(null), 4000);
    } finally {
      setSendingReminderId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">Loading…</p>
      </div>
    );
  }

  const totalBadge = inquiries.filter((i) => !i.notes?.includes('[reviewed]')).length + alerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
          {totalBadge > 0 && (
            <span className="rounded-full bg-danger px-2.5 py-0.5 text-sm font-semibold text-white">
              {totalBadge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-text-secondary">
          Customer inquiries and booking alerts
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border bg-card px-8">
        <nav className="-mb-px flex gap-6">
          <Link
            href="/inquiries"
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-sm font-medium ${
              activeTab === 'inquiries'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:border-border hover:text-text-primary'
            }`}
          >
            <InboxIcon className="h-4 w-4" />
            Inquiries
            {inquiries.length > 0 && (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                {inquiries.length}
              </span>
            )}
          </Link>
          <Link
            href="/inquiries?tab=alerts"
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-sm font-medium ${
              activeTab === 'alerts'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:border-border hover:text-text-primary'
            }`}
          >
            <BellAlertIcon className="h-4 w-4" />
            Alerts
            {alerts.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                alerts.some((a) => a.severity === 'critical')
                  ? 'bg-danger text-white'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
              }`}>
                {alerts.length}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {reminderToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-w-md rounded-lg bg-success px-5 py-4 text-center text-sm font-medium text-white shadow-xl">
            {reminderToast}
          </div>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'inquiries' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left panel ── */}
          <div className={`shrink-0 flex-col border-r border-border w-full md:w-72 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Inquiry Queue</p>
              <button
                type="button"
                onClick={handleSeedTestInquiries}
                disabled={seedingInquiries}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-text-primary hover:bg-card-elevated disabled:opacity-60"
              >
                {seedingInquiries ? 'Loading…' : 'Load Test'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {inquiries.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-text-muted">
                  <InboxIcon className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No pending inquiries</p>
                  <p className="text-xs">
                    Share{' '}
                    <span className="font-medium text-accent">/inquiry</span>{' '}
                    with your clients
                  </p>
                  <button
                    type="button"
                    onClick={handleSeedTestInquiries}
                    disabled={seedingInquiries}
                    className="mt-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-card-elevated disabled:opacity-60"
                  >
                    {seedingInquiries ? 'Loading…' : 'Load Test Inquiries'}
                  </button>
                </div>
              ) : (
                inquiries.map((inq) => (
                  <InquiryRow
                    key={inq.id}
                    inquiry={inq}
                    selected={inq.id === selectedId}
                    onClick={() => setSelectedId(inq.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className={`flex-1 overflow-y-auto ${selectedId ? 'flex flex-col' : 'hidden md:block'}`}>
            {!selectedInquiry ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
                <InboxIcon className="h-12 w-12 opacity-30" />
                <p className="text-sm">Select an inquiry to review</p>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-6 p-6">
                {/* Mobile back button */}
                <button
                  onClick={() => setSelectedId(null)}
                  className="mb-2 flex items-center gap-1 text-sm font-medium text-accent md:hidden"
                >
                  ← Back to list
                </button>
                {/* Identity + actions */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">
                      {selectedInquiry.customerName}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-text-secondary">
                      {selectedInquiry.customerPhone && (
                        <span className="flex items-center gap-1">
                          <PhoneIcon className="h-3.5 w-3.5" />
                          {selectedInquiry.customerPhone}
                        </span>
                      )}
                      {selectedInquiry.customerEmail && (
                        <span className="flex items-center gap-1">
                          <EnvelopeIcon className="h-3.5 w-3.5" />
                          {selectedInquiry.customerEmail}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      Submitted {formatDateTime(selectedInquiry.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={handleQualifyLead}
                      className="flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-500/20 dark:text-indigo-300"
                    >
                      Qualify Lead
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenQuotePreview}
                      disabled={sendingQuote}
                      className="flex items-center gap-1.5 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-sm font-medium text-info transition-colors hover:bg-info/20 disabled:opacity-50"
                    >
                      <EnvelopeIcon className="h-4 w-4" />
                      {sendingQuote ? 'Sending…' : 'Preview & Send Quote'}
                    </button>
                    {selectedInquiry.proposalToken && (
                      <Link
                        href={`/proposal/${selectedInquiry.proposalToken}`}
                        target="_blank"
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-card"
                      >
                        Open Client Portal
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleStartFollowUp}
                      className="flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
                    >
                      Start Follow-up
                    </button>
                    <button
                      type="button"
                      onClick={handleDecline}
                      disabled={declining}
                      className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
                    >
                      <XCircleIcon className="h-4 w-4" />
                      {declining ? 'Declining…' : 'Decline'}
                    </button>
                    <button
                      type="button"
                      onClick={handleConvert}
                      disabled={converting}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      {converting ? 'Converting…' : 'Convert to Booking'}
                    </button>
                  </div>
                </div>

                {/* Event details card */}
                <div className="rounded-lg border border-border bg-card p-5">
                  <p className="mb-4 text-sm font-medium text-text-secondary">Event Details</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <CalendarDaysIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                      <div>
                        <p className="text-xs text-text-muted">Date &amp; Time</p>
                        <p className="font-medium text-text-primary">
                          {formatDate(selectedInquiry.eventDate)} at {selectedInquiry.eventTime}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <UserGroupIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                      <div>
                        <p className="text-xs text-text-muted">Guest Count</p>
                        <p className="font-medium text-text-primary">
                          {selectedInquiry.adults} adult{selectedInquiry.adults !== 1 ? 's' : ''}
                          {selectedInquiry.children > 0
                            ? `, ${selectedInquiry.children} child${selectedInquiry.children !== 1 ? 'ren' : ''}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-xs text-text-muted">Service Type</p>
                        <p className="font-medium text-text-primary capitalize">
                          {EVENT_LABELS[selectedInquiry.eventType] ?? selectedInquiry.eventType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-xs text-text-muted">Lead Source</p>
                        <p className="font-medium text-text-primary">
                          {getLeadSourceLabel(selectedInquiry.sourceChannel)}
                        </p>
                      </div>
                    </div>
                    {selectedInquiry.location && (
                      <div className="flex items-start gap-2">
                        <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                        <div>
                          <p className="text-xs text-text-muted">Location</p>
                          <p className="font-medium text-text-primary">{selectedInquiry.location}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedInquiry.notes && (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="text-xs text-text-muted">Notes / Special Requests</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">
                        {selectedInquiry.notes}
                      </p>
                    </div>
                  )}
                </div>

                <CRMPanel
                  title="CRM Timeline & Follow-ups"
                  bookingId={selectedInquiry.id}
                  customerId={selectedInquiryCustomerId}
                  scope="event"
                />

                <QuoteVersionHistory bookingId={selectedInquiry.id} />

                {/* Per-guest menu */}
                <div className="rounded-lg border border-border bg-card">
                  <div className="border-b border-border px-5 py-3">
                    <p className="text-sm font-medium text-text-secondary">Guest Menu Selections</p>
                  </div>
                  <div className="p-5">
                    {menuLoading ? (
                      <p className="text-sm text-text-muted">Loading menu…</p>
                    ) : !guestMenu || guestMenu.length === 0 ? (
                      <p className="text-sm text-text-muted">No menu selections submitted.</p>
                    ) : (
                      <div className="space-y-4">
                        {(guestMenu as GuestMenuSelection[]).map((g, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-border bg-card-elevated p-4"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <p className="font-medium text-text-primary">
                                {g.guestName || (g.isAdult ? `Adult ${idx + 1}` : `Child`)}
                              </p>
                              <span className="text-xs text-text-muted">
                                {g.isAdult ? 'Adult' : 'Child'}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm text-text-secondary">
                              <p>
                                <span className="text-text-muted">Proteins:</span>{' '}
                                <span className="capitalize">{g.protein1}</span>
                                {g.protein2 && g.protein2 !== g.protein1 && (
                                  <span className="capitalize"> &amp; {g.protein2}</span>
                                )}
                              </p>
                              <p>
                                <span className="text-text-muted">Sides:</span>{' '}
                                {[
                                  g.wantsFriedRice && 'Fried Rice',
                                  g.wantsNoodles   && 'Noodles',
                                  g.wantsSalad     && 'Salad',
                                  g.wantsVeggies   && 'Veggies',
                                ]
                                  .filter(Boolean)
                                  .join(', ') || 'None'}
                              </p>
                              {(g.upgradeProteins ?? []).length > 0 && (
                                <p>
                                  <span className="text-text-muted">Upgrades:</span>{' '}
                                  <span className="capitalize">
                                    {(g.upgradeProteins ?? []).join(', ')}
                                  </span>
                                </p>
                              )}
                              {g.allergies && (
                                <p>
                                  <span className="text-text-muted">Allergies:</span>{' '}
                                  <span className="text-red-600 dark:text-red-400">{g.allergies}</span>
                                </p>
                              )}
                              {g.specialRequests && (
                                <p>
                                  <span className="text-text-muted">Requests:</span>{' '}
                                  {g.specialRequests}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Alerts tab ── */
        <div className="flex-1 overflow-y-auto p-6">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
              <span className="text-5xl">✓</span>
              <p className="text-base font-medium text-text-primary">All clear — no alerts right now.</p>
              <p className="text-sm">Alerts appear here when bookings need attention.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-3">
              {/* Section headers */}
              {(['critical', 'warning', 'info'] as AlertSeverity[]).map((sev) => {
                const group = alerts.filter((a) => a.severity === sev);
                if (group.length === 0) return null;
                const label = sev === 'critical' ? 'Needs Immediate Attention' : sev === 'warning' ? 'Upcoming Actions' : 'Heads Up';
                return (
                  <div key={sev}>
                    <p className={`mb-2 mt-4 text-xs font-semibold uppercase tracking-wide ${
                      sev === 'critical' ? 'text-danger' : sev === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted'
                    }`}>
                      {label}
                    </p>
                    <div className="space-y-2">
                      {group.map((alert) => (
                        <AlertCard
                          key={alert.id}
                          alert={alert}
                          sendingId={sendingReminderId}
                          onSendReminder={handleSendReminder}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {quotePreviewOpen && quotePreviewSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-text-primary">Quote Preview</h3>
            <p className="mt-1 text-sm text-text-muted">Review before sending.</p>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-text-secondary">Send To Email</label>
              <input
                type="email"
                value={quoteSendToEmail}
                onChange={(e) => setQuoteSendToEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>
            {selectedInquiry?.proposalToken && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-text-secondary">Revision reason</label>
                <textarea
                  value={quoteRevisionReason}
                  onChange={(e) => setQuoteRevisionReason(e.target.value)}
                  rows={2}
                  placeholder="Why this quote was updated (e.g., guest count changed from 25 to 32)"
                  className="w-full resize-none rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
                />
              </div>
            )}
            <div className="mt-3 rounded-md border border-border bg-card-elevated p-3 text-xs">
              <p className="font-medium text-text-secondary">Client Portal Link</p>
              {selectedInquiry?.proposalToken ? (
                <a
                  href={`/proposal/${selectedInquiry.proposalToken}`}
                  target="_blank"
                  className="mt-1 block break-all text-accent hover:underline"
                  rel="noreferrer"
                >
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/proposal/${selectedInquiry.proposalToken}`}
                </a>
              ) : (
                <p className="mt-1 text-text-muted">
                  Link will be generated after you send the quote.
                </p>
              )}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="text-text-muted">Customer:</span> <span className="text-text-primary">{quotePreviewSnapshot.customerName}</span></p>
              <p><span className="text-text-muted">Event:</span> <span className="text-text-primary">{formatDate(quotePreviewSnapshot.eventDate)} at {quotePreviewSnapshot.eventTime}</span></p>
              <p><span className="text-text-muted">Guests:</span> <span className="text-text-primary">{quotePreviewSnapshot.adults + (quotePreviewSnapshot.children ?? 0)}</span></p>
              <p><span className="text-text-muted">Service:</span> <span className="text-text-primary">{quotePreviewSnapshot.eventType}</span></p>
              <p><span className="text-text-muted">Subtotal:</span> <span className="text-text-primary">${(quotePreviewSnapshot.subtotal ?? 0).toFixed(2)}</span></p>
              <p><span className="text-text-muted">Gratuity:</span> <span className="text-text-primary">${(quotePreviewSnapshot.gratuity ?? 0).toFixed(2)}</span></p>
              <p><span className="text-text-muted">Distance Fee:</span> <span className="text-text-primary">${(quotePreviewSnapshot.distanceFee ?? 0).toFixed(2)}</span></p>
              <p className="border-t border-border pt-2"><span className="font-medium text-text-primary">Total: ${(quotePreviewSnapshot.total ?? 0).toFixed(2)}</span></p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuotePreviewOpen(false)}
                className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendQuote}
                disabled={sendingQuote || !quoteSendToEmail.trim()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
              >
                {sendingQuote ? 'Sending…' : selectedInquiry?.proposalToken ? 'Update & Resend Quote' : 'Send Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

function InquiriesPageInner() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-text-muted">Loading…</p>
        </div>
      }
    >
      <NotificationsContent />
    </Suspense>
  );
}

export default function InquiriesPage() {
  return (
    <Suspense>
      <InquiriesPageInner />
    </Suspense>
  );
}

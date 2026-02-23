'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import type { ProposalSnapshot } from '@/lib/proposalTypes';
import { formatPhone, isValidPhone } from '@/lib/phoneUtils';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import { isModuleEnabled, getPricingSlot } from '@/lib/templateConfig';
import type { Booking, BookingStatus, BookingPricingSnapshot } from '@/lib/bookingTypes';
import { getBookingServiceStatus, normalizeBookingWorkflowFields } from '@/lib/bookingWorkflow';
import type { EventMenu, CateringEventMenu } from '@/lib/menuTypes';
import { CATERING_EVENT_MENUS_KEY } from '@/lib/menuCategories';
import type { StaffMember as StaffRecord, StaffAssignment } from '@/lib/staffTypes';
import {
  BOOKING_WIZARD_STEPS,
  getStepIndex,
  getNextStepId,
  getPrevStepId,
  type BookingWizardStepId,
} from '@/lib/bookingWizardSteps';

interface StaffConflict {
  staffId: string;
  staffName: string;
  conflictingBooking: Booking;
}

function getUniqueAssignedStaffIds(assignments?: StaffAssignment[]): string[] {
  if (!assignments || assignments.length === 0) return [];
  const ids = assignments
    .map((a) => a.staffId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  return Array.from(new Set(ids));
}

function getDuplicateAssignedStaffIds(assignments?: StaffAssignment[]): string[] {
  if (!assignments || assignments.length === 0) return [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  assignments.forEach((a) => {
    if (!a.staffId) return;
    if (seen.has(a.staffId)) duplicates.add(a.staffId);
    seen.add(a.staffId);
  });
  return Array.from(duplicates);
}

function getTemplateLabel(labels: Record<string, string> | undefined, key: string, fallback: string): string {
  return labels?.[key] ?? fallback;
}

function saveBookings(bookings: Booking[]) {
  const normalized = bookings.map((b) => normalizeBookingWorkflowFields(b));
  localStorage.setItem('bookings', JSON.stringify(normalized));
  window.dispatchEvent(new Event('bookingsUpdated'));
}

function EventDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;
  const stepParam = searchParams.get('step');

  const rules = useMoneyRules();
  const { config: templateConfig } = useTemplateConfig();
  const [bookings, setBookings] = useState<Booking[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('bookings');
      const list: Booking[] = raw ? JSON.parse(raw) : [];
      return list.filter((b: Booking) => b.source !== 'inquiry');
    } catch {
      return [];
    }
  });
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);
  // Step from URL, with local state so we can update immediately when advancing (avoid useSearchParams delay)
  const [stepId, setStepId] = useState<BookingWizardStepId>(() => {
    if (typeof window === 'undefined') return 'contact';
    const step = new URLSearchParams(window.location.search).get('step');
    return BOOKING_WIZARD_STEPS.some((s) => s.id === step) && step
      ? (step as BookingWizardStepId)
      : 'contact';
  });
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    location: '',
    eventType: 'private-dinner',
    eventDate: '',
    eventTime: '18:00',
    adults: 15,
    children: 0,
    distanceMiles: 10,
    premiumAddOn: 0,
    notes: '',
    serviceStatus: 'pending' as BookingStatus,
    discountType: undefined as 'percent' | 'amount' | undefined,
    discountValue: undefined as number | undefined,
    staffAssignments: undefined as StaffAssignment[] | undefined,
    staffingProfileId: undefined as string | undefined,
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [menuStatus, setMenuStatus] = useState<{
    exists: boolean; complete: boolean;
    guestsDone?: number; totalGuests?: number; itemCount?: number;
  } | null>(null);
  const [templateMenus, setTemplateMenus] = useState<Array<{
    id: string; bookingId: string; name: string; type: 'hibachi' | 'catering';
  }>>([]);
  const [proposalUrl, setProposalUrl] = useState<string | null>(null);
  const [proposalAccepted, setProposalAccepted] = useState(false);

  const booking = useMemo(
    () => (id ? bookings.find((b) => b.id === id) ?? null : null),
    [bookings, id]
  );
  const staffById = useMemo(() => {
    const m = new Map<string, StaffRecord>();
    staffRecords.forEach((s) => m.set(s.id, s));
    return m;
  }, [staffRecords]);

  useEffect(() => {
    const raw = localStorage.getItem('bookings');
    const list: Booking[] = raw ? JSON.parse(raw) : [];
    setBookings(list.filter((b) => b.source !== 'inquiry'));
    const onUpdate = () => {
      const r = localStorage.getItem('bookings');
      setBookings(r ? JSON.parse(r).filter((b: Booking) => b.source !== 'inquiry') : []);
    };
    window.addEventListener('storage', onUpdate);
    window.addEventListener('bookingsUpdated', onUpdate);
    return () => {
      window.removeEventListener('storage', onUpdate);
      window.removeEventListener('bookingsUpdated', onUpdate);
    };
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('staff');
    setStaffRecords(raw ? JSON.parse(raw) : []);
    const onUpdate = () => setStaffRecords(JSON.parse(localStorage.getItem('staff') || '[]'));
    window.addEventListener('storage', onUpdate);
    window.addEventListener('staffUpdated', onUpdate);
    return () => {
      window.removeEventListener('storage', onUpdate);
      window.removeEventListener('staffUpdated', onUpdate);
    };
  }, []);

  // Load menu status and template menus when booking changes
  useEffect(() => {
    if (!booking) return;

    // Menu status
    if (booking.menuId) {
      const raw = localStorage.getItem('eventMenus');
      const menus: EventMenu[] = raw ? JSON.parse(raw) : [];
      const m = menus.find((x) => x.id === booking.menuId);
      if (m) {
        const total = booking.adults + (booking.children ?? 0);
        setMenuStatus({ exists: true, complete: m.guestSelections.length >= total, guestsDone: m.guestSelections.length, totalGuests: total });
      }
    } else if (booking.cateringMenuId) {
      const raw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
      const menus: CateringEventMenu[] = raw ? JSON.parse(raw) : [];
      const m = menus.find((x) => x.id === booking.cateringMenuId);
      if (m) setMenuStatus({ exists: true, complete: m.selectedItems.length > 0, itemCount: m.selectedItems.length });
    } else {
      setMenuStatus({ exists: false, complete: false });
    }

    // Template menus matching booking event type
    const allBookingsRaw = localStorage.getItem('bookings');
    const allBookings: Booking[] = allBookingsRaw ? JSON.parse(allBookingsRaw) : [];
    const templateIds = new Set(allBookings.filter((b) => b.source === 'menu-template').map((b) => b.id));

    if (booking.eventType === 'private-dinner') {
      const raw = localStorage.getItem('eventMenus');
      const menus: EventMenu[] = raw ? JSON.parse(raw) : [];
      setTemplateMenus(
        menus
          .filter((m) => templateIds.has(m.bookingId))
          .map((m) => ({ id: m.id, bookingId: m.bookingId, name: m.name || 'Unnamed Template', type: 'hibachi' as const }))
      );
    } else {
      const raw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
      const menus: CateringEventMenu[] = raw ? JSON.parse(raw) : [];
      setTemplateMenus(
        menus
          .filter((m) => templateIds.has(m.bookingId))
          .map((m) => ({ id: m.id, bookingId: m.bookingId, name: m.name || 'Unnamed Template', type: 'catering' as const }))
      );
    }
  }, [booking?.id, booking?.menuId, booking?.cateringMenuId, booking?.eventType]);

  // Sync step from URL when search params change (e.g. after navigation or browser back)
  useEffect(() => {
    const step = searchParams.get('step');
    if (BOOKING_WIZARD_STEPS.some((s) => s.id === step) && step) {
      setStepId(step as BookingWizardStepId);
    }
  }, [searchParams]);

  // Check Supabase for accepted proposal status when booking has a proposalToken
  useEffect(() => {
    if (!booking?.proposalToken) return;
    if (booking.proposalAccepted) { setProposalAccepted(true); return; }
    const supabase = createClient();
    if (!supabase) return;
    supabase
      .from('proposal_tokens')
      .select('status')
      .eq('token', booking.proposalToken)
      .single()
      .then(({ data }) => {
        if (data?.status === 'accepted') {
          setProposalAccepted(true);
          // Persist accepted flag to localStorage so we don't re-fetch
          const raw = localStorage.getItem('bookings');
          const list: Booking[] = raw ? JSON.parse(raw) : [];
          const updated = list.map((b) =>
            b.id === booking.id ? { ...b, proposalAccepted: true } : b
          );
          localStorage.setItem('bookings', JSON.stringify(updated));
        }
      });
  }, [booking?.proposalToken, booking?.id]);

  const cloneTemplateToBooking = (template: { id: string; bookingId: string; name: string; type: 'hibachi' | 'catering' }) => {
    if (!booking) return;
    const newId = `${template.type === 'hibachi' ? 'emenu' : 'cmenu'}-${Date.now()}`;
    if (template.type === 'hibachi') {
      const raw = localStorage.getItem('eventMenus');
      const ems: EventMenu[] = raw ? JSON.parse(raw) : [];
      const src = ems.find((m) => m.id === template.id);
      if (!src) return;
      const cloned: EventMenu = { ...src, id: newId, bookingId: booking.id, updatedAt: new Date().toISOString() };
      localStorage.setItem('eventMenus', JSON.stringify([...ems, cloned]));
      saveBookings(bookings.map((b) => b.id === booking.id ? { ...b, menuId: newId } : b));
    } else {
      const raw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
      const cms: CateringEventMenu[] = raw ? JSON.parse(raw) : [];
      const src = cms.find((m) => m.id === template.id);
      if (!src) return;
      const cloned: CateringEventMenu = { ...src, id: newId, bookingId: booking.id, updatedAt: new Date().toISOString() };
      localStorage.setItem(CATERING_EVENT_MENUS_KEY, JSON.stringify([...cms, cloned]));
      saveBookings(bookings.map((b) => b.id === booking.id ? { ...b, cateringMenuId: newId } : b));
    }
  };

  const handleSendProposal = async () => {
    if (!booking) return;
    setSendingProposal(true);
    try {
      const snapshot: ProposalSnapshot = {
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        eventDate: booking.eventDate,
        eventTime: booking.eventTime,
        location: booking.location,
        adults: booking.adults,
        children: booking.children ?? 0,
        eventType: booking.eventType,
        subtotal: booking.subtotal,
        gratuity: booking.gratuity,
        distanceFee: booking.distanceFee,
        total: booking.total,
        depositAmount: booking.depositAmount,
        depositDueDate: booking.depositDueDate,
        balanceDueDate: booking.balanceDueDate,
        notes: booking.notes,
        businessName: templateConfig.businessName || 'Your Caterer',
        sentAt: new Date().toISOString(),
      };

      const createRes = await fetch('/api/proposals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, bookingId: booking.id }),
      });

      if (!createRes.ok) {
        console.error('[handleSendProposal] create failed', await createRes.text());
        return;
      }

      const { token, url } = await createRes.json();

      // Save token + sentAt to localStorage booking
      const raw = localStorage.getItem('bookings');
      const list: Booking[] = raw ? JSON.parse(raw) : [];
      const updated = list.map((b) =>
        b.id === booking.id
          ? { ...b, proposalToken: token, proposalSentAt: new Date().toISOString() }
          : b
      );
      localStorage.setItem('bookings', JSON.stringify(updated));
      window.dispatchEvent(new Event('bookingsUpdated'));

      // Send proposal email
      await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'proposal',
          booking,
          businessName: snapshot.businessName,
          proposalUrl: url,
          snapshot,
        }),
      });

      setProposalUrl(url);
    } finally {
      setSendingProposal(false);
    }
  };

  useEffect(() => {
    if (!booking) return;
    setFormData({
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      location: booking.location,
      eventType: booking.eventType,
      eventDate: booking.eventDate,
      eventTime: booking.eventTime ?? '18:00',
      adults: booking.adults,
      children: booking.children,
      distanceMiles: booking.distanceMiles,
      premiumAddOn: booking.premiumAddOn,
      notes: booking.notes,
      serviceStatus: getBookingServiceStatus(booking),
      discountType: booking.discountType,
      discountValue: booking.discountValue,
      staffAssignments: booking.staffAssignments,
      staffingProfileId: booking.staffingProfileId,
    });
  }, [booking?.id]);

  const findStaffConflicts = useCallback(
    (eventDate: string, eventTime: string, assignedStaffIds: string[]): StaffConflict[] => {
      if (assignedStaffIds.length === 0) return [];
      const assignedSet = new Set(assignedStaffIds);
      const conflicts: StaffConflict[] = [];
      const seen = new Set<string>();
      bookings.forEach((other) => {
        if (id && other.id === id) return;
        if (getBookingServiceStatus(other) === 'cancelled') return;
        if (other.eventDate !== eventDate || other.eventTime !== eventTime) return;
        if (!other.staffAssignments?.length) return;
        other.staffAssignments.forEach((a) => {
          if (!assignedSet.has(a.staffId)) return;
          const key = `${a.staffId}:${other.id}`;
          if (seen.has(key)) return;
          seen.add(key);
          conflicts.push({
            staffId: a.staffId,
            staffName: staffById.get(a.staffId)?.name ?? a.staffId,
            conflictingBooking: other,
          });
        });
      });
      return conflicts;
    },
    [bookings, id, staffById]
  );

  const goToStep = useCallback(
    (next: BookingWizardStepId) => {
      setStepId(next); // Update UI immediately so Event details shows right away
      router.replace(`/bookings/${id}?step=${next}`, { scroll: false });
    },
    [router, id]
  );

  const saveContact = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!formData.customerName.trim() || !formData.customerEmail.trim() || !formData.location.trim()) {
      setSaveError('Name, email, and event address are required.');
      return;
    }
    if (formData.customerPhone && !isValidPhone(formData.customerPhone)) {
      setSaveError('Phone must be (xxx)-xxx-xxxx.');
      return;
    }
    if (!booking) {
      setSaveError('Event could not be loaded. Try refreshing the page.');
      return;
    }
    const updated: Booking = {
      ...booking,
      customerName: formData.customerName.trim(),
      customerEmail: formData.customerEmail.trim(),
      customerPhone: formData.customerPhone.trim(),
      location: formData.location.trim(),
      updatedAt: new Date().toISOString(),
    };
    saveBookings(bookings.map((b) => (b.id === booking.id ? normalizeBookingWorkflowFields(updated) : b)));
    goToStep('details');
  };

  const saveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (formData.customerPhone && !isValidPhone(formData.customerPhone)) {
      setSaveError('Phone must be (xxx)-xxx-xxxx.');
      return;
    }
    const duplicateIds = getDuplicateAssignedStaffIds(formData.staffAssignments);
    if (duplicateIds.length > 0) {
      const names = duplicateIds.map((sid) => staffById.get(sid)?.name ?? sid);
      setSaveError(`Duplicate staff assignments: ${names.join(', ')}`);
      return;
    }
    const assignedIds = getUniqueAssignedStaffIds(formData.staffAssignments);
    const conflicts = findStaffConflicts(formData.eventDate, formData.eventTime, assignedIds);
    if (conflicts.length > 0) {
      setSaveError(
        `Staff double-booked: ${conflicts.map((c) => `${c.staffName} → ${c.conflictingBooking.customerName}`).join('; ')}`
      );
      return;
    }
    if (!booking) return;

    const pricingSlot = getPricingSlot(templateConfig.eventTypes, formData.eventType);
    const preservedMenuSnapshot =
      pricingSlot === 'primary' && getPricingSlot(templateConfig.eventTypes, booking.eventType) === 'primary'
        ? booking.menuPricingSnapshot
        : undefined;
    const financials = calculateEventFinancials(
      {
        adults: formData.adults,
        children: formData.children,
        eventType: formData.eventType,
        eventDate: new Date(formData.eventDate),
        distanceMiles: formData.distanceMiles,
        premiumAddOn: formData.premiumAddOn,
        subtotalOverride: preservedMenuSnapshot?.subtotalOverride,
        foodCostOverride: preservedMenuSnapshot?.foodCostOverride,
        staffingProfileId: formData.staffingProfileId,
        pricingSlot,
      },
      rules
    );
    let subtotalAfterDiscount = financials.subtotal;
    const discountType = formData.discountType;
    const discountValue = formData.discountValue ?? 0;
    if (discountType === 'percent' && discountValue > 0) {
      subtotalAfterDiscount = Math.max(0, financials.subtotal - (financials.subtotal * discountValue) / 100);
    } else if (discountType === 'amount' && discountValue > 0) {
      subtotalAfterDiscount = Math.max(0, financials.subtotal - discountValue);
    }
    const totalWithDiscount = Math.round((subtotalAfterDiscount + financials.gratuity + financials.distanceFee) * 100) / 100;
    const adultBasePrice =
      pricingSlot === 'primary' ? rules.pricing.primaryBasePrice : rules.pricing.secondaryBasePrice;
    const pricingSnapshot: BookingPricingSnapshot = {
      adultBasePrice,
      childBasePrice: adultBasePrice * (1 - rules.pricing.childDiscountPercent / 100),
      gratuityPercent: rules.pricing.defaultGratuityPercent,
      capturedAt: new Date().toISOString(),
    };
    const updated: Booking = normalizeBookingWorkflowFields({
      ...booking,
      eventType: formData.eventType,
      eventDate: formData.eventDate,
      eventTime: formData.eventTime,
      customerName: formData.customerName.trim(),
      customerEmail: formData.customerEmail.trim(),
      customerPhone: formData.customerPhone.trim(),
      location: formData.location.trim(),
      adults: formData.adults,
      children: formData.children,
      distanceMiles: formData.distanceMiles,
      premiumAddOn: formData.premiumAddOn,
      notes: formData.notes,
      serviceStatus: formData.serviceStatus,
      status: formData.serviceStatus,
      discountType: discountType && discountValue > 0 ? discountType : undefined,
      discountValue: discountType && discountValue > 0 ? discountValue : undefined,
      staffAssignments: formData.staffAssignments,
      staffingProfileId: formData.staffingProfileId,
      subtotal: subtotalAfterDiscount,
      gratuity: financials.gratuity,
      distanceFee: financials.distanceFee,
      total: totalWithDiscount,
      menuId: pricingSlot === 'primary' ? booking.menuId : undefined,
      menuPricingSnapshot: preservedMenuSnapshot,
      pricingSnapshot,
      updatedAt: new Date().toISOString(),
    });
    saveBookings(bookings.map((b) => (b.id === booking.id ? updated : b)));
    goToStep('menu');
  };

  if (!id) {
    router.replace('/bookings');
    return null;
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <p className="text-text-muted">Event not found.</p>
          <Link href="/bookings" className="mt-4 inline-block text-accent hover:underline">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const stepIndex = getStepIndex(stepId);
  const nextStepId = getNextStepId(stepId);
  const prevStepId = getPrevStepId(stepId);

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-1">
            {BOOKING_WIZARD_STEPS.map((step, i) => (
              <div key={step.id} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className={`flex flex-1 flex-col items-center rounded-lg border px-2 py-2 text-center transition-colors ${
                    i === stepIndex
                      ? 'border-accent bg-accent/10 text-accent'
                      : i < stepIndex
                        ? 'border-accent/50 bg-accent/5 text-text-secondary hover:bg-accent/10'
                        : 'border-border bg-card-elevated text-text-muted hover:bg-card'
                  }`}
                >
                  <span className="text-xs font-medium">{i + 1}</span>
                  <span className="mt-0.5 truncate text-xs">{step.shortLabel}</span>
                </button>
                {i < BOOKING_WIZARD_STEPS.length - 1 && (
                  <div className="h-0.5 w-2 flex-shrink-0 bg-border" aria-hidden />
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-sm text-text-muted">
            {BOOKING_WIZARD_STEPS[stepIndex].label}
          </p>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {booking.customerName || 'Event'}
            </h1>
            {proposalAccepted && (
              <span className="mt-1 inline-block rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                Proposal Accepted
              </span>
            )}
            {booking.proposalSentAt && !proposalAccepted && (
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                Proposal Sent
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href={`/bookings/${booking.id}/beo`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
            >
              <DocumentTextIcon className="h-4 w-4" />
              Print BEO
            </Link>
            {booking.customerEmail && (
              <button
                type="button"
                onClick={handleSendProposal}
                disabled={sendingProposal}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {sendingProposal ? 'Sending…' : booking.proposalSentAt ? 'Resend Proposal' : 'Send Proposal'}
              </button>
            )}
            <Link
              href="/bookings"
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Proposal URL modal */}
        {proposalUrl && (
          <div className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <p className="mb-2 text-sm font-semibold text-text-primary">Proposal sent!</p>
            <p className="mb-2 text-xs text-text-secondary">Share this link with your client:</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={proposalUrl}
                className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-mono text-text-primary"
              />
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(proposalUrl); }}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-card-elevated"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => setProposalUrl(null)}
                className="text-xs text-text-muted hover:text-text-secondary"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {stepId === 'contact' && (
          <form onSubmit={saveContact} className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
            <h2 className="text-lg font-semibold text-text-primary">Customer information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-text-secondary">Customer name *</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData((p) => ({ ...p, customerName: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.customerEmail}
                  onChange={(e) => setFormData((p) => ({ ...p, customerEmail: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.customerPhone}
                  onChange={(e) => setFormData((p) => ({ ...p, customerPhone: formatPhone(e.target.value) }))}
                  placeholder="(xxx)-xxx-xxxx"
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-text-primary ${
                    formData.customerPhone && !isValidPhone(formData.customerPhone) ? 'border-danger' : 'border-border bg-card'
                  }`}
                />
                {formData.customerPhone && !isValidPhone(formData.customerPhone) && (
                  <p className="mt-1 text-xs text-danger">Format: (xxx)-xxx-xxxx</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-text-secondary">Event address *</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
            </div>
            {saveError && <p className="text-sm text-danger">{saveError}</p>}
            <div className="flex justify-end gap-2">
              {prevStepId && (
                <button
                  type="button"
                  onClick={() => goToStep(prevStepId)}
                  className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  saveContact(e as unknown as React.FormEvent);
                }}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Next: Event details
              </button>
            </div>
          </form>
        )}

        {stepId === 'details' && (
          <form onSubmit={saveDetails} className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
            <h2 className="text-lg font-semibold text-text-primary">Event details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary">Status</label>
                <select
                  value={formData.serviceStatus}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, serviceStatus: e.target.value as BookingStatus }))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Event type *</label>
                <select
                  value={formData.eventType}
                  onChange={(e) => setFormData((p) => ({ ...p, eventType: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                >
                  {templateConfig.eventTypes.map((et) => (
                    <option key={et.id} value={et.id}>{et.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Event date *</label>
                <input
                  type="date"
                  required
                  value={formData.eventDate}
                  onChange={(e) => setFormData((p) => ({ ...p, eventDate: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Event time *</label>
                <input
                  type="time"
                  required
                  value={formData.eventTime}
                  onChange={(e) => setFormData((p) => ({ ...p, eventTime: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Adults *</label>
                <input
                  type="number"
                  min={1}
                  value={formData.adults}
                  onChange={(e) => setFormData((p) => ({ ...p, adults: parseInt(e.target.value) || 1 }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Children</label>
                <input
                  type="number"
                  min={0}
                  value={formData.children}
                  onChange={(e) => setFormData((p) => ({ ...p, children: parseInt(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Distance (miles)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.distanceMiles}
                  onChange={(e) => setFormData((p) => ({ ...p, distanceMiles: parseInt(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
              {isModuleEnabled(templateConfig, 'guest_pricing') && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    {getTemplateLabel(templateConfig.labels, 'premiumAddOn', 'Premium add-on')} ($/guest)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.premiumAddOn}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, premiumAddOn: parseFloat(e.target.value) || 0 }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">Discount type</label>
                <select
                  value={formData.discountType ?? ''}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      discountType: (e.target.value || undefined) as 'percent' | 'amount' | undefined,
                      discountValue: e.target.value ? (p.discountValue ?? 0) : undefined,
                    }))
                  }
                  className="mt-1 rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                >
                  <option value="">None</option>
                  <option value="percent">Percent</option>
                  <option value="amount">Amount ($)</option>
                </select>
              </div>
              {(formData.discountType === 'percent' || formData.discountType === 'amount') && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary">Value</label>
                  <input
                    type="number"
                    min={0}
                    step={formData.discountType === 'percent' ? 1 : 0.01}
                    value={formData.discountValue ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        discountValue: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="mt-1 w-28 rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                  />
                </div>
              )}
            </div>
            {saveError && <p className="text-sm text-danger">{saveError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => goToStep('contact')}
                className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
              >
                Back
              </button>
              <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
                Next: Menu creation
              </button>
            </div>
          </form>
        )}

        {stepId === 'menu' && (
          <div className="space-y-4 rounded-lg border border-border bg-card-elevated p-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-text-primary">Menu creation</h2>
              {menuStatus && (
                menuStatus.exists ? (
                  <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                    {booking.eventType === 'private-dinner'
                      ? `${menuStatus.guestsDone}/${menuStatus.totalGuests} guests`
                      : `${menuStatus.itemCount} item${menuStatus.itemCount !== 1 ? 's' : ''}`}
                  </span>
                ) : (
                  <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">No menu yet</span>
                )
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/bookings/menu?bookingId=${booking.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10"
              >
                <ClipboardDocumentListIcon className="h-4 w-4" />
                {booking.menuId || booking.cateringMenuId ? 'Edit menu' : 'Create menu'}
              </Link>
              <button
                type="button"
                onClick={() => goToStep('staff')}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Next: Staff assignments
              </button>
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
                        onClick={() => cloneTemplateToBooking(t)}
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
        )}

        {stepId === 'staff' && (
          <div className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
            <h2 className="text-lg font-semibold text-text-primary">Staff assignments</h2>
            <p className="text-sm text-text-muted">
              Assign staff to this event. Manage roles and pay on the staff assignment page.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/bookings/staff?bookingId=${booking.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card-elevated"
              >
                <UsersIcon className="h-4 w-4" />
                Manage staff assignments
              </Link>
              <Link
                href="/bookings"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Done — Back to Events
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default function EventDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm text-text-muted">Loading…</p></div>}>
      <EventDetailContent />
    </Suspense>
  );
}

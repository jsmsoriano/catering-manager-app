'use client';

import { useState, useEffect, useMemo, useCallback, Suspense, Fragment } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  DocumentTextIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import type { ProposalSnapshot } from '@/lib/proposalTypes';
import { isValidPhone } from '@/lib/phoneUtils';
import { calculateEventFinancials } from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import { getPricingSlot, type EventTypeConfig } from '@/lib/templateConfig';
import type { Booking, BookingStatus, BookingPricingSnapshot, PipelineStatus } from '@/lib/bookingTypes';
import { getBookingServiceStatus, normalizeBookingWorkflowFields, applyConfirmationPaymentTerms } from '@/lib/bookingWorkflow';
import { getHibachiServiceFormat } from '@/lib/hibachiService';
import { calculateGuestChangeCutoffISO } from '@/lib/guestChangePolicy';
import { calculateMenuChangeCutoffISO } from '@/lib/menuChangePolicy';
import { createLocalProposalToken } from '@/lib/localProposalTokens';
import { getLocalProposalToken, updateLocalProposalSnapshot } from '@/lib/localProposalTokens';
import { loadProposalWriterConfig } from '@/lib/proposalWriter';
import { appendQuoteRevision } from '@/lib/quoteRevisionLog';
import QuoteVersionHistory from '@/components/QuoteVersionHistory';
import { runPipelineStageAutomation } from '@/lib/crmAutomation';
import type { EventMenu, CateringEventMenu } from '@/lib/menuTypes';
import { CATERING_EVENT_MENUS_KEY } from '@/lib/menuCategories';
import type { StaffMember as StaffRecord, StaffAssignment } from '@/lib/staffTypes';
import { useAuth } from '@/components/AuthProvider';

import type { EventTabId, BookingFormData, MenuStatus, TemplateMenu } from './bookingFormTypes';
import { ContactTab } from './ContactTab';
import { DetailsTab } from './DetailsTab';
import { PaymentTab } from './PaymentTab';
import { MenuTab } from './MenuTab';
import { StaffTab } from './StaffTab';
import { CrmTab } from './CrmTab';
import { ReviewTab } from './ReviewTab';

const EVENT_TABS: { id: EventTabId; label: string }[] = [
  { id: 'contact', label: 'Contact' },
  { id: 'details', label: 'Event Details' },
  { id: 'menu', label: 'Menu' },
  { id: 'staff', label: 'Staff' },
  { id: 'payment', label: 'Payments' },
  { id: 'crm', label: 'Follow Ups' },
  { id: 'review', label: 'Summary' },
];

const CATERING_FALLBACK_EVENT_TYPES: EventTypeConfig[] = [
  { id: 'catering-dropoff', label: 'Catering Drop-off', customerLabel: 'Catering Drop-off', pricingSlot: 'secondary' },
  { id: 'catering-full-service', label: 'Catering Full Service', customerLabel: 'Catering Full Service', pricingSlot: 'primary' },
];

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

function saveBookings(bookings: Booking[]) {
  const normalized = bookings.map((b) => normalizeBookingWorkflowFields(b));
  localStorage.setItem('bookings', JSON.stringify(normalized));
  window.dispatchEvent(new Event('bookingsUpdated'));
}

// ─── Pipeline status bar ────────────────────────────────────────────────────────

const PIPELINE_STEPS: { id: PipelineStatus; label: string }[] = [
  { id: 'inquiry', label: 'Inquiry' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'quote_sent', label: 'Quote Sent' },
  { id: 'deposit_pending', label: 'Deposit' },
  { id: 'booked', label: 'Booked' },
  { id: 'completed', label: 'Done' },
];

function PipelineStatusBar({ pipeline_status }: { pipeline_status?: PipelineStatus }) {
  const current = pipeline_status ?? 'inquiry';
  const isDeclined = current === 'declined';
  // follow_up lives between quote_sent and deposit_pending — map to quote_sent for display
  const normalized: PipelineStatus = current === 'follow_up' ? 'quote_sent' : current;
  const activeIndex = isDeclined ? -1 : PIPELINE_STEPS.findIndex((s) => s.id === normalized);

  return (
    <div className="mb-4">
      <div className="flex items-start">
        {PIPELINE_STEPS.map((step, i) => (
          <Fragment key={step.id}>
            <div className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
              <div
                className={`h-3 w-3 rounded-full border-2 transition-colors ${
                  i <= activeIndex ? 'border-accent bg-accent' : 'border-border bg-transparent'
                }`}
              />
              <span
                className={`mt-1 text-center text-[10px] leading-tight ${
                  i === activeIndex ? 'font-semibold text-accent' : 'text-text-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div className={`mt-1.5 h-0.5 flex-1 ${i < activeIndex ? 'bg-accent' : 'bg-border'}`} />
            )}
          </Fragment>
        ))}
      </div>
      {isDeclined && (
        <p className="mt-2 text-xs font-medium text-slate-400">
          ✕ Declined
        </p>
      )}
      {current === 'follow_up' && (
        <p className="mt-1 text-[11px] text-violet-400">↩ In follow-up</p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

function EventDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;

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
  const [tabId, setTabId] = useState<EventTabId>(() => {
    if (typeof window === 'undefined') return 'contact';
    const p = new URLSearchParams(window.location.search);
    const tab = p.get('tab') ?? p.get('step');
    return EVENT_TABS.some((t) => t.id === tab) ? (tab as EventTabId) : 'contact';
  });
  const [formData, setFormData] = useState<BookingFormData>({
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
    discountType: undefined,
    discountValue: undefined,
    staffAssignments: undefined,
    staffingProfileId: undefined,
    depositPercent: undefined,
    depositAmount: undefined,
    depositDueDate: '',
    balanceDueDate: '',
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [menuStatus, setMenuStatus] = useState<MenuStatus | null>(null);
  const [templateMenus, setTemplateMenus] = useState<TemplateMenu[]>([]);
  const [proposalUrl, setProposalUrl] = useState<string | null>(null);
  const [proposalAccepted, setProposalAccepted] = useState(false);
  const [proposalSnapshot, setProposalSnapshot] = useState<ProposalSnapshot | null>(null);
  const [menuChangeActionLoading, setMenuChangeActionLoading] = useState(false);
  const [menuChangeActionMessage, setMenuChangeActionMessage] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const { user, isAdmin } = useAuth();

  // ─── Derived state ──────────────────────────────────────────────────────────

  const booking = useMemo(
    () => (id ? bookings.find((b) => b.id === id) ?? null : null),
    [bookings, id]
  );
  const staffById = useMemo(() => {
    const m = new Map<string, StaffRecord>();
    staffRecords.forEach((s) => m.set(s.id, s));
    return m;
  }, [staffRecords]);
  const eventTypeOptions = useMemo(() => {
    const byId = new Map<string, EventTypeConfig>();
    templateConfig.eventTypes.forEach((et) => byId.set(et.id, et));
    CATERING_FALLBACK_EVENT_TYPES.forEach((et) => {
      if (!byId.has(et.id)) byId.set(et.id, et);
    });
    return Array.from(byId.values());
  }, [templateConfig.eventTypes]);

  // ─── Effects ────────────────────────────────────────────────────────────────

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

    if (booking.menuId) {
      const raw = localStorage.getItem('eventMenus');
      const menus: EventMenu[] = raw ? JSON.parse(raw) : [];
      const m = menus.find((x) => x.id === booking.menuId);
      if (m) {
        const total = booking.adults + (booking.children ?? 0);
        setMenuStatus({
          exists: true,
          complete: m.guestSelections.length >= total,
          approvalStatus: m.approvalStatus ?? 'draft',
          guestsDone: m.guestSelections.length,
          totalGuests: total,
        });
      }
    } else if (booking.cateringMenuId) {
      const raw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
      const menus: CateringEventMenu[] = raw ? JSON.parse(raw) : [];
      const m = menus.find((x) => x.id === booking.cateringMenuId);
      if (m) {
        setMenuStatus({
          exists: true,
          complete: m.selectedItems.length > 0,
          approvalStatus: m.approvalStatus ?? 'draft',
          itemCount: m.selectedItems.length,
        });
      }
    } else {
      setMenuStatus({ exists: false, complete: false });
    }

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
  }, [booking?.id, booking?.menuId, booking?.cateringMenuId, booking?.eventType, booking?.updatedAt]);

  useEffect(() => {
    const tab = searchParams.get('tab') ?? searchParams.get('step');
    if (EVENT_TABS.some((t) => t.id === tab) && tab) {
      setTabId(tab as EventTabId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!booking?.proposalToken) {
      setProposalSnapshot(null);
      setProposalAccepted(false);
      return;
    }
    const token = booking.proposalToken;
    if (token.startsWith('local-')) {
      const local = getLocalProposalToken(token);
      setProposalSnapshot(local?.snapshot ?? null);
      setProposalAccepted(local?.status === 'accepted' || !!booking.proposalAccepted);
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    supabase
      .from('proposal_tokens')
      .select('status, snapshot')
      .eq('token', token)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setProposalSnapshot((data.snapshot as ProposalSnapshot | null) ?? null);
        if (data.status === 'accepted') {
          setProposalAccepted(true);
          if (!booking.proposalAccepted) {
            const raw = localStorage.getItem('bookings');
            const list: Booking[] = raw ? JSON.parse(raw) : [];
            const updated = list.map((b) =>
              b.id === booking.id ? { ...b, proposalAccepted: true } : b
            );
            localStorage.setItem('bookings', JSON.stringify(updated));
          }
        } else {
          setProposalAccepted(!!booking.proposalAccepted);
        }
      });
  }, [booking?.proposalToken, booking?.proposalAccepted, booking?.id]);

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
      depositPercent: booking.depositPercent ?? rules.pricing.defaultDepositPercent,
      depositAmount: booking.depositAmount,
      depositDueDate: booking.depositDueDate ?? '',
      balanceDueDate: booking.balanceDueDate ?? '',
    });
  }, [booking?.id, rules.pricing.defaultDepositPercent]);

  // ─── Callbacks ──────────────────────────────────────────────────────────────

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

  const goToTab = useCallback(
    (next: EventTabId) => {
      setTabId(next);
      router.replace(`/bookings/${id}?tab=${next}`, { scroll: false });
    },
    [router, id]
  );

  // ─── Tab handlers ───────────────────────────────────────────────────────────

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
    goToTab('details');
  };

  const saveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (formData.customerPhone && !isValidPhone(formData.customerPhone)) {
      setSaveError('Phone must be (xxx)-xxx-xxxx.');
      return;
    }
    const today = new Date();
    const todayStr =
      today.getFullYear() +
      '-' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(today.getDate()).padStart(2, '0');
    if (formData.eventDate < todayStr) {
      setSaveError('Event date cannot be in the past.');
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

    const pricingSlot = getPricingSlot(eventTypeOptions, formData.eventType);
    const preservedMenuSnapshot =
      pricingSlot === 'primary' && getPricingSlot(eventTypeOptions, booking.eventType) === 'primary'
        ? booking.menuPricingSnapshot
        : undefined;
    const financials = calculateEventFinancials(
      {
        adults: formData.adults,
        children: formData.children,
        eventType: formData.eventType,
        eventDate: new Date(formData.eventDate),
        distanceMiles: booking.distanceMiles ?? 0,
        premiumAddOn: booking.premiumAddOn ?? 0,
        subtotalOverride: preservedMenuSnapshot?.subtotalOverride,
        foodCostOverride: preservedMenuSnapshot?.foodCostOverride,
        staffingProfileId: formData.staffingProfileId,
        pricingSlot,
      },
      rules
    );
    const totalWithDiscount =
      Math.round((financials.subtotal + financials.gratuity + financials.distanceFee) * 100) / 100;
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
      serviceFormat: getHibachiServiceFormat(formData.eventType),
      distanceMiles: booking.distanceMiles ?? 0,
      premiumAddOn: booking.premiumAddOn ?? 0,
      notes: formData.notes,
      serviceStatus: booking.serviceStatus ?? 'pending',
      status: booking.status ?? 'pending',
      staffAssignments: formData.staffAssignments,
      staffingProfileId: formData.staffingProfileId,
      subtotal: financials.subtotal,
      gratuity: financials.gratuity,
      distanceFee: financials.distanceFee,
      total: totalWithDiscount,
      menuId: pricingSlot === 'primary' ? booking.menuId : undefined,
      menuPricingSnapshot: preservedMenuSnapshot,
      pricingSnapshot,
      updatedAt: new Date().toISOString(),
    });
    saveBookings(bookings.map((b) => (b.id === booking.id ? updated : b)));
    goToTab('menu');
  };

  const savePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!booking) return;
    const depositPercent =
      formData.depositPercent != null && formData.depositPercent >= 0
        ? formData.depositPercent
        : rules.pricing.defaultDepositPercent;
    const depositAmount =
      formData.depositAmount != null && formData.depositAmount >= 0
        ? Math.round(formData.depositAmount * 100) / 100
        : Math.round(booking.total * (depositPercent / 100) * 100) / 100;
    const updated: Booking = {
      ...booking,
      depositPercent,
      depositAmount,
      depositDueDate: formData.depositDueDate.trim() || undefined,
      balanceDueDate: formData.balanceDueDate.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    saveBookings(bookings.map((b) => (b.id === booking.id ? normalizeBookingWorkflowFields(updated) : b)));
    goToTab('crm');
  };

  const handleResolveMenuChangeRequest = async (status: 'approved' | 'declined') => {
    if (!booking?.proposalToken || !proposalSnapshot) return;
    const token = booking.proposalToken;
    const resolutionNote = window
      .prompt(
        status === 'approved' ? 'Approval note (optional):' : 'Reason for decline (optional):',
        proposalSnapshot.menuChangeResolutionNote ?? ''
      )
      ?.trim();
    setMenuChangeActionLoading(true);
    setMenuChangeActionMessage(null);
    try {
      if (token.startsWith('local-')) {
        const updated = updateLocalProposalSnapshot(token, (prev) => ({
          ...prev,
          menuChangeRequestStatus: status,
          menuChangeResolvedAt: new Date().toISOString(),
          menuChangeResolvedBy:
            (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ||
            (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name ||
            user?.email ||
            'manager',
          menuChangeResolutionNote: resolutionNote || undefined,
          requiresReview: false,
        }));
        if (updated) setProposalSnapshot(updated.snapshot);
        setMenuChangeActionMessage(
          status === 'approved' ? 'Menu change request approved.' : 'Menu change request declined.'
        );
        return;
      }
      const res = await fetch('/api/proposals/menu-change-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, status, resolutionNote: resolutionNote || undefined }),
      });
      const payload = await res
        .json()
        .catch(() => ({} as { error?: string; snapshot?: ProposalSnapshot }));
      if (!res.ok) {
        setMenuChangeActionMessage(payload.error || 'Could not update menu request status.');
        return;
      }
      if (payload.snapshot) setProposalSnapshot(payload.snapshot);
      setMenuChangeActionMessage(
        status === 'approved' ? 'Menu change request approved.' : 'Menu change request declined.'
      );
    } finally {
      setMenuChangeActionLoading(false);
    }
  };

  const cloneTemplateToBooking = (template: TemplateMenu) => {
    if (!booking) return;
    const newId = `${template.type === 'hibachi' ? 'emenu' : 'cmenu'}-${Date.now()}`;
    if (template.type === 'hibachi') {
      const raw = localStorage.getItem('eventMenus');
      const ems: EventMenu[] = raw ? JSON.parse(raw) : [];
      const src = ems.find((m) => m.id === template.id);
      if (!src) return;
      const cloned: EventMenu = { ...src, id: newId, bookingId: booking.id, updatedAt: new Date().toISOString() };
      localStorage.setItem('eventMenus', JSON.stringify([...ems, cloned]));
      saveBookings(bookings.map((b) => (b.id === booking.id ? { ...b, menuId: newId } : b)));
    } else {
      const raw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
      const cms: CateringEventMenu[] = raw ? JSON.parse(raw) : [];
      const src = cms.find((m) => m.id === template.id);
      if (!src) return;
      const cloned: CateringEventMenu = { ...src, id: newId, bookingId: booking.id, updatedAt: new Date().toISOString() };
      localStorage.setItem(CATERING_EVENT_MENUS_KEY, JSON.stringify([...cms, cloned]));
      saveBookings(bookings.map((b) => (b.id === booking.id ? { ...b, cateringMenuId: newId } : b)));
    }
  };

  const handleSendProposal = async () => {
    if (!booking) return;
    setSendingProposal(true);
    try {
      const now = new Date().toISOString();
      const isRevision = !!booking.proposalToken;
      const currentQuoteVersion = booking.quoteVersion ?? (isRevision ? 1 : 0);
      const nextQuoteVersion = isRevision ? Math.max(2, currentQuoteVersion + 1) : 1;
      const revisionReason = isRevision
        ? window
            .prompt('Revision reason for this quote update:', booking.lastQuoteRevisionReason ?? '')
            ?.trim() ?? ''
        : '';
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
        logoUrl: templateConfig.logoUrl,
        sentAt: now,
        quoteVersion: nextQuoteVersion,
        quoteRevisionReason: isRevision ? revisionReason || 'Pricing/details updated' : undefined,
        guestChangeCutoffAt: calculateGuestChangeCutoffISO(booking.eventDate),
        menuChangeCutoffAt: calculateMenuChangeCutoffISO(booking.eventDate),
      };

      const createRes = await fetch(isRevision ? '/api/proposals/update' : '/api/proposals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRevision ? { token: booking.proposalToken, snapshot } : { snapshot, bookingId: booking.id }
        ),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error('[handleSendProposal] create failed', errText);
        const local = createLocalProposalToken({ bookingId: booking.id, snapshot });
        const followUpAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const raw = localStorage.getItem('bookings');
        const list: Booking[] = raw ? JSON.parse(raw) : [];
        const updated = list.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                proposalToken: local.token,
                proposalSentAt: now,
                pipeline_status: 'quote_sent',
                pipeline_status_updated_at: now,
                lastContactedAt: now,
                nextFollowUpAt: followUpAt,
                quoteVersion: nextQuoteVersion,
                quoteRevisionCount: Math.max(0, nextQuoteVersion - 1),
                lastQuoteRevisionReason: isRevision ? revisionReason || 'Pricing/details updated' : undefined,
                lastQuoteRevisedAt: isRevision ? now : undefined,
              }
            : b
        );
        localStorage.setItem('bookings', JSON.stringify(updated));
        window.dispatchEvent(new Event('bookingsUpdated'));
        appendQuoteRevision({
          bookingId: booking.id,
          quoteVersion: nextQuoteVersion,
          sentAt: now,
          sentTo: booking.customerEmail || undefined,
          reason: isRevision ? revisionReason || 'Pricing/details updated' : 'Initial quote',
          mode: isRevision ? 'revision' : 'initial',
        });
        setProposalUrl(local.url);
        return;
      }

      const { token, url } = await createRes.json();
      const followUpAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const raw = localStorage.getItem('bookings');
      const list: Booking[] = raw ? JSON.parse(raw) : [];
      const updated = list.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              proposalToken: token,
              proposalSentAt: now,
              pipeline_status: 'quote_sent',
              pipeline_status_updated_at: now,
              lastContactedAt: now,
              nextFollowUpAt: followUpAt,
              quoteVersion: nextQuoteVersion,
              quoteRevisionCount: Math.max(0, nextQuoteVersion - 1),
              lastQuoteRevisionReason: isRevision ? revisionReason || 'Pricing/details updated' : undefined,
              lastQuoteRevisedAt: isRevision ? now : undefined,
            }
          : b
      );
      localStorage.setItem('bookings', JSON.stringify(updated));
      window.dispatchEvent(new Event('bookingsUpdated'));
      appendQuoteRevision({
        bookingId: booking.id,
        quoteVersion: nextQuoteVersion,
        sentAt: now,
        sentTo: booking.customerEmail || undefined,
        reason: isRevision ? revisionReason || 'Pricing/details updated' : 'Initial quote',
        mode: isRevision ? 'revision' : 'initial',
      });

      await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'proposal',
          booking,
          businessName: snapshot.businessName,
          logoUrl: templateConfig.logoUrl,
          proposalUrl: url,
          snapshot,
          proposalContent: loadProposalWriterConfig(),
        }),
      });

      setProposalUrl(url);
    } finally {
      setSendingProposal(false);
    }
  };

  const handleConfirmEvent = () => {
    setSaveError(null);
    if (!booking) return;
    if (!menuStatus?.exists || !menuStatus.complete || menuStatus.approvalStatus !== 'approved') {
      setSaveError('Menu must be created and approved before confirming this event.');
      goToTab('menu');
      return;
    }
    const now = new Date().toISOString();
    const confirmed = {
      ...applyConfirmationPaymentTerms(booking, now, rules.pricing.defaultDepositPercent),
      pipeline_status: 'booked' as const,
      pipeline_status_updated_at: now,
    };
    saveBookings(bookings.map((b) => (b.id === booking.id ? normalizeBookingWorkflowFields(confirmed) : b)));
    runPipelineStageAutomation({
      booking: normalizeBookingWorkflowFields(confirmed),
      prevStage: booking.pipeline_status ?? 'inquiry',
      nextStage: 'booked',
    });
    setConfirmSuccess(true);
  };

  const handleSaveAsDraft = () => {
    setSaveError(null);
    if (!booking) return;
    const updated = { ...booking, updatedAt: new Date().toISOString() };
    saveBookings(bookings.map((b) => (b.id === booking.id ? updated : b)));
    router.push('/bookings');
  };

  // ─── Early exits ────────────────────────────────────────────────────────────

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

  // ─── Computed display values ────────────────────────────────────────────────

  const serviceStatus = getBookingServiceStatus(booking);
  const statusLabelByService: Record<BookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  const statusClassByService: Record<BookingStatus, string> = {
    pending: 'bg-amber-500/15 text-amber-500',
    confirmed: 'bg-success/15 text-success',
    completed: 'bg-emerald-500/15 text-emerald-500',
    cancelled: 'bg-danger/15 text-danger',
  };
  const depositAmountRequired =
    booking.depositAmount ??
    Math.round(
      booking.total * ((booking.depositPercent ?? rules.pricing.defaultDepositPercent) / 100) * 100
    ) / 100;
  const amountPaid = booking.amountPaid ?? 0;
  const depositPaid = amountPaid >= depositAmountRequired - 0.009;
  const menuReadyForConfirmation =
    !!menuStatus?.exists && !!menuStatus?.complete && menuStatus.approvalStatus === 'approved';
  const canConfirmEvent = depositPaid && menuReadyForConfirmation;
  const needsConfirmation = serviceStatus === 'pending';
  const userRole = String(user?.app_metadata?.role ?? '').toLowerCase();
  const canManageMenuRequests = isAdmin || userRole === 'manager';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {booking.customerName || 'Event'}
            </h1>
            {proposalAccepted && (
              <span className="mt-1 inline-block rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                Quote Accepted
              </span>
            )}
            {booking.proposalSentAt && !proposalAccepted && (
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                Quote Sent
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
            <Link
              href={`/bookings/packing?bookingId=${booking.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
            >
              Packing Checklist
            </Link>
            {booking.customerEmail && (booking.proposalSentAt || booking.proposalToken) && (
              <button
                type="button"
                onClick={handleSendProposal}
                disabled={sendingProposal}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {sendingProposal ? 'Sending…' : booking.proposalToken ? 'Update & Resend Quote' : 'Send Quote'}
              </button>
            )}
            {booking.proposalToken && (
              <Link
                href={`/proposal/${booking.proposalToken}`}
                target="_blank"
                className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
              >
                Open Client Portal
              </Link>
            )}
            <Link
              href="/bookings"
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Status card */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <PipelineStatusBar pipeline_status={booking.pipeline_status} />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassByService[serviceStatus]}`}>
              Event {statusLabelByService[serviceStatus]}
            </span>
          </div>
          {needsConfirmation ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-amber-500">Needs confirmation</p>
                  <p className="text-xs text-text-secondary">
                    {booking.proposalAccepted
                      ? 'Client accepted the quote. Confirm event to lock operations and staffing.'
                      : depositPaid
                      ? menuReadyForConfirmation
                        ? 'Deposit is recorded. Confirm the event when ready.'
                        : 'Deposit is recorded. Complete and approve the menu, then confirm.'
                      : 'Event is still pending. Record deposit, then complete menu before confirming.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canConfirmEvent ? (
                  <button
                    type="button"
                    onClick={handleConfirmEvent}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                  >
                    Confirm Now
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => goToTab(menuReadyForConfirmation ? 'review' : 'menu')}
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-card-elevated"
                  >
                    {menuReadyForConfirmation ? 'Open Summary' : 'Open Menu'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2">
              <CheckCircleIcon className="h-4 w-4 text-success" />
              <p className="text-sm font-medium text-success">
                {serviceStatus === 'completed' ? 'Event completed.' : 'Event confirmed.'}
              </p>
            </div>
          )}
        </div>

        {/* Tab nav */}
        <div className="mb-6 overflow-x-auto border-b border-border">
          <div className="flex min-w-max gap-1 pb-2">
            {EVENT_TABS.map((tab) => {
              const isActive = tab.id === tabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => goToTab(tab.id)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:bg-card-elevated hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Proposal URL banner */}
        {proposalUrl && (
          <div className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <p className="mb-2 text-sm font-semibold text-text-primary">Quote sent!</p>
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

        <div className="mb-6">
          <QuoteVersionHistory bookingId={booking.id} />
        </div>

        {/* Tab panels */}
        {tabId === 'contact' && (
          <ContactTab
            formData={formData}
            setFormData={setFormData}
            saveError={saveError}
            onSave={saveContact}
          />
        )}
        {tabId === 'details' && (
          <DetailsTab
            formData={formData}
            setFormData={setFormData}
            saveError={saveError}
            onSave={saveDetails}
            onBack={() => goToTab('contact')}
            eventTypeOptions={eventTypeOptions}
          />
        )}
        {tabId === 'payment' && (
          <PaymentTab
            booking={booking}
            formData={formData}
            setFormData={setFormData}
            saveError={saveError}
            onSave={savePayment}
            onBack={() => goToTab('staff')}
            defaultDepositPercent={rules.pricing.defaultDepositPercent}
          />
        )}
        {tabId === 'menu' && (
          <MenuTab
            booking={booking}
            rules={rules}
            menuStatus={menuStatus}
            templateMenus={templateMenus}
            proposalSnapshot={proposalSnapshot}
            menuChangeActionLoading={menuChangeActionLoading}
            menuChangeActionMessage={menuChangeActionMessage}
            canManageMenuRequests={canManageMenuRequests}
            onResolveMenuChange={handleResolveMenuChangeRequest}
            onCloneTemplate={cloneTemplateToBooking}
          />
        )}
        {tabId === 'staff' && (
          <StaffTab bookingId={booking.id} onBack={() => goToTab('menu')} />
        )}
        {tabId === 'crm' && (
          <CrmTab booking={booking} onContinue={() => goToTab('review')} />
        )}
        {tabId === 'review' && (
          <ReviewTab
            booking={booking}
            menuStatus={menuStatus}
            menuReadyForConfirmation={menuReadyForConfirmation}
            saveError={saveError}
            confirmSuccess={confirmSuccess}
            defaultDepositPercent={rules.pricing.defaultDepositPercent}
            onBack={() => goToTab('crm')}
            onConfirm={handleConfirmEvent}
            onSaveAsDraft={handleSaveAsDraft}
            onGoToTab={goToTab}
          />
        )}

      </div>
    </div>
  );
}

function EventDetailPageInner() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm text-text-muted">Loading…</p></div>}>
      <EventDetailContent />
    </Suspense>
  );
}

export default function EventDetailPage() {
  return (
    <Suspense>
      <EventDetailPageInner />
    </Suspense>
  );
}

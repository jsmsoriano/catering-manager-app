'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BanknotesIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilSquareIcon,
  ShoppingCartIcon,
  TableCellsIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { formatPhone, isValidPhone } from '@/lib/phoneUtils';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import { isModuleEnabled, getPricingSlot } from '@/lib/templateConfig';
import type { Booking, BookingStatus, BookingFormData, BookingPricingSnapshot, PaymentStatus } from '@/lib/bookingTypes';
import type { EventMenu, GuestMenuSelection } from '@/lib/menuTypes';
import type { EventFinancials } from '@/lib/types';
import type { StaffMember as StaffRecord, StaffAssignment } from '@/lib/staffTypes';
import { CHEF_ROLE_TO_STAFF_ROLE, ROLE_LABELS as STAFF_ROLE_LABELS } from '@/lib/staffTypes';
import type {
  CustomerPaymentMethod,
  CustomerPaymentRecord,
  LaborPaymentRecord,
} from '@/lib/financeTypes';
import {
  loadCustomerPayments,
  loadLaborPayments,
  saveCustomerPayments,
  saveLaborPayments,
} from '@/lib/financeStorage';
import {
  applyConfirmationPaymentTerms,
  applyPaymentToBooking,
  applyRefundToBooking,
  getBookingServiceStatus,
  normalizeBookingWorkflowFields,
  toLocalDateISO,
} from '@/lib/bookingWorkflow';
import {
  ensureShoppingListForBooking,
  loadShoppingLists,
  removeShoppingListForBooking,
} from '@/lib/shoppingStorage';
const CHEF_ROLE_LABELS: Record<string, string> = {
  lead: 'Lead Chef',
  overflow: 'Overflow Chef',
  full: 'Full Chef',
  buffet: 'Buffet Chef',
  assistant: 'Assistant',
};

const BOOKING_STAFF_PALETTE = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-orange-500',
];

function getStaffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p[0].toUpperCase()).join('');
}

function getTemplateLabel(labels: Record<string, string> | undefined, key: string, fallback: string): string {
  return labels?.[key] ?? fallback;
}

interface StaffConflict {
  staffId: string;
  staffName: string;
  conflictingBooking: Booking;
}

const PROTEIN_LABELS: Record<string, string> = {
  chicken: 'Chicken',
  steak: 'Steak',
  shrimp: 'Shrimp',
  scallops: 'Scallops',
};

function MenuSummaryContent({ selections }: { selections: GuestMenuSelection[] }) {
  const proteinCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selections.forEach((s) => {
      [s.protein1, s.protein2].forEach((p) => {
        counts[p] = (counts[p] ?? 0) + 1;
      });
    });
    return counts;
  }, [selections]);
  const sides = useMemo(() => {
    let friedRice = 0, noodles = 0, salad = 0, veggies = 0;
    selections.forEach((s) => {
      if (s.wantsFriedRice) friedRice++;
      if (s.wantsNoodles) noodles++;
      if (s.wantsSalad) salad++;
      if (s.wantsVeggies) veggies++;
    });
    return { friedRice, noodles, salad, veggies };
  }, [selections]);
  const withRequests = selections.filter((s) => (s.specialRequests ?? '').trim());
  const withAllergies = selections.filter((s) => (s.allergies ?? '').trim());

  return (
    <div className="space-y-3 text-sm">
      <div>
        <span className="font-medium text-text-secondary">Proteins: </span>
        <span className="text-text-primary">
          {Object.entries(proteinCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([p, n]) => `${PROTEIN_LABELS[p] ?? p} (${n})`)
            .join(', ')}
        </span>
      </div>
      <div>
        <span className="font-medium text-text-secondary">Sides: </span>
        <span className="text-text-primary">
          Fried rice {sides.friedRice}/{selections.length}, Noodles {sides.noodles}/{selections.length}, Salad {sides.salad}/{selections.length}, Veggies {sides.veggies}/{selections.length}
        </span>
      </div>
      {withRequests.length > 0 && (
        <div>
          <span className="font-medium text-text-secondary">Special requests: </span>
          <ul className="mt-1 list-inside list-disc text-text-primary">
            {withRequests.map((s, i) => (
              <li key={s.id || i}>{s.specialRequests?.trim()}</li>
            ))}
          </ul>
        </div>
      )}
      {withAllergies.length > 0 && (
        <div>
          <span className="font-medium text-text-secondary">Allergies: </span>
          <ul className="mt-1 list-inside list-disc text-text-primary">
            {withAllergies.map((s, i) => (
              <li key={s.id || i}>{s.allergies?.trim()}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function getUniqueAssignedStaffIds(assignments?: StaffAssignment[]): string[] {
  if (!assignments || assignments.length === 0) return [];
  const ids = assignments
    .map((assignment) => assignment.staffId)
    .filter((staffId) => typeof staffId === 'string' && staffId.length > 0);
  return Array.from(new Set(ids));
}

function getDuplicateAssignedStaffIds(assignments?: StaffAssignment[]): string[] {
  if (!assignments || assignments.length === 0) return [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  assignments.forEach((assignment) => {
    if (!assignment.staffId) return;
    if (seen.has(assignment.staffId)) duplicates.add(assignment.staffId);
    seen.add(assignment.staffId);
  });

  return Array.from(duplicates);
}

function getAssignmentForPosition(
  assignments: StaffAssignment[] | undefined,
  financials: EventFinancials,
  positionIndex: number
): StaffAssignment | undefined {
  if (!assignments || assignments.length === 0) return undefined;

  const position = financials.staffingPlan.staff[positionIndex];
  const staffRole = CHEF_ROLE_TO_STAFF_ROLE[position.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
  if (!staffRole) return undefined;

  let sameRoleIndex = 0;
  for (let i = 0; i < positionIndex; i++) {
    if (financials.staffingPlan.staff[i].role === position.role) sameRoleIndex++;
  }

  let matchCount = 0;
  return assignments.find((assignment) => {
    if (assignment.role === staffRole) {
      if (matchCount === sameRoleIndex) return true;
      matchCount++;
    }
    return false;
  });
}

export default function BookingsPage() {
  const router = useRouter();
  const openedBookingFromQueryRef = useRef<string | null>(null);
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatuses, setFilterStatuses] = useState<BookingStatus[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'pipeline'>('table');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [sortField, setSortField] = useState<'eventDate' | 'customerName' | 'eventType' | 'guests' | 'total' | 'status'>('eventDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPaymentRecord[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ReturnType<typeof loadShoppingLists>>([]);
  const [actionsOpenForBookingId, setActionsOpenForBookingId] = useState<string | null>(null);
  const [eventSummaryBooking, setEventSummaryBooking] = useState<Booking | null>(null);
  const [paymentModalBooking, setPaymentModalBooking] = useState<Booking | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'zelle' as CustomerPaymentMethod,
    date: '',
    notes: '',
    paymentType: 'deposit' as 'deposit' | 'balance' | 'full' | 'refund',
  });
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null);
  const [emailToast, setEmailToast] = useState<'sent' | 'error' | null>(null);
  const [emailVerifyPending, setEmailVerifyPending] = useState<{
    type: 'confirmation' | 'receipt';
    booking: Booking;
    extra?: { amount: number; method: string };
  } | null>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);
  const statusFilterRef = useRef<HTMLDivElement>(null);

  const { config: templateConfig } = useTemplateConfig();
  const [formData, setFormData] = useState<BookingFormData>({
    eventType: 'private-dinner',
    eventDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    eventTime: '18:00',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    adults: 15,
    children: 0,
    location: '',
    distanceMiles: 10,
    premiumAddOn: 0,
    notes: '',
    discountType: undefined,
    discountValue: undefined,
    staffingProfileId: undefined,
    pricingMode: undefined,
    businessType: undefined,
  });

  // Pre-fill from "Book Again" on customers page
  useEffect(() => {
    const raw = sessionStorage.getItem('bookingPrefill');
    if (!raw) return;
    sessionStorage.removeItem('bookingPrefill');
    try {
      const prefill = JSON.parse(raw) as { customerName?: string; customerPhone?: string; customerEmail?: string };
      setFormData((prev) => ({
        ...prev,
        customerName:  prefill.customerName  ?? prev.customerName,
        customerEmail: prefill.customerEmail ?? prev.customerEmail,
        customerPhone: prefill.customerPhone ?? prev.customerPhone,
      }));
      setIsEditing(false);
      setShowModal(true);
    } catch {
      // malformed prefill — ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load bookings
  useEffect(() => {
    const loadBookings = () => {
      const saved = localStorage.getItem('bookings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Booking[];
          const normalized = parsed
            .filter((b) => b.source !== 'inquiry')
            .map((booking) => normalizeBookingWorkflowFields(booking));
          console.log('📅 Bookings: Loaded', normalized.length, 'bookings from localStorage');
          setBookings(normalized);
        } catch (e) {
          console.error('Failed to load bookings:', e);
        }
      }
    };

    loadBookings();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bookings') {
        console.log('📅 Bookings: Detected storage change (cross-tab)');
        loadBookings();
      }
    };

    const handleCustomStorageChange = () => {
      console.log('📅 Bookings: Detected bookingsUpdated event (same-tab)');
      loadBookings();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bookingsUpdated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bookingsUpdated', handleCustomStorageChange);
    };
  }, []);

  // Load staff records
  useEffect(() => {
    const loadStaff = () => {
      const saved = localStorage.getItem('staff');
      if (saved) {
        try {
          setStaffRecords(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load staff:', e);
        }
      }
    };

    loadStaff();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'staff') loadStaff();
    };
    const handleCustom = () => loadStaff();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('staffUpdated', handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('staffUpdated', handleCustom);
    };
  }, []);

  // Load customer payment records
  useEffect(() => {
    const loadPayments = () => {
      setCustomerPayments(loadCustomerPayments());
    };

    loadPayments();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'customerPayments') loadPayments();
    };
    const handleCustom = () => loadPayments();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('customerPaymentsUpdated', handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('customerPaymentsUpdated', handleCustom);
    };
  }, []);

  // Load shopping lists (for "has shopping list" indicators and dropdown labels)
  useEffect(() => {
    const load = () => setShoppingLists(loadShoppingLists());
    load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'shoppingLists') load();
    };
    const onCustom = () => load();
    window.addEventListener('storage', onStorage);
    window.addEventListener('shoppingListsUpdated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('shoppingListsUpdated', onCustom);
    };
  }, []);

  const bookingIdsWithShoppingList = useMemo(
    () => new Set(shoppingLists.map((list) => list.bookingId)),
    [shoppingLists]
  );

  const closeActionsDropdown = useCallback(() => setActionsOpenForBookingId(null), []);

  useEffect(() => {
    if (actionsOpenForBookingId === null) return;
    const handleClickOutside = (event: MouseEvent) => {
      const el = actionsDropdownRef.current;
      if (el && !el.contains(event.target as Node)) closeActionsDropdown();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionsOpenForBookingId, closeActionsDropdown]);

  useEffect(() => {
    if (!statusFilterOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const el = statusFilterRef.current;
      if (el && !el.contains(event.target as Node)) setStatusFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusFilterOpen]);

  const staffById = useMemo(() => {
    const map = new Map<string, StaffRecord>();
    staffRecords.forEach((staff) => map.set(staff.id, staff));
    return map;
  }, [staffRecords]);

  const staffColorMap = useMemo(() => {
    const map = new Map<string, string>();
    staffRecords.forEach((staff, i) => {
      map.set(staff.id, BOOKING_STAFF_PALETTE[i % BOOKING_STAFF_PALETTE.length]);
    });
    return map;
  }, [staffRecords]);

  const findStaffConflicts = (
    eventDate: string,
    eventTime: string,
    assignedStaffIds: string[],
    excludeBookingId?: string
  ): StaffConflict[] => {
    if (assignedStaffIds.length === 0) return [];
    const assignedSet = new Set(assignedStaffIds);
    const conflicts: StaffConflict[] = [];
    const seen = new Set<string>();

    bookings.forEach((otherBooking) => {
      if (excludeBookingId && otherBooking.id === excludeBookingId) return;
      if (getBookingServiceStatus(otherBooking) === 'cancelled') return;
      if (otherBooking.eventDate !== eventDate || otherBooking.eventTime !== eventTime) return;
      if (!otherBooking.staffAssignments || otherBooking.staffAssignments.length === 0) return;

      otherBooking.staffAssignments.forEach((assignment) => {
        if (!assignedSet.has(assignment.staffId)) return;
        const dedupeKey = `${assignment.staffId}:${otherBooking.id}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const staffName = staffById.get(assignment.staffId)?.name ?? `Staff ${assignment.staffId}`;
        conflicts.push({
          staffId: assignment.staffId,
          staffName,
          conflictingBooking: otherBooking,
        });
      });
    });

    return conflicts;
  };

  const saveBookings = (newBookings: Booking[]) => {
    const normalized = newBookings.map((booking) => normalizeBookingWorkflowFields(booking));
    console.log('📅 Bookings: Saving', normalized.length, 'bookings to localStorage');
    setBookings(normalized);
    localStorage.setItem('bookings', JSON.stringify(normalized));
    console.log('📅 Bookings: Dispatching bookingsUpdated event');
    window.dispatchEvent(new Event('bookingsUpdated'));
  };

  // Debounce search so filteredBookings useMemo doesn't re-run on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filteredBookings = useMemo(() => {
    let result = bookings;

    if (filterStatuses.length > 0) {
      result = result.filter((b) => filterStatuses.includes(getBookingServiceStatus(b)));
    }

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (b) =>
          b.customerName.toLowerCase().includes(query) ||
          b.customerEmail.toLowerCase().includes(query) ||
          b.location.toLowerCase().includes(query)
      );
    }

    // Pre-cache timestamps for eventDate sort to avoid creating new Date() per comparison
    if (sortField === 'eventDate') {
      const withTs = result.map((b) => ({ b, ts: new Date(b.eventDate).getTime() }));
      withTs.sort((a, z) => sortDirection === 'asc' ? a.ts - z.ts : z.ts - a.ts);
      return withTs.map((x) => x.b);
    }

    return result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'customerName':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'eventType':
          comparison = a.eventType.localeCompare(b.eventType);
          break;
        case 'guests':
          comparison = (a.adults + a.children) - (b.adults + b.children);
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
        case 'status':
          comparison = getBookingServiceStatus(a).localeCompare(getBookingServiceStatus(b));
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [bookings, filterStatuses, debouncedSearch, sortField, sortDirection]);

  // Single-pass stats calculation instead of 4 separate filter passes
  const stats = useMemo(() => {
    const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    for (const b of bookings) {
      const s = getBookingServiceStatus(b);
      if (s in counts) (counts as Record<string, number>)[s]++;
    }
    return counts;
  }, [bookings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const bookingId = new URLSearchParams(window.location.search).get('bookingId');
    if (!bookingId) return;
    if (openedBookingFromQueryRef.current === bookingId) return;

    const booking = bookings.find((entry) => entry.id === bookingId);
    if (!booking) return;

    openedBookingFromQueryRef.current = bookingId;
    setSelectedBooking(booking);
    setIsEditing(true);
    setFormData({
      eventType: booking.eventType,
      eventDate: booking.eventDate,
      eventTime: booking.eventTime,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      adults: booking.adults,
      children: booking.children,
      location: booking.location,
      distanceMiles: booking.distanceMiles,
      premiumAddOn: booking.premiumAddOn,
      notes: booking.notes,
      serviceStatus: getBookingServiceStatus(booking),
      discountType: booking.discountType,
      discountValue: booking.discountValue,
      staffAssignments: booking.staffAssignments,
      staffingProfileId: booking.staffingProfileId,
      pricingMode: booking.pricingMode ?? templateConfig.pricingModeDefault,
      businessType: booking.businessType ?? templateConfig.businessType,
    });
    setShowModal(true);
  }, [bookings, templateConfig.pricingModeDefault, templateConfig.businessType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors: string[] = [];
    if (formData.customerPhone && !isValidPhone(formData.customerPhone)) {
      validationErrors.push('Phone number must be in (xxx)-xxx-xxxx format.');
    }
    const duplicateStaffIds = getDuplicateAssignedStaffIds(formData.staffAssignments);
    if (duplicateStaffIds.length > 0) {
      const duplicateNames = duplicateStaffIds.map((staffId) => staffById.get(staffId)?.name ?? staffId);
      validationErrors.push(`Duplicate staff assignments are not allowed: ${duplicateNames.join(', ')}`);
    }

    const assignedStaffIds = getUniqueAssignedStaffIds(formData.staffAssignments);
    const conflicts = findStaffConflicts(
      formData.eventDate,
      formData.eventTime,
      assignedStaffIds,
      selectedBooking?.id
    );
    if (conflicts.length > 0) {
      const conflictLines = conflicts.map((conflict) =>
        `- ${conflict.staffName} is already assigned to ${conflict.conflictingBooking.customerName} (${conflict.conflictingBooking.eventDate} ${conflict.conflictingBooking.eventTime})`
      );
      validationErrors.push(`Staff double-booking conflict detected:\n${conflictLines.join('\n')}`);
    }

    if (validationErrors.length > 0) {
      alert(`Please fix the following before saving:\n\n${validationErrors.join('\n\n')}`);
      return;
    }

    const formPricingSlot = getPricingSlot(templateConfig.eventTypes, formData.eventType);
    const existingPricingSlot = selectedBooking
      ? getPricingSlot(templateConfig.eventTypes, selectedBooking.eventType)
      : formPricingSlot;
    const shouldPreserveMenuPricing = formPricingSlot === 'primary' && existingPricingSlot === 'primary';
    const preservedMenuSnapshot = shouldPreserveMenuPricing
      ? selectedBooking?.menuPricingSnapshot
      : undefined;
    const preservedMenuId = shouldPreserveMenuPricing ? selectedBooking?.menuId : undefined;

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
        pricingSlot: getPricingSlot(templateConfig.eventTypes, formData.eventType),
      },
      rules
    );

    const pricingSlot = getPricingSlot(templateConfig.eventTypes, formData.eventType);
    const adultBasePrice = pricingSlot === 'primary'
      ? rules.pricing.primaryBasePrice
      : rules.pricing.secondaryBasePrice;
    const pricingSnapshot: BookingPricingSnapshot = {
      adultBasePrice,
      childBasePrice: adultBasePrice * (1 - rules.pricing.childDiscountPercent / 100),
      gratuityPercent: rules.pricing.defaultGratuityPercent,
      capturedAt: new Date().toISOString(),
    };

    // Apply discount to revenue (subtotal) only; gratuity and distance fee unchanged
    let subtotalAfterDiscount = financials.subtotal;
    const discountType = formData.discountType;
    const discountValue = formData.discountValue ?? 0;
    if (discountType === 'percent' && Number.isFinite(discountValue) && discountValue > 0) {
      const discountAmount = Math.round(financials.subtotal * (discountValue / 100) * 100) / 100;
      subtotalAfterDiscount = Math.max(0, financials.subtotal - discountAmount);
    } else if (discountType === 'amount' && Number.isFinite(discountValue) && discountValue > 0) {
      subtotalAfterDiscount = Math.max(0, financials.subtotal - discountValue);
    }
    const totalWithDiscount = Math.round((subtotalAfterDiscount + financials.gratuity + financials.distanceFee) * 100) / 100;

    const serviceStatus = formData.serviceStatus ?? (selectedBooking ? getBookingServiceStatus(selectedBooking) : 'pending');
    const baseBooking = normalizeBookingWorkflowFields({
      id: selectedBooking?.id || `booking-${Date.now()}`,
      eventType: formData.eventType,
      eventDate: formData.eventDate,
      eventTime: formData.eventTime,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      adults: formData.adults,
      children: formData.children,
      location: formData.location,
      distanceMiles: formData.distanceMiles,
      premiumAddOn: formData.premiumAddOn,
      subtotal: subtotalAfterDiscount,
      gratuity: financials.gratuity,
      distanceFee: financials.distanceFee,
      total: totalWithDiscount,
      discountType: discountType && (discountValue > 0) ? discountType : undefined,
      discountValue: discountType && discountValue > 0 ? discountValue : undefined,
      status: serviceStatus,
      serviceStatus,
      paymentStatus: selectedBooking?.paymentStatus,
      depositPercent: selectedBooking?.depositPercent,
      depositAmount: selectedBooking?.depositAmount,
      depositDueDate: selectedBooking?.depositDueDate,
      balanceDueDate: selectedBooking?.balanceDueDate,
      amountPaid: selectedBooking?.amountPaid,
      balanceDueAmount: selectedBooking?.balanceDueAmount,
      confirmedAt: selectedBooking?.confirmedAt,
      prepPurchaseByDate: selectedBooking?.prepPurchaseByDate,
      notes: formData.notes,
      staffAssignments: formData.staffAssignments,
      staffingProfileId: formData.staffingProfileId,
      menuId: preservedMenuId,
      menuPricingSnapshot: preservedMenuSnapshot,
      pricingSnapshot,
      reconciliationId: selectedBooking?.reconciliationId,
      pricingMode: formData.pricingMode ?? templateConfig.pricingModeDefault,
      businessType: formData.businessType ?? templateConfig.businessType,
      createdAt: selectedBooking?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const booking = normalizeBookingWorkflowFields(
      serviceStatus === 'confirmed' || serviceStatus === 'completed'
        ? {
            ...baseBooking,
            depositAmount:
              Math.round(
                baseBooking.total * ((baseBooking.depositPercent ?? 30) / 100) * 100
              ) / 100,
          }
        : baseBooking
    );

    if (isEditing && selectedBooking) {
      saveBookings(bookings.map((b) => (b.id === selectedBooking.id ? booking : b)));
    } else {
      saveBookings([...bookings, booking]);
    }

    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedBooking(null);
    setIsEditing(false);
    setFormData({
      eventType: 'private-dinner',
      eventDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      eventTime: '18:00',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      adults: 15,
      children: 0,
      location: '',
      distanceMiles: 10,
      premiumAddOn: 0,
      notes: '',
      serviceStatus: undefined,
      discountType: undefined,
      discountValue: undefined,
      staffAssignments: undefined,
      staffingProfileId: undefined,
      pricingMode: templateConfig.pricingModeDefault,
      businessType: templateConfig.businessType,
    });
  };

  const handleDelete = () => {
    if (selectedBooking && confirm(`Delete booking for ${selectedBooking.customerName}?`)) {
      const remainingLaborPayments = loadLaborPayments().filter((record) => record.bookingId !== selectedBooking.id);
      saveLaborPayments(remainingLaborPayments);
      const remainingCustomerPayments = loadCustomerPayments().filter(
        (record) => record.bookingId !== selectedBooking.id
      );
      saveCustomerPayments(remainingCustomerPayments);
      removeShoppingListForBooking(selectedBooking.id);
      saveBookings(bookings.filter((b) => b.id !== selectedBooking.id));
      setShowModal(false);
      resetForm();
    }
  };

  const updateBookingStatus = (booking: Booking, newStatus: BookingStatus) => {
    const now = new Date().toISOString();
    const serviceStatus = getBookingServiceStatus(booking);
    let updatedAssignments = booking.staffAssignments;

    if (newStatus === 'completed') {
      const { financials } = calculateBookingFinancials(booking, rules);
      const missingAssignmentRoles: string[] = [];
      const unknownStaffNames: string[] = [];

      for (let idx = 0; idx < financials.staffingPlan.staff.length; idx++) {
        const assignment = getAssignmentForPosition(booking.staffAssignments, financials, idx);
        const roleLabel = CHEF_ROLE_LABELS[financials.staffingPlan.staff[idx].role] ?? financials.staffingPlan.staff[idx].role;
        if (!assignment?.staffId) {
          missingAssignmentRoles.push(roleLabel);
          continue;
        }
        if (!staffById.has(assignment.staffId)) {
          unknownStaffNames.push(assignment.staffId);
        }
      }

      if (missingAssignmentRoles.length > 0) {
        alert(
          `Cannot mark booking as completed until all staffing positions are assigned.\n\nMissing assignments:\n- ${missingAssignmentRoles.join('\n- ')}`
        );
        return;
      }

      if (unknownStaffNames.length > 0) {
        alert(
          `Cannot mark booking as completed because some assigned staff records are missing:\n- ${unknownStaffNames.join('\n- ')}`
        );
        return;
      }

      const duplicateStaffIds = getDuplicateAssignedStaffIds(booking.staffAssignments);
      if (duplicateStaffIds.length > 0) {
        const duplicateNames = duplicateStaffIds.map((staffId) => staffById.get(staffId)?.name ?? staffId);
        alert(`Cannot mark completed with duplicate staff assignments:\n- ${duplicateNames.join('\n- ')}`);
        return;
      }

      const assignedStaffIds = getUniqueAssignedStaffIds(booking.staffAssignments);
      const conflicts = findStaffConflicts(booking.eventDate, booking.eventTime, assignedStaffIds, booking.id);
      if (conflicts.length > 0) {
        const details = conflicts.map((conflict) =>
          `- ${conflict.staffName} already assigned to ${conflict.conflictingBooking.customerName}`
        );
        alert(`Cannot mark completed due to staff double-booking:\n${details.join('\n')}`);
        return;
      }

      const existingLaborPayments = loadLaborPayments().filter((record) => record.bookingId !== booking.id);
      const recordedLaborPayments: LaborPaymentRecord[] = [];

      for (let idx = 0; idx < financials.laborCompensation.length; idx++) {
        const compensation = financials.laborCompensation[idx];
        const assignment = getAssignmentForPosition(booking.staffAssignments, financials, idx);
        if (!assignment?.staffId) continue;

        const staff = staffById.get(assignment.staffId);
        recordedLaborPayments.push({
          id: `labor-${booking.id}-${idx}`,
          bookingId: booking.id,
          eventDate: booking.eventDate,
          eventTime: booking.eventTime,
          customerName: booking.customerName,
          staffId: assignment.staffId,
          staffName: staff?.name ?? assignment.staffId,
          staffRole: assignment.role,
          chefRole: compensation.role,
          amount: compensation.finalPay,
          recordedAt: now,
        });
      }

      saveLaborPayments([...existingLaborPayments, ...recordedLaborPayments]);
      updatedAssignments = booking.staffAssignments?.map((assignment) => ({
        ...assignment,
        status: 'completed' as const,
      }));
    } else {
      if (newStatus === 'confirmed') {
        const assignedStaffIds = getUniqueAssignedStaffIds(booking.staffAssignments);
        const conflicts = findStaffConflicts(booking.eventDate, booking.eventTime, assignedStaffIds, booking.id);
        if (conflicts.length > 0) {
          const details = conflicts.map((conflict) =>
            `- ${conflict.staffName} already assigned to ${conflict.conflictingBooking.customerName}`
          );
          alert(`Cannot confirm booking due to staff double-booking:\n${details.join('\n')}`);
          return;
        }
      }

      if (serviceStatus === 'completed') {
        const remainingLaborPayments = loadLaborPayments().filter((record) => record.bookingId !== booking.id);
        saveLaborPayments(remainingLaborPayments);
      }

      if (booking.staffAssignments && booking.staffAssignments.length > 0) {
        const assignmentStatus = newStatus === 'confirmed' ? 'confirmed' : 'scheduled';
        updatedAssignments = booking.staffAssignments.map((assignment) => ({
          ...assignment,
          status: assignmentStatus,
        }));
      }
    }

    const bookingWithNewServiceStatus: Booking = {
      ...booking,
      status: newStatus,
      serviceStatus: newStatus,
      staffAssignments: updatedAssignments,
      updatedAt: now,
    };

    const nextBooking =
      newStatus === 'confirmed'
        ? applyConfirmationPaymentTerms(bookingWithNewServiceStatus, now, rules.pricing.defaultDepositPercent)
        : normalizeBookingWorkflowFields(
            newStatus === 'completed' && !bookingWithNewServiceStatus.confirmedAt
              ? { ...bookingWithNewServiceStatus, confirmedAt: now }
              : bookingWithNewServiceStatus
          );

    if (newStatus === 'completed') {
      (nextBooking as Booking).locked = true;
    }

    if (newStatus === 'confirmed' || newStatus === 'completed') {
      ensureShoppingListForBooking(booking.id);
    }

    saveBookings(
      bookings.map((b) =>
        b.id === booking.id
          ? nextBooking
          : b
      )
    );

  };

  // A booking is locked if explicitly locked OR if it's completed and never explicitly unlocked
  const isBookingLocked = (b: Booking) =>
    b.locked === true || (getBookingServiceStatus(b) === 'completed' && b.locked !== false);

  const unlockBooking = (booking: Booking) => {
    const now = new Date().toISOString();
    saveBookings(
      bookings.map((b) =>
        b.id === booking.id ? { ...b, locked: false, updatedAt: now } : b
      )
    );
  };

  // Payment column: user-facing labels (Deposit Pending, Deposit Received, Balance Outstanding, Paid in Full, Refunded)
  const dayAfterEventLocal = (eventDate: string): string => {
    const [y, m, d] = eventDate.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
    return toLocalDateISO(addDays(new Date(y, m - 1, d), 1));
  };

  const paymentDisplayLabelForBooking = (booking: Booking): string => {
    const nb = normalizeBookingWorkflowFields(booking);
    const status = nb.paymentStatus ?? 'unpaid';
    const total = nb.total ?? 0;
    const amountPaid = nb.amountPaid ?? 0;
    const depositAmount = nb.depositAmount ?? 0;
    const balanceDue = nb.balanceDueAmount ?? Math.max(0, total - amountPaid);
    const today = toLocalDateISO(new Date());
    const dayAfter = dayAfterEventLocal(nb.eventDate ?? '');

    if (status === 'paid-in-full') return 'Paid in Full';
    if (status === 'refunded') return 'Refunded';
    // 1+ day after event and balance not fully paid → Balance Outstanding
    if (balanceDue > 0.009 && dayAfter && today >= dayAfter) return 'Balance Outstanding';
    // Deposit recorded and before "day after event" → Deposit Received
    if (amountPaid >= depositAmount - 0.009) return 'Deposit Received';
    return 'Deposit Pending';
  };

  const isBalanceOverdue = (booking: Booking): boolean => {
    const nb = normalizeBookingWorkflowFields(booking);
    const balanceDue = nb.balanceDueAmount ?? Math.max(0, (nb.total ?? 0) - (nb.amountPaid ?? 0));
    if (balanceDue <= 0.009) return false;
    const dayAfter = dayAfterEventLocal(nb.eventDate ?? '');
    if (!dayAfter) return false;
    const today = toLocalDateISO(new Date());
    return today >= dayAfter;
  };

  const paymentDisplayColors: Record<string, string> = {
    'Deposit Pending': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    'Deposit Received': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    'Balance Outstanding': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'Paid in Full': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    Refunded: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  };

  const openPaymentModal = (booking: Booking) => {
    const nb = normalizeBookingWorkflowFields(booking);
    const depositRemaining = Math.max(0, (nb.depositAmount ?? 0) - (nb.amountPaid ?? 0));
    const balanceRemaining = Math.max(0, nb.balanceDueAmount ?? 0);
    const needsDeposit = depositRemaining > 0.009;
    const defaultType: 'deposit' | 'balance' | 'full' = needsDeposit ? 'deposit' : 'balance';
    const defaultAmount = needsDeposit ? depositRemaining : balanceRemaining;
    setPaymentModalBooking(nb);
    setPaymentForm({
      amount: defaultAmount > 0 ? defaultAmount.toFixed(2) : '',
      method: 'zelle',
      date: toLocalDateISO(new Date()),
      notes: '',
      paymentType: defaultType,
    });
    setPaymentFormError(null);
  };

  const showEmailFeedback = (status: 'sent' | 'error') => {
    setEmailToast(status);
    setTimeout(() => setEmailToast(null), 3000);
  };

  const sendEmail = async (
    type: 'confirmation' | 'receipt',
    booking: Booking,
    extra?: { amount: number; method: string }
  ) => {
    const res = await fetch('/api/emails/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        booking,
        businessName: templateConfig.businessName || 'Catering Manager',
        ...extra,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Email send failed');
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!emailVerifyPending) return;
    const { type, booking, extra } = emailVerifyPending;
    setEmailVerifyPending(null);
    try {
      await sendEmail(type, booking, extra);
      showEmailFeedback('sent');
    } catch {
      showEmailFeedback('error');
    }
  };

  const handleSubmitPayment = () => {
    if (!paymentModalBooking) return;
    const amount = parseFloat(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentFormError('Enter a valid amount greater than $0.');
      return;
    }
    const now = new Date().toISOString();
    const isRefund = paymentForm.paymentType === 'refund';
    if (isRefund) {
      const maxRefund = paymentModalBooking.amountPaid ?? 0;
      if (amount > maxRefund + 0.01) {
        setPaymentFormError(`Refund cannot exceed amount paid (${formatCurrency(maxRefund)}).`);
        return;
      }
    }
    const paymentType: CustomerPaymentRecord['type'] =
      paymentForm.paymentType === 'deposit' ? 'deposit' : paymentForm.paymentType === 'refund' ? 'refund' : 'payment';
    const paymentRecord: CustomerPaymentRecord = {
      id: `custpay-${paymentModalBooking.id}-${Date.now()}`,
      bookingId: paymentModalBooking.id,
      paymentDate: paymentForm.date,
      amount,
      type: paymentType,
      method: paymentForm.method,
      notes: paymentForm.notes || undefined,
      recordedAt: now,
    };
    saveCustomerPayments([...loadCustomerPayments(), paymentRecord]);
    let updatedBooking: Booking;
    if (isRefund) {
      updatedBooking = applyRefundToBooking(paymentModalBooking, amount, paymentForm.date);
    } else {
      updatedBooking = applyPaymentToBooking(paymentModalBooking, amount, paymentForm.date);
      if (
        (updatedBooking.paymentStatus === 'paid-in-full') &&
        (getBookingServiceStatus(paymentModalBooking) === 'pending')
      ) {
        updatedBooking = {
          ...updatedBooking,
          status: 'confirmed',
          serviceStatus: 'confirmed',
          confirmedAt: updatedBooking.confirmedAt ?? now,
        };
        updatedBooking = normalizeBookingWorkflowFields(updatedBooking, paymentForm.date);
      }
    }
    saveBookings(
      bookings.map((b) =>
        b.id === paymentModalBooking.id
          ? { ...updatedBooking, updatedAt: now }
          : b
      )
    );
    if (selectedBooking?.id === paymentModalBooking.id) setSelectedBooking(updatedBooking);
    setPaymentModalBooking(null);
    // Show verification popup before sending receipt (payment only, not refunds)
    if (!isRefund && updatedBooking.customerEmail) {
      setEmailVerifyPending({
        type: 'receipt',
        booking: updatedBooking,
        extra: { amount, method: paymentForm.method },
      });
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Compute staffing plan from current form data
  const currentFinancials = useMemo(() => {
    if (!formData.adults) return null;
    const curPricingSlot = getPricingSlot(templateConfig.eventTypes, formData.eventType);
    const selPricingSlot = selectedBooking
      ? getPricingSlot(templateConfig.eventTypes, selectedBooking.eventType)
      : curPricingSlot;
    const activeMenuSnapshot =
      curPricingSlot === 'primary' && selPricingSlot === 'primary'
        ? selectedBooking?.menuPricingSnapshot
        : undefined;

    return calculateEventFinancials(
      {
        adults: formData.adults,
        children: formData.children,
        eventType: formData.eventType,
        eventDate: new Date(formData.eventDate),
        distanceMiles: formData.distanceMiles,
        premiumAddOn: formData.premiumAddOn,
        subtotalOverride: activeMenuSnapshot?.subtotalOverride,
        foodCostOverride: activeMenuSnapshot?.foodCostOverride,
        staffingProfileId: formData.staffingProfileId,
        pricingSlot: curPricingSlot,
      },
      rules
    );
  }, [formData.eventType, formData.adults, formData.children, formData.distanceMiles, formData.premiumAddOn, formData.eventDate, formData.staffingProfileId, selectedBooking, rules, templateConfig.eventTypes]);

  const selectedStaffIdsInForm = useMemo(
    () => new Set(getUniqueAssignedStaffIds(formData.staffAssignments)),
    [formData.staffAssignments]
  );

  // Get available staff for a given ChefRole: must match role (primary or secondary), and not double-booked on another event.
  // We do not filter by calendar availability here so that lead chef and assistant can always be assigned; double-booking is still blocked.
  // If currentlyAssignedStaffId is set, that staff is always included when they match the role and are active.
  const getAvailableStaff = (chefRole: string, currentlyAssignedStaffId?: string): StaffRecord[] => {
    const requiredStaffRole = CHEF_ROLE_TO_STAFF_ROLE[chefRole as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
    if (!requiredStaffRole) return [];
    const eventDate = formData.eventDate;
    const eventTime = formData.eventTime ?? '18:00';
    const excludeBookingId = selectedBooking?.id;

    const roleMatches = (s: StaffRecord) =>
      s.primaryRole === requiredStaffRole || (s.secondaryRoles ?? []).includes(requiredStaffRole);

    const available = staffRecords.filter((s) => {
      if (s.status !== 'active') return false;
      if (!roleMatches(s)) return false;
      // Only exclude if already assigned to another booking at same date/time (double-book); do not filter by calendar availability
      const conflicts = findStaffConflicts(eventDate, eventTime, [s.id], excludeBookingId);
      if (conflicts.length > 0) return false;
      return true;
    });

    // Per business rules: keep currently assigned staff in the list so user can retain or change the assignment
    if (currentlyAssignedStaffId) {
      const current = staffRecords.find((s) => s.id === currentlyAssignedStaffId);
      if (current && current.status === 'active' && roleMatches(current) && !available.some((a) => a.id === current.id)) {
        return [...available, current];
      }
    }
    return available;
  };

  // Find the assignment for a staffing plan position (handles duplicate roles)
  const findAssignmentForPosition = (positionIndex: number): StaffAssignment | undefined => {
    if (!currentFinancials || !formData.staffAssignments) return undefined;
    const position = currentFinancials.staffingPlan.staff[positionIndex];
    const staffRole = CHEF_ROLE_TO_STAFF_ROLE[position.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];

    // Count how many earlier positions have the same role
    let sameRoleIndex = 0;
    for (let i = 0; i < positionIndex; i++) {
      if (currentFinancials.staffingPlan.staff[i].role === position.role) sameRoleIndex++;
    }

    // Find the nth assignment with this role
    let matchCount = 0;
    return formData.staffAssignments.find((a) => {
      if (a.role === staffRole) {
        if (matchCount === sameRoleIndex) return true;
        matchCount++;
      }
      return false;
    });
  };

  // Update a staff assignment for a given position index
  const updateStaffAssignment = (positionIndex: number, staffId: string) => {
    if (!currentFinancials) return;
    const position = currentFinancials.staffingPlan.staff[positionIndex];
    const staffRole = CHEF_ROLE_TO_STAFF_ROLE[position.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
    const estimatedPay = currentFinancials.laborCompensation[positionIndex]?.finalPay || 0;

    // Count how many earlier positions have the same role
    let sameRoleIndex = 0;
    for (let i = 0; i < positionIndex; i++) {
      if (currentFinancials.staffingPlan.staff[i].role === position.role) sameRoleIndex++;
    }

    const assignments = [...(formData.staffAssignments || [])];

    // Find existing assignment for this position
    let matchCount = 0;
    const existingIdx = assignments.findIndex((a) => {
      if (a.role === staffRole) {
        if (matchCount === sameRoleIndex) return true;
        matchCount++;
      }
      return false;
    });

    if (!staffId) {
      if (existingIdx >= 0) assignments.splice(existingIdx, 1);
    } else {
      const duplicateAssignmentIdx = assignments.findIndex(
        (assignment, idx) => idx !== existingIdx && assignment.staffId === staffId
      );
      if (duplicateAssignmentIdx >= 0) {
        const staffName = staffById.get(staffId)?.name ?? 'This staff member';
        alert(`${staffName} is already assigned to another position for this booking.`);
        return;
      }

      const newAssignment: StaffAssignment = { staffId, role: staffRole, estimatedPay, status: 'scheduled' };
      if (existingIdx >= 0) {
        assignments[existingIdx] = newAssignment;
      } else {
        assignments.push(newAssignment);
      }
    }

    setFormData({
      ...formData,
      staffAssignments: assignments.length > 0 ? assignments : undefined,
    });
  };

  // Events table: text-only (no pill) for Status and Payment columns
  const statusTextColors: Record<BookingStatus, string> = {
    pending: 'text-amber-700 dark:text-amber-300',
    confirmed: 'text-blue-700 dark:text-blue-300',
    completed: 'text-emerald-700 dark:text-emerald-300',
    cancelled: 'text-slate-600 dark:text-slate-400',
  };
  const paymentTextColors: Record<string, string> = {
    'Deposit Pending': 'text-amber-700 dark:text-amber-300',
    'Deposit Received': 'text-sky-700 dark:text-sky-300',
    'Balance Outstanding': 'text-red-700 dark:text-red-300',
    'Paid in Full': 'text-emerald-700 dark:text-emerald-300',
    Refunded: 'text-rose-700 dark:text-rose-300',
  };
  // Left-border accent for quick scanning (Events table)
  const statusBorderColors: Record<BookingStatus, string> = {
    pending: 'border-l-amber-500',
    confirmed: 'border-l-blue-500',
    completed: 'border-l-emerald-500',
    cancelled: 'border-l-slate-400',
  };
  const paymentBorderColors: Record<string, string> = {
    'Deposit Pending': 'border-l-amber-500',
    'Deposit Received': 'border-l-sky-500',
    'Balance Outstanding': 'border-l-red-500',
    'Paid in Full': 'border-l-emerald-500',
    Refunded: 'border-l-rose-500',
  };

  // Load event menu for summary when Event Summary modal is open
  const eventSummaryMenu = useMemo((): EventMenu | null => {
    if (!eventSummaryBooking?.menuId || typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('eventMenus');
      if (!raw) return null;
      const menus: EventMenu[] = JSON.parse(raw);
      return menus.find((m) => m.id === eventSummaryBooking.menuId) ?? null;
    } catch {
      return null;
    }
  }, [eventSummaryBooking?.id, eventSummaryBooking?.menuId]);

  const selectedBookingPayments = useMemo(() => {
    if (!selectedBooking) return [];
    return customerPayments
      .filter((payment) => payment.bookingId === selectedBooking.id)
      .sort((a, b) => `${b.paymentDate}-${b.recordedAt}`.localeCompare(`${a.paymentDate}-${a.recordedAt}`));
  }, [customerPayments, selectedBooking]);

  const PIPELINE_COLUMNS = [
    { status: 'pending',   label: 'Pending',   colorClass: 'border-amber-400/40',  headerClass: 'bg-amber-400/10 text-amber-600 dark:text-amber-400' },
    { status: 'confirmed', label: 'Confirmed', colorClass: 'border-info/40',       headerClass: 'bg-info/10 text-info' },
    { status: 'completed', label: 'Completed', colorClass: 'border-success/40',    headerClass: 'bg-success/10 text-success' },
    { status: 'cancelled', label: 'Cancelled', colorClass: 'border-border',        headerClass: 'bg-card-elevated text-text-muted' },
  ];

  return (
    <div className="h-full p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Events
          </h1>
          <p className="mt-2 text-text-secondary">
            Manage events and customer information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="rounded-md bg-accent px-4 py-2 text-white hover:bg-accent-hover"
          >
            + New Event
          </button>
        </div>
      </div>

      {/* Summary Cards: Pending, Confirmed, Completed, Cancelled */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Pending
          </h3>
          <p className="mt-2 text-3xl font-bold text-text-primary">
            {stats.pending}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Confirmed
          </h3>
          <p className="mt-2 text-3xl font-bold text-accent">
            {stats.confirmed}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-success/20 p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Completed
          </h3>
          <p className="mt-2 text-3xl font-bold text-success">
            {stats.completed}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-danger/20 p-6">
          <h3 className="text-sm font-medium text-text-primary">
            Cancelled
          </h3>
          <p className="mt-2 text-3xl font-bold text-danger">
            {stats.cancelled}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        {/* View Toggle */}
        <div className="flex rounded-lg border border-border bg-card-elevated p-0.5">
          <button
            onClick={() => setViewMode('table')}
            title="Table view"
            className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
              viewMode === 'table'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <TableCellsIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            title="Calendar view"
            className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
              viewMode === 'calendar'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <CalendarDaysIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setViewMode('pipeline')}
            title="Pipeline view"
            className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
              viewMode === 'pipeline'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <ViewColumnsIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative" ref={statusFilterRef}>
          <button
            onClick={() => setStatusFilterOpen((o) => !o)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              filterStatuses.length > 0
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-card-elevated text-text-secondary hover:bg-card hover:text-text-primary'
            }`}
          >
            <ChevronDownIcon className="h-4 w-4" />
            Status
            {filterStatuses.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">
                {filterStatuses.length}
              </span>
            )}
          </button>
          {statusFilterOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-card shadow-lg">
              <div className="p-1">
                {(['pending', 'confirmed', 'completed', 'cancelled'] as BookingStatus[]).map((s) => {
                  const checked = filterStatuses.includes(s);
                  return (
                    <label
                      key={s}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-card-elevated hover:text-text-primary"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setFilterStatuses((prev) =>
                            checked ? prev.filter((x) => x !== s) : [...prev, s]
                          )
                        }
                        className="h-4 w-4 rounded border-border accent-accent"
                      />
                      <span className="capitalize">{s}</span>
                    </label>
                  );
                })}
                {filterStatuses.length > 0 && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={() => { setFilterStatuses([]); setStatusFilterOpen(false); }}
                      className="w-full rounded-md px-3 py-1.5 text-left text-xs text-text-muted hover:bg-card-elevated hover:text-text-primary"
                    >
                      Clear filter
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <input
          type="text"
          placeholder="Search by customer or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-md border border-border px-4 py-2 text-sm text-text-primary bg-card-elevated"
        />
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' ? (
        <div className="rounded-lg border border-border bg-card p-3 sm:p-6">
          {/* Calendar Header */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
              className="rounded-md px-3 py-2 text-text-secondary hover:bg-card-elevated "
            >
              ← Previous
            </button>
            <h2 className="text-xl font-bold text-text-primary">
              {format(calendarMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              className="rounded-md px-3 py-2 text-text-secondary hover:bg-card-elevated "
            >
              Next →
            </button>
          </div>

          {/* Calendar Grid — horizontally scrollable on mobile */}
          <div className="overflow-x-auto">
          <div className="min-w-[560px]">
          <div className="grid grid-cols-7 gap-2">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-semibold text-text-secondary"
              >
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {(() => {
              const monthStart = startOfMonth(calendarMonth);
              const monthEnd = endOfMonth(calendarMonth);
              const calendarStart = startOfWeek(monthStart);
              const calendarEnd = endOfWeek(monthEnd);
              const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

              return calendarDays.map((day) => {
                const isCurrentMonth = day >= monthStart && day <= monthEnd;
                const dayBookings = filteredBookings.filter((booking) =>
                  isSameDay(new Date(booking.eventDate), day)
                );

                const openModalForDay = () => {
                  if (dayBookings.length > 0) {
                    const booking = dayBookings[0];
                    setSelectedBooking(booking);
                    setIsEditing(true);
                    setFormData({
                      eventType: booking.eventType,
                      eventDate: booking.eventDate,
                      eventTime: booking.eventTime,
                      customerName: booking.customerName,
                      customerEmail: booking.customerEmail,
                      customerPhone: booking.customerPhone,
                      adults: booking.adults,
                      children: booking.children,
                      location: booking.location,
                      distanceMiles: booking.distanceMiles,
                      premiumAddOn: booking.premiumAddOn,
                      notes: booking.notes,
                      serviceStatus: getBookingServiceStatus(booking),
                      discountType: booking.discountType,
                      discountValue: booking.discountValue,
                      staffAssignments: booking.staffAssignments,
                      staffingProfileId: booking.staffingProfileId,
                    });
                    setShowModal(true);
                  } else {
                    resetForm();
                    setFormData((prev) => ({ ...prev, eventDate: format(day, 'yyyy-MM-dd') }));
                    setShowModal(true);
                  }
                };

                return (
                  <div
                    key={day.toISOString()}
                    role="button"
                    tabIndex={0}
                    onClick={openModalForDay}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModalForDay(); } }}
                    className={`min-h-[100px] cursor-pointer rounded-lg border p-2 ${
                      isCurrentMonth
                        ? 'border-border bg-card-elevated'
                        : 'border-border bg-card-elevated/50'
                    }`}
                    title={dayBookings.length > 0 ? 'Click to edit a booking' : 'Click to add booking'}
                  >
                    <div
                      className={`mb-1 text-sm ${
                        isCurrentMonth
                          ? 'font-medium text-text-primary'
                          : 'text-text-muted'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayBookings.map((booking) => (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(booking);
                            setIsEditing(true);
                            setFormData({
                              eventType: booking.eventType,
                              eventDate: booking.eventDate,
                              eventTime: booking.eventTime,
                              customerName: booking.customerName,
                              customerEmail: booking.customerEmail,
                              customerPhone: booking.customerPhone,
                              adults: booking.adults,
                              children: booking.children,
                              location: booking.location,
                              distanceMiles: booking.distanceMiles,
                              premiumAddOn: booking.premiumAddOn,
                              notes: booking.notes,
                              serviceStatus: getBookingServiceStatus(booking),
                              discountType: booking.discountType,
                              discountValue: booking.discountValue,
                              staffAssignments: booking.staffAssignments,
                              staffingProfileId: booking.staffingProfileId,
                            });
                            setShowModal(true);
                          }}
                          className={`w-full rounded border-l-2 pl-1 py-0.5 text-left text-xs ${
                            statusBorderColors[getBookingServiceStatus(booking)]
                          } ${statusTextColors[getBookingServiceStatus(booking)]} truncate hover:opacity-80`}
                          title={`${booking.customerName} - ${booking.eventTime}`}
                        >
                          {booking.eventTime} {booking.customerName.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          </div>
          </div>

          {/* Calendar Legend: left border + text color match day cells */}
          <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-l-2 border-amber-500 bg-transparent"></div>
              <span className="text-sm text-text-secondary">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-l-2 border-blue-500 bg-transparent"></div>
              <span className="text-sm text-text-secondary">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-l-2 border-emerald-500 bg-transparent"></div>
              <span className="text-sm text-text-secondary">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-l-2 border-slate-400 bg-transparent"></div>
              <span className="text-sm text-text-secondary">Cancelled</span>
            </div>
          </div>
        </div>
      ) : viewMode === 'pipeline' ? (
        /* ── Pipeline / Kanban view ────────────────────────────────────────── */
        <div className="-mx-1 overflow-x-auto pb-4">
          <div className="flex min-w-max gap-4 px-1 pt-1">
            {PIPELINE_COLUMNS.map((col) => {
              const cards = filteredBookings.filter(
                (b) => getBookingServiceStatus(b) === col.status
              );
              return (
                <div
                  key={col.status}
                  className={`flex min-w-[85vw] flex-col rounded-xl border bg-card sm:min-w-0 sm:w-72 ${col.colorClass}`}
                >
                  {/* Column header */}
                  <div className={`flex items-center justify-between rounded-t-xl px-4 py-3 ${col.headerClass}`}>
                    <span className="text-sm font-semibold">{col.label}</span>
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold dark:bg-white/10">
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div
                    className="flex flex-col gap-2 overflow-y-auto p-2"
                    style={{ maxHeight: 'calc(100vh - 280px)' }}
                  >
                    {cards.length === 0 && (
                      <p className="py-8 text-center text-xs text-text-muted">No bookings</p>
                    )}
                    {cards.map((booking) => {
                      const nb = normalizeBookingWorkflowFields(booking);
                      const totalGuests = booking.adults + (booking.children ?? 0);
                      const payLabel = paymentDisplayLabelForBooking(nb);
                      const payTextClass =
                        payLabel === 'Balance Outstanding' && isBalanceOverdue(nb)
                          ? 'text-red-700 dark:text-red-300'
                          : (paymentTextColors[payLabel] ?? 'text-text-secondary');
                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => {
                            setSelectedBooking(nb);
                            setIsEditing(true);
                            setShowModal(true);
                          }}
                          className="w-full rounded-lg border border-border bg-card-elevated p-3 text-left shadow-sm transition-all hover:border-accent/50 hover:shadow-md"
                        >
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {booking.customerName}
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            {format(new Date(booking.eventDate + 'T00:00:00'), 'MMM d, yyyy')}
                            {booking.eventTime && ` · ${booking.eventTime}`}
                          </p>
                          <p className="text-xs text-text-muted">
                            {totalGuests} guest{totalGuests !== 1 ? 's' : ''}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-text-primary">
                              {formatCurrency(booking.total)}
                            </span>
                            {nb.paymentStatus && nb.paymentStatus !== 'unpaid' && (
                              <span className={`text-[10px] font-medium ${payTextClass}`}>
                                {payLabel}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Bookings Table - min-height for ~5 rows to avoid scrollbar with few records */
        <div className="rounded-lg border border-border bg-card ">
        <div className="overflow-x-auto min-h-[22rem]">
          <table className="w-full">
            <thead className="border-b border-border bg-card-elevated">
              <tr>
                {([
                  ['eventDate', 'Event Date', false],
                  ['customerName', 'Customer', false],
                  ['eventType', 'Type', true],
                  ['guests', getTemplateLabel(templateConfig.labels, 'guests', 'Guests'), true],
                  ['total', 'Total', false],
                  ['status', 'Status', false],
                ] as const).map(([field, label, mobileHide]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`cursor-pointer select-none px-4 py-3 text-left text-sm font-semibold text-text-primary hover:bg-card-elevated${mobileHide ? ' hidden md:table-cell' : ''}`}
                  >
                    {label} {sortField === field && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                ))}
                <th className="hidden px-4 py-3 text-left text-sm font-semibold text-text-primary md:table-cell">
                  Payment
                </th>
                <th className="hidden px-4 py-3 text-left text-sm font-semibold text-text-primary md:table-cell">
                  Staff
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border ">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-text-muted"
                  >
                    {searchQuery || filterStatuses.length > 0
                      ? 'No events match your filters'
                      : 'No events yet. Click "+ New Event" to get started!'}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking, rowIndex) => {
                  const isFirstRow = rowIndex === 0;
                  const isLastRow = rowIndex === filteredBookings.length - 1;
                  const openDropdownBelow = isFirstRow || !isLastRow;
                  return (
                  <tr
                    key={booking.id}
                    className="hover:bg-card-elevated /50"
                  >
                    <td className="px-4 py-4 text-sm text-text-primary">
                      {format(new Date(booking.eventDate), 'MMM dd, yyyy')}
                      <div className="text-xs text-text-muted">
                        {booking.eventTime}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="font-medium text-text-primary">
                        {booking.customerName}
                      </div>
                      <div className="text-xs text-text-muted">
                        {booking.customerEmail}
                      </div>
                      <div className="mt-0.5 text-xs text-text-muted md:hidden">
                        {templateConfig.eventTypes.find(e => e.id === booking.eventType)?.label ?? booking.eventType} · {booking.adults + booking.children} guests
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 text-sm text-text-secondary md:table-cell">
                      {templateConfig.eventTypes.find(e => e.id === booking.eventType)?.label ?? booking.eventType}
                    </td>
                    <td className="hidden px-4 py-4 text-sm text-text-secondary md:table-cell">
                      {booking.adults + booking.children}
                      <div className="text-xs text-text-muted">
                        ({booking.adults}A + {booking.children}C)
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-text-primary">
                      {formatCurrency(booking.total)}
                      <div className="text-xs text-text-muted">
                        {booking.menuPricingSnapshot ? 'menu pricing' : 'rules pricing'}
                      </div>
                    </td>
                    <td className="pl-3 px-4 py-4 text-sm">
                      {isBookingLocked(booking) ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium ${statusTextColors[getBookingServiceStatus(booking)]}`}>
                            {getBookingServiceStatus(booking).charAt(0).toUpperCase() + getBookingServiceStatus(booking).slice(1)}
                          </span>
                          <LockClosedIcon className="h-3.5 w-3.5 text-text-muted" title="Locked" />
                        </div>
                      ) : (
                        <select
                          value={getBookingServiceStatus(booking)}
                          onChange={(e) =>
                            updateBookingStatus(booking, e.target.value as BookingStatus)
                          }
                          className={`rounded border border-border bg-transparent px-1.5 py-0.5 text-xs font-medium focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${statusTextColors[getBookingServiceStatus(booking)]}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      )}
                    </td>
                    <td className="hidden pl-3 px-4 py-4 text-sm md:table-cell">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`text-xs font-medium ${
                            (() => {
                              const label = paymentDisplayLabelForBooking(booking);
                              if (label === 'Balance Outstanding' && isBalanceOverdue(booking)) return 'text-red-700 dark:text-red-300';
                              return paymentTextColors[label] ?? 'text-text-secondary';
                            })()
                          }`}
                        >
                          {paymentDisplayLabelForBooking(booking)}
                        </span>
                        <span className="text-xs text-text-muted">
                          Paid {formatCurrency(booking.amountPaid ?? 0)} · Due{' '}
                          {formatCurrency(
                            booking.balanceDueAmount ?? Math.max(0, booking.total - (booking.amountPaid ?? 0))
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 text-sm md:table-cell">
                      {booking.staffAssignments && booking.staffAssignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {booking.staffAssignments.map((a, i) => {
                            const member = staffById.get(a.staffId);
                            const initials = member ? getStaffInitials(member.name) : '?';
                            const color = staffColorMap.get(a.staffId) ?? 'bg-gray-400';
                            const roleLabel = STAFF_ROLE_LABELS[a.role] ?? a.role;
                            const title = member ? `${member.name} · ${roleLabel}` : roleLabel;
                            return (
                              <span
                                key={a.staffId ?? i}
                                title={title}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${color}`}
                              >
                                {initials}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        {/* Icons when menu or shopping list exists */}
                        {booking.eventType === 'private-dinner' && booking.menuId && (
                          <Link
                            href={`/bookings/menu?bookingId=${booking.id}`}
                            className="text-success hover:text-success/80"
                            title="Event menu configured"
                          >
                            <ClipboardDocumentListIcon className="h-5 w-5" />
                          </Link>
                        )}
                        {bookingIdsWithShoppingList.has(booking.id) && (
                          <Link
                            href={`/bookings/shopping?bookingId=${booking.id}`}
                            className="text-accent hover:text-accent-hover"
                            title="Shopping list exists"
                          >
                            <ShoppingCartIcon className="h-5 w-5" />
                          </Link>
                        )}
                        {/* Actions dropdown */}
                        <div
                          ref={actionsOpenForBookingId === booking.id ? actionsDropdownRef : undefined}
                          className="relative inline-block"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setActionsOpenForBookingId((id) =>
                                id === booking.id ? null : booking.id
                              )
                            }
                            className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1.5 text-sm font-medium text-text-primary hover:bg-card-elevated"
                            aria-expanded={actionsOpenForBookingId === booking.id}
                            aria-haspopup="true"
                          >
                            Actions
                            <ChevronDownIcon
                              className={`h-4 w-4 transition-transform ${
                                actionsOpenForBookingId === booking.id ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                            {actionsOpenForBookingId === booking.id && (
                            <div
                              className={`absolute right-0 z-20 min-w-[12rem] rounded-md border border-border bg-card py-1 shadow-lg ${
                                openDropdownBelow ? 'top-full mt-1' : 'bottom-full mb-1'
                              }`}
                              role="menu"
                            >
                              {/* Read-only actions — always visible */}
                              {getBookingServiceStatus(booking) === 'confirmed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeActionsDropdown();
                                    setEventSummaryBooking(booking);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-elevated"
                                  role="menuitem"
                                >
                                  <DocumentTextIcon className="h-4 w-4 shrink-0" />
                                  Event Summary
                                </button>
                              )}
                              {getBookingServiceStatus(booking) !== 'cancelled' && (
                                <Link
                                  href={`/invoices/${booking.id}`}
                                  onClick={closeActionsDropdown}
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-card-elevated"
                                  role="menuitem"
                                >
                                  <DocumentTextIcon className="h-4 w-4 shrink-0" />
                                  View Invoice
                                </Link>
                              )}
                              {(getBookingServiceStatus(booking) === 'completed' || booking.reconciliationId) && (
                                <Link
                                  href={`/bookings/reconcile?bookingId=${booking.id}`}
                                  onClick={closeActionsDropdown}
                                  className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-card-elevated ${
                                    booking.reconciliationId ? 'text-success' : 'text-text-primary'
                                  }`}
                                  role="menuitem"
                                >
                                  <DocumentTextIcon className="h-4 w-4 shrink-0" />
                                  {booking.reconciliationId ? '✓ Reconciled' : 'Reconcile'}
                                </Link>
                              )}

                              {/* Mutating actions — hidden when locked */}
                              {!isBookingLocked(booking) && (
                                <>
                                  {getBookingServiceStatus(booking) !== 'cancelled' &&
                                    (booking.paymentStatus ?? 'unpaid') !== 'paid-in-full' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          closeActionsDropdown();
                                          openPaymentModal(booking);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-elevated"
                                        role="menuitem"
                                      >
                                        <BanknotesIcon className="h-4 w-4 shrink-0" />
                                        Record Payment
                                      </button>
                                    )}
                                  {booking.customerEmail && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        closeActionsDropdown();
                                        setEmailVerifyPending({ type: 'confirmation', booking });
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-elevated"
                                      role="menuitem"
                                    >
                                      <EnvelopeIcon className="h-4 w-4 shrink-0" />
                                      Send Confirmation
                                    </button>
                                  )}
                                  {booking.eventType === 'private-dinner' && (
                                    <Link
                                      href={`/bookings/menu?bookingId=${booking.id}`}
                                      onClick={closeActionsDropdown}
                                      className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-card-elevated"
                                      role="menuitem"
                                    >
                                      <ClipboardDocumentListIcon className="h-4 w-4 shrink-0" />
                                      {booking.menuId ? 'Edit Menu' : 'Add Menu'}
                                    </Link>
                                  )}
                                  <Link
                                    href={`/bookings/shopping?bookingId=${booking.id}`}
                                    onClick={closeActionsDropdown}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-card-elevated"
                                    role="menuitem"
                                  >
                                    <ShoppingCartIcon className="h-4 w-4 shrink-0" />
                                    {bookingIdsWithShoppingList.has(booking.id)
                                      ? 'Update Shopping List'
                                      : 'Add Shopping List'}
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      closeActionsDropdown();
                                      setSelectedBooking(booking);
                                      setIsEditing(true);
                                      setFormData({
                                        eventType: booking.eventType,
                                        eventDate: booking.eventDate,
                                        eventTime: booking.eventTime,
                                        customerName: booking.customerName,
                                        customerEmail: booking.customerEmail,
                                        customerPhone: booking.customerPhone,
                                        adults: booking.adults,
                                        children: booking.children,
                                        location: booking.location,
                                        distanceMiles: booking.distanceMiles,
                                        premiumAddOn: booking.premiumAddOn,
                                        notes: booking.notes,
                                        serviceStatus: getBookingServiceStatus(booking),
                                        discountType: booking.discountType,
                                        discountValue: booking.discountValue,
                                        staffAssignments: booking.staffAssignments,
                                        staffingProfileId: booking.staffingProfileId,
                                      });
                                      setShowModal(true);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-elevated"
                                    role="menuitem"
                                  >
                                    <PencilSquareIcon className="h-4 w-4 shrink-0" />
                                    Edit Booking
                                  </button>
                                </>
                              )}

                              {/* Unlock — only when locked */}
                              {isBookingLocked(booking) && (
                                <>
                                  <div className="my-1 border-t border-border" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      closeActionsDropdown();
                                      unlockBooking(booking);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-elevated"
                                    role="menuitem"
                                  >
                                    <LockOpenIcon className="h-4 w-4 shrink-0" />
                                    Unlock Record
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-card p-6 ">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-text-primary">
                {isEditing ? 'Edit Event' : 'New Event'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="mb-4 font-semibold text-text-primary">
                  Customer Information
                </h3>
                <p className="mb-3 text-xs text-text-muted">
                  Enter the primary contact details used for confirmations, payment follow-up, and event updates.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-text-secondary">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) =>
                        setFormData({ ...formData, customerName: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, customerEmail: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.customerPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, customerPhone: formatPhone(e.target.value) })
                      }
                      placeholder="(xxx)-xxx-xxxx"
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-text-primary bg-card-elevated ${
                        formData.customerPhone && !isValidPhone(formData.customerPhone)
                          ? 'border-danger'
                          : 'border-border'
                      }`}
                    />
                    {formData.customerPhone && !isValidPhone(formData.customerPhone) && (
                      <p className="mt-1 text-xs text-danger">Format: (xxx)-xxx-xxxx</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-text-secondary">
                      Event address *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      placeholder="Event venue or delivery address"
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                    />
                  </div>
                </div>
              </div>

              {/* Event Details */}
              <div>
                <h3 className="mb-4 font-semibold text-text-primary">
                  Event Details
                </h3>
                <p className="mb-3 text-xs text-text-muted">
                  Set date and guest count accurately since pricing, staffing, and prep planning depend on this section.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {isEditing && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary">
                        Status
                      </label>
                      <select
                        value={formData.serviceStatus ?? 'pending'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            serviceStatus: e.target.value as BookingStatus,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Event Type *
                    </label>
                    <select
                      value={formData.eventType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eventType: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                    >
                      {templateConfig.eventTypes.map(et => (
                        <option key={et.id} value={et.id}>{et.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Event Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.eventDate}
                      onChange={(e) =>
                        setFormData({ ...formData, eventDate: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Event Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.eventTime}
                      onChange={(e) =>
                        setFormData({ ...formData, eventTime: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Adults *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.adults}
                      onChange={(e) =>
                        setFormData({ ...formData, adults: parseInt(e.target.value) || 1 })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Children
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.children}
                      onChange={(e) =>
                        setFormData({ ...formData, children: parseInt(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Distance (miles)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.distanceMiles}
                      onChange={(e) =>
                        setFormData({ ...formData, distanceMiles: parseInt(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                    />
                  </div>
                  {isModuleEnabled(templateConfig, 'guest_pricing') && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary">
                        {getTemplateLabel(templateConfig.labels, 'premiumAddOn', 'Premium Add-on')} ($/guest)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.premiumAddOn}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            premiumAddOn: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Staffing Profile Selector */}
              {(rules.staffing.profiles || []).length > 0 && (
                <div>
                  <h3 className="mb-4 font-semibold text-text-primary">
                    Staffing Profile
                  </h3>
                  <p className="mb-3 text-xs text-text-muted">
                    Choose a preset staffing setup for this event size, or leave Auto to apply your default business rules.
                  </p>
                  <select
                    value={formData.staffingProfileId || ''}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        staffingProfileId: e.target.value || undefined,
                        staffAssignments: undefined, // Clear assignments when profile changes
                      });
                    }}
                    className="w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                  >
                    <option value="">Auto (best match)</option>
                    {(rules.staffing.profiles || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.minGuests}–{p.maxGuests === 9999 ? '\u221E' : p.maxGuests} guests)
                      </option>
                    ))}
                  </select>
                  {currentFinancials?.staffingPlan.matchedProfileName && (
                    <p className="mt-1 text-sm text-text-muted">
                      Using profile: <span className="font-medium">{currentFinancials.staffingPlan.matchedProfileName}</span>
                    </p>
                  )}
                  {!currentFinancials?.staffingPlan.matchedProfileId && (
                    <p className="mt-1 text-sm text-text-muted">
                      Using default staffing rules
                    </p>
                  )}
                </div>
              )}

              {/* Staff Assignments */}
              {currentFinancials && currentFinancials.staffingPlan.staff.length > 0 && (
                <div>
                  <h3 className="mb-4 font-semibold text-text-primary">
                    Staff Assignments
                  </h3>
                  <p className="mb-3 text-xs text-text-muted">
                    Assign each role before completion to avoid conflicts and ensure labor payouts are recorded correctly.
                  </p>
                  <div className="space-y-3">
                    {currentFinancials.staffingPlan.staff.map((position, idx) => {
                      const assignment = findAssignmentForPosition(idx);
                      const available = getAvailableStaff(position.role, assignment?.staffId);
                      const laborComp = currentFinancials.laborCompensation[idx];

                      return (
                        <div
                          key={`${position.role}-${idx}`}
                          className="flex items-center gap-4 rounded-lg border border-border bg-card-elevated px-4 py-3"
                        >
                          <div className="min-w-[140px]">
                            <div className="text-sm font-medium text-text-primary">
                              {CHEF_ROLE_LABELS[position.role] || position.role}
                            </div>
                            {laborComp && (
                              <div className="text-xs text-text-muted">
                                Est. {formatCurrency(laborComp.finalPay)}
                              </div>
                            )}
                          </div>
                          <select
                            value={assignment?.staffId || ''}
                            onChange={(e) => updateStaffAssignment(idx, e.target.value)}
                            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-card-elevated"
                          >
                            <option value="">Unassigned</option>
                            {available.map((staff) => (
                              <option
                                key={staff.id}
                                value={staff.id}
                                disabled={selectedStaffIdsInForm.has(staff.id) && assignment?.staffId !== staff.id}
                              >
                                {staff.name}
                                {staff.primaryRole === CHEF_ROLE_TO_STAFF_ROLE[position.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE]
                                  ? ''
                                  : ` (${STAFF_ROLE_LABELS[staff.primaryRole] || staff.primaryRole})`}
                                {selectedStaffIdsInForm.has(staff.id) && assignment?.staffId !== staff.id
                                  ? ' - already assigned'
                                  : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  {staffRecords.filter((s) => s.status === 'active').length === 0 && (
                    <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                      No active staff found. Add staff members on the Staff page to assign them here.
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Notes
                </label>
                <p className="mb-2 text-xs text-text-muted">
                  Add internal context for your team, such as dietary restrictions, access instructions, or special setup details.
                </p>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated"
                  placeholder="Special requests, dietary restrictions, etc."
                />
              </div>

              {/* Apply discount (revenue/subtotal only, not gratuity) */}
              <div className="rounded-lg border border-border bg-card-elevated p-4">
                <h3 className="mb-2 font-semibold text-text-primary">
                  Apply discount
                </h3>
                <p className="mb-3 text-xs text-text-muted">
                  Discount applies to revenue (subtotal) only; gratuity and distance fee are unchanged.
                </p>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Type
                    </label>
                    <select
                      value={formData.discountType ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discountType: (e.target.value || undefined) as 'percent' | 'amount' | undefined,
                          discountValue: e.target.value ? (formData.discountValue ?? 0) : undefined,
                        })
                      }
                      className="mt-1 rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-card-elevated"
                    >
                      <option value="">No discount</option>
                      <option value="percent">Percent (%)</option>
                      <option value="amount">Amount ($)</option>
                    </select>
                  </div>
                  {(formData.discountType === 'percent' || formData.discountType === 'amount') && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary">
                        {formData.discountType === 'percent' ? 'Percent' : 'Amount'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step={formData.discountType === 'percent' ? 1 : 0.01}
                        value={formData.discountValue ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discountValue: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder={formData.discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                        className="mt-1 w-28 rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-card-elevated"
                      />
                      {formData.discountType === 'percent' && <span className="ml-1 text-sm text-text-muted">%</span>}
                      {formData.discountType === 'amount' && <span className="ml-1 text-sm text-text-muted">$</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Payments section — only when editing an existing booking */}
              {isEditing && selectedBooking && (
                <div className="space-y-3 rounded-lg border border-border bg-card-elevated p-4">
                  <h3 className="text-sm font-semibold text-text-primary">Payments</h3>

                  {/* Summary chips */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-md bg-card px-3 py-2">
                      <p className="text-xs text-text-muted">Total</p>
                      <p className="text-sm font-semibold text-text-primary">{formatCurrency(selectedBooking.total)}</p>
                    </div>
                    <div className="rounded-md bg-card px-3 py-2">
                      <p className="text-xs text-text-muted">Paid</p>
                      <p className="text-sm font-semibold text-success">{formatCurrency(selectedBooking.amountPaid ?? 0)}</p>
                    </div>
                    <div className="rounded-md bg-card px-3 py-2">
                      <p className="text-xs text-text-muted">Balance Due</p>
                      <p className="text-sm font-semibold text-accent">
                        {formatCurrency(selectedBooking.balanceDueAmount ?? Math.max(0, selectedBooking.total - (selectedBooking.amountPaid ?? 0)))}
                      </p>
                    </div>
                  </div>

                  {/* Payment history */}
                  {selectedBookingPayments.length > 0 && (
                    <div className="divide-y divide-border rounded-md border border-border">
                      {selectedBookingPayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">{formatCurrency(p.amount)}</span>
                            <span className="text-xs capitalize text-text-muted">
                              {p.type} · {p.method === 'bank-transfer' ? 'Bank Transfer' : p.method}
                            </span>
                            {p.notes && <span className="text-xs text-text-muted">· {p.notes}</span>}
                          </div>
                          <span className="text-xs text-text-muted">{p.paymentDate}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Record Payment button */}
                  {(selectedBooking.paymentStatus ?? 'unpaid') !== 'paid-in-full' &&
                    (selectedBooking.paymentStatus ?? 'unpaid') !== 'refunded' &&
                    getBookingServiceStatus(selectedBooking) !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => openPaymentModal(selectedBooking)}
                        className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10"
                      >
                        <BanknotesIcon className="h-4 w-4" />
                        Record Payment
                      </button>
                    )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between">
                <div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                      Delete Booking
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="rounded-md border border-border bg-card-elevated px-4 py-2 text-text-secondary hover:bg-card"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-accent px-4 py-2 text-white hover:bg-accent-hover"
                  >
                    {isEditing ? 'Update Booking' : 'Create Booking'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Summary modal (confirmed bookings only) */}
      {eventSummaryBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEventSummaryBooking(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-summary-title"
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <h2 id="event-summary-title" className="text-xl font-bold text-text-primary">
                Event Summary
              </h2>
              <button
                type="button"
                onClick={() => setEventSummaryBooking(null)}
                className="rounded p-1.5 text-text-muted hover:bg-card-elevated hover:text-text-primary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-6 p-6">
              {/* Event information */}
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Event information
                </h3>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-text-muted">Customer</dt>
                    <dd className="font-medium text-text-primary">{eventSummaryBooking.customerName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Date & time</dt>
                    <dd className="text-text-primary">
                      {format(new Date(eventSummaryBooking.eventDate + 'T12:00:00'), 'EEEE, MMM d, yyyy')} at {eventSummaryBooking.eventTime}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Event type</dt>
                    <dd className="capitalize text-text-primary">
                      {templateConfig.eventTypes.find(e => e.id === eventSummaryBooking.eventType)?.label ?? eventSummaryBooking.eventType}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">{getTemplateLabel(templateConfig.labels, 'guests', 'Guests')}</dt>
                    <dd className="text-text-primary">
                      {eventSummaryBooking.adults} adult{eventSummaryBooking.adults !== 1 ? 's' : ''}
                      {eventSummaryBooking.children > 0 &&
                        `, ${eventSummaryBooking.children} child${eventSummaryBooking.children !== 1 ? 'ren' : ''}`}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-text-muted">Location</dt>
                    <dd className="text-text-primary">{eventSummaryBooking.location || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Distance</dt>
                    <dd className="text-text-primary">{eventSummaryBooking.distanceMiles} mi</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Total</dt>
                    <dd className="font-semibold text-text-primary">
                      {formatCurrency(eventSummaryBooking.total)}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Notes */}
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Notes
                </h3>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-card-elevated px-4 py-3 text-sm text-text-primary">
                  {eventSummaryBooking.notes?.trim() || 'No notes.'}
                </p>
              </section>

              {/* Menu summary */}
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Menu summary
                </h3>
                {eventSummaryMenu && eventSummaryMenu.guestSelections?.length > 0 ? (
                  <div className="rounded-md border border-border bg-card-elevated p-4">
                    <p className="mb-3 text-sm text-text-primary">
                      {eventSummaryMenu.guestSelections.length} guest
                      {eventSummaryMenu.guestSelections.length !== 1 ? 's' : ''} with menu selections
                    </p>
                    <MenuSummaryContent selections={eventSummaryMenu.guestSelections} />
                  </div>
                ) : (
                  <p className="rounded-md border border-border bg-card-elevated px-4 py-3 text-sm text-text-muted">
                    No menu configured for this event.
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Recording Modal ─────────────────────────────────────────── */}
      {paymentModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card-elevated shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Record Payment</h2>
                <p className="text-sm text-text-muted">{paymentModalBooking.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalBooking(null)}
                className="rounded-md p-1.5 text-text-muted hover:bg-card hover:text-text-primary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Booking context */}
            <div className="grid grid-cols-3 gap-3 border-b border-border px-6 py-4">
              <div>
                <p className="text-xs text-text-muted">Total</p>
                <p className="font-semibold text-text-primary">{formatCurrency(paymentModalBooking.total)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Paid</p>
                <p className="font-semibold text-success">{formatCurrency(paymentModalBooking.amountPaid ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Balance Due</p>
                <p className="font-semibold text-accent">{formatCurrency(paymentModalBooking.balanceDueAmount ?? 0)}</p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4 px-6 py-5">
              {/* Pending booking warning */}
              {paymentModalBooking.status === 'pending' && paymentForm.paymentType !== 'refund' && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  This booking is still pending. Confirm it first so payment status tracks correctly.
                </p>
              )}
              {/* Refund warning */}
              {paymentForm.paymentType === 'refund' && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
                  Recording a refund will set this booking&apos;s status to Cancelled and payment status to Refunded.
                </p>
              )}

              {/* Payment type pills */}
              <div>
                <label className="block text-sm font-medium text-text-secondary">Payment type</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {([
                    { key: 'deposit', label: 'Deposit', amount: Math.max(0, (paymentModalBooking.depositAmount ?? 0) - (paymentModalBooking.amountPaid ?? 0)) },
                    { key: 'balance', label: 'Balance', amount: Math.max(0, paymentModalBooking.balanceDueAmount ?? 0) },
                    { key: 'full', label: 'Full Payment', amount: Math.max(0, paymentModalBooking.total - (paymentModalBooking.amountPaid ?? 0)) },
                    { key: 'refund', label: 'Refund', amount: paymentModalBooking.amountPaid ?? 0 },
                  ] as const).map(({ key, label, amount }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPaymentForm((p) => ({ ...p, paymentType: key, amount: amount > 0 ? amount.toFixed(2) : '' }))}
                      className={`flex-1 min-w-[4.5rem] rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        paymentForm.paymentType === key
                          ? key === 'refund'
                            ? 'border-danger bg-danger text-white'
                            : 'border-accent bg-accent text-white'
                          : 'border-border bg-card text-text-secondary hover:bg-card-elevated'
                      }`}
                    >
                      <span className="block">{label}</span>
                      <span className={`block text-[10px] ${paymentForm.paymentType === key ? 'text-white/80' : 'text-text-muted'}`}>
                        {formatCurrency(amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {paymentForm.paymentType === 'refund' ? 'Refund amount ($)' : 'Amount ($)'}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>

              {/* Method */}
              <div>
                <label className="block text-sm font-medium text-text-secondary">Payment method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, method: e.target.value as CustomerPaymentMethod }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {(['cash', 'zelle', 'venmo', 'card', 'bank-transfer', 'other'] as CustomerPaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {m === 'bank-transfer' ? 'Bank Transfer' : m.charAt(0).toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-text-secondary">Payment date</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, date: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Note / reference <span className="text-text-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Zelle confirmation #123"
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {paymentFormError && (
                <p className="text-sm text-danger">{paymentFormError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => setPaymentModalBooking(null)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitPayment}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email verification popup — verify recipient name and address before sending */}
      {emailVerifyPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl" role="dialog" aria-modal="true" aria-labelledby="email-verify-title">
            <div className="border-b border-border px-5 py-4">
              <h2 id="email-verify-title" className="text-lg font-semibold text-text-primary">
                {emailVerifyPending.type === 'confirmation' ? 'Send confirmation email' : 'Send receipt email'}
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Verify the recipient before sending.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Name</p>
                <p className="mt-0.5 font-medium text-text-primary">{emailVerifyPending.booking.customerName}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Email</p>
                <p className="mt-0.5 font-medium text-text-primary break-all">{emailVerifyPending.booking.customerEmail}</p>
              </div>
              {emailVerifyPending.type === 'receipt' && emailVerifyPending.extra && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Receipt for</p>
                  <p className="mt-0.5 text-sm text-text-primary">
                    {formatCurrency(emailVerifyPending.extra.amount)} · {emailVerifyPending.extra.method}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setEmailVerifyPending(null)}
                className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendEmail}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Send email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email toast notification */}
      {emailToast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-opacity ${
            emailToast === 'sent' ? 'bg-success' : 'bg-danger'
          }`}
        >
          {emailToast === 'sent' ? 'Email sent ✓' : 'Email failed to send'}
        </div>
      )}
    </div>
  );
}

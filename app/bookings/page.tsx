'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking, BookingStatus, BookingFormData, PaymentStatus } from '@/lib/bookingTypes';
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
  getBookingServiceStatus,
  normalizeBookingWorkflowFields,
  toLocalDateISO,
} from '@/lib/bookingWorkflow';
import {
  ensureShoppingListForBooking,
  loadShoppingLists,
  removeShoppingListForBooking,
} from '@/lib/shoppingStorage';
import { isStaffAvailableForEvent } from '@/lib/staffAvailability';

const CHEF_ROLE_LABELS: Record<string, string> = {
  lead: 'Lead Chef',
  overflow: 'Overflow Chef',
  full: 'Full Chef',
  buffet: 'Buffet Chef',
  assistant: 'Assistant',
};

interface StaffConflict {
  staffId: string;
  staffName: string;
  conflictingBooking: Booking;
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
  const openedBookingFromQueryRef = useRef<string | null>(null);
  const rules = useMoneyRules();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | BookingStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [sortField, setSortField] = useState<'eventDate' | 'customerName' | 'eventType' | 'guests' | 'total' | 'status'>('eventDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPaymentRecord[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ReturnType<typeof loadShoppingLists>>([]);
  const [actionsOpenForBookingId, setActionsOpenForBookingId] = useState<string | null>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

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
    staffingProfileId: undefined,
  });

  // Load bookings
  useEffect(() => {
    const loadBookings = () => {
      const saved = localStorage.getItem('bookings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Booking[];
          const normalized = parsed.map((booking) => normalizeBookingWorkflowFields(booking));
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

  const staffById = useMemo(() => {
    const map = new Map<string, StaffRecord>();
    staffRecords.forEach((staff) => map.set(staff.id, staff));
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

  const filteredBookings = useMemo(() => {
    let result = bookings;

    if (filterStatus !== 'all') {
      result = result.filter((b) => getBookingServiceStatus(b) === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.customerName.toLowerCase().includes(query) ||
          b.customerEmail.toLowerCase().includes(query) ||
          b.location.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'eventDate':
          comparison = new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
          break;
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
  }, [bookings, filterStatus, searchQuery, sortField, sortDirection]);

  const stats = useMemo(() => {
    const pending = bookings.filter((b) => getBookingServiceStatus(b) === 'pending').length;
    const confirmed = bookings.filter((b) => getBookingServiceStatus(b) === 'confirmed').length;
    const completed = bookings.filter((b) => getBookingServiceStatus(b) === 'completed').length;
    const cancelled = bookings.filter((b) => getBookingServiceStatus(b) === 'cancelled').length;

    return { pending, confirmed, completed, cancelled };
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
      staffAssignments: booking.staffAssignments,
      staffingProfileId: booking.staffingProfileId,
    });
    setShowModal(true);
  }, [bookings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors: string[] = [];
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

    const shouldPreserveMenuPricing =
      formData.eventType === 'private-dinner' &&
      selectedBooking?.eventType === 'private-dinner';
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
      },
      rules
    );

    const existingServiceStatus = selectedBooking ? getBookingServiceStatus(selectedBooking) : 'pending';
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
      subtotal: financials.subtotal,
      gratuity: financials.gratuity,
      distanceFee: financials.distanceFee,
      total: financials.totalCharged,
      status: existingServiceStatus,
      serviceStatus: existingServiceStatus,
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
      reconciliationId: selectedBooking?.reconciliationId,
      createdAt: selectedBooking?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const booking = normalizeBookingWorkflowFields(
      existingServiceStatus === 'confirmed' || existingServiceStatus === 'completed'
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
      staffAssignments: undefined,
      staffingProfileId: undefined,
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
        ? applyConfirmationPaymentTerms(bookingWithNewServiceStatus, now)
        : normalizeBookingWorkflowFields(
            newStatus === 'completed' && !bookingWithNewServiceStatus.confirmedAt
              ? { ...bookingWithNewServiceStatus, confirmedAt: now }
              : bookingWithNewServiceStatus
          );

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

  const paymentStatusLabels: Record<PaymentStatus, string> = {
    unpaid: 'Unpaid',
    'deposit-due': 'Deposit Due',
    'deposit-paid': 'Deposit Paid',
    'balance-due': 'Balance Due',
    'paid-in-full': 'Paid in Full',
    refunded: 'Refunded',
  };

  const paymentStatusColors: Record<PaymentStatus, string> = {
    unpaid: 'bg-card-elevated text-text-secondary',
    'deposit-due': 'bg-warning/20 text-warning',
    'deposit-paid': 'bg-info/20 text-info',
    'balance-due': 'bg-accent-soft-bg text-accent',
    'paid-in-full': 'bg-success/20 text-success',
    refunded: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  };

  const handleRecordPayment = (booking: Booking) => {
    const normalizedBooking = normalizeBookingWorkflowFields(booking);
    const maxSuggestedAmount = normalizedBooking.balanceDueAmount ?? 0;
    const amountPrompt = prompt(
      `Record customer payment for ${normalizedBooking.customerName}\nCurrent due: ${formatCurrency(maxSuggestedAmount)}`,
      maxSuggestedAmount > 0 ? maxSuggestedAmount.toFixed(2) : '0.00'
    );
    if (amountPrompt === null) return;

    const amount = parseFloat(amountPrompt);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid payment amount greater than $0.');
      return;
    }

    const methodRaw =
      prompt('Payment method (cash, zelle, venmo, card, bank-transfer, other):', 'zelle') ||
      'other';
    const validMethods: CustomerPaymentMethod[] = [
      'cash',
      'zelle',
      'venmo',
      'card',
      'bank-transfer',
      'other',
    ];
    const method: CustomerPaymentMethod = validMethods.includes(methodRaw as CustomerPaymentMethod)
      ? (methodRaw as CustomerPaymentMethod)
      : 'other';
    const notes = prompt('Optional payment note/reference:', '') || undefined;
    const paymentDate = toLocalDateISO(new Date());

    const paymentType: CustomerPaymentRecord['type'] =
      (normalizedBooking.amountPaid ?? 0) + 0.009 < (normalizedBooking.depositAmount ?? 0)
        ? 'deposit'
        : 'payment';

    const paymentRecord: CustomerPaymentRecord = {
      id: `custpay-${normalizedBooking.id}-${Date.now()}`,
      bookingId: normalizedBooking.id,
      paymentDate,
      amount,
      type: paymentType,
      method,
      notes,
      recordedAt: new Date().toISOString(),
    };

    const existingPayments = loadCustomerPayments();
    saveCustomerPayments([...existingPayments, paymentRecord]);

    const updatedBooking = applyPaymentToBooking(normalizedBooking, amount, paymentDate);
    saveBookings(
      bookings.map((entry) =>
        entry.id === normalizedBooking.id
          ? { ...updatedBooking, updatedAt: new Date().toISOString() }
          : entry
      )
    );
    if (selectedBooking?.id === normalizedBooking.id) {
      setSelectedBooking(updatedBooking);
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
    const activeMenuSnapshot =
      formData.eventType === 'private-dinner' &&
      selectedBooking?.eventType === 'private-dinner'
        ? selectedBooking.menuPricingSnapshot
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
      },
      rules
    );
  }, [formData.eventType, formData.adults, formData.children, formData.distanceMiles, formData.premiumAddOn, formData.eventDate, formData.staffingProfileId, selectedBooking, rules]);

  const selectedStaffIdsInForm = useMemo(
    () => new Set(getUniqueAssignedStaffIds(formData.staffAssignments)),
    [formData.staffAssignments]
  );

  // Get available staff for a given ChefRole: must match role, be available for event date/time, and not double-booked
  const getAvailableStaff = (chefRole: string): StaffRecord[] => {
    const requiredStaffRole = CHEF_ROLE_TO_STAFF_ROLE[chefRole as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
    if (!requiredStaffRole) return [];
    const eventDate = formData.eventDate;
    const eventTime = formData.eventTime ?? '18:00';
    const excludeBookingId = selectedBooking?.id;

    return staffRecords.filter((s) => {
      if (s.status !== 'active') return false;
      if (s.primaryRole !== requiredStaffRole && !s.secondaryRoles.includes(requiredStaffRole)) return false;
      if (eventDate && !isStaffAvailableForEvent(s, eventDate, eventTime)) return false;
      const conflicts = findStaffConflicts(eventDate, eventTime, [s.id], excludeBookingId);
      if (conflicts.length > 0) return false;
      return true;
    });
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

  const statusColors: Record<BookingStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-info/20 text-info',
    completed: 'bg-success/20 text-success',
    cancelled: 'bg-card-elevated text-text-muted',
  };

  const selectedBookingPayments = useMemo(() => {
    if (!selectedBooking) return [];
    return customerPayments
      .filter((payment) => payment.bookingId === selectedBooking.id)
      .sort((a, b) => `${b.paymentDate}-${b.recordedAt}`.localeCompare(`${a.paymentDate}-${a.recordedAt}`));
  }, [customerPayments, selectedBooking]);

  return (
    <div className="h-full p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            Bookings Management
          </h1>
          <p className="mt-2 text-text-secondary">
            Manage event bookings and customer information
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
            + New Booking
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
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              viewMode === 'table'
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-secondary hover:bg-card'
            }`}
          >
            📋 Table
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              viewMode === 'calendar'
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-secondary hover:bg-card'
            }`}
          >
            📅 Calendar
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'all'
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-secondary hover:bg-card'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'pending'
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-secondary hover:bg-card'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'confirmed'
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-secondary hover:bg-card'
            }`}
          >
            Confirmed
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'completed'
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-secondary hover:bg-card'
            }`}
          >
            Completed
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by customer or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-md border border-border px-4 py-2 text-sm text-text-primary bg-card-elevated text-text-primary"
        />
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' ? (
        <div className="rounded-lg border border-border bg-card p-6 ">
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

          {/* Calendar Grid */}
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
                              staffAssignments: booking.staffAssignments,
                              staffingProfileId: booking.staffingProfileId,
                            });
                            setShowModal(true);
                          }}
                          className={`w-full rounded px-1 py-0.5 text-left text-xs ${
                            statusColors[getBookingServiceStatus(booking)]
                          } truncate hover:opacity-80`}
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

          {/* Calendar Legend: order and colors match summary tiles */}
          <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border border-border bg-card"></div>
              <span className="text-sm text-text-secondary">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border border-border bg-card"></div>
              <span className="text-sm text-text-secondary">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-success/20"></div>
              <span className="text-sm text-text-secondary">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-danger/20"></div>
              <span className="text-sm text-text-secondary">Cancelled</span>
            </div>
          </div>
        </div>
      ) : (
        /* Bookings Table */
        <div className="rounded-lg border border-border bg-card ">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-card-elevated">
              <tr>
                {([
                  ['eventDate', 'Event Date'],
                  ['customerName', 'Customer'],
                  ['eventType', 'Type'],
                  ['guests', 'Guests'],
                  ['total', 'Total'],
                  ['status', 'Status'],
                ] as const).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="cursor-pointer select-none px-4 py-3 text-left text-sm font-semibold text-text-primary hover:bg-card-elevated"
                  >
                    {label} {sortField === field && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-sm font-semibold text-text-primary">
                  Payment
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-text-primary">
                  Reconcile
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
                    {searchQuery || filterStatus !== 'all'
                      ? 'No bookings match your filters'
                      : 'No bookings yet. Click "+ New Booking" to get started!'}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking, rowIndex) => {
                  const isLastRow = rowIndex === filteredBookings.length - 1;
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
                    </td>
                    <td className="px-4 py-4 text-sm text-text-secondary">
                      {booking.eventType === 'private-dinner' ? 'Private' : 'Buffet'}
                    </td>
                    <td className="px-4 py-4 text-sm text-text-secondary">
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
                    <td className="px-4 py-4 text-sm">
                      <select
                        value={getBookingServiceStatus(booking)}
                        onChange={(e) =>
                          updateBookingStatus(booking, e.target.value as BookingStatus)
                        }
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          statusColors[getBookingServiceStatus(booking)]
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex flex-col gap-2">
                        <span
                          className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${
                            paymentStatusColors[booking.paymentStatus ?? 'unpaid']
                          }`}
                        >
                          {paymentStatusLabels[booking.paymentStatus ?? 'unpaid']}
                        </span>
                        <div className="text-xs text-text-muted">
                          Paid {formatCurrency(booking.amountPaid ?? 0)} / Due{' '}
                          {formatCurrency(
                            booking.balanceDueAmount ?? Math.max(0, booking.total - (booking.amountPaid ?? 0))
                          )}
                        </div>
                        {getBookingServiceStatus(booking) !== 'cancelled' &&
                          (booking.paymentStatus ?? 'unpaid') !== 'paid-in-full' && (
                            <button
                              type="button"
                              onClick={() => handleRecordPayment(booking)}
                              className="w-fit text-xs font-medium text-accent hover:text-accent-hover  "
                            >
                              + Record Payment
                            </button>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-sm">
                      {(getBookingServiceStatus(booking) === 'completed' || booking.reconciliationId) ? (
                        <Link
                          href={`/bookings/reconcile?bookingId=${booking.id}`}
                          className={`inline-flex items-center gap-1 font-medium ${
                            booking.reconciliationId
                              ? 'text-success'
                              : 'text-warning'
                          }`}
                        >
                          {booking.reconciliationId ? '✓ Reconciled' : '⚖ Reconcile'}
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
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
                                isLastRow ? 'bottom-full mb-1' : 'mt-1'
                              }`}
                              role="menu"
                            >
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
                {isEditing ? 'Edit Booking' : 'New Booking'}
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
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
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
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
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
                        setFormData({ ...formData, customerPhone: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
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
                  Set date, guest count, and location details accurately since pricing, staffing, and prep planning depend on this section.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Event Type *
                    </label>
                    <select
                      value={formData.eventType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eventType: e.target.value as 'private-dinner' | 'buffet',
                        })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
                    >
                      <option value="private-dinner">Private Dinner</option>
                      <option value="buffet">Buffet</option>
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
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
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
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
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
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
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
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
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
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Premium Add-on ($/guest)
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
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
                    />
                  </div>
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
                    className="w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
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
                      const available = getAvailableStaff(position.role);
                      const assignment = findAssignmentForPosition(idx);
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
                            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-card-elevated text-text-primary"
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

              {/* Billing Snapshot */}
              {isEditing && selectedBooking && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-200">
                    Billing Workflow
                  </h3>
                  <p className="mt-1 text-sm text-indigo-700 dark:text-indigo-300">
                    Service status tracks event operations, while payment status tracks deposit collection and remaining balance.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        statusColors[getBookingServiceStatus(selectedBooking)]
                      }`}
                    >
                      Service: {getBookingServiceStatus(selectedBooking)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        paymentStatusColors[selectedBooking.paymentStatus ?? 'unpaid']
                      }`}
                    >
                      Payment: {paymentStatusLabels[selectedBooking.paymentStatus ?? 'unpaid']}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-indigo-800 dark:text-indigo-300">
                    Deposit {formatCurrency(selectedBooking.depositAmount ?? 0)} • Paid{' '}
                    {formatCurrency(selectedBooking.amountPaid ?? 0)} • Due{' '}
                    {formatCurrency(
                      selectedBooking.balanceDueAmount ??
                        Math.max(0, selectedBooking.total - (selectedBooking.amountPaid ?? 0))
                    )}
                  </div>
                  {(selectedBooking.paymentStatus ?? 'unpaid') !== 'paid-in-full' &&
                    getBookingServiceStatus(selectedBooking) !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleRecordPayment(selectedBooking)}
                        className="mt-3 rounded-md border border-border bg-card-elevated px-3 py-1.5 text-sm font-medium text-accent hover:bg-card"
                      >
                        Record Payment
                      </button>
                    )}
                  <div className="mt-4 rounded-md border border-border bg-card-elevated p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-300">
                      Payment Log
                    </h4>
                    {selectedBookingPayments.length === 0 ? (
                      <p className="mt-2 text-xs text-text-muted">
                        No customer payments recorded for this booking yet.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {selectedBookingPayments.slice(0, 6).map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between text-xs text-text-secondary"
                          >
                            <span>
                              {payment.paymentDate} • {payment.type}
                              {payment.method ? ` • ${payment.method}` : ''}
                            </span>
                            <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-text-primary bg-card-elevated text-text-primary"
                  placeholder="Special requests, dietary restrictions, etc."
                />
              </div>

              {/* Menu Link */}
              {isEditing && selectedBooking && formData.eventType === 'private-dinner' && (
                <div className="rounded-lg border border-amber-200 bg-warning/20 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                        Guest Menu
                      </h3>
                      <p className="text-sm text-warning dark:text-amber-400">
                        {selectedBooking.menuId
                          ? 'Menu selections have been configured for this event.'
                          : 'No menu configured yet. Set up guest-by-guest protein and side selections.'}
                      </p>
                    </div>
                    <Link
                      href={`/bookings/menu?bookingId=${selectedBooking.id}`}
                      className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                        selectedBooking.menuId
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {selectedBooking.menuId ? 'Edit Menu' : 'Create Menu'}
                    </Link>
                  </div>
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
    </div>
  );
}

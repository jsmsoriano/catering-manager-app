'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { generateSampleBookings } from '@/lib/sampleBookings';
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
  removeShoppingListForBooking,
} from '@/lib/shoppingStorage';

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

  const handleLoadSampleBookings = () => {
    const shouldProceed = confirm(
      'Load sample schedule?\n\nThis will replace current bookings with a structured sample set:\n- 5 bookings per week\n- 1 weekend lunch\n- 1 weekend dinner\n- 3 weekday dinners'
    );
    if (!shouldProceed) return;

    const sampleBookings = generateSampleBookings(rules);
    saveBookings(sampleBookings);
    setFilterStatus('all');
    setSearchQuery('');
    setShowModal(false);
    resetForm();

    alert(`Loaded ${sampleBookings.length} sample bookings for testing.`);
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
    const totalRevenue = bookings
      .filter((b) => getBookingServiceStatus(b) !== 'cancelled')
      .reduce((sum, b) => sum + b.total, 0);

    return { pending, confirmed, completed, totalRevenue };
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
    unpaid: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
    'deposit-due': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    'deposit-paid': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'balance-due': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'paid-in-full': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
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

  // Get available staff for a given ChefRole
  const getAvailableStaff = (chefRole: string): StaffRecord[] => {
    const requiredStaffRole = CHEF_ROLE_TO_STAFF_ROLE[chefRole as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
    if (!requiredStaffRole) return [];
    return staffRecords.filter(
      (s) => s.status === 'active' && (s.primaryRole === requiredStaffRole || s.secondaryRoles.includes(requiredStaffRole))
    );
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
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400',
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
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Bookings Management
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Manage event bookings and customer information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadSampleBookings}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
          >
            Load Sample Schedule
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
          >
            + New Booking
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900 dark:bg-yellow-950/20">
          <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
            Pending
          </h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {stats.pending}
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
            Confirmed
          </h3>
          <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
            {stats.confirmed}
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
          <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Completed
          </h3>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </p>
        </div>

        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/20">
          <h3 className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            Total Revenue
          </h3>
          <p className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(stats.totalRevenue)}
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
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            📋 Table
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              viewMode === 'calendar'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
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
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'pending'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'confirmed'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            Confirmed
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'completed'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
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
          className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {/* Calendar Header */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
              className="rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Previous
            </button>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {format(calendarMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              className="rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
                className="py-2 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300"
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

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[100px] rounded-lg border p-2 ${
                      isCurrentMonth
                        ? 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800'
                        : 'border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50'
                    }`}
                  >
                    <div
                      className={`mb-1 text-sm ${
                        isCurrentMonth
                          ? 'font-medium text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-400 dark:text-zinc-600'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayBookings.map((booking) => (
                        <button
                          key={booking.id}
                          onClick={() => {
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

          {/* Calendar Legend */}
          <div className="mt-6 flex flex-wrap gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-yellow-100 dark:bg-yellow-900/30"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-blue-100 dark:bg-blue-900/30"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-emerald-100 dark:bg-emerald-900/30"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-zinc-100 dark:bg-zinc-800"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Cancelled</span>
            </div>
          </div>
        </div>
      ) : (
        /* Bookings Table */
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
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
                    className="cursor-pointer select-none px-4 py-3 text-left text-sm font-semibold text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-700"
                  >
                    {label} {sortField === field && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Payment
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Reconcile
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    {searchQuery || filterStatus !== 'all'
                      ? 'No bookings match your filters'
                      : 'No bookings yet. Click "+ New Booking" to get started!'}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-4 text-sm text-zinc-900 dark:text-zinc-100">
                      {format(new Date(booking.eventDate), 'MMM dd, yyyy')}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {booking.eventTime}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {booking.customerName}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {booking.customerEmail}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                      {booking.eventType === 'private-dinner' ? 'Private' : 'Buffet'}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                      {booking.adults + booking.children}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        ({booking.adults}A + {booking.children}C)
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(booking.total)}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
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
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
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
                              className="w-fit text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
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
                              ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-600 hover:text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {booking.reconciliationId ? '✓ Reconciled' : '⚖ Reconcile'}
                        </Link>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-sm">
                      <div className="flex justify-end gap-3">
                        {booking.eventType === 'private-dinner' && (
                          <Link
                            href={`/bookings/menu?bookingId=${booking.id}`}
                            className={`${
                              booking.menuId
                                ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'
                                : 'text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300'
                            }`}
                            title={booking.menuId ? 'Edit menu' : 'Create menu'}
                          >
                            {booking.menuId ? '📋 Menu' : '➕ Menu'}
                          </Link>
                        )}
                        <Link
                          href={`/bookings/shopping?bookingId=${booking.id}`}
                          className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                          title="Event shopping list"
                        >
                          🛒 Shop
                        </Link>
                        <button
                          onClick={() => {
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
                          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {isEditing ? 'Edit Booking' : 'New Booking'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-zinc-500 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                  Customer Information
                </h3>
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Enter the primary contact details used for confirmations, payment follow-up, and event updates.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) =>
                        setFormData({ ...formData, customerName: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, customerEmail: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.customerPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, customerPhone: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Event Details */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                  Event Details
                </h3>
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Set date, guest count, and location details accurately since pricing, staffing, and prep planning depend on this section.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      <option value="private-dinner">Private Dinner</option>
                      <option value="buffet">Buffet</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Event Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.eventDate}
                      onChange={(e) =>
                        setFormData({ ...formData, eventDate: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Event Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.eventTime}
                      onChange={(e) =>
                        setFormData({ ...formData, eventTime: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Children
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.children}
                      onChange={(e) =>
                        setFormData({ ...formData, children: parseInt(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Distance (miles)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.distanceMiles}
                      onChange={(e) =>
                        setFormData({ ...formData, distanceMiles: parseInt(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Staffing Profile Selector */}
              {(rules.staffing.profiles || []).length > 0 && (
                <div>
                  <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                    Staffing Profile
                  </h3>
                  <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
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
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Auto (best match)</option>
                    {(rules.staffing.profiles || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.minGuests}–{p.maxGuests === 9999 ? '\u221E' : p.maxGuests} guests)
                      </option>
                    ))}
                  </select>
                  {currentFinancials?.staffingPlan.matchedProfileName && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Using profile: <span className="font-medium">{currentFinancials.staffingPlan.matchedProfileName}</span>
                    </p>
                  )}
                  {!currentFinancials?.staffingPlan.matchedProfileId && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Using default staffing rules
                    </p>
                  )}
                </div>
              )}

              {/* Staff Assignments */}
              {currentFinancials && currentFinancials.staffingPlan.staff.length > 0 && (
                <div>
                  <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                    Staff Assignments
                  </h3>
                  <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
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
                          className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50"
                        >
                          <div className="min-w-[140px]">
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {CHEF_ROLE_LABELS[position.role] || position.role}
                            </div>
                            {laborComp && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                Est. {formatCurrency(laborComp.finalPay)}
                              </div>
                            )}
                          </div>
                          <select
                            value={assignment?.staffId || ''}
                            onChange={(e) => updateStaffAssignment(idx, e.target.value)}
                            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
                        className="mt-3 rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800"
                      >
                        Record Payment
                      </button>
                    )}
                  <div className="mt-4 rounded-md border border-indigo-200 bg-white p-3 dark:border-indigo-800 dark:bg-zinc-900">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-300">
                      Payment Log
                    </h4>
                    {selectedBookingPayments.length === 0 ? (
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        No customer payments recorded for this booking yet.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {selectedBookingPayments.slice(0, 6).map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300"
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
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Notes
                </label>
                <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Add internal context for your team, such as dietary restrictions, access instructions, or special setup details.
                </p>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Special requests, dietary restrictions, etc."
                />
              </div>

              {/* Menu Link */}
              {isEditing && selectedBooking && formData.eventType === 'private-dinner' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                        Guest Menu
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
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
                    className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
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

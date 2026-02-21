import type { Booking, BookingStatus, PaymentStatus, PipelineStatus } from './bookingTypes';

export const DEFAULT_DEPOSIT_PERCENT = 30;
export const DEFAULT_PURCHASE_LEAD_DAYS = 2;

const MONEY_EPSILON = 0.009;

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toLocalDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function toFiniteNonNegative(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

export function getBookingServiceStatus(booking: Booking): BookingStatus {
  return booking.serviceStatus ?? booking.status;
}

/** Derive default pipeline_status from source/status for backfill (localStorage data). */
export function getDefaultPipelineStatus(booking: Booking): PipelineStatus {
  if (booking.source === 'inquiry') return 'inquiry';
  switch (booking.status) {
    case 'completed':
      return 'completed';
    case 'confirmed':
      return 'booked';
    case 'pending':
      return 'quote_sent';
    case 'cancelled':
      return 'booked';
    default:
      return 'inquiry';
  }
}

/** Ensure booking has pipeline_status set; use for backfill when loading from localStorage. */
export function ensurePipelineStatus(booking: Booking): Booking {
  if (booking.pipeline_status != null) return booking;
  return { ...booking, pipeline_status: getDefaultPipelineStatus(booking) };
}

export function calculatePrepPurchaseByDate(
  eventDate: string,
  leadDays = DEFAULT_PURCHASE_LEAD_DAYS
): string {
  const eventLocalDate = parseLocalDate(eventDate);
  eventLocalDate.setDate(eventLocalDate.getDate() - leadDays);
  return toLocalDateISO(eventLocalDate);
}

function derivePaymentStatus(params: {
  serviceStatus: BookingStatus;
  eventDate: string;
  total: number;
  amountPaid: number;
  depositAmount: number;
  asOfDate: string;
}): PaymentStatus {
  const { serviceStatus, eventDate, total, amountPaid, depositAmount, asOfDate } = params;
  const normalizedTotal = Math.max(0, total);

  if (amountPaid + MONEY_EPSILON >= normalizedTotal) return 'paid-in-full';

  if (serviceStatus === 'cancelled') {
    return amountPaid > MONEY_EPSILON ? 'refunded' : 'unpaid';
  }

  if (amountPaid + MONEY_EPSILON >= depositAmount) {
    const today = parseLocalDate(asOfDate);
    const eventLocalDate = parseLocalDate(eventDate);
    return today >= eventLocalDate ? 'balance-due' : 'deposit-paid';
  }

  if (serviceStatus === 'pending') return 'deposit-due';

  return 'deposit-due';
}

export function normalizeBookingWorkflowFields(
  booking: Booking,
  asOfDate = toLocalDateISO(new Date())
): Booking {
  const serviceStatus = getBookingServiceStatus(booking);
  const total = toFiniteNonNegative(booking.total);
  const depositPercent = toFiniteNonNegative(booking.depositPercent, DEFAULT_DEPOSIT_PERCENT);
  const computedDeposit = roundMoney(total * (depositPercent / 100));
  const depositAmount = roundMoney(toFiniteNonNegative(booking.depositAmount, computedDeposit));
  const amountPaid = roundMoney(toFiniteNonNegative(booking.amountPaid, 0));
  const balanceDueAmount = roundMoney(Math.max(0, total - amountPaid));
  const prepPurchaseByDate =
    booking.prepPurchaseByDate || calculatePrepPurchaseByDate(booking.eventDate);

  const confirmedLocalDate = booking.confirmedAt
    ? toLocalDateISO(new Date(booking.confirmedAt))
    : undefined;
  const depositDueDate =
    booking.depositDueDate ||
    (serviceStatus === 'confirmed' || serviceStatus === 'completed'
      ? confirmedLocalDate || asOfDate
      : undefined);
  const balanceDueDate = booking.balanceDueDate || booking.eventDate;

  const paymentStatus =
    booking.paymentStatus ||
    derivePaymentStatus({
      serviceStatus,
      eventDate: booking.eventDate,
      total,
      amountPaid,
      depositAmount,
      asOfDate,
    });

  return {
    ...booking,
    status: serviceStatus,
    serviceStatus,
    paymentStatus,
    depositPercent,
    depositAmount,
    depositDueDate,
    balanceDueDate,
    amountPaid,
    balanceDueAmount,
    prepPurchaseByDate,
  };
}

export function applyConfirmationPaymentTerms(
  booking: Booking,
  confirmedAtIso: string,
  rulesDepositPercent = DEFAULT_DEPOSIT_PERCENT
): Booking {
  const depositPercent = toFiniteNonNegative(booking.depositPercent, rulesDepositPercent);
  const depositAmount = roundMoney(booking.total * (depositPercent / 100));
  const amountPaid = roundMoney(toFiniteNonNegative(booking.amountPaid, 0));
  const confirmedLocalDate = toLocalDateISO(new Date(confirmedAtIso));

  return normalizeBookingWorkflowFields({
    ...booking,
    status: 'confirmed',
    serviceStatus: 'confirmed',
    confirmedAt: confirmedAtIso,
    depositPercent,
    depositAmount,
    depositDueDate: booking.depositDueDate || confirmedLocalDate,
    balanceDueDate: booking.balanceDueDate || booking.eventDate,
    amountPaid,
    balanceDueAmount: roundMoney(Math.max(0, booking.total - amountPaid)),
    paymentStatus: undefined, // Re-derive
  });
}

export function applyPaymentToBooking(
  booking: Booking,
  paymentAmount: number,
  paymentDate: string
): Booking {
  const normalizedBooking = normalizeBookingWorkflowFields(booking, paymentDate);
  const nextAmountPaid = roundMoney(
    Math.max(0, (normalizedBooking.amountPaid ?? 0) + Math.max(0, paymentAmount))
  );

  return normalizeBookingWorkflowFields(
    {
      ...normalizedBooking,
      amountPaid: nextAmountPaid,
      balanceDueAmount: roundMoney(Math.max(0, normalizedBooking.total - nextAmountPaid)),
      paymentStatus: undefined, // Re-derive
    },
    paymentDate
  );
}

/** Apply a refund: reduce amountPaid and set booking status to cancelled (payment status becomes refunded). */
export function applyRefundToBooking(
  booking: Booking,
  refundAmount: number,
  refundDate: string
): Booking {
  const normalizedBooking = normalizeBookingWorkflowFields(booking, refundDate);
  const nextAmountPaid = roundMoney(
    Math.max(0, (normalizedBooking.amountPaid ?? 0) - Math.max(0, refundAmount))
  );

  return normalizeBookingWorkflowFields(
    {
      ...normalizedBooking,
      status: 'cancelled',
      serviceStatus: 'cancelled',
      amountPaid: nextAmountPaid,
      balanceDueAmount: roundMoney(Math.max(0, normalizedBooking.total - nextAmountPaid)),
      paymentStatus: undefined, // Re-derive (refunded when cancelled and amountPaid > 0)
    },
    refundDate
  );
}

import type { Booking } from './bookingTypes';

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function getBookingSalesTaxPercent(booking: Booking, fallbackPercent = 0): number {
  const snapshotPercent = booking.pricingSnapshot?.salesTaxPercent;
  if (typeof snapshotPercent === 'number' && Number.isFinite(snapshotPercent)) {
    return clampNonNegative(snapshotPercent);
  }
  return clampNonNegative(fallbackPercent);
}

export function getBookingTaxableBase(booking: Booking): number {
  const subtotal = clampNonNegative(booking.subtotal ?? 0);
  const distanceFee = clampNonNegative(booking.distanceFee ?? 0);
  // Sales tax liability uses taxable service revenue and fees, not gratuity.
  return roundMoney(subtotal + distanceFee);
}

export function calculateBookingSalesTax(booking: Booking, fallbackPercent = 0): number {
  const salesTaxPercent = getBookingSalesTaxPercent(booking, fallbackPercent);
  const taxableBase = getBookingTaxableBase(booking);
  return roundMoney(taxableBase * (salesTaxPercent / 100));
}

export function calculateBookingTotalWithTax(booking: Booking, fallbackPercent = 0): number {
  return roundMoney(clampNonNegative(booking.total ?? 0) + calculateBookingSalesTax(booking, fallbackPercent));
}

export function calculateBookingBalanceDueWithTax(booking: Booking, fallbackPercent = 0): number {
  return roundMoney(
    Math.max(0, calculateBookingTotalWithTax(booking, fallbackPercent) - clampNonNegative(booking.amountPaid ?? 0))
  );
}

export function calculatePaymentSalesTaxPortion(
  booking: Booking,
  paymentAmount: number,
  fallbackPercent = 0
): number {
  const totalWithTax = calculateBookingTotalWithTax(booking, fallbackPercent);
  const totalTax = calculateBookingSalesTax(booking, fallbackPercent);
  const appliedPayment = clampNonNegative(paymentAmount);
  if (totalWithTax <= 0 || totalTax <= 0 || appliedPayment <= 0) return 0;
  return roundMoney(Math.min(appliedPayment, totalWithTax) * (totalTax / totalWithTax));
}

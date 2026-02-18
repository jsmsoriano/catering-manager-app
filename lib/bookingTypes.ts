// ============================================================================
// BOOKING TYPES
// ============================================================================

import type { EventType } from './types';
import type { StaffAssignment } from './staffTypes';
import type { MenuPricingSnapshot } from './menuTypes';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type ServiceStatus = BookingStatus;
export type PaymentStatus =
  | 'unpaid'
  | 'deposit-due'
  | 'deposit-paid'
  | 'balance-due'
  | 'paid-in-full'
  | 'refunded';

export interface Booking {
  id: string;
  eventType: EventType;
  eventDate: string; // ISO date string
  eventTime: string; // e.g., "18:00"

  // Customer Info
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  // Event Details
  adults: number;
  children: number;
  location: string;
  distanceMiles: number;
  premiumAddOn: number;

  // Pricing (calculated and stored)
  subtotal: number;
  gratuity: number;
  distanceFee: number;
  total: number;

  // Status & Notes
  status: BookingStatus;
  serviceStatus?: ServiceStatus; // Operational workflow status (separate from payment lifecycle)
  paymentStatus?: PaymentStatus; // Billing workflow status
  depositPercent?: number; // Required deposit percentage (e.g., 30)
  depositAmount?: number; // Required deposit amount in USD
  depositDueDate?: string; // ISO date for deposit due
  balanceDueDate?: string; // ISO date for final balance due (usually event date)
  amountPaid?: number; // Total customer payments received
  balanceDueAmount?: number; // Remaining receivable amount
  confirmedAt?: string; // ISO datetime when service was confirmed
  prepPurchaseByDate?: string; // ISO date target for ingredient purchasing (event - 2 days)
  notes: string;

  // Staff Assignments
  staffAssignments?: StaffAssignment[];

  // Staffing Profile Override
  staffingProfileId?: string;

  // Menu
  menuId?: string; // Reference to EventMenu
  menuPricingSnapshot?: MenuPricingSnapshot; // Menu-derived pricing override snapshot

  // Discount (applied to revenue/subtotal only, not gratuity)
  discountType?: 'percent' | 'amount';
  discountValue?: number;

  // Reconciliation
  reconciliationId?: string; // Reference to EventReconciliation

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface BookingFormData {
  eventType: EventType;
  eventDate: string;
  eventTime: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  adults: number;
  children: number;
  location: string;
  distanceMiles: number;
  premiumAddOn: number;
  notes: string;
  serviceStatus?: BookingStatus;
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  staffAssignments?: StaffAssignment[];
  staffingProfileId?: string;
}

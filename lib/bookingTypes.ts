// ============================================================================
// BOOKING TYPES
// ============================================================================

import type { EventType } from './types';
import type { StaffAssignment } from './staffTypes';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

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
  notes: string;

  // Staff Assignments
  staffAssignments?: StaffAssignment[];

  // Menu
  menuId?: string; // Reference to EventMenu

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
}

// Types shared between EventDetailContent and its tab components.

import type { BookingStatus } from '@/lib/bookingTypes';
import type { StaffAssignment } from '@/lib/staffTypes';

export type EventTabId = 'contact' | 'details' | 'payment' | 'menu' | 'staff' | 'crm' | 'review';

export interface BookingFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  location: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  adults: number;
  children: number;
  distanceMiles: number;
  premiumAddOn: number;
  notes: string;
  serviceStatus: BookingStatus;
  discountType: 'percent' | 'amount' | undefined;
  discountValue: number | undefined;
  staffAssignments: StaffAssignment[] | undefined;
  staffingProfileId: string | undefined;
  depositPercent: number | undefined;
  depositAmount: number | undefined;
  depositDueDate: string;
  balanceDueDate: string;
}

export interface MenuStatus {
  exists: boolean;
  complete: boolean;
  approvalStatus?: 'draft' | 'ready' | 'approved';
  guestsDone?: number;
  totalGuests?: number;
  itemCount?: number;
}

export interface TemplateMenu {
  id: string;
  bookingId: string;
  name: string;
  type: 'hibachi' | 'catering';
}

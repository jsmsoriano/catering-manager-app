import type { Booking } from './bookingTypes';

export type CustomerId = string;

export type CustomerTag = 'VIP' | 'Corporate' | 'Repeat' | 'Large Party' | 'Caution';

export const CUSTOMER_TAGS: CustomerTag[] = [
  'VIP',
  'Corporate',
  'Repeat',
  'Large Party',
  'Caution',
];

export const TAG_COLORS: Record<CustomerTag, string> = {
  VIP:           'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Corporate:     'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Repeat:        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Large Party': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Caution:       'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export interface CustomerProfileMeta {
  tags: CustomerTag[];
  notes: string;
  contactOverrides?: {
    phone?: string;
    email?: string;
  };
  updatedAt: string;
  // Stub customers — manually created by admin with no bookings
  isStub?: boolean;
  stubName?: string;
}

export interface DerivedCustomer {
  id: CustomerId;
  name: string;              // from most recent booking
  phone: string;
  email: string;
  bookings: Booking[];       // all bookings sorted by eventDate desc
  totalRevenue: number;      // sum of non-cancelled booking.total
  totalPaid: number;         // sum of non-cancelled booking.amountPaid
  bookingCount: number;
  completedCount: number;
  lastEventDate: string | null;
  firstEventDate: string | null;
  tags: CustomerTag[];
  notes: string;
}

export interface BookingPrefill {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export const CUSTOMER_PROFILES_KEY = 'customerProfiles';
export const CUSTOMER_PROFILES_EVENT = 'customerProfilesUpdated';

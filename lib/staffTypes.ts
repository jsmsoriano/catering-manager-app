// ============================================================================
// STAFF MANAGEMENT TYPES
// ============================================================================

export type StaffRole =
  | 'lead-chef'      // Lead chef for private events
  | 'overflow-chef'  // Overflow chef (16-30 guests)
  | 'full-chef'      // Full chef (31+ guests)
  | 'buffet-chef'    // Buffet event chef
  | 'assistant'      // Assistant for private events
  | 'contractor';    // Hired contractor/freelancer

export type StaffStatus = 'active' | 'inactive' | 'on-leave';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Weekly availability pattern
export interface WeeklyAvailability {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

// Main staff member interface
export interface StaffMember {
  id: string;                          // Unique identifier
  name: string;                        // Full name
  email: string;                       // Email address
  phone: string;                       // Phone number

  // Employment Details
  primaryRole: StaffRole;              // Primary role/specialty
  secondaryRoles: StaffRole[];         // Additional roles they can fill
  status: StaffStatus;                 // Current employment status

  // Owner Identification
  isOwner: boolean;                    // Is this person an owner?
  ownerRole?: 'owner-a' | 'owner-b';   // Which owner (if applicable)

  // Availability
  weeklyAvailability: WeeklyAvailability; // General weekly availability
  unavailableDates: string[];          // Specific dates unavailable (ISO date strings)

  // Optional fields
  hourlyRate?: number;                 // Optional hourly rate (for contractors)
  notes?: string;                      // General notes about staff member

  // Metadata
  hireDate: string;                    // ISO date string
  createdAt: string;                   // ISO date string
  updatedAt: string;                   // ISO date string
}

// Form data for creating/editing staff
export interface StaffFormData {
  name: string;
  email: string;
  phone: string;
  primaryRole: StaffRole;
  secondaryRoles: StaffRole[];
  status: StaffStatus;
  isOwner: boolean;
  ownerRole?: 'owner-a' | 'owner-b';
  weeklyAvailability: WeeklyAvailability;
  hourlyRate: string;
  notes: string;
  hireDate: string;
}

// Staff assignment for a booking
export interface StaffAssignment {
  staffId: string;                     // Reference to StaffMember.id
  role: StaffRole;                     // Role for this specific event
  estimatedPay: number;                // Calculated pay for this event
  status: 'scheduled' | 'confirmed' | 'completed';
  notes?: string;                      // Assignment-specific notes
}

// Role labels for display
export const ROLE_LABELS: Record<StaffRole, string> = {
  'lead-chef': 'Lead Chef',
  'overflow-chef': 'Overflow Chef',
  'full-chef': 'Full Chef',
  'buffet-chef': 'Buffet Chef',
  'assistant': 'Assistant',
  'contractor': 'Contractor',
};

// Status labels for display
export const STATUS_LABELS: Record<StaffStatus, string> = {
  'active': 'Active',
  'inactive': 'Inactive',
  'on-leave': 'On Leave',
};

// Day of week labels
export const DAY_LABELS: Record<DayOfWeek, string> = {
  'monday': 'Mon',
  'tuesday': 'Tue',
  'wednesday': 'Wed',
  'thursday': 'Thu',
  'friday': 'Fri',
  'saturday': 'Sat',
  'sunday': 'Sun',
};

// Default weekly availability (all days available)
export const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailability = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: true,
  sunday: true,
};

// ChefRole → StaffRole mapping (for filtering staff dropdowns by calculated role)
import type { ChefRole } from './types';

export const CHEF_ROLE_TO_STAFF_ROLE: Record<ChefRole | 'assistant', StaffRole> = {
  lead: 'lead-chef',
  overflow: 'overflow-chef',
  full: 'full-chef',
  buffet: 'buffet-chef',
  assistant: 'assistant',
};

export const STAFF_ROLE_TO_CHEF_ROLE: Record<string, ChefRole | 'assistant'> = {
  'lead-chef': 'lead',
  'overflow-chef': 'overflow',
  'full-chef': 'full',
  'buffet-chef': 'buffet',
  'assistant': 'assistant',
};

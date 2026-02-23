// ============================================================================
// STAFF MANAGEMENT TYPES
// ============================================================================

export type StaffRole =
  | 'lead-chef'      // Lead chef for private events
  | 'full-chef'      // Full chef (16+ guests, second chef onward)
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

export interface AvailabilityHours {
  startTime: string;
  endTime: string;
}

export type WeeklyAvailabilityHours = Record<DayOfWeek, AvailabilityHours>;

// Main staff member interface
export interface StaffMember {
  id: string;                          // Unique identifier
  name: string;                        // Full name
  email: string;                       // Email address
  phone: string;                       // Phone number
  profilePhoto?: string;               // Optional profile photo (data URL)
  profileSummary?: string;             // Optional profile bio/summary

  // Employment Details
  primaryRole: StaffRole;              // Primary role/specialty
  secondaryRoles: StaffRole[];         // Additional roles they can fill
  status: StaffStatus;                 // Current employment status

  // Owner Identification
  isOwner: boolean;                    // Is this person an owner?
  ownerRole?: 'owner-a' | 'owner-b';   // Which owner (if applicable)

  // Availability
  weeklyAvailability: WeeklyAvailability; // General weekly availability
  weeklyAvailabilityHours?: WeeklyAvailabilityHours; // Preferred hours by weekday
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
  profilePhoto: string;
  profileSummary: string;
  primaryRole: StaffRole;
  secondaryRoles: StaffRole[];
  status: StaffStatus;
  isOwner: boolean;
  ownerRole?: 'owner-a' | 'owner-b';
  weeklyAvailability: WeeklyAvailability;
  weeklyAvailabilityHours?: WeeklyAvailabilityHours;
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
  'full-chef': 'Full Chef',
  'buffet-chef': 'Buffet Chef',
  'assistant': 'Assistant',
  'contractor': 'Contractor',
};

/** Display label for a role; maps legacy 'overflow-chef' to 'Full Chef'. */
export function getRoleDisplayLabel(role: string): string {
  return ROLE_LABELS[role as StaffRole] ?? (role === 'overflow-chef' ? 'Full Chef' : role);
}

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

export const DEFAULT_WEEKLY_AVAILABILITY_HOURS: WeeklyAvailabilityHours = {
  monday: { startTime: '10:00', endTime: '20:00' },
  tuesday: { startTime: '10:00', endTime: '20:00' },
  wednesday: { startTime: '10:00', endTime: '20:00' },
  thursday: { startTime: '10:00', endTime: '20:00' },
  friday: { startTime: '10:00', endTime: '20:00' },
  saturday: { startTime: '10:00', endTime: '20:00' },
  sunday: { startTime: '10:00', endTime: '20:00' },
};

// ChefRole → StaffRole mapping (for filtering staff dropdowns by calculated role)
import type { ChefRole } from './types';

export const CHEF_ROLE_TO_STAFF_ROLE: Record<ChefRole | 'assistant', StaffRole> = {
  lead: 'lead-chef',
  full: 'full-chef',
  buffet: 'buffet-chef',
  assistant: 'assistant',
};

export const STAFF_ROLE_TO_CHEF_ROLE: Record<string, ChefRole | 'assistant'> = {
  'lead-chef': 'lead',
  'full-chef': 'full',
  'buffet-chef': 'buffet',
  'assistant': 'assistant',
};

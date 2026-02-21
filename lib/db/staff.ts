import type { SupabaseClient } from '@supabase/supabase-js';
import type { StaffMember } from '@/lib/staffTypes';

// ─── Row type (snake_case, matches Supabase staff table + migration 003 cols) ─

interface StaffRow {
  app_id: string;
  name: string;
  email: string;
  phone: string;
  profile_photo: string | null;
  profile_summary: string | null;
  primary_role: string;
  secondary_roles: string[];
  status: string;
  is_owner: boolean;
  owner_role: string | null;
  weekly_availability: unknown;
  weekly_availability_hours: unknown;
  unavailable_dates: string[];
  hourly_rate: number | null;
  notes: string | null;
  hire_date: string;
  created_at: string;
  updated_at: string;
}

function toRow(s: StaffMember): StaffRow {
  return {
    app_id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    profile_photo: s.profilePhoto ?? null,
    profile_summary: s.profileSummary ?? null,
    primary_role: s.primaryRole,
    secondary_roles: s.secondaryRoles ?? [],
    status: s.status,
    is_owner: s.isOwner,
    owner_role: s.ownerRole ?? null,
    weekly_availability: s.weeklyAvailability,
    weekly_availability_hours: s.weeklyAvailabilityHours ?? {},
    unavailable_dates: s.unavailableDates ?? [],
    hourly_rate: s.hourlyRate ?? null,
    notes: s.notes ?? null,
    hire_date: s.hireDate,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

function fromRow(r: StaffRow): StaffMember {
  return {
    id: r.app_id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? '',
    profilePhoto: r.profile_photo ?? undefined,
    profileSummary: r.profile_summary ?? undefined,
    primaryRole: r.primary_role as StaffMember['primaryRole'],
    secondaryRoles: (r.secondary_roles ?? []) as StaffMember['secondaryRoles'],
    status: r.status as StaffMember['status'],
    isOwner: r.is_owner,
    ownerRole: (r.owner_role ?? undefined) as StaffMember['ownerRole'],
    weeklyAvailability: r.weekly_availability as StaffMember['weeklyAvailability'],
    weeklyAvailabilityHours: (r.weekly_availability_hours ?? undefined) as StaffMember['weeklyAvailabilityHours'],
    unavailableDates: r.unavailable_dates ?? [],
    hourlyRate: r.hourly_rate ?? undefined,
    notes: r.notes ?? undefined,
    hireDate: r.hire_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchStaff(supabase: SupabaseClient): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .not('app_id', 'is', null)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data as StaffRow[]).map(fromRow);
}

export async function upsertStaff(
  supabase: SupabaseClient,
  staff: StaffMember[]
): Promise<void> {
  if (staff.length === 0) return;
  const rows = staff.map(toRow);
  const { error } = await supabase
    .from('staff')
    .upsert(rows, { onConflict: 'app_id' });
  if (error) throw error;
}

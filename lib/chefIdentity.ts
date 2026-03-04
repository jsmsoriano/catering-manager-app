/**
 * Resolve the logged-in chef's staff ID from auth user and staff list.
 * Used to scope Event Summary (and similar views) to only events the chef worked on.
 */

export type UserForChefMatch = {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
} | null;

export type StaffForChefMatch = { id: string; email: string };

/**
 * Returns the staff ID for the current user when they have the chef role and
 * their email matches a staff member. Otherwise returns null (admin or no match).
 */
export function getCurrentChefStaffId(
  user: UserForChefMatch,
  staff: StaffForChefMatch[]
): string | null {
  if (!user?.email) return null;
  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'chef') return null;
  const emailLower = user.email.trim().toLowerCase();
  const match = staff.find((s) => (s.email || '').trim().toLowerCase() === emailLower);
  return match?.id ?? null;
}

/**
 * Returns true if the booking has the given staff member assigned (they worked the event).
 */
export function bookingHasStaff(
  staffAssignments: { staffId: string }[] | undefined,
  staffId: string
): boolean {
  if (!staffAssignments?.length) return false;
  return staffAssignments.some((a) => a.staffId === staffId);
}

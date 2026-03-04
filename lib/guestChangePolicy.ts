const DEFAULT_CUTOFF_HOUR_UTC = 12;

export function calculateGuestChangeCutoffISO(eventDate: string): string {
  const [year, month, day] = eventDate.split('-').map(Number);
  if (!year || !month || !day) return new Date(0).toISOString();
  return new Date(Date.UTC(year, month - 1, day - 1, DEFAULT_CUTOFF_HOUR_UTC, 0, 0)).toISOString();
}

export function isGuestChangeLocked(params: {
  nowIso?: string;
  guestCountLockedAt?: string | null;
  guestChangeCutoffAt?: string | null;
  eventDate: string;
}): boolean {
  const nowTs = new Date(params.nowIso ?? new Date().toISOString()).getTime();
  const lockedTs = params.guestCountLockedAt ? new Date(params.guestCountLockedAt).getTime() : NaN;
  if (Number.isFinite(lockedTs)) return true;

  const cutoffIso = params.guestChangeCutoffAt || calculateGuestChangeCutoffISO(params.eventDate);
  const cutoffTs = new Date(cutoffIso).getTime();
  return Number.isFinite(cutoffTs) ? nowTs >= cutoffTs : false;
}

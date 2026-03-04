const DEFAULT_MENU_CHANGE_CUTOFF_DAYS = 2;
const DEFAULT_CUTOFF_HOUR_UTC = 12;

export function calculateMenuChangeCutoffISO(
  eventDate: string,
  daysBeforeEvent = DEFAULT_MENU_CHANGE_CUTOFF_DAYS
): string {
  const [year, month, day] = eventDate.split('-').map(Number);
  if (!year || !month || !day) return new Date(0).toISOString();
  return new Date(Date.UTC(year, month - 1, day - daysBeforeEvent, DEFAULT_CUTOFF_HOUR_UTC, 0, 0)).toISOString();
}

export function isMenuChangeLocked(params: {
  nowIso?: string;
  menuChangeLockedAt?: string | null;
  menuChangeCutoffAt?: string | null;
  eventDate: string;
}): boolean {
  const nowTs = new Date(params.nowIso ?? new Date().toISOString()).getTime();
  const lockedTs = params.menuChangeLockedAt ? new Date(params.menuChangeLockedAt).getTime() : NaN;
  if (Number.isFinite(lockedTs)) return true;

  const cutoffIso = params.menuChangeCutoffAt || calculateMenuChangeCutoffISO(params.eventDate);
  const cutoffTs = new Date(cutoffIso).getTime();
  return Number.isFinite(cutoffTs) ? nowTs >= cutoffTs : false;
}

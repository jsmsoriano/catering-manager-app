import { calculateMenuChangeCutoffISO, isMenuChangeLocked } from '@/lib/menuChangePolicy';

describe('menuChangePolicy', () => {
  it('calculates default cutoff as 2 days before event at 12:00 UTC', () => {
    const cutoff = calculateMenuChangeCutoffISO('2026-03-10');
    expect(cutoff).toBe('2026-03-08T12:00:00.000Z');
  });

  it('locks when current time is at or after cutoff', () => {
    const locked = isMenuChangeLocked({
      nowIso: '2026-03-08T12:00:00.000Z',
      eventDate: '2026-03-10',
    });
    expect(locked).toBe(true);
  });

  it('does not lock before cutoff', () => {
    const locked = isMenuChangeLocked({
      nowIso: '2026-03-08T11:59:59.000Z',
      eventDate: '2026-03-10',
    });
    expect(locked).toBe(false);
  });

  it('is locked immediately when menuChangeLockedAt is set', () => {
    const locked = isMenuChangeLocked({
      nowIso: '2026-03-01T00:00:00.000Z',
      eventDate: '2026-03-10',
      menuChangeLockedAt: '2026-03-01T00:00:00.000Z',
    });
    expect(locked).toBe(true);
  });
});

import { calculateGuestChangeCutoffISO, isGuestChangeLocked } from '@/lib/guestChangePolicy';

describe('guestChangePolicy', () => {
  it('calculates cutoff as 1 day before event at 12:00 UTC', () => {
    const cutoff = calculateGuestChangeCutoffISO('2026-03-10');
    expect(cutoff).toBe('2026-03-09T12:00:00.000Z');
  });

  it('locks when now is at cutoff', () => {
    const locked = isGuestChangeLocked({
      nowIso: '2026-03-09T12:00:00.000Z',
      eventDate: '2026-03-10',
    });
    expect(locked).toBe(true);
  });

  it('does not lock before cutoff', () => {
    const locked = isGuestChangeLocked({
      nowIso: '2026-03-09T11:59:00.000Z',
      eventDate: '2026-03-10',
    });
    expect(locked).toBe(false);
  });
});

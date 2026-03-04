import type { Booking } from './bookingTypes';
import type { PackingChecklist, PackingChecklistItem, PackingItemCategory } from './packingTypes';
import { StorageEvent } from './storageEvents';

export const PACKING_CHECKLISTS_KEY = 'packingChecklists';

function safeParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadPackingChecklists(): PackingChecklist[] {
  if (typeof window === 'undefined') return [];
  return safeParse<PackingChecklist>(localStorage.getItem(PACKING_CHECKLISTS_KEY));
}

export function savePackingChecklists(next: PackingChecklist[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PACKING_CHECKLISTS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(StorageEvent.PackingChecklists));
}

export function loadPackingChecklistForBooking(bookingId: string): PackingChecklist | null {
  const lists = loadPackingChecklists();
  return lists.find((l) => l.bookingId === bookingId) ?? null;
}

export function upsertPackingChecklist(list: PackingChecklist): PackingChecklist {
  const all = loadPackingChecklists();
  const idx = all.findIndex((l) => l.id === list.id || l.bookingId === list.bookingId);
  const next = { ...list, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = next;
  } else {
    all.push(next);
  }
  savePackingChecklists(all);
  return next;
}

function createItem(
  name: string,
  category: PackingItemCategory,
  qty = 1,
  required = true
): PackingChecklistItem {
  return {
    id: crypto.randomUUID(),
    name,
    category,
    qty,
    packed: false,
    required,
  };
}

export function defaultPackingItemsForBooking(booking: Booking): PackingChecklistItem[] {
  const base: PackingChecklistItem[] = [
    createItem('Serving utensils set', 'service', 2),
    createItem('Disposable gloves', 'safety', 2),
    createItem('Hand sanitizer', 'safety', 1),
    createItem('Cleaning towels', 'supplies', 1),
    createItem('Trash bags', 'supplies', 1),
    createItem('Lighter / ignition', 'equipment', 2),
  ];

  const guestCount = Math.max(booking.adults + (booking.children ?? 0), 1);

  if (booking.eventType === 'private-dinner' || booking.eventType === 'buffet') {
    const grills = guestCount >= 30 ? 2 : 1;
    const chefs = guestCount >= 30 ? 2 : 1;
    base.push(
      createItem('Hibachi grill(s)', 'equipment', grills),
      createItem('Fuel tanks', 'equipment', grills),
      createItem('Chef knife set', 'equipment', chefs),
      createItem('Spatula set', 'equipment', chefs),
      createItem('Food pans', 'service', Math.max(2, grills * 2)),
      createItem('Serving trays', 'service', Math.max(2, Math.ceil(guestCount / 15)))
    );
  }

  if (booking.eventType === 'buffet') {
    base.push(
      createItem('Chafing dishes', 'service', Math.max(2, Math.ceil(guestCount / 25))),
      createItem('Sterno fuel', 'supplies', Math.max(4, Math.ceil(guestCount / 10))),
      createItem('Buffet labels/signage', 'service', 1, false)
    );
  }

  return base;
}

export function ensurePackingChecklistForBooking(booking: Booking): PackingChecklist {
  const existing = loadPackingChecklistForBooking(booking.id);
  if (existing) return existing;
  const now = new Date().toISOString();
  const created: PackingChecklist = {
    id: crypto.randomUUID(),
    bookingId: booking.id,
    status: 'draft',
    items: defaultPackingItemsForBooking(booking),
    createdAt: now,
    updatedAt: now,
  };
  return upsertPackingChecklist(created);
}

export function evaluatePackingStatus(items: PackingChecklistItem[]): PackingChecklist['status'] {
  if (items.length === 0) return 'draft';
  const required = items.filter((i) => i.required !== false);
  if (required.length === 0) return items.every((i) => i.packed) ? 'packed' : 'ready';
  return required.every((i) => i.packed) ? 'packed' : required.some((i) => i.packed) ? 'ready' : 'draft';
}

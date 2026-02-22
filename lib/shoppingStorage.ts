import type { ShoppingList, ShoppingListItem, ShoppingListItemCategory, ShoppingListUnit } from './shoppingTypes';

// ─── Shopping Presets (catalog of common items for shopping lists) ─────────────

export const SHOPPING_PRESETS_KEY = 'shoppingPresets';

export interface ShoppingPreset {
  id: string;
  name: string;
  category: ShoppingListItemCategory;
  defaultUnit: ShoppingListUnit;
}

export function loadShoppingPresets(): ShoppingPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SHOPPING_PRESETS_KEY);
    return raw ? (JSON.parse(raw) as ShoppingPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveShoppingPresets(presets: ShoppingPreset[]): void {
  localStorage.setItem(SHOPPING_PRESETS_KEY, JSON.stringify(presets));
  window.dispatchEvent(new Event('shoppingPresetsUpdated'));
}

export const SHOPPING_LISTS_KEY = 'shoppingLists';

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadShoppingLists(): ShoppingList[] {
  if (!canUseBrowserStorage()) return [];
  const raw = localStorage.getItem(SHOPPING_LISTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ShoppingList[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveShoppingLists(value: ShoppingList[]) {
  if (!canUseBrowserStorage()) return;
  localStorage.setItem(SHOPPING_LISTS_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event('shoppingListsUpdated'));
}

export function loadShoppingListForBooking(bookingId: string): ShoppingList | null {
  return loadShoppingLists().find((list) => list.bookingId === bookingId) ?? null;
}

export function ensureShoppingListForBooking(bookingId: string): ShoppingList {
  const all = loadShoppingLists();
  const existing = all.find((list) => list.bookingId === bookingId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const created: ShoppingList = {
    id: `shop-${bookingId}`,
    bookingId,
    status: 'draft',
    items: [],
    plannedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  saveShoppingLists([...all, created]);
  return created;
}

export function upsertShoppingList(list: ShoppingList) {
  const all = loadShoppingLists();
  const idx = all.findIndex((entry) => entry.id === list.id);
  if (idx >= 0) {
    const next = [...all];
    next[idx] = list;
    saveShoppingLists(next);
    return;
  }
  saveShoppingLists([...all, list]);
}

export function removeShoppingListForBooking(bookingId: string) {
  const remaining = loadShoppingLists().filter((list) => list.bookingId !== bookingId);
  saveShoppingLists(remaining);
}

/** Append a single item to an event's shopping list (load fresh, append, save). */
export function appendItemToShoppingList(bookingId: string, item: ShoppingListItem): void {
  const list = ensureShoppingListForBooking(bookingId);
  const items = Array.isArray(list.items) ? list.items : [];
  const next: ShoppingList = {
    ...list,
    items: [...items, item],
    updatedAt: new Date().toISOString(),
  };
  upsertShoppingList(next);
}

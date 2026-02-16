import type { ShoppingList } from './shoppingTypes';

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

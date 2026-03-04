import type { MenuItem } from './menuTypes';

export const MENU_ITEM_CHANGE_LOG_KEY = 'menuItemChangeLog';

export interface MenuItemChangeLogEntry {
  id: string;
  menuItemId: string;
  changedAt: string;
  changedBy: string;
  fields: string[];
  summary: string;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return entries.reduce<Record<string, unknown>>((acc, [k, v]) => {
      acc[k] = normalize(v);
      return acc;
    }, {});
  }
  return value;
}

function equalValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export function diffMenuItemFields(prev: MenuItem, next: MenuItem): string[] {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const prevMap = prev as unknown as Record<string, unknown>;
  const nextMap = next as unknown as Record<string, unknown>;
  return Array.from(keys)
    .filter((k) => !equalValue(prevMap[k], nextMap[k]))
    .sort();
}

export function loadMenuItemChangeLog(): MenuItemChangeLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MENU_ITEM_CHANGE_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MenuItemChangeLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendMenuItemChangeLog(entry: Omit<MenuItemChangeLogEntry, 'id'>): void {
  if (typeof window === 'undefined') return;
  const current = loadMenuItemChangeLog();
  const next: MenuItemChangeLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...entry,
  };
  const merged = [next, ...current].slice(0, 1000);
  localStorage.setItem(MENU_ITEM_CHANGE_LOG_KEY, JSON.stringify(merged));
}

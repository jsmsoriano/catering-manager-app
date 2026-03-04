export interface QuoteRevisionEntry {
  id: string;
  bookingId: string;
  quoteVersion: number;
  sentAt: string;
  sentTo?: string;
  reason?: string;
  mode: 'initial' | 'revision';
}

import { StorageEvent } from './storageEvents';

export const QUOTE_REVISION_LOG_KEY = 'quoteRevisionLog';
export const QUOTE_REVISION_UPDATED_EVENT = StorageEvent.QuoteRevision;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadQuoteRevisionLog(): QuoteRevisionEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUOTE_REVISION_LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as QuoteRevisionEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendQuoteRevision(entry: Omit<QuoteRevisionEntry, 'id'>): QuoteRevisionEntry {
  const next: QuoteRevisionEntry = { id: makeId('quote-rev'), ...entry };
  const all = loadQuoteRevisionLog();
  const merged = [next, ...all].slice(0, 2000);
  localStorage.setItem(QUOTE_REVISION_LOG_KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event(QUOTE_REVISION_UPDATED_EVENT));
  return next;
}

export function getQuoteRevisionsByBooking(bookingId: string): QuoteRevisionEntry[] {
  return loadQuoteRevisionLog()
    .filter((r) => r.bookingId === bookingId)
    .sort((a, b) => b.quoteVersion - a.quoteVersion || b.sentAt.localeCompare(a.sentAt));
}

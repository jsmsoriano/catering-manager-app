'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Booking } from '@/lib/bookingTypes';
import { normalizeBookingWorkflowFields } from '@/lib/bookingWorkflow';
import {
  ensurePackingChecklistForBooking,
  evaluatePackingStatus,
  loadPackingChecklistForBooking,
  upsertPackingChecklist,
} from '@/lib/packingStorage';
import type { PackingChecklist, PackingChecklistItem, PackingItemCategory } from '@/lib/packingTypes';

const BOOKINGS_KEY = 'bookings';
const CATEGORY_OPTIONS: PackingItemCategory[] = ['equipment', 'tableware', 'service', 'supplies', 'safety', 'other'];

function safeParseBookings(raw: string | null): Booking[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Booking[];
    return Array.isArray(parsed) ? parsed.map((b) => normalizeBookingWorkflowFields(b)) : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

export default function PackingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-sm text-text-muted">Loading packing checklist...</div>
        </div>
      }
    >
      <PackingContent />
    </Suspense>
  );
}

function PackingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get('bookingId');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [list, setList] = useState<PackingChecklist | null>(null);
  const [hidePacked, setHidePacked] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<PackingItemCategory>('equipment');
  const [newItemQty, setNewItemQty] = useState(1);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    const loaded = safeParseBookings(localStorage.getItem(BOOKINGS_KEY));
    setBookings(loaded);
  }, []);

  useEffect(() => {
    if (!bookingId) {
      setBooking(null);
      setList(null);
      return;
    }
    const found = bookings.find((b) => b.id === bookingId) ?? null;
    setBooking(found);
    if (!found) {
      setList(null);
      return;
    }
    setList(ensurePackingChecklistForBooking(found));
  }, [bookingId, bookings]);

  useEffect(() => {
    if (!bookingId) return;
    const reload = () => setList(loadPackingChecklistForBooking(bookingId));
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'packingChecklists') reload();
      if (e.key === 'bookings') setBookings(safeParseBookings(localStorage.getItem(BOOKINGS_KEY)));
    };
    window.addEventListener('packingChecklistsUpdated', reload);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('packingChecklistsUpdated', reload);
      window.removeEventListener('storage', onStorage);
    };
  }, [bookingId]);

  const filteredItems = useMemo(() => {
    if (!list) return [];
    return list.items.filter((i) => (hidePacked ? !i.packed : true));
  }, [list, hidePacked]);

  const progress = useMemo(() => {
    if (!list || list.items.length === 0) return { packed: 0, total: 0, requiredPacked: 0, requiredTotal: 0 };
    const required = list.items.filter((i) => i.required !== false);
    return {
      packed: list.items.filter((i) => i.packed).length,
      total: list.items.length,
      requiredPacked: required.filter((i) => i.packed).length,
      requiredTotal: required.length,
    };
  }, [list]);

  const updateItems = (items: PackingChecklistItem[]) => {
    if (!list) return;
    setList({
      ...list,
      items,
      status: evaluatePackingStatus(items),
      updatedAt: new Date().toISOString(),
    });
    setHasChanges(true);
  };

  const togglePacked = (itemId: string, packed: boolean) => {
    if (!list) return;
    const now = new Date().toISOString();
    updateItems(
      list.items.map((i) =>
        i.id === itemId ? { ...i, packed, packedAt: packed ? now : undefined } : i
      )
    );
  };

  const updateItem = <K extends keyof PackingChecklistItem>(itemId: string, key: K, value: PackingChecklistItem[K]) => {
    if (!list) return;
    updateItems(list.items.map((i) => (i.id === itemId ? { ...i, [key]: value } : i)));
  };

  const deleteItem = (itemId: string) => {
    if (!list) return;
    if (!confirm('Remove this packing item?')) return;
    updateItems(list.items.filter((i) => i.id !== itemId));
  };

  const markAll = (packed: boolean) => {
    if (!list) return;
    const now = new Date().toISOString();
    updateItems(list.items.map((i) => ({ ...i, packed, packedAt: packed ? now : undefined })));
  };

  const addItem = () => {
    if (!list) return;
    const name = newItemName.trim();
    if (!name) return;
    const next: PackingChecklistItem = {
      id: crypto.randomUUID(),
      name,
      category: newItemCategory,
      qty: Math.max(1, Math.round(newItemQty || 1)),
      packed: false,
      required: true,
    };
    updateItems([...list.items, next]);
    setNewItemName('');
    setNewItemQty(1);
  };

  const saveChecklist = () => {
    if (!list) return;
    const saved = upsertPackingChecklist({
      ...list,
      status: evaluatePackingStatus(list.items),
      updatedAt: new Date().toISOString(),
    });
    setList(saved);
    setHasChanges(false);
    setSavedMessage('Packing checklist saved.');
    setTimeout(() => setSavedMessage(null), 2000);
  };

  if (!bookingId) {
    const upcoming = bookings
      .filter((b) => b.source !== 'inquiry' && b.source !== 'inquiry-declined')
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    return (
      <div className="min-h-screen p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Packing Checklists</h1>
            <p className="mt-1 text-sm text-text-muted">Select an event to open its packing workflow.</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-card-elevated">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Service</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {upcoming.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 text-text-primary">{formatDate(b.eventDate)}</td>
                    <td className="px-4 py-3 text-text-primary">{b.customerName}</td>
                    <td className="px-4 py-3 text-text-secondary">{b.eventType}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/bookings/packing?bookingId=${b.id}`}
                        className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90"
                      >
                        Open checklist
                      </Link>
                    </td>
                  </tr>
                ))}
                {upcoming.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-text-muted" colSpan={4}>
                      No events available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (!booking || !list) {
    return (
      <div className="min-h-screen p-8">
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-text-muted">Event not found.</p>
          <Link href="/bookings/packing" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
            ← Back to checklist events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Packing Checklist</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {booking.customerName} · {formatDate(booking.eventDate)} at {booking.eventTime}
            </p>
            <p className="text-xs text-text-muted">
              {progress.requiredPacked}/{progress.requiredTotal} required packed · {progress.packed}/{progress.total} total packed
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/bookings?bookingId=${booking.id}`} className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-secondary hover:bg-card">
              Open Event
            </Link>
            <button type="button" onClick={() => markAll(true)} className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary hover:bg-card">
              Mark all packed
            </button>
            <button type="button" onClick={() => markAll(false)} className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary hover:bg-card">
              Unpack all
            </button>
            <button
              type="button"
              onClick={saveChecklist}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
            >
              Save Checklist
            </button>
          </div>
        </div>

        {savedMessage && (
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {savedMessage}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56">
              <label className="mb-1 block text-xs font-medium text-text-secondary">Item name</label>
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="ex: 8qt Chafers"
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Category</label>
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value as PackingItemCategory)}
                className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Qty</label>
              <input
                type="number"
                min={1}
                value={newItemQty}
                onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-24 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <button type="button" onClick={addItem} className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card">
              Add item
            </button>
            <label className="ml-auto flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={hidePacked}
                onChange={(e) => setHidePacked(e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              Hide packed items
            </label>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-card-elevated">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Packed</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Item</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Category</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Qty</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Required</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Notes</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item) => (
                <tr key={item.id} className={item.packed ? 'bg-success/5' : ''}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.packed}
                      onChange={(e) => togglePacked(item.id, e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      className="w-full rounded-md border border-border bg-card-elevated px-2 py-1.5 text-sm text-text-primary"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(item.id, 'category', e.target.value as PackingItemCategory)}
                      className="rounded-md border border-border bg-card-elevated px-2 py-1.5 text-sm text-text-primary"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, 'qty', Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 rounded-md border border-border bg-card-elevated px-2 py-1.5 text-sm text-text-primary"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.required !== false}
                      onChange={(e) => updateItem(item.id, 'required', e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.notes ?? ''}
                      onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                      className="w-full rounded-md border border-border bg-card-elevated px-2 py-1.5 text-sm text-text-primary"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/20"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-text-muted">
                    No items to show.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasChanges && (
          <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            You have unsaved checklist changes.
          </div>
        )}
      </div>
    </div>
  );
}

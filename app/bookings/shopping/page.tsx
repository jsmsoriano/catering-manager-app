'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { Expense } from '@/lib/expenseTypes';
import { getBookingServiceStatus, normalizeBookingWorkflowFields } from '@/lib/bookingWorkflow';
import {
  ensureShoppingListForBooking,
  loadShoppingListForBooking,
  upsertShoppingList,
} from '@/lib/shoppingStorage';
import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingListItemCategory,
  ShoppingListUnit,
} from '@/lib/shoppingTypes';
import { calculateShoppingListLineTotal, calculateShoppingListTotals } from '@/lib/shoppingUtils';
import { loadShoppingPresets } from '@/lib/shoppingStorage';
import type { ShoppingPreset } from '@/lib/shoppingStorage';

const BOOKINGS_KEY = 'bookings';
const EXPENSES_KEY = 'expenses';

interface ShoppingItemFormState {
  presetId: string; // '' = custom
  name: string;
  category: ShoppingListItemCategory;
  plannedQty: string;
  plannedUnit: ShoppingListUnit;
  actualQty: string;
  actualUnitCost: string;
  notes: string;
}

const DEFAULT_ITEM_FORM: ShoppingItemFormState = {
  presetId: '',
  name: '',
  category: 'food',
  plannedQty: '1',
  plannedUnit: 'lb',
  actualQty: '',
  actualUnitCost: '',
  notes: '',
};

const UNIT_OPTIONS: ShoppingListUnit[] = ['lb', 'kg', 'oz', 'g', 'ea', 'case', 'bottle', 'tray', 'other'];

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function safeParseList<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function categoryToExpenseCategory(category: ShoppingListItemCategory): 'food' | 'supplies' {
  return category === 'food' ? 'food' : 'supplies';
}

export default function EventShoppingListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-lg text-text-secondary">Loading shopping list...</div>
        </div>
      }
    >
      <EventShoppingListContent />
    </Suspense>
  );
}

function EventShoppingListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get('bookingId');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [itemForm, setItemForm] = useState<ShoppingItemFormState>(DEFAULT_ITEM_FORM);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [presets, setPresets] = useState<ShoppingPreset[]>([]);

  useEffect(() => {
    if (!bookingId) {
      router.push('/bookings');
      return;
    }

    const bookings = safeParseList<Booking>(localStorage.getItem(BOOKINGS_KEY)).map((entry) =>
      normalizeBookingWorkflowFields(entry)
    );
    const foundBooking = bookings.find((entry) => entry.id === bookingId);
    if (!foundBooking) {
      router.push('/bookings');
      return;
    }

    queueMicrotask(() => {
      setBooking(foundBooking);
      setShoppingList(ensureShoppingListForBooking(foundBooking.id));
    });
  }, [bookingId, router]);

  useEffect(() => {
    if (!bookingId) return;

    const reloadShoppingList = () => {
      setShoppingList(loadShoppingListForBooking(bookingId));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'shoppingLists') reloadShoppingList();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('shoppingListsUpdated', reloadShoppingList);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('shoppingListsUpdated', reloadShoppingList);
    };
  }, [bookingId]);

  useEffect(() => {
    setPresets(loadShoppingPresets());
    const handleUpdate = () => setPresets(loadShoppingPresets());
    window.addEventListener('shoppingPresetsUpdated', handleUpdate);
    return () => window.removeEventListener('shoppingPresetsUpdated', handleUpdate);
  }, []);

  const totals = useMemo(() => calculateShoppingListTotals(shoppingList), [shoppingList]);

  const updateShoppingList = (nextValue: ShoppingList) => {
    setShoppingList(nextValue);
    setHasChanges(true);
  };

  const handleAddItem = () => {
    if (!shoppingList) return;

    const name = itemForm.name.trim();
    if (!name) {
      alert('Enter an item name.');
      return;
    }

    const plannedQty = parseFloat(itemForm.plannedQty);
    if (!Number.isFinite(plannedQty) || plannedQty <= 0) {
      alert('Enter a valid planned quantity greater than 0.');
      return;
    }

    const nextItem: ShoppingListItem = {
      id: crypto.randomUUID(),
      name,
      category: itemForm.category,
      plannedQty,
      plannedUnit: itemForm.plannedUnit,
      actualQty: parseOptionalNumber(itemForm.actualQty),
      actualUnitCost: parseOptionalNumber(itemForm.actualUnitCost),
      purchased: false,
      notes: itemForm.notes.trim() || undefined,
    };

    updateShoppingList({
      ...shoppingList,
      items: [...shoppingList.items, nextItem],
      updatedAt: new Date().toISOString(),
    });
    setItemForm(DEFAULT_ITEM_FORM);
  };

  const handleItemChange = <K extends keyof ShoppingListItem>(
    itemId: string,
    field: K,
    value: ShoppingListItem[K]
  ) => {
    if (!shoppingList) return;
    const nextItems = shoppingList.items.map((item) =>
      item.id === itemId ? { ...item, [field]: value } : item
    );
    updateShoppingList({
      ...shoppingList,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRemoveItem = (itemId: string) => {
    if (!shoppingList) return;
    if (!confirm('Remove this shopping list item?')) return;

    updateShoppingList({
      ...shoppingList,
      items: shoppingList.items.filter((item) => item.id !== itemId),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSave = () => {
    if (!shoppingList) return;
    upsertShoppingList({ ...shoppingList, updatedAt: new Date().toISOString() });
    setHasChanges(false);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const handleMarkPurchased = () => {
    if (!shoppingList) return;
    const now = new Date().toISOString();
    const nextList: ShoppingList = {
      ...shoppingList,
      status: 'purchased',
      purchasedAt: shoppingList.purchasedAt || now,
      updatedAt: now,
    };
    upsertShoppingList(nextList);
    setShoppingList(nextList);
    setHasChanges(false);
  };

  const handleSyncToExpenses = () => {
    if (!shoppingList || !booking) return;

    const existingExpenses = safeParseList<Expense>(localStorage.getItem(EXPENSES_KEY));
    const nowDate = format(new Date(), 'yyyy-MM-dd');
    const bySourceId = new Map<string, Expense>();
    existingExpenses.forEach((expense) => {
      if (expense.source && expense.sourceId) bySourceId.set(expense.sourceId, expense);
    });

    const upsertShoppingExpense = (
      listCategory: ShoppingListItemCategory,
      totalAmount: number,
      label: string
    ) => {
      const sourceId = `shopping-list:${shoppingList.id}:${listCategory}`;
      if (totalAmount <= 0.009) {
        bySourceId.delete(sourceId);
        return;
      }

      const existing = bySourceId.get(sourceId);
      const expense: Expense = {
        id: existing?.id || crypto.randomUUID(),
        date: nowDate,
        category: categoryToExpenseCategory(listCategory),
        amount: Math.round(totalAmount * 100) / 100,
        description: `Shopping list: ${label}`,
        bookingId: booking.id,
        notes: `Synced from event shopping list (${shoppingList.id}).`,
        source: 'shopping-list',
        sourceId,
      };
      bySourceId.set(sourceId, expense);
    };

    upsertShoppingExpense('food', totals.foodTotal, 'Food Purchases');
    upsertShoppingExpense('supplies', totals.suppliesTotal, 'Supply Purchases');

    const sourceIdsForThisList = new Set([
      `shopping-list:${shoppingList.id}:food`,
      `shopping-list:${shoppingList.id}:supplies`,
    ]);
    const retainedManualExpenses = existingExpenses.filter(
      (expense) => !(expense.source === 'shopping-list' && sourceIdsForThisList.has(expense.sourceId || ''))
    );
    const syncedExpenses = Array.from(bySourceId.values()).filter((expense) =>
      sourceIdsForThisList.has(expense.sourceId || '')
    );

    localStorage.setItem(EXPENSES_KEY, JSON.stringify([...retainedManualExpenses, ...syncedExpenses]));
    window.dispatchEvent(new Event('expensesUpdated'));
    alert('Shopping list totals synced to linked expenses.');
  };

  if (!booking || !shoppingList) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-text-secondary">Loading event shopping list...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Event Shopping List</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Track purchases per event and sync totals to Expenses and Reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showSaveSuccess && (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Saved!</span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              !hasChanges ? 'cursor-not-allowed bg-border' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Save List
          </button>
          <button
            onClick={handleMarkPurchased}
            disabled={false}
            className="rounded-md px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover"
          >
            Mark Purchased
          </button>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-border bg-card p-4 ">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href={`/bookings?bookingId=${booking.id}`}
            className="font-semibold text-accent hover:text-accent-hover"
          >
            {booking.customerName}
          </Link>
          <span className="text-text-muted">|</span>
          <span className="text-text-secondary">
            {format(parseLocalDate(booking.eventDate), 'MMM d, yyyy')} at {booking.eventTime}
          </span>
          <span className="text-text-muted">|</span>
          <span className="text-text-secondary">Status: {getBookingServiceStatus(booking)}</span>
          <span className="text-text-muted">|</span>
          <span className="text-text-secondary">
            Shopping List: <span className="font-medium">{shoppingList.status}</span>
          </span>
          <span className="text-text-muted">|</span>
          <Link
            href={`/bookings/reconcile?bookingId=${booking.id}`}
            className="text-accent hover:text-accent-hover"
          >
            Open Reconciliation
          </Link>
        </div>
      </div>

      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Food Total</div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totals.foodTotal)}
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="text-sm font-medium text-blue-900 dark:text-blue-200">Supplies Total</div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(totals.suppliesTotal)}
          </div>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-5 dark:border-purple-900 dark:bg-purple-950/20">
          <div className="text-sm font-medium text-purple-900 dark:text-purple-200">Grand Total</div>
          <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(totals.grandTotal)}
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="text-sm font-medium text-amber-900 dark:text-amber-200">Purchased Lines</div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {totals.purchasedCount} / {totals.lineCount}
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-border bg-card p-6 ">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Add Item</h2>
        <div className="grid gap-3 md:grid-cols-7">
          {presets.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <select
                value={itemForm.presetId}
                onChange={(event) => {
                  const id = event.target.value;
                  if (id === '') {
                    setItemForm({ ...DEFAULT_ITEM_FORM, presetId: '' });
                  } else {
                    const preset = presets.find((p) => p.id === id);
                    if (preset) {
                      setItemForm({
                        ...itemForm,
                        presetId: id,
                        name: preset.name,
                        category: preset.category,
                        plannedUnit: preset.defaultUnit,
                      });
                    }
                  }
                }}
                className="rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-card-elevated"
              >
                <option value="">— Select item —</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
              {(itemForm.presetId === '__custom__' || itemForm.presetId === '') && (
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}
                  placeholder="Item name"
                  className="rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-card-elevated"
                />
              )}
            </div>
          ) : (
            <input
              type="text"
              value={itemForm.name}
              onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}
              placeholder="Item name"
              className="rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-card-elevated"
            />
          )}
          <select
            value={itemForm.category}
            onChange={(event) =>
              setItemForm({ ...itemForm, category: event.target.value as ShoppingListItemCategory })
            }
            disabled={false}
            className="rounded-md border border-border px-3 py-2 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-60 bg-card-elevated"
          >
            <option value="food">Food</option>
            <option value="supplies">Supplies</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={itemForm.plannedQty}
            onChange={(event) => setItemForm({ ...itemForm, plannedQty: event.target.value })}
            placeholder="Planned qty"
            disabled={false}
            className="rounded-md border border-border px-3 py-2 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-60 bg-card-elevated"
          />
          <select
            value={itemForm.plannedUnit}
            onChange={(event) =>
              setItemForm({ ...itemForm, plannedUnit: event.target.value as ShoppingListUnit })
            }
            disabled={false}
            className="rounded-md border border-border px-3 py-2 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-60 bg-card-elevated"
          >
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={itemForm.actualQty}
            onChange={(event) => setItemForm({ ...itemForm, actualQty: event.target.value })}
            placeholder="Actual qty"
            disabled={false}
            className="rounded-md border border-border px-3 py-2 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-60 bg-card-elevated"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={itemForm.actualUnitCost}
            onChange={(event) => setItemForm({ ...itemForm, actualUnitCost: event.target.value })}
            placeholder="Unit cost"
            disabled={false}
            className="rounded-md border border-border px-3 py-2 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-60 bg-card-elevated"
          />
          <button
            type="button"
            onClick={handleAddItem}
            disabled={false}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            Add Item
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card ">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Shopping List Items</h2>
          <button
            type="button"
            onClick={handleSyncToExpenses}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            Sync Totals to Expenses
          </button>
        </div>

        {shoppingList.items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-text-muted">
            No items yet. Add ingredients and supplies above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card-elevated">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Item</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Category</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Planned</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Actual Qty</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Unit Cost</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Line Total</th>
                  <th className="px-4 py-3 text-center font-medium text-text-secondary">Purchased</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shoppingList.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-text-primary">
                      <div className="font-medium">{item.name}</div>
                      {item.notes && (
                        <div className="text-xs text-text-muted">{item.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.category}
                        disabled={false}
                        onChange={(event) =>
                          handleItemChange(
                            item.id,
                            'category',
                            event.target.value as ShoppingListItemCategory
                          )
                        }
                        className="rounded border border-border px-2 py-1 text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-60 bg-card-elevated"
                      >
                        <option value="food">Food</option>
                        <option value="supplies">Supplies</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {item.plannedQty} {item.plannedUnit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.actualQty ?? ''}
                        disabled={false}
                        onChange={(event) =>
                          handleItemChange(item.id, 'actualQty', parseOptionalNumber(event.target.value))
                        }
                        className="w-24 rounded border border-border px-2 py-1 text-right text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-60 bg-card-elevated"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.actualUnitCost ?? ''}
                        disabled={false}
                        onChange={(event) =>
                          handleItemChange(
                            item.id,
                            'actualUnitCost',
                            parseOptionalNumber(event.target.value)
                          )
                        }
                        className="w-24 rounded border border-border px-2 py-1 text-right text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-60 bg-card-elevated"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text-primary">
                      {formatCurrency(calculateShoppingListLineTotal(item))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(item.purchased)}
                        disabled={false}
                        onChange={(event) => handleItemChange(item.id, 'purchased', event.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={false}
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-text-muted dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

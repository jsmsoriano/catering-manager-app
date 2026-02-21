'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/moneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { Expense, ExpenseCategory, ExpenseFormData } from '@/lib/expenseTypes';
import { normalizeBookingWorkflowFields } from '@/lib/bookingWorkflow';
import {
  appendItemToShoppingList,
  loadShoppingListForBooking,
} from '@/lib/shoppingStorage';
import type { ShoppingListItem, ShoppingListItemCategory } from '@/lib/shoppingTypes';

const EXPENSES_KEY = 'expenses';
const BOOKINGS_KEY = 'bookings';

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

function loadInitialList<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  return safeParseList<T>(window.localStorage.getItem(key));
}

function loadInitialBookings(): Booking[] {
  return loadInitialList<Booking>(BOOKINGS_KEY).map((booking) => normalizeBookingWorkflowFields(booking));
}

function getDefaultExpenseFormData(): ExpenseFormData {
  return {
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'food',
    amount: '',
    description: '',
    bookingId: '',
    notes: '',
  };
}

const categoryLabels: Record<ExpenseCategory, string> = {
  food: 'Food & Ingredients',
  'gas-mileage': 'Gas & Mileage',
  supplies: 'Supplies',
  equipment: 'Equipment',
  labor: 'Labor (Extra Staff)',
  other: 'Other',
};

const categoryColors: Record<ExpenseCategory, string> = {
  food: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
  'gas-mileage': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  supplies: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  equipment: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
  labor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
  other: 'bg-card-elevated text-text-primary',
};

/** Map expense category to shopping list item category (food | supplies). */
function expenseCategoryToShoppingCategory(category: ExpenseCategory): ShoppingListItemCategory {
  return category === 'food' ? 'food' : 'supplies';
}

/** Create a shopping list line item from an expense and add it to the event's shopping list. */
function addExpenseAsShoppingListItem(
  bookingId: string,
  expense: { description: string; category: ExpenseCategory; amount: number; notes?: string }
): void {
  const category = expenseCategoryToShoppingCategory(expense.category);
  const categoryLabel = categoryLabels[expense.category];
  const lineNote = [expense.notes?.trim(), `From expense: ${categoryLabel}`].filter(Boolean).join(' · ') || undefined;

  const newItem: ShoppingListItem = {
    id: crypto.randomUUID(),
    name: expense.description.trim() || 'Expense line',
    category,
    plannedQty: 1,
    plannedUnit: 'ea',
    actualUnitCost: expense.amount,
    purchased: false,
    notes: lineNote,
  };

  appendItemToShoppingList(bookingId, newItem);
}

export default function ExpensesPage() {
  const [filterByBookingId, setFilterByBookingId] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>(() => loadInitialList<Expense>(EXPENSES_KEY));
  const [bookings, setBookings] = useState<Booking[]>(loadInitialBookings);

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseFormData, setExpenseFormData] = useState<ExpenseFormData>(getDefaultExpenseFormData);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  const loadExpenses = () => {
    setExpenses(safeParseList<Expense>(localStorage.getItem(EXPENSES_KEY)));
  };

  const loadBookings = () => {
    setBookings(
      safeParseList<Booking>(localStorage.getItem(BOOKINGS_KEY)).map((booking) =>
        normalizeBookingWorkflowFields(booking)
      )
    );
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === EXPENSES_KEY) loadExpenses();
      if (e.key === BOOKINGS_KEY) loadBookings();
    };

    const handleBookingsUpdated = () => loadBookings();
    const handleExpensesUpdated = () => loadExpenses();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('bookingsUpdated', handleBookingsUpdated);
    window.addEventListener('expensesUpdated', handleExpensesUpdated);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bookingsUpdated', handleBookingsUpdated);
      window.removeEventListener('expensesUpdated', handleExpensesUpdated);
    };
  }, []);

  useEffect(() => {
    if (openActionsId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setOpenActionsId(null);
      }
    };
    // Use 'click' so the Delete button's click (and confirm) runs before we close the menu
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openActionsId]);

  const saveExpenses = (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses));
    window.dispatchEvent(new Event('expensesUpdated'));
  };

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseFormData(getDefaultExpenseFormData());
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expenseFormData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid expense amount greater than 0.');
      return;
    }

    const nextExpense: Expense = {
      id: editingExpenseId || crypto.randomUUID(),
      date: expenseFormData.date,
      category: expenseFormData.category,
      amount,
      description: expenseFormData.description.trim(),
      bookingId: expenseFormData.bookingId || undefined,
      notes: expenseFormData.notes?.trim() || undefined,
    };

    if (editingExpenseId) {
      saveExpenses(expenses.map((expense) => (expense.id === editingExpenseId ? nextExpense : expense)));
    } else {
      saveExpenses([...expenses, nextExpense]);
      const linkedBookingId = (expenseFormData.bookingId || '').trim();
      if (linkedBookingId) {
        addExpenseAsShoppingListItem(linkedBookingId, {
          description: nextExpense.description,
          category: nextExpense.category,
          amount: nextExpense.amount,
          notes: nextExpense.notes,
        });
      }
    }

    setShowExpenseForm(false);
    resetExpenseForm();
  };

  const handleEditExpense = (expense: Expense) => {
    setOpenActionsId(null);
    setExpenseFormData({
      date: expense.date,
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description,
      bookingId: expense.bookingId || '',
      notes: expense.notes || '',
    });
    setEditingExpenseId(expense.id);
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = (expense: Expense) => {
    if (!confirm('Delete this expense record?')) {
      setOpenActionsId(null);
      return;
    }
    setOpenActionsId(null);
    saveExpenses(expenses.filter((e) => e.id !== expense.id));
  };

  const expenseSummary = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const byCategory: Record<ExpenseCategory, number> = {
      food: 0,
      'gas-mileage': 0,
      supplies: 0,
      equipment: 0,
      labor: 0,
      other: 0,
    };

    expenses.forEach((expense) => {
      byCategory[expense.category] += expense.amount;
    });

    const linkedToEvents = expenses.filter((expense) => expense.bookingId).length;
    const eventLinkedExpenses = expenses.filter((expense) => expense.bookingId);
    const eventIds = new Set(eventLinkedExpenses.map((e) => e.bookingId));
    const eventLinkedTotal = eventLinkedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const eventCount = eventIds.size;
    const averagePerEvent = eventCount > 0 ? eventLinkedTotal / eventCount : 0;

    return {
      total,
      byCategory,
      linkedToEvents,
      generalExpenses: expenses.length - linkedToEvents,
      count: expenses.length,
      averagePerEvent,
    };
  }, [expenses]);

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()
      ),
    [expenses]
  );

  const filteredExpenses = useMemo(
    () =>
      filterByBookingId
        ? sortedExpenses.filter((e) => e.bookingId === filterByBookingId)
        : sortedExpenses,
    [sortedExpenses, filterByBookingId]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Expense Tracking
        </h1>
        <p className="mt-2 text-text-secondary">
          Track spend and connect costs to events.
        </p>
      </div>

      <>
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => {
                if (showExpenseForm) {
                  resetExpenseForm();
                }
                setShowExpenseForm((prev) => !prev);
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showExpenseForm ? 'Cancel' : '+ Add Expense'}
            </button>
          </div>

          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-text-primary">Total Expenses</h3>
              <p className="mt-2 text-3xl font-bold text-text-primary">
                {formatCurrency(expenseSummary.total)}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {expenseSummary.count} total records
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-text-primary">Food Costs</h3>
              <p className="mt-2 text-3xl font-bold text-text-primary">
                {formatCurrency(expenseSummary.byCategory.food)}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {expenseSummary.total > 0
                  ? ((expenseSummary.byCategory.food / expenseSummary.total) * 100).toFixed(0)
                  : 0}
                % of total
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-text-primary">
                Event-Linked
              </h3>
              <p className="mt-2 text-3xl font-bold text-text-primary">
                {expenseSummary.linkedToEvents}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {expenseSummary.generalExpenses} general expenses
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-text-primary">
                Average expense per event
              </h3>
              <p className="mt-2 text-3xl font-bold text-text-primary">
                {formatCurrency(expenseSummary.averagePerEvent)}
              </p>
              <p className="mt-1 text-xs text-text-secondary">Event-linked expenses only</p>
            </div>
          </div>

          {showExpenseForm && (
            <div className="mb-8 rounded-lg border border-border bg-card p-6 dark:border-border ">
              <h2 className="mb-4 text-xl font-semibold text-text-primary">
                {editingExpenseId ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <form onSubmit={handleExpenseSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">Date *</label>
                    <input
                      type="date"
                      value={expenseFormData.date}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                      required
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">Category *</label>
                    <select
                      value={expenseFormData.category}
                      onChange={(e) =>
                        setExpenseFormData({
                          ...expenseFormData,
                          category: e.target.value as ExpenseCategory,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">Amount *</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-2 text-text-muted">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={expenseFormData.amount}
                        onChange={(e) =>
                          setExpenseFormData({
                            ...expenseFormData,
                            amount: e.target.value,
                          })
                        }
                        className="w-full rounded-md border border-border bg-card-elevated py-2 pl-7 pr-3 text-text-primary"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Link to Event (Optional)
                    </label>
                    <select
                      value={expenseFormData.bookingId}
                      onChange={(e) => {
                        const bookingId = e.target.value;
                        let next = { ...expenseFormData, bookingId };
                        if (bookingId) {
                          const list = loadShoppingListForBooking(bookingId);
                          if (list?.items?.length) {
                            const shoppingTotal = list.items.reduce(
                              (sum, item) =>
                                sum +
                                (item.actualQty ?? item.plannedQty) * (item.actualUnitCost ?? 0),
                              0
                            );
                            if (shoppingTotal > 0) next = { ...next, amount: shoppingTotal.toFixed(2) };
                          }
                        }
                        setExpenseFormData(next);
                      }}
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                    >
                      <option value="">General Business Expense</option>
                      {bookings
                        .slice()
                        .sort(
                          (a, b) =>
                            parseLocalDate(b.eventDate).getTime() -
                            parseLocalDate(a.eventDate).getTime()
                        )
                        .map((booking) => (
                          <option key={booking.id} value={booking.id}>
                            {format(parseLocalDate(booking.eventDate), 'MMM d, yyyy')} -{' '}
                            {booking.customerName}
                          </option>
                        ))}
                    </select>
                    {expenseFormData.bookingId && !editingExpenseId && (
                      <p className="mt-1 text-xs text-text-muted">
                        This will add a line to the event shopping list (category maps to Food or Supplies).
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={expenseFormData.description}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        description: e.target.value,
                      })
                    }
                    placeholder="e.g., Grocery run, gas, or event supplies"
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={expenseFormData.notes}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        notes: e.target.value,
                      })
                    }
                    placeholder="Additional context, receipt notes, etc."
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {editingExpenseId ? 'Update Expense' : 'Add Expense'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExpenseForm(false);
                      resetExpenseForm();
                    }}
                    className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card dark:border-border ">
            <div className="border-b border-border px-6 py-4 dark:border-border flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-text-primary">All Expenses</h2>
              <div className="flex items-center gap-2">
                <label htmlFor="filter-by-event" className="text-sm font-medium text-text-secondary whitespace-nowrap">
                  Filter by linked event
                </label>
                <select
                  id="filter-by-event"
                  value={filterByBookingId}
                  onChange={(e) => setFilterByBookingId(e.target.value)}
                  className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary min-w-[200px]"
                >
                  <option value="">All events</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {format(parseISO(b.eventDate), 'MMM d, yyyy')} – {b.customerName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {filteredExpenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-card-elevated">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Linked Event
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredExpenses.map((expense, rowIndex) => {
                      const linkedBooking = expense.bookingId
                        ? bookings.find((booking) => booking.id === expense.bookingId)
                        : undefined;
                      const isLastRow = rowIndex === filteredExpenses.length - 1;

                      return (
                        <tr
                          key={expense.id}
                          className="hover:bg-card-elevated"
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-text-primary">
                            {format(parseLocalDate(expense.date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                categoryColors[expense.category]
                              }`}
                            >
                              {categoryLabels[expense.category]}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-text-primary">
                            <div className="font-medium">{expense.description}</div>
                            {expense.notes && (
                              <div className="mt-1 text-xs text-text-secondary">
                                {expense.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            {linkedBooking ? (
                              <>
                                <div className="font-medium text-text-primary">
                                  {linkedBooking.customerName}
                                </div>
                                <div className="text-xs">
                                  {format(parseLocalDate(linkedBooking.eventDate), 'MMM d')}
                                </div>
                              </>
                            ) : (
                              <span className="text-text-muted">General</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-text-primary">
                            {formatCurrency(expense.amount)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                            <div
                              ref={openActionsId === expense.id ? actionsMenuRef : undefined}
                              className="relative inline-block"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionsId((id) => (id === expense.id ? null : expense.id))
                                }
                                className="rounded p-1.5 text-text-muted hover:bg-card-elevated hover:text-text-primary"
                                aria-label="Actions"
                              >
                                <EllipsisVerticalIcon className="h-5 w-5" />
                              </button>
                              {openActionsId === expense.id && (
                                <div
                                  className={`absolute right-0 z-10 min-w-[120px] rounded-md border border-border bg-card py-1 shadow-lg ${
                                    isLastRow ? 'bottom-full mb-1' : 'top-full mt-1'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleEditExpense(expense)}
                                    className="flex w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-card-elevated"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExpense(expense)}
                                    className="flex w-full px-3 py-2 text-left text-sm text-danger hover:bg-card-elevated"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-text-secondary">No expenses recorded yet.</p>
                <p className="mt-2 text-sm text-text-muted">
                  Click Add Expense to start tracking costs.
                </p>
              </div>
            )}
          </div>

          {expenses.length > 0 && (
            <div className="mt-8 rounded-lg border border-border bg-card p-6 dark:border-border ">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Expenses by Category
              </h3>
              <div className="space-y-3">
                {Object.entries(expenseSummary.byCategory)
                  .filter(([, amount]) => amount > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, amount]) => (
                    <div key={category}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-medium text-text-secondary">
                          {categoryLabels[category as ExpenseCategory]}
                        </span>
                        <span className="text-text-primary">
                          {formatCurrency(amount)} ({((amount / expenseSummary.total) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${(amount / expenseSummary.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>

    </div>
  );
}

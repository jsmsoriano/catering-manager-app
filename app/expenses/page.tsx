'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import type { Expense, ExpenseCategory, ExpenseFormData } from '@/lib/expenseTypes';
import type { Booking } from '@/lib/bookingTypes';

// Helper to parse date strings as local dates (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  other: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'food',
    amount: '',
    description: '',
    bookingId: '',
    notes: '',
  });

  // Load expenses and bookings from localStorage
  useEffect(() => {
    const savedExpenses = localStorage.getItem('expenses');
    if (savedExpenses) {
      try {
        setExpenses(JSON.parse(savedExpenses));
      } catch (e) {
        console.error('Failed to load expenses:', e);
      }
    }

    const savedBookings = localStorage.getItem('bookings');
    if (savedBookings) {
      try {
        setBookings(JSON.parse(savedBookings));
      } catch (e) {
        console.error('Failed to load bookings:', e);
      }
    }
  }, []);

  // Save expenses to localStorage
  const saveExpenses = (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    localStorage.setItem('expenses', JSON.stringify(newExpenses));
    console.log('💰 Expenses: Dispatching expensesUpdated event');
    window.dispatchEvent(new Event('expensesUpdated'));
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const expense: Expense = {
      id: editingId || crypto.randomUUID(),
      date: formData.date,
      category: formData.category,
      amount: parseFloat(formData.amount),
      description: formData.description,
      bookingId: formData.bookingId || undefined,
      notes: formData.notes || undefined,
    };

    if (editingId) {
      // Update existing expense
      saveExpenses(expenses.map((exp) => (exp.id === editingId ? expense : exp)));
    } else {
      // Add new expense
      saveExpenses([...expenses, expense]);
    }

    // Reset form
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      category: 'food',
      amount: '',
      description: '',
      bookingId: '',
      notes: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  // Handle edit
  const handleEdit = (expense: Expense) => {
    setFormData({
      date: expense.date,
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description,
      bookingId: expense.bookingId || '',
      notes: expense.notes || '',
    });
    setEditingId(expense.id);
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      saveExpenses(expenses.filter((exp) => exp.id !== id));
    }
  };

  // Calculate summary stats
  const summary = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const byCategory: Record<ExpenseCategory, number> = {
      food: 0,
      'gas-mileage': 0,
      supplies: 0,
      equipment: 0,
      labor: 0,
      other: 0,
    };

    expenses.forEach((exp) => {
      byCategory[exp.category] += exp.amount;
    });

    const linkedToEvents = expenses.filter((exp) => exp.bookingId).length;
    const generalExpenses = expenses.length - linkedToEvents;

    return {
      total,
      byCategory,
      linkedToEvents,
      generalExpenses,
      count: expenses.length,
    };
  }, [expenses]);

  // Sort expenses by date (newest first)
  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      return parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime();
    });
  }, [expenses]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Expense Tracking
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Track actual expenses and compare against estimates
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) {
              setEditingId(null);
              setFormData({
                date: format(new Date(), 'yyyy-MM-dd'),
                category: 'food',
                amount: '',
                description: '',
                bookingId: '',
                notes: '',
              });
            }
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
            Total Expenses
          </h3>
          <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(summary.total)}
          </p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
            {summary.count} total expenses
          </p>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
          <h3 className="text-sm font-medium text-red-900 dark:text-red-200">
            Food Costs
          </h3>
          <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(summary.byCategory.food)}
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            {summary.total > 0
              ? ((summary.byCategory.food / summary.total) * 100).toFixed(0)
              : 0}
            % of total
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
          <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Event-Linked
          </h3>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {summary.linkedToEvents}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            {summary.generalExpenses} general expenses
          </p>
        </div>

        <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-900 dark:bg-purple-950/20">
          <h3 className="text-sm font-medium text-purple-900 dark:text-purple-200">
            Avg per Expense
          </h3>
          <p className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(summary.count > 0 ? summary.total / summary.count : 0)}
          </p>
          <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
            Across all categories
          </p>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {editingId ? 'Edit Expense' : 'Add New Expense'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as ExpenseCategory })
                  }
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Amount *
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-zinc-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    min="0"
                    className="w-full rounded-md border border-zinc-300 py-2 pl-7 pr-3 dark:border-zinc-700 dark:bg-zinc-800"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Link to Event (Optional)
                </label>
                <select
                  value={formData.bookingId}
                  onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">General Business Expense</option>
                  {bookings
                    .sort((a, b) => parseLocalDate(b.eventDate).getTime() - parseLocalDate(a.eventDate).getTime())
                    .map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {format(parseLocalDate(booking.eventDate), 'MMM d, yyyy')} -{' '}
                        {booking.customerName}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Description *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                placeholder="e.g., Costco grocery run, Gas for event delivery"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Additional details..."
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {editingId ? 'Update Expense' : 'Add Expense'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    date: format(new Date(), 'yyyy-MM-dd'),
                    category: 'food',
                    amount: '',
                    description: '',
                    bookingId: '',
                    notes: '',
                  });
                }}
                className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses List */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            All Expenses
          </h2>
        </div>

        {sortedExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Linked Event
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sortedExpenses.map((expense) => {
                  const linkedBooking = expense.bookingId
                    ? bookings.find((b) => b.id === expense.bookingId)
                    : null;

                  return (
                    <tr
                      key={expense.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
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
                      <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                        <div>
                          <div className="font-medium">{expense.description}</div>
                          {expense.notes && (
                            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                              {expense.notes}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {linkedBooking ? (
                          <div>
                            <div className="font-medium text-zinc-900 dark:text-zinc-50">
                              {linkedBooking.customerName}
                            </div>
                            <div className="text-xs">
                              {format(parseLocalDate(linkedBooking.eventDate), 'MMM d')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-400">General</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="mr-3 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">No expenses recorded yet</p>
            <p className="mt-2 text-sm text-zinc-500">
              Click "Add Expense" above to start tracking your costs
            </p>
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      {expenses.length > 0 && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Expenses by Category
          </h3>
          <div className="space-y-3">
            {Object.entries(summary.byCategory)
              .filter(([, amount]) => amount > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => (
                <div key={category}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {categoryLabels[category as ExpenseCategory]}
                    </span>
                    <span className="text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(amount)} (
                      {((amount / summary.total) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${(amount / summary.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

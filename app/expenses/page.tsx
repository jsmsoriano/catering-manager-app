'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type {
  Expense,
  ExpenseCategory,
  ExpenseFormData,
  InventoryCategory,
  InventoryItem,
  InventoryItemFormData,
  InventoryMovementFormData,
  InventoryMovementType,
  InventoryTransaction,
} from '@/lib/expenseTypes';

const EXPENSES_KEY = 'expenses';
const BOOKINGS_KEY = 'bookings';
const INVENTORY_ITEMS_KEY = 'inventoryItems';
const INVENTORY_TRANSACTIONS_KEY = 'inventoryTransactions';

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

function getDefaultInventoryItemFormData(): InventoryItemFormData {
  return {
    name: '',
    category: 'protein',
    unit: 'lb',
    currentStock: '',
    parLevel: '',
    reorderPoint: '',
    avgUnitCost: '',
    vendor: '',
    notes: '',
  };
}

function getDefaultMovementFormData(): InventoryMovementFormData {
  return {
    itemId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'restock',
    quantity: '',
    unitCost: '',
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
  other: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300',
};

const inventoryCategoryLabels: Record<InventoryCategory, string> = {
  protein: 'Protein',
  produce: 'Produce',
  'dry-goods': 'Dry Goods',
  sauces: 'Sauces',
  beverages: 'Beverages',
  disposables: 'Disposables',
  other: 'Other',
};

const movementTypeLabels: Record<InventoryMovementType, string> = {
  restock: 'Restock',
  usage: 'Usage',
  adjustment: 'Adjustment',
};

function getInventoryStatus(item: InventoryItem): 'out' | 'low' | 'healthy' {
  if (item.currentStock <= 0) return 'out';
  if (item.currentStock <= item.reorderPoint) return 'low';
  return 'healthy';
}

export default function ExpensesPage() {
  const [activeSection, setActiveSection] = useState<'expenses' | 'inventory'>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>(() => loadInitialList<Expense>(EXPENSES_KEY));
  const [bookings, setBookings] = useState<Booking[]>(() => loadInitialList<Booking>(BOOKINGS_KEY));

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseFormData, setExpenseFormData] = useState<ExpenseFormData>(getDefaultExpenseFormData);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() =>
    loadInitialList<InventoryItem>(INVENTORY_ITEMS_KEY)
  );
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>(() =>
    loadInitialList<InventoryTransaction>(INVENTORY_TRANSACTIONS_KEY)
  );
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [inventoryItemFormData, setInventoryItemFormData] = useState<InventoryItemFormData>(
    getDefaultInventoryItemFormData
  );
  const [movementFormData, setMovementFormData] = useState<InventoryMovementFormData>(
    getDefaultMovementFormData
  );

  const loadExpenses = () => {
    setExpenses(safeParseList<Expense>(localStorage.getItem(EXPENSES_KEY)));
  };

  const loadBookings = () => {
    setBookings(safeParseList<Booking>(localStorage.getItem(BOOKINGS_KEY)));
  };

  const loadInventoryItems = () => {
    setInventoryItems(safeParseList<InventoryItem>(localStorage.getItem(INVENTORY_ITEMS_KEY)));
  };

  const loadInventoryTransactions = () => {
    setInventoryTransactions(
      safeParseList<InventoryTransaction>(localStorage.getItem(INVENTORY_TRANSACTIONS_KEY))
    );
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === EXPENSES_KEY) loadExpenses();
      if (e.key === BOOKINGS_KEY) loadBookings();
      if (e.key === INVENTORY_ITEMS_KEY) loadInventoryItems();
      if (e.key === INVENTORY_TRANSACTIONS_KEY) loadInventoryTransactions();
    };

    const handleBookingsUpdated = () => loadBookings();
    const handleExpensesUpdated = () => loadExpenses();
    const handleInventoryUpdated = () => {
      loadInventoryItems();
      loadInventoryTransactions();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('bookingsUpdated', handleBookingsUpdated);
    window.addEventListener('expensesUpdated', handleExpensesUpdated);
    window.addEventListener('inventoryUpdated', handleInventoryUpdated);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bookingsUpdated', handleBookingsUpdated);
      window.removeEventListener('expensesUpdated', handleExpensesUpdated);
      window.removeEventListener('inventoryUpdated', handleInventoryUpdated);
    };
  }, []);

  const saveExpenses = (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses));
    window.dispatchEvent(new Event('expensesUpdated'));
  };

  const saveInventoryItems = (newItems: InventoryItem[]) => {
    setInventoryItems(newItems);
    localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(newItems));
    window.dispatchEvent(new Event('inventoryUpdated'));
  };

  const saveInventoryTransactions = (newTransactions: InventoryTransaction[]) => {
    setInventoryTransactions(newTransactions);
    localStorage.setItem(INVENTORY_TRANSACTIONS_KEY, JSON.stringify(newTransactions));
    window.dispatchEvent(new Event('inventoryUpdated'));
  };

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseFormData(getDefaultExpenseFormData());
  };

  const resetInventoryItemForm = () => {
    setEditingInventoryId(null);
    setInventoryItemFormData(getDefaultInventoryItemFormData());
  };

  const resetMovementForm = () => {
    setMovementFormData(getDefaultMovementFormData());
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
    }

    setShowExpenseForm(false);
    resetExpenseForm();
  };

  const handleEditExpense = (expense: Expense) => {
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

  const handleDeleteExpense = (id: string) => {
    if (!confirm('Delete this expense record?')) return;
    saveExpenses(expenses.filter((expense) => expense.id !== id));
  };

  const handleInventoryItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentStock = parseFloat(inventoryItemFormData.currentStock);
    const parLevel = parseFloat(inventoryItemFormData.parLevel);
    const reorderPoint = parseFloat(inventoryItemFormData.reorderPoint);
    const avgUnitCost = parseFloat(inventoryItemFormData.avgUnitCost);

    const numericValues = [currentStock, parLevel, reorderPoint, avgUnitCost];
    if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
      alert('Stock, par, reorder point, and unit cost must be valid non-negative numbers.');
      return;
    }
    if (reorderPoint > parLevel) {
      alert('Reorder point should be less than or equal to par level.');
      return;
    }

    const existingItem = editingInventoryId
      ? inventoryItems.find((item) => item.id === editingInventoryId)
      : undefined;
    const nowIso = new Date().toISOString();

    const nextItem: InventoryItem = {
      id: editingInventoryId || crypto.randomUUID(),
      name: inventoryItemFormData.name.trim(),
      category: inventoryItemFormData.category,
      unit: inventoryItemFormData.unit,
      currentStock,
      parLevel,
      reorderPoint,
      avgUnitCost,
      vendor: inventoryItemFormData.vendor.trim() || undefined,
      notes: inventoryItemFormData.notes.trim() || undefined,
      createdAt: existingItem?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (editingInventoryId) {
      saveInventoryItems(inventoryItems.map((item) => (item.id === editingInventoryId ? nextItem : item)));
    } else {
      saveInventoryItems([...inventoryItems, nextItem]);
    }

    setShowInventoryForm(false);
    resetInventoryItemForm();
  };

  const handleEditInventoryItem = (item: InventoryItem) => {
    setInventoryItemFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock.toString(),
      parLevel: item.parLevel.toString(),
      reorderPoint: item.reorderPoint.toString(),
      avgUnitCost: item.avgUnitCost.toString(),
      vendor: item.vendor || '',
      notes: item.notes || '',
    });
    setEditingInventoryId(item.id);
    setShowInventoryForm(true);
  };

  const handleDeleteInventoryItem = (itemId: string) => {
    if (!confirm('Delete this inventory item and its movement history?')) return;
    saveInventoryItems(inventoryItems.filter((item) => item.id !== itemId));
    saveInventoryTransactions(
      inventoryTransactions.filter((transaction) => transaction.itemId !== itemId)
    );
  };

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventoryItems.find((entry) => entry.id === movementFormData.itemId);
    if (!item) {
      alert('Select an inventory item first.');
      return;
    }

    let quantityInput = parseFloat(movementFormData.quantity);
    if (!Number.isFinite(quantityInput) || quantityInput === 0) {
      alert('Quantity must be a valid non-zero number.');
      return;
    }

    if (movementFormData.type !== 'adjustment' && quantityInput < 0) {
      quantityInput = Math.abs(quantityInput);
    }

    let signedQuantity = quantityInput;
    if (movementFormData.type === 'usage') {
      signedQuantity = -Math.abs(quantityInput);
      if (Math.abs(signedQuantity) > item.currentStock) {
        alert('Usage quantity cannot exceed current stock.');
        return;
      }
    } else if (movementFormData.type === 'restock') {
      signedQuantity = Math.abs(quantityInput);
    }

    const newStock = Math.max(0, item.currentStock + signedQuantity);
    let nextAvgCost = item.avgUnitCost;
    let restockUnitCost: number | undefined;

    if (movementFormData.type === 'restock') {
      const unitCost = parseFloat(movementFormData.unitCost);
      if (Number.isFinite(unitCost) && unitCost > 0) {
        restockUnitCost = unitCost;
        const existingValue = item.currentStock * item.avgUnitCost;
        const incomingValue = signedQuantity * unitCost;
        nextAvgCost = (existingValue + incomingValue) / Math.max(0.0001, item.currentStock + signedQuantity);
      }
    }

    const updatedItem: InventoryItem = {
      ...item,
      currentStock: newStock,
      avgUnitCost: nextAvgCost,
      updatedAt: new Date().toISOString(),
    };
    saveInventoryItems(inventoryItems.map((entry) => (entry.id === item.id ? updatedItem : entry)));

    const nextTransaction: InventoryTransaction = {
      id: crypto.randomUUID(),
      itemId: item.id,
      date: movementFormData.date,
      type: movementFormData.type,
      quantity: signedQuantity,
      unitCost: restockUnitCost,
      bookingId: movementFormData.bookingId || undefined,
      notes: movementFormData.notes.trim() || undefined,
    };

    const mergedTransactions = [...inventoryTransactions, nextTransaction].sort((a, b) => {
      if (a.date === b.date) return b.id.localeCompare(a.id);
      return b.date.localeCompare(a.date);
    });
    saveInventoryTransactions(mergedTransactions);

    setShowMovementForm(false);
    resetMovementForm();
  };

  const handleLoadSampleInventory = () => {
    const shouldLoad = confirm(
      'Load sample inventory catalog?\n\nThis will replace current inventory items and movement history.'
    );
    if (!shouldLoad) return;

    const nowIso = new Date().toISOString();
    const sampleItems: InventoryItem[] = [
      {
        id: 'inv-protein-steak',
        name: 'NY Strip Steak',
        category: 'protein',
        unit: 'lb',
        currentStock: 42,
        parLevel: 80,
        reorderPoint: 30,
        avgUnitCost: 12.5,
        vendor: 'Prime Meats Co',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'inv-protein-chicken',
        name: 'Chicken Breast',
        category: 'protein',
        unit: 'lb',
        currentStock: 55,
        parLevel: 90,
        reorderPoint: 35,
        avgUnitCost: 4.2,
        vendor: 'Fresh Poultry Supply',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'inv-produce-zucchini',
        name: 'Zucchini',
        category: 'produce',
        unit: 'lb',
        currentStock: 18,
        parLevel: 35,
        reorderPoint: 12,
        avgUnitCost: 1.75,
        vendor: 'Market Produce',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'inv-sauce-teriyaki',
        name: 'Teriyaki Sauce',
        category: 'sauces',
        unit: 'bottle',
        currentStock: 24,
        parLevel: 36,
        reorderPoint: 10,
        avgUnitCost: 3.6,
        vendor: 'Asian Pantry',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'inv-disposable-plates',
        name: 'Compostable Dinner Plates',
        category: 'disposables',
        unit: 'case',
        currentStock: 3,
        parLevel: 8,
        reorderPoint: 3,
        avgUnitCost: 45,
        vendor: 'EcoServe',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'inv-dry-rice',
        name: 'Jasmine Rice',
        category: 'dry-goods',
        unit: 'lb',
        currentStock: 70,
        parLevel: 100,
        reorderPoint: 40,
        avgUnitCost: 1.15,
        vendor: 'Pantry Wholesale',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    saveInventoryItems(sampleItems);
    saveInventoryTransactions([]);
    alert(`Loaded ${sampleItems.length} sample inventory items.`);
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

    return {
      total,
      byCategory,
      linkedToEvents,
      generalExpenses: expenses.length - linkedToEvents,
      count: expenses.length,
    };
  }, [expenses]);

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()
      ),
    [expenses]
  );

  const inventorySummary = useMemo(() => {
    const totalSkus = inventoryItems.length;
    const totalValue = inventoryItems.reduce(
      (sum, item) => sum + item.currentStock * item.avgUnitCost,
      0
    );
    const lowStockCount = inventoryItems.filter(
      (item) => item.currentStock > 0 && item.currentStock <= item.reorderPoint
    ).length;
    const outOfStockCount = inventoryItems.filter((item) => item.currentStock <= 0).length;
    const belowParCount = inventoryItems.filter((item) => item.currentStock < item.parLevel).length;

    return {
      totalSkus,
      totalValue,
      lowStockCount,
      outOfStockCount,
      belowParCount,
    };
  }, [inventoryItems]);

  const sortedInventoryItems = useMemo(
    () =>
      [...inventoryItems].sort((a, b) => {
        const statusOrder = { out: 0, low: 1, healthy: 2 };
        const statusCompare =
          statusOrder[getInventoryStatus(a)] - statusOrder[getInventoryStatus(b)];
        if (statusCompare !== 0) return statusCompare;
        return a.name.localeCompare(b.name);
      }),
    [inventoryItems]
  );

  const lowStockItems = useMemo(
    () =>
      sortedInventoryItems.filter((item) => {
        const status = getInventoryStatus(item);
        return status === 'out' || status === 'low';
      }),
    [sortedInventoryItems]
  );

  const recentInventoryTransactions = useMemo(
    () =>
      [...inventoryTransactions]
        .sort((a, b) => {
          if (a.date === b.date) return b.id.localeCompare(a.id);
          return b.date.localeCompare(a.date);
        })
        .slice(0, 30),
    [inventoryTransactions]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Expense Tracking & Inventory Management
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Track spend, control stock levels, and connect costs to real events.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50/70 p-4 text-sm dark:border-indigo-900 dark:bg-indigo-950/20">
        <p className="font-semibold text-indigo-900 dark:text-indigo-200">Recommended workflow</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-indigo-800 dark:text-indigo-300">
          <li>Load sample bookings from the Bookings page for realistic test volume.</li>
          <li>Record purchase receipts in Expense Tracking (event-linked when possible).</li>
          <li>Post stock movements in Inventory Management to keep on-hand counts accurate.</li>
        </ol>
        <Link
          href="/bookings"
          className="mt-3 inline-block rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Go to Bookings
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSection('expenses')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeSection === 'expenses'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
          }`}
        >
          Expense Tracking
        </button>
        <button
          onClick={() => setActiveSection('inventory')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeSection === 'inventory'
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
          }`}
        >
          Inventory Management
        </button>
      </div>

      {activeSection === 'expenses' && (
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
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">Total Expenses</h3>
              <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(expenseSummary.total)}
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                {expenseSummary.count} total records
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
              <h3 className="text-sm font-medium text-red-900 dark:text-red-200">Food Costs</h3>
              <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(expenseSummary.byCategory.food)}
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                {expenseSummary.total > 0
                  ? ((expenseSummary.byCategory.food / expenseSummary.total) * 100).toFixed(0)
                  : 0}
                % of total
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
              <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                Event-Linked
              </h3>
              <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {expenseSummary.linkedToEvents}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                {expenseSummary.generalExpenses} general expenses
              </p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-900 dark:bg-purple-950/20">
              <h3 className="text-sm font-medium text-purple-900 dark:text-purple-200">
                Avg per Expense
              </h3>
              <p className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(expenseSummary.count > 0 ? expenseSummary.total / expenseSummary.count : 0)}
              </p>
              <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">Across all categories</p>
            </div>
          </div>

          {showExpenseForm && (
            <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {editingExpenseId ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <form onSubmit={handleExpenseSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Date *</label>
                    <input
                      type="date"
                      value={expenseFormData.date}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                      required
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Category *</label>
                    <select
                      value={expenseFormData.category}
                      onChange={(e) =>
                        setExpenseFormData({
                          ...expenseFormData,
                          category: e.target.value as ExpenseCategory,
                        })
                      }
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
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Amount *</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-2 text-zinc-500">$</span>
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
                        className="w-full rounded-md border border-zinc-300 py-2 pl-7 pr-3 dark:border-zinc-700 dark:bg-zinc-800"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Link to Event (Optional)
                    </label>
                    <select
                      value={expenseFormData.bookingId}
                      onChange={(e) =>
                        setExpenseFormData({
                          ...expenseFormData,
                          bookingId: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
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
                    className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">All Expenses</h2>
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
                        ? bookings.find((booking) => booking.id === expense.bookingId)
                        : undefined;

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
                            <div className="font-medium">{expense.description}</div>
                            {expense.notes && (
                              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                {expense.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {linkedBooking ? (
                              <>
                                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                                  {linkedBooking.customerName}
                                </div>
                                <div className="text-xs">
                                  {format(parseLocalDate(linkedBooking.eventDate), 'MMM d')}
                                </div>
                              </>
                            ) : (
                              <span className="text-zinc-400">General</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {formatCurrency(expense.amount)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                            <button
                              onClick={() => handleEditExpense(expense)}
                              className="mr-3 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
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
                <p className="text-zinc-600 dark:text-zinc-400">No expenses recorded yet.</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Click Add Expense to start tracking costs.
                </p>
              </div>
            )}
          </div>

          {expenses.length > 0 && (
            <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Expenses by Category
              </h3>
              <div className="space-y-3">
                {Object.entries(expenseSummary.byCategory)
                  .filter(([, amount]) => amount > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, amount]) => (
                    <div key={category}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {categoryLabels[category as ExpenseCategory]}
                        </span>
                        <span className="text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(amount)} ({((amount / expenseSummary.total) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
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
      )}

      {activeSection === 'inventory' && (
        <>
          <div className="mb-6 flex flex-wrap justify-end gap-2">
            <button
              onClick={handleLoadSampleInventory}
              className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
            >
              Load Sample Inventory
            </button>
            <button
              onClick={() => {
                if (showMovementForm) resetMovementForm();
                setShowMovementForm((prev) => !prev);
              }}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {showMovementForm ? 'Cancel Movement' : 'Record Movement'}
            </button>
            <button
              onClick={() => {
                if (showInventoryForm) resetInventoryItemForm();
                setShowInventoryForm((prev) => !prev);
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showInventoryForm ? 'Cancel Item Form' : '+ Add Item'}
            </button>
          </div>

          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">Total SKUs</h3>
              <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                {inventorySummary.totalSkus}
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                Active inventory items
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
              <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                Inventory Value
              </h3>
              <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(inventorySummary.totalValue)}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                On-hand estimated value
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/20">
              <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200">Low Stock</h3>
              <p className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
                {inventorySummary.lowStockCount}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {inventorySummary.belowParCount} below par level
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
              <h3 className="text-sm font-medium text-red-900 dark:text-red-200">Out of Stock</h3>
              <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                {inventorySummary.outOfStockCount}
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">Need immediate action</p>
            </div>
          </div>

          {showInventoryForm && (
            <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {editingInventoryId ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h2>
              <form onSubmit={handleInventoryItemSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      value={inventoryItemFormData.name}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          name: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Category *
                    </label>
                    <select
                      value={inventoryItemFormData.category}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          category: e.target.value as InventoryCategory,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {Object.entries(inventoryCategoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Unit *</label>
                    <select
                      value={inventoryItemFormData.unit}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          unit: e.target.value as InventoryItem['unit'],
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {['lb', 'kg', 'oz', 'g', 'ea', 'case', 'bottle', 'tray'].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Current Stock *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={inventoryItemFormData.currentStock}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          currentStock: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Par Level *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={inventoryItemFormData.parLevel}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          parLevel: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Reorder Point *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={inventoryItemFormData.reorderPoint}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          reorderPoint: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Avg Unit Cost *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={inventoryItemFormData.avgUnitCost}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          avgUnitCost: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      required
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Vendor</label>
                    <input
                      type="text"
                      value={inventoryItemFormData.vendor}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          vendor: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="Preferred supplier (optional)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</label>
                  <textarea
                    rows={2}
                    value={inventoryItemFormData.notes}
                    onChange={(e) =>
                      setInventoryItemFormData({
                        ...inventoryItemFormData,
                        notes: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="Storage location, rotation notes, etc."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {editingInventoryId ? 'Update Item' : 'Add Item'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInventoryForm(false);
                      resetInventoryItemForm();
                    }}
                    className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {showMovementForm && (
            <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Record Inventory Movement
              </h2>
              <form onSubmit={handleMovementSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Date *</label>
                    <input
                      type="date"
                      value={movementFormData.date}
                      onChange={(e) =>
                        setMovementFormData({
                          ...movementFormData,
                          date: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Item *</label>
                    <select
                      value={movementFormData.itemId}
                      onChange={(e) =>
                        setMovementFormData({
                          ...movementFormData,
                          itemId: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      required
                    >
                      <option value="">Select item</option>
                      {sortedInventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.currentStock} {item.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Type *</label>
                    <select
                      value={movementFormData.type}
                      onChange={(e) =>
                        setMovementFormData({
                          ...movementFormData,
                          type: e.target.value as InventoryMovementType,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      <option value="restock">Restock (+)</option>
                      <option value="usage">Usage (-)</option>
                      <option value="adjustment">Adjustment (+/-)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={movementFormData.quantity}
                      onChange={(e) =>
                        setMovementFormData({
                          ...movementFormData,
                          quantity: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder={
                        movementFormData.type === 'adjustment'
                          ? 'Can be negative for corrections'
                          : 'Enter positive quantity'
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Unit Cost (restock)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={movementFormData.unitCost}
                      onChange={(e) =>
                        setMovementFormData({
                          ...movementFormData,
                          unitCost: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Related Event
                    </label>
                    <select
                      value={movementFormData.bookingId}
                      onChange={(e) =>
                        setMovementFormData({
                          ...movementFormData,
                          bookingId: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      <option value="">General stock movement</option>
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
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={movementFormData.notes}
                    onChange={(e) =>
                      setMovementFormData({
                        ...movementFormData,
                        notes: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="Reason for movement, wastage, transfer, etc."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Save Movement
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMovementForm(false);
                      resetMovementForm();
                    }}
                    className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {lowStockItems.length > 0 && (
            <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/20">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Low stock alerts ({lowStockItems.length})
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800 dark:text-amber-300">
                {lowStockItems.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    {item.name}: {item.currentStock} {item.unit} on hand (reorder at {item.reorderPoint}{' '}
                    {item.unit})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Inventory Catalog
              </h2>
            </div>
            {sortedInventoryItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Category
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        On Hand
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Reorder / Par
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Unit Cost
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Stock Value
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {sortedInventoryItems.map((item) => {
                      const status = getInventoryStatus(item);
                      const statusClass =
                        status === 'out'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                          : status === 'low'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300';

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                            <div className="font-medium">{item.name}</div>
                            {item.vendor && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                Vendor: {item.vendor}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                            {inventoryCategoryLabels[item.category]}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {item.currentStock} {item.unit}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-zinc-700 dark:text-zinc-300">
                            {item.reorderPoint} / {item.parLevel} {item.unit}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-zinc-700 dark:text-zinc-300">
                            {formatCurrency(item.avgUnitCost)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {formatCurrency(item.currentStock * item.avgUnitCost)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}>
                              {status === 'out' ? 'Out' : status === 'low' ? 'Low' : 'Healthy'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm">
                            <button
                              onClick={() => handleEditInventoryItem(item)}
                              className="mr-3 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteInventoryItem(item.id)}
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
                <p className="text-zinc-600 dark:text-zinc-400">No inventory items yet.</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Add your first item or use Load Sample Inventory to test flows.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Inventory Movement Log
              </h2>
            </div>
            {recentInventoryTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Type
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Qty
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Linked Event
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {recentInventoryTransactions.map((transaction) => {
                      const item = inventoryItems.find((entry) => entry.id === transaction.itemId);
                      const booking = transaction.bookingId
                        ? bookings.find((entry) => entry.id === transaction.bookingId)
                        : undefined;
                      const quantityClass =
                        transaction.quantity > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400';

                      return (
                        <tr
                          key={transaction.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                            {format(parseLocalDate(transaction.date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-50">
                            {item?.name || 'Unknown item'}
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                            {movementTypeLabels[transaction.type]}
                          </td>
                          <td className={`px-6 py-4 text-right text-sm font-semibold ${quantityClass}`}>
                            {transaction.quantity > 0 ? '+' : ''}
                            {transaction.quantity}
                            {item ? ` ${item.unit}` : ''}
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                            {booking ? booking.customerName : 'General'}
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {transaction.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No inventory movements recorded yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

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
import {
  calculatePrepPurchaseByDate,
  getBookingServiceStatus,
  normalizeBookingWorkflowFields,
} from '@/lib/bookingWorkflow';
import { loadShoppingListForBooking } from '@/lib/shoppingStorage';

const EXPENSES_KEY = 'expenses';
const BOOKINGS_KEY = 'bookings';
const INVENTORY_ITEMS_KEY = 'inventoryItems';
const INVENTORY_TRANSACTIONS_KEY = 'inventoryTransactions';
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const APPROX_EACH_PER_CASE = 100;
const APPROX_EACH_PER_TRAY = 50;

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

function diffLocalDays(targetDate: string, baseDate: string): number {
  return Math.round(
    (parseLocalDate(targetDate).getTime() - parseLocalDate(baseDate).getTime()) / MS_PER_DAY
  );
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
  other: 'bg-card-elevated text-text-primary',
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

interface PurchaseDemandTemplate {
  category: InventoryCategory;
  unit: 'lb' | 'bottle' | 'ea';
  privateDinnerPerGuest: number;
  buffetPerGuest: number;
  minimumPerEvent: number;
}

interface PurchaseNeedSummary {
  category: InventoryCategory;
  unit: 'lb' | 'bottle' | 'ea';
  requiredQty: number;
  onHandQty: number;
  shortfallQty: number;
  avgUnitCost: number;
  estimatedSpend: number;
}

const purchaseDemandTemplates: PurchaseDemandTemplate[] = [
  {
    category: 'protein',
    unit: 'lb',
    privateDinnerPerGuest: 0.55,
    buffetPerGuest: 0.45,
    minimumPerEvent: 8,
  },
  {
    category: 'produce',
    unit: 'lb',
    privateDinnerPerGuest: 0.28,
    buffetPerGuest: 0.24,
    minimumPerEvent: 4,
  },
  {
    category: 'dry-goods',
    unit: 'lb',
    privateDinnerPerGuest: 0.22,
    buffetPerGuest: 0.28,
    minimumPerEvent: 3,
  },
  {
    category: 'sauces',
    unit: 'bottle',
    privateDinnerPerGuest: 0.06,
    buffetPerGuest: 0.05,
    minimumPerEvent: 1,
  },
  {
    category: 'disposables',
    unit: 'ea',
    privateDinnerPerGuest: 1,
    buffetPerGuest: 1,
    minimumPerEvent: 12,
  },
];

function convertQuantityToTargetUnit(
  quantity: number,
  fromUnit: InventoryItem['unit'],
  targetUnit: PurchaseDemandTemplate['unit']
): number | null {
  if (targetUnit === 'lb') {
    if (fromUnit === 'lb') return quantity;
    if (fromUnit === 'kg') return quantity * 2.20462;
    if (fromUnit === 'oz') return quantity / 16;
    if (fromUnit === 'g') return quantity / 453.592;
    return null;
  }

  if (targetUnit === 'bottle') {
    return fromUnit === 'bottle' ? quantity : null;
  }

  if (fromUnit === 'ea') return quantity;
  if (fromUnit === 'case') return quantity * APPROX_EACH_PER_CASE;
  if (fromUnit === 'tray') return quantity * APPROX_EACH_PER_TRAY;
  return null;
}

function convertUnitCostToTargetUnit(
  unitCost: number,
  fromUnit: InventoryItem['unit'],
  targetUnit: PurchaseDemandTemplate['unit']
): number | null {
  if (targetUnit === 'lb') {
    if (fromUnit === 'lb') return unitCost;
    if (fromUnit === 'kg') return unitCost / 2.20462;
    if (fromUnit === 'oz') return unitCost * 16;
    if (fromUnit === 'g') return unitCost * 453.592;
    return null;
  }

  if (targetUnit === 'bottle') {
    return fromUnit === 'bottle' ? unitCost : null;
  }

  if (fromUnit === 'ea') return unitCost;
  if (fromUnit === 'case') return unitCost / APPROX_EACH_PER_CASE;
  if (fromUnit === 'tray') return unitCost / APPROX_EACH_PER_TRAY;
  return null;
}

export default function ExpensesPage() {
  const [activeSection, setActiveSection] = useState<'expenses' | 'inventory' | 'purchasing'>(
    'expenses'
  );
  const [expenses, setExpenses] = useState<Expense[]>(() => loadInitialList<Expense>(EXPENSES_KEY));
  const [bookings, setBookings] = useState<Booking[]>(loadInitialBookings);

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
    setBookings(
      safeParseList<Booking>(localStorage.getItem(BOOKINGS_KEY)).map((booking) =>
        normalizeBookingWorkflowFields(booking)
      )
    );
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

  const procurementEvents = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return bookings
      .map((booking) => normalizeBookingWorkflowFields(booking, today))
      .filter((booking) => {
        const serviceStatus = getBookingServiceStatus(booking);
        return serviceStatus !== 'pending' && serviceStatus !== 'cancelled';
      })
      .filter((booking) => diffLocalDays(booking.eventDate, today) >= 0)
      .map((booking) => {
        const purchaseByDate = booking.prepPurchaseByDate || calculatePrepPurchaseByDate(booking.eventDate);
        return {
          booking,
          purchaseByDate,
          daysUntilPurchase: diffLocalDays(purchaseByDate, today),
          daysUntilEvent: diffLocalDays(booking.eventDate, today),
        };
      })
      .sort((a, b) => {
        const byPurchaseDate = a.purchaseByDate.localeCompare(b.purchaseByDate);
        if (byPurchaseDate !== 0) return byPurchaseDate;
        const byEventDate = a.booking.eventDate.localeCompare(b.booking.eventDate);
        if (byEventDate !== 0) return byEventDate;
        return a.booking.eventTime.localeCompare(b.booking.eventTime);
      });
  }, [bookings]);

  const duePurchaseEvents = useMemo(
    () => procurementEvents.filter((event) => event.daysUntilPurchase <= 0),
    [procurementEvents]
  );

  const upcomingPurchaseEvents = useMemo(
    () =>
      procurementEvents.filter(
        (event) => event.daysUntilPurchase > 0 && event.daysUntilPurchase <= 7
      ),
    [procurementEvents]
  );

  const onHandByCategory = useMemo(() => {
    const map = new Map<string, { quantity: number; totalValue: number }>();

    inventoryItems.forEach((item) => {
      const template = purchaseDemandTemplates.find((entry) => entry.category === item.category);
      if (!template) return;

      const convertedQty = convertQuantityToTargetUnit(item.currentStock, item.unit, template.unit);
      const convertedUnitCost = convertUnitCostToTargetUnit(item.avgUnitCost, item.unit, template.unit);
      if (convertedQty === null || convertedUnitCost === null) return;

      const key = `${template.category}:${template.unit}`;
      const current = map.get(key) || { quantity: 0, totalValue: 0 };
      map.set(key, {
        quantity: current.quantity + convertedQty,
        totalValue: current.totalValue + convertedQty * convertedUnitCost,
      });
    });

    return map;
  }, [inventoryItems]);

  const duePurchaseNeeds = useMemo(() => {
    const requiredByCategory = new Map<string, number>();

    duePurchaseEvents.forEach(({ booking }) => {
      const guestCount = booking.adults + booking.children;
      purchaseDemandTemplates.forEach((template) => {
        const perGuest =
          booking.eventType === 'buffet'
            ? template.buffetPerGuest
            : template.privateDinnerPerGuest;
        const requiredRaw = Math.max(template.minimumPerEvent, guestCount * perGuest);
        const required =
          template.unit === 'lb' ? Math.round(requiredRaw * 100) / 100 : Math.ceil(requiredRaw);
        const key = `${template.category}:${template.unit}`;
        requiredByCategory.set(key, (requiredByCategory.get(key) || 0) + required);
      });
    });

    return purchaseDemandTemplates.map((template): PurchaseNeedSummary => {
      const key = `${template.category}:${template.unit}`;
      const requiredQty = Math.round((requiredByCategory.get(key) || 0) * 100) / 100;
      const onHandRecord = onHandByCategory.get(key);
      const onHandQty = Math.round(((onHandRecord?.quantity || 0) + Number.EPSILON) * 100) / 100;
      const avgUnitCost =
        onHandRecord && onHandRecord.quantity > 0
          ? onHandRecord.totalValue / onHandRecord.quantity
          : 0;
      const shortfallQty = Math.round(Math.max(0, requiredQty - onHandQty) * 100) / 100;
      const estimatedSpend = Math.round(shortfallQty * avgUnitCost * 100) / 100;

      return {
        category: template.category,
        unit: template.unit,
        requiredQty,
        onHandQty,
        shortfallQty,
        avgUnitCost,
        estimatedSpend,
      };
    });
  }, [duePurchaseEvents, onHandByCategory]);

  const purchasingSummary = useMemo(() => {
    const estimatedSpend = duePurchaseNeeds.reduce((sum, need) => sum + need.estimatedSpend, 0);
    const overdueCount = duePurchaseEvents.filter((event) => event.daysUntilPurchase < 0).length;
    const dueTodayCount = duePurchaseEvents.filter((event) => event.daysUntilPurchase === 0).length;
    const categoriesWithShortfall = duePurchaseNeeds.filter((need) => need.shortfallQty > 0).length;
    return {
      dueTodayCount,
      overdueCount,
      categoriesWithShortfall,
      estimatedSpend,
      totalDueEvents: duePurchaseEvents.length,
      upcomingCount: upcomingPurchaseEvents.length,
    };
  }, [duePurchaseNeeds, duePurchaseEvents, upcomingPurchaseEvents]);

  const handleCreatePurchaseDraftExpenses = () => {
    const shortfalls = duePurchaseNeeds.filter(
      (need) => need.shortfallQty > 0 && need.estimatedSpend > 0
    );
    if (shortfalls.length === 0) {
      alert('No shortfall spend to draft. Inventory on-hand currently covers due events.');
      return;
    }

    const shouldCreate = confirm(
      `Create ${shortfalls.length} draft expense entries from current T-2 shortfalls?`
    );
    if (!shouldCreate) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const eventContext = duePurchaseEvents
      .slice(0, 4)
      .map((event) => `${event.booking.customerName} (${event.booking.eventDate})`)
      .join(', ');

    const draftExpenses: Expense[] = shortfalls.map((need) => ({
      id: crypto.randomUUID(),
      date: today,
      category: need.category === 'disposables' ? 'supplies' : 'food',
      amount: need.estimatedSpend,
      description: `T-2 purchase plan: ${inventoryCategoryLabels[need.category]}`,
      notes: `Planner shortfall ${need.shortfallQty} ${need.unit}. Due events: ${eventContext || 'n/a'}.`,
    }));

    saveExpenses([...expenses, ...draftExpenses]);
    setActiveSection('expenses');
    alert(`Created ${draftExpenses.length} draft expense records in Expense Tracking.`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">
          Expense Tracking & Inventory Management
        </h1>
        <p className="mt-2 text-text-secondary">
          Track spend, control stock levels, and connect costs to real events.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSection('expenses')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeSection === 'expenses'
              ? 'bg-blue-600 text-white'
              : 'bg-card-elevated text-text-secondary hover:bg-card'
          }`}
        >
          Expense Tracking
        </button>
        <button
          onClick={() => setActiveSection('inventory')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeSection === 'inventory'
              ? 'bg-emerald-600 text-white'
              : 'bg-card-elevated text-text-secondary hover:bg-card'
          }`}
        >
          Inventory Management
        </button>
        <button
          onClick={() => setActiveSection('purchasing')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeSection === 'purchasing'
              ? 'bg-purple-600 text-white'
              : 'bg-card-elevated text-text-secondary hover:bg-card'
          }`}
        >
          Purchasing Planner (T-2)
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
            <div className="border-b border-border px-6 py-4 dark:border-border">
              <h2 className="text-lg font-semibold text-text-primary">All Expenses</h2>
            </div>
            {sortedExpenses.length > 0 ? (
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
                    {sortedExpenses.map((expense) => {
                      const linkedBooking = expense.bookingId
                        ? bookings.find((booking) => booking.id === expense.bookingId)
                        : undefined;

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
      )}

      {activeSection === 'purchasing' && (
        <>
          <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50/70 p-4 text-sm dark:border-purple-900 dark:bg-purple-950/20">
            <p className="font-semibold text-purple-900 dark:text-purple-200">
              T-2 purchasing planner
            </p>
            <p className="mt-1 text-purple-800 dark:text-purple-300">
              This planner estimates ingredient demand from confirmed bookings, targets purchasing at
              event date minus 2 days, and compares it to on-hand inventory.
            </p>
            <p className="mt-2 text-xs text-purple-700 dark:text-purple-400">
              Assumptions: weight unit conversions are automatic; case/tray-to-each conversions use
              defaults for planning only.
            </p>
          </div>

          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">Due Today</h3>
              <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                {purchasingSummary.dueTodayCount}
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                purchase windows opening now
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
              <h3 className="text-sm font-medium text-red-900 dark:text-red-200">Overdue Purchases</h3>
              <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                {purchasingSummary.overdueCount}
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">events at risk</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/20">
              <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Category Shortfalls
              </h3>
              <p className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
                {purchasingSummary.categoriesWithShortfall}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                of {duePurchaseNeeds.length} tracked categories
              </p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-900 dark:bg-purple-950/20">
              <h3 className="text-sm font-medium text-purple-900 dark:text-purple-200">
                Estimated Purchase Spend
              </h3>
              <p className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(purchasingSummary.estimatedSpend)}
              </p>
              <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                {purchasingSummary.totalDueEvents} due now / {purchasingSummary.upcomingCount} next 7
                days
              </p>
            </div>
          </div>

          <div className="mb-8 rounded-lg border border-border bg-card dark:border-border ">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4 dark:border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                Events in purchasing window
              </h2>
              <span className="text-xs text-text-muted">
                Sorted by purchase-by date (event date - 2 days)
              </span>
            </div>
            {procurementEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-card-elevated">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Event
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Service Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Purchase By
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        Guests
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        Event In
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {procurementEvents.map((event) => {
                      const purchaseStatusClass =
                        event.daysUntilPurchase < 0
                          ? 'text-red-700 dark:text-red-400'
                          : event.daysUntilPurchase === 0
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400';
                      return (
                        <tr key={event.booking.id} className="hover:bg-card-elevated">
                          <td className="px-6 py-4 text-sm text-text-primary">
                            <Link
                              href={`/bookings?bookingId=${event.booking.id}`}
                              className="font-medium text-accent hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              {event.booking.customerName}
                            </Link>
                            <div className="text-xs text-text-muted">
                              {format(parseLocalDate(event.booking.eventDate), 'MMM d, yyyy')} •{' '}
                              {event.booking.eventTime}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            {getBookingServiceStatus(event.booking)}
                          </td>
                          <td className={`px-6 py-4 text-sm font-medium ${purchaseStatusClass}`}>
                            {format(parseLocalDate(event.purchaseByDate), 'MMM d, yyyy')}
                            <div className="text-xs text-text-muted">
                              {event.daysUntilPurchase < 0
                                ? `${Math.abs(event.daysUntilPurchase)} day(s) overdue`
                                : event.daysUntilPurchase === 0
                                  ? 'Due today'
                                  : `in ${event.daysUntilPurchase} day(s)`}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-text-secondary">
                            {event.booking.adults + event.booking.children}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-text-secondary">
                            {event.daysUntilEvent === 0
                              ? 'Today'
                              : `${event.daysUntilEvent} day(s)`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-text-secondary">
                  No confirmed events in the purchasing window.
                </p>
                <p className="mt-2 text-sm text-text-muted">Confirm bookings to activate T-2 planning.</p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card dark:border-border ">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4 dark:border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                T-2 shortfall summary (due events)
              </h2>
              <button
                onClick={handleCreatePurchaseDraftExpenses}
                className="rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-950/20 dark:text-purple-300 dark:hover:bg-purple-950/40"
              >
                Create Draft Expenses
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-card-elevated">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                      Required
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                      On Hand
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                      Shortfall
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                      Avg Cost
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                      Est. Spend
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {duePurchaseNeeds.map((need) => (
                    <tr key={`${need.category}-${need.unit}`} className="hover:bg-card-elevated">
                      <td className="px-6 py-4 text-sm text-text-primary">
                        {inventoryCategoryLabels[need.category]}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-text-secondary">
                        {need.requiredQty.toFixed(2)} {need.unit}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-text-secondary">
                        {need.onHandQty.toFixed(2)} {need.unit}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-text-primary">
                        {need.shortfallQty.toFixed(2)} {need.unit}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-text-secondary">
                        {formatCurrency(need.avgUnitCost)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-text-primary">
                        {formatCurrency(need.estimatedSpend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
            <div className="mb-8 rounded-lg border border-border bg-card p-6 dark:border-border ">
              <h2 className="mb-4 text-xl font-semibold text-text-primary">
                {editingInventoryId ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h2>
              <form onSubmit={handleInventoryItemSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-text-secondary">
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
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
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
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                    >
                      {Object.entries(inventoryCategoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">Unit *</label>
                    <select
                      value={inventoryItemFormData.unit}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          unit: e.target.value as InventoryItem['unit'],
                        })
                      }
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                    >
                      {['lb', 'kg', 'oz', 'g', 'ea', 'case', 'bottle', 'tray'].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
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
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">Par Level *</label>
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
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
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
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
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
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                      required
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-text-secondary">Vendor</label>
                    <input
                      type="text"
                      value={inventoryItemFormData.vendor}
                      onChange={(e) =>
                        setInventoryItemFormData({
                          ...inventoryItemFormData,
                          vendor: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                      placeholder="Preferred supplier (optional)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">Notes</label>
                  <textarea
                    rows={2}
                    value={inventoryItemFormData.notes}
                    onChange={(e) =>
                      setInventoryItemFormData({
                        ...inventoryItemFormData,
                        notes: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
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
                    className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {showMovementForm && (
            <div className="mb-8 rounded-lg border border-border bg-card p-6 dark:border-border ">
              <h2 className="mb-4 text-xl font-semibold text-text-primary">
                Record Inventory Movement
              </h2>
              <form onSubmit={handleMovementSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">Date *</label>
                    <input
                      type="date"
                      value={movementFormData.date}
                      onChange={(e) =>
                        setMovementFormData({
                          ...movementFormData,
                          date: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">Item *</label>
                    <select
                      value={movementFormData.itemId}
                      onChange={(e) =>
                        setMovementFormData({
                          ...movementFormData,
                          itemId: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
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
                    <label className="block text-sm font-medium text-text-secondary">Type *</label>
                    <select
                      value={movementFormData.type}
                      onChange={(e) =>
                        setMovementFormData({
                          ...movementFormData,
                          type: e.target.value as InventoryMovementType,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                    >
                      <option value="restock">Restock (+)</option>
                      <option value="usage">Usage (-)</option>
                      <option value="adjustment">Adjustment (+/-)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
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
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                      placeholder={
                        movementFormData.type === 'adjustment'
                          ? 'Can be negative for corrections'
                          : 'Enter positive quantity'
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
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
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
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
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
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
                  <label className="block text-sm font-medium text-text-secondary">
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
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
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
                    className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card"
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

          <div className="rounded-lg border border-border bg-card dark:border-border ">
            <div className="border-b border-border px-6 py-4 dark:border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                Inventory Catalog
              </h2>
            </div>
            {sortedInventoryItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-card-elevated">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Category
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        On Hand
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        Reorder / Par
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        Unit Cost
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        Stock Value
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-text-muted">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
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
                          className="hover:bg-card-elevated"
                        >
                          <td className="px-6 py-4 text-sm text-text-primary">
                            <div className="font-medium">{item.name}</div>
                            {item.vendor && (
                              <div className="text-xs text-text-muted">
                                Vendor: {item.vendor}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            {inventoryCategoryLabels[item.category]}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-text-primary">
                            {item.currentStock} {item.unit}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-text-secondary">
                            {item.reorderPoint} / {item.parLevel} {item.unit}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-text-secondary">
                            {formatCurrency(item.avgUnitCost)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-text-primary">
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
                <p className="text-text-secondary">No inventory items yet.</p>
                <p className="mt-2 text-sm text-text-muted">
                  Add your first item or use Load Sample Inventory to test flows.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-lg border border-border bg-card dark:border-border ">
            <div className="border-b border-border px-6 py-4 dark:border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                Inventory Movement Log
              </h2>
            </div>
            {recentInventoryTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-card-elevated">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Type
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                        Qty
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Linked Event
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
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
                          className="hover:bg-card-elevated"
                        >
                          <td className="px-6 py-4 text-sm text-text-primary">
                            {format(parseLocalDate(transaction.date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-primary">
                            {item?.name || 'Unknown item'}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            {movementTypeLabels[transaction.type]}
                          </td>
                          <td className={`px-6 py-4 text-right text-sm font-semibold ${quantityClass}`}>
                            {transaction.quantity > 0 ? '+' : ''}
                            {transaction.quantity}
                            {item ? ` ${item.unit}` : ''}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            {booking ? booking.customerName : 'General'}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            {transaction.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-text-muted">
                No inventory movements recorded yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

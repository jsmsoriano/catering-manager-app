'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { Booking } from '@/lib/bookingTypes';
import type { Expense, ExpenseCategory } from '@/lib/expenseTypes';
import type { EventReconciliation, ActualLaborEntry } from '@/lib/reconciliationTypes';
import type { StaffMember as StaffRecord } from '@/lib/staffTypes';
import { CHEF_ROLE_TO_STAFF_ROLE } from '@/lib/staffTypes';
import type { ShoppingList } from '@/lib/shoppingTypes';
import { loadShoppingListForBooking } from '@/lib/shoppingStorage';
import { calculateShoppingListTotals } from '@/lib/shoppingUtils';

// Helper to parse date strings as local dates (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function ReconcilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-lg text-text-secondary">Loading reconciliation...</div>
        </div>
      }
    >
      <ReconcileContent />
    </Suspense>
  );
}

function ReconcileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rules = useMoneyRules();
  const bookingId = searchParams.get('bookingId');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [reconciliation, setReconciliation] = useState<EventReconciliation | null>(null);
  const [linkedExpenses, setLinkedExpenses] = useState<Expense[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Load booking, reconciliation, and expenses
  useEffect(() => {
    if (!bookingId) {
      router.push('/bookings');
      return;
    }

    // Load booking
    const bookingsData = localStorage.getItem('bookings');
    if (!bookingsData) {
      router.push('/bookings');
      return;
    }

    const bookings: Booking[] = JSON.parse(bookingsData);
    const foundBooking = bookings.find((b) => b.id === bookingId);
    if (!foundBooking) {
      router.push('/bookings');
      return;
    }
    setBooking(foundBooking);
    setShoppingList(loadShoppingListForBooking(foundBooking.id));

    // Load linked expenses
    const expensesData = localStorage.getItem('expenses');
    if (expensesData) {
      const allExpenses: Expense[] = JSON.parse(expensesData);
      setLinkedExpenses(allExpenses.filter((e) => e.bookingId === bookingId));
    }

    // Load existing reconciliation
    const reconciliationsData = localStorage.getItem('reconciliations');
    if (reconciliationsData && foundBooking.reconciliationId) {
      const allReconciliations: EventReconciliation[] = JSON.parse(reconciliationsData);
      const found = allReconciliations.find((r) => r.id === foundBooking.reconciliationId);
      if (found) {
        setReconciliation(found);
        return;
      }
    }

    // No existing reconciliation — will be initialized after financials are calculated
  }, [bookingId, router]);

  // Listen for expense updates
  useEffect(() => {
    const reloadExpenses = () => {
      const expensesData = localStorage.getItem('expenses');
      if (expensesData) {
        const allExpenses: Expense[] = JSON.parse(expensesData);
        setLinkedExpenses(allExpenses.filter((e) => e.bookingId === bookingId));
      }
    };

    window.addEventListener('storage', (e) => {
      if (e.key === 'expenses') reloadExpenses();
    });
    window.addEventListener('expensesUpdated', reloadExpenses);

    return () => {
      window.removeEventListener('expensesUpdated', reloadExpenses);
    };
  }, [bookingId]);

  // Listen for shopping list updates
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

  // Calculate estimated financials from the booking
  const bookingFinancials = useMemo(() => {
    if (!booking) return null;
    return calculateBookingFinancials(booking, rules);
  }, [booking, rules]);
  const financials = bookingFinancials?.financials ?? null;
  const pricingSource = bookingFinancials?.pricingSource ?? 'rules';
  const shoppingTotals = useMemo(() => calculateShoppingListTotals(shoppingList), [shoppingList]);
  const usingShoppingListFoodCost = Boolean(shoppingList);

  // Initialize reconciliation with estimated values when financials are ready
  useEffect(() => {
    if (!financials || !booking || reconciliation) return;

    // Load staff records to resolve names from assignments
    const staffById = new Map<string, StaffRecord>();
    const staffData = localStorage.getItem('staff');
    if (staffData) {
      try {
        const staffRecords: StaffRecord[] = JSON.parse(staffData);
        staffRecords.forEach((s) => staffById.set(s.id, s));
      } catch { /* ignore */ }
    }

    const laborEntries: ActualLaborEntry[] = financials.laborCompensation.map((comp, idx) => {
      let staffName: string | undefined;

      // Try to resolve staff name from booking assignments
      if (booking.staffAssignments) {
        const staffRole = CHEF_ROLE_TO_STAFF_ROLE[comp.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
        if (staffRole) {
          // Count same-role positions before this index
          let sameRoleIndex = 0;
          for (let i = 0; i < idx; i++) {
            if (financials.laborCompensation[i].role === comp.role) sameRoleIndex++;
          }
          let matchCount = 0;
          const assignment = booking.staffAssignments.find((a) => {
            if (a.role === staffRole) {
              if (matchCount === sameRoleIndex) return true;
              matchCount++;
            }
            return false;
          });
          if (assignment) {
            const staff = staffById.get(assignment.staffId);
            if (staff) staffName = staff.name;
          }
        }
      }

      return { role: comp.role, actualPay: comp.finalPay, staffName };
    });

    const now = new Date().toISOString();
    setReconciliation({
      id: `recon-${Date.now()}`,
      bookingId: booking.id,
      status: 'draft',
      actualAdults: booking.adults,
      actualChildren: booking.children,
      actualSubtotal: financials.subtotal,
      actualGratuity: financials.gratuity,
      actualDistanceFee: financials.distanceFee,
      actualTotal: financials.totalCharged,
      actualFoodCost: shoppingList ? shoppingTotals.foodTotal : financials.foodCost,
      foodCostSource: shoppingList ? 'shopping-list' : 'manual',
      foodCostSnapshot: shoppingList ? shoppingTotals.foodTotal : financials.foodCost,
      actualSuppliesCost: financials.suppliesCost,
      actualTransportationCost: financials.transportationCost,
      actualLaborEntries: laborEntries,
      actualTotalLaborPaid: financials.totalLaborPaid,
      notes: '',
      createdAt: now,
      updatedAt: now,
    });
  }, [financials, booking, reconciliation, shoppingList, shoppingTotals.foodTotal]);

  // Keep actual food cost aligned to shopping list totals whenever shopping list data changes
  useEffect(() => {
    if (!reconciliation || !shoppingList) return;
    if (reconciliation.status === 'finalized') return;

    const nextFoodCost = shoppingTotals.foodTotal;
    const alreadySynced =
      Math.abs((reconciliation.actualFoodCost ?? 0) - nextFoodCost) < 0.01 &&
      reconciliation.foodCostSource === 'shopping-list';

    if (alreadySynced) return;

    setReconciliation({
      ...reconciliation,
      actualFoodCost: nextFoodCost,
      foodCostSource: 'shopping-list',
      foodCostSnapshot: nextFoodCost,
      updatedAt: new Date().toISOString(),
    });
    setHasChanges(true);
  }, [reconciliation, shoppingList, shoppingTotals.foodTotal]);

  // Expense totals by category
  const expenseTotals = useMemo(() => {
    const totals: Record<ExpenseCategory, number> = {
      food: 0,
      'gas-mileage': 0,
      supplies: 0,
      equipment: 0,
      labor: 0,
      other: 0,
    };
    let total = 0;
    linkedExpenses.forEach((e) => {
      totals[e.category] += e.amount;
      total += e.amount;
    });
    return { byCategory: totals, total };
  }, [linkedExpenses]);

  // Computed actual profit from reconciliation data
  const actualProfit = useMemo(() => {
    if (!reconciliation) return null;

    const revenue = (reconciliation.actualSubtotal ?? 0) + (reconciliation.actualGratuity ?? 0);
    const costs =
      (reconciliation.actualFoodCost ?? 0) +
      (reconciliation.actualSuppliesCost ?? 0) +
      (reconciliation.actualTransportationCost ?? 0);
    const labor = reconciliation.actualTotalLaborPaid ?? 0;
    const grossProfit = revenue - costs - labor;

    const retainedPercent = rules.profitDistribution.businessRetainedPercent;
    const distributionPercent = rules.profitDistribution.ownerDistributionPercent;
    const retained = grossProfit * (retainedPercent / 100);
    const distribution = grossProfit * (distributionPercent / 100);
    const ownerA = distribution * (rules.profitDistribution.ownerAEquityPercent / 100);
    const ownerB = distribution * (rules.profitDistribution.ownerBEquityPercent / 100);

    return { grossProfit, retained, distribution, ownerA, ownerB };
  }, [reconciliation, rules]);

  // Update a reconciliation field
  const updateField = <K extends keyof EventReconciliation>(
    field: K,
    value: EventReconciliation[K]
  ) => {
    if (!reconciliation) return;
    setReconciliation({ ...reconciliation, [field]: value, updatedAt: new Date().toISOString() });
    setHasChanges(true);
  };

  // Update a labor entry
  const updateLaborEntry = (index: number, actualPay: number) => {
    if (!reconciliation?.actualLaborEntries) return;
    const updated = [...reconciliation.actualLaborEntries];
    updated[index] = { ...updated[index], actualPay };
    const totalLabor = updated.reduce((sum, e) => sum + e.actualPay, 0);
    setReconciliation({
      ...reconciliation,
      actualLaborEntries: updated,
      actualTotalLaborPaid: totalLabor,
      updatedAt: new Date().toISOString(),
    });
    setHasChanges(true);
  };

  // Recalculate actual total when revenue fields change
  const recalcActualTotal = (field: string, value: number) => {
    if (!reconciliation) return;
    const updated = { ...reconciliation, [field]: value, updatedAt: new Date().toISOString() };
    updated.actualTotal =
      (updated.actualSubtotal ?? 0) +
      (updated.actualGratuity ?? 0) +
      (updated.actualDistanceFee ?? 0);
    setReconciliation(updated);
    setHasChanges(true);
  };

  // Save as draft
  const handleSave = () => {
    if (!reconciliation || !booking) return;

    const resolvedFoodCost = shoppingList
      ? shoppingTotals.foodTotal
      : reconciliation.actualFoodCost ?? 0;
    const reconciliationToSave: EventReconciliation = {
      ...reconciliation,
      actualFoodCost: resolvedFoodCost,
      foodCostSource: shoppingList ? 'shopping-list' : 'manual',
      foodCostSnapshot: resolvedFoodCost,
      updatedAt: new Date().toISOString(),
    };

    const reconciliationsData = localStorage.getItem('reconciliations');
    const all: EventReconciliation[] = reconciliationsData ? JSON.parse(reconciliationsData) : [];
    const idx = all.findIndex((r) => r.id === reconciliationToSave.id);
    if (idx >= 0) {
      all[idx] = reconciliationToSave;
    } else {
      all.push(reconciliationToSave);
    }
    localStorage.setItem('reconciliations', JSON.stringify(all));
    window.dispatchEvent(new Event('reconciliationsUpdated'));
    setReconciliation(reconciliationToSave);

    // Update booking with reconciliationId if not already set
    if (!booking.reconciliationId) {
      const bookingsData = localStorage.getItem('bookings');
      if (bookingsData) {
        const bookings: Booking[] = JSON.parse(bookingsData);
        const updatedBookings = bookings.map((b) =>
          b.id === booking.id
            ? { ...b, reconciliationId: reconciliationToSave.id, updatedAt: new Date().toISOString() }
            : b
        );
        localStorage.setItem('bookings', JSON.stringify(updatedBookings));
        window.dispatchEvent(new Event('bookingsUpdated'));
        setBooking({ ...booking, reconciliationId: reconciliationToSave.id });
      }
    }

    setHasChanges(false);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  // Finalize reconciliation
  const handleFinalize = () => {
    if (!reconciliation) return;
    const now = new Date().toISOString();
    const resolvedFoodCost = shoppingList
      ? shoppingTotals.foodTotal
      : reconciliation.actualFoodCost ?? 0;

    const finalizedRecon: EventReconciliation = {
      ...reconciliation,
      actualFoodCost: resolvedFoodCost,
      foodCostSource: shoppingList ? 'shopping-list' : 'manual',
      foodCostSnapshot: resolvedFoodCost,
      status: 'finalized',
      reconciledAt: now,
      updatedAt: now,
    };

    setReconciliation(finalizedRecon);
    setHasChanges(true);

    // Save will be triggered after state update via the save button or we auto-save
    setTimeout(() => {
      const reconciliationsData = localStorage.getItem('reconciliations');
      const all: EventReconciliation[] = reconciliationsData ? JSON.parse(reconciliationsData) : [];
      const idx = all.findIndex((r) => r.id === finalizedRecon.id);
      if (idx >= 0) {
        all[idx] = finalizedRecon;
      } else {
        all.push(finalizedRecon);
      }
      localStorage.setItem('reconciliations', JSON.stringify(all));
      window.dispatchEvent(new Event('reconciliationsUpdated'));

      // Update booking
      if (booking) {
        const bookingsData = localStorage.getItem('bookings');
        if (bookingsData) {
          const bookings: Booking[] = JSON.parse(bookingsData);
          const updatedBookings = bookings.map((b) =>
            b.id === booking.id
              ? { ...b, reconciliationId: finalizedRecon.id, updatedAt: now }
              : b
          );
          localStorage.setItem('bookings', JSON.stringify(updatedBookings));
          window.dispatchEvent(new Event('bookingsUpdated'));
          setBooking({ ...booking, reconciliationId: finalizedRecon.id });
        }
      }

      setHasChanges(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    }, 0);
  };

  // Variance helper
  const variance = (estimated: number, actual: number) => actual - estimated;
  const varianceColor = (v: number, isRevenue: boolean) => {
    if (Math.abs(v) < 0.01) return 'text-text-muted';
    if (isRevenue) return v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    return v <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  };
  const formatVariance = (v: number) => {
    const sign = v >= 0 ? '+' : '';
    return `${sign}${formatCurrency(v)}`;
  };

  const handlePrint = () => {
    window.print();
  };

  if (!booking || !financials || !reconciliation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-text-secondary">Loading...</div>
      </div>
    );
  }

  const isFinalized = reconciliation.status === 'finalized';

  const roleLabels: Record<string, string> = {
    lead: 'Lead Chef',
    full: 'Full Chef',
    buffet: 'Buffet Chef',
    assistant: 'Assistant',
  };

  const categoryLabels: Record<ExpenseCategory, string> = {
    food: 'Food & Ingredients',
    'gas-mileage': 'Gas & Mileage',
    supplies: 'Supplies',
    equipment: 'Equipment',
    labor: 'Extra Labor',
    other: 'Other',
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header — hide on print */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              Event Reconciliation
            </h1>
            <p className="mt-1 text-text-secondary">
              Compare estimated vs actual financials for this event
            </p>
          </div>
          <div className="flex items-center gap-3">
            {showSaveSuccess && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Saved!
              </span>
            )}
            <button
              onClick={handlePrint}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Print
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                hasChanges
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-border'
              }`}
            >
              Save Draft
            </button>
            {!isFinalized && (
              <button
                onClick={handleFinalize}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Finalize
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="space-y-6 print:space-y-4">
        {/* Print Header — only visible when printing */}
        <div className="hidden border-b border-border pb-6 print:block">
          <div className="mb-4 flex justify-center">
            <Image
              src="/hibachisun.png"
              alt="Hibachi A Go Go"
              width={200}
              height={60}
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-center text-xl font-semibold text-text-secondary">
            Event Reconciliation Summary
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-text-secondary">
            <div><strong>Customer:</strong> {booking.customerName}</div>
            <div><strong>Event Date:</strong> {format(parseLocalDate(booking.eventDate), 'MMM d, yyyy')}</div>
            <div><strong>Event Type:</strong> {booking.eventType === 'private-dinner' ? 'Private Dinner' : 'Buffet'}</div>
            <div><strong>Location:</strong> {booking.location}</div>
            <div><strong>Status:</strong> {isFinalized ? 'Finalized' : 'Draft'}</div>
            <div><strong>Generated:</strong> {format(new Date(), 'PPP')}</div>
          </div>
        </div>

        {/* Event Info Bar */}
        <div className="rounded-lg border border-border bg-card p-4   print:border-0 print:p-0 print:hidden">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-lg font-semibold text-text-primary">
                {booking.customerName}
              </span>
            </div>
            <span className="text-text-muted">|</span>
            <span className="text-sm text-text-secondary">
              {format(parseLocalDate(booking.eventDate), 'MMM d, yyyy')} at {booking.eventTime}
            </span>
            <span className="text-text-muted">|</span>
            <span className="text-sm text-text-secondary">
              {booking.eventType === 'private-dinner' ? 'Private Dinner' : 'Buffet'}
            </span>
            <span className="text-text-muted">|</span>
            <span className="text-sm text-text-secondary">
              Pricing Source: {pricingSource === 'menu' ? 'Menu' : 'Rules'}
            </span>
            <span className="text-text-muted">|</span>
            <span className="text-sm text-text-secondary">
              {booking.location}
            </span>
            <div className="ml-auto">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isFinalized
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                }`}
              >
                {isFinalized ? 'Finalized' : 'Draft'}
              </span>
            </div>
          </div>
        </div>

        {/* Revenue Section */}
        <div className="rounded-lg border border-border bg-card p-6   print:border print:border-border print:shadow-none">
          <h2 className="mb-4 text-xl font-semibold text-text-primary">
            Revenue
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border ">
                  <th className="pb-2 text-left font-medium text-text-secondary">Line Item</th>
                  <th className="pb-2 text-right font-medium text-text-secondary">Estimated</th>
                  <th className="pb-2 text-right font-medium text-text-secondary">Actual</th>
                  <th className="pb-2 text-right font-medium text-text-secondary">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Subtotal */}
                <tr>
                  <td className="py-3 text-text-primary">
                    Subtotal
                    <span className="ml-2 text-xs text-text-muted">
                      ({financials.adultCount}A + {financials.childCount}C)
                    </span>
                  </td>
                  <td className="py-3 text-right text-text-secondary">{formatCurrency(financials.subtotal)}</td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={reconciliation.actualSubtotal ?? 0}
                      onChange={(e) => recalcActualTotal('actualSubtotal', parseFloat(e.target.value) || 0)}
                      disabled={isFinalized}
                      className="w-28 rounded border border-border px-2 py-1 text-right text-sm bg-card-elevated text-text-primary print:hidden"
                    />
                    <span className="hidden font-medium print:inline">{formatCurrency(reconciliation.actualSubtotal ?? 0)}</span>
                  </td>
                  <td className={`py-3 text-right font-medium ${varianceColor(variance(financials.subtotal, reconciliation.actualSubtotal ?? 0), true)}`}>
                    {formatVariance(variance(financials.subtotal, reconciliation.actualSubtotal ?? 0))}
                  </td>
                </tr>

                {/* Gratuity */}
                <tr>
                  <td className="py-3 text-text-primary">
                    Gratuity
                    <span className="ml-2 text-xs text-text-muted">({financials.gratuityPercent}%)</span>
                  </td>
                  <td className="py-3 text-right text-text-secondary">{formatCurrency(financials.gratuity)}</td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={reconciliation.actualGratuity ?? 0}
                      onChange={(e) => recalcActualTotal('actualGratuity', parseFloat(e.target.value) || 0)}
                      disabled={isFinalized}
                      className="w-28 rounded border border-border px-2 py-1 text-right text-sm bg-card-elevated text-text-primary print:hidden"
                    />
                    <span className="hidden font-medium print:inline">{formatCurrency(reconciliation.actualGratuity ?? 0)}</span>
                  </td>
                  <td className={`py-3 text-right font-medium ${varianceColor(variance(financials.gratuity, reconciliation.actualGratuity ?? 0), true)}`}>
                    {formatVariance(variance(financials.gratuity, reconciliation.actualGratuity ?? 0))}
                  </td>
                </tr>

                {/* Distance Fee */}
                <tr>
                  <td className="py-3 text-text-primary">Distance Fee</td>
                  <td className="py-3 text-right text-text-secondary">{formatCurrency(financials.distanceFee)}</td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={reconciliation.actualDistanceFee ?? 0}
                      onChange={(e) => recalcActualTotal('actualDistanceFee', parseFloat(e.target.value) || 0)}
                      disabled={isFinalized}
                      className="w-28 rounded border border-border px-2 py-1 text-right text-sm bg-card-elevated text-text-primary print:hidden"
                    />
                    <span className="hidden font-medium print:inline">{formatCurrency(reconciliation.actualDistanceFee ?? 0)}</span>
                  </td>
                  <td className={`py-3 text-right font-medium ${varianceColor(variance(financials.distanceFee, reconciliation.actualDistanceFee ?? 0), true)}`}>
                    {formatVariance(variance(financials.distanceFee, reconciliation.actualDistanceFee ?? 0))}
                  </td>
                </tr>

                {/* Total */}
                <tr className="border-t-2 border-border  font-semibold">
                  <td className="py-3 text-text-primary">Total Charged</td>
                  <td className="py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(financials.totalCharged)}</td>
                  <td className="py-3 text-right text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(reconciliation.actualTotal ?? 0)}
                  </td>
                  <td className={`py-3 text-right ${varianceColor(variance(financials.totalCharged, reconciliation.actualTotal ?? 0), true)}`}>
                    {formatVariance(variance(financials.totalCharged, reconciliation.actualTotal ?? 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Labor & Staffing Section */}
        <div className="rounded-lg border border-border bg-card p-6   print:border print:border-border print:shadow-none">
          <h2 className="mb-4 text-xl font-semibold text-text-primary">
            Labor & Staffing
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border ">
                  <th className="pb-2 text-left font-medium text-text-secondary">Staff Role</th>
                  <th className="pb-2 text-right font-medium text-text-secondary">Estimated</th>
                  <th className="pb-2 text-right font-medium text-text-secondary">Actual</th>
                  <th className="pb-2 text-right font-medium text-text-secondary">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {financials.laborCompensation.map((comp, idx) => {
                  const actualEntry = reconciliation.actualLaborEntries?.[idx];
                  const actualPay = actualEntry?.actualPay ?? 0;

                  return (
                    <tr key={idx}>
                      <td className="py-3 text-text-primary">
                        {roleLabels[comp.role] || comp.role}
                        {actualEntry?.staffName && (
                          <div className="text-xs text-text-muted dark:text-text-muted">
                            {actualEntry.staffName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right text-text-secondary">
                        {formatCurrency(comp.finalPay)}
                      </td>
                      <td className="py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={actualPay}
                          onChange={(e) => updateLaborEntry(idx, parseFloat(e.target.value) || 0)}
                          disabled={isFinalized}
                          className="w-28 rounded border border-border px-2 py-1 text-right text-sm bg-card-elevated text-text-primary print:hidden"
                        />
                        <span className="hidden font-medium print:inline">{formatCurrency(actualPay)}</span>
                      </td>
                      <td className={`py-3 text-right font-medium ${varianceColor(variance(comp.finalPay, actualPay), false)}`}>
                        {formatVariance(variance(comp.finalPay, actualPay))}
                      </td>
                    </tr>
                  );
                })}

                {/* Total Labor */}
                <tr className="border-t-2 border-border  font-semibold">
                  <td className="py-3 text-text-primary">Total Labor</td>
                  <td className="py-3 text-right text-orange-600 dark:text-orange-400">{formatCurrency(financials.totalLaborPaid)}</td>
                  <td className="py-3 text-right text-orange-600 dark:text-orange-400">
                    {formatCurrency(reconciliation.actualTotalLaborPaid ?? 0)}
                  </td>
                  <td className={`py-3 text-right ${varianceColor(variance(financials.totalLaborPaid, reconciliation.actualTotalLaborPaid ?? 0), false)}`}>
                    {formatVariance(variance(financials.totalLaborPaid, reconciliation.actualTotalLaborPaid ?? 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Operating Costs Section */}
        <div className="rounded-lg border border-border bg-card p-6   print:border print:border-border print:shadow-none">
          <h2 className="mb-4 text-xl font-semibold text-text-primary">
            Operating Costs
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border ">
                  <th className="pb-2 text-left font-medium text-text-secondary">Cost Item</th>
                  <th className="pb-2 text-right font-medium text-text-secondary">Estimated</th>
                  <th className="pb-2 text-right font-medium text-text-secondary">Actual</th>
                  <th className="pb-2 text-right font-medium text-text-secondary">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Food Cost */}
                <tr>
                  <td className="py-3 text-text-primary">
                    Food Cost
                    <span className="ml-2 text-xs text-text-muted">({financials.foodCostPercent}%)</span>
                    {usingShoppingListFoodCost && (
                      <div className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
                        Source: Shopping List ({formatCurrency(shoppingTotals.foodTotal)}) •{' '}
                        <Link
                          href={`/bookings/shopping?bookingId=${booking.id}`}
                          className="underline hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                          View list
                        </Link>
                      </div>
                    )}
                    {expenseTotals.byCategory.food > 0 && (
                      <div className="text-xs text-text-muted dark:text-text-muted">
                        from expenses: {formatCurrency(expenseTotals.byCategory.food)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-right text-text-secondary">{formatCurrency(financials.foodCost)}</td>
                  <td className="py-3 text-right">
                    {usingShoppingListFoodCost ? (
                      <span className="font-medium text-text-primary print:hidden">
                        {formatCurrency(shoppingTotals.foodTotal)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={reconciliation.actualFoodCost ?? 0}
                        onChange={(e) =>
                          updateField('actualFoodCost', parseFloat(e.target.value) || 0)
                        }
                        disabled={isFinalized}
                        className="w-28 rounded border border-border px-2 py-1 text-right text-sm bg-card-elevated text-text-primary print:hidden"
                      />
                    )}
                    <span className="hidden font-medium print:inline">{formatCurrency(reconciliation.actualFoodCost ?? 0)}</span>
                  </td>
                  <td className={`py-3 text-right font-medium ${varianceColor(variance(financials.foodCost, reconciliation.actualFoodCost ?? 0), false)}`}>
                    {formatVariance(variance(financials.foodCost, reconciliation.actualFoodCost ?? 0))}
                  </td>
                </tr>

                {/* Supplies */}
                <tr>
                  <td className="py-3 text-text-primary">
                    Supplies
                    {expenseTotals.byCategory.supplies > 0 && (
                      <div className="text-xs text-text-muted dark:text-text-muted">
                        from expenses: {formatCurrency(expenseTotals.byCategory.supplies)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-right text-text-secondary">{formatCurrency(financials.suppliesCost)}</td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={reconciliation.actualSuppliesCost ?? 0}
                      onChange={(e) => updateField('actualSuppliesCost', parseFloat(e.target.value) || 0)}
                      disabled={isFinalized}
                      className="w-28 rounded border border-border px-2 py-1 text-right text-sm bg-card-elevated text-text-primary print:hidden"
                    />
                    <span className="hidden font-medium print:inline">{formatCurrency(reconciliation.actualSuppliesCost ?? 0)}</span>
                  </td>
                  <td className={`py-3 text-right font-medium ${varianceColor(variance(financials.suppliesCost, reconciliation.actualSuppliesCost ?? 0), false)}`}>
                    {formatVariance(variance(financials.suppliesCost, reconciliation.actualSuppliesCost ?? 0))}
                  </td>
                </tr>

                {/* Transportation */}
                <tr>
                  <td className="py-3 text-text-primary">
                    Transportation
                    {expenseTotals.byCategory['gas-mileage'] > 0 && (
                      <div className="text-xs text-text-muted dark:text-text-muted">
                        from expenses: {formatCurrency(expenseTotals.byCategory['gas-mileage'])}
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-right text-text-secondary">{formatCurrency(financials.transportationCost)}</td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={reconciliation.actualTransportationCost ?? 0}
                      onChange={(e) => updateField('actualTransportationCost', parseFloat(e.target.value) || 0)}
                      disabled={isFinalized}
                      className="w-28 rounded border border-border px-2 py-1 text-right text-sm bg-card-elevated text-text-primary print:hidden"
                    />
                    <span className="hidden font-medium print:inline">{formatCurrency(reconciliation.actualTransportationCost ?? 0)}</span>
                  </td>
                  <td className={`py-3 text-right font-medium ${varianceColor(variance(financials.transportationCost, reconciliation.actualTransportationCost ?? 0), false)}`}>
                    {formatVariance(variance(financials.transportationCost, reconciliation.actualTransportationCost ?? 0))}
                  </td>
                </tr>

                {/* Total Costs */}
                <tr className="border-t-2 border-border  font-semibold">
                  <td className="py-3 text-text-primary">Total Costs</td>
                  <td className="py-3 text-right text-red-600 dark:text-red-400">{formatCurrency(financials.totalCosts)}</td>
                  <td className="py-3 text-right text-red-600 dark:text-red-400">
                    {formatCurrency(
                      (reconciliation.actualFoodCost ?? 0) +
                      (reconciliation.actualSuppliesCost ?? 0) +
                      (reconciliation.actualTransportationCost ?? 0)
                    )}
                  </td>
                  <td className={`py-3 text-right ${varianceColor(
                    variance(
                      financials.totalCosts,
                      (reconciliation.actualFoodCost ?? 0) +
                      (reconciliation.actualSuppliesCost ?? 0) +
                      (reconciliation.actualTransportationCost ?? 0)
                    ),
                    false
                  )}`}>
                    {formatVariance(
                      variance(
                        financials.totalCosts,
                        (reconciliation.actualFoodCost ?? 0) +
                        (reconciliation.actualSuppliesCost ?? 0) +
                        (reconciliation.actualTransportationCost ?? 0)
                      )
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Linked Expenses Section */}
        <div className="rounded-lg border border-border bg-card p-6   print:border print:border-border print:shadow-none">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary">
              Linked Expenses
            </h2>
            <div className="flex items-center gap-3 print:hidden">
              <Link
                href={`/bookings/shopping?bookingId=${booking.id}`}
                className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                🛒 Shopping List
              </Link>
              <Link
                href="/expenses"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                + Add Expense
              </Link>
            </div>
          </div>

          {linkedExpenses.length > 0 ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border ">
                    <th className="pb-2 text-left font-medium text-text-secondary">Date</th>
                    <th className="pb-2 text-left font-medium text-text-secondary">Category</th>
                    <th className="pb-2 text-left font-medium text-text-secondary">Description</th>
                    <th className="pb-2 text-right font-medium text-text-secondary">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {linkedExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="py-2 text-text-secondary">
                        {format(parseLocalDate(expense.date), 'MMM d, yyyy')}
                      </td>
                      <td className="py-2 text-text-secondary">
                        {categoryLabels[expense.category]}
                      </td>
                      <td className="py-2 text-text-primary">{expense.description}</td>
                      <td className="py-2 text-right font-medium text-text-primary">
                        {formatCurrency(expense.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-between border-t border-border pt-3 ">
                <span className="font-medium text-text-secondary">Total from expenses</span>
                <span className="font-semibold text-text-primary">{formatCurrency(expenseTotals.total)}</span>
              </div>
            </>
          ) : (
            <p className="py-4 text-center text-sm text-text-muted dark:text-text-muted">
              No expenses linked to this event. Use the Expenses page to add expenses and link them to this booking.
            </p>
          )}
        </div>

        {/* Profit Summary Section */}
        {actualProfit && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20 print:border print:border-border print:bg-card print:shadow-none">
            <h2 className="mb-4 text-xl font-semibold text-text-primary">
              Profit Summary
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-200 dark:border-emerald-800">
                    <th className="pb-2 text-left font-medium text-text-secondary"></th>
                    <th className="pb-2 text-right font-medium text-text-secondary">Estimated</th>
                    <th className="pb-2 text-right font-medium text-text-secondary">Actual</th>
                    <th className="pb-2 text-right font-medium text-text-secondary">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                  <tr className="font-semibold">
                    <td className="py-3 text-text-primary">Gross Profit</td>
                    <td className="py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(financials.grossProfit)}</td>
                    <td className="py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(actualProfit.grossProfit)}</td>
                    <td className={`py-3 text-right ${varianceColor(variance(financials.grossProfit, actualProfit.grossProfit), true)}`}>
                      {formatVariance(variance(financials.grossProfit, actualProfit.grossProfit))}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 text-text-secondary">Business Retained ({rules.profitDistribution.businessRetainedPercent}%)</td>
                    <td className="py-3 text-right text-text-secondary">{formatCurrency(financials.retainedAmount)}</td>
                    <td className="py-3 text-right text-text-secondary">{formatCurrency(actualProfit.retained)}</td>
                    <td className={`py-3 text-right ${varianceColor(variance(financials.retainedAmount, actualProfit.retained), true)}`}>
                      {formatVariance(variance(financials.retainedAmount, actualProfit.retained))}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pl-4 text-text-secondary">Owner A ({rules.profitDistribution.ownerAEquityPercent}%)</td>
                    <td className="py-3 text-right text-text-secondary">{formatCurrency(financials.ownerADistribution)}</td>
                    <td className="py-3 text-right text-text-secondary">{formatCurrency(actualProfit.ownerA)}</td>
                    <td className={`py-3 text-right text-sm ${varianceColor(variance(financials.ownerADistribution, actualProfit.ownerA), true)}`}>
                      {formatVariance(variance(financials.ownerADistribution, actualProfit.ownerA))}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pl-4 text-text-secondary">Owner B ({rules.profitDistribution.ownerBEquityPercent}%)</td>
                    <td className="py-3 text-right text-text-secondary">{formatCurrency(financials.ownerBDistribution)}</td>
                    <td className="py-3 text-right text-text-secondary">{formatCurrency(actualProfit.ownerB)}</td>
                    <td className={`py-3 text-right text-sm ${varianceColor(variance(financials.ownerBDistribution, actualProfit.ownerB), true)}`}>
                      {formatVariance(variance(financials.ownerBDistribution, actualProfit.ownerB))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="rounded-lg border border-border bg-card p-6   print:border print:border-border print:shadow-none">
          <h2 className="mb-4 text-xl font-semibold text-text-primary">
            Reconciliation Notes
          </h2>
          <textarea
            value={reconciliation.notes ?? ''}
            onChange={(e) => updateField('notes', e.target.value)}
            disabled={isFinalized}
            rows={3}
            placeholder="Add notes about this reconciliation..."
            className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary print:hidden"
          />
          {reconciliation.notes && (
            <p className="hidden whitespace-pre-wrap text-sm text-text-secondary print:block">{reconciliation.notes}</p>
          )}
          {!reconciliation.notes && (
            <p className="hidden text-sm text-text-muted print:block">No notes</p>
          )}
        </div>

        {/* Footer Actions — hide on print */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/bookings"
            className="text-sm text-text-muted hover:text-text-secondary"
          >
            ← Back to Bookings
          </Link>
          <div className="flex items-center gap-3">
            {showSaveSuccess && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Saved!
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                hasChanges
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-border'
              }`}
            >
              Save Draft
            </button>
            {!isFinalized && (
              <button
                onClick={handleFinalize}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Finalize Reconciliation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

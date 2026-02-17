'use client';

import { useState, useMemo, useCallback } from 'react';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { EventType, StaffPayOverride, ChefRole } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  lead: 'Lead Chef',
  overflow: 'Overflow Chef',
  full: 'Full Chef',
  buffet: 'Buffet Chef',
  assistant: 'Assistant',
};

export default function CalculatorPage() {
  const rules = useMoneyRules();

  // Form state
  const [eventType, setEventType] = useState<EventType>('private-dinner');
  const [adults, setAdults] = useState(15);
  const [children, setChildren] = useState(0);
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [premiumAddOn, setPremiumAddOn] = useState(0);

  // Staff pay override state
  const [useOverrides, setUseOverrides] = useState(false);
  const [overrides, setOverrides] = useState<StaffPayOverride[]>([]);

  // Build default overrides from current staffing plan when toggling on
  const buildDefaultOverrides = useCallback(() => {
    const tempFinancials = calculateEventFinancials(
      { adults, children, eventType, eventDate: new Date(), distanceMiles, premiumAddOn },
      rules
    );

    return tempFinancials.staffingPlan.staff.map((s) => ({
      role: s.role as ChefRole | 'assistant',
      basePayPercent: s.basePayPercent,
      gratuitySplitPercent:
        s.role === 'assistant'
          ? rules.privateLabor.assistantGratuitySplitPercent
          : eventType === 'buffet'
          ? 100 / tempFinancials.staffingPlan.staff.length
          : rules.privateLabor.chefGratuitySplitPercent / tempFinancials.staffingPlan.chefRoles.length,
      cap: s.cap,
    }));
  }, [adults, children, eventType, distanceMiles, premiumAddOn, rules]);

  // Calculate financials (with or without overrides)
  const financials = useMemo(() => {
    return calculateEventFinancials(
      {
        adults,
        children,
        eventType,
        eventDate: new Date(),
        distanceMiles,
        premiumAddOn,
        staffPayOverrides: useOverrides ? overrides : undefined,
      },
      rules
    );
  }, [adults, children, eventType, distanceMiles, premiumAddOn, rules, useOverrides, overrides]);

  // Update a single override field
  const updateOverride = (index: number, field: keyof StaffPayOverride, value: number | null) => {
    setOverrides((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Handle toggle
  const handleToggleOverrides = (enabled: boolean) => {
    setUseOverrides(enabled);
    if (enabled) {
      setOverrides(buildDefaultOverrides());
    }
  };

  // Recalculate overrides when event type or guest count changes while overrides are active
  const handleEventTypeChange = (newType: EventType) => {
    setEventType(newType);
    if (useOverrides) {
      // Rebuild overrides for new event type after state update
      setTimeout(() => {
        const tempFinancials = calculateEventFinancials(
          { adults, children, eventType: newType, eventDate: new Date(), distanceMiles, premiumAddOn },
          rules
        );
        setOverrides(
          tempFinancials.staffingPlan.staff.map((s) => ({
            role: s.role as ChefRole | 'assistant',
            basePayPercent: s.basePayPercent,
            gratuitySplitPercent:
              s.role === 'assistant'
                ? rules.privateLabor.assistantGratuitySplitPercent
                : newType === 'buffet'
                ? 100 / tempFinancials.staffingPlan.staff.length
                : rules.privateLabor.chefGratuitySplitPercent / tempFinancials.staffingPlan.chefRoles.length,
            cap: s.cap,
          }))
        );
      }, 0);
    }
  };

  const handleGuestChange = (newAdults: number, newChildren: number) => {
    setAdults(newAdults);
    setChildren(newChildren);
    if (useOverrides) {
      setTimeout(() => {
        const tempFinancials = calculateEventFinancials(
          { adults: newAdults, children: newChildren, eventType, eventDate: new Date(), distanceMiles, premiumAddOn },
          rules
        );
        // Only rebuild if staff count changed
        if (tempFinancials.staffingPlan.staff.length !== overrides.length) {
          setOverrides(
            tempFinancials.staffingPlan.staff.map((s) => ({
              role: s.role as ChefRole | 'assistant',
              basePayPercent: s.basePayPercent,
              gratuitySplitPercent:
                s.role === 'assistant'
                  ? rules.privateLabor.assistantGratuitySplitPercent
                  : eventType === 'buffet'
                  ? 100 / tempFinancials.staffingPlan.staff.length
                  : rules.privateLabor.chefGratuitySplitPercent / tempFinancials.staffingPlan.chefRoles.length,
              cap: s.cap,
            }))
          );
        }
      }, 0);
    }
  };

  // Calculate total gratuity split percentage for validation
  const totalGratuitySplit = useMemo(() => {
    if (!useOverrides) return 100;
    return overrides.reduce((sum, o) => sum + o.gratuitySplitPercent, 0);
  }, [useOverrides, overrides]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">
            Event Profitability Calculator
          </h1>
          <p className="mt-2 text-text-secondary">
            Calculate revenue, costs, labor, and profit for catering events
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Input Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 rounded-lg border border-border bg-card p-6 dark:border-border ">
              <h2 className="mb-6 text-xl font-semibold text-text-primary">
                Event Details
              </h2>

              <div className="space-y-6">
                {/* Event Type */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Event Type
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleEventTypeChange('private-dinner')}
                      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                        eventType === 'private-dinner'
                          ? 'bg-accent text-white'
                          : 'bg-card-elevated text-text-secondary hover:bg-card'
                      }`}
                    >
                      Private Dinner
                    </button>
                    <button
                      onClick={() => handleEventTypeChange('buffet')}
                      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                        eventType === 'buffet'
                          ? 'bg-accent text-white'
                          : 'bg-card-elevated text-text-secondary hover:bg-card'
                      }`}
                    >
                      Buffet
                    </button>
                  </div>
                </div>

                {/* Guest Count */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Adults
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={adults}
                    onChange={(e) => handleGuestChange(Math.max(1, parseInt(e.target.value) || 1), children)}
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Children (under 13)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={children}
                    onChange={(e) => handleGuestChange(adults, Math.max(0, parseInt(e.target.value) || 0))}
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    {rules.pricing.childDiscountPercent}% discount applied
                  </p>
                </div>

                {/* Premium Add-on */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Premium Add-on (per guest)
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2 text-text-muted">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={premiumAddOn}
                      onChange={(e) => setPremiumAddOn(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full rounded-md border border-border bg-card-elevated py-2 pl-7 pr-3 text-text-primary"
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    Suggested: ${rules.pricing.premiumAddOnMin} - ${rules.pricing.premiumAddOnMax}
                  </p>
                </div>

                {/* Distance */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Distance (miles)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={distanceMiles}
                    onChange={(e) => setDistanceMiles(Math.max(0, parseInt(e.target.value) || 0))}
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    First {rules.distance.freeDistanceMiles} miles free
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-6 lg:col-span-2">
            {/* Revenue Section */}
            <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
              <h2 className="mb-6 text-xl font-semibold text-text-primary">
                Revenue Breakdown
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-secondary">Guest Count</p>
                    <p className="text-lg font-semibold text-text-primary">
                      {financials.guestCount} ({financials.adultCount}A + {financials.childCount}C)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Base Price</p>
                    <p className="text-lg font-semibold text-text-primary">
                      {formatCurrency(financials.basePrice)}/guest
                    </p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border pt-4 dark:border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Subtotal</span>
                    <span className="font-medium text-text-primary">
                      {formatCurrency(financials.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">
                      Gratuity ({financials.gratuityPercent}%)
                    </span>
                    <span className="font-medium text-text-primary">
                      {formatCurrency(financials.gratuity)}
                    </span>
                  </div>
                  {financials.distanceFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Distance Fee</span>
                      <span className="font-medium text-text-primary">
                        {formatCurrency(financials.distanceFee)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between border-t-2 border-border pt-4 dark:border-border">
                  <span className="text-lg font-semibold text-text-primary">
                    Total Charged
                  </span>
                  <span className="text-2xl font-bold text-success">
                    {formatCurrency(financials.totalCharged)}
                  </span>
                </div>
              </div>
            </div>

            {/* Labor Section with Override Controls */}
            <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-text-primary">
                  Labor & Staffing
                </h2>
                <label className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">
                    {useOverrides ? 'Custom Pay' : 'Global Defaults'}
                  </span>
                  <button
                    onClick={() => handleToggleOverrides(!useOverrides)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      useOverrides ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                        useOverrides ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              </div>

              <div className="mb-4 rounded-lg bg-card-elevated p-4">
                <p className="text-sm text-text-secondary">
                  Required Staff: {financials.staffingPlan.totalStaffCount}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {financials.staffingPlan.chefRoles.length} chef(s)
                  {financials.staffingPlan.assistantNeeded && ' + 1 assistant'}
                </p>
                {useOverrides && (
                  <p className="mt-2 text-xs font-medium text-accent">
                    Event-level overrides active — adjust pay below
                  </p>
                )}
              </div>

              {/* Override Editor */}
              {useOverrides && overrides.length > 0 && (
                <div className="mb-6 rounded-lg border-2 border-border bg-accent-soft-bg p-4 ">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-primary">
                      Staff Pay Simulator
                    </h3>
                    <button
                      onClick={() => setOverrides(buildDefaultOverrides())}
                      className="text-xs text-accent hover:text-accent-hover"
                    >
                      Reset to Defaults
                    </button>
                  </div>

                  {/* Gratuity split validation */}
                  {Math.abs(totalGratuitySplit - 100) > 0.1 && (
                    <div className="mb-4 rounded-md bg-warning/20 px-3 py-2 text-xs font-medium text-warning">
                      Gratuity split totals {totalGratuitySplit.toFixed(1)}% (should be 100%)
                    </div>
                  )}

                  {/* Column headers */}
                  <div className="mb-2 grid grid-cols-[1fr_80px_80px_80px] gap-3 text-xs font-semibold text-text-muted">
                    <span>Role</span>
                    <span>Base %</span>
                    <span>Grat. %</span>
                    <span>Cap $</span>
                  </div>

                  <div className="space-y-2">
                    {overrides.map((override, idx) => (
                      <div
                        key={`${override.role}-${idx}`}
                        className="grid grid-cols-[1fr_80px_80px_80px] items-center gap-3"
                      >
                        <span className="text-sm font-medium text-text-primary">
                          {ROLE_LABELS[override.role] || override.role}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={override.basePayPercent}
                          onChange={(e) =>
                            updateOverride(idx, 'basePayPercent', parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded-md border border-border px-2 py-1.5 text-center text-sm text-text-primary border-border bg-card-elevated"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={override.gratuitySplitPercent}
                          onChange={(e) =>
                            updateOverride(idx, 'gratuitySplitPercent', parseFloat(e.target.value) || 0)
                          }
                          className="w-full rounded-md border border-border px-2 py-1.5 text-center text-sm text-text-primary border-border bg-card-elevated"
                        />
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={override.cap ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateOverride(idx, 'cap', val === 0 ? null : val);
                          }}
                          className="w-full rounded-md border border-border px-2 py-1.5 text-center text-sm text-text-primary border-border bg-card-elevated"
                          title="0 = no cap"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Totals row */}
                  <div className="mt-3 grid grid-cols-[1fr_80px_80px_80px] items-center gap-3 border-t border-border pt-2">
                    <span className="text-xs font-semibold text-text-secondary">
                      Totals
                    </span>
                    <span className="text-center text-xs font-semibold text-text-secondary">
                      {overrides.reduce((s, o) => s + o.basePayPercent, 0).toFixed(1)}%
                    </span>
                    <span
                      className={`text-center text-xs font-semibold ${
                        Math.abs(totalGratuitySplit - 100) > 0.1
                          ? 'text-warning'
                          : 'text-success'
                      }`}
                    >
                      {totalGratuitySplit.toFixed(1)}%
                    </span>
                    <span className="text-center text-xs text-text-muted">—</span>
                  </div>

                  <p className="mt-3 text-xs text-text-muted">
                    Base % = percentage of subtotal ({formatCurrency(financials.subtotal)}). Grat. % = share of gratuity pool ({formatCurrency(financials.gratuity)}). Cap 0 = no cap. Total revenue: {formatCurrency(financials.subtotal + financials.gratuity)}.
                  </p>
                </div>
              )}

              {/* Pay Results */}
              <div className="space-y-3">
                {financials.laborCompensation.map((comp, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-4 ${
                      useOverrides
                        ? 'border-border bg-accent-soft-bg'
                        : 'border-border bg-card-elevated'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">
                          {ROLE_LABELS[comp.role] || comp.role}
                        </span>
                        {useOverrides && (
                          <span className="rounded-full bg-accent-soft-bg px-2 py-0.5 text-[10px] font-semibold text-accent">
                            CUSTOM
                          </span>
                        )}
                      </div>
                      <span className="text-lg font-bold text-text-primary">
                        {formatCurrency(comp.finalPay)}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-text-secondary">
                      <div className="flex justify-between">
                        <span>
                          Base Pay ({useOverrides && overrides[idx] ? overrides[idx].basePayPercent : '—'}% of revenue):
                        </span>
                        <span>{formatCurrency(comp.basePay)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          Gratuity Share ({useOverrides && overrides[idx] ? overrides[idx].gratuitySplitPercent.toFixed(1) : '—'}%):
                        </span>
                        <span>{formatCurrency(comp.gratuityShare)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-1 mt-1 dark:border-border">
                        <span className="font-medium text-text-secondary">
                          % of Total Revenue:
                        </span>
                        <span className="font-medium text-text-secondary">
                          {((financials.subtotal + financials.gratuity) > 0
                            ? (comp.finalPay / (financials.subtotal + financials.gratuity)) * 100
                            : 0
                          ).toFixed(1)}%
                        </span>
                      </div>
                      {comp.wasCapped && (
                        <p className="mt-2 text-warning">
                          Capped at {formatCurrency(comp.cap!)} (excess: {formatCurrency(comp.excessToProfit)} to profit)
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-between border-t border-border pt-4 dark:border-border">
                <span className="font-semibold text-text-primary">
                  Total Labor Cost
                </span>
                <span className="text-lg font-bold text-warning">
                  {formatCurrency(financials.totalLaborPaid)}
                </span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                {financials.laborAsPercentOfRevenue.toFixed(1)}% of total revenue ({formatCurrency(financials.subtotal + financials.gratuity)})
              </p>
            </div>

            {/* Costs Section */}
            <div className="rounded-lg border border-border bg-card p-6 dark:border-border ">
              <h2 className="mb-6 text-xl font-semibold text-text-primary">
                Operating Costs
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">
                    Food Cost ({financials.foodCostPercent}%)
                  </span>
                  <span className="font-medium text-text-primary">
                    {formatCurrency(financials.foodCost)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Supplies</span>
                  <span className="font-medium text-text-primary">
                    {formatCurrency(financials.suppliesCost)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Transportation</span>
                  <span className="font-medium text-text-primary">
                    {formatCurrency(financials.transportationCost)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 dark:border-border">
                  <span className="font-semibold text-text-primary">Total Costs</span>
                  <span className="text-lg font-bold text-danger">
                    {formatCurrency(financials.totalCosts)}
                  </span>
                </div>
              </div>
            </div>

            {/* Profit Section */}
            <div className="rounded-lg border-2 border-border bg-card p-6">
              <h2 className="mb-6 text-xl font-semibold text-text-primary">
                Profit Distribution
              </h2>

              <div className="mb-6 rounded-lg bg-card-elevated p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-text-primary">
                    Gross Profit
                  </span>
                  <span className="text-3xl font-bold text-success">
                    {formatCurrency(financials.grossProfit)}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    Business Retained ({financials.retainedPercent}%)
                  </span>
                  <span className="font-semibold text-text-primary">
                    {formatCurrency(financials.retainedAmount)}
                  </span>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-sm font-medium text-text-secondary">
                    Owner Distribution ({financials.distributionPercent}%)
                  </p>
                  <div className="ml-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">
                        Owner A ({rules.profitDistribution.ownerAEquityPercent}%)
                      </span>
                      <span className="font-medium text-text-primary">
                        {formatCurrency(financials.ownerADistribution)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">
                        Owner B ({rules.profitDistribution.ownerBEquityPercent}%)
                      </span>
                      <span className="font-medium text-text-primary">
                        {formatCurrency(financials.ownerBDistribution)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {financials.warnings.length > 0 && (
              <div className="rounded-lg border-2 border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-text-primary">
                  Warnings
                </h2>
                <ul className="list-inside list-disc space-y-2 text-sm text-text-secondary">
                  {financials.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

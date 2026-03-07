'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { calculateEventFinancials, formatCurrency } from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { MoneyRules } from '@/lib/types';
import { useBookingsQuery } from '@/lib/hooks/useBookingsQuery';
import { useStaffQuery } from '@/lib/hooks/useStaffQuery';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentChefStaffId, bookingHasStaff } from '@/lib/chefIdentity';
import { loadRetainedEarningsTransactions } from '@/lib/financeStorage';
import type { RetainedEarningsTransaction } from '@/lib/financeTypes';
import type { EventReconciliation } from '@/lib/reconciliationTypes';
import { loadOverheadConfig, type OverheadConfig } from '@/lib/overheadStorage';


// ─── Chef / Event Breakdown Tab ───────────────────────────────────────────────

function fmtEventDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function parseEventDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function normalizedBarWidth(pct: number, totalPct: number): number {
  if (pct <= 0 || totalPct <= 0) return 0;
  return (pct / totalPct) * 100;
}

function loadReconciliationsFromStorage(): EventReconciliation[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('reconciliations');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as EventReconciliation[];
  } catch {
    return [];
  }
}

function ChefBreakdownTab({ rules, perEventExpense }: { rules: MoneyRules; perEventExpense: number }) {
  const { user } = useAuth();
  const { bookings, saveBooking } = useBookingsQuery();
  const { staff } = useStaffQuery();
  const [selectedId, setSelectedId] = useState<string>('');
  const [reconciliationDraftByBooking, setReconciliationDraftByBooking] = useState<Record<string, string>>({});
  const [actualCostDraftByBooking, setActualCostDraftByBooking] = useState<Record<string, { food: string; supplies: string }>>({});
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [reconciliationVersion, setReconciliationVersion] = useState(0);

  const chefStaffId = useMemo(() => getCurrentChefStaffId(user, staff), [user, staff]);
  const isChefUser = ((user?.app_metadata as { role?: string } | undefined)?.role ?? '') === 'chef';

  const eventOptions = useMemo(() => {
    let list = bookings.filter((b) => b.status !== 'cancelled');
    if (isChefUser) {
      if (!chefStaffId) return [];
      list = list.filter((b) => bookingHasStaff(b.staffAssignments, chefStaffId));
    }
    return list.sort((a, b) => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const now = todayStart.getTime();
      const aMs = parseEventDateLocal(a.eventDate).getTime();
      const bMs = parseEventDateLocal(b.eventDate).getTime();
      const aUp = aMs >= now;
      const bUp = bMs >= now;
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      return aUp ? aMs - bMs : bMs - aMs;
    });
  }, [bookings, chefStaffId, isChefUser]);

  const effectiveSelectedId = useMemo(() => {
    if (selectedId && eventOptions.some((b) => b.id === selectedId)) return selectedId;
    return eventOptions[0]?.id ?? '';
  }, [eventOptions, selectedId]);

  const selected = useMemo(
    () => eventOptions.find((b) => b.id === effectiveSelectedId) ?? null,
    [effectiveSelectedId, eventOptions]
  );
  const finalizedReconciliation = useMemo(() => {
    if (!selected) return null;
    void reconciliationVersion;
    const all = loadReconciliationsFromStorage();
    return (
      all.find((r) => r.id === selected.reconciliationId && r.status === 'finalized') ??
      all.find((r) => r.bookingId === selected.id && r.status === 'finalized') ??
      null
    );
  }, [selected, reconciliationVersion]);

  const fin = useMemo(() => {
    if (!selected) return null;
    return calculateEventFinancials(
      {
        adults: selected.adults,
        children: selected.children,
        eventType: selected.eventType,
        eventDate: parseEventDateLocal(selected.eventDate),
        distanceMiles: selected.distanceMiles,
        premiumAddOn: selected.premiumAddOn || 0,
      },
      rules
    );
  }, [selected, rules]);

  const isSecondaryEvent = (selected?.eventType ?? '') !== 'private-dinner';
  const CHEF_REV_PCT = isSecondaryEvent ? 15 : 20;
  const ASST_REV_PCT = isSecondaryEvent ? 15 : 10;
  const CHEF_GRAT_PCT = isSecondaryEvent ? 50 : 60;
  const ASST_GRAT_PCT = isSecondaryEvent ? 50 : 40;
  const CHEF_PROFIT_PCT = rules.profitDistribution.ownerAEquityPercent;
  const ASST_PROFIT_PCT = rules.profitDistribution.ownerBEquityPercent;

  const subtotal = fin?.subtotal ?? 0;
  const gratuity = fin?.gratuity ?? 0;
  const estimatedTotalCharged = subtotal + gratuity + (fin?.distanceFee ?? 0);
  const eventDate = selected ? parseEventDateLocal(selected.eventDate) : null;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isPastEvent = eventDate ? eventDate.getTime() < todayStart.getTime() : false;
  const currentDraftText = selected
    ? (reconciliationDraftByBooking[selected.id] ?? (finalizedReconciliation?.actualTotal !== undefined ? String(finalizedReconciliation.actualTotal) : ''))
    : '';
  const parsedDraftCollected = Number(currentDraftText);
  const hasDraftCollected =
    currentDraftText.trim() !== '' &&
    Number.isFinite(parsedDraftCollected) &&
    parsedDraftCollected >= 0;
  const effectiveTotalCollected = finalizedReconciliation
    ? (finalizedReconciliation.actualTotal ?? estimatedTotalCharged)
    : (isPastEvent && hasDraftCollected ? parsedDraftCollected : estimatedTotalCharged);
  const collectedDelta = effectiveTotalCollected - estimatedTotalCharged;
  const effectiveGratuity = Math.max(0, gratuity + collectedDelta);
  const isLockedViewOnly = Boolean(finalizedReconciliation || selected?.locked);
  const foodCostPct = isSecondaryEvent ? rules.costs.secondaryFoodCostPercent : rules.costs.primaryFoodCostPercent;
  const suppliesCostPct = rules.costs.suppliesCostPercent;
  const foodCostBudget = subtotal * foodCostPct / 100;
  const suppliesCostBudget = subtotal * suppliesCostPct / 100;

  // Actual cost overrides — entered in the reconciliation section for past events
  const currentCostDraft = selected ? (actualCostDraftByBooking[selected.id] ?? { food: '', supplies: '' }) : { food: '', supplies: '' };
  const parsedActualFood = Number(currentCostDraft.food);
  const hasActualFood = currentCostDraft.food.trim() !== '' && Number.isFinite(parsedActualFood) && parsedActualFood >= 0;
  const parsedActualSupplies = Number(currentCostDraft.supplies);
  const hasActualSupplies = currentCostDraft.supplies.trim() !== '' && Number.isFinite(parsedActualSupplies) && parsedActualSupplies >= 0;

  const effectiveFoodCost = finalizedReconciliation?.actualFoodCost !== undefined
    ? finalizedReconciliation.actualFoodCost
    : (isPastEvent && hasActualFood ? parsedActualFood : foodCostBudget);
  const effectiveSuppliesCost = finalizedReconciliation?.actualSuppliesCost !== undefined
    ? finalizedReconciliation.actualSuppliesCost
    : (isPastEvent && hasActualSupplies ? parsedActualSupplies : suppliesCostBudget);

  // Keep legacy names for display (budget) and use effective for calculations
  const foodCost = foodCostBudget;
  const suppliesCost = suppliesCostBudget;
  const totalCosts = effectiveFoodCost + effectiveSuppliesCost + perEventExpense;

  const chefBasePay = subtotal * CHEF_REV_PCT / 100;
  const asstBasePay = subtotal * ASST_REV_PCT / 100;
  const totalBaseLaborPay = chefBasePay + asstBasePay;

  const chefGratPay = effectiveGratuity * CHEF_GRAT_PCT / 100;
  const asstGratPay = effectiveGratuity * ASST_GRAT_PCT / 100;

  const grossProfit = subtotal - totalCosts - totalBaseLaborPay;

  // Sales tax reserve (from money rules) set aside before profit split
  const salesTaxReserveAmt = grossProfit > 0 ? grossProfit * (rules.pricing.salesTaxPercent / 100) : 0;
  const afterTaxProfit = Math.max(0, grossProfit - salesTaxReserveAmt);

  const retainedAmt = afterTaxProfit > 0 ? afterTaxProfit * (rules.profitDistribution.businessRetainedPercent / 100) : 0;
  const distributable = afterTaxProfit > 0 ? afterTaxProfit * (rules.profitDistribution.ownerDistributionPercent / 100) : 0;

  const ownerAAmount = distributable * CHEF_PROFIT_PCT / 100;
  const ownerBAmount = distributable * ASST_PROFIT_PCT / 100;

  const aSorianoTotal = chefBasePay + ownerAAmount + chefGratPay;
  const jSorianoTotal = asstBasePay + ownerBAmount + asstGratPay;
  const aSorianoPct = effectiveTotalCollected > 0 ? (aSorianoTotal / effectiveTotalCollected) * 100 : 0;
  const jSorianoPct = effectiveTotalCollected > 0 ? (jSorianoTotal / effectiveTotalCollected) * 100 : 0;

  const barLabor = subtotal > 0 ? (totalBaseLaborPay / subtotal) * 100 : 0;
  const barCosts = subtotal > 0 ? ((effectiveFoodCost + effectiveSuppliesCost) / subtotal) * 100 : 0;
  const barOverhead = subtotal > 0 ? (perEventExpense / subtotal) * 100 : 0;
  const barTaxReserve = subtotal > 0 ? (salesTaxReserveAmt / subtotal) * 100 : 0;
  const barRetained = subtotal > 0 ? (retainedAmt / subtotal) * 100 : 0;
  const barDistributable = subtotal > 0 ? (distributable / subtotal) * 100 : 0;
  const barTotalPct = barLabor + barCosts + barOverhead + barTaxReserve + barRetained + barDistributable;
  const handleFinalizeReconciliation = async () => {
    if (!selected || !isPastEvent || !hasDraftCollected || isLockedViewOnly) return;
    setReconciliationError(null);
    setIsFinalizing(true);
    try {
      const now = new Date().toISOString();
      const all = loadReconciliationsFromStorage();
      const existing = all.find((r) => r.id === selected.reconciliationId) ?? all.find((r) => r.bookingId === selected.id);
      const reconciled: EventReconciliation = {
        id: existing?.id ?? selected.reconciliationId ?? `recon-${selected.id}`,
        bookingId: selected.id,
        status: 'finalized',
        actualAdults: selected.adults,
        actualChildren: selected.children,
        actualSubtotal: subtotal,
        actualGratuity: effectiveGratuity,
        actualDistanceFee: fin?.distanceFee ?? 0,
        actualTotal: effectiveTotalCollected,
        actualFoodCost: effectiveFoodCost,
        actualSuppliesCost: effectiveSuppliesCost,
        actualTransportationCost: 0,
        actualTotalLaborPaid: totalBaseLaborPay + chefGratPay + asstGratPay,
        notes: existing?.notes ?? 'Finalized from Event Summary calculator reconciliation.',
        reconciledAt: now,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const idx = all.findIndex((r) => r.id === reconciled.id);
      if (idx >= 0) all[idx] = reconciled;
      else all.push(reconciled);
      localStorage.setItem('reconciliations', JSON.stringify(all));
      window.dispatchEvent(new Event('reconciliationsUpdated'));
      await saveBooking({
        ...selected,
        reconciliationId: reconciled.id,
        locked: true,
        updatedAt: now,
      });
      setReconciliationVersion((v) => v + 1);
    } catch {
      setReconciliationError('Could not finalize reconciliation. Please try again.');
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Event selector */}
      <div className="rounded-lg border border-border bg-card p-5">
        <label className="mb-2 block text-sm font-semibold text-text-secondary">Select Event</label>
        {eventOptions.length === 0 ? (
          <p className="text-sm text-text-muted">
            {isChefUser
              ? (chefStaffId
                  ? 'No events assigned to you yet. Events you work on will appear here.'
                  : 'Your chef account is not linked to a staff profile yet. Ask an admin to match your account email to a staff member.')
              : 'No events found. Create a booking first.'}
          </p>
        ) : (
          <select
            value={effectiveSelectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            {eventOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.customerName} — {fmtEventDate(b.eventDate)} — {b.adults + b.children} guests
              </option>
            ))}
          </select>
        )}
      </div>

      {fin && selected && (
        <>
          {/* ── Owner Cards ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-accent bg-accent/10 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">A Soriano</p>
              <p className="mb-2 text-xs text-text-muted">Lead Chef · Owner</p>
              <p className="text-2xl font-bold text-text-primary sm:text-3xl">{formatCurrency(aSorianoTotal)}</p>
              <p className="mb-3 text-base font-bold text-accent">{aSorianoPct.toFixed(1)}% of event</p>
                <div className="space-y-1.5 border-t border-accent/20 pt-3 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">{CHEF_REV_PCT}% of revenue</span>
                  <span className="font-medium text-blue-400">{formatCurrency(chefBasePay)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">{CHEF_GRAT_PCT}% of gratuity</span>
                  <span className="font-medium text-blue-300">{formatCurrency(chefGratPay)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">{CHEF_PROFIT_PCT}% of profit</span>
                  <span className="font-medium text-emerald-400">{formatCurrency(ownerAAmount)}</span>
                </div>
                {isLockedViewOnly && (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-success">Locked · View Only</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border-2 border-border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">J Soriano</p>
              <p className="mb-2 text-xs text-text-muted">Assistant Chef · Owner</p>
              <p className="text-2xl font-bold text-text-primary sm:text-3xl">{formatCurrency(jSorianoTotal)}</p>
              <p className="mb-3 text-base font-bold text-text-secondary">{jSorianoPct.toFixed(1)}% of event</p>
              <div className="space-y-1.5 border-t border-border pt-3 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">{ASST_REV_PCT}% of revenue</span>
                  <span className="font-medium text-blue-400">{formatCurrency(asstBasePay)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">{ASST_GRAT_PCT}% of gratuity</span>
                  <span className="font-medium text-blue-300">{formatCurrency(asstGratPay)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">{ASST_PROFIT_PCT}% of profit</span>
                  <span className="font-medium text-emerald-500">{formatCurrency(ownerBAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Where Every Dollar Goes ── */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold text-text-primary sm:text-base">Where Every Dollar Goes</h2>
            <p className="mb-4 text-xs text-text-muted">
              {fin.adultCount} adult{fin.adultCount !== 1 ? 's' : ''}{fin.childCount > 0 ? ` + ${fin.childCount} children` : ''} × {formatCurrency(fin.basePrice)} = {formatCurrency(subtotal)} revenue · gratuity separate
            </p>
            <div className="flex h-8 w-full overflow-hidden rounded-lg border border-border">
              {barLabor > 0.5 && <div className="bg-blue-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barLabor, barTotalPct)}%` }} />}
              {barCosts > 0.5 && <div className="bg-red-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barCosts, barTotalPct)}%` }} />}
              {barOverhead > 0.5 && <div className="bg-amber-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barOverhead, barTotalPct)}%` }} />}
              {barTaxReserve > 0.5 && <div className="bg-orange-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barTaxReserve, barTotalPct)}%` }} />}
              {barRetained > 0.5 && <div className="bg-violet-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barRetained, barTotalPct)}%` }} />}
              {barDistributable > 0.5 && <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barDistributable, barTotalPct)}%` }} />}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {[
                { color: 'bg-blue-500', label: 'Labor', pct: barLabor },
                { color: 'bg-red-500', label: 'Food & Supplies', pct: barCosts },
                { color: 'bg-amber-500', label: 'Overhead', pct: barOverhead },
                { color: 'bg-orange-500', label: 'Tax Reserve', pct: barTaxReserve },
                { color: 'bg-violet-500', label: 'Retained', pct: barRetained },
                { color: 'bg-emerald-500', label: 'Profit Share', pct: barDistributable },
              ].map(({ color, label, pct }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-sm ${color}`} />
                  <span className="text-[11px] text-text-secondary">
                    {label} <span className="font-medium text-text-primary">{pct.toFixed(1)}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Money Waterfall ── */}
          <div className="overflow-hidden rounded-lg border border-border bg-card text-sm">
            <div className="border-b border-border bg-card-elevated px-4 py-3">
              <p className="text-sm font-semibold text-text-primary sm:text-base">Money Waterfall</p>
            </div>

            {/* Revenue */}
            <div className="border-b border-border pb-1 pt-2">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Revenue</p>
              <div className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-text-secondary">
                  {fin.adultCount} adult{fin.adultCount !== 1 ? 's' : ''}{fin.childCount > 0 ? ` + ${fin.childCount} children` : ''} × {formatCurrency(fin.basePrice)}
                </span>
                <span className="tabular-nums text-text-primary">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                <span className="text-text-primary">Total Revenue</span>
                <span className="tabular-nums text-text-primary">{formatCurrency(subtotal)}</span>
              </div>
            </div>

            {/* Labor */}
            <div className="border-b border-border pb-1 pt-2">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Labor</p>
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">Lead Chef — {CHEF_REV_PCT}% of revenue</span>
                <span className="tabular-nums text-blue-400">−{formatCurrency(chefBasePay)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">Assistant — {ASST_REV_PCT}% of revenue</span>
                <span className="tabular-nums text-blue-400">−{formatCurrency(asstBasePay)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                <span className="text-text-primary">Total Labor</span>
                <span className="tabular-nums text-danger">−{formatCurrency(totalBaseLaborPay)}</span>
              </div>
            </div>

            {/* Costs */}
            <div className="border-b border-border pb-1 pt-2">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Costs</p>
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">
                  Food Cost ({foodCostPct}%)
                  {effectiveFoodCost !== foodCostBudget && (
                    <span className="ml-2 text-[11px] text-text-muted line-through">{formatCurrency(foodCostBudget)}</span>
                  )}
                </span>
                <span className="tabular-nums text-red-400">−{formatCurrency(effectiveFoodCost)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">
                  Supplies ({suppliesCostPct}%)
                  {effectiveSuppliesCost !== suppliesCostBudget && (
                    <span className="ml-2 text-[11px] text-text-muted line-through">{formatCurrency(suppliesCostBudget)}</span>
                  )}
                </span>
                <span className="tabular-nums text-red-400">−{formatCurrency(effectiveSuppliesCost)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">Overhead Allocation</span>
                <span className="tabular-nums text-red-400">−{formatCurrency(perEventExpense)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                <span className="text-text-primary">Total Costs</span>
                <span className="tabular-nums text-danger">−{formatCurrency(totalCosts)}</span>
              </div>
            </div>

            {/* Profit Distribution */}
            <div className="border-b border-border pb-1 pt-2">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Profit Distribution</p>
              <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                <span className="text-text-primary">Gross Profit</span>
                <span className={`tabular-nums ${grossProfit >= 0 ? 'text-emerald-400' : 'text-danger'}`}>{formatCurrency(grossProfit)}</span>
              </div>
              {salesTaxReserveAmt > 0 && (
                <>
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">Sales Tax Reserve ({rules.pricing.salesTaxPercent}%)</span>
                    <span className="tabular-nums text-orange-400">−{formatCurrency(salesTaxReserveAmt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                    <span className="text-text-primary">After-Tax Profit</span>
                    <span className={`tabular-nums ${afterTaxProfit >= 0 ? 'text-emerald-400' : 'text-danger'}`}>{formatCurrency(afterTaxProfit)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">Business Retained ({rules.profitDistribution.businessRetainedPercent}%)</span>
                <span className="tabular-nums text-violet-400">−{formatCurrency(retainedAmt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                <span className="text-text-primary">Profit Share Distribution ({rules.profitDistribution.ownerDistributionPercent}%)</span>
                <span className="tabular-nums text-success">{formatCurrency(distributable)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">A Soriano — {CHEF_PROFIT_PCT}% of profit</span>
                <span className="tabular-nums text-emerald-400">{formatCurrency(ownerAAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">J Soriano — {ASST_PROFIT_PCT}% of profit</span>
                <span className="tabular-nums text-emerald-500">{formatCurrency(ownerBAmount)}</span>
              </div>
            </div>

            {/* Gratuity — pass-through */}
            <div className="pb-1 pt-2">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Gratuity (pass-through)</p>
              <div className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-text-secondary">Estimated ({fin.gratuityPercent}% of revenue)</span>
                <span className="tabular-nums text-text-primary">{formatCurrency(gratuity)}</span>
              </div>
              {isPastEvent && (
                <div className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-text-secondary">Reconciled Gratuity</span>
                  <span className="tabular-nums text-text-primary">{formatCurrency(effectiveGratuity)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">Lead Chef — {CHEF_GRAT_PCT}%</span>
                <span className="tabular-nums text-blue-300">{formatCurrency(chefGratPay)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                <span className="text-text-secondary">Assistant — {ASST_GRAT_PCT}%</span>
                <span className="tabular-nums text-blue-300">{formatCurrency(asstGratPay)}</span>
              </div>
            </div>

          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold text-text-primary sm:text-base">Event Reconciliation</h2>
            {!isPastEvent ? (
              <p className="text-xs text-text-muted">Reconciliation is available after the event date passes.</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-text-muted">Enter actual total collected and actual costs. Any unused cost budget goes to profit.</p>

                {/* Actual cost overrides */}
                <div className="mb-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Actual Costs (optional)</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-muted">
                        <span>Food Cost</span>
                        <span>budget {formatCurrency(foodCostBudget)}</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={isLockedViewOnly && finalizedReconciliation?.actualFoodCost !== undefined ? finalizedReconciliation.actualFoodCost : currentCostDraft.food}
                          onChange={(e) => {
                            if (!selected) return;
                            setActualCostDraftByBooking((prev) => ({
                              ...prev,
                              [selected.id]: { ...prev[selected.id] ?? { food: '', supplies: '' }, food: e.target.value },
                            }));
                          }}
                          disabled={isLockedViewOnly}
                          placeholder={foodCostBudget.toFixed(2)}
                          className="w-full rounded-md border border-border bg-card-elevated pl-7 pr-3 py-2 text-sm font-medium text-text-primary focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </div>
                      {hasActualFood && !isLockedViewOnly && (
                        <p className={`mt-1 text-xs font-medium ${parsedActualFood < foodCostBudget ? 'text-emerald-400' : 'text-danger'}`}>
                          {parsedActualFood < foodCostBudget
                            ? `+${formatCurrency(foodCostBudget - parsedActualFood)} saved → profit`
                            : `${formatCurrency(parsedActualFood - foodCostBudget)} over budget`}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-muted">
                        <span>Supplies</span>
                        <span>budget {formatCurrency(suppliesCostBudget)}</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={isLockedViewOnly && finalizedReconciliation?.actualSuppliesCost !== undefined ? finalizedReconciliation.actualSuppliesCost : currentCostDraft.supplies}
                          onChange={(e) => {
                            if (!selected) return;
                            setActualCostDraftByBooking((prev) => ({
                              ...prev,
                              [selected.id]: { ...prev[selected.id] ?? { food: '', supplies: '' }, supplies: e.target.value },
                            }));
                          }}
                          disabled={isLockedViewOnly}
                          placeholder={suppliesCostBudget.toFixed(2)}
                          className="w-full rounded-md border border-border bg-card-elevated pl-7 pr-3 py-2 text-sm font-medium text-text-primary focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </div>
                      {hasActualSupplies && !isLockedViewOnly && (
                        <p className={`mt-1 text-xs font-medium ${parsedActualSupplies < suppliesCostBudget ? 'text-emerald-400' : 'text-danger'}`}>
                          {parsedActualSupplies < suppliesCostBudget
                            ? `+${formatCurrency(suppliesCostBudget - parsedActualSupplies)} saved → profit`
                            : `${formatCurrency(parsedActualSupplies - suppliesCostBudget)} over budget`}
                        </p>
                      )}
                    </div>
                  </div>
                  {(hasActualFood || hasActualSupplies) && !isLockedViewOnly && (() => {
                    const savings = (foodCostBudget - effectiveFoodCost) + (suppliesCostBudget - effectiveSuppliesCost);
                    return savings !== 0 ? (
                      <div className="rounded-md border border-border bg-card-elevated px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary">Total cost savings → profit</span>
                          <span className={`font-semibold tabular-nums ${savings >= 0 ? 'text-emerald-400' : 'text-danger'}`}>
                            {savings >= 0 ? '+' : '−'}{formatCurrency(Math.abs(savings))}
                          </span>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border bg-card-elevated px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-text-muted">Estimated Total</p>
                    <p className="text-lg font-semibold text-text-primary">{formatCurrency(estimatedTotalCharged)}</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Actual Total Collected</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentDraftText}
                        onChange={(e) => {
                          if (!selected) return;
                          setReconciliationDraftByBooking((prev) => ({ ...prev, [selected.id]: e.target.value }));
                        }}
                        disabled={isLockedViewOnly}
                        placeholder={estimatedTotalCharged.toFixed(2)}
                        className="w-full rounded-md border border-border bg-card-elevated pl-7 pr-3 py-2 text-center text-lg font-bold text-text-primary focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-md border border-border bg-card-elevated px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-text-secondary">Difference vs Estimate</span>
                    <span className={`font-semibold tabular-nums ${collectedDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                      {collectedDelta >= 0 ? '+' : '−'}{formatCurrency(Math.abs(collectedDelta))}
                    </span>
                  </div>
                </div>
                {isLockedViewOnly ? (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-success">Reconciled and locked. This event is view-only.</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalizeReconciliation}
                    disabled={!hasDraftCollected || isFinalizing}
                    className="mt-3 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isFinalizing ? 'Finalizing...' : 'Finalize Reconciliation & Lock Event'}
                  </button>
                )}
                {reconciliationError && <p className="mt-2 text-xs text-danger">{reconciliationError}</p>}
              </>
            )}
          </div>

        </>
      )}
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-accent">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-text-secondary">{children}</div>
    </div>
  );
}

// ─── Business Info Tab ────────────────────────────────────────────────────────

function BusinessInfoTab() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">

      {/* Header */}
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Operating Summary</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Hibachi Sun</h1>
        <p className="mt-1 text-sm text-text-muted">Private Dining & Catering — Owner Agreement Reference</p>
        <p className="mt-3 text-xs text-text-muted">This section summarizes the business structure, roles, responsibilities, and profit-sharing model agreed upon by the founding partners. It serves as an operating reference for day-to-day decisions.</p>
      </div>

      {/* Business Structure */}
      <InfoSection title="Business Structure">
        <p>Hibachi Sun operates as a partnership between two founding owner-operators. Both partners are actively involved in every event and share operational, financial, and client responsibilities proportional to their roles.</p>
        <p>The business provides private hibachi dining and catering services. Revenue is generated per event and distributed according to the model described below. There are no silent investors — all profit is earned through active participation.</p>
      </InfoSection>

      {/* Roles */}
      <InfoSection title="Roles & Responsibilities">
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-card-elevated p-4">
            <p className="mb-1 font-semibold text-text-primary">A Soriano — Lead Chef</p>
            <ul className="list-disc space-y-1 pl-4 text-text-secondary">
              <li>Primary chef responsible for all cooking and food execution at events</li>
              <li>Manages client relationships, event logistics, and menu customization</li>
              <li>Oversees setup, breakdown, and food safety compliance</li>
              <li>Handles all client-facing communication before and during events</li>
              <li>Responsible for ingredient sourcing, quality control, and recipe standards</li>
              <li>Leads business development, marketing, and pricing decisions</li>
            </ul>
          </div>
          <div className="rounded-md border border-border bg-card-elevated p-4">
            <p className="mb-1 font-semibold text-text-primary">J Soriano — Assistant Chef</p>
            <ul className="list-disc space-y-1 pl-4 text-text-secondary">
              <li>Supports the lead chef in all food preparation and execution</li>
              <li>Manages equipment setup, transport, and breakdown at each event</li>
              <li>Handles guest service, plating coordination, and table interaction</li>
              <li>Responsible for supply inventory management and reorder tracking</li>
              <li>Assists with administrative tasks, scheduling, and booking coordination</li>
              <li>Co-owner with shared responsibility for business decisions</li>
            </ul>
          </div>
        </div>
      </InfoSection>

      {/* Revenue Model */}
      <InfoSection title="Revenue Sharing Model">
        <p className="text-xs text-text-muted">Child pricing policy: children are billed at 50% of the adult per-guest price.</p>
        <p className="font-medium text-text-primary">Hibachi Dinner Events</p>
        <div className="mt-2 rounded-md border border-border bg-card-elevated">
          {[
            ['Lead Chef base pay', '20% of event subtotal'],
            ['Assistant base pay', '10% of event subtotal'],
            ['Total labor allocation', '30% of event subtotal'],
            ['Lead Chef gratuity', '60% of gratuity collected'],
            ['Assistant gratuity', '40% of gratuity collected'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-border px-4 py-2.5 last:border-b-0">
              <span className="text-text-secondary">{label}</span>
              <span className="font-medium text-text-primary">{value}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 font-medium text-text-primary">Hibachi Buffet Events</p>
        <div className="mt-2 rounded-md border border-border bg-card-elevated">
          {[
            ['Lead Chef base pay', '15% of event subtotal'],
            ['Assistant base pay', '15% of event subtotal'],
            ['Total labor allocation', '30% of event subtotal'],
            ['Lead Chef gratuity', '50% of gratuity collected'],
            ['Assistant gratuity', '50% of gratuity collected'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-border px-4 py-2.5 last:border-b-0">
              <span className="text-text-secondary">{label}</span>
              <span className="font-medium text-text-primary">{value}</span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-text-muted">Gratuity is treated as a pass-through — collected from clients, paid directly to staff, and is not included in gross profit calculations.</p>
      </InfoSection>

      {/* Reconciliation */}
      <InfoSection title="Event Reconciliation">
        <p>Reconciliation is completed after the event date passes, using the final amount actually collected.</p>
        <div className="mt-2 rounded-md border border-border bg-card-elevated">
          {[
            ['Actual total collected', 'Entered after event completion'],
            ['Amount above estimate', 'Treated as extra gratuity and split by gratuity percentages'],
            ['Amount below estimate', 'Treated as gratuity shortfall'],
            ['Finalize reconciliation', 'Locks the event record and makes it view-only'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-border px-4 py-2.5 last:border-b-0">
              <span className="text-text-secondary">{label}</span>
              <span className="font-medium text-text-primary">{value}</span>
            </div>
          ))}
        </div>
      </InfoSection>

      {/* Cost Allocation */}
      <InfoSection title="Cost Allocation">
        <p>After labor is paid, the remaining subtotal covers operational costs before profit is calculated:</p>
        <div className="mt-2 rounded-md border border-border bg-card-elevated">
          {[
            ['Food & ingredients', '30% of subtotal'],
            ['Supplies & consumables', '5% of subtotal'],
            ['Gross profit', '35% of subtotal (remaining after labor + costs)'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-border px-4 py-2.5 last:border-b-0">
              <span className="text-text-secondary">{label}</span>
              <span className="font-medium text-text-primary">{value}</span>
            </div>
          ))}
        </div>
      </InfoSection>

      {/* Profit Distribution */}
      <InfoSection title="Profit Distribution">
        <p>Gross profit (after labor and costs) is split between business reserves and partner distributions:</p>
        <div className="mt-2 rounded-md border border-border bg-card-elevated">
          {[
            ['Business retained', '30% of gross profit — working capital & reinvestment'],
            ['Profit Share Distribution pool', '70% of gross profit — paid to partners monthly'],
            ['A Soriano share', '40% of distributable pool'],
            ['J Soriano share', '60% of distributable pool'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-border px-4 py-2.5 last:border-b-0">
              <span className="text-text-secondary">{label}</span>
              <span className="font-medium text-text-primary">{value}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-muted">Profit distributions are paid on the 10th of each month from the pool accumulated across all events in the prior month. Business retained earnings remain in the operating account for equipment, marketing, and contingency.</p>
      </InfoSection>

      {/* Payment Schedule */}
      <InfoSection title="Payment Schedule">
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[10px] font-bold text-blue-400">1</span>
            <div><span className="font-medium text-text-primary">Per-event, same day</span><br />Base pay (revenue %) and gratuity shares are paid immediately after each event.</div>
          </div>
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">2</span>
            <div><span className="font-medium text-text-primary">Monthly, on the 10th</span><br />Profit distributions from the prior month&apos;s events are calculated and paid to each partner.</div>
          </div>
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-400">3</span>
            <div><span className="font-medium text-text-primary">Retained earnings</span><br />Business reserves accumulate in the operating account and are available for reinvestment by mutual partner agreement.</div>
          </div>
        </div>
      </InfoSection>

    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'calculator', label: 'Calculator' },
  { id: 'chef',       label: 'Event Summary' },
  { id: 'info',       label: 'Business Info' },
] as const;
type TabId = typeof TABS[number]['id'];

export default function CalculatorPage() {
  const rules = useMoneyRules();
  const [activeTab, setActiveTab] = useState<TabId>('calculator');
  const touchStartX = useRef(0);
  const tabIdx = TABS.findIndex((t) => t.id === activeTab);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 60 && tabIdx < TABS.length - 1) setActiveTab(TABS[tabIdx + 1].id);
    if (delta < -60 && tabIdx > 0) setActiveTab(TABS[tabIdx - 1].id);
  };

  // Overhead config — loaded from Business Rules storage
  const [overhead, setOverhead] = useState<OverheadConfig>(loadOverheadConfig);
  useEffect(() => {
    const load = () => setOverhead(loadOverheadConfig());
    window.addEventListener('overheadConfigUpdated', load);
    window.addEventListener('storage', (e) => { if (e.key === 'overhead_config') load(); });
    return () => window.removeEventListener('overheadConfigUpdated', load);
  }, []);

  const salesTaxPct = rules.pricing.salesTaxPercent;
  const seTaxPct = overhead.seTaxPct;
  const incomeTaxPct = overhead.incomeTaxPct;
  const eventsPerMonth = overhead.eventsPerMonth;
  const totalMonthlyExpenses = overhead.expenses.reduce((sum, e) => {
    return sum + (e.frequency === 'annual' ? (e.amount || 0) / 12 : (e.amount || 0));
  }, 0);
  const perEventExpense = eventsPerMonth > 0 ? totalMonthlyExpenses / eventsPerMonth : 0;

  const [retainedTransactions, setRetainedTransactions] = useState<RetainedEarningsTransaction[]>([]);

  const retainedEarningsBalance = useMemo(
    () => retainedTransactions.reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0),
    [retainedTransactions]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = () => setRetainedTransactions(loadRetainedEarningsTransactions());
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === 'retainedEarningsTransactions') load(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('retainedEarningsUpdated', load);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('retainedEarningsUpdated', load);
    };
  }, []);

  // Inputs
  const [calcEventType, setCalcEventType] = useState<'dinner' | 'buffet'>('dinner');
  const [adultGuests, setAdultGuests] = useState(15);
  const [adultGuestText, setAdultGuestText] = useState('15');
  const [kids, setKids] = useState(0);
  const [kidsText, setKidsText] = useState('0');
  const [pricePerGuest, setPricePerGuest] = useState(60);
  const [priceText, setPriceText] = useState('60');
  const [gratuityPct, setGratuityPct] = useState(20);
  const [actualCollectedText, setActualCollectedText] = useState('');
  const [calcActualFoodText, setCalcActualFoodText] = useState('');
  const [calcActualSuppliesText, setCalcActualSuppliesText] = useState('');

  // Live calculations
  const childPricePerGuest = pricePerGuest * 0.5;
  const subtotal = adultGuests * pricePerGuest + kids * childPricePerGuest;
  const gratuity = Math.round(subtotal * gratuityPct) / 100;
  const totalCharged = subtotal + gratuity;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">

        {/* ── Header ── */}
        <div className="mb-6">
          {/* Logo + title */}
          <div className="mb-5 flex items-center gap-4">
            <div className="relative h-[68px] w-[68px] shrink-0 rounded-xl border border-border bg-card shadow-md">
              <Image src="/hibachisun.png" alt="Hibachi A Go Go" fill className="object-contain p-1.5" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight text-text-primary sm:text-2xl">Event Calculator</h1>
              <p className="text-xs text-text-muted sm:text-sm">Hibachi A Go Go — Chef Assistant</p>
            </div>
          </div>

          {/* Desktop tabs — hidden on mobile */}
          <div className="hidden sm:flex rounded-lg border border-border bg-card-elevated p-1 w-full">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === id ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mobile tab label + arrows */}
          <div className="flex items-center justify-between sm:hidden">
            <button
              onClick={() => tabIdx > 0 && setActiveTab(TABS[tabIdx - 1].id)}
              disabled={tabIdx === 0}
              className="rounded-lg border border-border bg-card-elevated px-3 py-1.5 text-sm text-text-secondary disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-text-primary">{TABS[tabIdx].label}</span>
            <button
              onClick={() => tabIdx < TABS.length - 1 && setActiveTab(TABS[tabIdx + 1].id)}
              disabled={tabIdx === TABS.length - 1}
              className="rounded-lg border border-border bg-card-elevated px-3 py-1.5 text-sm text-text-secondary disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>

        {/* Swipeable content area */}
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        {activeTab === 'chef' && <ChefBreakdownTab rules={rules} perEventExpense={perEventExpense} />}

        {activeTab === 'info' && <BusinessInfoTab />}

        {/* Overhead summary card — always visible at bottom of calculator tab handled below */}

        {activeTab === 'calculator' && (() => {
          // Rates vary by event type; profit split is always 40/60
          const isBuffet = calcEventType === 'buffet';
          const CHEF_REV_PCT = isBuffet ? 15 : 20;
          const ASST_REV_PCT = isBuffet ? 15 : 10;
          const CHEF_GRAT_PCT = isBuffet ? 50 : 60;
          const ASST_GRAT_PCT = isBuffet ? 50 : 40;
          const CHEF_PROFIT_PCT = rules.profitDistribution.ownerAEquityPercent;
          const ASST_PROFIT_PCT = rules.profitDistribution.ownerBEquityPercent;
          const actualCollected = actualCollectedText.trim() === '' ? null : Number(actualCollectedText);
          const hasActualCollected = actualCollected !== null && Number.isFinite(actualCollected) && actualCollected >= 0;
          const effectiveTotalCollected = hasActualCollected ? actualCollected : totalCharged;
          const collectedDelta = effectiveTotalCollected - totalCharged;
          const effectiveGratuity = Math.max(0, gratuity + collectedDelta);
          const extraGratuity = Math.max(0, collectedDelta);
          const chefExtraGratuity = extraGratuity * (CHEF_GRAT_PCT / 100);
          const asstExtraGratuity = extraGratuity * (ASST_GRAT_PCT / 100);

          const foodCostPct = isBuffet ? rules.costs.secondaryFoodCostPercent : rules.costs.primaryFoodCostPercent;
          const suppliesCostPct = rules.costs.suppliesCostPercent;
          const foodCostBudget = subtotal * foodCostPct / 100;
          const suppliesCostBudget = subtotal * suppliesCostPct / 100;

          // Actual cost overrides
          const parsedCalcActualFood = Number(calcActualFoodText);
          const hasCalcActualFood = calcActualFoodText.trim() !== '' && Number.isFinite(parsedCalcActualFood) && parsedCalcActualFood >= 0;
          const parsedCalcActualSupplies = Number(calcActualSuppliesText);
          const hasCalcActualSupplies = calcActualSuppliesText.trim() !== '' && Number.isFinite(parsedCalcActualSupplies) && parsedCalcActualSupplies >= 0;
          const effectiveFoodCost = hasCalcActualFood ? parsedCalcActualFood : foodCostBudget;
          const effectiveSuppliesCost = hasCalcActualSupplies ? parsedCalcActualSupplies : suppliesCostBudget;
          // Keep legacy names for display compatibility
          const foodCost = foodCostBudget;
          const suppliesCost = suppliesCostBudget;
          const totalCosts = effectiveFoodCost + effectiveSuppliesCost + perEventExpense;

          // Gratuity is a pass-through: collected separately, paid directly to staff.
          // All revenue-based calculations use subtotal only.
          const chefBasePay = subtotal * CHEF_REV_PCT / 100;
          const asstBasePay = subtotal * ASST_REV_PCT / 100;
          const totalBaseLaborPay = chefBasePay + asstBasePay;

          // Gratuity split (pass-through, not revenue)
          const chefGratPay = effectiveGratuity * CHEF_GRAT_PCT / 100;
          const asstGratPay = effectiveGratuity * ASST_GRAT_PCT / 100;

          // Gross profit derived from revenue only (gratuity excluded)
          const grossProfit = subtotal - totalCosts - totalBaseLaborPay;

          // Tax reserves set aside from gross profit before any owner splits
          const totalTaxReservePct = salesTaxPct + seTaxPct + incomeTaxPct;
          const salesTaxReserveAmt = grossProfit > 0 ? grossProfit * (salesTaxPct / 100) : 0;
          const seTaxReserveAmt = grossProfit > 0 ? grossProfit * (seTaxPct / 100) : 0;
          const incomeTaxReserveAmt = grossProfit > 0 ? grossProfit * (incomeTaxPct / 100) : 0;
          const totalTaxReserveAmt = grossProfit > 0 ? grossProfit * (totalTaxReservePct / 100) : 0;
          const afterTaxProfit = Math.max(0, grossProfit - totalTaxReserveAmt);

          const retainedAmt = afterTaxProfit > 0 ? afterTaxProfit * (rules.profitDistribution.businessRetainedPercent / 100) : 0;
          const distributable = afterTaxProfit > 0 ? afterTaxProfit * (rules.profitDistribution.ownerDistributionPercent / 100) : 0;

          const ownerAAmount = distributable * CHEF_PROFIT_PCT / 100;
          const ownerBAmount = distributable * ASST_PROFIT_PCT / 100;

          // Total per person = base labor + profit share + tip
          const aSorianoTotal = chefBasePay + ownerAAmount + chefGratPay;
          const jSorianoTotal = asstBasePay + ownerBAmount + asstGratPay;
          const aSorianoPct = effectiveTotalCollected > 0 ? (aSorianoTotal / effectiveTotalCollected) * 100 : 0;
          const jSorianoPct = effectiveTotalCollected > 0 ? (jSorianoTotal / effectiveTotalCollected) * 100 : 0;

          // Bar segments as % of subtotal (revenue only, gratuity excluded)
          const barLabor = subtotal > 0 ? (totalBaseLaborPay / subtotal) * 100 : 0;
          const barCosts = subtotal > 0 ? ((effectiveFoodCost + effectiveSuppliesCost) / subtotal) * 100 : 0;
          const barOverhead = subtotal > 0 ? (perEventExpense / subtotal) * 100 : 0;
          const barTaxReserve = subtotal > 0 ? (totalTaxReserveAmt / subtotal) * 100 : 0;
          const barRetained = subtotal > 0 ? (retainedAmt / subtotal) * 100 : 0;
          const barDistributable = subtotal > 0 ? (distributable / subtotal) * 100 : 0;
          const barTotalPct = barLabor + barCosts + barOverhead + barTaxReserve + barRetained + barDistributable;

          return (
            <div className="space-y-5">

              {/* ── Inputs ── */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-4 text-lg font-semibold text-text-primary">Scenario</h2>
                {/* Event type toggle */}
                <div className="mb-4 flex rounded-lg border border-border bg-card-elevated p-1">
                  {(['dinner', 'buffet'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setCalcEventType(type)}
                      className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                        calcEventType === type
                          ? 'bg-accent text-white shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {type === 'dinner' ? 'Hibachi Dinner' : 'Hibachi Buffet'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Adults</label>
                    <input
                      type="number" min="1" max="300" value={adultGuestText}
                      onChange={(e) => { setAdultGuestText(e.target.value); const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setAdultGuests(v); }}
                      onBlur={() => setAdultGuestText(String(adultGuests))}
                      className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-center text-lg font-bold text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Kids (50% Off)</label>
                    <input
                      type="number" min="0" max="300" value={kidsText}
                      onChange={(e) => { setKidsText(e.target.value); const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) setKids(v); }}
                      onBlur={() => setKidsText(String(kids))}
                      className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-center text-lg font-bold text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Price / Adult</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">$</span>
                      <input
                        type="number" min="1" max="999" value={priceText}
                        onChange={(e) => { setPriceText(e.target.value); const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setPricePerGuest(v); }}
                        onBlur={() => setPriceText(String(pricePerGuest))}
                        className="w-full rounded-md border border-border bg-card-elevated pl-7 pr-3 py-2 text-center text-lg font-bold text-text-primary focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Gratuity</label>
                    <div className="relative">
                      <input
                        type="number" min="0" max="50" value={gratuityPct}
                        onChange={(e) => setGratuityPct(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full rounded-md border border-border bg-card-elevated px-3 pr-8 py-2 text-center text-lg font-bold text-text-primary focus:border-accent focus:outline-none"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Owner Cards ── */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border-2 border-accent bg-accent/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-accent">A Soriano</p>
                  <p className="mb-2 text-xs text-text-muted">Lead Chef · Owner</p>
                  <p className="text-2xl font-bold text-text-primary sm:text-3xl">{formatCurrency(aSorianoTotal)}</p>
                  <p className="mb-3 text-base font-bold text-accent">{aSorianoPct.toFixed(1)}% of event</p>
                  <div className="space-y-1.5 border-t border-accent/20 pt-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-text-secondary">{CHEF_REV_PCT}% of revenue</span>
                      <span className="font-medium text-blue-400">{formatCurrency(chefBasePay)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-secondary">{CHEF_GRAT_PCT}% of gratuity</span>
                      <span className="font-medium text-blue-300">{formatCurrency(chefGratPay)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-secondary">{CHEF_PROFIT_PCT}% of profit</span>
                      <span className="font-medium text-emerald-400">{formatCurrency(ownerAAmount)}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border-2 border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">J Soriano</p>
                  <p className="mb-2 text-xs text-text-muted">Assistant Chef · Owner</p>
                  <p className="text-2xl font-bold text-text-primary sm:text-3xl">{formatCurrency(jSorianoTotal)}</p>
                  <p className="mb-3 text-base font-bold text-text-secondary">{jSorianoPct.toFixed(1)}% of event</p>
                  <div className="space-y-1.5 border-t border-border pt-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-text-secondary">{ASST_REV_PCT}% of revenue</span>
                      <span className="font-medium text-blue-400">{formatCurrency(asstBasePay)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-secondary">{ASST_GRAT_PCT}% of gratuity</span>
                      <span className="font-medium text-blue-300">{formatCurrency(asstGratPay)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-secondary">{ASST_PROFIT_PCT}% of profit</span>
                      <span className="font-medium text-emerald-500">{formatCurrency(ownerBAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Where Every Dollar Goes ── */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-1 text-sm font-semibold text-text-primary sm:text-base">Where Every Dollar Goes</h2>
                <p className="mb-4 text-xs text-text-muted">
                  {adultGuests} adult{adultGuests !== 1 ? 's' : ''} × {formatCurrency(pricePerGuest)}
                  {kids > 0 ? ` + ${kids} kid${kids !== 1 ? 's' : ''} × ${formatCurrency(childPricePerGuest)}` : ''}
                  {' = '}
                  {formatCurrency(subtotal)} revenue · gratuity separate
                </p>
                <div className="flex h-8 w-full overflow-hidden rounded-lg border border-border">
                  {barLabor > 0.5 && <div className="bg-blue-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barLabor, barTotalPct)}%` }} />}
                  {barCosts > 0.5 && <div className="bg-red-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barCosts, barTotalPct)}%` }} />}
                  {barOverhead > 0.5 && <div className="bg-amber-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barOverhead, barTotalPct)}%` }} />}
                  {barTaxReserve > 0.5 && <div className="bg-orange-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barTaxReserve, barTotalPct)}%` }} />}
                  {barRetained > 0.5 && <div className="bg-violet-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barRetained, barTotalPct)}%` }} />}
                  {barDistributable > 0.5 && <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${normalizedBarWidth(barDistributable, barTotalPct)}%` }} />}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {[
                    { color: 'bg-blue-500', label: 'Labor', pct: barLabor },
                    { color: 'bg-red-500', label: 'Food & Supplies', pct: barCosts },
                    { color: 'bg-amber-500', label: 'Overhead', pct: barOverhead },
                    { color: 'bg-orange-500', label: 'Tax Reserve', pct: barTaxReserve },
                    { color: 'bg-violet-500', label: 'Retained', pct: barRetained },
                    { color: 'bg-emerald-500', label: 'Profit Share', pct: barDistributable },
                  ].map(({ color, label, pct }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={`h-2.5 w-2.5 rounded-sm ${color}`} />
                      <span className="text-[11px] text-text-secondary">
                        {label} <span className="font-medium text-text-primary">{pct.toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Money Waterfall ── */}
              <div className="overflow-hidden rounded-lg border border-border bg-card text-sm">
                <div className="border-b border-border bg-card-elevated px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary sm:text-base">Money Waterfall</p>
                </div>

                {/* Revenue */}
                <div className="border-b border-border pb-1 pt-2">
                  <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Revenue</p>
                  <div className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="text-text-secondary">
                      {adultGuests} adult{adultGuests !== 1 ? 's' : ''} × {formatCurrency(pricePerGuest)}
                      {kids > 0 ? ` + ${kids} kid${kids !== 1 ? 's' : ''} × ${formatCurrency(childPricePerGuest)}` : ''}
                    </span>
                    <span className="tabular-nums text-text-primary">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                    <span className="text-text-primary">Total Revenue</span>
                    <span className="tabular-nums text-text-primary">{formatCurrency(subtotal)}</span>
                  </div>
                </div>

                {/* Labor (base pay from revenue only) */}
                <div className="border-b border-border pb-1 pt-2">
                  <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Labor</p>
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">Lead Chef — {CHEF_REV_PCT}% of revenue</span>
                    <span className="tabular-nums text-blue-400">−{formatCurrency(chefBasePay)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">Assistant — {ASST_REV_PCT}% of revenue</span>
                    <span className="tabular-nums text-blue-400">−{formatCurrency(asstBasePay)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                    <span className="text-text-primary">Total Labor</span>
                    <span className="tabular-nums text-danger">−{formatCurrency(totalBaseLaborPay)}</span>
                  </div>
                </div>

                {/* Costs */}
                <div className="border-b border-border pb-1 pt-2">
                  <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Costs</p>
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">
                      Food Cost ({foodCostPct}%)
                      {effectiveFoodCost !== foodCostBudget && (
                        <span className="ml-2 text-[11px] text-text-muted line-through">{formatCurrency(foodCostBudget)}</span>
                      )}
                    </span>
                    <span className="tabular-nums text-red-400">−{formatCurrency(effectiveFoodCost)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">
                      Supplies ({suppliesCostPct}%)
                      {effectiveSuppliesCost !== suppliesCostBudget && (
                        <span className="ml-2 text-[11px] text-text-muted line-through">{formatCurrency(suppliesCostBudget)}</span>
                      )}
                    </span>
                    <span className="tabular-nums text-red-400">−{formatCurrency(effectiveSuppliesCost)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">Overhead Allocation</span>
                    <span className="tabular-nums text-red-400">−{formatCurrency(perEventExpense)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                    <span className="text-text-primary">Total Costs</span>
                    <span className="tabular-nums text-danger">−{formatCurrency(totalCosts)}</span>
                  </div>
                </div>

                {/* Profit Distribution */}
                <div className="border-b border-border pb-1 pt-2">
                  <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Profit Distribution</p>
                  <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                    <span className="text-text-primary">Gross Profit</span>
                    <span className={`tabular-nums ${grossProfit >= 0 ? 'text-emerald-400' : 'text-danger'}`}>{formatCurrency(grossProfit)}</span>
                  </div>
                  {totalTaxReserveAmt > 0 && (
                    <>
                      {salesTaxPct > 0 && (
                        <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                          <span className="text-text-secondary">Sales Tax Reserve ({salesTaxPct}%)</span>
                          <span className="tabular-nums text-orange-400">−{formatCurrency(salesTaxReserveAmt)}</span>
                        </div>
                      )}
                      {seTaxPct > 0 && (
                        <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                          <span className="text-text-secondary">SE Tax Reserve ({seTaxPct}%)</span>
                          <span className="tabular-nums text-orange-400">−{formatCurrency(seTaxReserveAmt)}</span>
                        </div>
                      )}
                      {incomeTaxPct > 0 && (
                        <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                          <span className="text-text-secondary">Income Tax Reserve ({incomeTaxPct}%)</span>
                          <span className="tabular-nums text-orange-400">−{formatCurrency(incomeTaxReserveAmt)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                        <span className="text-text-primary">After-Tax Profit</span>
                        <span className={`tabular-nums ${afterTaxProfit >= 0 ? 'text-emerald-400' : 'text-danger'}`}>{formatCurrency(afterTaxProfit)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">Business Retained ({rules.profitDistribution.businessRetainedPercent}%)</span>
                    <span className="tabular-nums text-violet-400">−{formatCurrency(retainedAmt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border bg-card-elevated px-4 py-2.5 font-semibold">
                    <span className="text-text-primary">Profit Share Distribution ({rules.profitDistribution.ownerDistributionPercent}%)</span>
                    <span className="tabular-nums text-success">{formatCurrency(distributable)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">A Soriano — {CHEF_PROFIT_PCT}% of profit</span>
                    <span className="tabular-nums text-emerald-400">{formatCurrency(ownerAAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">J Soriano — {ASST_PROFIT_PCT}% of profit</span>
                    <span className="tabular-nums text-emerald-500">{formatCurrency(ownerBAmount)}</span>
                  </div>
                </div>

                {/* Gratuity — pass-through, separate from revenue */}
                <div className="pb-1 pt-2">
                  <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Gratuity (pass-through)</p>
                  <div className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="text-text-secondary">Estimated ({gratuityPct}% of revenue)</span>
                    <span className="tabular-nums text-text-primary">{formatCurrency(gratuity)}</span>
                  </div>
                  {hasActualCollected && (
                    <div className="flex items-center justify-between gap-3 px-4 py-2">
                      <span className="text-text-secondary">Reconciled Gratuity</span>
                      <span className="tabular-nums text-text-primary">{formatCurrency(effectiveGratuity)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">Lead Chef — {CHEF_GRAT_PCT}%</span>
                    <span className="tabular-nums text-blue-300">{formatCurrency(chefGratPay)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-8 pr-4 py-2">
                    <span className="text-text-secondary">Assistant — {ASST_GRAT_PCT}%</span>
                    <span className="tabular-nums text-blue-300">{formatCurrency(asstGratPay)}</span>
                  </div>
                </div>
              </div>

              {/* ── Reconciliation ── */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-2 text-sm font-semibold text-text-primary sm:text-base">Reconciliation</h2>
                <p className="mb-4 text-xs text-text-muted">Enter actual total collected and actual costs. Any unused cost budget goes to profit.</p>

                {/* Actual cost overrides */}
                <div className="mb-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Actual Costs (optional)</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-muted">
                        <span>Food Cost</span>
                        <span>budget {formatCurrency(foodCostBudget)}</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={calcActualFoodText}
                          onChange={(e) => setCalcActualFoodText(e.target.value)}
                          placeholder={foodCostBudget.toFixed(2)}
                          className="w-full rounded-md border border-border bg-card-elevated pl-7 pr-3 py-2 text-sm font-medium text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      {hasCalcActualFood && (
                        <p className={`mt-1 text-xs font-medium ${parsedCalcActualFood < foodCostBudget ? 'text-emerald-400' : 'text-danger'}`}>
                          {parsedCalcActualFood < foodCostBudget
                            ? `+${formatCurrency(foodCostBudget - parsedCalcActualFood)} saved → profit`
                            : `${formatCurrency(parsedCalcActualFood - foodCostBudget)} over budget`}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-muted">
                        <span>Supplies</span>
                        <span>budget {formatCurrency(suppliesCostBudget)}</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={calcActualSuppliesText}
                          onChange={(e) => setCalcActualSuppliesText(e.target.value)}
                          placeholder={suppliesCostBudget.toFixed(2)}
                          className="w-full rounded-md border border-border bg-card-elevated pl-7 pr-3 py-2 text-sm font-medium text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      {hasCalcActualSupplies && (
                        <p className={`mt-1 text-xs font-medium ${parsedCalcActualSupplies < suppliesCostBudget ? 'text-emerald-400' : 'text-danger'}`}>
                          {parsedCalcActualSupplies < suppliesCostBudget
                            ? `+${formatCurrency(suppliesCostBudget - parsedCalcActualSupplies)} saved → profit`
                            : `${formatCurrency(parsedCalcActualSupplies - suppliesCostBudget)} over budget`}
                        </p>
                      )}
                    </div>
                  </div>
                  {(hasCalcActualFood || hasCalcActualSupplies) && (() => {
                    const savings = (foodCostBudget - effectiveFoodCost) + (suppliesCostBudget - effectiveSuppliesCost);
                    return savings !== 0 ? (
                      <div className="rounded-md border border-border bg-card-elevated px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary">Total cost savings → profit</span>
                          <span className={`font-semibold tabular-nums ${savings >= 0 ? 'text-emerald-400' : 'text-danger'}`}>
                            {savings >= 0 ? '+' : '−'}{formatCurrency(Math.abs(savings))}
                          </span>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Actual total collected */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border bg-card-elevated px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-text-muted">Estimated Total</p>
                    <p className="text-lg font-semibold text-text-primary">{formatCurrency(totalCharged)}</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Actual Total Collected</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={actualCollectedText}
                        onChange={(e) => setActualCollectedText(e.target.value)}
                        placeholder={totalCharged.toFixed(2)}
                        className="w-full rounded-md border border-border bg-card-elevated pl-7 pr-3 py-2 text-center text-lg font-bold text-text-primary focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
                {hasActualCollected && (
                  <div className="mt-3 rounded-md border border-border bg-card-elevated px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-text-secondary">Difference vs Estimate</span>
                      <span className={`font-semibold tabular-nums ${collectedDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                        {collectedDelta >= 0 ? '+' : '−'}{formatCurrency(Math.abs(collectedDelta))}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                      <span className="text-text-secondary">Reconciled Gratuity Used in Payouts</span>
                      <span className="font-semibold tabular-nums text-text-primary">{formatCurrency(effectiveGratuity)}</span>
                    </div>
                    {extraGratuity > 0 && (
                      <>
                        <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                          <span className="text-text-secondary">Lead Chef extra gratuity ({CHEF_GRAT_PCT}%)</span>
                          <span className="font-semibold tabular-nums text-success">+{formatCurrency(chefExtraGratuity)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                          <span className="text-text-secondary">Assistant extra gratuity ({ASST_GRAT_PCT}%)</span>
                          <span className="font-semibold tabular-nums text-success">+{formatCurrency(asstExtraGratuity)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ── Overhead & Retained Earnings ── */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-text-primary sm:text-base">Overhead & Retained Earnings</h2>
                  <Link href="/business-rules?tab=overhead" className="text-xs text-accent hover:underline">
                    Edit in Business Rules →
                  </Link>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Monthly overhead</span>
                    <span className="font-medium text-text-primary">{formatCurrency(totalMonthlyExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Overhead per event ({eventsPerMonth} events/mo)</span>
                    <span className="font-medium text-danger">−{formatCurrency(perEventExpense)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Tax reserves (SE + income)</span>
                    <span className="font-medium text-orange-400">{(seTaxPct + incomeTaxPct).toFixed(1)}% of profit</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-semibold text-text-primary">Retained earnings balance</span>
                    <span className={`font-bold tabular-nums ${retainedEarningsBalance >= 0 ? 'text-violet-400' : 'text-danger'}`}>
                      {formatCurrency(retainedEarningsBalance)}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

        </div>{/* end swipeable */}

        {/* Mobile dot indicators */}
        <div className="mt-6 flex justify-center gap-2 sm:hidden">
          {TABS.map(({ id }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`h-2 rounded-full transition-all duration-200 ${
                activeTab === id ? 'w-6 bg-accent' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

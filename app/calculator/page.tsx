'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { PlusIcon, XMarkIcon, QuestionMarkCircleIcon, BanknotesIcon } from '@heroicons/react/24/outline';

const ROLE_LABELS: Record<string, string> = {
  lead: 'Lead Chef',
  full: 'Full Chef',
  buffet: 'Buffet Chef',
  assistant: 'Assistant',
};

// ─── Info tooltip ─────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <QuestionMarkCircleIcon className="h-4 w-4 cursor-help text-text-muted hover:text-text-secondary" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-text-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-border" />
      </span>
    </span>
  );
}

// ─── Chef / Event Breakdown Tab ───────────────────────────────────────────────

function fmtEventDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function ChefBreakdownTab({ rules, perEventExpense, salesTaxPct, seTaxPct, incomeTaxPct }: { rules: MoneyRules; perEventExpense: number; salesTaxPct: number; seTaxPct: number; incomeTaxPct: number }) {
  const { user } = useAuth();
  const { bookings } = useBookingsQuery();
  const { staff } = useStaffQuery();
  const [selectedId, setSelectedId] = useState<string>('');

  const chefStaffId = useMemo(() => getCurrentChefStaffId(user, staff), [user, staff]);

  const eventOptions = useMemo(() => {
    let list = bookings.filter((b) => b.status !== 'cancelled');
    if (chefStaffId) {
      list = list.filter((b) => bookingHasStaff(b.staffAssignments, chefStaffId));
    }
    return list.sort((a, b) => {
      const now = Date.now();
      const aMs = new Date(a.eventDate).getTime();
      const bMs = new Date(b.eventDate).getTime();
      const aUp = aMs >= now;
      const bUp = bMs >= now;
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      return aUp ? aMs - bMs : bMs - aMs;
    });
  }, [bookings, chefStaffId]);

  useEffect(() => {
    if (!selectedId && eventOptions.length > 0) setSelectedId(eventOptions[0].id);
  }, [eventOptions, selectedId]);

  useEffect(() => {
    if (selectedId && eventOptions.length > 0 && !eventOptions.some((b) => b.id === selectedId)) {
      setSelectedId(eventOptions[0].id);
    }
  }, [eventOptions, selectedId]);

  const selected = useMemo(
    () => eventOptions.find((b) => b.id === selectedId) ?? null,
    [eventOptions, selectedId]
  );

  const fin = useMemo(() => {
    if (!selected) return null;
    return calculateEventFinancials(
      {
        adults: selected.adults,
        children: selected.children,
        eventType: selected.eventType,
        eventDate: new Date(selected.eventDate),
        distanceMiles: selected.distanceMiles,
        premiumAddOn: selected.premiumAddOn || 0,
      },
      rules
    );
  }, [selected, rules]);

  const alloc = useMemo(() => {
    if (!fin || fin.totalCharged === 0) return null;
    const base = fin.totalCharged;
    return {
      costs: ((fin.foodCost + fin.suppliesCost + fin.transportationCost) / base) * 100,
      labor: (fin.totalLaborPaid / base) * 100,
      retained: (fin.retainedAmount / base) * 100,
      ownerA: (fin.ownerADistribution / base) * 100,
      ownerB: (fin.ownerBDistribution / base) * 100,
    };
  }, [fin]);

  const ownerRows = useMemo(() => {
    if (!fin) return [];
    if (fin.ownerDistributions && fin.ownerDistributions.length > 0) {
      return fin.ownerDistributions.map((od) => ({ name: od.ownerName, amount: od.amount }));
    }
    return [
      { name: `Owner A (${rules.profitDistribution.ownerAEquityPercent}%)`, amount: fin.ownerADistribution },
      { name: `Owner B (${rules.profitDistribution.ownerBEquityPercent}%)`, amount: fin.ownerBDistribution },
    ];
  }, [fin, rules]);

  // Adjusted profit after monthly expense deduction and tax reserves
  const adjustedProfit = fin ? fin.grossProfit - perEventExpense : 0;
  const salesTaxReserve = adjustedProfit > 0 ? adjustedProfit * salesTaxPct / 100 : 0;
  const seTaxReserve = adjustedProfit > 0 ? adjustedProfit * seTaxPct / 100 : 0;
  const incomeTaxReserve = adjustedProfit > 0 ? adjustedProfit * incomeTaxPct / 100 : 0;
  const afterTaxReserves = adjustedProfit - salesTaxReserve - seTaxReserve - incomeTaxReserve;
  const adjustedRetained = afterTaxReserves > 0 ? afterTaxReserves * (rules.profitDistribution.businessRetainedPercent / 100) : 0;
  const adjustedDistributable = afterTaxReserves > 0 ? afterTaxReserves * (rules.profitDistribution.ownerDistributionPercent / 100) : 0;
  const ownersList = rules.profitDistribution.owners?.length
    ? rules.profitDistribution.owners
    : [
        { id: 'owner-a', name: `Owner A (${rules.profitDistribution.ownerAEquityPercent}%)`, equityPercent: rules.profitDistribution.ownerAEquityPercent },
        { id: 'owner-b', name: `Owner B (${rules.profitDistribution.ownerBEquityPercent}%)`, equityPercent: rules.profitDistribution.ownerBEquityPercent },
      ];
  const adjustedOwnerRows = ownersList.map((o) => ({
    name: o.name,
    amount: adjustedDistributable * o.equityPercent / 100,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Event selector */}
      <div className="rounded-lg border border-border bg-card p-5">
        <label className="mb-2 block text-sm font-semibold text-text-secondary">Select Event</label>
        {eventOptions.length === 0 ? (
          <p className="text-sm text-text-muted">
            {chefStaffId
              ? 'No events assigned to you yet. Events you work on will appear here.'
              : 'No events found. Create a booking first.'}
          </p>
        ) : (
          <select
            value={selectedId}
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
          {/* ── Per-person cuts ─────────────────────────────────────── */}
          {(() => {
            const chefComp = fin.laborCompensation.find((c) => c.role === 'lead');
            const asstComp = fin.laborCompensation.find((c) => c.role === 'assistant');
            const chefPay = chefComp?.finalPay ?? 0;
            const asstPay = asstComp?.finalPay ?? 0;
            const ownerA = adjustedOwnerRows[0];   // A Soriano's profit share
            const ownerB = adjustedOwnerRows[1];   // J Soriano's profit share
            const ownerAAmount = ownerA?.amount ?? 0;
            const ownerBAmount = ownerB?.amount ?? 0;
            const aSorianoTotal = chefPay + ownerAAmount;
            const jSorianoTotal = asstPay + ownerBAmount;
            const aSorianoPct = fin.totalCharged > 0 ? (aSorianoTotal / fin.totalCharged) * 100 : 0;
            const jSorianoPct = fin.totalCharged > 0 ? (jSorianoTotal / fin.totalCharged) * 100 : 0;
            return (
              <div className="grid grid-cols-2 gap-4">
                {/* A Soriano — Lead Chef + Owner A */}
                <div className="rounded-xl border-2 border-accent bg-accent/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-accent">A Soriano</p>
                  <p className="mb-3 text-xs text-text-muted">Lead Chef · Owner</p>
                  <p className="text-3xl font-bold text-text-primary">{formatCurrency(aSorianoTotal)}</p>
                  <p className="mb-3 text-lg font-bold text-accent">{aSorianoPct.toFixed(1)}% of event</p>
                  <div className="space-y-1.5 border-t border-accent/20 pt-3 text-xs">
                    {chefComp && (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="text-text-secondary">Base pay</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-text-muted">{fin.totalCharged > 0 ? ((chefComp.basePay / fin.totalCharged) * 100).toFixed(1) : '0.0'}%</span>
                            <span className="font-medium text-text-primary">{formatCurrency(chefComp.basePay)}</span>
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-text-secondary">Gratuity share</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-text-muted">{fin.totalCharged > 0 ? ((chefComp.gratuityShare / fin.totalCharged) * 100).toFixed(1) : '0.0'}%</span>
                            <span className="font-medium text-text-primary">{formatCurrency(chefComp.gratuityShare)}</span>
                          </span>
                        </div>
                      </>
                    )}
                    {ownerA && (
                      <div className="flex justify-between gap-2">
                        <span className="text-text-secondary">Profit split</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-text-muted">{fin.totalCharged > 0 ? ((ownerAAmount / fin.totalCharged) * 100).toFixed(1) : '0.0'}%</span>
                          <span className="font-medium text-text-primary">{formatCurrency(ownerAAmount)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* J Soriano — Assistant + Owner B */}
                <div className="rounded-xl border-2 border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">J Soriano</p>
                  <p className="mb-3 text-xs text-text-muted">Assistant Chef · Owner</p>
                  <p className="text-3xl font-bold text-text-primary">{formatCurrency(jSorianoTotal)}</p>
                  <p className="mb-3 text-lg font-bold text-text-secondary">{jSorianoPct.toFixed(1)}% of event</p>
                  <div className="space-y-1.5 border-t border-border pt-3 text-xs">
                    {asstComp && (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="text-text-secondary">Base pay</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-text-muted">{fin.totalCharged > 0 ? ((asstComp.basePay / fin.totalCharged) * 100).toFixed(1) : '0.0'}%</span>
                            <span className="font-medium text-text-primary">{formatCurrency(asstComp.basePay)}</span>
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-text-secondary">Gratuity share</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-text-muted">{fin.totalCharged > 0 ? ((asstComp.gratuityShare / fin.totalCharged) * 100).toFixed(1) : '0.0'}%</span>
                            <span className="font-medium text-text-primary">{formatCurrency(asstComp.gratuityShare)}</span>
                          </span>
                        </div>
                      </>
                    )}
                    {ownerB && (
                      <div className="flex justify-between gap-2">
                        <span className="text-text-secondary">Profit split</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-text-muted">{fin.totalCharged > 0 ? ((ownerBAmount / fin.totalCharged) * 100).toFixed(1) : '0.0'}%</span>
                          <span className="font-medium text-text-primary">{formatCurrency(ownerBAmount)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">Revenue</h2>
              <InfoTooltip text="Subtotal = guests × price per guest. Children receive a discount. Gratuity is added on top. Total Charged is the full amount billed to the client." />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Subtotal — {fin.adultCount} adult{fin.adultCount !== 1 ? 's' : ''}
                  {fin.childCount > 0 ? ` + ${fin.childCount} children` : ''} @ {formatCurrency(fin.basePrice)}/guest
                </span>
                <span className="font-medium text-text-primary">{formatCurrency(fin.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Gratuity ({fin.gratuityPercent}%)</span>
                <span className="font-medium text-text-primary">{formatCurrency(fin.gratuity)}</span>
              </div>
              {fin.distanceFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Distance fee ({selected.distanceMiles} mi)</span>
                  <span className="font-medium text-text-primary">{formatCurrency(fin.distanceFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold text-text-primary">Total Charged</span>
                <span className="text-2xl font-bold text-success">{formatCurrency(fin.totalCharged)}</span>
              </div>
            </div>
          </div>

          {alloc && (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text-primary">Where Every Dollar Goes</h2>
                <InfoTooltip text="Each segment shows how a portion of total revenue is used: Costs (food, supplies, transport), Labor (staff pay), Business Retained (tax reserves + working capital), and Owner distributions." />
              </div>
              <div className="flex h-9 w-full overflow-hidden rounded-lg">
                <div className="flex items-center justify-center bg-warning/80 text-xs font-bold text-white" style={{ width: `${alloc.costs}%` }} title={`Costs ${alloc.costs.toFixed(1)}%`}>
                  {alloc.costs >= 8 ? `${alloc.costs.toFixed(0)}%` : ''}
                </div>
                <div className="flex items-center justify-center bg-info/80 text-xs font-bold text-white" style={{ width: `${alloc.labor}%` }} title={`Labor ${alloc.labor.toFixed(1)}%`}>
                  {alloc.labor >= 8 ? `${alloc.labor.toFixed(0)}%` : ''}
                </div>
                <div className="flex items-center justify-center bg-violet-500/80 text-xs font-bold text-white" style={{ width: `${alloc.retained}%` }} title={`Business retained ${alloc.retained.toFixed(1)}%`}>
                  {alloc.retained >= 8 ? `${alloc.retained.toFixed(0)}%` : ''}
                </div>
                <div className="flex items-center justify-center bg-success/70 text-xs font-bold text-white" style={{ width: `${alloc.ownerA}%` }} title={`Owner A ${alloc.ownerA.toFixed(1)}%`}>
                  {alloc.ownerA >= 8 ? `${alloc.ownerA.toFixed(0)}%` : ''}
                </div>
                <div className="flex items-center justify-center bg-success text-xs font-bold text-white" style={{ width: `${alloc.ownerB}%` }} title={`Owner B ${alloc.ownerB.toFixed(1)}%`}>
                  {alloc.ownerB >= 8 ? `${alloc.ownerB.toFixed(0)}%` : ''}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                {[
                  { label: `Costs (${alloc.costs.toFixed(1)}%)`, color: 'bg-warning/80' },
                  { label: `Labor (${alloc.labor.toFixed(1)}%)`, color: 'bg-info/80' },
                  { label: `Business Retained (${alloc.retained.toFixed(1)}%)`, color: 'bg-violet-500/80' },
                  { label: `Owner A (${alloc.ownerA.toFixed(1)}%)`, color: 'bg-success/70' },
                  { label: `Owner B (${alloc.ownerB.toFixed(1)}%)`, color: 'bg-success' },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded-sm ${color}`} />
                    <span className="text-text-secondary">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">Cost Breakdown</h2>
              <InfoTooltip text="Food cost and supplies are calculated as a percentage of the subtotal (before gratuity). Transportation is a flat stipend for mileage beyond the free threshold. These are operational costs paid by the business." />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Food Cost ({fin.foodCostPercent}% of subtotal)</span>
                <span className="font-medium text-text-primary">{formatCurrency(fin.foodCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Supplies ({rules.costs.suppliesCostPercent}% of subtotal)</span>
                <span className="font-medium text-text-primary">{formatCurrency(fin.suppliesCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Transportation (stipend)</span>
                <span className="font-medium text-text-primary">{formatCurrency(fin.transportationCost)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold text-text-primary">Total Costs</span>
                <span className="font-bold text-danger">{formatCurrency(fin.totalCosts)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">Labor Pay</h2>
              <InfoTooltip text="Each staff member earns base pay (% of subtotal) plus a gratuity share (% of the gratuity pool). A cap may limit total pay, with any excess redirected to profit. Final pay = base pay + gratuity share." />
            </div>
            <div className="space-y-3">
              {fin.laborCompensation.map((comp, i) => (
                <div key={i} className="rounded-lg bg-card-elevated p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary">{ROLE_LABELS[comp.role] ?? comp.role}</span>
                    <span className="text-xl font-bold text-text-primary">{formatCurrency(comp.finalPay)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-text-muted">
                    <span>Base pay</span>
                    <span className="text-right">{formatCurrency(comp.basePay)}</span>
                    <span>Gratuity share</span>
                    <span className="text-right">{formatCurrency(comp.gratuityShare)}</span>
                    <span className="text-text-secondary">% of total revenue</span>
                    <span className="text-right font-medium text-text-secondary">
                      {fin.totalCharged > 0 ? ((comp.finalPay / fin.totalCharged) * 100).toFixed(1) : '0.0'}%
                    </span>
                    {fin.gratuity > 0 && (
                      <>
                        <span className="text-text-secondary">Gratuity split</span>
                        <span className="text-right font-medium text-text-secondary">
                          {((comp.gratuityShare / fin.gratuity) * 100).toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>
                  {comp.wasCapped && (
                    <p className="mt-1.5 text-xs text-warning">
                      Capped — {formatCurrency(comp.excessToProfit)} excess goes to profit
                    </p>
                  )}
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-3">
                <span className="font-semibold text-text-primary">Total Labor</span>
                <span className="font-bold text-warning">{formatCurrency(fin.totalLaborPaid)}</span>
              </div>
              <p className="text-xs text-text-muted">{fin.laborAsPercentOfRevenue.toFixed(1)}% of total revenue</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">Reserve Allocations</h2>
              <InfoTooltip text="Gross Profit = Total Charged minus all costs and labor. Monthly overhead is deducted, then tax reserves are set aside, and the remainder is split: a retained % stays in the business and the rest is distributed to owners by equity." />
            </div>
            <div className="mb-3 flex items-center justify-between rounded-lg bg-card-elevated p-3">
              <span className="text-sm text-text-secondary">Gross Profit</span>
              <span className={`text-xl font-bold ${fin.grossProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(fin.grossProfit)}
              </span>
            </div>
            {perEventExpense > 0 && (
              <div className="mb-3 space-y-2 text-sm">
                <div className="flex items-center justify-between text-danger">
                  <span>Monthly overhead (per event)</span>
                  <span className="font-medium">−{formatCurrency(perEventExpense)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="font-semibold text-text-primary">Adjusted Profit</span>
                  <span className={`font-bold ${adjustedProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(adjustedProfit)}
                  </span>
                </div>
              </div>
            )}
            {(salesTaxPct > 0 || seTaxPct > 0 || incomeTaxPct > 0) && (
              <div className="mb-3 space-y-2 text-sm">
                {salesTaxPct > 0 && (
                  <div className="flex items-center justify-between text-warning">
                    <span>Sales tax reserve ({salesTaxPct}%)</span>
                    <span className="font-medium">−{formatCurrency(salesTaxReserve)}</span>
                  </div>
                )}
                {seTaxPct > 0 && (
                  <div className="flex items-center justify-between text-warning">
                    <span>Self-employment tax ({seTaxPct}%)</span>
                    <span className="font-medium">−{formatCurrency(seTaxReserve)}</span>
                  </div>
                )}
                {incomeTaxPct > 0 && (
                  <div className="flex items-center justify-between text-warning">
                    <span>Income tax reserve ({incomeTaxPct}%)</span>
                    <span className="font-medium">−{formatCurrency(incomeTaxReserve)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="font-semibold text-text-primary">After Tax Reserves</span>
                  <span className={`font-bold ${afterTaxReserves >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(afterTaxReserves)}
                  </span>
                </div>
              </div>
            )}
            <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs text-accent">
              <span className="text-base leading-none">📅</span>
              <span>Profit distributions are paid out on the <strong>10th of each month</strong>.</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  <span className="text-text-secondary">Business Retained ({rules.profitDistribution.businessRetainedPercent}%)</span>
                  <InfoTooltip text="Portion of profit (after tax reserves) kept in the business for working capital, reinvestment, and contingency—not paid out to owners." />
                </div>
                <span className="font-medium text-text-primary">{formatCurrency(adjustedRetained)}</span>
              </div>
              {adjustedOwnerRows.map((od, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-success/70' : 'bg-success'}`} />
                    <span className="text-text-secondary">{od.name}</span>
                  </div>
                  <span className="font-medium text-text-primary">{formatCurrency(od.amount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs text-text-muted">
              <div className="flex justify-between">
                <span>Food cost rate</span>
                <span>{fin.foodCostPercent}% of subtotal</span>
              </div>
              <div className="flex justify-between">
                <span>Supplies rate</span>
                <span>{rules.costs.suppliesCostPercent}% of subtotal</span>
              </div>
              <div className="flex justify-between">
                <span>Labor rate</span>
                <span>{fin.laborAsPercentOfRevenue.toFixed(1)}% of revenue</span>
              </div>
              <div className="flex justify-between">
                <span>Sales tax reserve</span>
                <span>{salesTaxPct}% of adjusted profit</span>
              </div>
              <div className="flex justify-between">
                <span>SE tax reserve</span>
                <span>{seTaxPct}% of adjusted profit</span>
              </div>
              <div className="flex justify-between">
                <span>Income tax reserve</span>
                <span>{incomeTaxPct}% of adjusted profit</span>
              </div>
            </div>
          </div>

          {fin.warnings.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              {fin.warnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Staff + Expense types ────────────────────────────────────────────────────

type StaffEntry = {
  id: string;
  role: string;
  pay: number;
};

type ExpenseEntry = {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'annual';
};

const DEFAULT_STAFF: StaffEntry[] = [
  { id: 'chef-default', role: 'Lead Chef', pay: 135 },
  { id: 'asst-default', role: 'Assistant', pay: 72 },
];

// ─── Slider input ─────────────────────────────────────────────────────────────

const ACCENT = '#f97316';

function Slider({
  value, min, max, step = 1,
  onChange,
}: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full cursor-pointer"
      style={{ accentColor: ACCENT }}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalculatorPage() {
  const rules = useMoneyRules();
  const [activeTab, setActiveTab] = useState<'calculator' | 'chef' | 'expenses'>('calculator');
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [eventsPerMonth, setEventsPerMonth] = useState(4);
  const [salesTaxPct, setSalesTaxPct] = useState(8);
  const [seTaxPct, setSeTaxPct] = useState(15.3);
  const [incomeTaxPct, setIncomeTaxPct] = useState(15);
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
  const [guests, setGuests] = useState(15);
  const [guestText, setGuestText] = useState('15');
  const [pricePerGuest, setPricePerGuest] = useState(60);
  const [priceText, setPriceText] = useState('60');
  const [gratuityPct, setGratuityPct] = useState(20);
  const [staff, setStaff] = useState<StaffEntry[]>(DEFAULT_STAFF);

  const handleGuestsChange = (v: number) => {
    setGuests(v);
    setGuestText(String(v));
  };

  const handlePriceChange = (v: number) => {
    setPricePerGuest(v);
    setPriceText(String(v));
  };

  // Live calculations
  const subtotal = guests * pricePerGuest;
  const gratuity = Math.round(subtotal * gratuityPct) / 100;
  const totalCharged = subtotal + gratuity;
  const totalStaffPay = staff.reduce((sum, s) => sum + (s.pay || 0), 0);

  const totalMonthlyExpenses = expenses.reduce((sum, e) => {
    const monthly = e.frequency === 'annual' ? (e.amount || 0) / 12 : (e.amount || 0);
    return sum + monthly;
  }, 0);
  const perEventExpense = eventsPerMonth > 0 ? totalMonthlyExpenses / eventsPerMonth : 0;

  function addStaff() {
    setStaff((prev) => [...prev, { id: crypto.randomUUID(), role: 'Staff', pay: 0 }]);
  }

  function removeStaff(id: string) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStaff(id: string, field: 'role' | 'pay', value: string | number) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function addExpense() {
    setExpenses((prev) => [...prev, { id: crypto.randomUUID(), name: '', amount: 0, frequency: 'monthly' }]);
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function updateExpense(id: string, field: 'name' | 'amount' | 'frequency', value: string | number) {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">

        {/* Header + tab switcher */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Event Calculator</h1>
            <p className="mt-1 text-sm text-text-secondary">Adjust guests and price to see live pay breakdown</p>
          </div>
          <div className="flex rounded-lg border border-border bg-card-elevated p-1">
            {([['calculator', 'Calculator'], ['chef', 'Event Summary'], ['expenses', 'Overhead & Reserves']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === id ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'chef' && <ChefBreakdownTab rules={rules} perEventExpense={perEventExpense} salesTaxPct={salesTaxPct} seTaxPct={seTaxPct} incomeTaxPct={incomeTaxPct} />}

        {activeTab === 'expenses' && (
          <div className="mx-auto max-w-3xl space-y-5">
            {/* Events per month */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-1 text-lg font-semibold text-text-primary">Monthly Overhead</h2>
              <p className="mb-5 text-sm text-text-muted">Expenses are prorated per event and deducted from gross profit before owner distributions.</p>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-secondary">Events per month</label>
                <input
                  type="number" min="1" max="30" value={eventsPerMonth}
                  onChange={(e) => setEventsPerMonth(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 rounded-md border border-border bg-card-elevated px-2 py-1.5 text-center text-xl font-bold text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Expense list */}
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">Expense Items</h2>
                <button onClick={addExpense} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-card-elevated hover:text-text-primary">
                  <PlusIcon className="h-4 w-4" /> Add Expense
                </button>
              </div>
              {expenses.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">No expenses added yet. Click "Add Expense" to start.</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((e) => {
                    const monthlyEquiv = e.frequency === 'annual' ? e.amount / 12 : e.amount;
                    return (
                      <div key={e.id} className="rounded-lg bg-card-elevated p-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="text" placeholder="Expense name" value={e.name}
                            onChange={(ev) => updateExpense(e.id, 'name', ev.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                          />
                          {/* Frequency toggle */}
                          <div className="flex shrink-0 rounded-md border border-border bg-card text-xs font-medium overflow-hidden">
                            <button
                              onClick={() => updateExpense(e.id, 'frequency', 'monthly')}
                              className={`px-2.5 py-1.5 transition-colors ${e.frequency === 'monthly' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                            >Mo</button>
                            <button
                              onClick={() => updateExpense(e.id, 'frequency', 'annual')}
                              className={`px-2.5 py-1.5 transition-colors ${e.frequency === 'annual' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                            >Yr</button>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="text-sm text-text-muted">$</span>
                            <input
                              type="number" min="0" step="10" value={e.amount}
                              onChange={(ev) => updateExpense(e.id, 'amount', parseFloat(ev.target.value) || 0)}
                              className="w-24 rounded-md border border-border bg-card px-2 py-2 text-right text-sm font-semibold text-text-primary focus:border-accent focus:outline-none"
                            />
                          </div>
                          <button onClick={() => removeExpense(e.id)} className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-card hover:text-danger">
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                        {e.frequency === 'annual' && e.amount > 0 && (
                          <p className="mt-1.5 pl-1 text-xs text-text-muted">
                            {formatCurrency(monthlyEquiv)}/mo · {formatCurrency(e.amount)}/yr
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {expenses.length > 0 && (
                <div className="mt-4 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold text-text-primary">Total Monthly Equivalent</span>
                    <span className="font-bold text-danger">{formatCurrency(totalMonthlyExpenses)}</span>
                  </div>
                  {expenses.some((e) => e.frequency === 'annual') && (
                    <p className="mt-1 text-xs text-text-muted">Annual fees divided by 12 to get monthly equivalent.</p>
                  )}
                </div>
              )}
            </div>

            {/* Tax Reserve Settings */}
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text-primary">Tax Reserves</h2>
                <InfoTooltip text="Tax reserves are set aside from adjusted profit (after overhead) before owner splits. Sales tax: state sales tax obligations. Self-employment tax (SE): Social Security + Medicare (~15.3%). Income tax: federal and state tax on profit (estimate based on your bracket)." />
              </div>
              <p className="mb-5 text-sm text-text-muted">Reserved before owner profit splits — set aside for tax obligations.</p>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-secondary">Sales Tax Reserve</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min="0" max="30" step="0.5" value={salesTaxPct}
                        onChange={(e) => setSalesTaxPct(parseFloat(e.target.value) || 0)}
                        className="w-20 rounded-md border border-border bg-card-elevated px-2 py-1.5 text-center text-xl font-bold text-text-primary focus:border-accent focus:outline-none"
                      />
                      <span className="text-lg font-semibold text-text-muted">%</span>
                    </div>
                  </div>
                  <Slider value={salesTaxPct} min={0} max={20} step={0.5} onChange={setSalesTaxPct} />
                  <div className="flex justify-between text-xs text-text-muted"><span>0%</span><span>20%</span></div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-secondary">Self-Employment Tax</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min="0" max="30" step="0.1" value={seTaxPct}
                        onChange={(e) => setSeTaxPct(parseFloat(e.target.value) || 0)}
                        className="w-20 rounded-md border border-border bg-card-elevated px-2 py-1.5 text-center text-xl font-bold text-text-primary focus:border-accent focus:outline-none"
                      />
                      <span className="text-lg font-semibold text-text-muted">%</span>
                    </div>
                  </div>
                  <Slider value={seTaxPct} min={0} max={30} step={0.1} onChange={setSeTaxPct} />
                  <div className="flex justify-between text-xs text-text-muted"><span>0%</span><span>30%</span></div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-secondary">Income Tax Reserve</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min="0" max="40" step="0.5" value={incomeTaxPct}
                        onChange={(e) => setIncomeTaxPct(parseFloat(e.target.value) || 0)}
                        className="w-20 rounded-md border border-border bg-card-elevated px-2 py-1.5 text-center text-xl font-bold text-text-primary focus:border-accent focus:outline-none"
                      />
                      <span className="text-lg font-semibold text-text-muted">%</span>
                    </div>
                  </div>
                  <Slider value={incomeTaxPct} min={0} max={40} step={0.5} onChange={setIncomeTaxPct} />
                  <div className="flex justify-between text-xs text-text-muted"><span>0%</span><span>40%</span></div>
                </div>
                {(salesTaxPct > 0 || seTaxPct > 0 || incomeTaxPct > 0) && (
                  <div className="rounded-lg bg-card-elevated p-3 text-xs text-text-muted">
                    Combined reserve: <strong className="text-text-primary">{(salesTaxPct + seTaxPct + incomeTaxPct).toFixed(1)}%</strong> deducted from adjusted profit before owner distributions.
                  </div>
                )}
              </div>
            </div>

            {/* Per-event allocation summary */}
            {totalMonthlyExpenses > 0 && (
              <div className="rounded-lg border-2 border-border bg-card p-5">
                <h2 className="mb-4 text-lg font-semibold text-text-primary">Per-Event Impact</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Total monthly overhead</span>
                    <span className="font-medium text-text-primary">{formatCurrency(totalMonthlyExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Events per month</span>
                    <span className="font-medium text-text-primary">{eventsPerMonth}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <span className="font-semibold text-text-primary">Deducted per event</span>
                    <span className="text-xl font-bold text-danger">−{formatCurrency(perEventExpense)}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-text-muted">This amount is deducted from gross profit before calculating retained earnings and owner distributions in the Calculator and Event Summary tabs.</p>
              </div>
            )}

            {/* Retained earnings balance */}
            <div className="rounded-lg border-2 border-violet-500/30 bg-violet-500/5 p-5">
              <div className="mb-1 flex items-center gap-2">
                <BanknotesIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <h2 className="text-lg font-semibold text-text-primary">Retained Earnings Balance</h2>
                <InfoTooltip text="Running balance of money kept in the business (deposits from event distributions minus withdrawals). Updated when you record transactions in Reports → Owner Monthly." />
              </div>
              <p className="mb-4 text-sm text-text-muted">Current balance from your retained earnings transaction log.</p>
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <span className="text-sm font-medium text-text-secondary">Balance</span>
                  <p className={`text-2xl font-bold ${retainedEarningsBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(retainedEarningsBalance)}
                  </p>
                </div>
                <Link
                  href="/reports/owner-monthly"
                  className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card hover:text-text-primary"
                >
                  View full log →
                </Link>
              </div>
              {retainedTransactions.length === 0 && (
                <p className="mt-3 text-xs text-text-muted">No retained earnings transactions yet. Record distributions in Reports → Owner Monthly to see a balance here.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calculator' && (() => {
          const foodCostPct = rules.costs.primaryFoodCostPercent;
          const suppliesCostPct = rules.costs.suppliesCostPercent;
          const foodCost = subtotal * foodCostPct / 100;
          const suppliesCost = subtotal * suppliesCostPct / 100;
          const totalCosts = foodCost + suppliesCost;
          const scenarioFin = calculateEventFinancials(
            {
              adults: guests,
              children: 0,
              eventType: 'private-dinner',
              eventDate: new Date(),
              distanceMiles: 0,
              premiumAddOn: 0,
              subtotalOverride: subtotal,
            },
            rules
          );
          const scale = scenarioFin.totalCharged > 0 ? totalCharged / scenarioFin.totalCharged : 1;
          const chefComp = scenarioFin.laborCompensation.find((c) => c.role === 'lead');
          const asstComp = scenarioFin.laborCompensation.find((c) => c.role === 'assistant');
          const chefPay = (chefComp?.finalPay ?? 0) * scale;
          const asstPay = (asstComp?.finalPay ?? 0) * scale;
          const totalLaborFromScenario = chefPay + asstPay;
          const grossProfit = totalCharged - totalCosts - totalLaborFromScenario;
          const adjustedGross = grossProfit - perEventExpense;
          const calcSalesTaxReserve = adjustedGross > 0 ? adjustedGross * salesTaxPct / 100 : 0;
          const calcSeTaxReserve = adjustedGross > 0 ? adjustedGross * seTaxPct / 100 : 0;
          const calcIncomeTaxReserve = adjustedGross > 0 ? adjustedGross * incomeTaxPct / 100 : 0;
          const afterTaxReservesCalc = adjustedGross - calcSalesTaxReserve - calcSeTaxReserve - calcIncomeTaxReserve;
          const retainedPct = rules.profitDistribution.businessRetainedPercent;
          const retainedAmt = afterTaxReservesCalc > 0 ? afterTaxReservesCalc * retainedPct / 100 : 0;
          const distributablePct = rules.profitDistribution.ownerDistributionPercent;
          const distributable = afterTaxReservesCalc > 0 ? afterTaxReservesCalc * distributablePct / 100 : 0;

          const ownersList = rules.profitDistribution.owners?.length
            ? rules.profitDistribution.owners
            : [
                { id: 'a', name: `Owner A (${rules.profitDistribution.ownerAEquityPercent}%)`, equityPercent: rules.profitDistribution.ownerAEquityPercent },
                { id: 'b', name: `Owner B (${rules.profitDistribution.ownerBEquityPercent}%)`, equityPercent: rules.profitDistribution.ownerBEquityPercent },
              ];
          const calcOwnerRows = ownersList.map((o) => ({
            name: o.name,
            amount: distributable * o.equityPercent / 100,
          }));

          const ownerA = calcOwnerRows[0];
          const ownerB = calcOwnerRows[1];
          const ownerAAmount = ownerA?.amount ?? 0;
          const ownerBAmount = ownerB?.amount ?? 0;
          const aSorianoTotal = chefPay + ownerAAmount;
          const jSorianoTotal = asstPay + ownerBAmount;
          const aSorianoPct = totalCharged > 0 ? (aSorianoTotal / totalCharged) * 100 : 0;
          const jSorianoPct = totalCharged > 0 ? (jSorianoTotal / totalCharged) * 100 : 0;

          const pct = (amt: number) => totalCharged > 0 ? ((amt / totalCharged) * 100).toFixed(1) : '0.0';

          return (
            <div className="space-y-5">

              {/* ── Inputs ── */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-6 text-lg font-semibold text-text-primary">Scenario Inputs</h2>
                <div className="space-y-6">

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-text-secondary">Number of Guests</label>
                      <input
                        type="number" min="1" max="300" value={guestText}
                        onChange={(e) => { setGuestText(e.target.value); const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setGuests(v); }}
                        onBlur={() => setGuestText(String(guests))}
                        className="w-20 rounded-md border border-border bg-card-elevated px-2 py-1.5 text-center text-xl font-bold text-text-primary focus:border-accent focus:outline-none"
                      />
                    </div>
                    <Slider value={Math.min(guests, 150)} min={1} max={150} onChange={handleGuestsChange} />
                    <div className="flex justify-between text-xs text-text-muted"><span>1</span><span>150 guests</span></div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-text-secondary">Price per Guest</label>
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-semibold text-text-muted">$</span>
                        <input
                          type="number" min="1" max="999" value={priceText}
                          onChange={(e) => { setPriceText(e.target.value); const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setPricePerGuest(v); }}
                          onBlur={() => setPriceText(String(pricePerGuest))}
                          className="w-24 rounded-md border border-border bg-card-elevated px-2 py-1.5 text-center text-xl font-bold text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                    </div>
                    <Slider value={Math.min(Math.max(pricePerGuest, 20), 250)} min={20} max={250} step={5} onChange={handlePriceChange} />
                    <div className="flex justify-between text-xs text-text-muted"><span>$20</span><span>$250</span></div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-text-secondary">Gratuity</label>
                      <span className="text-xl font-bold text-text-primary">{gratuityPct}%</span>
                    </div>
                    <Slider value={gratuityPct} min={0} max={30} onChange={setGratuityPct} />
                    <div className="flex justify-between text-xs text-text-muted"><span>0%</span><span>30%</span></div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-text-secondary">Events per Month</label>
                      <input
                        type="number" min="1" max="30" value={eventsPerMonth}
                        onChange={(e) => setEventsPerMonth(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 rounded-md border border-border bg-card-elevated px-2 py-1.5 text-center text-xl font-bold text-text-primary focus:border-accent focus:outline-none"
                      />
                    </div>
                    <Slider value={eventsPerMonth} min={1} max={20} onChange={setEventsPerMonth} />
                    <div className="flex justify-between text-xs text-text-muted"><span>1</span><span>20 events/mo</span></div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label className="text-sm font-medium text-text-secondary">Staff</label>
                      <button onClick={addStaff} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-card-elevated hover:text-text-primary">
                        <PlusIcon className="h-4 w-4" /> Add Staff
                      </button>
                    </div>
                    <div className="space-y-2">
                      {staff.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-lg bg-card-elevated p-3">
                          <input type="text" value={s.role} onChange={(e) => updateStaff(s.id, 'role', e.target.value)}
                            className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none" />
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="text-sm text-text-muted">$</span>
                            <input type="number" min="0" step="5" value={s.pay}
                              onChange={(e) => updateStaff(s.id, 'pay', parseFloat(e.target.value) || 0)}
                              className="w-24 rounded-md border border-border bg-card px-2 py-2 text-right text-sm font-semibold text-text-primary focus:border-accent focus:outline-none" />
                          </div>
                          <button onClick={() => removeStaff(s.id)} className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-card hover:text-danger">
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Per-person cuts ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border-2 border-accent bg-accent/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-accent">A Soriano</p>
                  <p className="mb-3 text-xs text-text-muted">Lead Chef · Owner</p>
                  <p className="text-3xl font-bold text-text-primary">{formatCurrency(aSorianoTotal)}</p>
                  <p className="mb-3 text-lg font-bold text-accent">{aSorianoPct.toFixed(1)}% of event</p>
                  <div className="space-y-1.5 border-t border-accent/20 pt-3 text-xs">
                    {chefComp && (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="text-text-secondary">Base pay</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-text-muted">{pct(chefComp.basePay * scale)}%</span>
                            <span className="font-medium text-text-primary">{formatCurrency(chefComp.basePay * scale)}</span>
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-text-secondary">Gratuity share</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-text-muted">{pct(chefComp.gratuityShare * scale)}%</span>
                            <span className="font-medium text-text-primary">{formatCurrency(chefComp.gratuityShare * scale)}</span>
                          </span>
                        </div>
                      </>
                    )}
                    {ownerA && (
                      <div className="flex justify-between gap-2">
                        <span className="text-text-secondary">Profit split</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-text-muted">{pct(ownerAAmount)}%</span>
                          <span className="font-medium text-text-primary">{formatCurrency(ownerAAmount)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border-2 border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">J Soriano</p>
                  <p className="mb-3 text-xs text-text-muted">Assistant Chef · Owner</p>
                  <p className="text-3xl font-bold text-text-primary">{formatCurrency(jSorianoTotal)}</p>
                  <p className="mb-3 text-lg font-bold text-text-secondary">{jSorianoPct.toFixed(1)}% of event</p>
                  <div className="space-y-1.5 border-t border-border pt-3 text-xs">
                    {asstComp && (
                      <>
                        <div className="flex justify-between gap-2">
                          <span className="text-text-secondary">Base pay</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-text-muted">{pct(asstComp.basePay * scale)}%</span>
                            <span className="font-medium text-text-primary">{formatCurrency(asstComp.basePay * scale)}</span>
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-text-secondary">Gratuity share</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-text-muted">{pct(asstComp.gratuityShare * scale)}%</span>
                            <span className="font-medium text-text-primary">{formatCurrency(asstComp.gratuityShare * scale)}</span>
                          </span>
                        </div>
                      </>
                    )}
                    {ownerB && (
                      <div className="flex justify-between gap-2">
                        <span className="text-text-secondary">Profit split</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-text-muted">{pct(ownerBAmount)}%</span>
                          <span className="font-medium text-text-primary">{formatCurrency(ownerBAmount)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Revenue ── */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-4 text-lg font-semibold text-text-primary">Revenue</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{guests} guests × {formatCurrency(pricePerGuest)}</span>
                    <span className="font-medium text-text-primary">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Gratuity ({gratuityPct}%)</span>
                    <span className="font-medium text-text-primary">{formatCurrency(gratuity)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-semibold text-text-primary">Total Charged</span>
                    <span className="text-2xl font-bold text-success">{formatCurrency(totalCharged)}</span>
                  </div>
                </div>
              </div>

              {/* ── Cost Breakdown ── */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-4 text-lg font-semibold text-text-primary">Cost Breakdown</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Food Cost ({foodCostPct}% of subtotal)</span>
                    <span className="font-medium text-text-primary">{formatCurrency(foodCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Supplies ({suppliesCostPct}% of subtotal)</span>
                    <span className="font-medium text-text-primary">{formatCurrency(suppliesCost)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-semibold text-text-primary">Total Costs</span>
                    <span className="font-bold text-danger">{formatCurrency(totalCosts)}</span>
                  </div>
                </div>
              </div>

              {/* ── Labor Pay ── */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-4 text-lg font-semibold text-text-primary">Labor Pay</h2>
                <div className="space-y-3">
                  {chefComp && (
                    <div className="rounded-lg bg-card-elevated p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary">Lead Chef</span>
                        <span className="text-xl font-bold text-text-primary">{formatCurrency(chefPay)}</span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">Base {formatCurrency(chefComp.basePay * scale)} + Gratuity share {formatCurrency(chefComp.gratuityShare * scale)} · {pct(chefPay)}% of revenue</p>
                    </div>
                  )}
                  {asstComp && (
                    <div className="rounded-lg bg-card-elevated p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary">Assistant</span>
                        <span className="text-xl font-bold text-text-primary">{formatCurrency(asstPay)}</span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">Base {formatCurrency(asstComp.basePay * scale)} + Gratuity share {formatCurrency(asstComp.gratuityShare * scale)} · {pct(asstPay)}% of revenue</p>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-3">
                    <span className="font-semibold text-text-primary">Total Labor</span>
                    <span className="font-bold text-warning">{formatCurrency(totalLaborFromScenario)}</span>
                  </div>
                  <p className="text-xs text-text-muted">{pct(totalLaborFromScenario)}% of total revenue</p>
                </div>
              </div>

              {/* ── Reserve Allocations ── */}
              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-4 text-lg font-semibold text-text-primary">Reserve Allocations</h2>
                <div className="mb-3 flex items-center justify-between rounded-lg bg-card-elevated p-3">
                  <span className="text-sm text-text-secondary">Gross Profit</span>
                  <span className={`text-xl font-bold ${grossProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(grossProfit)}
                  </span>
                </div>
                {perEventExpense > 0 && (
                  <div className="mb-3 space-y-2 text-sm">
                    <div className="flex justify-between text-danger">
                      <span>Monthly overhead (per event)</span>
                      <span className="font-medium">−{formatCurrency(perEventExpense)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="font-semibold text-text-primary">Adjusted Profit</span>
                      <span className={`font-bold ${adjustedGross >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(adjustedGross)}
                      </span>
                    </div>
                  </div>
                )}
                {(salesTaxPct > 0 || seTaxPct > 0 || incomeTaxPct > 0) && (
                  <div className="mb-3 space-y-2 text-sm">
                    {salesTaxPct > 0 && (
                      <div className="flex justify-between text-warning">
                        <span>Sales tax reserve ({salesTaxPct}%)</span>
                        <span className="font-medium">−{formatCurrency(calcSalesTaxReserve)}</span>
                      </div>
                    )}
                    {seTaxPct > 0 && (
                      <div className="flex justify-between text-warning">
                        <span>Self-employment tax ({seTaxPct}%)</span>
                        <span className="font-medium">−{formatCurrency(calcSeTaxReserve)}</span>
                      </div>
                    )}
                    {incomeTaxPct > 0 && (
                      <div className="flex justify-between text-warning">
                        <span>Income tax reserve ({incomeTaxPct}%)</span>
                        <span className="font-medium">−{formatCurrency(calcIncomeTaxReserve)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="font-semibold text-text-primary">After Tax Reserves</span>
                      <span className={`font-bold ${afterTaxReservesCalc >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(afterTaxReservesCalc)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs text-accent">
                  <span className="text-base leading-none">📅</span>
                  <span>Profit distributions are paid out on the <strong>10th of each month</strong>.</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                      <span className="text-text-secondary">Business Retained ({retainedPct}%)</span>
                      <InfoTooltip text="Portion of profit (after tax reserves) kept in the business for working capital, reinvestment, and contingency—not paid out to owners." />
                    </div>
                    <span className="font-medium text-text-primary">{formatCurrency(retainedAmt)}</span>
                  </div>
                  {calcOwnerRows.map((od, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-success/70' : 'bg-success'}`} />
                        <span className="text-text-secondary">{od.name}</span>
                      </div>
                      <span className="font-medium text-text-primary">{formatCurrency(od.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          );
        })()}
      </div>
    </div>
  );
}

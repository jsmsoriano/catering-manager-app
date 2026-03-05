'use client';

import { useState, useMemo } from 'react';
import {
  calculateWaterfall,
  WATERFALL_DEFAULTS,
  type WaterfallInputs,
} from '@/lib/waterfallCalc';
import { formatCurrency } from '@/lib/moneyRules';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function PctInput({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-text-secondary">{label}</label>
        <span className="text-xs font-bold text-text-primary">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-accent"
      />
      {hint && <p className="mt-0.5 text-[10px] text-text-muted">{hint}</p>}
    </div>
  );
}

function WaterfallRow({
  label,
  value,
  color,
  bold,
  indent,
  sign,
}: {
  label: string;
  value: number;
  color?: string;
  bold?: boolean;
  indent?: boolean;
  sign?: '+' | '-' | '';
}) {
  const prefix = sign === '+' ? '+' : sign === '-' ? '−' : '';
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 ${
        bold ? 'border-t border-border font-semibold' : ''
      } ${indent ? 'pl-8' : ''}`}
    >
      <span className={bold ? 'text-text-primary' : 'text-text-secondary'}>{label}</span>
      <span
        className={`font-medium tabular-nums ${color ?? (bold ? 'text-text-primary' : 'text-text-secondary')}`}
      >
        {prefix}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}

// ─── Stacked bar chart ───────────────────────────────────────────────────────

const SEGMENTS = [
  { key: 'labor', label: 'Labor', color: 'bg-blue-500' },
  { key: 'food', label: 'Food & Reserve', color: 'bg-red-500' },
  { key: 'tax', label: 'Tax', color: 'bg-amber-500' },
  { key: 'profit', label: 'Profit', color: 'bg-emerald-500' },
] as const;

function StackedBar({ pct }: { pct: { labor: number; food: number; tax: number; profit: number } }) {
  const total = pct.labor + pct.food + pct.tax + pct.profit;
  const remainder = Math.max(0, 100 - total);

  return (
    <div>
      {/* Bar */}
      <div className="flex h-8 w-full overflow-hidden rounded-lg border border-border">
        {SEGMENTS.map(({ key, color }) => {
          const width = pct[key];
          if (width <= 0) return null;
          return (
            <div
              key={key}
              className={`${color} transition-all duration-300`}
              style={{ width: `${width}%` }}
              title={`${key}: ${width.toFixed(1)}%`}
            />
          );
        })}
        {remainder > 0.5 && (
          <div className="bg-border/60 transition-all duration-300" style={{ width: `${remainder}%` }} />
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {SEGMENTS.map(({ key, label, color }) => {
          const width = pct[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-sm ${color}`} />
              <span className="text-[11px] text-text-secondary">
                {label}{' '}
                <span className="font-medium text-text-primary">{width.toFixed(1)}%</span>
              </span>
            </div>
          );
        })}
        {remainder > 0.5 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-border/60" />
            <span className="text-[11px] text-text-secondary">
              Uncategorized <span className="font-medium text-text-primary">{remainder.toFixed(1)}%</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ProfitWaterfallCalculator({
  guests,
  pricePerPerson,
  gratuityRate,
}: {
  guests: number;
  pricePerPerson: number;
  gratuityRate: number;
}) {
  const [salesTaxRate, setSalesTaxRate] = useState(WATERFALL_DEFAULTS.salesTaxRate);
  const [foodCostPercent, setFoodCostPercent] = useState(WATERFALL_DEFAULTS.foodCostPercent);
  const [chefLaborPercent, setChefLaborPercent] = useState(WATERFALL_DEFAULTS.chefLaborPercent);
  const [assistantLaborPercent, setAssistantLaborPercent] = useState(WATERFALL_DEFAULTS.assistantLaborPercent);
  const [businessReservePercent, setBusinessReservePercent] = useState(WATERFALL_DEFAULTS.businessReservePercent);
  const [chefGratuityPercent, setChefGratuityPercent] = useState(WATERFALL_DEFAULTS.chefGratuityPercent);
  const [chefOwnershipPercent, setChefOwnershipPercent] = useState(WATERFALL_DEFAULTS.chefOwnershipPercent);
  const [showInputs, setShowInputs] = useState(false);

  const inputs: WaterfallInputs = useMemo(
    () => ({
      guests,
      pricePerPerson,
      gratuityRate,
      salesTaxRate,
      foodCostPercent,
      chefLaborPercent,
      assistantLaborPercent,
      businessReservePercent,
      chefGratuityPercent,
      chefOwnershipPercent,
    }),
    [
      guests,
      pricePerPerson,
      gratuityRate,
      salesTaxRate,
      foodCostPercent,
      chefLaborPercent,
      assistantLaborPercent,
      businessReservePercent,
      chefGratuityPercent,
      chefOwnershipPercent,
    ]
  );

  const result = useMemo(() => calculateWaterfall(inputs), [inputs]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">

      {/* Collapsible inputs */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setShowInputs((s) => !s)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <h2 className="text-base font-semibold text-text-primary">Cost & Split Configuration</h2>
          <span className="text-xs font-medium text-text-muted">{showInputs ? '▲ Hide' : '▼ Adjust'}</span>
        </button>
        {showInputs && (
        <div className="border-t border-border px-5 pb-5 pt-4">
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">

          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Rates</p>
            <PctInput
              label="Sales Tax"
              value={salesTaxRate}
              onChange={setSalesTaxRate}
              min={0} max={15} step={0.5}
              hint="Applied to revenue only"
            />
            <PctInput
              label="Food Cost"
              value={foodCostPercent}
              onChange={setFoodCostPercent}
              min={5} max={60}
              hint="Ingredients + proteins"
            />
            <PctInput
              label="Business Reserve"
              value={businessReservePercent}
              onChange={setBusinessReservePercent}
              min={0} max={30}
              hint="Retained for taxes / ops"
            />
          </div>

          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Labor & Splits</p>
            <PctInput
              label="Chef Labor (% of revenue)"
              value={chefLaborPercent}
              onChange={setChefLaborPercent}
              min={5} max={40}
            />
            <PctInput
              label="Assistant Labor (% of revenue)"
              value={assistantLaborPercent}
              onChange={setAssistantLaborPercent}
              min={0} max={30}
            />
            <PctInput
              label="Chef Gratuity Share"
              value={chefGratuityPercent}
              onChange={setChefGratuityPercent}
              min={0} max={100}
              hint={`Assistant gets ${100 - chefGratuityPercent}%`}
            />
            <PctInput
              label="Chef Ownership (profit split)"
              value={chefOwnershipPercent}
              onChange={setChefOwnershipPercent}
              min={0} max={100}
              hint={`Assistant owns ${100 - chefOwnershipPercent}%`}
            />
          </div>
        </div>
        </div>
        )}
      </div>

      {/* Stacked bar */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-1 text-base font-semibold text-text-primary">Where Every Dollar Goes</h2>
        <p className="mb-4 text-xs text-text-muted">
          {guests} guests × {formatCurrency(pricePerPerson)} = {formatCurrency(result.revenue)} revenue
        </p>
        <StackedBar pct={result.pct} />
      </div>

      {/* Waterfall table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card text-sm">
        <div className="border-b border-border bg-card-elevated px-4 py-3">
          <p className="font-semibold text-text-primary">Money Waterfall</p>
        </div>

        {/* Event Summary */}
        <div className="border-b border-border pb-1 pt-2">
          <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Event Summary
          </p>
          <WaterfallRow label="Revenue" value={result.revenue} sign="+" color="text-text-primary" />
          <WaterfallRow label={`Gratuity (${gratuityRate}%)`} value={result.gratuity} sign="+" color="text-emerald-400" />
          <WaterfallRow label={`Sales Tax (${salesTaxRate}%)`} value={result.salesTax} sign="+" color="text-amber-400" />
          <WaterfallRow label="Total Collected from Customer" value={result.totalCollected} bold color="text-text-primary" />
        </div>

        {/* Expense Breakdown */}
        <div className="border-b border-border pb-1 pt-2">
          <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Expense Breakdown
          </p>
          <WaterfallRow label={`Chef Labor (${chefLaborPercent}%)`} value={result.chefLabor} sign="-" color="text-blue-400" indent />
          <WaterfallRow label={`Assistant Labor (${assistantLaborPercent}%)`} value={result.assistantLabor} sign="-" color="text-blue-400" indent />
          <WaterfallRow label={`Food Cost (${foodCostPercent}%)`} value={result.foodCost} sign="-" color="text-red-400" indent />
          <WaterfallRow label={`Business Reserve (${businessReservePercent}%)`} value={result.businessReserve} sign="-" color="text-red-400" indent />
          <WaterfallRow label={`Sales Tax Reserve (${salesTaxRate}%)`} value={result.salesTax} sign="-" color="text-amber-400" indent />
          <WaterfallRow label="Total Expenses" value={result.totalCosts} bold color="text-danger" />
        </div>

        {/* Profit Section */}
        <div className="border-b border-border pb-1 pt-2">
          <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Profit Distribution
          </p>
          <WaterfallRow
            label="Gross Profit"
            value={result.grossProfit}
            bold
            color={result.grossProfit >= 0 ? 'text-emerald-400' : 'text-danger'}
          />
          <WaterfallRow
            label={`Chef Profit Share (${chefOwnershipPercent}% ownership)`}
            value={result.chefProfit}
            indent
            color="text-emerald-400"
          />
          <WaterfallRow
            label={`Assistant Profit Share (${100 - chefOwnershipPercent}% ownership)`}
            value={result.assistantProfit}
            indent
            color="text-emerald-400"
          />
        </div>

        {/* Gratuity */}
        <div className="pb-1 pt-2">
          <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Gratuity Split
          </p>
          <WaterfallRow label={`Chef Tip (${chefGratuityPercent}%)`} value={result.chefTip} indent color="text-emerald-400" />
          <WaterfallRow label={`Assistant Tip (${100 - chefGratuityPercent}%)`} value={result.assistantTip} indent color="text-emerald-400" />
        </div>
      </div>

      {/* Earnings summary cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Chef */}
        <div className="rounded-xl border-2 border-accent bg-accent/10 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Chef</p>
          <p className="mb-3 text-[11px] text-text-muted">
            {chefOwnershipPercent}% ownership · {chefLaborPercent}% labor · {chefGratuityPercent}% tips
          </p>
          <p className="text-3xl font-bold text-text-primary">{formatCurrency(result.chefTotal)}</p>
          <p className="mb-3 text-sm font-semibold text-accent">
            {result.revenue > 0
              ? ((result.chefTotal / result.totalCollected) * 100).toFixed(1)
              : '0.0'}
            % of collected
          </p>
          <div className="space-y-1.5 border-t border-accent/20 pt-3 text-xs">
            {[
              ['Base Labor', result.chefLabor, 'text-blue-400'],
              ['Gratuity Share', result.chefTip, 'text-emerald-400'],
              ['Profit Share', result.chefProfit, 'text-emerald-400'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="flex justify-between gap-2">
                <span className="text-text-secondary">{label}</span>
                <span className={`font-medium ${color}`}>{formatCurrency(Number(value))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assistant */}
        <div className="rounded-xl border-2 border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Assistant</p>
          <p className="mb-3 text-[11px] text-text-muted">
            {100 - chefOwnershipPercent}% ownership · {assistantLaborPercent}% labor · {100 - chefGratuityPercent}% tips
          </p>
          <p className="text-3xl font-bold text-text-primary">{formatCurrency(result.assistantTotal)}</p>
          <p className="mb-3 text-sm font-semibold text-text-secondary">
            {result.revenue > 0
              ? ((result.assistantTotal / result.totalCollected) * 100).toFixed(1)
              : '0.0'}
            % of collected
          </p>
          <div className="space-y-1.5 border-t border-border pt-3 text-xs">
            {[
              ['Base Labor', result.assistantLabor, 'text-blue-400'],
              ['Gratuity Share', result.assistantTip, 'text-emerald-400'],
              ['Profit Share', result.assistantProfit, 'text-emerald-400'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="flex justify-between gap-2">
                <span className="text-text-secondary">{label}</span>
                <span className={`font-medium ${color}`}>{formatCurrency(Number(value))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Profitability warning */}
      {result.grossProfit < 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Current configuration results in a loss of {formatCurrency(Math.abs(result.grossProfit))}. Reduce labor or food cost percentages.
        </div>
      )}
    </div>
  );
}

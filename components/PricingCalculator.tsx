'use client';

import { useState } from 'react';
import {
  calculateEventFinancials,
  formatCurrency,
} from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import type { EventType, EventFinancials } from '@/lib/types';

export default function PricingCalculator() {
  const rules = useMoneyRules(); // Load saved rules from localStorage

  const [adults, setAdults] = useState(15);
  const [children, setChildren] = useState(0);
  const [eventType, setEventType] = useState<EventType>('private-dinner');
  const [eventDate, setEventDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [distanceMiles, setDistanceMiles] = useState(10);
  const [premiumAddOn, setPremiumAddOn] = useState(0);

  const financials: EventFinancials = calculateEventFinancials({
    adults,
    children,
    eventType,
    eventDate: new Date(eventDate),
    distanceMiles,
    premiumAddOn,
  }, rules); // Use saved rules instead of defaults

  return (
    <div className="w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Event Details
            </h2>

            <div className="space-y-5">
              {/* Event Type */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Event Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="private-dinner">
                    Private Dinner ({formatCurrency(rules.pricing.privateDinnerBasePrice)}/person)
                  </option>
                  <option value="buffet">
                    Buffet Catering ({formatCurrency(rules.pricing.buffetBasePrice)}/person)
                  </option>
                </select>
              </div>

              {/* Adults */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Number of Adults
                </label>
                <input
                  type="number"
                  min="1"
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              {/* Children */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Children (under 13)
                  <span className="ml-2 text-xs text-zinc-500">
                    {rules.pricing.childDiscountPercent}% discount
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              {/* Premium Add-on */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Premium Add-on (per person)
                  <span className="ml-2 text-xs text-zinc-500">
                    ${rules.pricing.premiumAddOnMin}-${rules.pricing.premiumAddOnMax}
                  </span>
                </label>
                <input
                  type="number"
                  min={rules.pricing.premiumAddOnMin}
                  max={rules.pricing.premiumAddOnMax}
                  value={premiumAddOn}
                  onChange={(e) => setPremiumAddOn(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              {/* Event Date */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Event Date
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              {/* Distance */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Distance (miles)
                  <span className="ml-2 text-xs text-zinc-500">
                    First {rules.distance.freeDistanceMiles} miles free
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={distanceMiles}
                  onChange={(e) => setDistanceMiles(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
            </div>
          </div>

          {/* Staffing Info */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
            <h3 className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
              Staffing for this event
            </h3>
            <div className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
              <p>
                <strong>{financials.staffingPlan.totalStaffCount} staff members:</strong>
              </p>
              <ul className="ml-4 list-disc space-y-0.5">
                {financials.staffingPlan.chefRoles.map((role, idx) => (
                  <li key={idx}>
                    {role === 'lead' && 'Lead Chef (Owner A)'}
                    {role === 'overflow' && 'Overflow Chef'}
                    {role === 'full' && 'Full Chef'}
                    {role === 'buffet' && idx === 0 && 'Chef (Owner A)'}
                    {role === 'buffet' && idx === 1 && 'Chef (Owner B)'}
                    {role === 'buffet' && idx > 1 && 'Additional Chef'}
                  </li>
                ))}
                {financials.staffingPlan.assistantNeeded && (
                  <li>Assistant (Owner B)</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="space-y-6">
          {/* Customer Cost */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Customer Cost
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {financials.adultCount} Adults @ {formatCurrency(financials.basePrice + financials.premiumAddOn)}
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(financials.adultCount * (financials.basePrice + financials.premiumAddOn))}
                </span>
              </div>

              {financials.childCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {financials.childCount} Children @ {formatCurrency((financials.basePrice + financials.premiumAddOn) * 0.5)}
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(financials.childCount * (financials.basePrice + financials.premiumAddOn) * 0.5)}
                  </span>
                </div>
              )}

              <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800" />

              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(financials.subtotal)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Gratuity ({financials.gratuityPercent}%)
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(financials.gratuity)}
                </span>
              </div>

              {financials.distanceFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Distance Fee ({distanceMiles} miles)
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(financials.distanceFee)}
                  </span>
                </div>
              )}

              <div className="border-t-2 border-zinc-300 pt-3 dark:border-zinc-700" />

              <div className="flex justify-between text-lg">
                <span className="font-bold text-zinc-900 dark:text-zinc-50">
                  Total Customer Pays
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(financials.totalCharged)}
                </span>
              </div>
            </div>
          </div>

          {/* Business Financials */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
            <h2 className="mb-6 text-xl font-semibold text-emerald-900 dark:text-emerald-100">
              Business Breakdown
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between font-medium text-emerald-800 dark:text-emerald-200">
                <span>Revenue</span>
                <span>{formatCurrency(financials.subtotal + financials.distanceFee)}</span>
              </div>

              <div className="border-t border-emerald-200 pt-2 dark:border-emerald-800" />

              <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                <span>Food Cost ({financials.foodCostPercent}%)</span>
                <span>-{formatCurrency(financials.foodCost)}</span>
              </div>

              <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                <span>Labor Cost ({financials.laborAsPercentOfSubtotal.toFixed(1)}%)</span>
                <span>-{formatCurrency(financials.totalLaborPaid)}</span>
              </div>

              {financials.suppliesCost > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                  <span>Supplies</span>
                  <span>-{formatCurrency(financials.suppliesCost)}</span>
                </div>
              )}

              <div className="border-t border-emerald-200 pt-2 dark:border-emerald-800" />

              <div className="flex justify-between font-semibold text-emerald-900 dark:text-emerald-100">
                <span>Gross Profit</span>
                <span>{formatCurrency(financials.grossProfit)}</span>
              </div>

              <div className="ml-4 space-y-1.5 border-l-2 border-emerald-300 pl-3 dark:border-emerald-700">
                <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-300">
                  <span>Retained ({financials.retainedPercent}%)</span>
                  <span>{formatCurrency(financials.retainedAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-300">
                  <span>Owner A ({rules.profitDistribution.ownerAEquityPercent}%)</span>
                  <span>{formatCurrency(financials.ownerADistribution)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-300">
                  <span>Owner B ({rules.profitDistribution.ownerBEquityPercent}%)</span>
                  <span>{formatCurrency(financials.ownerBDistribution)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {financials.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <h3 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                ⚠️ Warnings
              </h3>
              <ul className="list-disc space-y-1 pl-4 text-xs text-amber-800 dark:text-amber-300">
                {financials.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  calculateEventFinancials,
  formatCurrency,
} from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import { getPricingSlot } from '@/lib/templateConfig';
import type { EventFinancials } from '@/lib/types';

export default function PricingCalculator() {
  const rules = useMoneyRules(); // Load saved rules from localStorage
  const { config } = useTemplateConfig();

  const [adults, setAdults] = useState(15);
  const [children, setChildren] = useState(0);
  const [eventType, setEventType] = useState<string>(config.eventTypes[0]?.id ?? 'private-dinner');
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
    pricingSlot: getPricingSlot(config.eventTypes, eventType),
  }, rules); // Use saved rules instead of defaults

  return (
    <div className="w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-6 text-xl font-semibold text-text-primary">
              Event Details
            </h2>

            <div className="space-y-5">
              {/* Event Type */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Event Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full rounded-md border border-border bg-card-elevated px-4 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {config.eventTypes.map((et) => {
                    const price = et.pricingSlot === 'primary'
                      ? rules.pricing.primaryBasePrice
                      : rules.pricing.secondaryBasePrice;
                    return (
                      <option key={et.id} value={et.id}>
                        {et.label} ({formatCurrency(price)}/person)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Adults */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Number of Adults
                </label>
                <input
                  type="number"
                  min="1"
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-md border border-border bg-card-elevated px-4 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Children */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Children (under 13)
                  <span className="ml-2 text-xs text-text-muted">
                    {rules.pricing.childDiscountPercent}% discount
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-md border border-border bg-card-elevated px-4 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Premium Add-on */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Premium Add-on (per person)
                  <span className="ml-2 text-xs text-text-muted">
                    ${rules.pricing.premiumAddOnMin}-${rules.pricing.premiumAddOnMax}
                  </span>
                </label>
                <input
                  type="number"
                  min={rules.pricing.premiumAddOnMin}
                  max={rules.pricing.premiumAddOnMax}
                  value={premiumAddOn}
                  onChange={(e) => setPremiumAddOn(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full rounded-md border border-border bg-card-elevated px-4 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Event Date */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Event Date
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-card-elevated px-4 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Distance */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Distance (miles)
                  <span className="ml-2 text-xs text-text-muted">
                    First {rules.distance.freeDistanceMiles} miles free
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={distanceMiles}
                  onChange={(e) => setDistanceMiles(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-md border border-border bg-card-elevated px-4 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* Staffing Info */}
          <div className="rounded-lg border border-border bg-card-elevated p-4">
            <h3 className="mb-2 text-sm font-semibold text-text-primary">
              Staffing for this event
            </h3>
            <div className="space-y-1 text-sm text-text-secondary">
              <p>
                <strong className="text-text-primary">{financials.staffingPlan.totalStaffCount} staff members:</strong>
              </p>
              <ul className="ml-4 list-disc space-y-0.5">
                {financials.staffingPlan.chefRoles.map((role, idx) => (
                  <li key={idx}>
                    {role === 'lead' && 'Lead Chef (Owner A)'}
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
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-6 text-xl font-semibold text-text-primary">
              Customer Cost
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  {financials.adultCount} Adults @ {formatCurrency(financials.basePrice + financials.premiumAddOn)}
                </span>
                <span className="font-medium text-text-primary">
                  {formatCurrency(financials.adultCount * (financials.basePrice + financials.premiumAddOn))}
                </span>
              </div>

              {financials.childCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    {financials.childCount} Children @ {formatCurrency((financials.basePrice + financials.premiumAddOn) * 0.5)}
                  </span>
                  <span className="font-medium text-text-primary">
                    {formatCurrency(financials.childCount * (financials.basePrice + financials.premiumAddOn) * 0.5)}
                  </span>
                </div>
              )}

              <div className="border-t border-border pt-3" />

              <div className="flex justify-between">
                <span className="text-text-secondary">Subtotal</span>
                <span className="font-medium text-text-primary">
                  {formatCurrency(financials.subtotal)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Gratuity ({financials.gratuityPercent}%)
                </span>
                <span className="font-medium text-text-primary">
                  {formatCurrency(financials.gratuity)}
                </span>
              </div>

              {financials.distanceFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    Distance Fee ({distanceMiles} miles)
                  </span>
                  <span className="font-medium text-text-primary">
                    {formatCurrency(financials.distanceFee)}
                  </span>
                </div>
              )}

              <div className="border-t-2 border-border pt-3" />

              <div className="flex justify-between text-lg">
                <span className="font-bold text-text-primary">
                  Total Customer Pays
                </span>
                <span className="font-bold text-text-primary">
                  {formatCurrency(financials.totalCharged)}
                </span>
              </div>
            </div>
          </div>

          {/* Business Financials */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-6 text-xl font-semibold text-text-primary">
              Business Breakdown
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between font-medium text-success">
                <span>Revenue</span>
                <span>{formatCurrency(financials.subtotal + financials.distanceFee)}</span>
              </div>

              <div className="border-t border-border pt-2" />

              <div className="flex justify-between text-text-secondary">
                <span>Food Cost ({financials.foodCostPercent}%)</span>
                <span>-{formatCurrency(financials.foodCost)}</span>
              </div>

              <div className="flex justify-between text-text-secondary">
                <span>Labor Cost ({financials.laborAsPercentOfRevenue.toFixed(1)}%)</span>
                <span>-{formatCurrency(financials.totalLaborPaid)}</span>
              </div>

              {financials.suppliesCost > 0 && (
                <div className="flex justify-between text-text-secondary">
                  <span>Supplies</span>
                  <span>-{formatCurrency(financials.suppliesCost)}</span>
                </div>
              )}

              <div className="border-t border-border pt-2" />

              <div className="flex justify-between font-semibold text-success">
                <span>Gross Profit</span>
                <span>{formatCurrency(financials.grossProfit)}</span>
              </div>

              <div className="ml-4 space-y-1.5 border-l-2 border-border pl-3">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Retained ({financials.retainedPercent}%)</span>
                  <span>{formatCurrency(financials.retainedAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Owner A ({rules.profitDistribution.ownerAEquityPercent}%)</span>
                  <span>{formatCurrency(financials.ownerADistribution)}</span>
                </div>
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Owner B ({rules.profitDistribution.ownerBEquityPercent}%)</span>
                  <span>{formatCurrency(financials.ownerBDistribution)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {financials.warnings.length > 0 && (
            <div className="rounded-lg border border-border bg-card-elevated p-4">
              <h3 className="mb-2 text-sm font-semibold text-warning">
                Warnings
              </h3>
              <ul className="list-disc space-y-1 pl-4 text-xs text-text-secondary">
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

'use client';

import { useMemo } from 'react';
import { calculateEventFinancials } from '@/lib/moneyRules';
import { getPricingSlot, type EventTypeConfig } from '@/lib/templateConfig';
import type { MoneyRules } from '@/lib/types';
import type { BookingFormData } from './bookingFormTypes';

interface DetailsTabProps {
  formData: BookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>;
  saveError: string | null;
  onSave: (e: React.FormEvent) => void;
  onBack: () => void;
  eventTypeOptions: EventTypeConfig[];
  rules: MoneyRules;
}

export function DetailsTab({
  formData,
  setFormData,
  saveError,
  onSave,
  onBack,
  eventTypeOptions,
  rules,
}: DetailsTabProps) {
  const pricing = useMemo(() => {
    if (!formData.eventDate || !formData.adults) return null;
    try {
      const pricingSlot = getPricingSlot(eventTypeOptions, formData.eventType);
      return calculateEventFinancials(
        {
          adults: formData.adults,
          children: formData.children,
          eventType: formData.eventType,
          eventDate: new Date(formData.eventDate + 'T12:00:00'),
          distanceMiles: formData.distanceMiles ?? 0,
          premiumAddOn: formData.premiumAddOn ?? 0,
          pricingSlot,
        },
        rules
      );
    } catch {
      return null;
    }
  }, [formData.adults, formData.children, formData.eventType, formData.eventDate, formData.distanceMiles, formData.premiumAddOn, eventTypeOptions, rules]);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <form onSubmit={onSave} className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
      <h2 className="text-lg font-semibold text-text-primary">Event details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-text-secondary">Event type *</label>
          <select
            value={formData.eventType}
            onChange={(e) => setFormData((p) => ({ ...p, eventType: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          >
            {eventTypeOptions.map((et) => (
              <option key={et.id} value={et.id}>{et.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Event date *</label>
          <input
            type="date"
            required
            value={formData.eventDate}
            onChange={(e) => setFormData((p) => ({ ...p, eventDate: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Event time *</label>
          <input
            type="time"
            required
            value={formData.eventTime}
            onChange={(e) => setFormData((p) => ({ ...p, eventTime: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Adults *</label>
          <input
            type="number"
            min={1}
            value={formData.adults}
            onChange={(e) => setFormData((p) => ({ ...p, adults: parseInt(e.target.value) || 1 }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Children</label>
          <input
            type="number"
            min={0}
            value={formData.children}
            onChange={(e) => setFormData((p) => ({ ...p, children: parseInt(e.target.value) || 0 }))}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
        />
      </div>
      {pricing && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Live Pricing Preview</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">
                Subtotal ({formData.adults} adults{formData.children > 0 ? `, ${formData.children} kids` : ''})
              </span>
              <span className="font-medium text-text-primary">{fmt(pricing.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Gratuity ({pricing.gratuityPercent}%)</span>
              <span className="font-medium text-text-primary">{fmt(pricing.gratuity)}</span>
            </div>
            {pricing.distanceFee > 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Distance fee</span>
                <span className="font-medium text-text-primary">{fmt(pricing.distanceFee)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-border pt-2">
              <span className="font-semibold text-text-primary">Total</span>
              <span className="font-bold text-accent">{fmt(pricing.totalCharged)}</span>
            </div>
          </div>
        </div>
      )}

      {saveError && <p className="text-sm text-danger">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
        >
          Back
        </button>
        <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          Save Event Details
        </button>
      </div>
    </form>
  );
}

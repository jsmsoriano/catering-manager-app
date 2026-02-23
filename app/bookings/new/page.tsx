'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatPhone, isValidPhone } from '@/lib/phoneUtils';
import { calculateEventFinancials } from '@/lib/moneyRules';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import { getPricingSlot } from '@/lib/templateConfig';
import type { Booking, BookingPricingSnapshot } from '@/lib/bookingTypes';
import { normalizeBookingWorkflowFields } from '@/lib/bookingWorkflow';
import {
  BOOKING_WIZARD_STEPS,
  getNextStepId,
  type BookingWizardStepId,
} from '@/lib/bookingWizardSteps';

function getDefaultEventDate(dateParam: string | null): string {
  if (dateParam) {
    const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateParam);
    if (match) return dateParam;
  }
  return new Date(Date.now() + 86400000).toISOString().split('T')[0];
}

function saveBookings(bookings: Booking[]) {
  const normalized = bookings.map((b) => normalizeBookingWorkflowFields(b));
  localStorage.setItem('bookings', JSON.stringify(normalized));
  window.dispatchEvent(new Event('bookingsUpdated'));
}

export default function NewBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rules = useMoneyRules();
  const { config: templateConfig } = useTemplateConfig();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Prefill from "Book Again" (customers page) or ?date= from calendar
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem('bookingPrefill') : null;
    if (raw) {
      try {
        const prefill = JSON.parse(raw) as { customerName?: string; customerEmail?: string; customerPhone?: string };
        sessionStorage.removeItem('bookingPrefill');
        setCustomerName((p) => prefill.customerName ?? p);
        setCustomerEmail((p) => prefill.customerEmail ?? p);
        setCustomerPhone((p) => prefill.customerPhone ?? p);
      } catch {
        sessionStorage.removeItem('bookingPrefill');
      }
    }
  }, []);

  const currentStepId: BookingWizardStepId = 'contact';
  const stepIndex = BOOKING_WIZARD_STEPS.findIndex((s) => s.id === currentStepId);
  const nextStepId = getNextStepId(currentStepId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!customerEmail.trim()) {
      setError('Email is required.');
      return;
    }
    if (customerPhone && !isValidPhone(customerPhone)) {
      setError('Phone number must be in (xxx)-xxx-xxxx format.');
      return;
    }
    if (!location.trim()) {
      setError('Event address is required.');
      return;
    }

    const eventType = templateConfig.eventTypes[0]?.id ?? 'private-dinner';
    const pricingSlot = getPricingSlot(templateConfig.eventTypes, eventType);
    const financials = calculateEventFinancials(
      {
        adults: 15,
        children: 0,
        eventType,
        eventDate: new Date(defaultDateStr + 'T12:00:00'),
        distanceMiles: 10,
        premiumAddOn: 0,
        staffingProfileId: undefined,
        pricingSlot,
      },
      rules
    );
    const adultBasePrice =
      pricingSlot === 'primary'
        ? rules.pricing.primaryBasePrice
        : rules.pricing.secondaryBasePrice;
    const pricingSnapshot: BookingPricingSnapshot = {
      adultBasePrice,
      childBasePrice: adultBasePrice * (1 - rules.pricing.childDiscountPercent / 100),
      gratuityPercent: rules.pricing.defaultGratuityPercent,
      capturedAt: new Date().toISOString(),
    };

    const booking: Booking = normalizeBookingWorkflowFields({
      id: `booking-${Date.now()}`,
      eventType,
      eventDate: defaultDateStr,
      eventTime: '18:00',
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      adults: 15,
      children: 0,
      location: location.trim(),
      distanceMiles: 10,
      premiumAddOn: 0,
      subtotal: financials.subtotal,
      gratuity: financials.gratuity,
      distanceFee: financials.distanceFee,
      total: financials.totalCharged,
      status: 'pending',
      serviceStatus: 'pending',
      notes: '',
      pricingSnapshot,
      pricingMode: templateConfig.pricingModeDefault ?? undefined,
      businessType: templateConfig.businessType ?? undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const existing = typeof window !== 'undefined' ? localStorage.getItem('bookings') : null;
    const list: Booking[] = existing ? JSON.parse(existing) : [];
    const filtered = list.filter((b) => b.source !== 'inquiry');
    saveBookings([...filtered, booking]);
    router.push(`/bookings/${booking.id}?step=${nextStepId ?? 'details'}`);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-1">
            {BOOKING_WIZARD_STEPS.map((step, i) => (
              <div key={step.id} className="flex flex-1 items-center">
                <div
                  className={`flex flex-1 flex-col items-center rounded-lg border px-2 py-2 text-center ${
                    i === stepIndex
                      ? 'border-accent bg-accent/10 text-accent'
                      : i < stepIndex
                        ? 'border-accent/50 bg-accent/5 text-text-secondary'
                        : 'border-border bg-card-elevated text-text-muted'
                  }`}
                >
                  <span className="text-xs font-medium">{i + 1}</span>
                  <span className="mt-0.5 truncate text-xs">{step.shortLabel}</span>
                </div>
                {i < BOOKING_WIZARD_STEPS.length - 1 && (
                  <div className="h-0.5 w-2 flex-shrink-0 bg-border" aria-hidden />
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-sm text-text-muted">
            Step 1 of {BOOKING_WIZARD_STEPS.length}: Contact
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">New Event</h1>
          <Link
            href="/bookings"
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
          >
            ← Back to Events
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
          <div>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Customer information</h2>
            <p className="mb-4 text-sm text-text-muted">
              Enter the primary contact details. You&apos;ll set event details on the next step.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Customer name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Email *</label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Phone *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                  placeholder="(xxx)-xxx-xxxx"
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-text-primary ${
                    customerPhone && !isValidPhone(customerPhone) ? 'border-danger' : 'border-border bg-card'
                  }`}
                />
                {customerPhone && !isValidPhone(customerPhone) && (
                  <p className="mt-1 text-xs text-danger">Format: (xxx)-xxx-xxxx</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Event address *
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Event venue or delivery address"
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Link
              href="/bookings"
              className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Next: Event details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

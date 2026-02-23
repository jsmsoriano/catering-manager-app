'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatPhone, isValidPhone } from '@/lib/phoneUtils';
import { DEFAULT_TEMPLATE, type EventTypeConfig } from '@/lib/templateConfig';

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Contact Info',
  2: 'Event Details',
  3: 'Review & Submit',
};

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <div role="list" className="mb-8 flex items-center justify-center gap-0">
      {([1, 2, 3] as Step[]).map((s, i) => (
        <div key={s} role="listitem" className="flex items-center">
          <div
            aria-current={s === current ? 'step' : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              s < current
                ? 'bg-success text-white'
                : s === current
                ? 'bg-accent text-white'
                : 'bg-card-elevated text-text-muted'
            }`}
          >
            {s < current ? '✓' : s}
          </div>
          {i < 2 && (
            <div
              className={`h-0.5 w-12 transition-colors ${s < current ? 'bg-success' : 'bg-border'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Input helpers ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-border bg-card px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InquiryPage() {
  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template config (loaded from public API — no auth required)
  const [eventTypes, setEventTypes] = useState<EventTypeConfig[]>(DEFAULT_TEMPLATE.eventTypes);
  const [occasions, setOccasions]   = useState<string[]>(DEFAULT_TEMPLATE.occasions);
  const [businessName, setBusinessName] = useState('Your Caterer');
  useEffect(() => {
    fetch('/api/public/template')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.eventTypes) && d.eventTypes.length > 0) setEventTypes(d.eventTypes);
        if (Array.isArray(d.occasions) && d.occasions.length > 0) setOccasions(d.occasions);
        if (d.eventTypes?.[0]?.id) setEventType(d.eventTypes[0].id);
        if (d.businessName) setBusinessName(d.businessName);
      })
      .catch(() => {/* use defaults */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 1: Contact
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Step 2: Event Details
  const [eventType, setEventType]   = useState<string>(DEFAULT_TEMPLATE.eventTypes[0]?.id ?? 'private-dinner');
  const [occasion, setOccasion]     = useState('');
  const [eventDate, setEventDate]   = useState('');
  const [eventTime, setEventTime]   = useState('18:00');
  const [location, setLocation]     = useState('');
  const [adults, setAdults]         = useState(10);
  const [children, setChildren]     = useState(0);
  const [notes, setNotes]           = useState('');

  // ── Validation ──────────────────────────────────────────────────────────────

  const step1Valid = name.trim() && isValidPhone(phone);
  const step2Valid = eventDate.trim();

  const canContinue =
    (step === 1 && step1Valid) ||
    (step === 2 && step2Valid) ||
    step === 3;

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError('Service unavailable. Please try again later.');
      setSubmitting(false);
      return;
    }

    const bookingId = `booking-${Date.now()}`;
    const now = new Date().toISOString();

    const bookingRow = {
      app_id:                    bookingId,
      source:                    'inquiry',
      status:                    'pending',
      pipeline_status:           'inquiry',
      pipeline_status_updated_at: now,
      event_type:                eventType,
      event_date:                eventDate,
      event_time:                eventTime,
      customer_name:             name.trim(),
      customer_phone:             phone.trim(),
      customer_email:             email.trim(),
      adults,
      children,
      location:                  location.trim(),
      distance_miles:            0,
      premium_add_on:            0,
      subtotal:                  0,
      gratuity:                  0,
      distance_fee:              0,
      total:                     0,
      notes:                     [occasion ? `Occasion: ${occasion}` : '', notes.trim()].filter(Boolean).join('\n'),
      staff_assignments:         [],
      created_at:                now,
      updated_at:                now,
    };

    const { data: insertedBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingRow)
      .select('id')
      .single();

    if (bookingError) {
      setError('There was a problem submitting your inquiry. Please try again.');
      console.error('[inquiry] booking insert error:', bookingError);
      setSubmitting(false);
      return;
    }

    if (insertedBooking) {
      // event_menus insert is best-effort — the 3-step form doesn't collect per-guest
      // selections yet. Menu is completed when admin converts the inquiry to a booking.
      const { error: menuError } = await supabase.from('event_menus').insert({
        booking_id: bookingId,
        guest_selections: [],
      });
      if (menuError) {
        console.error('[inquiry] event_menus insert error:', menuError);
      }
    }

    // Fire-and-forget inquiry acknowledgment email (best-effort)
    if (email.trim()) {
      fetch('/api/emails/send-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'inquiry_ack',
          customerName: name.trim(),
          booking: { customerEmail: email.trim(), eventDate },
          businessName,
        }),
      }).catch(() => { /* silently ignore — inquiry still submitted */ });
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-md rounded-2xl bg-card p-10 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-text-primary">Request Received!</h1>
          <p className="text-text-secondary">
            Thank you, {name}! We&apos;ll be in touch within <strong>24 hours</strong> to confirm
            availability and discuss the details for your event.
          </p>
          {email && (
            <p className="mt-3 rounded-lg bg-card-elevated px-4 py-3 text-sm text-text-secondary">
              A confirmation has been sent to <strong>{email}</strong>
            </p>
          )}
          <p className="mt-4 text-sm text-text-muted">
            Questions? Call us at {phone}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-text-primary">Book Your Event</h1>
          <p className="mt-2 text-text-muted">Fill out the form below and we&apos;ll get back to you shortly.</p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Card */}
        <div className="rounded-2xl bg-card p-4 shadow-lg sm:p-8">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Step {step} of 3 — {STEP_LABELS[step]}
          </h2>

          {/* ── Step 1: Contact ── */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Your Name" required>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className={inputClass}
                  autoFocus
                />
              </Field>
              <Field label="Phone Number" required>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(xxx)-xxx-xxxx"
                  className={`${inputClass} ${phone && !isValidPhone(phone) ? 'border-danger' : ''}`}
                />
                {phone && !isValidPhone(phone) && (
                  <p className="mt-1 text-xs text-danger">Format: (xxx)-xxx-xxxx</p>
                )}
              </Field>
              <Field label="Email Address">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {/* ── Step 2: Event Details ── */}
          {step === 2 && (
            <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Service Type" required>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className={inputClass}
                  >
                    {eventTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.customerLabel || t.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Occasion">
                  <select
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select occasion…</option>
                    {occasions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Event Date" required>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={inputClass}
                  />
                </Field>
                <Field label="Start Time">
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Venue / Address">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="123 Main St, City, State"
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Number of Adults" required>
                  <input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Number of Children">
                  <input
                    type="number"
                    min={0}
                    value={children}
                    onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Notes / Special Requests">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any special requests, dietary needs, or additional information…"
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Contact summary */}
              <div className="rounded-xl border border-border bg-card-elevated p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Contact</h3>
                <div className="space-y-1 text-sm text-text-primary">
                  <p><span className="font-medium">Name:</span> {name}</p>
                  <p><span className="font-medium">Phone:</span> {phone}</p>
                  {email && <p><span className="font-medium">Email:</span> {email}</p>}
                </div>
              </div>

              {/* Event summary */}
              <div className="rounded-xl border border-border bg-card-elevated p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Event Details</h3>
                <div className="space-y-1 text-sm text-text-primary">
                  <p>
                    <span className="font-medium">Service:</span>{' '}
                    {eventTypes.find((t) => t.id === eventType)?.customerLabel ?? eventType}
                    {occasion && <span className="text-text-muted"> — {occasion}</span>}
                  </p>
                  <p><span className="font-medium">Date:</span> {eventDate} at {eventTime}</p>
                  {location && <p><span className="font-medium">Location:</span> {location}</p>}
                  <p>
                    <span className="font-medium">Guests:</span>{' '}
                    {adults} adult{adults !== 1 ? 's' : ''}
                    {children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}
                  </p>
                  {notes && <p><span className="font-medium">Notes:</span> {notes}</p>}
                </div>
              </div>

              <p className="text-sm text-text-muted">
                Menu selections will be collected when we confirm your booking.
              </p>

              {error && (
                <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-card-elevated"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!canContinue}
              aria-disabled={!canContinue}
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              aria-disabled={submitting}
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit Inquiry'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

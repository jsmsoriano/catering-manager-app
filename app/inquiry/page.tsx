'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatPhone, isValidPhone } from '@/lib/phoneUtils';
import { DEFAULT_TEMPLATE, type EventTypeConfig } from '@/lib/templateConfig';
import { LEAD_SOURCE_OPTIONS, getLeadSourceLabel } from '@/lib/leadSources';

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Lead Contact',
  2: 'Event Information',
  3: 'Lead Review & Submit',
};

const PHASE_LABELS: Record<Step, string> = {
  1: 'Phase 1: Lead Intake',
  2: 'Phase 1: Lead Intake',
  3: 'Phase 2: Qualification Handoff',
};

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
              className={`h-0.5 w-8 sm:w-12 transition-colors ${s < current ? 'bg-success' : 'bg-border'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

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

function getTodayLocalDateISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type DbErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function formatInquirySubmitError(error: DbErrorLike | null | undefined): string {
  if (!error) return 'Could not submit your inquiry. Please try again.';
  if (error.code === '42501') return 'Could not submit your inquiry because database permissions blocked the request.';
  if (error.code === '23502') return 'Could not submit your inquiry because a required field is missing.';
  if (error.code === '23505') return 'Could not submit your inquiry because a duplicate record was detected. Please try again.';
  if (error.code === '22P02') return 'Could not submit your inquiry because one or more values are invalid.';
  const reason = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  return reason ? `Could not submit your inquiry: ${reason}` : 'Could not submit your inquiry. Please try again.';
}

function isMissingColumnError(error: DbErrorLike | null | undefined, column: string): boolean {
  if (!error) return false;
  const haystack = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return haystack.includes(`column "${column.toLowerCase()}"`) || haystack.includes(`'${column.toLowerCase()}'`);
}

export default function InquiryPage() {
  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNextSteps, setShowNextSteps] = useState(true);

  const [eventTypes, setEventTypes] = useState<EventTypeConfig[]>(DEFAULT_TEMPLATE.eventTypes);
  const [occasions, setOccasions] = useState<string[]>(DEFAULT_TEMPLATE.occasions);
  const [businessName, setBusinessName] = useState('Your Caterer');

  useEffect(() => {
    fetch('/api/public/template')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.eventTypes) && d.eventTypes.length > 0) setEventTypes(d.eventTypes);
        if (Array.isArray(d.occasions) && d.occasions.length > 0) setOccasions(d.occasions);
        if (d.eventTypes?.[0]?.id) setEventType(d.eventTypes[0].id);
        if (d.businessName) setBusinessName(d.businessName);
      })
      .catch(() => {
        // Keep defaults.
      });
  }, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [eventType, setEventType] = useState<string>(DEFAULT_TEMPLATE.eventTypes[0]?.id ?? 'private-dinner');
  const [occasion, setOccasion] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('18:00');
  const [location, setLocation] = useState('');
  const [adults, setAdults] = useState(10);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState('');
  const [sourceChannel, setSourceChannel] = useState('');
  const minDate = useMemo(() => getTodayLocalDateISO(), []);

  const step1Valid = name.trim() && isValidPhone(phone);
  const step2Valid = eventDate.trim();
  const canContinue = (step === 1 && step1Valid) || (step === 2 && step2Valid) || step === 3;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError('Service unavailable: database connection is not configured.');
      setSubmitting(false);
      return;
    }

    const bookingId = `booking-${Date.now()}`;
    const now = new Date().toISOString();

    const bookingRow = {
      app_id: bookingId,
      source: 'inquiry',
      source_channel: sourceChannel || null,
      status: 'pending',
      event_type: eventType,
      event_date: eventDate,
      event_time: eventTime,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      customer_email: email.trim(),
      adults,
      children,
      location: location.trim(),
      distance_miles: 0,
      premium_add_on: 0,
      subtotal: 0,
      gratuity: 0,
      distance_fee: 0,
      total: 0,
      notes: [
        occasion ? `Occasion: ${occasion}` : '',
        sourceChannel ? `Lead source: ${getLeadSourceLabel(sourceChannel)}` : '',
        notes.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
      staff_assignments: [],
      created_at: now,
      updated_at: now,
    };

    let insertPayload: Record<string, unknown> = bookingRow;
    let bookingError: DbErrorLike | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.from('bookings').insert(insertPayload);
      if (!error) {
        bookingError = null;
        break;
      }
      bookingError = error;

      if (isMissingColumnError(error, 'source') && 'source' in insertPayload) {
        const { source: _source, ...fallbackRow } = insertPayload;
        insertPayload = fallbackRow;
        continue;
      }
      if (isMissingColumnError(error, 'source_channel') && 'source_channel' in insertPayload) {
        const { source_channel: _sourceChannel, ...fallbackRow } = insertPayload;
        insertPayload = fallbackRow;
        continue;
      }
      break;
    }

    if (bookingError) {
      setError(formatInquirySubmitError(bookingError));
      console.error('[inquiry] booking insert error:', bookingError);
      setSubmitting(false);
      return;
    }

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
      }).catch(() => {
        // Ignore acknowledgment email errors.
      });
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  const handleContinue = () => {
    if (!canContinue || step >= 3) return;
    setStep((s) => (s + 1) as Step);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const target = e.target as HTMLElement;
    if (target.closest('textarea,button,a,select')) return;
    e.preventDefault();
    if (step < 3) {
      handleContinue();
      return;
    }
    if (!submitting) handleSubmit();
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-md rounded-2xl bg-card p-10 text-center shadow-lg">
          <h1 className="mb-2 text-2xl font-bold text-text-primary">Request Received!</h1>
          <p className="text-text-secondary">
            Thank you, {name}! Your request is now in our <strong>New Lead</strong> queue.
            We&apos;ll follow up within <strong>24 hours</strong> to qualify details and send your quote.
          </p>
          {email && (
            <p className="mt-3 rounded-lg bg-card-elevated px-4 py-3 text-sm text-text-secondary">
              A confirmation has been sent to <strong>{email}</strong>
            </p>
          )}
          {showNextSteps && (
            <div className="relative mt-4 rounded-lg bg-card-elevated px-4 py-3 text-left text-sm text-text-secondary">
              <button
                type="button"
                onClick={() => setShowNextSteps(false)}
                aria-label="Close next steps message"
                className="absolute right-2 top-2 rounded p-1 text-text-muted hover:bg-card hover:text-text-primary"
              >
                ×
              </button>
              <p className="mb-2 font-semibold text-text-primary">What happens next:</p>
              <p>1. Phase 2: Sales reviews lead details and availability.</p>
              <p>2. Phase 3: You receive a quote and follow-up sequence.</p>
              <p>3. Once accepted, your lead converts into a confirmed event.</p>
            </div>
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
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-text-primary">New Lead Intake</h1>
          <p className="mt-2 text-text-muted">{businessName}</p>
        </div>

        <StepIndicator current={step} />

        <div className="rounded-2xl bg-card p-4 shadow-lg sm:p-8" onKeyDown={handleCardKeyDown}>
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Step {step} of 3 — {STEP_LABELS[step]}
          </h2>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-accent">
            {PHASE_LABELS[step]}
          </p>

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
              <Field label="How did you hear about us?">
                <select
                  value={sourceChannel}
                  onChange={(e) => setSourceChannel(e.target.value)}
                  className={inputClass}
                >
                  {LEAD_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value || 'none'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

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
                    min={minDate}
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

          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card-elevated p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Contact</h3>
                <div className="space-y-1 text-sm text-text-primary">
                  <p><span className="font-medium">Name:</span> {name}</p>
                  <p><span className="font-medium">Phone:</span> {phone}</p>
                  {email && <p><span className="font-medium">Email:</span> {email}</p>}
                  {sourceChannel && <p><span className="font-medium">Lead Source:</span> {getLeadSourceLabel(sourceChannel)}</p>}
                </div>
              </div>

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

              {error && (
                <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
              )}
            </div>
          )}
        </div>

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
              onClick={handleContinue}
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

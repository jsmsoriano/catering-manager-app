'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatPhone, isValidPhone } from '@/lib/phoneUtils';
import { DEFAULT_TEMPLATE, type EventTypeConfig } from '@/lib/templateConfig';
import { LEAD_SOURCE_OPTIONS, getLeadSourceLabel } from '@/lib/leadSources';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const STEPS: Step[] = [1, 2, 3, 4, 5, 6, 7, 8];

function getLeadPhase(step: Step): string {
  if (step <= 3) return 'Phase 1: Lead Intake';
  if (step <= 7) return 'Phase 2: Event Qualification';
  return 'Phase 3: Lead Submission';
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
  if (error.code === '42501') {
    return 'Could not submit your inquiry because database permissions blocked the request.';
  }
  if (error.code === '23502') {
    return 'Could not submit your inquiry because a required field is missing.';
  }
  if (error.code === '23505') {
    return 'Could not submit your inquiry because a duplicate record was detected. Please try again.';
  }
  if (error.code === '22P02') {
    return 'Could not submit your inquiry because one or more values are invalid.';
  }

  const reason = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  return reason
    ? `Could not submit your inquiry: ${reason}`
    : 'Could not submit your inquiry. Please try again.';
}

function isMissingColumnError(error: DbErrorLike | null | undefined, column: string): boolean {
  if (!error) return false;
  const haystack = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return haystack.includes(`column "${column.toLowerCase()}"`) || haystack.includes(`'${column.toLowerCase()}'`);
}

function emailLooksValid(value: string): boolean {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function InquiryChatPage() {
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNextSteps, setShowNextSteps] = useState(true);

  const [eventTypes, setEventTypes] = useState<EventTypeConfig[]>(DEFAULT_TEMPLATE.eventTypes);
  const [occasions, setOccasions] = useState<string[]>(DEFAULT_TEMPLATE.occasions);
  const [businessName, setBusinessName] = useState('Your Caterer');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [eventType, setEventType] = useState(DEFAULT_TEMPLATE.eventTypes[0]?.id ?? 'private-dinner');
  const [occasion, setOccasion] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [adults, setAdults] = useState(10);
  const [children, setChildren] = useState(0);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceChannel, setSourceChannel] = useState('');

  useEffect(() => {
    fetch('/api/public/template')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.eventTypes) && d.eventTypes.length > 0) {
          setEventTypes(d.eventTypes);
          setEventType(d.eventTypes[0].id);
        }
        if (Array.isArray(d.occasions) && d.occasions.length > 0) setOccasions(d.occasions);
        if (d.businessName) setBusinessName(d.businessName);
      })
      .catch(() => {
        // Keep defaults.
      });
  }, []);

  const eventTypeLabel = useMemo(
    () => eventTypes.find((t) => t.id === eventType)?.customerLabel ?? eventType,
    [eventTypes, eventType]
  );
  const minDate = useMemo(() => getTodayLocalDateISO(), []);

  const stepValid = useMemo(() => {
    if (step === 1) return name.trim().length > 1;
    if (step === 2) return isValidPhone(phone);
    if (step === 3) return emailLooksValid(email);
    if (step === 4) return !!eventType;
    if (step === 5) return !!eventDate;
    if (step === 6) return adults > 0 && children >= 0;
    if (step === 7) return location.trim().length > 2;
    return true;
  }, [step, name, phone, email, eventType, eventDate, adults, children, location]);

  const progress = Math.round((step / STEPS.length) * 100);

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
      event_time: '18:00',
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
      ].filter(Boolean).join('\n'),
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
      console.error('[inquiry-chat] booking insert error:', bookingError);
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

  function nextStep() {
    if (!stepValid) return;
    if (step < 8) setStep((s) => (s + 1) as Step);
  }

  function prevStep() {
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const target = e.target as HTMLElement;
    if (target.closest('textarea,button,a,select')) return;
    e.preventDefault();
    if (step < 8) {
      nextStep();
      return;
    }
    if (!submitting) handleSubmit();
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-bold text-text-primary">Inquiry Submitted</h1>
          <p className="mt-2 text-text-secondary">
            Thanks, {name}. Your request has been created as a new lead and our sales team will follow up soon.
          </p>
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
              <p>1. Phase 2: Sales qualifies event details and availability.</p>
              <p>2. Phase 3: Quote is submitted with follow-up touchpoints.</p>
              <p>3. On acceptance, your lead converts into a confirmed event.</p>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/inquiry" className="rounded-lg border border-border bg-card-elevated px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-card">
              Try Original Form
            </Link>
            <Link href="/" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">{businessName}</p>
            <h1 className="text-2xl font-bold text-text-primary">Lead Intake Assistant</h1>
            <p className="mt-1 text-sm text-text-secondary">Capture contact and event details, then submit as a new lead.</p>
          </div>
          <Link href="/inquiry" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary hover:bg-card-elevated">
            Open Classic Form
          </Link>
        </div>

        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-card-elevated">
          <div className="h-full bg-accent transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6" onKeyDown={handleCardKeyDown}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Question {step} of {STEPS.length}</p>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-accent">{getLeadPhase(step)}</p>

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-text-primary">What is your full name?</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Jane Smith"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-text-primary">What is the best phone number?</p>
              <input
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className={inputClass}
                placeholder="(555)-123-4567"
              />
              <p className="text-xs text-text-muted">Format: (xxx)-xxx-xxxx</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-text-primary">What is your email? (optional)</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-text-primary">What type of event are you planning?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {eventTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEventType(t.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm ${
                      eventType === t.id
                        ? 'border-accent bg-accent/10 text-text-primary'
                        : 'border-border bg-card-elevated text-text-secondary hover:bg-card'
                    }`}
                  >
                    {t.customerLabel}
                  </button>
                ))}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-text-secondary">How did you hear about us? (optional)</p>
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
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-text-primary">When is your event?</p>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                min={minDate}
                className={inputClass}
              />
              <div>
                <p className="mb-2 text-sm font-medium text-text-secondary">Occasion (optional)</p>
                <div className="flex flex-wrap gap-2">
                  {occasions.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOccasion(o)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        occasion === o
                          ? 'border-accent bg-accent/10 text-text-primary'
                          : 'border-border bg-card-elevated text-text-secondary'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-text-primary">How many guests should we plan for?</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-sm text-text-secondary">Adults</p>
                  <input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm text-text-secondary">Children</p>
                  <input
                    type="number"
                    min={0}
                    value={children}
                    onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-text-primary">Where is the event location?</p>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputClass}
                placeholder="City, venue, or full address"
              />
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <p className="text-lg font-semibold text-text-primary">Anything else we should know?</p>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
                placeholder="Special requests, allergies, setup notes, etc."
              />

              <div className="rounded-lg border border-border bg-card-elevated p-4 text-sm">
                <p className="font-semibold text-text-primary">Review</p>
                <p className="mt-1 text-text-secondary">{name} • {phone} • {email || 'No email provided'}</p>
                <p className="text-text-secondary">{eventTypeLabel} • {eventDate}</p>
                <p className="text-text-secondary">{adults} adults, {children} children • {location}</p>
                {sourceChannel && <p className="text-text-secondary">Lead source: {getLeadSourceLabel(sourceChannel)}</p>}
                {occasion && <p className="text-text-secondary">Occasion: {occasion}</p>}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1 || submitting}
              className="rounded-lg border border-border bg-card-elevated px-4 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
            >
              Back
            </button>

            {step < 8 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!stepValid || submitting}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Inquiry'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

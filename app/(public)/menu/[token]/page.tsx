'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MenuSnapshot {
  customerName: string;
  customerEmail: string;
  eventDate: string;
  eventTime: string;
  location: string;
  adults: number;
  children: number;
  businessName: string;
  baseProteins: { protein: string; label: string }[];
  upgradeProteins: { protein: string; label: string }[];
  inclusions: string[];
}

interface MenuToken {
  token: string;
  booking_id: string;
  status: 'pending' | 'submitted' | 'reopened';
  snapshot: MenuSnapshot;
  submissions: GuestSelection[] | null;
  submitted_at: string | null;
  expires_at: string | null;
}

interface GuestSelection {
  id: string;
  guestName: string;
  isAdult: boolean;
  protein1: string;
  protein2: string;
  wantsFriedRice: boolean;
  wantsNoodles: boolean;
  wantsSalad: boolean;
  wantsVeggies: boolean;
  upgradeProteins: string[];
  specialRequests: string;
  allergies: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso));
}

function emptyGuest(index: number, isAdult: boolean, defaultProtein: string): GuestSelection {
  return {
    id: `guest-${index}`,
    guestName: '',
    isAdult,
    protein1: defaultProtein,
    protein2: defaultProtein,
    wantsFriedRice: true,
    wantsNoodles: true,
    wantsSalad: true,
    wantsVeggies: true,
    upgradeProteins: [],
    specialRequests: '',
    allergies: '',
  };
}

function buildInitialSelections(snapshot: MenuSnapshot): GuestSelection[] {
  const defaultProtein = snapshot.baseProteins[0]?.protein ?? 'chicken';
  const list: GuestSelection[] = [];
  for (let i = 0; i < snapshot.adults; i++) {
    list.push(emptyGuest(i + 1, true, defaultProtein));
  }
  for (let i = 0; i < snapshot.children; i++) {
    list.push(emptyGuest(snapshot.adults + i + 1, false, defaultProtein));
  }
  return list;
}

// ─── Guest Card ──────────────────────────────────────────────────────────────

function GuestCard({
  guest,
  index,
  snapshot,
  onChange,
  isSubmitted,
}: {
  guest: GuestSelection;
  index: number;
  snapshot: MenuSnapshot;
  onChange: (updated: GuestSelection) => void;
  isSubmitted: boolean;
}) {
  const [open, setOpen] = useState(true);

  const allProteins = [
    ...snapshot.baseProteins,
    ...snapshot.upgradeProteins,
  ];

  const toggleUpgrade = (protein: string) => {
    const current = guest.upgradeProteins ?? [];
    onChange({
      ...guest,
      upgradeProteins: current.includes(protein)
        ? current.filter((p) => p !== protein)
        : [...current, protein],
    });
  };

  const label = guest.guestName.trim()
    ? guest.guestName
    : `Guest ${index + 1} — ${guest.isAdult ? 'Adult' : 'Child'}`;

  const isComplete = guest.guestName.trim() !== '' && guest.protein1 && guest.protein2;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            isComplete ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-600'
          }`}>
            {isComplete ? '✓' : index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{label}</p>
            {isComplete && !open && (
              <p className="text-xs text-gray-500">
                {guest.protein1} + {guest.protein2}
                {(guest.upgradeProteins ?? []).length > 0 && ` + ${(guest.upgradeProteins ?? []).join(', ')}`}
              </p>
            )}
          </div>
        </div>
        <span className="text-gray-400 text-lg">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-5">
          {/* Guest name */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Guest Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={guest.guestName}
              onChange={(e) => onChange({ ...guest, guestName: e.target.value })}
              disabled={isSubmitted}
              placeholder={guest.isAdult ? 'e.g. Sarah' : 'e.g. Liam (child)'}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Protein 1 */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              1st Protein Choice <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {snapshot.baseProteins.map(({ protein, label: pLabel }) => (
                <button
                  key={protein}
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => onChange({ ...guest, protein1: protein })}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    guest.protein1 === protein
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50/50'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {pLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Protein 2 */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              2nd Protein Choice <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {snapshot.baseProteins.map(({ protein, label: pLabel }) => (
                <button
                  key={protein}
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => onChange({ ...guest, protein2: protein })}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    guest.protein2 === protein
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50/50'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {pLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Upgrade proteins */}
          {snapshot.upgradeProteins.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Upgrades <span className="text-xs font-normal text-gray-400">(optional — select any)</span>
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {snapshot.upgradeProteins.map(({ protein, label: pLabel }) => {
                  const selected = (guest.upgradeProteins ?? []).includes(protein);
                  return (
                    <button
                      key={protein}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => toggleUpgrade(protein)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-amber-400 bg-amber-50 text-amber-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-amber-200 hover:bg-amber-50/50'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {selected ? '✓ ' : ''}{pLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Included sides */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Included Sides <span className="text-xs font-normal text-gray-400">(uncheck to exclude)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'wantsFriedRice', label: 'Fried Rice' },
                { key: 'wantsNoodles',   label: 'Noodles' },
                { key: 'wantsSalad',     label: 'Side Salad' },
                { key: 'wantsVeggies',   label: 'Hibachi Veggies' },
              ].map(({ key, label: sLabel }) => (
                <label key={key} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                  guest[key as keyof GuestSelection]
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                } ${isSubmitted ? 'cursor-not-allowed opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    checked={guest[key as keyof GuestSelection] as boolean}
                    onChange={(e) => onChange({ ...guest, [key]: e.target.checked })}
                    disabled={isSubmitted}
                    className="h-4 w-4 rounded accent-orange-500"
                  />
                  <span className="text-sm text-gray-700">{sLabel}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Allergies / Dietary Restrictions
            </label>
            <input
              type="text"
              value={guest.allergies}
              onChange={(e) => onChange({ ...guest, allergies: e.target.value })}
              disabled={isSubmitted}
              placeholder="e.g. shellfish, dairy, gluten-free"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Special requests */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Special Requests
            </label>
            <textarea
              value={guest.specialRequests}
              onChange={(e) => onChange({ ...guest, specialRequests: e.target.value })}
              disabled={isSubmitted}
              placeholder="Any preferences or notes for the chef..."
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CustomerMenuPage() {
  const params = useParams();
  const token = params.token as string;

  const [menuToken, setMenuToken] = useState<MenuToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expired, setExpired] = useState(false);
  const [selections, setSelections] = useState<GuestSelection[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/menu-token/${token}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        if (res.status === 410) { setExpired(true); return; }
        if (!res.ok) { setNotFound(true); return; }
        const data: MenuToken = await res.json();
        setMenuToken(data);
        if (data.status === 'submitted' && data.submissions) {
          setSelections(data.submissions);
          setSubmitted(true);
        } else {
          setSelections(buildInitialSelections(data.snapshot));
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const updateGuest = (index: number, updated: GuestSelection) => {
    setSelections((prev) => prev.map((g, i) => (i === index ? updated : g)));
  };

  const allComplete = selections.every(
    (g) => g.guestName.trim() !== '' && g.protein1 && g.protein2
  );

  const handleSubmit = async () => {
    if (!allComplete || submitting || submitted) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/menu-token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading your menu form…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center">
          <p className="text-2xl font-bold text-gray-800">Link Not Found</p>
          <p className="mt-2 text-sm text-gray-500">This menu link is invalid or has already been used. Contact your event coordinator for a new link.</p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center">
          <p className="text-2xl font-bold text-gray-800">Link Expired</p>
          <p className="mt-2 text-sm text-gray-500">The deadline to submit menu orders has passed. Please contact your event coordinator.</p>
        </div>
      </div>
    );
  }

  if (!menuToken) return null;
  const { snapshot } = menuToken;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-2xl px-5 py-6">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              <Image
                src="/hibachisun.png"
                alt="Hibachi A Go Go"
                fill
                className="object-contain"
                sizes="56px"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">{snapshot.businessName}</p>
              <h1 className="text-xl font-bold text-gray-900">Guest Menu Orders</h1>
            </div>
          </div>

          {/* Event info */}
          <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50 px-5 py-4">
            <p className="text-base font-semibold text-gray-900">{snapshot.customerName}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              <span>📅 {formatDate(snapshot.eventDate)} at {snapshot.eventTime}</span>
              <span>📍 {snapshot.location}</span>
              <span>👥 {snapshot.adults} adult{snapshot.adults !== 1 ? 's' : ''}{snapshot.children > 0 ? ` + ${snapshot.children} child${snapshot.children !== 1 ? 'ren' : ''}` : ''}</span>
            </div>
          </div>

          {/* Inclusions */}
          {snapshot.inclusions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Every guest includes</p>
              <div className="flex flex-wrap gap-2">
                {snapshot.inclusions.map((item) => (
                  <span key={item} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{item}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Success state ── */}
      {submitted && (
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-8 text-center">
            <p className="text-4xl mb-3">🎉</p>
            <h2 className="text-xl font-bold text-green-800">Orders Submitted!</h2>
            <p className="mt-2 text-sm text-green-700">
              Thank you! We received all {selections.length} guest order{selections.length !== 1 ? 's' : ''}. Our chef will review your selections before the event.
            </p>
            {menuToken.submitted_at && (
              <p className="mt-3 text-xs text-green-600">Submitted {formatDateTime(menuToken.submitted_at)}</p>
            )}
          </div>

          {/* Read-only summary */}
          <h3 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Your Submissions</h3>
          <div className="space-y-4">
            {selections.map((g, i) => (
              <GuestCard
                key={g.id}
                guest={g}
                index={i}
                snapshot={snapshot}
                onChange={() => {}}
                isSubmitted={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Form ── */}
      {!submitted && (
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-700">
              Please fill out each guest&apos;s order below. Every guest must have a name and two protein choices before you can submit.
              {menuToken.expires_at && (
                <> Please submit by <strong>{formatDateTime(menuToken.expires_at)}</strong>.</>
              )}
            </p>
          </div>

          <div className="space-y-4">
            {selections.map((g, i) => (
              <GuestCard
                key={g.id}
                guest={g}
                index={i}
                snapshot={snapshot}
                onChange={(updated) => updateGuest(i, updated)}
                isSubmitted={false}
              />
            ))}
          </div>

          {!allComplete && (
            <p className="mt-4 text-center text-xs text-gray-400">
              Complete all guest names and protein choices to submit.
            </p>
          )}

          {submitError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allComplete || submitting}
            className="mt-6 w-full rounded-xl bg-orange-500 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : `Submit All ${selections.length} Guest Orders`}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="pb-12 text-center">
        <p className="text-xs text-gray-400">{snapshot.businessName} · Powered by Hibachi A Go Go</p>
      </div>
    </div>
  );
}

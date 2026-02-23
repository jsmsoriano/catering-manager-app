'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatCurrency } from '@/lib/moneyRules';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import type { Booking } from '@/lib/bookingTypes';
import type { EventMenu, CateringEventMenu } from '@/lib/menuTypes';
import type { StaffMember } from '@/lib/staffTypes';
import { CATERING_EVENT_MENUS_KEY } from '@/lib/menuCategories';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function formatTime(t: string | null | undefined) {
  if (!t) return '—';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr ?? '00'} ${ampm}`;
}

function beoNumber(id: string) {
  return id.replace(/-/g, '').slice(-8).toUpperCase();
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}

const EVENT_LABELS: Record<string, string> = {
  'private-dinner': 'Private Dinner (Hibachi)',
  'buffet': 'Buffet / Catering',
};

const STAFF_ROLE_LABELS: Record<string, string> = {
  lead_chef:    'Lead Chef',
  chef:         'Chef',
  assistant:    'Assistant',
  server:       'Server',
  bartender:    'Bartender',
  manager:      'Manager',
};

// ─── BEO Page ───────────────────────────────────────────────────────────────

export default function BeoPage() {
  const params = useParams();
  const id = params.id as string;
  const { config } = useTemplateConfig();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [eventMenu, setEventMenu] = useState<EventMenu | null>(null);
  const [cateringMenu, setCateringMenu] = useState<CateringEventMenu | null>(null);
  const [staffRecords, setStaffRecords] = useState<StaffMember[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const bookings: Booking[] = JSON.parse(localStorage.getItem('bookings') || '[]');
    const found = bookings.find((b) => b.id === id) ?? null;
    if (!found) { setNotFound(true); return; }
    setBooking(found);

    // Load event menu (hibachi per-guest)
    if (found.menuId) {
      const menus: EventMenu[] = JSON.parse(localStorage.getItem('eventMenus') || '[]');
      setEventMenu(menus.find((m) => m.id === found.menuId) ?? null);
    }

    // Load catering menu (buffet)
    if (found.cateringMenuId) {
      const cMenus: CateringEventMenu[] = JSON.parse(localStorage.getItem(CATERING_EVENT_MENUS_KEY) || '[]');
      setCateringMenu(cMenus.find((m) => m.id === found.cateringMenuId) ?? null);
    }

    // Load staff
    const staff: StaffMember[] = JSON.parse(localStorage.getItem('staff') || '[]');
    setStaffRecords(staff);
  }, [id]);

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <p className="text-text-muted">Booking not found.</p>
        <Link href="/bookings" className="text-sm text-accent hover:underline">
          ← Back to Bookings
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">Loading…</p>
      </div>
    );
  }

  const guests = booking.adults + (booking.children ?? 0);
  const businessName = config.businessName || 'Your Catering Company';

  // Resolve staff names from assignments
  const assignedStaff = (booking.staffAssignments ?? []).map((a) => {
    const record = staffRecords.find((s) => s.id === a.staffId);
    return { name: record?.name ?? a.staffId, role: a.role ?? '' };
  });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0.75in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media screen {
          .beo-wrap { max-width: 800px; margin: 0 auto; padding: 2rem; }
        }
        .beo-section { margin-bottom: 1.5rem; }
        .beo-table { width: 100%; border-collapse: collapse; }
        .beo-table th, .beo-table td {
          text-align: left; padding: 0.4rem 0.6rem;
          border: 1px solid #d1d5db; font-size: 0.875rem;
        }
        .beo-table th { background: #f3f4f6; font-weight: 600; }
      `}</style>

      <div className="beo-wrap font-sans text-gray-900">

        {/* Screen-only controls */}
        <div className="no-print mb-6 flex items-center justify-between">
          <Link
            href={`/bookings/${booking.id}`}
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
          >
            ← Back to Booking
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Print / Save PDF
          </button>
        </div>

        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="beo-section flex items-start justify-between border-b-2 border-gray-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">{businessName}</h1>
            <p className="mt-0.5 text-sm text-gray-500">Banquet Event Order</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">BEO # {beoNumber(booking.id)}</p>
            <p className="text-xs text-gray-500">Generated {formatDate(new Date().toISOString().split('T')[0])}</p>
          </div>
        </div>

        {/* ─── Section 1: Event Overview ───────────────────────── */}
        <div className="beo-section">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">1 — Event Overview</h2>
          <table className="beo-table">
            <tbody>
              <tr><th style={{width:'30%'}}>Event Type</th><td>{EVENT_LABELS[booking.eventType] ?? capitalize(booking.eventType)}</td></tr>
              <tr><th>Date</th><td>{formatDate(booking.eventDate)}</td></tr>
              <tr><th>Time</th><td>{formatTime(booking.eventTime)}</td></tr>
              <tr><th>Location / Venue</th><td>{booking.location || '—'}</td></tr>
              <tr>
                <th>Guest Count</th>
                <td>
                  {booking.adults} adult{booking.adults !== 1 ? 's' : ''}
                  {(booking.children ?? 0) > 0
                    ? `, ${booking.children} child${booking.children !== 1 ? 'ren' : ''}`
                    : ''}
                  {' '}({guests} total)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── Section 2: Client Info ──────────────────────────── */}
        <div className="beo-section">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">2 — Client Information</h2>
          <table className="beo-table">
            <tbody>
              <tr><th style={{width:'30%'}}>Name</th><td>{booking.customerName}</td></tr>
              <tr><th>Email</th><td>{booking.customerEmail || '—'}</td></tr>
              <tr><th>Phone</th><td>{booking.customerPhone || '—'}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ─── Section 3: Menu ─────────────────────────────────── */}
        <div className="beo-section">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">3 — Menu</h2>

          {/* Hibachi per-guest menu */}
          {eventMenu && eventMenu.guestSelections.length > 0 ? (
            <table className="beo-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Guest</th>
                  <th>Type</th>
                  <th>Proteins</th>
                  <th>Sides</th>
                  <th>Upgrades / Notes</th>
                </tr>
              </thead>
              <tbody>
                {eventMenu.guestSelections.map((g, i) => {
                  const proteins = [g.protein1, g.protein2 && g.protein2 !== g.protein1 ? g.protein2 : null].filter(Boolean).join(' + ');
                  const sides = [
                    g.wantsFriedRice && 'Fried Rice',
                    g.wantsNoodles   && 'Noodles',
                    g.wantsSalad     && 'Salad',
                    g.wantsVeggies   && 'Veggies',
                  ].filter(Boolean).join(', ') || 'None';
                  const extras = [
                    ...(g.upgradeProteins ?? []).map((u) => `+${capitalize(u)}`),
                    g.allergies && `⚠ ${g.allergies}`,
                    g.specialRequests,
                  ].filter(Boolean).join('; ');
                  return (
                    <tr key={g.id ?? i}>
                      <td>{i + 1}</td>
                      <td>{g.guestName || (g.isAdult ? `Adult ${i + 1}` : `Child`)}</td>
                      <td>{g.isAdult ? 'Adult' : 'Child'}</td>
                      <td className="capitalize">{proteins}</td>
                      <td>{sides}</td>
                      <td>{extras || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : cateringMenu && cateringMenu.selectedItems.length > 0 ? (
            /* Catering/buffet menu */
            <table className="beo-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Servings</th>
                  <th>Price / Serving</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {cateringMenu.selectedItems.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td>{item.servings}</td>
                    <td>{formatCurrency(item.pricePerServing)}</td>
                    <td>{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500 italic">No menu on file for this event.</p>
          )}
        </div>

        {/* ─── Section 4: Staff ────────────────────────────────── */}
        <div className="beo-section">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">4 — Staff Assignments</h2>
          {assignedStaff.length > 0 ? (
            <table className="beo-table">
              <thead>
                <tr><th style={{width:'50%'}}>Name</th><th>Role</th></tr>
              </thead>
              <tbody>
                {assignedStaff.map((s, i) => (
                  <tr key={i}>
                    <td>{s.name}</td>
                    <td>{STAFF_ROLE_LABELS[s.role] ?? (capitalize(s.role) || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500 italic">No staff assigned yet.</p>
          )}
        </div>

        {/* ─── Section 5: Financials ───────────────────────────── */}
        <div className="beo-section">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">5 — Financial Summary</h2>
          <table className="beo-table">
            <tbody>
              <tr><th style={{width:'50%'}}>Subtotal</th><td>{formatCurrency(booking.subtotal)}</td></tr>
              {(booking.distanceFee ?? 0) > 0 && (
                <tr><th>Distance Fee</th><td>{formatCurrency(booking.distanceFee)}</td></tr>
              )}
              <tr><th>Gratuity</th><td>{formatCurrency(booking.gratuity)}</td></tr>
              <tr><th style={{fontWeight:'700'}}>Total</th><td style={{fontWeight:'700'}}>{formatCurrency(booking.total)}</td></tr>
              {(booking.depositAmount ?? 0) > 0 && (
                <tr>
                  <th>Deposit ({booking.depositPercent ?? 0}%)</th>
                  <td>
                    {formatCurrency(booking.depositAmount ?? 0)}
                    {booking.depositDueDate ? ` · Due ${formatDate(booking.depositDueDate)}` : ''}
                  </td>
                </tr>
              )}
              <tr>
                <th>Payment Status</th>
                <td className="capitalize">{(booking.paymentStatus ?? 'unpaid').replace(/-/g, ' ')}</td>
              </tr>
              {(booking.amountPaid ?? 0) > 0 && (
                <tr><th>Amount Paid</th><td>{formatCurrency(booking.amountPaid ?? 0)}</td></tr>
              )}
              {(booking.balanceDueAmount ?? 0) > 0 && (
                <tr>
                  <th>Balance Due</th>
                  <td>
                    {formatCurrency(booking.balanceDueAmount ?? 0)}
                    {booking.balanceDueDate ? ` · Due ${formatDate(booking.balanceDueDate)}` : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Section 6: Notes ────────────────────────────────── */}
        {booking.notes && (
          <div className="beo-section">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">6 — Notes / Special Instructions</h2>
            <div
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                padding: '0.75rem',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {booking.notes}
            </div>
          </div>
        )}

        {/* ─── Footer ─────────────────────────────────────────── */}
        <div className="mt-8 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
          {businessName} · BEO #{beoNumber(booking.id)} · Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

      </div>
    </>
  );
}

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ArrowDownTrayIcon, ChevronDownIcon, DocumentTextIcon, EnvelopeIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { useMoneyRules } from '@/lib/useMoneyRules';
import { getBookingServiceStatus } from '@/lib/bookingWorkflow';
import type { Booking } from '@/lib/bookingTypes';
import type { StaffMember as StaffRecord } from '@/lib/staffTypes';
import { CHEF_ROLE_TO_STAFF_ROLE } from '@/lib/staffTypes';

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Format eventTime (e.g. "18:00") to display (e.g. "6:00 PM"). */
function formatEventTime(eventTime: string): string {
  if (!eventTime || !/^\d{1,2}:\d{2}$/.test(eventTime)) return eventTime || '—';
  const [h, m] = eventTime.split(':').map(Number);
  const hour = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const CHEF_ROLE_LABELS: Record<string, string> = {
  lead: 'Lead Chef',
  overflow: 'Overflow Chef',
  full: 'Full Chef',
  buffet: 'Buffet Chef',
  assistant: 'Assistant',
};

interface EventStaffRow {
  name: string;
  role: string;
  roleLabel: string;
  isOwner: boolean;
  ownerRole?: 'owner-a' | 'owner-b';
  basePay: number;
  gratuityShare: number;
  eventPay: number;
}

interface EventSummaryRow {
  booking: Booking;
  eventDate: string;
  customerName: string;
  eventType: string;
  guests: number;
  revenue: number;
  gratuity: number;
  /** Revenue after any discount (booking.subtotal). */
  revenueAfterDiscount: number;
  /** Price per person after discount; 0 if no guests. */
  pricePerPerson: number;
  /** Gratuity percentage applied (e.g. 20). */
  gratuityPercent: number;
  staff: EventStaffRow[];
  /** Cost and profit (from financials). */
  totalStaffCompensation: number;
  foodCost: number;
  suppliesCost: number;
  transportationCost: number;
  totalCosts: number;
  grossProfit: number;
}

export default function EventSummaryReportPage() {
  const rules = useMoneyRules();
  const printRef = useRef<HTMLDivElement>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);
  const [printEventId, setPrintEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [summaryDropdownId, setSummaryDropdownId] = useState<string | null>(null);
  const summaryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (summaryDropdownId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (summaryDropdownRef.current && !summaryDropdownRef.current.contains(e.target as Node)) {
        setSummaryDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [summaryDropdownId]);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('bookings');
        setBookings(raw ? JSON.parse(raw) : []);
      } catch {
        setBookings([]);
      }
    };
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === 'bookings') load(); };
    const onCustom = () => load();
    window.addEventListener('storage', onStorage);
    window.addEventListener('bookingsUpdated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bookingsUpdated', onCustom);
    };
  }, []);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('staff');
        setStaffRecords(raw ? JSON.parse(raw) : []);
      } catch {
        setStaffRecords([]);
      }
    };
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === 'staff') load(); };
    const onCustom = () => load();
    window.addEventListener('storage', onStorage);
    window.addEventListener('staffUpdated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('staffUpdated', onCustom);
    };
  }, []);

  const staffById = useMemo(() => {
    const map = new Map<string, StaffRecord>();
    staffRecords.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffRecords]);

  const completedBookings = useMemo(() => {
    return bookings.filter((b) => getBookingServiceStatus(b) === 'completed');
  }, [bookings]);

  const eventRows: EventSummaryRow[] = useMemo(() => {
    const rows: EventSummaryRow[] = [];
    completedBookings.forEach((booking) => {
      const { financials } = calculateBookingFinancials(booking, rules);
      const staffRows: EventStaffRow[] = [];

      financials.laborCompensation.forEach((comp, compIdx) => {
        const staffRole = CHEF_ROLE_TO_STAFF_ROLE[comp.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
        let name = CHEF_ROLE_LABELS[comp.role] || comp.role;
        let isOwner = false;
        let ownerRole: 'owner-a' | 'owner-b' | undefined;

        if (booking.staffAssignments && staffRole) {
          let sameRoleIndex = 0;
          for (let i = 0; i < compIdx; i++) {
            if (financials.laborCompensation[i].role === comp.role) sameRoleIndex++;
          }
          let matchCount = 0;
          const assignment = booking.staffAssignments.find((a) => {
            if (a.role === staffRole) {
              if (matchCount === sameRoleIndex) return true;
              matchCount++;
            }
            return false;
          });
          if (assignment) {
            const staff = staffById.get(assignment.staffId);
            if (staff) {
              name = staff.name;
              isOwner = staff.isOwner;
              ownerRole = staff.ownerRole;
            }
          }
        }

        staffRows.push({
          name,
          role: comp.role,
          roleLabel: CHEF_ROLE_LABELS[comp.role] || comp.role,
          isOwner,
          ownerRole,
          basePay: comp.basePay,
          gratuityShare: comp.gratuityShare,
          eventPay: comp.finalPay,
        });
      });

      const guests = booking.adults + booking.children;
      const revenueAfterDiscount = booking.subtotal;
      rows.push({
        booking,
        eventDate: booking.eventDate,
        customerName: booking.customerName,
        eventType: booking.eventType === 'private-dinner' ? 'Private Dinner' : 'Buffet',
        guests,
        revenue: financials.subtotal,
        gratuity: financials.gratuity,
        revenueAfterDiscount,
        pricePerPerson: guests > 0 ? Math.round((revenueAfterDiscount / guests) * 100) / 100 : 0,
        gratuityPercent: financials.gratuityPercent,
        staff: staffRows,
        totalStaffCompensation: financials.totalLaborPaid,
        foodCost: financials.foodCost,
        suppliesCost: financials.suppliesCost,
        transportationCost: financials.transportationCost,
        totalCosts: financials.totalCosts,
        grossProfit: financials.grossProfit,
      });
    });
    rows.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    return rows;
  }, [completedBookings, rules, staffById]);

  const selectedEventRow = useMemo(() => {
    if (!selectedEventId) return null;
    return eventRows.find((r) => r.booking.id === selectedEventId) ?? null;
  }, [eventRows, selectedEventId]);

  const getEventPrintContent = (row: EventSummaryRow) => {
    const lines: string[] = [
      `Event Summary`,
      `${format(parseLocalDate(row.eventDate), 'MMMM d, yyyy')} · ${row.eventType} · ${row.guests} guests`,
      ``,
      `Event details`,
      `  Client: ${row.customerName}`,
      `  Event time: ${formatEventTime(row.booking.eventTime)}`,
      `  Address: ${row.booking.location || '—'}`,
      ``,
      `Guests: ${row.guests}`,
      `Revenue (after discount): ${formatCurrency(row.revenueAfterDiscount)}`,
      `Price per person: ${formatCurrency(row.pricePerPerson)}`,
      `Gratuity: ${formatCurrency(row.gratuity)}`,
      `Total: ${formatCurrency(row.revenueAfterDiscount + row.gratuity)}`,
      ``,
      `Cost and expenses`,
      `  Total staff compensation: ${formatCurrency(row.totalStaffCompensation)}`,
      `  Food cost: ${formatCurrency(row.foodCost)}`,
      `  Supplies & transportation: ${formatCurrency(row.suppliesCost + row.transportationCost)}`,
      `  Total cost: ${formatCurrency(row.totalCosts)}`,
      `  Profit: ${formatCurrency(row.grossProfit)}`,
      ``,
      `Staff Assigned & Compensation`,
      ...row.staff.map(
        (s) =>
          `  ${s.name} (${s.roleLabel}): Pay from Revenue ${formatCurrency(s.basePay)}, Gratuity Split ${formatCurrency(s.gratuityShare)}, Total ${formatCurrency(s.eventPay)}`
      ),
    ];
    return lines.join('\n');
  };

  const handlePrint = (row: EventSummaryRow) => {
    setPrintEventId(row.booking.id);
    setTimeout(() => {
      if (printRef.current) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(`
            <!DOCTYPE html>
            <html><head><title>Event Summary - ${row.customerName}</title>
            <style>
              body { font-family: system-ui,sans-serif; padding: 24px; max-width: 640px; margin: 0 auto; }
              h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
              .meta { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }
              table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
              th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; }
              th { font-weight: 600; }
              .total { font-weight: 600; }
            </style></head><body>
            <h1>Event Summary</h1>
            <div class="meta">${format(parseLocalDate(row.eventDate), 'MMMM d, yyyy')} · ${row.eventType} · ${row.guests} guests</div>
            <p><strong>Client:</strong> ${row.customerName} &nbsp; <strong>Event time:</strong> ${formatEventTime(row.booking.eventTime)}<br/><strong>Address:</strong> ${row.booking.location || '—'}</p>
            <p><strong>Guests:</strong> ${row.guests} &nbsp; <strong>Price per person:</strong> ${formatCurrency(row.pricePerPerson)}</p>
            <p><strong>Revenue (after discount):</strong> ${formatCurrency(row.revenueAfterDiscount)} &nbsp; <strong>Gratuity:</strong> ${formatCurrency(row.gratuity)} &nbsp; <strong>Total:</strong> ${formatCurrency(row.revenueAfterDiscount + row.gratuity)}</p>
            <p style="margin-top:1rem;"><strong>Cost and expenses</strong></p>
            <table style="margin-bottom:1rem;">
              <tr><td>Total staff compensation</td><td style="text-align:right;">${formatCurrency(row.totalStaffCompensation)}</td></tr>
              <tr><td>Food cost</td><td style="text-align:right;">${formatCurrency(row.foodCost)}</td></tr>
              <tr><td>Supplies &amp; transportation</td><td style="text-align:right;">${formatCurrency(row.suppliesCost + row.transportationCost)}</td></tr>
              <tr><td>Total cost</td><td style="text-align:right;">${formatCurrency(row.totalCosts)}</td></tr>
              <tr style="border-top:2px solid #eee;"><td><strong>Profit</strong></td><td style="text-align:right;font-weight:600;">${formatCurrency(row.grossProfit)}</td></tr>
            </table>
            <table>
              <thead><tr><th>Staff</th><th>Role</th><th>Pay from Revenue</th><th>Gratuity Split</th><th>Total Compensation</th></tr></thead>
              <tbody>
              ${row.staff.map((s) => `<tr><td>${s.name}</td><td>${s.roleLabel}</td><td>${formatCurrency(s.basePay)}</td><td>${formatCurrency(s.gratuityShare)}</td><td>${formatCurrency(s.eventPay)}</td></tr>`).join('')}
              </tbody>
            </table>
            </body></html>
          `);
          win.document.close();
          win.print();
          win.close();
        }
      }
      setPrintEventId(null);
    }, 100);
  };

  const handleDownload = (row: EventSummaryRow) => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Event Summary - ${row.customerName} - ${row.eventDate}</title>
<style>
  body { font-family: system-ui,sans-serif; padding: 24px; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
  .meta { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; }
  th { font-weight: 600; }
</style></head><body>
<h1>Event Summary</h1>
<div class="meta">${format(parseLocalDate(row.eventDate), 'MMMM d, yyyy')} · ${row.eventType} · ${row.guests} guests</div>
<p><strong>Client:</strong> ${row.customerName} &nbsp; <strong>Event time:</strong> ${formatEventTime(row.booking.eventTime)}<br/><strong>Address:</strong> ${row.booking.location || '—'}</p>
<p><strong>Guests:</strong> ${row.guests} &nbsp; <strong>Price per person:</strong> ${formatCurrency(row.pricePerPerson)}</p>
<p><strong>Revenue (after discount):</strong> ${formatCurrency(row.revenueAfterDiscount)} &nbsp; <strong>Gratuity:</strong> ${formatCurrency(row.gratuity)} &nbsp; <strong>Total:</strong> ${formatCurrency(row.revenueAfterDiscount + row.gratuity)}</p>
<p style="margin-top:1rem;"><strong>Cost and expenses</strong></p>
<table style="margin-bottom:1rem;">
<tr><td>Total staff compensation</td><td style="text-align:right;">${formatCurrency(row.totalStaffCompensation)}</td></tr>
<tr><td>Food cost</td><td style="text-align:right;">${formatCurrency(row.foodCost)}</td></tr>
<tr><td>Supplies &amp; transportation</td><td style="text-align:right;">${formatCurrency(row.suppliesCost + row.transportationCost)}</td></tr>
<tr><td>Total cost</td><td style="text-align:right;">${formatCurrency(row.totalCosts)}</td></tr>
<tr style="border-top:2px solid #eee;"><td><strong>Profit</strong></td><td style="text-align:right;font-weight:600;">${formatCurrency(row.grossProfit)}</td></tr>
</table>
<table>
<thead><tr><th>Staff</th><th>Role</th><th>Pay from Revenue</th><th>Gratuity Split</th><th>Total Compensation</th></tr></thead>
<tbody>
${row.staff.map((s) => `<tr><td>${s.name}</td><td>${s.roleLabel}</td><td>${formatCurrency(s.basePay)}</td><td>${formatCurrency(s.gratuityShare)}</td><td>${formatCurrency(s.eventPay)}</td></tr>`).join('')}
</tbody>
</table>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-summary-${row.eventDate}-${row.customerName.replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmail = (row: EventSummaryRow) => {
    const subject = encodeURIComponent(`Event Summary - ${row.eventDate} - ${row.customerName}`);
    const body = encodeURIComponent(getEventPrintContent(row));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Event Summary Report</h1>
          <p className="mt-1 text-sm text-text-muted">
            Event details, staff assigned, and compensation per event.
          </p>
        </div>
        <Link
          href="/reports"
          className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
        >
          ← Back to Reports
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-text-secondary">Select event</label>
          <select
            value={selectedEventId ?? ''}
            onChange={(e) => setSelectedEventId(e.target.value || null)}
            className="min-w-[260px] rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
          >
            <option value="">All events (list view)</option>
            {eventRows.map((row) => (
              <option key={row.booking.id} value={row.booking.id}>
                {format(parseLocalDate(row.eventDate), 'MMM d, yyyy')} — {row.customerName} — {row.eventType}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div ref={printRef} className="sr-only" aria-hidden>
        {printEventId && eventRows.find((r) => r.booking.id === printEventId) && (
          <div>
            {(() => {
              const row = eventRows.find((r) => r.booking.id === printEventId)!;
              return (
                <div>
                  <h1>Event Summary</h1>
                  <p>{format(parseLocalDate(row.eventDate), 'MMMM d, yyyy')} · {row.customerName}</p>
                  <p>{row.eventType} · {row.guests} guests</p>
                  <p>Event time: {formatEventTime(row.booking.eventTime)} · Address: {row.booking.location || '—'}</p>
                  <p>Guests: {row.guests} · Price per person: {formatCurrency(row.pricePerPerson)}</p>
                  <p>Revenue (after discount): {formatCurrency(row.revenueAfterDiscount)} · Gratuity: {formatCurrency(row.gratuity)}</p>
                  <p><strong>Cost and expenses:</strong> Staff {formatCurrency(row.totalStaffCompensation)} · Food {formatCurrency(row.foodCost)} · Total cost {formatCurrency(row.totalCosts)} · Profit {formatCurrency(row.grossProfit)}</p>
                  <ul>
                    {row.staff.map((s) => (
                      <li key={s.name + s.role}>
                        {s.name} ({s.roleLabel}): Pay from Revenue {formatCurrency(s.basePay)}, Gratuity Split {formatCurrency(s.gratuityShare)}, Total {formatCurrency(s.eventPay)}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {eventRows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-text-muted">
          No completed events. Complete events in Bookings to see them here.
        </div>
      ) : selectedEventRow ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedEventId(null)}
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
            >
              ← Back to list
            </button>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {format(parseLocalDate(selectedEventRow.eventDate), 'EEEE, MMM d, yyyy')}
                </h2>
                <p className="text-text-secondary">{selectedEventRow.customerName}</p>
                <p className="text-sm text-text-muted">
                  {selectedEventRow.eventType} · {selectedEventRow.guests} guests
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrint(selectedEventRow)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
                >
                  <PrinterIcon className="h-4 w-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(selectedEventRow)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => handleEmail(selectedEventRow)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  Email
                </button>
              </div>
            </div>

            <div className="mb-4 overflow-hidden rounded-md border border-border bg-card-elevated">
                <h3 className="bg-orange-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white">Event details</h3>
                <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-text-muted">Client</dt>
                    <dd className="font-medium text-text-primary">{selectedEventRow.customerName}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Event time</dt>
                    <dd className="text-text-primary">{formatEventTime(selectedEventRow.booking.eventTime)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-text-muted">Address</dt>
                    <dd className="text-text-primary">{selectedEventRow.booking.location || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Guests</dt>
                    <dd className="text-text-primary">{selectedEventRow.guests}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Price per person</dt>
                    <dd className="text-text-primary">{formatCurrency(selectedEventRow.pricePerPerson)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Gratuity %</dt>
                    <dd className="text-text-primary">{selectedEventRow.gratuityPercent}%</dd>
                  </div>
                </dl>
              </div>

            <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-card-elevated px-4 py-3">
                <span className="text-sm font-medium text-text-secondary">Revenue</span>
                <span className="text-lg font-semibold text-text-primary">{formatCurrency(selectedEventRow.revenueAfterDiscount + selectedEventRow.gratuity)}</span>
              </div>

            <div className="mb-4 overflow-hidden rounded-md border border-border bg-card-elevated">
                <h3 className="bg-orange-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white">Cost and expenses</h3>
                <div className="px-4 pb-3 pt-1">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-1.5 text-text-secondary">Total staff compensation</td>
                        <td className="py-1.5 text-right font-medium text-text-primary">{formatCurrency(selectedEventRow.totalStaffCompensation)}</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-1.5 text-text-secondary">Food cost</td>
                        <td className="py-1.5 text-right text-text-primary">{formatCurrency(selectedEventRow.foodCost)}</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-1.5 text-text-secondary">Supplies & transportation</td>
                        <td className="py-1.5 text-right text-text-primary">{formatCurrency(selectedEventRow.suppliesCost + selectedEventRow.transportationCost)}</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-1.5 text-text-secondary">Total cost</td>
                        <td className="py-1.5 text-right font-medium text-text-primary">{formatCurrency(selectedEventRow.totalCosts)}</td>
                      </tr>
                      <tr>
                        <td className="border-t-2 border-border pt-3 text-sm font-semibold text-text-primary">Profit</td>
                        <td className="border-t-2 border-border pt-3 text-right text-base font-semibold text-text-primary">{formatCurrency(selectedEventRow.grossProfit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            <div className="overflow-hidden rounded-md border border-border bg-slate-100 dark:bg-slate-800/40">
                <h3 className="bg-orange-500 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white">Staff Compensation Summary</h3>
                <div className="overflow-x-auto px-4 pb-4 pt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 pr-4 text-left font-medium text-text-muted">Name</th>
                        <th className="py-2 pr-4 text-left font-medium text-text-muted">Role</th>
                        <th className="py-2 pr-4 text-right font-medium text-text-muted">Pay from Revenue</th>
                        <th className="py-2 pr-4 text-right font-medium text-text-muted">Gratuity Split</th>
                        <th className="py-2 text-right font-medium text-text-muted">Total Compensation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEventRow.staff.map((s) => (
                        <tr key={`${s.name}-${s.role}`} className="border-b border-border/50">
                          <td className="py-2 pr-4 text-text-primary">
                            {s.name}
                            {s.isOwner && (
                              <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                Owner
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-text-secondary">{s.roleLabel}</td>
                          <td className="py-2 pr-4 text-right text-text-primary">{formatCurrency(s.basePay)}</td>
                          <td className="py-2 pr-4 text-right text-text-primary">{formatCurrency(s.gratuityShare)}</td>
                          <td className="py-2 text-right text-text-primary">{formatCurrency(s.eventPay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card-elevated">
                <th className="px-4 py-3 text-left font-medium text-text-muted">Date</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Client</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Event type</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted">Guests</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted">Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted w-32">Action</th>
              </tr>
            </thead>
            <tbody>
              {eventRows.map((row) => (
                <tr key={row.booking.id} className="border-b border-border/50 hover:bg-card-elevated/50">
                  <td className="px-4 py-3 text-text-primary">{format(parseLocalDate(row.eventDate), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{row.customerName}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.eventType}</td>
                  <td className="px-4 py-3 text-right text-text-primary">{row.guests}</td>
                  <td className="px-4 py-3 text-right text-text-primary">{formatCurrency(row.revenueAfterDiscount + row.gratuity)}</td>
                  <td className="px-4 py-3 text-right">
                    <div
                      ref={summaryDropdownId === row.booking.id ? summaryDropdownRef : undefined}
                      className="relative inline-block"
                    >
                      <button
                        type="button"
                        onClick={() => setSummaryDropdownId((prev) => (prev === row.booking.id ? null : row.booking.id))}
                        className="inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
                      >
                        Summary
                        <ChevronDownIcon className={`h-4 w-4 transition-transform ${summaryDropdownId === row.booking.id ? 'rotate-180' : ''}`} />
                      </button>
                      {summaryDropdownId === row.booking.id && (
                        <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-md border border-border bg-card py-1 shadow-lg" role="menu">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEventId(row.booking.id);
                              setSummaryDropdownId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-elevated"
                            role="menuitem"
                          >
                            <DocumentTextIcon className="h-4 w-4 shrink-0" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDownload(row);
                              setSummaryDropdownId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-elevated"
                            role="menuitem"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4 shrink-0" />
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleEmail(row);
                              setSummaryDropdownId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-elevated"
                            role="menuitem"
                          >
                            <EnvelopeIcon className="h-4 w-4 shrink-0" />
                            Email
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

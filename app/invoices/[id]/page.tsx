'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { formatCurrency, loadRules } from '@/lib/moneyRules';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import type { Booking, BookingPricingSnapshot } from '@/lib/bookingTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function safeParseList<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getSnapshot(booking: Booking): BookingPricingSnapshot {
  if (booking.pricingSnapshot) return booking.pricingSnapshot;
  const rules = loadRules();
  const basePrice =
    booking.eventType === 'private-dinner'
      ? rules.pricing.primaryBasePrice
      : rules.pricing.secondaryBasePrice;
  return {
    adultBasePrice: basePrice,
    childBasePrice: basePrice * (1 - rules.pricing.childDiscountPercent / 100),
    gratuityPercent: rules.pricing.defaultGratuityPercent,
    capturedAt: booking.createdAt,
  };
}

// ─── Line item type ───────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { config } = useTemplateConfig();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); return; }
    const all = safeParseList<Booking>(localStorage.getItem('bookings'));
    const found = all.find((b) => b.id === id) ?? null;
    if (found) setBooking(found);
    else setNotFound(true);
  }, [id]);

  const snapshot = useMemo(() => (booking ? getSnapshot(booking) : null), [booking]);

  const lineItems = useMemo((): LineItem[] => {
    if (!booking || !snapshot) return [];
    const items: LineItem[] = [];

    const eventLabel =
      config.eventTypes.find((e) => e.id === booking.eventType)?.customerLabel ??
      booking.eventType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    items.push({
      description: `${eventLabel} — Adults`,
      qty: booking.adults,
      rate: snapshot.adultBasePrice,
      amount: booking.adults * snapshot.adultBasePrice,
    });

    if (booking.children > 0) {
      const discountPct = Math.round(
        (1 - snapshot.childBasePrice / snapshot.adultBasePrice) * 100
      );
      items.push({
        description: `${eventLabel} — Children (${discountPct}% off)`,
        qty: booking.children,
        rate: snapshot.childBasePrice,
        amount: booking.children * snapshot.childBasePrice,
      });
    }

    if (booking.premiumAddOn > 0) {
      const totalGuests = booking.adults + booking.children;
      items.push({
        description: 'Premium Add-on',
        qty: totalGuests,
        rate: booking.premiumAddOn,
        amount: totalGuests * booking.premiumAddOn,
      });
    }

    if (booking.discountType && (booking.discountValue ?? 0) > 0) {
      const serviceSubtotal = items.reduce((s, l) => s + l.amount, 0);
      if (booking.discountType === 'percent') {
        const discountAmount =
          Math.round(serviceSubtotal * (booking.discountValue! / 100) * 100) / 100;
        items.push({
          description: `Discount (${booking.discountValue}%)`,
          qty: 1,
          rate: -discountAmount,
          amount: -discountAmount,
        });
      } else {
        items.push({
          description: 'Discount',
          qty: 1,
          rate: -booking.discountValue!,
          amount: -booking.discountValue!,
        });
      }
    }

    if ((booking.distanceFee ?? 0) > 0) {
      items.push({
        description: 'Travel Fee',
        qty: 1,
        rate: booking.distanceFee,
        amount: booking.distanceFee,
      });
    }

    return items;
  }, [booking, snapshot, config]);

  const subtotal = booking?.subtotal ?? 0;
  const gratuityAmount = booking?.gratuity ?? 0;
  const total = booking?.total ?? 0;
  const amountPaid = booking?.amountPaid ?? 0;
  const balanceDue = Math.max(0, total - amountPaid);

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-text-muted">Invoice not found.</p>
        <Link href="/invoices" className="text-sm text-accent hover:underline">
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  if (!booking || !snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-text-muted">Loading…</p>
      </div>
    );
  }

  const eventDate = parseLocalDate(booking.eventDate);
  const formattedDate = format(eventDate, 'EEEE, MMMM d, yyyy');
  const formattedTime = booking.eventTime
    ? (() => {
        const [h, m] = booking.eventTime.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m);
        return format(date, 'h:mm a');
      })()
    : null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 print:bg-white print:p-0">
      {/* Controls — hidden on print */}
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href="/invoices"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card-elevated"
        >
          ← Invoices
        </Link>
        <Link
          href={`/bookings?bookingId=${booking.id}`}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card-elevated"
        >
          View Booking →
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Invoice card — intentionally uses white/gray for clean print output */}
      <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md print:max-w-none print:rounded-none print:border-0 print:shadow-none">

        {/* Accent top bar */}
        <div className="h-2 bg-orange-500" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-8 pb-6 pt-8 sm:px-10">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt={config.businessName || 'Catering Co.'}
              width={72}
              height={72}
              className="object-contain"
              priority
            />
            <p className="text-lg font-bold text-gray-900">{config.businessName || 'Catering Co.'}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold tracking-widest text-orange-500 uppercase sm:text-4xl">
              Invoice
            </p>
            <p className="mt-1 text-xs font-medium tracking-wide text-gray-400">
              #{booking.id.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Bill to + Event details */}
        <div className="grid grid-cols-1 gap-4 bg-gray-50 px-8 py-5 sm:grid-cols-2 sm:gap-6 sm:px-10 sm:py-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500">Bill To</p>
            <p className="mt-2 font-semibold text-gray-900">{booking.customerName}</p>
            {booking.customerEmail && (
              <p className="text-sm text-gray-600">{booking.customerEmail}</p>
            )}
            {booking.customerPhone && (
              <p className="text-sm text-gray-600">{booking.customerPhone}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500">Event Details</p>
            <p className="mt-2 font-semibold text-gray-900">
              {config.eventTypes.find((e) => e.id === booking.eventType)?.customerLabel ??
                booking.eventType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </p>
            <p className="text-sm text-gray-600">{formattedDate}</p>
            {formattedTime && <p className="text-sm text-gray-600">{formattedTime}</p>}
            {booking.location && (
              <p className="mt-1 text-sm text-gray-600">{booking.location}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              {booking.adults} adult{booking.adults !== 1 ? 's' : ''}
              {booking.children > 0 &&
                ` · ${booking.children} child${booking.children !== 1 ? 'ren' : ''}`}
            </p>
          </div>
        </div>

        {/* Line items table */}
        <div className="overflow-x-auto px-4 py-6 sm:px-10">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="bg-orange-500 text-white">
                <th className="rounded-l-md px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">
                  Description
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">
                  Qty
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">
                  Rate
                </th>
                <th className="rounded-r-md px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineItems.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-gray-800">{item.description}</td>
                  <td className="px-3 py-3 text-center text-gray-600">{item.qty}</td>
                  <td className="px-3 py-3 text-right text-gray-600">
                    {formatCurrency(Math.abs(item.rate))}
                    {item.rate < 0 ? ' off' : ''}
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-medium ${
                      item.amount < 0 ? 'text-red-500' : 'text-gray-900'
                    }`}
                  >
                    {item.amount < 0
                      ? `−${formatCurrency(Math.abs(item.amount))}`
                      : formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 px-8 pb-8 sm:px-10">
          <div className="ml-auto max-w-xs space-y-2 pt-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Gratuity ({snapshot.gratuityPercent}%)</span>
              <span>{formatCurrency(gratuityAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            {balanceDue <= 0 && amountPaid > 0 ? (
              <>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Amount Paid</span>
                  <span className="text-green-600">−{formatCurrency(amountPaid)}</span>
                </div>
                <div className="-mx-3 mt-1 flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 text-base font-bold text-white">
                  ✓ Paid in Full
                </div>
              </>
            ) : amountPaid > 0 ? (
              <>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Amount Paid</span>
                  <span className="text-green-600">−{formatCurrency(amountPaid)}</span>
                </div>
                <div className="-mx-3 mt-1 flex justify-between rounded-lg bg-orange-500 px-4 py-3 text-base font-bold text-white">
                  <span>Balance Due</span>
                  <span>{formatCurrency(balanceDue)}</span>
                </div>
              </>
            ) : (
              <div className="-mx-3 mt-1 flex justify-between rounded-lg bg-orange-500 px-4 py-3 text-base font-bold text-white">
                <span>Amount Due</span>
                <span>{formatCurrency(total)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-4 border-orange-500 bg-gray-900 px-10 py-5 text-center">
          <p className="text-sm font-semibold text-orange-400">
            Thank you for choosing {config.businessName || 'us'}!
          </p>
          <p className="mt-1 text-xs text-gray-500">We look forward to serving you.</p>
        </div>
      </div>
    </div>
  );
}

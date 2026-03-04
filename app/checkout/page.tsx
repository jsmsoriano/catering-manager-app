'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/moneyRules';
import {
  calculateOrderTotals,
  clearOrderDraft,
  generateOrderNumber,
  loadOrderDraft,
  loadOrders,
  saveOrders,
} from '@/lib/orderStorage';
import type { OrderServiceType, Order } from '@/lib/orderTypes';

function getTodayLocalDateISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CheckoutPage() {
  const draft = useMemo(() => loadOrderDraft(), []);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceType, setServiceType] = useState<OrderServiceType>('pickup');
  const [eventDate, setEventDate] = useState(getTodayLocalDateISO());
  const [eventTimeWindow, setEventTimeWindow] = useState('17:00 - 18:00');
  const [location, setLocation] = useState('');
  const [tip, setTip] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        subtotal: draft?.subtotal ?? 0,
        serviceType,
        tip: Math.max(0, tip || 0),
        discount: Math.max(0, discount || 0),
      }),
    [draft?.subtotal, serviceType, tip, discount]
  );

  if (!draft || draft.items.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-bold text-text-primary">Checkout</h1>
          <p className="mt-2 text-sm text-text-muted">Your cart is empty. Add items first.</p>
          <Link
            href="/order"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            Go to Online Ordering
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerName.trim() || !customerPhone.trim() || !eventDate || !eventTimeWindow.trim()) {
      setError('Please complete required fields.');
      return;
    }
    if (serviceType !== 'pickup' && !location.trim()) {
      setError('Delivery/drop-off requires a location.');
      return;
    }

    const now = new Date().toISOString();
    const orderNumber = generateOrderNumber();
    const order: Order = {
      id: `order-${Date.now()}`,
      orderNumber,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      serviceType,
      eventDate,
      eventTimeWindow: eventTimeWindow.trim(),
      location: location.trim(),
      notes: notes.trim(),
      items: draft.items,
      subtotal: draft.subtotal,
      tax: totals.tax,
      deliveryFee: totals.deliveryFee,
      tip: Math.max(0, tip || 0),
      discount: Math.max(0, discount || 0),
      total: totals.total,
      paymentStatus: 'unpaid',
      fulfillmentStatus: 'new',
      sourceChannel: 'online_order',
      createdAt: now,
      updatedAt: now,
    };

    const orders = loadOrders();
    saveOrders([order, ...orders]);
    clearOrderDraft();
    window.location.assign(`/order/confirmed/${orderNumber}`);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_340px]">
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5">
          <h1 className="text-2xl font-bold text-text-primary">Checkout</h1>
          <p className="mt-1 text-sm text-text-muted">Capture customer details and place the order.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-text-secondary">Full Name *</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">Phone *</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">Service Type *</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as OrderServiceType)}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
                <option value="dropoff">Drop-off Catering</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">Date *</label>
              <input
                type="date"
                min={getTodayLocalDateISO()}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">Time Window *</label>
              <input
                value={eventTimeWindow}
                onChange={(e) => setEventTimeWindow(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-text-secondary">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Required for delivery/drop-off"
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">Tip</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={tip}
                onChange={(e) => setTip(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">Discount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-text-secondary">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary"
              />
            </div>
          </div>

          {error && <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="mt-5 flex gap-2">
            <Link
              href="/order"
              className="rounded-lg border border-border bg-card-elevated px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-card"
            >
              Back to Menu
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
            >
              Place Order
            </button>
          </div>
        </form>

        <aside className="h-fit rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6">
          <h2 className="text-lg font-semibold text-text-primary">Order Summary</h2>
          <div className="mt-3 space-y-2">
            {draft.items.map((item) => (
              <div key={item.menuItemId} className="flex items-center justify-between text-sm">
                <p className="text-text-secondary">
                  {item.qty} x {item.name}
                </p>
                <p className="text-text-primary">{formatCurrency(item.lineTotal)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="text-text-secondary">Subtotal</p>
              <p className="text-text-primary">{formatCurrency(draft.subtotal)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-text-secondary">Tax</p>
              <p className="text-text-primary">{formatCurrency(totals.tax)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-text-secondary">Delivery Fee</p>
              <p className="text-text-primary">{formatCurrency(totals.deliveryFee)}</p>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <p className="font-medium text-text-primary">Total</p>
              <p className="font-semibold text-text-primary">{formatCurrency(totals.total)}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

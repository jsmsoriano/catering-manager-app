'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatCurrency } from '@/lib/moneyRules';
import { normalizeBookingWorkflowFields } from '@/lib/bookingWorkflow';
import type { Booking } from '@/lib/bookingTypes';
import type { Order, OrderFulfillmentStatus } from '@/lib/orderTypes';
import { loadOrders, saveOrders } from '@/lib/orderStorage';

const STATUS_OPTIONS: { value: OrderFulfillmentStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_prep', label: 'In Prep' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id ?? '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrders(loadOrders());
  }, []);

  const order = useMemo(() => orders.find((o) => o.id === orderId) ?? null, [orders, orderId]);

  const updateOrder = (next: Order) => {
    const updated = orders.map((o) => (o.id === next.id ? next : o));
    setOrders(updated);
    saveOrders(updated);
    setMessage('Order saved.');
    setTimeout(() => setMessage(null), 1600);
  };

  const updateStatus = (status: OrderFulfillmentStatus) => {
    if (!order) return;
    updateOrder({
      ...order,
      fulfillmentStatus: status,
      updatedAt: new Date().toISOString(),
    });
  };

  const convertToBooking = () => {
    if (!order) return;
    const existingRaw = typeof window !== 'undefined' ? localStorage.getItem('bookings') : null;
    const existing: Booking[] = existingRaw ? JSON.parse(existingRaw) : [];
    const now = new Date().toISOString();
    const notes = [
      `Converted from online order ${order.orderNumber}`,
      `Service type: ${order.serviceType}`,
      order.notes ? `Order notes: ${order.notes}` : '',
      '',
      'Items:',
      ...order.items.map((item) => `- ${item.qty} x ${item.name}`),
    ]
      .filter(Boolean)
      .join('\n');

    const booking: Booking = normalizeBookingWorkflowFields({
      id: `booking-${Date.now()}`,
      eventType: 'buffet',
      eventDate: order.eventDate,
      eventTime: '17:00',
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      adults: Math.max(order.items.reduce((sum, item) => sum + item.qty, 0), 1),
      children: 0,
      location: order.location || '',
      distanceMiles: 0,
      premiumAddOn: 0,
      subtotal: order.subtotal,
      gratuity: 0,
      distanceFee: order.deliveryFee,
      total: order.total,
      status: 'pending',
      serviceStatus: 'pending',
      notes,
      source: 'online-order',
      sourceChannel: 'online_order',
      pipeline_status: 'qualified',
      pipeline_status_updated_at: now,
      createdAt: now,
      updatedAt: now,
    });

    const updatedBookings = [...existing, booking];
    localStorage.setItem('bookings', JSON.stringify(updatedBookings));
    window.dispatchEvent(new Event('bookingsUpdated'));

    updateOrder({
      ...order,
      convertedBookingId: booking.id,
      updatedAt: now,
    });
    window.location.assign(`/bookings/${booking.id}`);
  };

  if (!order) {
    return (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-bold text-text-primary">Order Not Found</h1>
          <Link
            href="/orders"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-text-muted">Online order detail and fulfillment tracking.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/orders"
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
            >
              ← Orders
            </Link>
            {order.convertedBookingId ? (
              <Link
                href={`/bookings/${order.convertedBookingId}`}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                Open Event
              </Link>
            ) : (
              <button
                type="button"
                onClick={convertToBooking}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                Convert to Event
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Order Info</h2>
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-text-secondary">Customer: <span className="text-text-primary">{order.customerName}</span></p>
              <p className="text-text-secondary">Email: <span className="text-text-primary">{order.customerEmail || '—'}</span></p>
              <p className="text-text-secondary">Phone: <span className="text-text-primary">{order.customerPhone}</span></p>
              <p className="text-text-secondary">Date: <span className="text-text-primary">{order.eventDate}</span></p>
              <p className="text-text-secondary">Time: <span className="text-text-primary">{order.eventTimeWindow}</span></p>
              <p className="text-text-secondary">Service: <span className="text-text-primary">{order.serviceType}</span></p>
              <p className="text-text-secondary">Location: <span className="text-text-primary">{order.location || '—'}</span></p>
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Fulfillment Status</label>
              <select
                value={order.fulfillmentStatus}
                onChange={(e) => updateStatus(e.target.value as OrderFulfillmentStatus)}
                className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {message && <p className="mt-2 text-xs text-success">{message}</p>}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Totals</h2>
            <div className="mt-3 space-y-1 text-sm">
              <p className="flex items-center justify-between text-text-secondary"><span>Subtotal</span><span className="text-text-primary">{formatCurrency(order.subtotal)}</span></p>
              <p className="flex items-center justify-between text-text-secondary"><span>Tax</span><span className="text-text-primary">{formatCurrency(order.tax)}</span></p>
              <p className="flex items-center justify-between text-text-secondary"><span>Delivery Fee</span><span className="text-text-primary">{formatCurrency(order.deliveryFee)}</span></p>
              <p className="flex items-center justify-between text-text-secondary"><span>Tip</span><span className="text-text-primary">{formatCurrency(order.tip)}</span></p>
              <p className="flex items-center justify-between text-text-secondary"><span>Discount</span><span className="text-text-primary">-{formatCurrency(order.discount)}</span></p>
              <p className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold text-text-primary">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Items</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-card-elevated">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Price</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item) => (
                  <tr key={item.menuItemId}>
                    <td className="px-3 py-2 text-sm text-text-primary">{item.name}</td>
                    <td className="px-3 py-2 text-sm text-text-secondary">{item.qty}</td>
                    <td className="px-3 py-2 text-sm text-text-secondary">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-2 text-sm text-text-secondary">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {order.notes && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{order.notes}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

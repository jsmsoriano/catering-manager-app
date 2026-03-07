'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/moneyRules';
import { loadOrders, ORDERS_UPDATED_EVENT, saveOrders } from '@/lib/orderStorage';
import type { OrderFulfillmentStatus, Order } from '@/lib/orderTypes';

const STATUS_LABELS: Record<OrderFulfillmentStatus, string> = {
  new: 'New',
  accepted: 'Accepted',
  in_prep: 'In Prep',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderFulfillmentStatus>('all');

  useEffect(() => {
    const reload = () => setOrders(loadOrders());
    reload();
    window.addEventListener(ORDERS_UPDATED_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const filtered = useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter((o) => o.fulfillmentStatus === statusFilter)),
    [orders, statusFilter]
  );

  const seedTestOrders = () => {
    const existing = loadOrders().filter((order) => order.sourceChannel !== 'online_order_test');
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const samples: Order[] = [
      {
        id: `order-seed-${now}-1`,
        orderNumber: `ORD-TST-${String(now).slice(-6)}-1`,
        customerName: 'Alex Rivera',
        customerEmail: 'alex@example.com',
        customerPhone: '(555)-111-2222',
        serviceType: 'pickup',
        eventDate: new Date(now + dayMs).toISOString().slice(0, 10),
        eventTimeWindow: '12:00 - 13:00',
        location: '',
        notes: 'Office lunch tray setup.',
        items: [
          { menuItemId: 'protein-chicken', name: 'Chicken', category: 'protein', qty: 10, unitPrice: 26, lineTotal: 260 },
          { menuItemId: 'side-rice', name: 'Fried Rice', category: 'side', qty: 10, unitPrice: 4, lineTotal: 40 },
        ],
        subtotal: 300,
        tax: 24,
        deliveryFee: 0,
        tip: 20,
        discount: 0,
        total: 344,
        paymentStatus: 'paid',
        fulfillmentStatus: 'accepted',
        sourceChannel: 'online_order_test',
        createdAt: new Date(now - dayMs).toISOString(),
        updatedAt: new Date(now - dayMs).toISOString(),
      },
      {
        id: `order-seed-${now}-2`,
        orderNumber: `ORD-TST-${String(now).slice(-6)}-2`,
        customerName: 'Morgan Lee',
        customerEmail: 'morgan@example.com',
        customerPhone: '(555)-333-4444',
        serviceType: 'delivery',
        eventDate: new Date(now + 2 * dayMs).toISOString().slice(0, 10),
        eventTimeWindow: '17:30 - 18:30',
        location: '123 Test Ave, Test City',
        notes: 'Birthday catering drop-off.',
        items: [
          { menuItemId: 'protein-steak', name: 'Steak', category: 'protein', qty: 15, unitPrice: 34, lineTotal: 510 },
          { menuItemId: 'side-noodles', name: 'Noodles', category: 'side', qty: 15, unitPrice: 4, lineTotal: 60 },
        ],
        subtotal: 570,
        tax: 45.6,
        deliveryFee: 25,
        tip: 50,
        discount: 20,
        total: 670.6,
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'new',
        sourceChannel: 'online_order_test',
        createdAt: new Date(now - 2 * dayMs).toISOString(),
        updatedAt: new Date(now - 2 * dayMs).toISOString(),
      },
      {
        id: `order-seed-${now}-3`,
        orderNumber: `ORD-TST-${String(now).slice(-6)}-3`,
        customerName: 'Taylor Kim',
        customerEmail: 'taylor@example.com',
        customerPhone: '(555)-555-6666',
        serviceType: 'dropoff',
        eventDate: new Date(now - dayMs).toISOString().slice(0, 10),
        eventTimeWindow: '16:00 - 17:00',
        location: '500 Corporate Blvd',
        notes: 'Corporate happy hour.',
        items: [
          { menuItemId: 'protein-shrimp', name: 'Shrimp', category: 'protein', qty: 20, unitPrice: 32, lineTotal: 640 },
          { menuItemId: 'side-salad', name: 'Side Salad', category: 'side', qty: 20, unitPrice: 3, lineTotal: 60 },
        ],
        subtotal: 700,
        tax: 56,
        deliveryFee: 25,
        tip: 0,
        discount: 0,
        total: 781,
        paymentStatus: 'paid',
        fulfillmentStatus: 'completed',
        sourceChannel: 'online_order_test',
        createdAt: new Date(now - 5 * dayMs).toISOString(),
        updatedAt: new Date(now - dayMs).toISOString(),
      },
    ];
    const next = [...samples, ...existing];
    setOrders(next);
    saveOrders(next);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Online Orders</h1>
            <p className="mt-1 text-sm text-text-muted">Manage inbound online orders and convert complex ones to events.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/orders/entry"
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              New Order Entry
            </Link>
            <button
              type="button"
              onClick={seedTestOrders}
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
            >
              Load Test Data
            </button>
            <Link
              href="/order"
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
            >
              Open Storefront
            </Link>
            <Link
              href="/"
              className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
            >
              ← Dashboard
            </Link>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderFulfillmentStatus)}
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary"
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-card-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-card-elevated/70">
                  <td className="px-4 py-3 text-sm text-text-primary">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{order.customerName}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{order.eventDate}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{STATUS_LABELS[order.fulfillmentStatus]}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/orders/${order.id}`}
                      className="rounded-md border border-border bg-card-elevated px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-card"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-muted">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatCurrency } from '@/lib/moneyRules';
import { loadOrders } from '@/lib/orderStorage';

export default function OrderConfirmedPage() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = params?.orderNumber ?? '';
  const order = loadOrders().find((o) => o.orderNumber === orderNumber);

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-3xl font-bold text-text-primary">Order Received</h1>
        <p className="mt-2 text-text-secondary">
          Thank you. Your order has been submitted.
        </p>
        <p className="mt-3 text-sm text-text-muted">
          Order Number: <span className="font-semibold text-text-primary">{orderNumber}</span>
        </p>
        {order && (
          <div className="mt-4 rounded-lg border border-border bg-card-elevated p-4 text-left text-sm">
            <p className="text-text-secondary">Customer: <span className="text-text-primary">{order.customerName}</span></p>
            <p className="text-text-secondary">Date: <span className="text-text-primary">{order.eventDate}</span></p>
            <p className="text-text-secondary">Service: <span className="text-text-primary">{order.serviceType}</span></p>
            <p className="text-text-secondary">Total: <span className="text-text-primary">{formatCurrency(order.total)}</span></p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/order"
            className="rounded-lg border border-border bg-card-elevated px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-card"
          >
            Place Another Order
          </Link>
          <Link
            href="/orders"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            Open Orders Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/moneyRules';
import { loadOrders } from '@/lib/orderStorage';

export default function OrdersReportPage() {
  const orders = useMemo(() => loadOrders(), []);

  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const completedOrders = orders.filter((order) => order.fulfillmentStatus === 'completed');
    const completedRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalOrders, totalRevenue, completedRevenue, avgOrderValue };
  }, [orders]);

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Orders Report</h1>
            <p className="mt-1 text-sm text-text-muted">Phase 1 KPI view for online ordering performance.</p>
          </div>
          <Link
            href="/reports"
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-primary hover:bg-card"
          >
            ← Reports
          </Link>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Total Orders</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{metrics.totalOrders}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Total Revenue</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{formatCurrency(metrics.totalRevenue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Completed Revenue</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{formatCurrency(metrics.completedRevenue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Average Order Value</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{formatCurrency(metrics.avgOrderValue)}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-card-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-card-elevated/70">
                  <td className="px-4 py-3 text-sm text-text-primary">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{order.customerName}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{order.fulfillmentStatus}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{formatCurrency(order.total)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">
                    No order data yet.
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

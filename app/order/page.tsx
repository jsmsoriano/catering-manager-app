'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/moneyRules';
import { createOrderItemsFromCart, loadOrderCatalog, saveOrderDraft } from '@/lib/orderStorage';

export default function OnlineOrderPage() {
  const catalog = useMemo(() => loadOrderCatalog(), []);
  const [cart, setCart] = useState<Record<string, number>>({});

  const grouped = useMemo(() => {
    const map = new Map<string, typeof catalog>();
    for (const item of catalog) {
      const key = item.category || 'other';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [catalog]);

  const orderItems = useMemo(() => createOrderItemsFromCart(cart, catalog), [cart, catalog]);
  const subtotal = useMemo(
    () => Math.round(orderItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100,
    [orderItems]
  );

  const setQty = (itemId: string, qty: number) => {
    setCart((prev) => ({ ...prev, [itemId]: Math.max(0, qty) }));
  };

  const handleCheckout = () => {
    saveOrderDraft({ items: orderItems, subtotal, updatedAt: new Date().toISOString() });
    window.location.assign('/checkout');
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-text-primary">Online Ordering</h1>
            <p className="mt-1 text-sm text-text-muted">
              Select items and continue to checkout. This is the Phase 1 scaffold.
            </p>
          </div>

          <div className="space-y-6">
            {grouped.map(([category, items]) => (
              <section key={category} className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  {category}
                </h2>
                <div className="space-y-3">
                  {items.map((item) => {
                    const qty = cart[item.id] ?? 0;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card-elevated p-3"
                      >
                        <div>
                          <p className="font-medium text-text-primary">{item.name}</p>
                          <p className="text-xs text-text-muted">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="w-20 text-right text-sm font-medium text-text-primary">
                            {formatCurrency(item.pricePerServing)}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setQty(item.id, qty - 1)}
                              className="rounded-md border border-border bg-card px-2 py-1 text-sm text-text-primary"
                            >
                              -
                            </button>
                            <span className="w-7 text-center text-sm text-text-primary">{qty}</span>
                            <button
                              type="button"
                              onClick={() => setQty(item.id, qty + 1)}
                              className="rounded-md border border-border bg-card px-2 py-1 text-sm text-text-primary"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6">
          <h2 className="text-lg font-semibold text-text-primary">Cart</h2>
          <div className="mt-3 space-y-2">
            {orderItems.length === 0 && <p className="text-sm text-text-muted">No items selected yet.</p>}
            {orderItems.map((item) => (
              <div key={item.menuItemId} className="flex items-center justify-between text-sm">
                <p className="text-text-secondary">
                  {item.qty} x {item.name}
                </p>
                <p className="text-text-primary">{formatCurrency(item.lineTotal)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">Subtotal</p>
              <p className="font-semibold text-text-primary">{formatCurrency(subtotal)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={orderItems.length === 0}
            className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            Continue to Checkout
          </button>
          <Link
            href="/orders"
            className="mt-2 block w-full rounded-lg border border-border bg-card-elevated px-4 py-2.5 text-center text-sm font-medium text-text-primary hover:bg-card"
          >
            View Orders Dashboard
          </Link>
        </aside>
      </div>
    </div>
  );
}

import { DEFAULT_MENU_ITEMS } from '@/lib/defaultMenuItems';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import type { MenuItem } from '@/lib/menuTypes';
import type { Order, OrderDraft, OrderItem, OrderServiceType } from '@/lib/orderTypes';
import { StorageEvent } from '@/lib/storageEvents';

export const ORDERS_STORAGE_KEY = 'orders';
export const ORDER_DRAFT_STORAGE_KEY = 'orderCheckoutDraft';
export const ORDERS_UPDATED_EVENT = StorageEvent.Orders;

export function loadOrderCatalog(): MenuItem[] {
  const menu = loadFromStorage<MenuItem[]>('menuItems', DEFAULT_MENU_ITEMS);
  const available = menu.filter((item) => item.isAvailable);
  return available.length > 0 ? available : DEFAULT_MENU_ITEMS.filter((item) => item.isAvailable);
}

export function loadOrders(): Order[] {
  return loadFromStorage<Order[]>(ORDERS_STORAGE_KEY, []);
}

export function saveOrders(orders: Order[]): void {
  saveToStorage(ORDERS_STORAGE_KEY, orders);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ORDERS_UPDATED_EVENT));
  }
}

export function upsertOrder(order: Order): void {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) orders[idx] = order;
  else orders.unshift(order);
  saveOrders(orders);
}

export function loadOrderDraft(): OrderDraft | null {
  return loadFromStorage<OrderDraft | null>(ORDER_DRAFT_STORAGE_KEY, null);
}

export function saveOrderDraft(draft: OrderDraft): void {
  saveToStorage(ORDER_DRAFT_STORAGE_KEY, draft);
}

export function clearOrderDraft(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ORDER_DRAFT_STORAGE_KEY);
}

export function createOrderItemsFromCart(
  cart: Record<string, number>,
  catalog: MenuItem[]
): OrderItem[] {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([menuItemId, qty]) => {
      const item = catalog.find((m) => m.id === menuItemId);
      const unitPrice = item?.pricePerServing ?? 0;
      return {
        menuItemId,
        name: item?.name ?? 'Unknown Item',
        category: item?.category ?? 'other',
        qty,
        unitPrice,
        lineTotal: Math.round(unitPrice * qty * 100) / 100,
      };
    });
}

export function calculateOrderTotals(params: {
  subtotal: number;
  serviceType: OrderServiceType;
  tip: number;
  discount: number;
}) {
  const taxRate = 0.08;
  const tax = Math.round(params.subtotal * taxRate * 100) / 100;
  const deliveryFee = params.serviceType === 'pickup' ? 0 : 25;
  const total =
    Math.round((params.subtotal + tax + deliveryFee + params.tip - params.discount) * 100) / 100;
  return { tax, deliveryFee, total };
}

export function generateOrderNumber(now = new Date()): string {
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${y}${m}${d}-${rand}`;
}

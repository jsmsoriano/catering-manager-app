export type OrderServiceType = 'pickup' | 'delivery' | 'dropoff';

export type OrderFulfillmentStatus =
  | 'new'
  | 'accepted'
  | 'in_prep'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export type OrderPaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface OrderItem {
  menuItemId: string;
  name: string;
  category: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceType: OrderServiceType;
  eventDate: string;
  eventTimeWindow: string;
  location: string;
  notes: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  tip: number;
  discount: number;
  total: number;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  sourceChannel: string;
  createdAt: string;
  updatedAt: string;
  convertedBookingId?: string;
}

export interface OrderDraft {
  items: OrderItem[];
  subtotal: number;
  updatedAt: string;
}

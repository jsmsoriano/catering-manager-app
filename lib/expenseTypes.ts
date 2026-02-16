export type ExpenseCategory =
  | 'food'
  | 'gas-mileage'
  | 'supplies'
  | 'equipment'
  | 'labor'
  | 'other';

export interface Expense {
  id: string;
  date: string; // ISO date string
  category: ExpenseCategory;
  amount: number;
  description: string;
  bookingId?: string; // Optional - links to a specific booking
  receiptPhoto?: string; // Optional - base64 image data
  notes?: string;
  source?: 'manual' | 'shopping-list';
  sourceId?: string;
}

export interface ExpenseFormData {
  date: string;
  category: ExpenseCategory;
  amount: string;
  description: string;
  bookingId?: string;
  notes?: string;
}

export type InventoryCategory =
  | 'protein'
  | 'produce'
  | 'dry-goods'
  | 'sauces'
  | 'beverages'
  | 'disposables'
  | 'other';

export type InventoryUnit = 'lb' | 'kg' | 'oz' | 'g' | 'ea' | 'case' | 'bottle' | 'tray';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  currentStock: number;
  parLevel: number;
  reorderPoint: number;
  avgUnitCost: number;
  vendor?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemFormData {
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  currentStock: string;
  parLevel: string;
  reorderPoint: string;
  avgUnitCost: string;
  vendor: string;
  notes: string;
}

export type InventoryMovementType = 'restock' | 'usage' | 'adjustment';

export interface InventoryTransaction {
  id: string;
  itemId: string;
  date: string;
  type: InventoryMovementType;
  quantity: number; // Signed quantity (+ for incoming, - for outgoing)
  unitCost?: number;
  bookingId?: string;
  notes?: string;
}

export interface InventoryMovementFormData {
  itemId: string;
  date: string;
  type: InventoryMovementType;
  quantity: string;
  unitCost: string;
  bookingId: string;
  notes: string;
}

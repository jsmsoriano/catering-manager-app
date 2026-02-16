export type ShoppingListStatus = 'draft' | 'purchased' | 'locked';

export type ShoppingListItemCategory = 'food' | 'supplies';

export type ShoppingListUnit =
  | 'lb'
  | 'kg'
  | 'oz'
  | 'g'
  | 'ea'
  | 'case'
  | 'bottle'
  | 'tray'
  | 'other';

export interface ShoppingListItem {
  id: string;
  name: string;
  category: ShoppingListItemCategory;
  plannedQty: number;
  plannedUnit: ShoppingListUnit;
  actualQty?: number;
  actualUnitCost?: number;
  purchased?: boolean;
  notes?: string;
}

export interface ShoppingList {
  id: string;
  bookingId: string;
  status: ShoppingListStatus;
  items: ShoppingListItem[];
  notes?: string;
  plannedAt: string;
  purchasedAt?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

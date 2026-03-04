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

/** Source of the line item: menu = generated from event menu; manual = user-added */
export type ShoppingListItemSource = 'menu' | 'manual';

export interface ShoppingListItem {
  id: string;
  name: string;
  category: ShoppingListItemCategory;
  /** Legacy / display quantity; for generated items also mirrored in calculatedQty */
  plannedQty: number;
  plannedUnit: ShoppingListUnit;
  /** Portions from menu (e.g. protein portions or side portions). Used to compute qty required (lbs). */
  calculatedQty?: number;
  /** Oz per portion for menu items (e.g. 5 oz protein). qtyRequiredLbs = (calculatedQty * ozPerPortion) / 16 */
  ozPerPortion?: number;
  /** Quantity required in lbs (derived from portions * ozPerPortion / 16, or stored for manual) */
  qtyRequiredLbs?: number;
  /** How item is sold, e.g. "5 lb bag", "3 lb tray" */
  unitRequired?: string;
  /** Price of the package (e.g. $12.99 for a 5 lb bag) */
  packagePrice?: number;
  /** Weight of the package in lbs (e.g. 5 for a 5 lb bag). Line total = (qtyRequiredLbs / packageWeightLbs) * packagePrice */
  packageWeightLbs?: number;
  /** @deprecated User override; kept for backward compat */
  overrideQty?: number;
  /** True if this line was generated from menu */
  isGenerated?: boolean;
  /** @deprecated Kept for backward compat */
  isOverridden?: boolean;
  /** 'menu' | 'manual' */
  source?: ShoppingListItemSource;
  actualQty?: number;
  /** Cost per unit (legacy); when packagePrice/packageWeightLbs set, line total uses those instead */
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

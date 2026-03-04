import type { ShoppingList, ShoppingListItem } from './shoppingTypes';

export interface ShoppingListTotals {
  foodTotal: number;
  suppliesTotal: number;
  grandTotal: number;
  purchasedCount: number;
  lineCount: number;
  /** Sum of finalQty for lines marked purchased (optional display) */
  purchasedQtyTotal: number;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeNonNegative(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/** finalQty = overrideQty ?? calculatedQty ?? plannedQty (backward compat for items without new fields) */
export function getFinalQty(item: ShoppingListItem): number {
  const override = item.overrideQty;
  if (typeof override === 'number' && Number.isFinite(override)) return Math.max(0, override);
  const calculated = item.calculatedQty;
  if (typeof calculated === 'number' && Number.isFinite(calculated)) return Math.max(0, calculated);
  return Math.max(0, normalizeNonNegative(item.plannedQty));
}

/** Qty required in lbs: for menu items (calculatedQty + ozPerPortion) = portions * ozPerPortion / 16; else qtyRequiredLbs or plannedQty */
export function getQtyRequiredLbs(item: ShoppingListItem): number {
  const portions = item.calculatedQty;
  const ozPerPortion = item.ozPerPortion;
  if (typeof portions === 'number' && Number.isFinite(portions) && typeof ozPerPortion === 'number' && Number.isFinite(ozPerPortion) && ozPerPortion > 0) {
    return Math.max(0, (portions * ozPerPortion) / 16);
  }
  if (typeof item.qtyRequiredLbs === 'number' && Number.isFinite(item.qtyRequiredLbs)) return Math.max(0, item.qtyRequiredLbs);
  return Math.max(0, normalizeNonNegative(item.plannedQty));
}

export function calculateShoppingListLineTotal(item: ShoppingListItem): number {
  const pkgPrice = item.packagePrice;
  const pkgWeightLbs = item.packageWeightLbs;
  if (typeof pkgPrice === 'number' && Number.isFinite(pkgPrice) && typeof pkgWeightLbs === 'number' && Number.isFinite(pkgWeightLbs) && pkgWeightLbs > 0) {
    const qtyLbs = getQtyRequiredLbs(item);
    return roundCurrency((qtyLbs / pkgWeightLbs) * pkgPrice);
  }
  const qty = getFinalQty(item);
  const unitCost = normalizeNonNegative(item.actualUnitCost);
  return roundCurrency(qty * unitCost);
}

export function calculateShoppingListTotals(list: ShoppingList | null): ShoppingListTotals {
  if (!list) {
    return {
      foodTotal: 0,
      suppliesTotal: 0,
      grandTotal: 0,
      purchasedCount: 0,
      lineCount: 0,
      purchasedQtyTotal: 0,
    };
  }

  let foodTotal = 0;
  let suppliesTotal = 0;
  let purchasedCount = 0;
  let purchasedQtyTotal = 0;

  list.items.forEach((item) => {
    const lineTotal = calculateShoppingListLineTotal(item);
    if (item.category === 'food') {
      foodTotal += lineTotal;
    } else {
      suppliesTotal += lineTotal;
    }
    if (item.purchased) {
      purchasedCount += 1;
      purchasedQtyTotal += getQtyRequiredLbs(item);
    }
  });

  return {
    foodTotal: roundCurrency(foodTotal),
    suppliesTotal: roundCurrency(suppliesTotal),
    grandTotal: roundCurrency(foodTotal + suppliesTotal),
    purchasedCount,
    lineCount: list.items.length,
    purchasedQtyTotal: roundCurrency(purchasedQtyTotal),
  };
}

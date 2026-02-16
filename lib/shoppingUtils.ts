import type { ShoppingList, ShoppingListItem } from './shoppingTypes';

export interface ShoppingListTotals {
  foodTotal: number;
  suppliesTotal: number;
  grandTotal: number;
  purchasedCount: number;
  lineCount: number;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeNonNegative(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function calculateShoppingListLineTotal(item: ShoppingListItem): number {
  const actualQty = normalizeNonNegative(item.actualQty);
  const actualUnitCost = normalizeNonNegative(item.actualUnitCost);
  return roundCurrency(actualQty * actualUnitCost);
}

export function calculateShoppingListTotals(list: ShoppingList | null): ShoppingListTotals {
  if (!list) {
    return {
      foodTotal: 0,
      suppliesTotal: 0,
      grandTotal: 0,
      purchasedCount: 0,
      lineCount: 0,
    };
  }

  let foodTotal = 0;
  let suppliesTotal = 0;
  let purchasedCount = 0;

  list.items.forEach((item) => {
    const lineTotal = calculateShoppingListLineTotal(item);
    if (item.category === 'food') {
      foodTotal += lineTotal;
    } else {
      suppliesTotal += lineTotal;
    }
    if (item.purchased) purchasedCount += 1;
  });

  return {
    foodTotal: roundCurrency(foodTotal),
    suppliesTotal: roundCurrency(suppliesTotal),
    grandTotal: roundCurrency(foodTotal + suppliesTotal),
    purchasedCount,
    lineCount: list.items.length,
  };
}

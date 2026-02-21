import type {
  EventMenu,
  GuestMenuSelection,
  MenuItem,
  MenuPricingBreakdown,
  MenuPricingSnapshot,
} from './menuTypes';

// Maps protein key → catalog item ID (string keys to support custom template proteins)
const PROTEIN_ITEM_ID: Record<string, string> = {
  chicken: 'protein-chicken',
  steak: 'protein-steak',
  shrimp: 'protein-shrimp',
  scallops: 'protein-scallops',
  'filet-mignon': 'protein-filet-mignon',
};

const SIDE_ITEM_ID = {
  wantsFriedRice: 'side-rice',
  wantsNoodles: 'side-noodles',
  wantsSalad: 'side-salad',
  wantsVeggies: 'side-veggies',
} as const;

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

function toFiniteNonNegative(value: number | undefined, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value as number);
}

function toServingValue(item: MenuItem | undefined, field: 'pricePerServing' | 'costPerServing'): number {
  if (!item) return 0;
  if (field === 'pricePerServing') {
    // Legacy menu items may not have pricePerServing yet.
    const value = (item.pricePerServing ?? 0) as number;
    return toFiniteNonNegative(value);
  }
  return toFiniteNonNegative(item.costPerServing);
}

function findItem(menuItems: MenuItem[], id: string): MenuItem | undefined {
  return menuItems.find((item) => item.id === id);
}

function lineTotalsForGuest(
  guest: GuestMenuSelection,
  menuItems: MenuItem[],
  childMultiplier: number,
  missingItemIds: Set<string>
): { revenue: number; foodCost: number } {
  const portionMultiplier = guest.isAdult ? 1 : childMultiplier;

  const proteinItem1 = findItem(menuItems, PROTEIN_ITEM_ID[guest.protein1]);
  if (!proteinItem1) missingItemIds.add(PROTEIN_ITEM_ID[guest.protein1]);

  const proteinItem2 = findItem(menuItems, PROTEIN_ITEM_ID[guest.protein2]);
  if (!proteinItem2) missingItemIds.add(PROTEIN_ITEM_ID[guest.protein2]);

  let revenue =
    (toServingValue(proteinItem1, 'pricePerServing') + toServingValue(proteinItem2, 'pricePerServing')) * portionMultiplier;
  let foodCost =
    (toServingValue(proteinItem1, 'costPerServing') + toServingValue(proteinItem2, 'costPerServing')) * portionMultiplier;

  for (const [sideKey, sideId] of Object.entries(SIDE_ITEM_ID) as Array<[keyof typeof SIDE_ITEM_ID, string]>) {
    if (!guest[sideKey]) continue;
    const sideItem = findItem(menuItems, sideId);
    if (!sideItem) {
      missingItemIds.add(sideId);
      continue;
    }
    revenue += toServingValue(sideItem, 'pricePerServing') * portionMultiplier;
    foodCost += toServingValue(sideItem, 'costPerServing') * portionMultiplier;
  }

  return { revenue, foodCost };
}

interface MenuPricingOptions {
  childDiscountPercent?: number;
  premiumAddOnPerGuest?: number;
}

export function calculateMenuPricingBreakdown(
  eventMenu: EventMenu,
  menuItems: MenuItem[],
  options: MenuPricingOptions = {}
): MenuPricingBreakdown {
  const missingItemIds = new Set<string>();
  const childDiscountPercent = toFiniteNonNegative(options.childDiscountPercent, 50);
  const childMultiplier = Math.max(0, Math.min(1, 1 - childDiscountPercent / 100));
  const premiumAddOnPerGuest = toFiniteNonNegative(options.premiumAddOnPerGuest, 0);

  let subtotalOverride = 0;
  let foodCostOverride = 0;

  for (const guest of eventMenu.guestSelections) {
    const totals = lineTotalsForGuest(guest, menuItems, childMultiplier, missingItemIds);
    subtotalOverride += totals.revenue;
    foodCostOverride += totals.foodCost;
  }

  if (premiumAddOnPerGuest > 0 && eventMenu.guestSelections.length > 0) {
    subtotalOverride += premiumAddOnPerGuest * eventMenu.guestSelections.length;
  }

  return {
    subtotalOverride: roundCurrency(subtotalOverride),
    foodCostOverride: roundCurrency(foodCostOverride),
    missingItemIds: Array.from(missingItemIds).sort(),
  };
}

export function buildMenuPricingSnapshot(
  eventMenu: EventMenu,
  menuItems: MenuItem[],
  options: MenuPricingOptions = {}
): MenuPricingSnapshot {
  const breakdown = calculateMenuPricingBreakdown(eventMenu, menuItems, options);
  return {
    menuId: eventMenu.id,
    subtotalOverride: breakdown.subtotalOverride,
    foodCostOverride: breakdown.foodCostOverride,
    calculatedAt: new Date().toISOString(),
  };
}

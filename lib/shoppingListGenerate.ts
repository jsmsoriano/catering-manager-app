import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingListItemCategory,
  ShoppingListUnit,
} from './shoppingTypes';
import type { EventMenu, GuestMenuSelection, CateringEventMenu, CateringSelectedItem } from './menuTypes';
import { CATERING_EVENT_MENUS_KEY } from './menuCategories';

const EVENT_MENUS_KEY = 'eventMenus';

function loadEventMenus(): EventMenu[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EVENT_MENUS_KEY);
    return raw ? (JSON.parse(raw) as EventMenu[]) : [];
  } catch {
    return [];
  }
}

function loadCateringEventMenus(): CateringEventMenu[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CATERING_EVENT_MENUS_KEY);
    return raw ? (JSON.parse(raw) as CateringEventMenu[]) : [];
  } catch {
    return [];
  }
}

/** Existing generated items by normalized name (for matching when regenerating) */
function existingByNameMap(items: ShoppingListItem[]): Map<string, ShoppingListItem> {
  const map = new Map<string, ShoppingListItem>();
  items.forEach((item) => {
    if (item.source === 'menu' && item.isGenerated) {
      map.set(item.name.toLowerCase().trim(), item);
    }
  });
  return map;
}

/** Default oz per portion: proteins 5 oz, sides 4 oz (portions → lbs = portions * ozPerPortion / 16) */
const OZ_PER_PORTION_PROTEIN = 5;
const OZ_PER_PORTION_SIDE = 4;

/** Build shopping list items from hibachi EventMenu (guest selections → protein/side counts). calculatedQty = portions; qty required (lbs) = portions * ozPerPortion / 16. */
function generateFromGuestSelections(
  guestSelections: GuestMenuSelection[],
  existingByName: Map<string, ShoppingListItem>,
  keepPackageInfo: boolean
): ShoppingListItem[] {
  const proteinCounts: Record<string, number> = {};
  let friedRice = 0;
  let noodles = 0;
  let salad = 0;
  let veggies = 0;

  guestSelections.forEach((g) => {
    [g.protein1, g.protein2].forEach((p) => {
      const key = (p || '').trim() || 'unknown';
      proteinCounts[key] = (proteinCounts[key] ?? 0) + 1;
    });
    if (g.wantsFriedRice) friedRice++;
    if (g.wantsNoodles) noodles++;
    if (g.wantsSalad) salad++;
    if (g.wantsVeggies) veggies++;
  });

  const items: ShoppingListItem[] = [];

  Object.entries(proteinCounts).forEach(([name, count]) => {
    const displayName = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
    const existing = existingByName.get(displayName.toLowerCase());
    const calculatedQty = count; // protein portions required per plate
    const ozPerPortion = OZ_PER_PORTION_PROTEIN;

    items.push({
      id: existing?.id ?? crypto.randomUUID(),
      name: displayName,
      category: 'food',
      plannedQty: calculatedQty,
      plannedUnit: 'lb',
      calculatedQty,
      ozPerPortion,
      isGenerated: true,
      source: 'menu',
      ...(keepPackageInfo && existing && {
        unitRequired: existing.unitRequired,
        packagePrice: existing.packagePrice,
        packageWeightLbs: existing.packageWeightLbs,
      }),
    });
  });

  const sideNames = [
    [friedRice, 'Fried Rice (portions)'],
    [noodles, 'Noodles (portions)'],
    [salad, 'Salad (portions)'],
    [veggies, 'Vegetables (portions)'],
  ] as const;
  sideNames.forEach(([qty, label]) => {
    if (qty <= 0) return;
    const existing = existingByName.get(label.toLowerCase());
    const calculatedQty = qty;
    const ozPerPortion = OZ_PER_PORTION_SIDE;

    items.push({
      id: existing?.id ?? crypto.randomUUID(),
      name: label,
      category: 'food',
      plannedQty: calculatedQty,
      plannedUnit: 'lb',
      calculatedQty,
      ozPerPortion,
      isGenerated: true,
      source: 'menu',
      ...(keepPackageInfo && existing && {
        unitRequired: existing.unitRequired,
        packagePrice: existing.packagePrice,
        packageWeightLbs: existing.packageWeightLbs,
      }),
    });
  });

  return items;
}

/** Build shopping list items from CateringEventMenu (selected items with servings). Treat servings as portions; default 5 oz/portion for lbs. */
function generateFromCateringMenu(
  selectedItems: CateringSelectedItem[],
  existingByName: Map<string, ShoppingListItem>,
  keepPackageInfo: boolean
): ShoppingListItem[] {
  const ozDefault = OZ_PER_PORTION_PROTEIN;
  return selectedItems.map((sel) => {
    const existing = existingByName.get(sel.name.toLowerCase().trim());
    const calculatedQty = sel.servings ?? 0;
    const ozPerPortion = existing?.ozPerPortion ?? ozDefault;

    return {
      id: existing?.id ?? crypto.randomUUID(),
      name: sel.name,
      category: 'food' as ShoppingListItemCategory,
      plannedQty: calculatedQty,
      plannedUnit: 'lb' as ShoppingListUnit,
      calculatedQty,
      ozPerPortion,
      isGenerated: true,
      source: 'menu' as const,
      ...(keepPackageInfo && existing && {
        unitRequired: existing.unitRequired,
        packagePrice: existing.packagePrice,
        packageWeightLbs: existing.packageWeightLbs,
      }),
      actualUnitCost: existing?.actualUnitCost ?? (Number.isFinite(sel.costPerServing) ? sel.costPerServing : undefined),
      purchased: existing?.purchased,
    };
  });
}

/**
 * Generate shopping list items from the event menu (hibachi or catering).
 * calculatedQty = portions (protein or side portions); qty required (lbs) = portions * ozPerPortion / 16.
 * If keepPackageInfo: preserve unitRequired, packagePrice, packageWeightLbs when regenerating.
 * Manual items (source='manual') are always preserved and appended after generated items.
 */
export function generateShoppingListFromMenu(
  bookingId: string,
  currentList: ShoppingList,
  keepPackageInfo: boolean
): ShoppingList {
  const manualItems: ShoppingListItem[] = currentList.items.filter((item) => item.source === 'manual');
  const existingByName = existingByNameMap(currentList.items);

  const eventMenus = loadEventMenus();
  const hibachiMenu = eventMenus.find((m) => m.bookingId === bookingId);

  const cateringMenus = loadCateringEventMenus();
  const cateringMenu = cateringMenus.find((m) => m.bookingId === bookingId);

  let generated: ShoppingListItem[] = [];

  if (cateringMenu?.selectedItems?.length) {
    generated = generateFromCateringMenu(
      cateringMenu.selectedItems,
      existingByName,
      keepPackageInfo
    );
  } else if (hibachiMenu?.guestSelections?.length) {
    generated = generateFromGuestSelections(
      hibachiMenu.guestSelections,
      existingByName,
      keepPackageInfo
    );
  }

  const nextItems = [...generated, ...manualItems];
  return {
    ...currentList,
    items: nextItems,
    updatedAt: new Date().toISOString(),
  };
}

/** Clear package info on generated (source='menu') items only (keeps portions/oz per portion). */
export function clearAllOverrides(currentList: ShoppingList): ShoppingList {
  const nextItems = currentList.items.map((item) => {
    if (item.source !== 'menu' || !item.isGenerated) return item;
    return {
      ...item,
      unitRequired: undefined,
      packagePrice: undefined,
      packageWeightLbs: undefined,
    };
  });
  return {
    ...currentList,
    items: nextItems,
    updatedAt: new Date().toISOString(),
  };
}

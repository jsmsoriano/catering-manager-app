import type { MenuCategoryNode } from './menuTypes';
import { loadFromStorage, saveToStorage } from './storage';

export const MENU_CATEGORIES_KEY = 'menuCategories';
export const CATERING_EVENT_MENUS_KEY = 'cateringEventMenus';

// ─── Default category tree ────────────────────────────────────────────────────

export const DEFAULT_MENU_CATEGORIES: MenuCategoryNode[] = [
  // Top-level
  { id: 'cat-appetizers', name: 'Appetizers',  sortOrder: 0 },
  { id: 'cat-proteins',   name: 'Proteins',    sortOrder: 1 },
  { id: 'cat-sides',      name: 'Sides',       sortOrder: 2 },
  { id: 'cat-desserts',   name: 'Desserts',    sortOrder: 3 },
  { id: 'cat-beverages',  name: 'Beverages',   sortOrder: 4 },

  // Appetizers
  { id: 'cat-hot-apps',   name: 'Hot Appetizers',  parentId: 'cat-appetizers', sortOrder: 0 },
  { id: 'cat-cold-apps',  name: 'Cold Appetizers', parentId: 'cat-appetizers', sortOrder: 1 },

  // Proteins — Hibachi buffet lives under "Hibachi Private Dinner"
  { id: 'cat-hibachi',    name: 'Hibachi Private Dinner', parentId: 'cat-proteins', sortOrder: 0 },
  { id: 'cat-grilled',    name: 'Grilled',               parentId: 'cat-proteins', sortOrder: 1 },
  { id: 'cat-poultry',    name: 'Poultry',               parentId: 'cat-proteins', sortOrder: 2 },
  { id: 'cat-seafood',    name: 'Seafood',               parentId: 'cat-proteins', sortOrder: 3 },
  { id: 'cat-vegetarian', name: 'Vegetarian',            parentId: 'cat-proteins', sortOrder: 4 },

  // Sides
  { id: 'cat-starches',   name: 'Starches & Rice', parentId: 'cat-sides', sortOrder: 0 },
  { id: 'cat-vegetables', name: 'Vegetables',      parentId: 'cat-sides', sortOrder: 1 },
  { id: 'cat-salads',     name: 'Salads',          parentId: 'cat-sides', sortOrder: 2 },

  // Desserts
  { id: 'cat-pastries',   name: 'Pastries & Cakes', parentId: 'cat-desserts', sortOrder: 0 },
  { id: 'cat-fruit',      name: 'Fresh Fruit',      parentId: 'cat-desserts', sortOrder: 1 },

  // Beverages
  { id: 'cat-nonalc',     name: 'Non-Alcoholic', parentId: 'cat-beverages', sortOrder: 0 },
  { id: 'cat-coffee',     name: 'Coffee & Tea',  parentId: 'cat-beverages', sortOrder: 1 },
];

// ─── Load / save ──────────────────────────────────────────────────────────────

export function loadMenuCategories(): MenuCategoryNode[] {
  const stored = loadFromStorage<MenuCategoryNode[]>(MENU_CATEGORIES_KEY, []);
  return stored.length > 0 ? stored : DEFAULT_MENU_CATEGORIES;
}

export function saveMenuCategories(cats: MenuCategoryNode[]): void {
  saveToStorage(MENU_CATEGORIES_KEY, cats);
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

/** Returns direct children of a category, sorted by sortOrder. */
export function getChildren(
  cats: MenuCategoryNode[],
  parentId: string,
): MenuCategoryNode[] {
  return cats
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Returns top-level categories (no parentId), sorted by sortOrder. */
export function getRoots(cats: MenuCategoryNode[]): MenuCategoryNode[] {
  return cats.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Returns all descendant IDs (children, grandchildren, …) of a category. */
export function getDescendantIds(cats: MenuCategoryNode[], parentId: string): string[] {
  const result: string[] = [];
  const queue = [parentId];
  while (queue.length) {
    const current = queue.shift()!;
    const children = cats.filter((c) => c.parentId === current);
    for (const child of children) {
      result.push(child.id);
      queue.push(child.id);
    }
  }
  return result;
}

/** Returns category name by ID, or empty string if not found. */
export function getCategoryName(cats: MenuCategoryNode[], id: string): string {
  return cats.find((c) => c.id === id)?.name ?? '';
}

/** Legacy MenuCategory → default categoryId mapping (used for one-time migration). */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  protein:   'cat-hibachi',   // existing proteins → Hibachi Private Dinner
  side:      'cat-starches',  // sides → Starches & Rice
  appetizer: 'cat-hot-apps',
  dessert:   'cat-pastries',
  beverage:  'cat-nonalc',
};

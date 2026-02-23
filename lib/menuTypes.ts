// ============================================================================
// MENU TYPES
// ============================================================================

// Protein options for private dining
export type ProteinType = 'chicken' | 'steak' | 'shrimp' | 'scallops' | 'filet-mignon';

// Menu categories (flat — kept for backward compat with per-guest hibachi system)
export type MenuCategory = 'protein' | 'side' | 'appetizer' | 'dessert' | 'beverage';

// ─── Hierarchical category tree ───────────────────────────────────────────────

export interface MenuCategoryNode {
  id: string;
  name: string;
  parentId?: string;  // undefined = top-level
  sortOrder: number;
}

// ─── Individual menu item ─────────────────────────────────────────────────────

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;     // KEEP — per-guest system maps by this flat type
  categoryId?: string;        // NEW — links to MenuCategoryNode.id (hierarchical)
  description: string;
  instructions?: string;      // Kitchen/prep instructions
  label?: string;             // Short display label (for menus/proposals)
  notes?: string;             // Internal admin notes
  photoBase64?: string;       // Base64-encoded photo
  unit?: string;              // 'per person' | 'per tray' | 'per piece' | etc.
  pricePerServing: number;    // Price charged per serving
  costPerServing: number;     // Cost to make this item
  isAvailable: boolean;
  tags?: string[];            // workflow tags e.g., ['hibachi', 'standard', 'custom']
  dietaryTags?: string[];     // e.g., ['vegetarian', 'gluten-free', 'dairy-free']
  allergens?: string[];       // e.g., ['shellfish', 'nuts', 'dairy']
}

// ─── Catering event menu (bulk/buffet — not per-guest) ───────────────────────

export interface CateringSelectedItem {
  menuItemId: string;
  name: string;             // snapshot at time of save
  servings: number;         // defaults to total guest count; manually overridable
  pricePerServing: number;  // snapshot
  costPerServing: number;   // snapshot
  unit?: string;            // snapshot
  notes?: string;
}

export interface CateringEventMenu {
  id: string;
  bookingId: string;
  name?: string;        // display name for template menus
  menuType: 'catering';
  selectedItems: CateringSelectedItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Guest menu selection for a single guest at an event
export interface GuestMenuSelection {
  id: string;
  guestName: string;
  isAdult: boolean; // true for adult, false for child

  // Protein selection (choose 2) — string to support custom template proteins
  protein1: string;
  protein2: string;

  // Included sides (all included, but track preferences)
  wantsFriedRice: boolean;
  wantsNoodles: boolean;
  wantsSalad: boolean;
  wantsVeggies: boolean;

  // Upgrade add-ons selected (e.g. filet-mignon, scallops at +$5/person)
  upgradeProteins?: string[];

  // Special requests and allergies
  specialRequests: string;
  allergies: string;
}

// Complete menu for an event
export interface EventMenu {
  id: string;
  bookingId: string;
  name?: string;        // display name for template menus
  guestSelections: GuestMenuSelection[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuPricingSnapshot {
  menuId: string;
  subtotalOverride: number;
  foodCostOverride: number;
  calculatedAt: string;
}

export interface MenuPricingBreakdown {
  subtotalOverride: number;
  foodCostOverride: number;
  missingItemIds: string[];
}

// Form data for guest menu selection
export interface GuestMenuFormData {
  guestName: string;
  isAdult: boolean;
  protein1: string;
  protein2: string;
  wantsFriedRice: boolean;
  wantsNoodles: boolean;
  wantsSalad: boolean;
  wantsVeggies: boolean;
  upgradeProteins?: string[];
  specialRequests: string;
  allergies: string;
}

// Private dinner menu template (configurable, stored in localStorage)
// protein field is a string key — allows custom proteins beyond the fixed ProteinType set
export interface PrivateDinnerTemplateUpgrade {
  protein: string;
  label: string;
  pricePerPerson: number;
  costPerPerson: number;
  enabled: boolean;
}

export interface PrivateDinnerTemplate {
  inclusions: string[];
  baseProteins: { protein: string; label: string; enabled: boolean }[];
  upgrades: PrivateDinnerTemplateUpgrade[];
  updatedAt: string;
}

export const DEFAULT_PRIVATE_DINNER_TEMPLATE: PrivateDinnerTemplate = {
  inclusions: ['Side Salad', 'Hibachi Vegetables', 'Fried Rice & Noodles', '2 Protein Choices'],
  baseProteins: [
    { protein: 'chicken',      label: 'Chicken', enabled: true },
    { protein: 'steak',        label: 'Steak',   enabled: true },
    { protein: 'shrimp',       label: 'Shrimp',  enabled: true },
  ],
  upgrades: [
    { protein: 'filet-mignon', label: 'Filet Mignon', pricePerPerson: 5, costPerPerson: 3, enabled: true },
    { protein: 'scallops',     label: 'Scallops',     pricePerPerson: 5, costPerPerson: 3, enabled: true },
  ],
  updatedAt: new Date().toISOString(),
};

// Menu summary for reporting
export interface MenuSummary {
  totalGuests: number;
  totalAdults: number;
  totalChildren: number;
  proteinCounts: Record<string, number>;
  sideCounts: {
    friedRice: number;
    noodles: number;
    salad: number;
    veggies: number;
  };
  specialRequestsCount: number;
  allergiesCount: number;
}

// ============================================================================
// MENU TYPES
// ============================================================================

// Protein options for private dining
export type ProteinType = 'chicken' | 'steak' | 'shrimp' | 'scallops';

// Menu categories
export type MenuCategory = 'protein' | 'side' | 'appetizer' | 'dessert' | 'beverage';

// Individual menu item
export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  pricePerServing: number; // Price charged per serving
  costPerServing: number; // Cost to make this item
  isAvailable: boolean;
  dietaryTags?: string[]; // e.g., ['vegetarian', 'gluten-free', 'dairy-free']
  allergens?: string[]; // e.g., ['shellfish', 'nuts', 'dairy']
}

// Guest menu selection for a single guest at an event
export interface GuestMenuSelection {
  id: string;
  guestName: string;
  isAdult: boolean; // true for adult, false for child

  // Protein selection (choose 2)
  protein1: ProteinType;
  protein2: ProteinType;

  // Included sides (all included, but track preferences)
  wantsFriedRice: boolean;
  wantsNoodles: boolean;
  wantsSalad: boolean;
  wantsVeggies: boolean;

  // Special requests and allergies
  specialRequests: string;
  allergies: string;
}

// Complete menu for an event
export interface EventMenu {
  id: string;
  bookingId: string;
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
  protein1: ProteinType;
  protein2: ProteinType;
  wantsFriedRice: boolean;
  wantsNoodles: boolean;
  wantsSalad: boolean;
  wantsVeggies: boolean;
  specialRequests: string;
  allergies: string;
}

// Menu summary for reporting
export interface MenuSummary {
  totalGuests: number;
  totalAdults: number;
  totalChildren: number;
  proteinCounts: Record<ProteinType, number>;
  sideCounts: {
    friedRice: number;
    noodles: number;
    salad: number;
    veggies: number;
  };
  specialRequestsCount: number;
  allergiesCount: number;
}

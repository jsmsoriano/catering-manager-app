// ============================================================================
// STORAGE EVENT NAMES
// ============================================================================
// Single registry for all window storage-sync event names.
// Import from here instead of using bare string literals to prevent typos
// and enable find-all-references across the codebase.
//
// Usage:
//   dispatch: window.dispatchEvent(new Event(StorageEvent.Bookings))
//   listen:   window.addEventListener(StorageEvent.Bookings, handler)
//   hook:     useStorageEvent(StorageEvent.Bookings, handler)

export const StorageEvent = {
  Bookings: 'bookingsUpdated',
  Staff: 'staffUpdated',
  MoneyRules: 'moneyRulesUpdated',
  FeatureFlags: 'featureFlagsUpdated',
  ProductProfile: 'productProfileUpdated',
  TemplateConfig: 'templateConfigUpdated',
  ShoppingPresets: 'shoppingPresetsUpdated',
  ShoppingLists: 'shoppingListsUpdated',
  PackingChecklists: 'packingChecklistsUpdated',
  Crm: 'crmUpdated',
  QuoteRevision: 'quoteRevisionUpdated',
  CustomerProfiles: 'customerProfilesUpdated',
  Orders: 'ordersUpdated',
} as const;

export type StorageEventName = (typeof StorageEvent)[keyof typeof StorageEvent];

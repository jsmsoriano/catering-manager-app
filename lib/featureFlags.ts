/**
 * Feature flags: enable/disable app features and sidebar navigation.
 * Stored in localStorage; can be extended later (e.g. Supabase, admin API).
 */

import { StorageEvent } from './storageEvents';

export const FEATURE_FLAGS_STORAGE_KEY = 'catering.featureFlags';
export const PRODUCT_PROFILE_STORAGE_KEY = 'catering.productProfile';

export type ProductProfile = 'hibachi_private' | 'hibachi_buffet' | 'catering_pro';

export interface FeatureFlags {
  home: boolean;
  events: boolean;
  pipeline: boolean;
  inbox: boolean;
  customers: boolean;
  staff: boolean;
  menuBuilder: boolean;
  calculator: boolean;
  expenses: boolean;
  invoices: boolean;
  reports: boolean;
  wiki: boolean;
  settings: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  home: true,
  events: true,
  pipeline: false,
  inbox: true,
  customers: true,
  staff: true,
  menuBuilder: true,
  calculator: true,
  expenses: true,
  invoices: true,
  reports: true,
  wiki: true,
  settings: true,
};

export const PRODUCT_PROFILE_FEATURE_DEFAULTS: Record<ProductProfile, FeatureFlags> = {
  hibachi_private: {
    home: true,
    events: true,
    pipeline: true,
    inbox: true,
    customers: true,
    staff: true,
    menuBuilder: false,
    calculator: true,
    expenses: true,
    invoices: true,
    reports: true,
    wiki: false,
    settings: true,
  },
  hibachi_buffet: {
    home: true,
    events: true,
    pipeline: true,
    inbox: true,
    customers: true,
    staff: true,
    menuBuilder: true,
    calculator: true,
    expenses: true,
    invoices: true,
    reports: true,
    wiki: false,
    settings: true,
  },
  catering_pro: {
    ...DEFAULT_FEATURE_FLAGS,
    pipeline: true,
    menuBuilder: true,
    wiki: true,
  },
};

export const DEFAULT_PRODUCT_PROFILE: ProductProfile = 'hibachi_private';

const FEATURE_FLAG_KEYS: (keyof FeatureFlags)[] = [
  'home', 'events', 'pipeline', 'inbox', 'customers', 'staff',
  'menuBuilder', 'calculator', 'expenses', 'invoices', 'reports', 'wiki', 'settings',
];

function loadFromStorage(): FeatureFlags {
  if (typeof window === 'undefined') return DEFAULT_FEATURE_FLAGS;
  try {
    const raw = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    if (!raw) {
      const profile = loadProductProfile();
      return PRODUCT_PROFILE_FEATURE_DEFAULTS[profile];
    }
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    const out = { ...DEFAULT_FEATURE_FLAGS };
    FEATURE_FLAG_KEYS.forEach((key) => {
      if (typeof parsed[key] === 'boolean') out[key] = parsed[key];
    });
    return out;
  } catch {
    return DEFAULT_FEATURE_FLAGS;
  }
}

export function loadFeatureFlags(): FeatureFlags {
  return loadFromStorage();
}

export function saveFeatureFlags(flags: FeatureFlags): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(flags));
  window.dispatchEvent(new Event(StorageEvent.FeatureFlags));
}

export function loadProductProfile(): ProductProfile {
  if (typeof window === 'undefined') return DEFAULT_PRODUCT_PROFILE;
  try {
    const raw = localStorage.getItem(PRODUCT_PROFILE_STORAGE_KEY);
    if (
      raw === 'hibachi_private' ||
      raw === 'hibachi_buffet' ||
      raw === 'catering_pro'
    ) {
      return raw;
    }
    return DEFAULT_PRODUCT_PROFILE;
  } catch {
    return DEFAULT_PRODUCT_PROFILE;
  }
}

export function saveProductProfile(profile: ProductProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRODUCT_PROFILE_STORAGE_KEY, profile);
  window.dispatchEvent(new Event(StorageEvent.ProductProfile));
}

export function applyProductProfileDefaults(profile: ProductProfile): FeatureFlags {
  const defaults = PRODUCT_PROFILE_FEATURE_DEFAULTS[profile];
  saveFeatureFlags(defaults);
  saveProductProfile(profile);
  return defaults;
}

export function setFeatureFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
  const flags = loadFromStorage();
  saveFeatureFlags({ ...flags, [key]: value });
}

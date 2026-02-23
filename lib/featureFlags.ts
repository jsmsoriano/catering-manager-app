/**
 * Feature flags: enable/disable app features and sidebar navigation.
 * Stored in localStorage; can be extended later (e.g. Supabase, admin API).
 */

export const FEATURE_FLAGS_STORAGE_KEY = 'catering.featureFlags';

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

const FEATURE_FLAG_KEYS: (keyof FeatureFlags)[] = [
  'home', 'events', 'pipeline', 'inbox', 'customers', 'staff',
  'menuBuilder', 'calculator', 'expenses', 'invoices', 'reports', 'wiki', 'settings',
];

function loadFromStorage(): FeatureFlags {
  if (typeof window === 'undefined') return DEFAULT_FEATURE_FLAGS;
  try {
    const raw = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    if (!raw) return DEFAULT_FEATURE_FLAGS;
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
  window.dispatchEvent(new Event('featureFlagsUpdated'));
}

export function setFeatureFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
  const flags = loadFromStorage();
  saveFeatureFlags({ ...flags, [key]: value });
}

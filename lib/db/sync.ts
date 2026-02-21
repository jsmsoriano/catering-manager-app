import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchBookings, upsertBookings } from './bookings';
import { fetchStaff, upsertStaff } from './staff';
import { fetchExpenses, upsertExpenses } from './expenses';
import { fetchMoneyRules, saveMoneyRulesToDB, loadMoneyRulesFromStorage } from './moneyRules';
import { fetchCustomerPayments, upsertCustomerPayments } from './customerPayments';

// Must match the key used by saveRules() / loadRules() in lib/moneyRules.ts
const MONEY_RULES_LOCAL_KEY = 'moneyRules';

// ─── Loop-prevention flag ─────────────────────────────────────────────────────
// When initSync writes to localStorage, we don't want those writes to trigger
// the write-back listeners and create an infinite loop.
let _isSyncing = false;

// ─── Generic domain sync helper ───────────────────────────────────────────────

async function syncDomain<T>(opts: {
  label: string;
  localKey: string;
  eventName: string;
  fetchFn: (sb: SupabaseClient) => Promise<T[]>;
  upsertFn: (sb: SupabaseClient, data: T[]) => Promise<void>;
  supabase: SupabaseClient;
}): Promise<void> {
  const { label, localKey, eventName, fetchFn, upsertFn, supabase } = opts;

  const dbData = await fetchFn(supabase);

  const localRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(localKey) : null;
  const localData: T[] = localRaw ? (JSON.parse(localRaw) as T[]) : [];

  if (dbData.length > 0) {
    // Supabase has data → it wins; update localStorage cache
    _isSyncing = true;
    localStorage.setItem(localKey, JSON.stringify(dbData));
    window.dispatchEvent(new Event(eventName));
    _isSyncing = false;
    console.info(`[sync] Loaded ${dbData.length} ${label} from Supabase`);
  } else if (localData.length > 0) {
    // Supabase empty but localStorage has data → migrate up (one-time)
    await upsertFn(supabase, localData);
    console.info(`[sync] Migrated ${localData.length} ${label} → Supabase`);
  } else {
    console.info(`[sync] ${label}: nothing to sync (both Supabase and localStorage empty)`);
  }
}

// ─── Money rules sync (special case — single JSONB row, not an array) ─────────

async function syncMoneyRules(supabase: SupabaseClient): Promise<void> {
  const dbRules = await fetchMoneyRules(supabase);
  const localRules = loadMoneyRulesFromStorage();

  // Check if localRules are non-default (user has actually configured something)
  const hasLocalRules = typeof localStorage !== 'undefined' &&
    localStorage.getItem(MONEY_RULES_LOCAL_KEY) !== null;

  if (dbRules !== null) {
    // DB has real rules → pull to localStorage (saveRules without dispatching the moneyRulesUpdated event to avoid sync loop)
    _isSyncing = true;
    localStorage.setItem(MONEY_RULES_LOCAL_KEY, JSON.stringify(dbRules));
    _isSyncing = false;
    console.info('[sync] Loaded money rules from Supabase');
  } else if (hasLocalRules) {
    // DB empty, localStorage has rules → migrate up
    await saveMoneyRulesToDB(supabase, localRules);
    console.info('[sync] Migrated money rules → Supabase');
  }
}

// ─── Public: Initialize sync on app load ─────────────────────────────────────

export async function initSync(supabase: SupabaseClient): Promise<void> {
  const labels = ['bookings', 'staff', 'expenses', 'customer payments', 'money rules'];
  const results = await Promise.allSettled([
    syncDomain({
      label: 'bookings',
      localKey: 'bookings',
      eventName: 'bookingsUpdated',
      fetchFn: fetchBookings,
      upsertFn: upsertBookings,
      supabase,
    }),
    syncDomain({
      label: 'staff',
      localKey: 'staff',
      eventName: 'staffUpdated',
      fetchFn: fetchStaff,
      upsertFn: upsertStaff,
      supabase,
    }),
    syncDomain({
      label: 'expenses',
      localKey: 'expenses',
      eventName: 'expensesUpdated',
      fetchFn: fetchExpenses,
      upsertFn: upsertExpenses,
      supabase,
    }),
    syncDomain({
      label: 'customer payments',
      localKey: 'customerPayments',
      eventName: 'customerPaymentsUpdated',
      fetchFn: fetchCustomerPayments,
      upsertFn: upsertCustomerPayments,
      supabase,
    }),
    syncMoneyRules(supabase),
  ]);

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[sync] ${labels[i]} failed:`, result.reason);
    }
  });
}

// ─── Public: Set up write-back listeners ─────────────────────────────────────

type WriteDomainConfig = {
  localKey: string;
  push: (supabase: SupabaseClient, raw: string) => Promise<void>;
};

export function setupWriteListeners(supabase: SupabaseClient): () => void {
  const DOMAINS: Record<string, WriteDomainConfig> = {
    bookingsUpdated: {
      localKey: 'bookings',
      push: async (sb, raw) => upsertBookings(sb, JSON.parse(raw)),
    },
    staffUpdated: {
      localKey: 'staff',
      push: async (sb, raw) => upsertStaff(sb, JSON.parse(raw)),
    },
    expensesUpdated: {
      localKey: 'expenses',
      push: async (sb, raw) => upsertExpenses(sb, JSON.parse(raw)),
    },
    customerPaymentsUpdated: {
      localKey: 'customerPayments',
      push: async (sb, raw) => upsertCustomerPayments(sb, JSON.parse(raw)),
    },
    moneyRulesUpdated: {
      localKey: MONEY_RULES_LOCAL_KEY,
      push: async (sb, raw) => saveMoneyRulesToDB(sb, JSON.parse(raw)),
    },
  };

  const handlers: Record<string, () => void> = {};

  for (const [eventName, config] of Object.entries(DOMAINS)) {
    handlers[eventName] = () => {
      if (_isSyncing) return; // skip writes triggered by initSync itself
      const raw = localStorage.getItem(config.localKey);
      if (!raw) return;
      config.push(supabase, raw).catch((err) =>
        console.error(`[sync] Failed to push ${eventName} to Supabase:`, err)
      );
    };
    window.addEventListener(eventName, handlers[eventName]);
  }

  // Return cleanup function
  return () => {
    for (const [eventName, handler] of Object.entries(handlers)) {
      window.removeEventListener(eventName, handler);
    }
  };
}

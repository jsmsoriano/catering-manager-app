import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchStaff, upsertStaff } from './staff';
import { fetchExpenses, upsertExpenses } from './expenses';
import { fetchMoneyRules, saveMoneyRulesToDB, loadMoneyRulesFromStorage } from './moneyRules';
import { fetchCustomerPayments, upsertCustomerPayments } from './customerPayments';

// Must match the key used by saveRules() / loadRules() in lib/moneyRules.ts
const MONEY_RULES_LOCAL_KEY = 'moneyRules';

// ─── Generic domain migration helper ──────────────────────────────────────────
// On first launch (or after a DB reset): if Supabase is empty but localStorage
// has data, migrate it up. After migration, React Query hooks own the read path.

async function migrateDomain<T>(opts: {
  label: string;
  localKey: string;
  fetchFn: (sb: SupabaseClient) => Promise<T[]>;
  upsertFn: (sb: SupabaseClient, data: T[]) => Promise<void>;
  supabase: SupabaseClient;
}): Promise<void> {
  const { label, localKey, fetchFn, upsertFn, supabase } = opts;

  const dbData = await fetchFn(supabase);

  if (dbData.length > 0) {
    // Supabase already has data — update localStorage cache so React Query
    // initialData is warm on next page load.
    localStorage.setItem(localKey, JSON.stringify(dbData));
    console.info(`[sync] Warmed ${label} cache (${dbData.length} records)`);
  } else {
    const localRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(localKey) : null;
    const localData: T[] = localRaw ? (JSON.parse(localRaw) as T[]) : [];
    if (localData.length > 0) {
      // One-time migration: push existing localStorage data to Supabase.
      await upsertFn(supabase, localData);
      console.info(`[sync] Migrated ${localData.length} ${label} → Supabase`);
    } else {
      console.info(`[sync] ${label}: nothing to migrate`);
    }
  }
}

// ─── Money rules migration (special case — single JSONB row) ──────────────────

async function migrateMoneyRules(supabase: SupabaseClient): Promise<void> {
  const dbRules = await fetchMoneyRules(supabase);
  const hasLocalRules =
    typeof localStorage !== 'undefined' && localStorage.getItem(MONEY_RULES_LOCAL_KEY) !== null;

  if (dbRules !== null) {
    // DB has rules — warm localStorage cache.
    localStorage.setItem(MONEY_RULES_LOCAL_KEY, JSON.stringify(dbRules));
    console.info('[sync] Warmed money rules cache');
  } else if (hasLocalRules) {
    // One-time migration.
    const localRules = loadMoneyRulesFromStorage();
    await saveMoneyRulesToDB(supabase, localRules);
    console.info('[sync] Migrated money rules → Supabase');
  }
}

// ─── Public: Run one-time data migration on app load ─────────────────────────
// Ensures Supabase has a copy of any data that only existed in localStorage.
// React Query hooks (useBookingsQuery, etc.) take over as the live read/write
// layer after this runs. Returns an array of domain labels that failed.

export async function initSync(supabase: SupabaseClient): Promise<string[]> {
  const labels = ['staff', 'expenses', 'customer payments', 'money rules'];
  const results = await Promise.allSettled([
    // Bookings are now user-scoped by stricter RLS and should use React Query
    // as the live path. Skip legacy localStorage->DB bookings migration to
    // avoid false sync failures when local cache belongs to another account.
    migrateDomain({
      label: 'staff',
      localKey: 'staff',
      fetchFn: fetchStaff,
      upsertFn: upsertStaff,
      supabase,
    }),
    migrateDomain({
      label: 'expenses',
      localKey: 'expenses',
      fetchFn: fetchExpenses,
      upsertFn: upsertExpenses,
      supabase,
    }),
    migrateDomain({
      label: 'customer payments',
      localKey: 'customerPayments',
      fetchFn: fetchCustomerPayments,
      upsertFn: upsertCustomerPayments,
      supabase,
    }),
    migrateMoneyRules(supabase),
  ]);

  const failed: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[sync] ${labels[i]} migration failed:`, result.reason);
      failed.push(labels[i]);
    }
  });
  return failed;
}

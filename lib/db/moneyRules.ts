import type { SupabaseClient } from '@supabase/supabase-js';
import type { MoneyRules } from '@/lib/types';
import { DEFAULT_RULES } from '@/lib/moneyRules';

// saveRules() in lib/moneyRules.ts writes to this key
const MONEY_RULES_LOCAL_KEY = 'moneyRules';

// money_rules table uses id = 'default' with a rules JSONB column.
// No app_id needed — single-row config table.

export async function fetchMoneyRules(supabase: SupabaseClient): Promise<MoneyRules | null> {
  const { data, error } = await supabase
    .from('money_rules')
    .select('rules')
    .eq('id', 'default')
    .single();

  if (error) return null;
  if (!data?.rules || Object.keys(data.rules as object).length === 0) return null;

  // Deep-merge DB rules with defaults so new fields get their default values
  return deepMerge(DEFAULT_RULES, data.rules as Partial<MoneyRules>) as MoneyRules;
}

export async function saveMoneyRulesToDB(
  supabase: SupabaseClient,
  rules: MoneyRules
): Promise<void> {
  const { error } = await supabase
    .from('money_rules')
    .upsert({ id: 'default', rules, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Reads current money rules from localStorage (same logic as lib/moneyRules.ts loadRules)
export function loadMoneyRulesFromStorage(): MoneyRules {
  if (typeof localStorage === 'undefined') return DEFAULT_RULES;
  try {
    const raw = localStorage.getItem(MONEY_RULES_LOCAL_KEY);
    if (!raw) return DEFAULT_RULES;
    return deepMerge(DEFAULT_RULES, JSON.parse(raw) as Partial<MoneyRules>) as MoneyRules;
  } catch {
    return DEFAULT_RULES;
  }
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (typeof source !== 'object' || source === null) return source ?? target;
  if (typeof target !== 'object' || target === null) return source;
  const result = { ...(target as Record<string, unknown>) };
  for (const key of Object.keys(source as Record<string, unknown>)) {
    const sv = (source as Record<string, unknown>)[key];
    const tv = (target as Record<string, unknown>)[key];
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv)) {
      result[key] = deepMerge(tv, sv);
    } else if (sv !== null && sv !== undefined) {
      result[key] = sv;
    }
  }
  return result;
}

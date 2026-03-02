'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchMoneyRules, saveMoneyRulesToDB, loadMoneyRulesFromStorage } from '@/lib/db/moneyRules';
import type { MoneyRules } from '@/lib/types';
import { DEFAULT_RULES } from '@/lib/moneyRules';

export const MONEY_RULES_QK = ['moneyRules'] as const;

export function useMoneyRulesQuery() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: MONEY_RULES_QK,
    queryFn: () => fetchMoneyRules(supabase!),
    enabled: !!supabase,
    // Instant paint from localStorage cache; refetched from Supabase immediately
    initialData: () => loadMoneyRulesFromStorage() ?? DEFAULT_RULES,
    initialDataUpdatedAt: 0,
    // fetchMoneyRules returns null if no DB record — fall back to localStorage default
    select: (data) => data ?? DEFAULT_RULES,
  });

  const saveRules = useMutation({
    mutationFn: async (rules: MoneyRules) => {
      await saveMoneyRulesToDB(supabase!, rules);
      return rules;
    },
    onMutate: async (rules) => {
      await qc.cancelQueries({ queryKey: MONEY_RULES_QK });
      const prev = qc.getQueryData<MoneyRules | null>(MONEY_RULES_QK);
      qc.setQueryData<MoneyRules>(MONEY_RULES_QK, rules);
      return { prev };
    },
    onError: (_err, _rules, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(MONEY_RULES_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: MONEY_RULES_QK }),
  });

  return {
    rules: query.data ?? DEFAULT_RULES,
    loading: query.isLoading,
    error: query.error,
    saveRules: saveRules.mutateAsync,
  };
}

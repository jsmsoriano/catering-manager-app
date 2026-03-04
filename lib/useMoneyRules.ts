'use client';

import { useMemo } from 'react';
import { mergeRulesOverrides } from './moneyRules';
import type { MoneyRules } from './types';
import { useTemplateConfig } from './useTemplateConfig';
import { useMoneyRulesQuery } from './hooks/useMoneyRulesQuery';

/**
 * Provides money rules from Supabase (primary source) with template-level
 * overrides applied. Backed by React Query — Supabase is fetched on mount,
 * localStorage is used for instant first paint only.
 */
export function useMoneyRules(): MoneyRules {
  const { config } = useTemplateConfig();
  const { rules } = useMoneyRulesQuery();

  return useMemo(
    () => mergeRulesOverrides(rules, config.defaults?.moneyRulesOverrides),
    [rules, config.defaults?.moneyRulesOverrides]
  );
}

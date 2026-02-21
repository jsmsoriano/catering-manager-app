'use client';

import { useState, useEffect, useMemo } from 'react';
import { DEFAULT_RULES, loadRules, mergeRulesOverrides } from './moneyRules';
import type { MoneyRules } from './types';
import { useTemplateConfig } from './useTemplateConfig';

/**
 * Custom hook to load and use Money Rules from localStorage.
 * Merges in template defaults.moneyRulesOverrides when present (e.g. private chef assistantRequired: false).
 */
export function useMoneyRules(): MoneyRules {
  const { config } = useTemplateConfig();
  const [baseRules, setBaseRules] = useState<MoneyRules>(DEFAULT_RULES);

  useEffect(() => {
    setBaseRules(loadRules());

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'moneyRules') setBaseRules(loadRules());
    };
    const handleCustomChange = () => setBaseRules(loadRules());

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('moneyRulesUpdated', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('moneyRulesUpdated', handleCustomChange);
    };
  }, []);

  return useMemo(
    () => mergeRulesOverrides(baseRules, config.defaults?.moneyRulesOverrides),
    [baseRules, config.defaults?.moneyRulesOverrides]
  );
}

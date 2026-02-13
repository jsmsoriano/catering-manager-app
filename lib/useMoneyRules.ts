'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_RULES, loadRules } from './moneyRules';
import type { MoneyRules } from './types';

/**
 * Deep merge saved rules with defaults so new fields always have values
 */
function mergeWithDefaults(parsed: Partial<MoneyRules>): MoneyRules {
  return {
    pricing: { ...DEFAULT_RULES.pricing, ...parsed.pricing },
    staffing: { ...DEFAULT_RULES.staffing, ...parsed.staffing },
    privateLabor: { ...DEFAULT_RULES.privateLabor, ...parsed.privateLabor },
    buffetLabor: { ...DEFAULT_RULES.buffetLabor, ...parsed.buffetLabor },
    costs: { ...DEFAULT_RULES.costs, ...parsed.costs },
    distance: { ...DEFAULT_RULES.distance, ...parsed.distance },
    profitDistribution: { ...DEFAULT_RULES.profitDistribution, ...parsed.profitDistribution },
    safetyLimits: { ...DEFAULT_RULES.safetyLimits, ...parsed.safetyLimits },
  };
}

/**
 * Custom hook to load and use Money Rules from localStorage
 * Falls back to DEFAULT_RULES if no saved rules exist
 */
export function useMoneyRules(): MoneyRules {
  const [rules, setRules] = useState<MoneyRules>(DEFAULT_RULES);

  useEffect(() => {
    // Load from localStorage on mount using deep merge
    setRules(loadRules());

    // Listen for storage events (when rules are updated in another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'moneyRules' && e.newValue) {
        try {
          setRules(mergeWithDefaults(JSON.parse(e.newValue)));
        } catch (err) {
          console.error('Failed to parse updated money rules:', err);
        }
      }
    };

    // Listen for same-tab updates
    const handleCustomChange = () => {
      setRules(loadRules());
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('moneyRulesUpdated', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('moneyRulesUpdated', handleCustomChange);
    };
  }, []);

  return rules;
}

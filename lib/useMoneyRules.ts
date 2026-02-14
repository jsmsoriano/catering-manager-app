'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_RULES, loadRules } from './moneyRules';
import type { MoneyRules } from './types';

/**
 * Custom hook to load and use Money Rules from localStorage
 * Falls back to DEFAULT_RULES if no saved rules exist
 */
export function useMoneyRules(): MoneyRules {
  const [rules, setRules] = useState<MoneyRules>(DEFAULT_RULES);

  useEffect(() => {
    // Load from localStorage on mount using safe deep merge
    setRules(loadRules());

    // Listen for storage events (when rules are updated in another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'moneyRules') {
        // Re-load using loadRules which safely strips null/NaN values
        setRules(loadRules());
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

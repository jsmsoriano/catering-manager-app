'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_MONEY_RULES } from './moneyRules';
import type { MoneyRules } from './types';

/**
 * Custom hook to load and use Money Rules from localStorage
 * Falls back to DEFAULT_MONEY_RULES if no saved rules exist
 */
export function useMoneyRules(): MoneyRules {
  const [rules, setRules] = useState<MoneyRules>(DEFAULT_MONEY_RULES);

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('moneyRules');
    if (saved) {
      try {
        setRules(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved money rules:', e);
        setRules(DEFAULT_MONEY_RULES);
      }
    }

    // Listen for storage events (when rules are updated in another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'moneyRules' && e.newValue) {
        try {
          setRules(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Failed to parse updated money rules:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return rules;
}

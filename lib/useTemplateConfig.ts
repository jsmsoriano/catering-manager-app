'use client';

import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_TEMPLATE, normalizeTemplateConfig, type BusinessTemplateConfig } from './templateConfig';

const STORAGE_KEY = 'templateConfig';

function loadFromStorage(): BusinessTemplateConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_TEMPLATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeTemplateConfig(parsed);
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_TEMPLATE };
}

function saveToStorage(config: BusinessTemplateConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event('templateConfigUpdated'));
  } catch {
    // ignore
  }
}

export function useTemplateConfig(): {
  config: BusinessTemplateConfig;
  loading: boolean;
  refetch: () => Promise<void>;
  saveTemplateConfig: (config: BusinessTemplateConfig) => Promise<boolean>;
} {
  const [config, setConfig] = useState<BusinessTemplateConfig>(() => loadFromStorage());
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/app-settings');
      if (res.ok) {
        const data = await res.json();
        const next = normalizeTemplateConfig(data.config ?? data);
        setConfig(next);
        saveToStorage(next);
      } else {
        setConfig(loadFromStorage());
      }
    } catch {
      setConfig(loadFromStorage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const onUpdate = () => setConfig(loadFromStorage());
    window.addEventListener('templateConfigUpdated', onUpdate);
    return () => window.removeEventListener('templateConfigUpdated', onUpdate);
  }, []);

  const saveTemplateConfig = useCallback(
    async (next: BusinessTemplateConfig): Promise<boolean> => {
      try {
        const res = await fetch('/api/app-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
        if (res.ok) {
          const data = await res.json();
          const normalized = normalizeTemplateConfig(data.config ?? next);
          setConfig(normalized);
          saveToStorage(normalized);
          return true;
        }
        if (res.status === 503) {
          saveToStorage(next);
          setConfig(next);
          return true;
        }
      } catch {
        // offline or error: persist to localStorage only
        saveToStorage(next);
        setConfig(next);
        return true;
      }
      return false;
    },
    []
  );

  return { config, loading, refetch, saveTemplateConfig };
}

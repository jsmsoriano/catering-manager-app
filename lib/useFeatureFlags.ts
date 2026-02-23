'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  loadFeatureFlags,
  saveFeatureFlags,
  setFeatureFlag as setFlag,
  type FeatureFlags,
} from './featureFlags';

export function useFeatureFlags(): {
  flags: FeatureFlags;
  setFlag: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => void;
  setFlags: (next: FeatureFlags) => void;
} {
  const [flags, setFlagsState] = useState<FeatureFlags>(loadFeatureFlags);

  useEffect(() => {
    const sync = () => setFlagsState(loadFeatureFlags());
    window.addEventListener('featureFlagsUpdated', sync);
    return () => window.removeEventListener('featureFlagsUpdated', sync);
  }, []);

  const setOne = useCallback(<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => {
    setFlag(key, value);
    setFlagsState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setAll = useCallback((next: FeatureFlags) => {
    saveFeatureFlags(next);
    setFlagsState(next);
  }, []);

  return { flags, setFlag: setOne, setFlags: setAll };
}

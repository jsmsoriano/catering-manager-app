'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  loadFeatureFlags,
  saveFeatureFlags,
  setFeatureFlag as setFlag,
  loadProductProfile,
  saveProductProfile,
  applyProductProfileDefaults,
  type FeatureFlags,
  type ProductProfile,
} from './featureFlags';

export function useFeatureFlags(): {
  flags: FeatureFlags;
  setFlag: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => void;
  setFlags: (next: FeatureFlags) => void;
  productProfile: ProductProfile;
  setProductProfile: (profile: ProductProfile) => void;
  applyProfileDefaults: (profile: ProductProfile) => void;
} {
  const [flags, setFlagsState] = useState<FeatureFlags>(loadFeatureFlags);
  const [productProfile, setProductProfileState] = useState<ProductProfile>(loadProductProfile);

  useEffect(() => {
    const sync = () => setFlagsState(loadFeatureFlags());
    window.addEventListener('featureFlagsUpdated', sync);
    return () => window.removeEventListener('featureFlagsUpdated', sync);
  }, []);
  useEffect(() => {
    const sync = () => setProductProfileState(loadProductProfile());
    window.addEventListener('productProfileUpdated', sync);
    return () => window.removeEventListener('productProfileUpdated', sync);
  }, []);

  const setOne = useCallback(<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => {
    setFlag(key, value);
    setFlagsState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setAll = useCallback((next: FeatureFlags) => {
    saveFeatureFlags(next);
    setFlagsState(next);
  }, []);

  const setProfile = useCallback((profile: ProductProfile) => {
    saveProductProfile(profile);
    setProductProfileState(profile);
  }, []);

  const applyProfile = useCallback((profile: ProductProfile) => {
    const nextFlags = applyProductProfileDefaults(profile);
    setProductProfileState(profile);
    setFlagsState(nextFlags);
  }, []);

  return {
    flags,
    setFlag: setOne,
    setFlags: setAll,
    productProfile,
    setProductProfile: setProfile,
    applyProfileDefaults: applyProfile,
  };
}

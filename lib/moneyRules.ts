import type { MoneyRules, Percent } from "@/types/money";
import { loadFromStorage, saveToStorage } from "./storage";

export const STORAGE_KEY_RULES = "hibachi.moneyRules.v1";

export const DEFAULT_RULES: MoneyRules = {
  pricing: {
    basePrivatePerGuest: 60,
    premiumAddOnMinPerGuest: 10,
    premiumAddOnMaxPerGuest: 20,
    defaultGratuityPercent: 20,
    maxGuestsPerChef: 15,
  },
  revenueTreatment: {
    gratuityIsTipPool: true,
    salesTaxIsPassThrough: true,
  },
  privateDinnerPay: {
    chefBasePercentOfSubtotal: 15,
    chefTipSharePercent: 55,
    chefTotalCapPercentOfSubtotal: 28,
    assistantBasePerEvent: 110,
    assistantTipSharePercent: 45,
    assistantPresentDefault: true,
  },
  buffetPay: {
    laborSplit5050: true,
    tipSplit5050: true,
  },
  reserves: {
    businessReservePercentOfSubtotal: 5,
    taxReservePercentOfOperatingProfit: 25,
    autoTransferWithinHours: 72,
  },
  profitDistributions: {
    ownerSplitA: 60,
    ownerSplitB: 40,
    monthlyDistributionPercent: 70,
    monthlyRetainedPercent: 30,
    annualTrueUpEnabled: true,
  },
  safetyLimits: {
    privateTotalLaborMaxPercentOfSubtotal: 30,
    foodCostMaxPercent: 30,
    suppliesMaxPercent: 7,
    warnOnBreach: true,
  },
};

export function clamp(n: number, min: number, max: number) {
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : min;
}

export function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function percentOf(amount: number, pct: Percent) {
  return (amount * (pct / 100)) || 0;
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n || 0);
}

export function loadRules(): MoneyRules {
  // merge on top of defaults for forward-compat
  const stored = loadFromStorage<Partial<MoneyRules>>(STORAGE_KEY_RULES, {});
  return { ...DEFAULT_RULES, ...stored } as MoneyRules;
}

export function saveRules(rules: MoneyRules) {
  saveToStorage(STORAGE_KEY_RULES, rules);
}
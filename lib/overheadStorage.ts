/** Persistent overhead config — shared between Business Rules and Calculator. */

export interface OverheadExpense {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'annual';
}

export interface OverheadConfig {
  expenses: OverheadExpense[];
  eventsPerMonth: number;
  seTaxPct: number;
  incomeTaxPct: number;
}

const KEY = 'overhead_config';

const DEFAULTS: OverheadConfig = {
  expenses: [],
  eventsPerMonth: 4,
  seTaxPct: 15.3,
  incomeTaxPct: 15,
};

export function loadOverheadConfig(): OverheadConfig {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveOverheadConfig(config: OverheadConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config));
  window.dispatchEvent(new Event('overheadConfigUpdated'));
}

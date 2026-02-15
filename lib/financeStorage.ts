import type {
  LaborPaymentRecord,
  OwnerProfitPayoutRecord,
  RetainedEarningsTransaction,
} from './financeTypes';

export const LABOR_PAYMENTS_KEY = 'laborPayments';
export const OWNER_PROFIT_PAYOUTS_KEY = 'ownerProfitPayouts';
export const RETAINED_EARNINGS_KEY = 'retainedEarningsTransactions';

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function loadList<T>(key: string): T[] {
  if (!canUseBrowserStorage()) return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveList<T>(key: string, value: T[], eventName: string) {
  if (!canUseBrowserStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(eventName));
}

export function loadLaborPayments(): LaborPaymentRecord[] {
  return loadList<LaborPaymentRecord>(LABOR_PAYMENTS_KEY);
}

export function saveLaborPayments(value: LaborPaymentRecord[]) {
  saveList<LaborPaymentRecord>(LABOR_PAYMENTS_KEY, value, 'laborPaymentsUpdated');
}

export function loadOwnerProfitPayouts(): OwnerProfitPayoutRecord[] {
  return loadList<OwnerProfitPayoutRecord>(OWNER_PROFIT_PAYOUTS_KEY);
}

export function saveOwnerProfitPayouts(value: OwnerProfitPayoutRecord[]) {
  saveList<OwnerProfitPayoutRecord>(OWNER_PROFIT_PAYOUTS_KEY, value, 'ownerProfitPayoutsUpdated');
}

export function loadRetainedEarningsTransactions(): RetainedEarningsTransaction[] {
  return loadList<RetainedEarningsTransaction>(RETAINED_EARNINGS_KEY);
}

export function saveRetainedEarningsTransactions(value: RetainedEarningsTransaction[]) {
  saveList<RetainedEarningsTransaction>(RETAINED_EARNINGS_KEY, value, 'retainedEarningsUpdated');
}

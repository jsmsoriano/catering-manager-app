import type { StaffRole } from './staffTypes';
import type { ChefRole, OwnerRole } from './types';

export interface LaborPaymentRecord {
  id: string;
  bookingId: string;
  eventDate: string;
  eventTime: string;
  customerName: string;
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  chefRole: ChefRole | 'assistant';
  amount: number;
  recordedAt: string;
}

export interface OwnerProfitPayoutRecord {
  id: string;
  ownerRole: OwnerRole;
  amount: number;
  payoutDate: string; // ISO local date string (YYYY-MM-DD)
  notes?: string;
  createdAt: string;
}

export type RetainedEarningsTransactionType = 'deposit' | 'withdrawal';

export interface RetainedEarningsTransaction {
  id: string;
  type: RetainedEarningsTransactionType;
  amount: number;
  transactionDate: string; // ISO local date string (YYYY-MM-DD)
  notes?: string;
  createdAt: string;
}

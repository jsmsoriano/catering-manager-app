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

export type DistributionStatus = 'draft' | 'posted' | 'paid';

export interface ProfitDistributionOverride {
  id: string;
  bookingId: string;
  chefPayouts: number;
  ownerAPayout: number;
  ownerBPayout: number;
  retainedEarnings: number;
  distributionStatus?: DistributionStatus;
  notes?: string;
  updatedAt: string;
}

export type CustomerPaymentType = 'deposit' | 'payment' | 'refund';
export type CustomerPaymentMethod =
  | 'cash'
  | 'zelle'
  | 'venmo'
  | 'card'
  | 'bank-transfer'
  | 'other';

export interface CustomerPaymentRecord {
  id: string;
  bookingId: string;
  paymentDate: string; // ISO local date string (YYYY-MM-DD)
  amount: number;
  type: CustomerPaymentType;
  method?: CustomerPaymentMethod;
  notes?: string;
  recordedAt: string;
}

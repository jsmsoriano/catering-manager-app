export type ExpenseCategory =
  | 'food'
  | 'gas-mileage'
  | 'supplies'
  | 'equipment'
  | 'labor'
  | 'other';

export interface Expense {
  id: string;
  date: string; // ISO date string
  category: ExpenseCategory;
  amount: number;
  description: string;
  bookingId?: string; // Optional - links to a specific booking
  receiptPhoto?: string; // Optional - base64 image data
  notes?: string;
}

export interface ExpenseFormData {
  date: string;
  category: ExpenseCategory;
  amount: string;
  description: string;
  bookingId?: string;
  notes?: string;
}

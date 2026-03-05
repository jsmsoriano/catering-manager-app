export type CrmActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'quote_sent'
  | 'booking_converted'
  | 'inquiry_declined'
  | 'task_created'
  | 'task_completed';

export interface CrmActivity {
  id: string;
  customerId?: string;
  bookingId?: string;
  type: CrmActivityType;
  text: string;
  createdAt: string;
}

export type CrmTaskStatus = 'open' | 'completed' | 'cancelled';

export interface CrmTask {
  id: string;
  customerId?: string;
  bookingId?: string;
  title: string;
  notes?: string;
  dueDate?: string; // YYYY-MM-DD
  status: CrmTaskStatus;
  assignedTo?: string; // Staff name or ID responsible for this task
  createdAt: string;
  completedAt?: string;
}

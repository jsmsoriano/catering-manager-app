import type { SupabaseClient } from '@supabase/supabase-js';
import type { Expense } from '@/lib/expenseTypes';

// ─── Row type ─────────────────────────────────────────────────────────────────

interface ExpenseRow {
  app_id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  booking_id: string | null;
  receipt_photo: string | null;
  notes: string | null;
  source: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

function toRow(e: Expense): ExpenseRow {
  const now = new Date().toISOString();
  return {
    app_id: e.id,
    date: e.date,
    category: e.category,
    amount: e.amount,
    description: e.description,
    booking_id: e.bookingId ?? null,
    receipt_photo: e.receiptPhoto ?? null,
    notes: e.notes ?? null,
    source: e.source ?? null,
    source_id: e.sourceId ?? null,
    created_at: now,
    updated_at: now,
  };
}

function fromRow(r: ExpenseRow): Expense {
  return {
    id: r.app_id,
    date: r.date,
    category: r.category as Expense['category'],
    amount: r.amount,
    description: r.description ?? '',
    bookingId: r.booking_id ?? undefined,
    receiptPhoto: r.receipt_photo ?? undefined,
    notes: r.notes ?? undefined,
    source: (r.source ?? undefined) as Expense['source'],
    sourceId: r.source_id ?? undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchExpenses(supabase: SupabaseClient): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .not('app_id', 'is', null)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data as ExpenseRow[]).map(fromRow);
}

export async function upsertExpenses(
  supabase: SupabaseClient,
  expenses: Expense[]
): Promise<void> {
  if (expenses.length === 0) return;
  const rows = expenses.map(toRow);
  const { error } = await supabase
    .from('expenses')
    .upsert(rows, { onConflict: 'app_id' });
  if (error) throw error;
}

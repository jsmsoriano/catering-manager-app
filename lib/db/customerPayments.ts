import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomerPaymentRecord } from '@/lib/financeTypes';

// ─── Row type ─────────────────────────────────────────────────────────────────

interface CustomerPaymentRow {
  app_id: string;
  booking_id: string;
  payment_date: string;
  amount: number;
  type: string;
  method: string | null;
  notes: string | null;
  recorded_at: string;
}

function toRow(p: CustomerPaymentRecord): CustomerPaymentRow {
  return {
    app_id: p.id,
    booking_id: p.bookingId,
    payment_date: p.paymentDate,
    amount: p.amount,
    type: p.type,
    method: p.method ?? null,
    notes: p.notes ?? null,
    recorded_at: p.recordedAt,
  };
}

function fromRow(r: CustomerPaymentRow): CustomerPaymentRecord {
  return {
    id: r.app_id,
    bookingId: r.booking_id,
    paymentDate: r.payment_date,
    amount: r.amount,
    type: r.type as CustomerPaymentRecord['type'],
    method: (r.method ?? undefined) as CustomerPaymentRecord['method'],
    notes: r.notes ?? undefined,
    recordedAt: r.recorded_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchCustomerPayments(
  supabase: SupabaseClient
): Promise<CustomerPaymentRecord[]> {
  const { data, error } = await supabase
    .from('customer_payments')
    .select('*')
    .not('app_id', 'is', null)
    .order('payment_date', { ascending: false });

  if (error) throw error;
  return (data as CustomerPaymentRow[]).map(fromRow);
}

export async function upsertCustomerPayments(
  supabase: SupabaseClient,
  payments: CustomerPaymentRecord[]
): Promise<void> {
  if (payments.length === 0) return;
  const rows = payments.map(toRow);
  const { error } = await supabase
    .from('customer_payments')
    .upsert(rows, { onConflict: 'app_id' });
  if (error) throw error;
}

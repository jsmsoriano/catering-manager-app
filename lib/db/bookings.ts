import type { SupabaseClient } from '@supabase/supabase-js';
import type { Booking, PipelineStatus } from '@/lib/bookingTypes';

// ─── Row type (snake_case, matches Supabase bookings table) ──────────────────

interface BookingRow {
  app_id: string;
  event_type: string;
  event_date: string;
  event_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  adults: number;
  children: number;
  location: string;
  distance_miles: number;
  premium_add_on: number;
  subtotal: number;
  gratuity: number;
  distance_fee: number;
  total: number;
  status: string;
  service_status: string | null;
  payment_status: string | null;
  deposit_percent: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  balance_due_date: string | null;
  amount_paid: number | null;
  balance_due_amount: number | null;
  confirmed_at: string | null;
  prep_purchase_by_date: string | null;
  notes: string;
  staff_assignments: unknown;
  staffing_profile_id: string | null;
  menu_id: string | null;
  menu_pricing_snapshot: unknown;
  pricing_snapshot: unknown;
  discount_type: string | null;
  discount_value: number | null;
  reconciliation_id: string | null;
  pricing_mode: string | null;
  business_type: string | null;
  locked: boolean | null;
  source: string | null;
  pipeline_status: string | null;
  pipeline_status_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Derive default pipeline_status from source/status for backfill */
function defaultPipelineStatus(row: BookingRow): PipelineStatus {
  if (row.source === 'inquiry') return 'inquiry';
  switch (row.status) {
    case 'completed':
      return 'completed';
    case 'confirmed':
      return 'booked';
    case 'pending':
      return 'quote_sent';
    case 'cancelled':
      return 'booked'; // show in booked for historical; or could use a 6th column
    default:
      return 'inquiry';
  }
}

function toRow(b: Booking): BookingRow {
  return {
    app_id: b.id,
    event_type: b.eventType,
    event_date: b.eventDate,
    event_time: b.eventTime,
    customer_name: b.customerName,
    customer_email: b.customerEmail,
    customer_phone: b.customerPhone,
    adults: b.adults,
    children: b.children,
    location: b.location,
    distance_miles: b.distanceMiles,
    premium_add_on: b.premiumAddOn,
    subtotal: b.subtotal,
    gratuity: b.gratuity,
    distance_fee: b.distanceFee,
    total: b.total,
    status: b.status,
    service_status: b.serviceStatus ?? null,
    payment_status: b.paymentStatus ?? null,
    deposit_percent: b.depositPercent ?? null,
    deposit_amount: b.depositAmount ?? null,
    deposit_due_date: b.depositDueDate ?? null,
    balance_due_date: b.balanceDueDate ?? null,
    amount_paid: b.amountPaid ?? null,
    balance_due_amount: b.balanceDueAmount ?? null,
    confirmed_at: b.confirmedAt ?? null,
    prep_purchase_by_date: b.prepPurchaseByDate ?? null,
    notes: b.notes,
    staff_assignments: b.staffAssignments ?? [],
    staffing_profile_id: b.staffingProfileId ?? null,
    menu_id: b.menuId ?? null,
    menu_pricing_snapshot: b.menuPricingSnapshot ?? null,
    pricing_snapshot: b.pricingSnapshot ?? null,
    discount_type: b.discountType ?? null,
    discount_value: b.discountValue ?? null,
    reconciliation_id: b.reconciliationId ?? null,
    pricing_mode: b.pricingMode ?? null,
    business_type: b.businessType ?? null,
    locked: b.locked ?? null,
    source: b.source ?? null,
    pipeline_status: b.pipeline_status ?? null,
    pipeline_status_updated_at: b.pipeline_status_updated_at ?? null,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}

function fromRow(r: BookingRow): Booking {
  return {
    id: r.app_id,
    eventType: r.event_type as Booking['eventType'],
    eventDate: r.event_date,
    eventTime: r.event_time,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    adults: r.adults,
    children: r.children,
    location: r.location ?? '',
    distanceMiles: r.distance_miles,
    premiumAddOn: r.premium_add_on,
    subtotal: r.subtotal,
    gratuity: r.gratuity,
    distanceFee: r.distance_fee,
    total: r.total,
    status: r.status as Booking['status'],
    serviceStatus: (r.service_status ?? undefined) as Booking['serviceStatus'],
    paymentStatus: (r.payment_status ?? undefined) as Booking['paymentStatus'],
    depositPercent: r.deposit_percent ?? undefined,
    depositAmount: r.deposit_amount ?? undefined,
    depositDueDate: r.deposit_due_date ?? undefined,
    balanceDueDate: r.balance_due_date ?? undefined,
    amountPaid: r.amount_paid ?? undefined,
    balanceDueAmount: r.balance_due_amount ?? undefined,
    confirmedAt: r.confirmed_at ?? undefined,
    prepPurchaseByDate: r.prep_purchase_by_date ?? undefined,
    notes: r.notes ?? '',
    staffAssignments: (r.staff_assignments as Booking['staffAssignments']) ?? [],
    staffingProfileId: r.staffing_profile_id ?? undefined,
    menuId: r.menu_id ?? undefined,
    menuPricingSnapshot: (r.menu_pricing_snapshot as Booking['menuPricingSnapshot']) ?? undefined,
    pricingSnapshot: (r.pricing_snapshot as Booking['pricingSnapshot']) ?? undefined,
    discountType: (r.discount_type ?? undefined) as Booking['discountType'],
    discountValue: r.discount_value ?? undefined,
    reconciliationId: r.reconciliation_id ?? undefined,
    pricingMode: (r.pricing_mode ?? undefined) as Booking['pricingMode'],
    businessType: (r.business_type ?? undefined) as Booking['businessType'],
    locked: r.locked ?? undefined,
    source: r.source ?? undefined,
    pipeline_status: (r.pipeline_status ?? defaultPipelineStatus(r)) as PipelineStatus,
    pipeline_status_updated_at: r.pipeline_status_updated_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchBookings(supabase: SupabaseClient): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .not('app_id', 'is', null)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return (data as BookingRow[]).map(fromRow);
}

export async function upsertBookings(
  supabase: SupabaseClient,
  bookings: Booking[]
): Promise<void> {
  if (bookings.length === 0) return;
  const rows = bookings.map(toRow);
  const { error } = await supabase
    .from('bookings')
    .upsert(rows, { onConflict: 'app_id' });
  if (error) throw error;
}

export async function deleteBooking(
  supabase: SupabaseClient,
  appId: string
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('app_id', appId);
  if (error) throw error;
}

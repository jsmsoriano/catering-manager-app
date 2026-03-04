import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchBookingById } from '@/lib/db/bookings';
import { fetchMoneyRules } from '@/lib/db/moneyRules';
import { calculateBookingFinancials } from '@/lib/bookingFinancials';
import { DEFAULT_RULES } from '@/lib/moneyRules';
import { bookingHasStaff } from '@/lib/chefIdentity';
import { CHEF_ROLE_TO_STAFF_ROLE } from '@/lib/staffTypes';
import { isAdminUser } from '@/lib/auth/admin';

function getRole(user: { app_metadata?: Record<string, unknown> | null } | null): string {
  return String(user?.app_metadata?.role ?? '').toLowerCase();
}

const CHEF_ROLE_LABELS: Record<string, string> = {
  lead: 'Lead Chef',
  full: 'Full Chef',
  buffet: 'Buffet Chef',
  assistant: 'Assistant',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase unavailable' }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = getRole(user);
  const admin = isAdminUser(user);
  if (role !== 'chef' && !admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const email = String(user.email ?? '').trim().toLowerCase();
  let ownStaffId: string | null = null;
  if (!admin) {
    if (!email) {
      return NextResponse.json({ error: 'Missing chef email' }, { status: 400 });
    }
    const { data: ownStaff, error: staffError } = await supabase
      .from('staff')
      .select('app_id')
      .eq('email', email)
      .maybeSingle();
    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 });
    }
    if (!ownStaff?.app_id) {
      return NextResponse.json({ error: 'Chef profile is not linked to staff.' }, { status: 403 });
    }
    ownStaffId = ownStaff.app_id;
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: 'Service client unavailable' }, { status: 503 });
  }

  const booking = await fetchBookingById(service, id);
  if (!booking) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (!admin && ownStaffId && !bookingHasStaff(booking.staffAssignments, ownStaffId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rules = (await fetchMoneyRules(service)) ?? DEFAULT_RULES;
  const { financials } = calculateBookingFinancials(booking, rules);

  const staffIds = Array.from(
    new Set((booking.staffAssignments ?? []).map((s) => s.staffId).filter(Boolean))
  );
  const staffMap = new Map<string, { name: string }>();
  if (staffIds.length > 0) {
    const { data: staffRows } = await service
      .from('staff')
      .select('app_id, name')
      .in('app_id', staffIds);
    (staffRows ?? []).forEach((s) => {
      staffMap.set(String(s.app_id), { name: String(s.name ?? '') });
    });
  }

  const staffRows = financials.laborCompensation.map((comp, idx) => {
    const staffRole = CHEF_ROLE_TO_STAFF_ROLE[comp.role as keyof typeof CHEF_ROLE_TO_STAFF_ROLE];
    let matchIndex = 0;
    for (let i = 0; i < idx; i++) {
      if (financials.laborCompensation[i].role === comp.role) matchIndex++;
    }
    let seenForRole = 0;
    const assignment = (booking.staffAssignments ?? []).find((a) => {
      if (a.role !== staffRole) return false;
      if (seenForRole === matchIndex) return true;
      seenForRole++;
      return false;
    });
    const assignedName = assignment ? staffMap.get(assignment.staffId)?.name : null;
    return {
      role: comp.role,
      roleLabel: CHEF_ROLE_LABELS[comp.role] ?? comp.role,
      name: assignedName ?? (CHEF_ROLE_LABELS[comp.role] ?? comp.role),
      basePay: comp.basePay,
      gratuityShare: comp.gratuityShare,
      totalPay: comp.finalPay,
    };
  });

  return NextResponse.json({
    event: {
      id: booking.id,
      customerName: booking.customerName,
      eventDate: booking.eventDate,
      eventTime: booking.eventTime,
      location: booking.location,
      guests: booking.adults + booking.children,
      status: booking.status,
      subtotal: booking.subtotal,
      gratuity: booking.gratuity,
      total: booking.total,
      notes: booking.notes,
    },
    financials: {
      totalStaffCompensation: financials.totalLaborPaid,
      foodCost: financials.foodCost,
      suppliesCost: financials.suppliesCost,
      transportationCost: financials.transportationCost,
      totalCosts: financials.totalCosts,
      grossProfit: financials.grossProfit,
    },
    staff: staffRows,
  });
}

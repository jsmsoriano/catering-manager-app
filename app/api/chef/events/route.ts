import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchBookings } from '@/lib/db/bookings';
import { isAdminUser } from '@/lib/auth/admin';

function getRole(user: { app_metadata?: Record<string, unknown> | null } | null): string {
  return String(user?.app_metadata?.role ?? '').toLowerCase();
}

export async function GET() {
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

  try {
    const source = admin ? createServiceClient() : supabase;
    if (!source) {
      return NextResponse.json({ error: 'Service client unavailable' }, { status: 503 });
    }
    const bookings = await fetchBookings(source, { limit: 500 });
    const rows = bookings
      .map((b) => ({
        id: b.id,
        customerName: b.customerName,
        eventDate: b.eventDate,
        eventTime: b.eventTime,
        location: b.location,
        guests: b.adults + b.children,
        status: b.status,
        paymentStatus: b.paymentStatus ?? null,
        subtotal: b.subtotal,
        gratuity: b.gratuity,
        total: b.total,
      }))
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    return NextResponse.json({ events: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

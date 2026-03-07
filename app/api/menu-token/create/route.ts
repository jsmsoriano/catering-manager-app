// ============================================================================
// POST /api/menu-token/create
// Auth-required: admin creates a customer menu collection link for a booking.
// Only valid for hibachi private dinner events.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';

const bodySchema = z.object({
  bookingId: z.string().min(1),
  snapshot: z.object({
    customerName: z.string(),
    customerEmail: z.string(),
    eventDate: z.string(),
    eventTime: z.string(),
    location: z.string(),
    adults: z.number().int().min(0),
    children: z.number().int().min(0),
    businessName: z.string(),
    // Template config — no pricing
    baseProteins: z.array(z.object({
      protein: z.string(),
      label: z.string(),
    })),
    upgradeProteins: z.array(z.object({
      protein: z.string(),
      label: z.string(),
    })),
    inclusions: z.array(z.string()),
  }),
});

async function getAuthenticatedUser() {
  if (process.env.BYPASS_AUTH === 'true') return { id: 'bypass-user' };
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 });
  }

  const { bookingId, snapshot } = parsed.data;
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const token = crypto.randomUUID();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  // Expires 48 hours before the event date
  const eventMs = new Date(snapshot.eventDate).getTime();
  const expiresAt = new Date(eventMs - 48 * 60 * 60 * 1000).toISOString();

  // Upsert: one active menu token per booking (replace any existing)
  const { error: upsertError } = await supabase
    .from('menu_tokens')
    .upsert(
      { token, booking_id: bookingId, status: 'pending', snapshot, expires_at: expiresAt, submissions: null, submitted_at: null },
      { onConflict: 'booking_id' }
    );

  if (upsertError) {
    // onConflict upsert may not be supported if no unique constraint on booking_id — fallback to insert
    const { error: insertError } = await supabase
      .from('menu_tokens')
      .insert({ token, booking_id: bookingId, status: 'pending', snapshot, expires_at: expiresAt });
    if (insertError) {
      console.error('[api/menu-token/create]', insertError);
      return NextResponse.json({ error: 'Failed to create menu link' }, { status: 500 });
    }
  }

  return NextResponse.json({ token, url: `${origin}/menu/${token}` });
}

// ============================================================================
// GET  /api/menu-token/[token]  — Public: fetch menu token + snapshot
// POST /api/menu-token/[token]  — Public: submit guest selections
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';

const guestSelectionSchema = z.object({
  id: z.string(),
  guestName: z.string(),
  isAdult: z.boolean(),
  protein1: z.string(),
  protein2: z.string(),
  wantsFriedRice: z.boolean(),
  wantsNoodles: z.boolean(),
  wantsSalad: z.boolean(),
  wantsVeggies: z.boolean(),
  upgradeProteins: z.array(z.string()).optional(),
  specialRequests: z.string(),
  allergies: z.string(),
});

const submitBodySchema = z.object({
  selections: z.array(guestSelectionSchema).min(1),
});

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await supabase
    .from('menu_tokens')
    .select('id, token, booking_id, status, snapshot, submissions, created_at, submitted_at, expires_at')
    .eq('token', token)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Menu link not found' }, { status: 404 });

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This menu link has expired' }, { status: 410 });
  }

  return NextResponse.json(data);
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // Fetch existing token row
  const { data: existing, error: fetchError } = await supabase
    .from('menu_tokens')
    .select('id, status, expires_at, booking_id')
    .eq('token', token)
    .single();

  if (fetchError || !existing) return NextResponse.json({ error: 'Menu link not found' }, { status: 404 });

  if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This menu link has expired' }, { status: 410 });
  }

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = submitBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid submission', issues: parsed.error.issues }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('menu_tokens')
    .update({ status: 'submitted', submissions: parsed.data.selections, submitted_at: now })
    .eq('token', token);

  if (updateError) {
    console.error('[api/menu-token/submit]', updateError);
    return NextResponse.json({ error: 'Failed to save selections' }, { status: 500 });
  }

  return NextResponse.json({ success: true, bookingId: existing.booking_id });
}

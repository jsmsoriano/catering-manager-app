// ============================================================================
// /api/proposals/accept — Public: mark a proposal as accepted by token
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createRateLimiter } from '@/lib/rateLimit';
import { acceptProposalBodySchema } from '@/lib/apiSchemas';

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export async function POST(req: NextRequest) {
  const rl = await limiter.check(req);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = acceptProposalBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 });
  }
  const { token } = parsed.data;

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // Read existing row (service client bypasses RLS)
  const { data: existing, error: fetchError } = await supabase
    .from('proposal_tokens')
    .select('id, booking_id, status, expires_at')
    .eq('token', token)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This proposal link has expired' }, { status: 410 });
  }

  if (existing.status === 'accepted') {
    return NextResponse.json({ success: true, bookingId: existing.booking_id, alreadyAccepted: true });
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('proposal_tokens')
    .update({ status: 'accepted', accepted_at: now })
    .eq('token', token);

  if (updateError) {
    console.error('[api/proposals/accept]', updateError);
    return NextResponse.json({ error: 'Failed to accept proposal' }, { status: 500 });
  }

  // Step 2: sync booking. Compensate on failure (revert proposal status so client
  // can retry without being told it was already accepted).
  const { error: bookingSyncError } = await supabase
    .from('bookings')
    .update({
      pipeline_status: 'deposit_pending',
      pipeline_status_updated_at: now,
      updated_at: now,
    })
    .eq('app_id', existing.booking_id);

  if (bookingSyncError) {
    console.error('[api/proposals/accept] booking sync failed — rolling back proposal status', bookingSyncError);
    await supabase
      .from('proposal_tokens')
      .update({ status: 'pending', accepted_at: null })
      .eq('token', token);
    return NextResponse.json({ error: 'Failed to sync booking status — please try again' }, { status: 500 });
  }

  return NextResponse.json({ success: true, bookingId: existing.booking_id });
}

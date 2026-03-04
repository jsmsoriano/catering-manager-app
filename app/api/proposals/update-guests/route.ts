import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { ProposalSnapshot } from '@/lib/proposalTypes';
import { calculateGuestChangeCutoffISO, isGuestChangeLocked } from '@/lib/guestChangePolicy';
import { updateGuestsBodySchema } from '@/lib/apiSchemas';
import { createRateLimiter } from '@/lib/rateLimit';

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

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

  const parsed = updateGuestsBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 });
  }
  const { token, adults, children } = parsed.data;

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('proposal_tokens')
    .select('booking_id, snapshot, expires_at')
    .eq('token', token)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This proposal link has expired' }, { status: 410 });
  }

  const snapshot = (existing.snapshot ?? {}) as ProposalSnapshot;
  const now = new Date().toISOString();
  const cutoffAt = snapshot.guestChangeCutoffAt || calculateGuestChangeCutoffISO(snapshot.eventDate ?? '');
  const locked = isGuestChangeLocked({
    nowIso: now,
    guestCountLockedAt: snapshot.guestCountLockedAt,
    guestChangeCutoffAt: cutoffAt,
    eventDate: snapshot.eventDate ?? '',
  });

  if (locked) {
    const lockedSnapshot: ProposalSnapshot = {
      ...snapshot,
      guestChangeCutoffAt: cutoffAt,
      guestCountLockedAt: snapshot.guestCountLockedAt ?? now,
      guestChangeLockedReason: snapshot.guestChangeLockedReason ?? 'Guest count changes are locked 1 day before the event.',
      finalAdults: snapshot.finalAdults ?? snapshot.adults,
      finalChildren: snapshot.finalChildren ?? snapshot.children,
    };
    await supabase.from('proposal_tokens').update({ snapshot: lockedSnapshot }).eq('token', token);
    return NextResponse.json(
      {
        error: 'Guest count is locked.',
        locked: true,
        cutoffAt,
      },
      { status: 409 }
    );
  }

  const updatedSnapshot: ProposalSnapshot = {
    ...snapshot,
    adults: Math.round(adults),
    children: Math.round(children),
    guestChangeCutoffAt: cutoffAt,
    guestCountLastClientEditAt: now,
    requiresReview: true,
    guestCountLockedAt: undefined,
    guestChangeLockedReason: undefined,
  };

  const { error: updateProposalError } = await supabase
    .from('proposal_tokens')
    .update({ snapshot: updatedSnapshot })
    .eq('token', token);

  if (updateProposalError) {
    console.error('[api/proposals/update-guests] proposal update failed', updateProposalError);
    return NextResponse.json({ error: 'Failed to update guest count' }, { status: 500 });
  }

  const { error: bookingUpdateError } = await supabase
    .from('bookings')
    .update({
      adults: Math.round(adults),
      children: Math.round(children),
      updated_at: now,
    })
    .eq('app_id', existing.booking_id);
  if (bookingUpdateError) {
    console.error('[api/proposals/update-guests] booking sync failed', bookingUpdateError);
  }

  return NextResponse.json({
    success: true,
    snapshot: updatedSnapshot,
    bookingSynced: !bookingUpdateError,
  });
}

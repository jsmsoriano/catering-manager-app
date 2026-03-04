import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { ProposalSnapshot } from '@/lib/proposalTypes';
import { calculateMenuChangeCutoffISO, isMenuChangeLocked } from '@/lib/menuChangePolicy';
import { createRateLimiter } from '@/lib/rateLimit';
import { requestMenuChangeBodySchema } from '@/lib/apiSchemas';

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

  const parsed = requestMenuChangeBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 });
  }
  const { token, note } = parsed.data;

  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

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
  const cutoffAt = snapshot.menuChangeCutoffAt || calculateMenuChangeCutoffISO(snapshot.eventDate ?? '');
  const locked = isMenuChangeLocked({
    nowIso: now,
    eventDate: snapshot.eventDate ?? '',
    menuChangeCutoffAt: cutoffAt,
    menuChangeLockedAt: snapshot.menuChangeLockedAt,
  });

  const updatedSnapshot: ProposalSnapshot = {
    ...snapshot,
    menuChangeCutoffAt: cutoffAt,
    menuChangeRequestStatus: 'pending',
    menuChangeRequestNote: note,
    menuChangeRequestedAt: now,
    menuChangeRequestLate: locked,
    menuChangeLockedAt: locked ? snapshot.menuChangeLockedAt ?? now : undefined,
    menuChangeLockedReason: locked
      ? snapshot.menuChangeLockedReason ?? 'Menu self-service changes are locked 2 days before the event.'
      : undefined,
    menuChangeResolutionNote: undefined,
    menuChangeResolvedAt: undefined,
    menuChangeResolvedBy: undefined,
    requiresReview: true,
  };

  const { error: proposalUpdateError } = await supabase
    .from('proposal_tokens')
    .update({ snapshot: updatedSnapshot })
    .eq('token', token);

  if (proposalUpdateError) {
    console.error('[api/proposals/request-menu-change] proposal update failed', proposalUpdateError);
    return NextResponse.json({ error: 'Failed to save menu change request' }, { status: 500 });
  }

  const { error: bookingUpdateError } = await supabase
    .from('bookings')
    .update({ updated_at: now })
    .eq('app_id', existing.booking_id);
  if (bookingUpdateError) {
    console.error('[api/proposals/request-menu-change] booking sync failed', bookingUpdateError);
  }

  return NextResponse.json({
    success: true,
    locked,
    snapshot: updatedSnapshot,
  });
}

// ============================================================================
// /api/proposals/create — Auth-required: create a proposal token + snapshot
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ProposalSnapshot } from '@/lib/proposalTypes';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { snapshot: ProposalSnapshot; bookingId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { snapshot, bookingId } = body;
  if (!snapshot || !bookingId) {
    return NextResponse.json({ error: 'snapshot and bookingId are required' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const token = crypto.randomUUID();
  const origin = req.headers.get('origin') ?? '';

  const { error } = await supabase.from('proposal_tokens').insert({
    token,
    booking_id: bookingId,
    status: 'pending',
    snapshot,
  });

  if (error) {
    console.error('[api/proposals/create]', error);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }

  return NextResponse.json({
    token,
    url: `${origin}/proposal/${token}`,
  });
}

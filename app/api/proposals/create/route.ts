// ============================================================================
// /api/proposals/create — Auth-required: create a proposal token + snapshot
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createProposalBodySchema } from '@/lib/apiSchemas';

async function getAuthenticatedUser() {
  const bypass = process.env.BYPASS_AUTH === 'true';
  if (bypass) {
    return { id: 'bypass-user' } as { id: string };
  }
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createProposalBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 });
  }
  const { snapshot, bookingId } = parsed.data;

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const token = crypto.randomUUID();
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
  const origin = configuredOrigin || new URL(req.url).origin;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Step 1: create the proposal token
  const { error: insertError } = await supabase.from('proposal_tokens').insert({
    token,
    booking_id: bookingId,
    status: 'pending',
    snapshot,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error('[api/proposals/create]', insertError);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }

  // Step 2: sync booking pipeline status. Compensate on failure (delete the token
  // so the DB doesn't hold a proposal that the booking doesn't know about).
  const { error: bookingUpdateError } = await supabase
    .from('bookings')
    .update({
      pipeline_status: 'quote_sent',
      pipeline_status_updated_at: now,
      updated_at: now,
      last_contacted_at: now,
      next_follow_up_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('app_id', bookingId);

  if (bookingUpdateError) {
    console.error('[api/proposals/create] booking sync failed — rolling back token', bookingUpdateError);
    await supabase.from('proposal_tokens').delete().eq('token', token);
    return NextResponse.json({ error: 'Failed to sync booking status' }, { status: 500 });
  }

  return NextResponse.json({
    token,
    url: `${origin}/proposal/${token}`,
  });
}

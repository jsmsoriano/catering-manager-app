import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { updateProposalBodySchema } from '@/lib/apiSchemas';

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

  const parsed = updateProposalBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 });
  }
  const { token, snapshot } = parsed.data;

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from('proposal_tokens')
    .select('id, booking_id, snapshot, status, accepted_at')
    .eq('token', token)
    .single();
  if (existingError || !existing) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('proposal_tokens')
    .update({
      snapshot,
      status: 'pending',
      accepted_at: null,
    })
    .eq('token', token);

  if (updateError) {
    console.error('[api/proposals/update]', updateError);
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
  }

  const { error: bookingUpdateError } = await supabase
    .from('bookings')
    .update({
      pipeline_status: 'quote_sent',
      pipeline_status_updated_at: now,
      updated_at: now,
      last_contacted_at: now,
      next_follow_up_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('app_id', existing.booking_id);
  if (bookingUpdateError) {
    console.error('[api/proposals/update] booking sync failed', bookingUpdateError);
    await supabase
      .from('proposal_tokens')
      .update({
        snapshot: existing.snapshot,
        status: existing.status,
        accepted_at: existing.accepted_at,
      })
      .eq('token', token);
    return NextResponse.json({ error: 'Failed to sync booking status' }, { status: 500 });
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
  const origin = configuredOrigin || new URL(req.url).origin;
  return NextResponse.json({
    success: true,
    token,
    url: `${origin}/proposal/${token}`,
  });
}

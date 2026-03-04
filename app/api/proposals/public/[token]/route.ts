import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createRateLimiter } from '@/lib/rateLimit';

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = await limiter.check(req);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { token } = await params;
  const proposalToken = token?.trim();
  if (!proposalToken || proposalToken.length > 200) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('proposal_tokens')
    .select('id, token, booking_id, status, snapshot, created_at, accepted_at, expires_at')
    .eq('token', proposalToken)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This proposal link has expired' }, { status: 410 });
  }

  return NextResponse.json({
    proposal: {
      id: data.id,
      token: data.token,
      bookingId: data.booking_id,
      status: data.status,
      snapshot: data.snapshot,
      createdAt: data.created_at,
      acceptedAt: data.accepted_at,
      expiresAt: data.expires_at,
    },
  });
}

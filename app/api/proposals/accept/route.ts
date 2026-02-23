// ============================================================================
// /api/proposals/accept — Public: mark a proposal as accepted by token
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  let body: { token: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token } = body;
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // Read existing row first (anon select is allowed by RLS policy)
  const { data: existing, error: fetchError } = await supabase
    .from('proposal_tokens')
    .select('id, booking_id, status')
    .eq('token', token)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (existing.status === 'accepted') {
    return NextResponse.json({ success: true, bookingId: existing.booking_id, alreadyAccepted: true });
  }

  const { error: updateError } = await supabase
    .from('proposal_tokens')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('token', token);

  if (updateError) {
    console.error('[api/proposals/accept]', updateError);
    return NextResponse.json({ error: 'Failed to accept proposal' }, { status: 500 });
  }

  return NextResponse.json({ success: true, bookingId: existing.booking_id });
}

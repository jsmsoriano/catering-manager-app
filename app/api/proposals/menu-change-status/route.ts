import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { ProposalSnapshot } from '@/lib/proposalTypes';
import { isManagerOrAdminUser } from '@/lib/auth/admin';

async function getAuthenticatedUser() {
  const bypass = process.env.BYPASS_AUTH === 'true';
  if (bypass) {
    return {
      id: 'bypass-user',
      email: 'bypass@local.test',
      app_metadata: { role: 'admin' },
    } as { id: string; email?: string; app_metadata?: { role?: string } };
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

type UpdateMenuChangeStatusBody = {
  token: string;
  status: 'approved' | 'declined';
  resolutionNote?: string;
};

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isManagerOrAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: UpdateMenuChangeStatusBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token = body.token?.trim();
  const status = body.status;
  const resolutionNote = body.resolutionNote?.trim() || '';

  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });
  if (status !== 'approved' && status !== 'declined') {
    return NextResponse.json({ error: 'status must be approved or declined' }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data: existing, error: fetchError } = await supabase
    .from('proposal_tokens')
    .select('booking_id, snapshot')
    .eq('token', token)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const snapshot = (existing.snapshot ?? {}) as ProposalSnapshot;
  const now = new Date().toISOString();
  const userMetadata = (user as { user_metadata?: { full_name?: string; name?: string } }).user_metadata;
  const resolverName =
    user.email ||
    userMetadata?.full_name ||
    userMetadata?.name ||
    user.id;

  const updatedSnapshot: ProposalSnapshot = {
    ...snapshot,
    menuChangeRequestStatus: status,
    menuChangeResolvedAt: now,
    menuChangeResolvedBy: resolverName,
    menuChangeResolutionNote: resolutionNote || undefined,
    requiresReview: false,
  };

  const { error: proposalUpdateError } = await supabase
    .from('proposal_tokens')
    .update({ snapshot: updatedSnapshot })
    .eq('token', token);

  if (proposalUpdateError) {
    console.error('[api/proposals/menu-change-status] proposal update failed', proposalUpdateError);
    return NextResponse.json({ error: 'Failed to update menu change status' }, { status: 500 });
  }

  const { error: bookingUpdateError } = await supabase
    .from('bookings')
    .update({ updated_at: now })
    .eq('app_id', existing.booking_id);
  if (bookingUpdateError) {
    console.error('[api/proposals/menu-change-status] booking sync failed', bookingUpdateError);
  }

  return NextResponse.json({
    success: true,
    snapshot: updatedSnapshot,
  });
}

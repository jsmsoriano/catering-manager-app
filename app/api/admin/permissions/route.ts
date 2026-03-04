import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isAdminUser } from '@/lib/auth/admin';

type AllowedRole = '' | 'chef' | 'manager' | 'admin';

const ALLOWED_ROLES: AllowedRole[] = ['', 'chef', 'manager', 'admin'];

async function getAuthenticatedUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const service = createServiceClient();
    if (!service) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: String((u.app_metadata as Record<string, unknown> | undefined)?.role ?? ''),
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const service = createServiceClient();
    if (!service) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    let body: { userId?: string; role?: string };
    try {
      body = (await request.json()) as { userId?: string; role?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const userId = String(body.userId ?? '').trim();
    const role = String(body.role ?? '').trim().toLowerCase() as AllowedRole;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { data: targetData, error: targetError } = await service.auth.admin.getUserById(userId);
    if (targetError || !targetData.user) {
      return NextResponse.json({ error: targetError?.message ?? 'User not found' }, { status: 404 });
    }

    const currentMeta = (targetData.user.app_metadata ?? {}) as Record<string, unknown>;
    const nextMeta = { ...currentMeta };
    if (role) nextMeta.role = role;
    else delete nextMeta.role;

    const { error: updateError } = await service.auth.admin.updateUserById(userId, {
      app_metadata: nextMeta,
    });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

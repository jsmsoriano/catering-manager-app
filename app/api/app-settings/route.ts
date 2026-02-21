import { createClient } from '@/lib/supabase/server';
import { getTemplateConfig, saveTemplateConfig } from '@/lib/appSettings';
import { normalizeTemplateConfig } from '@/lib/templateConfig';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const config = await getTemplateConfig();
    return Response.json({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.app_metadata?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const config = normalizeTemplateConfig(body);
    const ok = await saveTemplateConfig(config);
    if (!ok) {
      return Response.json(
        { error: 'Could not save (Supabase unavailable or error)' },
        { status: 503 }
      );
    }
    return Response.json({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}

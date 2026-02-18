import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return Response.json(
      {
        ok: false,
        error: 'Missing env vars',
        details: {
          hasUrl: !!url,
          hasAnonKey: !!anonKey,
        },
      },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    if (!supabase) {
      return Response.json(
        { ok: false, error: 'Supabase client not available' },
        { status: 503 }
      );
    }
    const { error } = await supabase.auth.getSession();
    if (error) {
      return Response.json(
        { ok: false, error: 'Supabase reachable but auth check failed', message: error.message },
        { status: 503 }
      );
    }
    return Response.json({ ok: true, message: 'Supabase configured and reachable' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ ok: false, error: message }, { status: 503 });
  }
}

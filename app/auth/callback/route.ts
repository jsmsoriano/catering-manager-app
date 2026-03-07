import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') ? nextParam : '/';

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        const role = (user?.app_metadata as { role?: string } | undefined)?.role;
        // If next is explicitly set (e.g. /auth/reset-password), always respect it.
        const redirectTo = next !== '/' ? next : role === 'chef' ? '/calculator' : next;
        return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
      }
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', requestUrl.origin));
}

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const LOGIN_PATH = '/login';
const SIGNUP_PATH = '/signup';
const AUTH_CALLBACK_PATH = '/auth/callback';
const INQUIRY_PATH = '/inquiry';

const PROPOSAL_PATH = '/proposal';

const publicPaths = [LOGIN_PATH, SIGNUP_PATH, AUTH_CALLBACK_PATH, INQUIRY_PATH, PROPOSAL_PATH];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/api')) return true;
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (user && isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL(LOGIN_PATH, request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, images, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|hibachisun.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

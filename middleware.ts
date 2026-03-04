import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const LOGIN_PATH = '/login';
const SIGNUP_PATH = '/signup';
const AUTH_CALLBACK_PATH = '/auth/callback';
const CHEF_PATH = '/chef';
const ADMIN_PATH = '/admin';
const BETA_PATH = '/beta';
const INQUIRY_PATH = '/inquiry';
const INQUIRY_FORM_PATH = '/inquiry-form';
const INQUIRY_CHAT_PATH = '/inquiry-chat';

const PROPOSAL_PATH = '/proposal';
if (process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV === 'production') {
  throw new Error('BYPASS_AUTH must not be enabled in production');
}
const AUTH_BYPASS_ENABLED = process.env.BYPASS_AUTH === 'true';
const BETA_ALLOW_SIGNUP =
  process.env.BETA_ALLOW_SIGNUP === 'true' ||
  process.env.NEXT_PUBLIC_BETA_ALLOW_SIGNUP === 'true';

const publicPaths = [LOGIN_PATH, SIGNUP_PATH, AUTH_CALLBACK_PATH, BETA_PATH, INQUIRY_PATH, INQUIRY_FORM_PATH, INQUIRY_CHAT_PATH, PROPOSAL_PATH];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/api')) return true;
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function parseAdminEmails(): string[] {
  const defaults = ['djet.soriano@gmail.com'];
  const combined = [defaults.join(','), process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
    .filter(Boolean)
    .join(',');
  return combined
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function middleware(request: NextRequest) {
  // Temporary auth bypass: allow all routes without requiring a Supabase session.
  if (AUTH_BYPASS_ENABLED) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

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
        // Keep request and response cookies in sync per Supabase SSR middleware guidance.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isApiPath = pathname.startsWith('/api/');

  // Chef role: restricted to the chef portal and chef API routes.
  const userRole = (user?.app_metadata as { role?: string } | undefined)?.role;
  const userRoleLower = String(userRole ?? '').toLowerCase();
  const emailLower = String(user?.email ?? '').toLowerCase();
  const isAdmin =
    userRoleLower === 'admin' ||
    parseAdminEmails().includes(emailLower);
  const isChef = userRoleLower === 'chef';

  if (
    (pathname === ADMIN_PATH || pathname.startsWith(ADMIN_PATH + '/')) &&
    (!user || !isAdmin)
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (
    pathname === '/calculator' ||
    pathname.startsWith('/calculator/')
  ) {
    if (!user || (!isChef && !isAdmin)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  if (userRole === 'chef' && user) {
    const isAllowed =
      isApiPath ||
      pathname === CHEF_PATH ||
      pathname.startsWith(CHEF_PATH + '/') ||
      pathname === '/calculator' ||
      pathname.startsWith('/calculator/') ||
      pathname === AUTH_CALLBACK_PATH ||
      pathname.startsWith(AUTH_CALLBACK_PATH + '/') ||
      pathname === LOGIN_PATH;
    if (!isAllowed) {
      return NextResponse.redirect(new URL(CHEF_PATH, request.url));
    }
  }

  const isSignupPath = pathname === SIGNUP_PATH || pathname.startsWith(SIGNUP_PATH + '/');
  const isProposalPath = pathname === PROPOSAL_PATH || pathname.startsWith(PROPOSAL_PATH + '/');
  const isInquiryPath =
    pathname === INQUIRY_PATH ||
    pathname === INQUIRY_FORM_PATH ||
    pathname === INQUIRY_CHAT_PATH;
  const isBetaPath = pathname === BETA_PATH || pathname.startsWith(BETA_PATH + '/');

  // Invite-only beta by default: disable self-serve signup unless explicitly enabled.
  if (isSignupPath && !BETA_ALLOW_SIGNUP) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  // Logged-in users are redirected away from auth pages, but may still open public
  // customer/testing views (inquiry, proposal, beta hub).
  if (user && !isApiPath && isPublicPath(pathname) && !isInquiryPath && !isProposalPath && !isBetaPath) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL(LOGIN_PATH, request.url);
    redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
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

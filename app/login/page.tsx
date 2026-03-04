'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';

function LoginPageInner() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
          <div className="text-lg text-text-muted">Loading…</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const allowSignup = process.env.NEXT_PUBLIC_BETA_ALLOW_SIGNUP === 'true';
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') ? nextParam : '/';
  const errorParam = searchParams.get('error');

  // If NEXT_PUBLIC_USERNAME_DOMAIN is set (e.g. "hibachi.app"), short usernames
  // like "chef" are converted to "chef@hibachi.app" before sign-in.
  const usernameDomain = process.env.NEXT_PUBLIC_USERNAME_DOMAIN?.trim();
  const usernameMode = Boolean(usernameDomain);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(errorParam === 'auth' ? 'Authentication failed. Please try again.' : null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  function resolveEmail(value: string): string {
    const trimmed = value.trim();
    if (!usernameDomain || trimmed.includes('@')) return trimmed;
    return `${trimmed}@${usernameDomain}`;
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    if (!supabase) return;
    setOauthLoading(true);
    setError(null);
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('next', next);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    });
    setOauthLoading(false);
    if (oauthError) setError(oauthError.message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setError('Auth is not configured.');
      setLoading(false);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: resolveEmail(login), password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    // Force a full navigation so middleware reads the freshly persisted auth cookies.
    window.location.assign(next);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center">
          <Image
            src="/hibachisun.png"
            alt="Hibachi A Go Go"
            width={140}
            height={39}
            className="object-contain"
            priority
          />
          <h1 className="mt-6 text-2xl font-bold text-text-primary">Sign in</h1>
          <p className="mt-1 text-sm text-text-muted">to your catering account</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-text-secondary">
                {usernameMode ? 'Username or email' : 'Email'}
              </label>
              <input
                id="login"
                name="login"
                type={usernameMode ? 'text' : 'email'}
                autoComplete="username"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder={usernameMode ? `e.g. chef  or  chef@${usernameDomain}` : 'you@example.com'}
              />
              {usernameMode && (
                <p className="mt-1 text-xs text-text-muted">
                  Enter your username or full email address
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 pr-10 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeSlashIcon className="h-5 w-5" />
                    : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-text-muted">or</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={oauthLoading}
              className="w-full rounded-md border border-border bg-card-elevated px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50"
            >
              {oauthLoading ? 'Redirecting…' : 'Sign in with Google'}
            </button>
            {allowSignup ? (
              <p className="text-center text-sm text-text-muted">
                Don’t have an account?{' '}
                <Link href="/signup" className="font-medium text-accent hover:text-accent-hover">
                  Sign up
                </Link>
              </p>
            ) : (
              <p className="text-center text-sm text-text-muted">
                Invite-only beta. Contact admin for account access.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

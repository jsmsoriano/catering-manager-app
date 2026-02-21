'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase/client';

export default function AccountPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<'saved' | 'error' | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<'saved' | 'error' | null>(null);

  const meta = user?.user_metadata as { full_name?: string; name?: string; avatar_url?: string } | undefined;
  const isEmailUser = user?.app_metadata?.provider === 'email';

  useEffect(() => {
    setDisplayName(meta?.full_name ?? meta?.name ?? '');
  }, [meta?.full_name, meta?.name]);

  if (authLoading) {
    return (
      <div className="p-8">
        <p className="text-text-muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-text-muted">You must be signed in to view this page.</p>
        <Link href="/login" className="mt-2 inline-block text-accent hover:underline">Sign in</Link>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setSavingProfile(true);
    setProfileMessage(null);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName || undefined },
    });
    setSavingProfile(false);
    setProfileMessage(error ? 'error' : 'saved');
    if (!error) setTimeout(() => setProfileMessage(null), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage('error');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage('error');
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setChangingPassword(true);
    setPasswordMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    setPasswordMessage(error ? 'error' : 'saved');
    if (!error) {
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMessage(null), 3000);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Account</h1>
          <Link
            href="/"
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="space-y-8">
          {/* Profile */}
          <section className="rounded-lg border border-border bg-card-elevated p-6">
            <h2 className="text-lg font-semibold text-text-primary">Profile</h2>
            <div className="mt-4 flex items-center gap-4">
              {meta?.avatar_url ? (
                <Image
                  src={meta.avatar_url}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-2xl font-medium text-accent">
                  {(meta?.full_name ?? meta?.name ?? user.email)?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}
              <div className="flex-1">
                <p className="text-sm text-text-muted">{user.email}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {isEmailUser ? 'Signed in with email' : 'Signed in with Google'}
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveProfile} className="mt-4">
              <label className="block text-sm font-medium text-text-secondary">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                placeholder="Your name"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {savingProfile ? 'Saving…' : 'Save'}
                </button>
                {profileMessage === 'saved' && <span className="text-sm text-green-600">Saved.</span>}
                {profileMessage === 'error' && <span className="text-sm text-red-600">Save failed.</span>}
              </div>
            </form>
          </section>

          {/* Change password (email users only) */}
          {isEmailUser && (
            <section className="rounded-lg border border-border bg-card-elevated p-6">
              <h2 className="text-lg font-semibold text-text-primary">Change password</h2>
              <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                    placeholder="Min 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">Confirm new password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={changingPassword || !newPassword || newPassword !== confirmPassword}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    {changingPassword ? 'Updating…' : 'Update password'}
                  </button>
                  {passwordMessage === 'saved' && <span className="text-sm text-green-600">Password updated.</span>}
                  {passwordMessage === 'error' && <span className="text-sm text-red-600">Update failed or passwords don’t match.</span>}
                </div>
              </form>
            </section>
          )}

          {!isEmailUser && (
            <section className="rounded-lg border border-border bg-card-elevated p-6">
              <h2 className="text-lg font-semibold text-text-primary">Password</h2>
              <p className="mt-2 text-sm text-text-muted">
                You signed in with Google. To set a password for this account, use the Supabase Dashboard or add a "Set password" flow later.
              </p>
            </section>
          )}

          {/* Admin: Settings */}
          {isAdmin && (
            <section className="rounded-lg border border-border bg-card-elevated p-6">
              <h2 className="text-lg font-semibold text-text-primary">Admin Settings</h2>
              <p className="mt-2 text-sm text-text-muted">
                Configure pricing, staffing, labor rules, and other business settings.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  Business Rules &amp; Pricing →
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

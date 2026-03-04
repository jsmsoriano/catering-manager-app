'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { useTemplateConfig } from '@/lib/useTemplateConfig';

export default function AccountSetupForm({ showAdminSection = true }: { showAdminSection?: boolean }) {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { config, saveTemplateConfig } = useTemplateConfig();
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const meta = user?.user_metadata as {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    business_name?: string;
    address?: string;
    phone?: string;
  } | undefined;
  const isEmailUser = user?.app_metadata?.provider === 'email';

  useEffect(() => {
    setFullName(meta?.full_name ?? meta?.name ?? '');
    setBusinessName(meta?.business_name ?? config.businessName ?? '');
    setBusinessAddress(meta?.address ?? config.businessAddress ?? '');
    setBusinessPhone(meta?.phone ?? config.businessPhone ?? '');
    setEmail(user?.email ?? '');
    setLogoUrl(meta?.avatar_url ?? config.logoUrl ?? '');
  }, [
    meta?.full_name,
    meta?.name,
    meta?.business_name,
    meta?.address,
    meta?.phone,
    meta?.avatar_url,
    user?.email,
    config.businessName,
    config.businessAddress,
    config.businessPhone,
    config.logoUrl,
  ]);

  if (authLoading) {
    return <p className="text-text-muted">Loading…</p>;
  }

  if (!user) {
    return (
      <div>
        <p className="text-text-muted">You must be signed in to view this page.</p>
        <Link href="/login" className="mt-2 inline-block text-accent hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;

    const nextEmail = email.trim();
    const nextName = fullName.trim();
    const nextBusiness = businessName.trim();
    const nextAddress = businessAddress.trim();
    const nextPhone = businessPhone.trim();
    const nextLogo = logoUrl.trim();
    const password = newPassword.trim();

    if (!nextName) {
      setProfileMessage('Name is required.');
      return;
    }
    if (!nextEmail || !nextEmail.includes('@')) {
      setProfileMessage('Enter a valid email address.');
      return;
    }
    if (password) {
      if (password.length < 6) {
        setProfileMessage('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setProfileMessage('Passwords do not match.');
        return;
      }
    }

    setSavingProfile(true);
    setProfileMessage(null);
    const payload: {
      email?: string;
      password?: string;
      data: {
        full_name?: string;
        business_name?: string;
        address?: string;
        phone?: string;
        avatar_url?: string;
      };
    } = {
      data: {
        full_name: nextName || undefined,
        business_name: nextBusiness || undefined,
        address: nextAddress || undefined,
        phone: nextPhone || undefined,
        avatar_url: nextLogo || undefined,
      },
    };
    if (nextEmail && nextEmail !== user.email) payload.email = nextEmail;
    if (password) payload.password = password;

    const { error } = await supabase.auth.updateUser(payload);

    const businessSaveOk = await saveTemplateConfig({
      ...config,
      businessName: nextBusiness || config.businessName,
      businessAddress: nextAddress || undefined,
      businessPhone: nextPhone || undefined,
      businessEmail: nextEmail || undefined,
      logoUrl: nextLogo || undefined,
    });

    setSavingProfile(false);
    if (error || !businessSaveOk) {
      setProfileMessage(error?.message ?? 'Save failed. Please try again.');
    } else {
      const emailChanged = nextEmail !== user.email;
      setProfileMessage(emailChanged ? 'Saved. Check your inbox to confirm the new email address.' : 'Profile setup saved.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setProfileMessage(null), 4000);
    }
  };

  const handleLogoFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileMessage('Please select an image file for logo.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setProfileMessage('Logo file is too large. Please use an image under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setLogoUrl(result);
        setProfileMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card-elevated p-6">
        <h2 className="text-lg font-semibold text-text-primary">Profile Setup</h2>
        <div className="mt-4 flex items-center gap-4">
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
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
        <form onSubmit={handleSaveProfile} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Business name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
              placeholder="Your business name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Address</label>
            <input
              type="text"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
              placeholder="Business address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Phone</label>
            <input
              type="text"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
              placeholder="Business phone"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
              placeholder="you@company.com"
            />
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-sm font-medium text-text-secondary">Business logo</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Used for account avatar, proposal emails, invoices, and BEO printouts.
            </p>
            <div className="mt-3 flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Business logo preview" className="h-14 w-14 rounded-md border border-border object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border text-xs text-text-muted">No logo</div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleLogoFile(e.target.files?.[0])}
                className="block text-xs text-text-secondary file:mr-3 file:rounded-md file:border file:border-border file:bg-card-elevated file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text-primary hover:file:bg-card"
              />
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="rounded-md border border-border bg-card-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-card"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                placeholder="Leave blank to keep current"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-text-primary"
                placeholder="Confirm new password"
              />
            </div>
          </div>
          {!isEmailUser && (
            <p className="text-xs text-text-muted">
              You are signed in with Google. Password updates may require email auth to be enabled in Supabase.
            </p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {savingProfile ? 'Saving…' : 'Save Profile Setup'}
            </button>
            {profileMessage && (
              <span className={`text-sm ${profileMessage.toLowerCase().includes('saved') ? 'text-green-600' : 'text-red-600'}`}>
                {profileMessage}
              </span>
            )}
          </div>
        </form>
      </section>

      {showAdminSection && isAdmin && (
        <section className="rounded-lg border border-border bg-card-elevated p-6">
          <h2 className="text-lg font-semibold text-text-primary">Admin Settings</h2>
          <p className="mt-2 text-sm text-text-muted">
            Configure pricing, staffing, labor rules, and other business settings.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              Business Rules &amp; Pricing →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

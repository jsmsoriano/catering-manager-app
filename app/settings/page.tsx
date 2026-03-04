'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/AuthProvider';
import { useFeatureFlags } from '@/lib/useFeatureFlags';
import type { FeatureFlags } from '@/lib/featureFlags';
import { BusinessRulesContent } from '../business-rules/page';
import AccountSetupForm from '@/components/AccountSetupForm';

const SETTINGS_TABS = [
  { id: 'account', name: 'Account' },
  { id: 'appearance', name: 'Appearance' },
  { id: 'rules', name: 'Business rules' },
  { id: 'admin', name: 'Admin' },
] as const;

const ADMIN_FEATURES: { key: keyof FeatureFlags; label: string; description: string }[] = [
  { key: 'home', label: 'Home', description: 'Dashboard landing page in the sidebar.' },
  { key: 'events', label: 'Events', description: 'Events (bookings) in the sidebar.' },
  { key: 'pipeline', label: 'Pipeline', description: 'Pipeline in the sidebar and standalone /pipeline page. Pipeline view on Events is always available.' },
  { key: 'inbox', label: 'Notifications', description: 'Notifications (inquiries & alerts) in the sidebar.' },
  { key: 'customers', label: 'Customers', description: 'Customers in the sidebar.' },
  { key: 'staff', label: 'Staff', description: 'Staff (Team, Team Calendar) in the sidebar.' },
  { key: 'menuBuilder', label: 'Menu Builder', description: 'Menu Builder in the sidebar.' },
  { key: 'calculator', label: 'Calculator', description: 'Calculator in the sidebar.' },
  { key: 'expenses', label: 'Expenses', description: 'Expenses in the sidebar.' },
  { key: 'invoices', label: 'Invoices', description: 'Invoices in the sidebar.' },
  { key: 'reports', label: 'Reports', description: 'Reports in the sidebar.' },
  { key: 'wiki', label: 'Wiki', description: 'Wiki in the sidebar.' },
  { key: 'settings', label: 'Settings', description: 'Settings in the sidebar (always visible).' },
];

function AppearanceContent() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? (theme === 'system' ? resolvedTheme : theme) ?? 'dark' : 'dark';
  const displayTheme = current === 'dark' ? 'dark' : 'light';

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Theme</h2>
        <p className="text-sm text-text-muted">
          Choose light or dark mode for the app.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-card-elevated has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/30">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={displayTheme === 'light'}
              onChange={() => setTheme('light')}
              className="h-4 w-4 border-border text-accent focus:ring-accent"
            />
            <span className="text-sm font-medium text-text-primary">Light</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-card-elevated has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/30">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={displayTheme === 'dark'}
              onChange={() => setTheme('dark')}
              className="h-4 w-4 border-border text-accent focus:ring-accent"
            />
            <span className="text-sm font-medium text-text-primary">Dark</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function AdminFeatureFlagsContent() {
  const { flags, setFlags } = useFeatureFlags();
  const [localFlags, setLocalFlags] = useState<FeatureFlags>(() => ({ ...flags }));

  useEffect(() => {
    setLocalFlags({ ...flags });
  }, [flags]);

  const hasFlagChanges = useMemo(
    () => ADMIN_FEATURES.some(({ key }) => key !== 'settings' && localFlags[key] !== flags[key]),
    [localFlags, flags]
  );
  const hasChanges = hasFlagChanges;

  const handleSave = () => {
    setFlags(localFlags);
  };

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
      <p className="text-sm text-text-muted">
        Enable or disable features and sidebar navigation. Click Save to apply changes.
      </p>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_FEATURES.map(({ key, label }) => {
          const isSettings = key === 'settings';
          const isLocked = isSettings;
          return (
            <li key={key} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
              <div className="font-medium text-text-primary">{label}</div>
              <label className={`flex shrink-0 items-center gap-2 ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={isSettings || !!localFlags[key]}
                  disabled={isLocked}
                  onChange={(e) => !isLocked && setLocalFlags((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent disabled:opacity-70"
                />
                <span className="text-sm text-text-secondary">
                  {isSettings ? 'Always on' : 'Enabled'}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
            hasChanges ? 'bg-accent hover:bg-accent-hover' : 'cursor-not-allowed bg-border'
          }`}
        >
          Save
        </button>
        {hasChanges && (
          <span className="text-sm text-text-muted">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = (
    tabParam === 'appearance'
      ? 'appearance'
      : tabParam === 'rules'
      ? 'rules'
      : tabParam === 'admin'
      ? 'admin'
      : 'account'
  ) as 'account' | 'appearance' | 'rules' | 'admin';

  const { loading: authLoading, isAdmin } = useAuth();

  if (authLoading) {
    return (
      <div className="p-8">
        <p className="text-text-muted">Loading…</p>
      </div>
    );
  }

  const maxWidth = activeTab === 'appearance' || activeTab === 'rules' || activeTab === 'admin' ? 'max-w-5xl' : 'max-w-4xl';

  return (
    <div className="min-h-screen p-8">
      <div className={`mx-auto ${maxWidth}`}>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <Link
            href="/"
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="mb-6 border-b border-border">
          <nav className="-mb-px flex space-x-6">
            {SETTINGS_TABS.map((t) => (
              <Link
                key={t.id}
                href={
                  t.id === 'account'
                    ? '/settings'
                    : t.id === 'appearance'
                    ? '/settings?tab=appearance'
                    : t.id === 'rules'
                    ? '/settings?tab=rules'
                    : '/settings?tab=admin'
                }
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                  activeTab === t.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-muted hover:border-border hover:text-text-primary'
                }`}
              >
                {t.name}
              </Link>
            ))}
          </nav>
        </div>

        {activeTab === 'account' ? (
          <AccountSetupForm showAdminSection={false} />
        ) : activeTab === 'appearance' ? (
          <AppearanceContent />
        ) : activeTab === 'rules' ? (
          <BusinessRulesContent />
        ) : isAdmin ? (
          <AdminFeatureFlagsContent />
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-danger">
            Admin access required.
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPageInner() {
  return (
    <Suspense fallback={<div className="p-8"><p className="text-text-muted">Loading settings…</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  );
}

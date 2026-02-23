'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import {
  MODULE_IDS,
  HIBACHI_TEMPLATE,
  PRIVATE_CHEF_TEMPLATE,
  WEDDING_CATERING_TEMPLATE,
  BBQ_TEMPLATE,
  CORPORATE_CATERING_TEMPLATE,
} from '@/lib/templateConfig';
import type { BusinessTemplateConfig, PricingMode, EventTypeConfig } from '@/lib/templateConfig';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/AuthProvider';
import { useFeatureFlags } from '@/lib/useFeatureFlags';
import type { FeatureFlags } from '@/lib/featureFlags';
import { BusinessRulesContent } from '../business-rules/page';

const PRICING_MODES: { value: PricingMode; label: string }[] = [
  { value: 'per_guest', label: 'Per guest' },
  { value: 'per_person', label: 'Per person' },
  { value: 'flat_fee', label: 'Flat fee' },
  { value: 'package', label: 'Package' },
  { value: 'hourly', label: 'Hourly' },
];

const MODULE_LABELS: Record<string, string> = {
  event_basics: 'Event basics',
  guest_pricing: 'Guest pricing',
  menu_builder: 'Menu builder',
  staffing_payouts: 'Staffing & payouts',
  travel_fees: 'Travel fees',
  taxes_gratuity: 'Taxes & gratuity',
  profit_summary: 'Profit summary',
};

const SETTINGS_TABS = [
  { id: 'appearance', name: 'Appearance' },
  { id: 'template', name: 'Business template' },
  { id: 'rules', name: 'Business rules' },
  { id: 'admin', name: 'Admin' },
] as const;

const ADMIN_FEATURES: { key: keyof FeatureFlags; label: string; description: string }[] = [
  { key: 'home', label: 'Home', description: 'Dashboard / Home in the sidebar.' },
  { key: 'events', label: 'Events', description: 'Events (bookings) in the sidebar.' },
  { key: 'pipeline', label: 'Pipeline', description: 'Pipeline in the sidebar and standalone /pipeline page. Pipeline view on Events is always available.' },
  { key: 'inbox', label: 'Inbox', description: 'Inbox (inquiries) in the sidebar.' },
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
          Choose light or dark mode for the app. Dark mode is easier on the eyes in low light; light mode can be better for print and shared screens.
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

  const hasChanges = useMemo(
    () => ADMIN_FEATURES.some(({ key }) => key !== 'settings' && localFlags[key] !== flags[key]),
    [localFlags, flags]
  );

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
          return (
            <li key={key} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
              <div className="font-medium text-text-primary">{label}</div>
              <label className={`flex shrink-0 items-center gap-2 ${isSettings ? 'cursor-default' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={isSettings || !!localFlags[key]}
                  disabled={isSettings}
                  onChange={(e) => !isSettings && setLocalFlags((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent disabled:opacity-70"
                />
                <span className="text-sm text-text-secondary">{isSettings ? 'Always on' : 'Enabled'}</span>
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
  const activeTab = (tabParam === 'appearance' ? 'appearance' : tabParam === 'rules' ? 'rules' : tabParam === 'admin' ? 'admin' : 'template') as 'template' | 'rules' | 'admin' | 'appearance';

  const { user, loading: authLoading, isAdmin } = useAuth();
  const { config, loading: configLoading, saveTemplateConfig } = useTemplateConfig();
  const [form, setForm] = useState<BusinessTemplateConfig>({ ...config });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<'saved' | 'error' | null>(null);

  useEffect(() => {
    setForm({ ...config });
  }, [config]);

  const router = useRouter();

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const ok = await saveTemplateConfig(form);
    setSaving(false);
    setMessage(ok ? 'saved' : 'error');
    if (ok) setTimeout(() => setMessage(null), 3000);
  };

  const applyPreset = (preset: BusinessTemplateConfig) => {
    setForm({ ...preset });
  };

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
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <Link
            href="/"
            className="rounded-md border border-border bg-card-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:bg-card"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Tab nav */}
        <div className="mb-6 border-b border-border">
          <nav className="-mb-px flex space-x-6">
            {SETTINGS_TABS.map((t) => (
              <Link
                key={t.id}
                href={t.id === 'template' ? '/settings' : t.id === 'appearance' ? '/settings?tab=appearance' : t.id === 'rules' ? '/settings?tab=rules' : '/settings?tab=admin'}
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

        {/* Tab content */}
        {activeTab === 'appearance' ? (
          <AppearanceContent />
        ) : activeTab === 'rules' ? (
          <BusinessRulesContent />
        ) : activeTab === 'admin' ? (
          <AdminFeatureFlagsContent />
        ) : configLoading ? (
          <p className="py-8 text-center text-sm text-text-muted">Loading template settings…</p>
        ) : (
          <div className="space-y-6 rounded-lg border border-border bg-card-elevated p-6">
            {/* Presets */}
            <div>
              <label className="block text-sm font-medium text-text-secondary">Start from a preset</label>
              <p className="mt-0.5 text-xs text-text-muted">Applies default event types, occasions, labels, and modules for the selected business type.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { preset: HIBACHI_TEMPLATE,          label: 'Hibachi' },
                    { preset: PRIVATE_CHEF_TEMPLATE,     label: 'Private Chef' },
                    { preset: WEDDING_CATERING_TEMPLATE, label: 'Wedding / Events' },
                    { preset: BBQ_TEMPLATE,              label: 'BBQ / Food Truck' },
                    { preset: CORPORATE_CATERING_TEMPLATE, label: 'Corporate' },
                  ] as { preset: BusinessTemplateConfig; label: string }[]
                ).map(({ preset, label }) => (
                  <button
                    key={preset.businessType}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      form.businessType === preset.businessType
                        ? 'border-accent bg-accent text-white hover:bg-accent-hover'
                        : 'border-border bg-card text-text-primary hover:bg-card-elevated'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Business name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary">Business name</label>
              <p className="mt-0.5 text-xs text-text-muted">Shown in the mobile header bar.</p>
              <input
                type="text"
                value={form.businessName ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
                placeholder="My Catering Co."
                className="mt-1 w-full max-w-sm rounded-md border border-border bg-card px-3 py-2 text-text-primary"
              />
            </div>

            {/* Event types */}
            <div className="min-w-0">
              <label className="block text-sm font-medium text-text-secondary">Event types</label>
              <p className="mt-0.5 text-xs text-text-muted">
                These appear in booking forms, reports, and filters. <strong>Pricing slot</strong> maps to Primary or Secondary base price in Business Rules.
              </p>
              <div className="mt-2 min-w-0 space-y-2 overflow-x-auto">
                {form.eventTypes.map((et, i) => (
                  <div key={i} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto_auto] items-center gap-2">
                    <input
                      type="text"
                      value={et.id}
                      onChange={(e) => {
                        const next = [...form.eventTypes];
                        next[i] = { ...next[i], id: e.target.value };
                        setForm((prev) => ({ ...prev, eventTypes: next }));
                      }}
                      placeholder="id (e.g. private-dinner)"
                      className="min-w-0 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-text-primary"
                    />
                    <input
                      type="text"
                      value={et.label}
                      onChange={(e) => {
                        const next = [...form.eventTypes];
                        next[i] = { ...next[i], label: e.target.value };
                        setForm((prev) => ({ ...prev, eventTypes: next }));
                      }}
                      placeholder="Admin label"
                      className="min-w-0 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-text-primary"
                    />
                    <input
                      type="text"
                      value={et.customerLabel}
                      onChange={(e) => {
                        const next = [...form.eventTypes];
                        next[i] = { ...next[i], customerLabel: e.target.value };
                        setForm((prev) => ({ ...prev, eventTypes: next }));
                      }}
                      placeholder="Customer label"
                      className="min-w-0 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-text-primary"
                    />
                    <select
                      value={et.pricingSlot}
                      onChange={(e) => {
                        const next = [...form.eventTypes];
                        next[i] = { ...next[i], pricingSlot: e.target.value as 'primary' | 'secondary' };
                        setForm((prev) => ({ ...prev, eventTypes: next }));
                      }}
                      className="shrink-0 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-text-primary"
                    >
                      <option value="primary">Primary $</option>
                      <option value="secondary">Secondary $</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, eventTypes: prev.eventTypes.filter((_, j) => j !== i) }))}
                      className="shrink-0 rounded-md px-2 py-1.5 text-sm text-danger hover:bg-danger/10"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="pt-1 text-xs text-text-muted">
                  <span>Columns: ID · Admin label · Customer label · Pricing slot</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      eventTypes: [
                        ...prev.eventTypes,
                        { id: '', label: '', customerLabel: '', pricingSlot: 'primary' } as EventTypeConfig,
                      ],
                    }))
                  }
                  className="mt-1 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-text-muted hover:border-accent hover:text-accent"
                >
                  + Add event type
                </button>
              </div>
            </div>

            {/* Occasions */}
            <div className="min-w-0">
              <label className="block text-sm font-medium text-text-secondary">Occasions</label>
              <p className="mt-0.5 text-xs text-text-muted">Options shown on the public inquiry form.</p>
              <div className="mt-2 space-y-1.5">
                {form.occasions.map((occ, i) => (
                  <div key={i} className="flex min-w-0 items-center gap-2">
                    <input
                      type="text"
                      value={occ}
                      onChange={(e) => {
                        const next = [...form.occasions];
                        next[i] = e.target.value;
                        setForm((prev) => ({ ...prev, occasions: next }));
                      }}
                      className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, occasions: prev.occasions.filter((_, j) => j !== i) }))}
                      className="shrink-0 rounded-md px-2 py-1.5 text-sm text-danger hover:bg-danger/10"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, occasions: [...prev.occasions, ''] }))}
                  className="mt-1 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-text-muted hover:border-accent hover:text-accent"
                >
                  + Add occasion
                </button>
              </div>
            </div>

            {/* Pricing mode default */}
            <div>
              <label className="block text-sm font-medium text-text-secondary">Default pricing mode (for new bookings)</label>
              <select
                value={form.pricingModeDefault}
                onChange={(e) => setForm((prev) => ({ ...prev, pricingModeDefault: e.target.value as PricingMode }))}
                className="mt-1 w-full max-w-xs rounded-md border border-border bg-card px-3 py-2 text-text-primary"
              >
                {PRICING_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Enabled modules */}
            <div>
              <label className="block text-sm font-medium text-text-secondary">Enabled sections (UI modules)</label>
              <p className="mt-0.5 text-xs text-text-muted">Toggle which sections appear in bookings and elsewhere.</p>
              <div className="mt-2 space-y-2">
                {MODULE_IDS.map((id) => (
                  <label key={id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.enabledModules.includes(id)}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          enabledModules: e.target.checked
                            ? [...prev.enabledModules, id]
                            : prev.enabledModules.filter((m) => m !== id),
                        }));
                      }}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="text-text-primary">{MODULE_LABELS[id] ?? id}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Labels */}
            <div>
              <label className="block text-sm font-medium text-text-secondary">Labels</label>
              <p className="mt-0.5 text-xs text-text-muted">Terminology used in the app (e.g. Guests vs Covers).</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(['guests', 'premiumAddOn', 'leadChef', 'assistant'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-text-muted">{key}</label>
                    <input
                      type="text"
                      value={form.labels[key] ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          labels: { ...prev.labels, [key]: e.target.value },
                        }))
                      }
                      className="mt-0.5 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text-primary"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {message === 'saved' && <span className="text-sm text-green-600">Saved.</span>}
              {message === 'error' && <span className="text-sm text-danger">Save failed.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8"><p className="text-text-muted">Loading settings…</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}

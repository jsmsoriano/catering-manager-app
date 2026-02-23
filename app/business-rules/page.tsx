'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_RULES, loadRules } from '@/lib/moneyRules';
import { useTemplateConfig } from '@/lib/useTemplateConfig';
import type { MoneyRules, StaffingProfile, StaffingRoleEntry } from '@/lib/types';

/** Currency input: $ prefix, step 0.01, round to 2 decimals on blur */
function CurrencyInput({
  value,
  path,
  updateRules,
  min = 0,
  ...rest
}: {
  value: number;
  path: string[];
  updateRules: (path: string[], value: any) => void;
  min?: number;
  className?: string;
}) {
  return (
    <div className="mt-1 flex items-center rounded-md border border-border bg-card-elevated dark:border-border dark:bg-card-elevated">
      <span className="pl-3 text-text-secondary">$</span>
      <input
        type="number"
        min={min}
        step="0.01"
        value={value}
        onChange={(e) => updateRules(path, parseFloat(e.target.value) || 0)}
        onBlur={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) updateRules(path, Math.round(n * 100) / 100);
        }}
        className={`flex-1 border-0 bg-transparent py-2 pr-3 text-text-primary ${rest.className ?? ''}`}
      />
    </div>
  );
}

/** Percent input: % suffix after the number */
function PercentInput({
  value,
  path,
  updateRules,
  min = 0,
  max = 100,
  nullable,
  ...rest
}: {
  value: number | null;
  path: string[];
  updateRules: (path: string[], value: any) => void;
  min?: number;
  max?: number;
  nullable?: boolean;
  className?: string;
}) {
  const displayVal = value ?? 0;
  return (
    <div className="mt-1 flex items-center rounded-md border border-border bg-card-elevated dark:border-border dark:bg-card-elevated">
      <input
        type="number"
        min={min}
        max={max}
        step="0.01"
        value={displayVal}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          updateRules(path, nullable && (val === 0 || Number.isNaN(val)) ? null : (val || 0));
        }}
        className={`flex-1 border-0 bg-transparent py-2 pl-3 pr-1 text-text-primary ${rest.className ?? ''}`}
      />
      <span className="pr-3 text-text-secondary">%</span>
    </div>
  );
}

export function BusinessRulesContent() {
  const [rules, setRules] = useState<MoneyRules>(DEFAULT_RULES);
  const { config: templateConfig } = useTemplateConfig();
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StaffingProfile | null>(null);
  const [activeTab, setActiveTab] = useState('pricing');

  const tabs = [
    { id: 'pricing', name: 'Pricing' },
    { id: 'staffing', name: 'Staffing' },
    { id: 'labor', name: 'Labor' },
    { id: 'costs', name: 'Costs & Fees' },
    { id: 'profit', name: 'Profit' },
  ];

  // Load saved rules from localStorage on mount (using safe deep merge)
  useEffect(() => {
    setRules(loadRules());
  }, []);

  const handleSave = () => {
    localStorage.setItem('moneyRules', JSON.stringify(rules));
    window.dispatchEvent(new Event('moneyRulesUpdated'));
    setHasChanges(false);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    if (confirm('Reset all values to defaults? This cannot be undone.')) {
      setRules(DEFAULT_RULES);
      localStorage.removeItem('moneyRules');
      setHasChanges(false);
    }
  };

  const updateRules = (path: string[], value: any) => {
    // Sanitize NaN from parseFloat("") — treat as 0 to prevent corrupted saves
    const safeValue = typeof value === 'number' && !Number.isFinite(value) ? 0 : value;
    setRules((prev) => {
      const newRules = { ...prev };
      let current: any = newRules;

      for (let i = 0; i < path.length - 1; i++) {
        current[path[i]] = { ...current[path[i]] };
        current = current[path[i]];
      }

      current[path[path.length - 1]] = safeValue;
      return newRules;
    });
    setHasChanges(true);
  };

  const ROLE_DISPLAY_LABELS: Record<StaffingRoleEntry, string> = {
    lead: 'Lead Chef',
    full: 'Full Chef',
    buffet: 'Buffet Chef',
    assistant: 'Assistant',
  };

  const AVAILABLE_ROLES: StaffingRoleEntry[] = ['lead', 'full', 'buffet', 'assistant'];

  const emptyProfile: StaffingProfile = {
    id: '',
    name: '',
    eventType: 'private-dinner',
    minGuests: 1,
    maxGuests: 15,
    roles: ['lead', 'assistant'],
  };

  const openProfileForm = (profile?: StaffingProfile) => {
    setEditingProfile(profile ? { ...profile, roles: [...profile.roles] } : { ...emptyProfile, id: `profile-${Date.now()}`, roles: [...emptyProfile.roles] });
    setShowProfileForm(true);
  };

  const saveProfile = () => {
    if (!editingProfile || !editingProfile.name.trim()) return;
    const profiles = [...(rules.staffing.profiles || [])];
    const idx = profiles.findIndex((p) => p.id === editingProfile.id);
    if (idx >= 0) {
      profiles[idx] = editingProfile;
    } else {
      profiles.push(editingProfile);
    }
    setRules((prev) => ({
      ...prev,
      staffing: { ...prev.staffing, profiles },
    }));
    setHasChanges(true);
    setShowProfileForm(false);
    setEditingProfile(null);
  };

  const deleteProfile = (id: string) => {
    if (!confirm('Delete this staffing profile?')) return;
    const profiles = (rules.staffing.profiles || []).filter((p) => p.id !== id);
    setRules((prev) => ({
      ...prev,
      staffing: { ...prev.staffing, profiles },
    }));
    setHasChanges(true);
  };

  const updateEditingProfile = (updates: Partial<StaffingProfile>) => {
    if (!editingProfile) return;
    setEditingProfile({ ...editingProfile, ...updates });
  };

  const addRoleToProfile = (role: StaffingRoleEntry) => {
    if (!editingProfile) return;
    setEditingProfile({ ...editingProfile, roles: [...editingProfile.roles, role] });
  };

  const removeRoleFromProfile = (index: number) => {
    if (!editingProfile) return;
    const roles = editingProfile.roles.filter((_, i) => i !== index);
    setEditingProfile({ ...editingProfile, roles });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Business Rules
        </h1>
        <p className="mt-2 text-text-secondary">
          Configure all pricing, labor, and profit distribution rules for your business.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="mb-8 border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:border-border hover:text-text-primary'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-8">
        {/* PRICING TAB */}
        {activeTab === 'pricing' && (
        <>
        {/* PRICING SECTION */}
        <section className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Pricing
          </h2>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="w-56 shrink-0 text-sm font-medium text-text-secondary">
                {templateConfig.eventTypes[0]?.label ?? 'Primary Event'} Base Price ($/person)
              </label>
              <div className="w-28">
                <CurrencyInput
                  value={rules.pricing.primaryBasePrice}
                  path={['pricing', 'primaryBasePrice']}
                  updateRules={updateRules}
                />
              </div>
            </div>
            {templateConfig.eventTypes[1] && (
            <div className="flex flex-wrap items-center gap-4">
              <label className="w-56 shrink-0 text-sm font-medium text-text-secondary">
                {templateConfig.eventTypes[1].label} Base Price ($/person)
              </label>
              <div className="w-28">
                <CurrencyInput
                  value={rules.pricing.secondaryBasePrice}
                  path={['pricing', 'secondaryBasePrice']}
                  updateRules={updateRules}
                />
              </div>
            </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <label className="w-56 shrink-0 text-sm font-medium text-text-secondary">
                Premium Add-on Min ($/person)
              </label>
              <div className="w-28">
                <CurrencyInput
                  value={rules.pricing.premiumAddOnMin}
                  path={['pricing', 'premiumAddOnMin']}
                  updateRules={updateRules}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="w-56 shrink-0 text-sm font-medium text-text-secondary">
                Premium Add-on Max ($/person)
              </label>
              <div className="w-28">
                <CurrencyInput
                  value={rules.pricing.premiumAddOnMax}
                  path={['pricing', 'premiumAddOnMax']}
                  updateRules={updateRules}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="w-56 shrink-0 text-sm font-medium text-text-secondary">
                Default Gratuity (%)
              </label>
              <div className="w-28">
                <PercentInput
                  value={rules.pricing.defaultGratuityPercent}
                  path={['pricing', 'defaultGratuityPercent']}
                  updateRules={updateRules}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="w-56 shrink-0 text-sm font-medium text-text-secondary">
                Child Discount (%)
              </label>
              <div className="w-28">
                <PercentInput
                  value={rules.pricing.childDiscountPercent}
                  path={['pricing', 'childDiscountPercent']}
                  updateRules={updateRules}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="w-56 shrink-0 text-sm font-medium text-text-secondary">
                Required Deposit (%)
              </label>
              <div className="w-28">
                <PercentInput
                  value={rules.pricing.defaultDepositPercent}
                  path={['pricing', 'defaultDepositPercent']}
                  updateRules={updateRules}
                />
              </div>
            </div>
          </div>
        </section>

        </>
        )}

        {/* STAFFING TAB */}
        {activeTab === 'staffing' && (
        <>
        {/* STAFFING SECTION */}
        <section className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Staffing Rules
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Max Guests per Chef ({templateConfig.eventTypes[0]?.label ?? 'Primary'})
              </label>
              <input
                type="number"
                min="1"
                value={rules.staffing.maxGuestsPerChefPrimary}
                onChange={(e) =>
                  updateRules(['staffing', 'maxGuestsPerChefPrimary'], parseInt(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            {templateConfig.eventTypes[1] && (
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Max Guests per Chef ({templateConfig.eventTypes[1].label})
              </label>
              <input
                type="number"
                min="1"
                value={rules.staffing.maxGuestsPerChefSecondary}
                onChange={(e) =>
                  updateRules(['staffing', 'maxGuestsPerChefSecondary'], parseInt(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            )}
            <div className="sm:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rules.staffing.assistantRequired}
                  onChange={(e) =>
                    updateRules(['staffing', 'assistantRequired'], e.target.checked)
                  }
                  className="mr-2"
                />
                <span className="text-sm font-medium text-text-secondary">
                  Assistant Required (Private Events)
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* STAFFING PROFILES SECTION */}
        <section className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                Staffing Profiles
              </h2>
              <p className="mt-1 text-sm text-text-muted ">
                Define named staffing compositions for event type and guest ranges. Profiles override the default staffing rules above.
              </p>
            </div>
            {!showProfileForm && (
              <button
                onClick={() => openProfileForm()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add Profile
              </button>
            )}
          </div>

          {/* Profile Form (inline) */}
          {showProfileForm && editingProfile && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950/30">
              <h3 className="mb-4 text-lg font-medium text-text-primary">
                {editingProfile.id.startsWith('profile-') && !(rules.staffing.profiles || []).find(p => p.id === editingProfile.id) ? 'New Profile' : 'Edit Profile'}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    value={editingProfile.name}
                    onChange={(e) => updateEditingProfile({ name: e.target.value })}
                    placeholder="e.g., Small Private Dinner"
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    Event Type
                  </label>
                  <select
                    value={editingProfile.eventType}
                    onChange={(e) => updateEditingProfile({ eventType: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
                  >
                    {templateConfig.eventTypes.map(et => (
                      <option key={et.id} value={et.id}>{et.label}</option>
                    ))}
                    <option value="any">Any</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-text-secondary">
                      Min Guests
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingProfile.minGuests}
                      onChange={(e) => updateEditingProfile({ minGuests: parseInt(e.target.value) || 1 })}
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-text-secondary">
                      Max Guests
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingProfile.maxGuests === 9999 ? '' : editingProfile.maxGuests}
                      placeholder={editingProfile.maxGuests === 9999 ? 'No limit' : ''}
                      onChange={(e) => updateEditingProfile({ maxGuests: parseInt(e.target.value) || 1 })}
                      disabled={editingProfile.maxGuests === 9999}
                      className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary disabled:opacity-50 dark:border-border bg-card-elevated text-text-primary"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingProfile.maxGuests === 9999}
                      onChange={(e) => updateEditingProfile({ maxGuests: e.target.checked ? 9999 : 30 })}
                      className="mr-2"
                    />
                    <span className="text-sm text-text-secondary">No upper guest limit</span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Staff Roles
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editingProfile.roles.map((role, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full bg-card-elevated px-3 py-1 text-sm font-medium text-text-primary"
                      >
                        {ROLE_DISPLAY_LABELS[role]}
                        <button
                          onClick={() => removeRoleFromProfile(idx)}
                          className="ml-1 text-text-muted hover:text-red-600  dark:hover:text-red-400"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addRoleToProfile(e.target.value as StaffingRoleEntry);
                    }}
                    className="mt-2 rounded-md border border-border px-3 py-2 text-sm text-text-primary dark:border-border bg-card-elevated text-text-primary"
                  >
                    <option value="">+ Add role...</option>
                    {AVAILABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_DISPLAY_LABELS[r]}</option>
                    ))}
                  </select>
                  {editingProfile.roles.length === 0 && (
                    <p className="mt-1 text-xs text-red-500">At least one role is required</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={saveProfile}
                  disabled={!editingProfile.name.trim() || editingProfile.roles.length === 0}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {(rules.staffing.profiles || []).find(p => p.id === editingProfile.id) ? 'Update Profile' : 'Create Profile'}
                </button>
                <button
                  onClick={() => { setShowProfileForm(false); setEditingProfile(null); }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Profile List */}
          {(rules.staffing.profiles || []).length === 0 && !showProfileForm ? (
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center dark:border-border">
              <p className="text-sm text-text-muted ">
                No staffing profiles defined — using default staffing rules based on guest count.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(rules.staffing.profiles || []).map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card-elevated p-4"
                >
                  <div>
                    <h4 className="font-medium text-text-primary text-text-primary">{profile.name}</h4>
                    <p className="mt-0.5 text-sm text-text-muted ">
                      {profile.eventType === 'any' ? 'Any Event' : (templateConfig.eventTypes.find(et => et.id === profile.eventType)?.label ?? profile.eventType)}
                      {' · '}
                      {profile.minGuests}–{profile.maxGuests === 9999 ? '\u221E' : profile.maxGuests} guests
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.roles.map((role, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        >
                          {ROLE_DISPLAY_LABELS[role]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openProfileForm(profile)}
                      className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-card"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteProfile(profile.id)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        </>
        )}

        {/* LABOR TAB */}
        {activeTab === 'labor' && (
        <>
        {/* PRIVATE LABOR SECTION */}
        <section className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Private Event Labor
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Lead Chef Base (%)
              </label>
              <PercentInput
                value={rules.privateLabor.leadChefBasePercent}
                path={['privateLabor', 'leadChefBasePercent']}
                updateRules={updateRules}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Lead Chef Cap (% of revenue+gratuity)
              </label>
              <p className="mt-0.5 text-xs text-text-muted">Leave 0 for no cap.</p>
              <PercentInput
                value={rules.privateLabor.leadChefCapPercent}
                path={['privateLabor', 'leadChefCapPercent']}
                updateRules={updateRules}
                nullable
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Full Chef Base (%)
              </label>
              <PercentInput
                value={rules.privateLabor.fullChefBasePercent}
                path={['privateLabor', 'fullChefBasePercent']}
                updateRules={updateRules}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Full Chef Cap (% of revenue+gratuity)
              </label>
              <p className="mt-0.5 text-xs text-text-muted">Leave 0 for no cap.</p>
              <PercentInput
                value={rules.privateLabor.fullChefCapPercent}
                path={['privateLabor', 'fullChefCapPercent']}
                updateRules={updateRules}
                nullable
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Assistant Base (%)
              </label>
              <PercentInput
                value={rules.privateLabor.assistantBasePercent}
                path={['privateLabor', 'assistantBasePercent']}
                updateRules={updateRules}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Assistant Cap (% of revenue+gratuity)
              </label>
              <p className="mt-0.5 text-xs text-text-muted">Leave 0 for no cap.</p>
              <PercentInput
                value={rules.privateLabor.assistantCapPercent}
                path={['privateLabor', 'assistantCapPercent']}
                updateRules={updateRules}
                nullable
              />
            </div>
          </div>

          {/* Gratuity Split */}
          <div className="mt-6 border-t border-border pt-6 dark:border-border">
            <h3 className="mb-4 text-lg font-medium text-text-primary">
              Gratuity Split (Private Events)
            </h3>
            <p className="mb-4 text-sm text-text-muted ">
              How gratuity is divided between chefs and assistant. Must total 100%.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Chef(s) Gratuity Split (%)
                </label>
                <PercentInput
                  value={rules.privateLabor.chefGratuitySplitPercent}
                  path={['privateLabor', 'chefGratuitySplitPercent']}
                  updateRules={updateRules}
                />
                <p className="mt-1 text-xs text-text-muted ">
                  Split equally among all chefs on the event
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Assistant Gratuity Split (%)
                </label>
                <PercentInput
                  value={rules.privateLabor.assistantGratuitySplitPercent}
                  path={['privateLabor', 'assistantGratuitySplitPercent']}
                  updateRules={updateRules}
                />
              </div>
            </div>
            {Math.abs(
              (rules.privateLabor.chefGratuitySplitPercent || 0) +
              (rules.privateLabor.assistantGratuitySplitPercent || 0) - 100
            ) > 0.1 && (
              <p className="mt-3 text-sm font-medium text-orange-600 dark:text-orange-400">
                Total is {((rules.privateLabor.chefGratuitySplitPercent || 0) + (rules.privateLabor.assistantGratuitySplitPercent || 0)).toFixed(1)}% — should be 100%
              </p>
            )}
          </div>
        </section>

        {/* BUFFET LABOR SECTION */}
        <section className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Buffet Event Labor
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Chef Base (%)
              </label>
              <PercentInput
                value={rules.buffetLabor.chefBasePercent}
                path={['buffetLabor', 'chefBasePercent']}
                updateRules={updateRules}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Chef Cap (% of revenue+gratuity)
              </label>
              <p className="mt-0.5 text-xs text-text-muted">Leave 0 for no cap.</p>
              <PercentInput
                value={rules.buffetLabor.chefCapPercent}
                path={['buffetLabor', 'chefCapPercent']}
                updateRules={updateRules}
                nullable
              />
            </div>
          </div>
        </section>

        </>
        )}

        {/* COSTS & FEES TAB */}
        {activeTab === 'costs' && (
        <>
        {/* COST STRUCTURE SECTION */}
        <section className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Cost Structure
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Food Cost — {templateConfig.eventTypes[0]?.label ?? 'Primary'} (%)
              </label>
              <PercentInput
                value={rules.costs.primaryFoodCostPercent}
                path={['costs', 'primaryFoodCostPercent']}
                updateRules={updateRules}
              />
            </div>
            {templateConfig.eventTypes[1] && (
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Food Cost — {templateConfig.eventTypes[1].label} (%)
              </label>
              <PercentInput
                value={rules.costs.secondaryFoodCostPercent}
                path={['costs', 'secondaryFoodCostPercent']}
                updateRules={updateRules}
              />
            </div>
            )}
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Supplies Cost (%)
              </label>
              <PercentInput
                value={rules.costs.suppliesCostPercent}
                path={['costs', 'suppliesCostPercent']}
                updateRules={updateRules}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Transportation Stipend ($)
              </label>
              <CurrencyInput
                value={rules.costs.transportationStipend}
                path={['costs', 'transportationStipend']}
                updateRules={updateRules}
              />
            </div>
          </div>
        </section>

        {/* DISTANCE FEES SECTION */}
        <section className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Distance Fees
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Free Distance (miles)
              </label>
              <input
                type="number"
                min="0"
                value={rules.distance.freeDistanceMiles}
                onChange={(e) =>
                  updateRules(['distance', 'freeDistanceMiles'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Base Distance Fee ($)
              </label>
              <CurrencyInput
                value={rules.distance.baseDistanceFee}
                path={['distance', 'baseDistanceFee']}
                updateRules={updateRules}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Additional Fee per Increment ($)
              </label>
              <CurrencyInput
                value={rules.distance.additionalFeePerIncrement}
                path={['distance', 'additionalFeePerIncrement']}
                updateRules={updateRules}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Increment Miles
              </label>
              <input
                type="number"
                min="1"
                value={rules.distance.incrementMiles}
                onChange={(e) =>
                  updateRules(['distance', 'incrementMiles'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
          </div>
        </section>

        </>
        )}

        {/* PROFIT TAB */}
        {activeTab === 'profit' && (
        <>
        {/* PROFIT DISTRIBUTION SECTION */}
        <section className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-2 text-xl font-semibold text-text-primary">
            Profit Distribution
          </h2>
          <p className="mb-6 text-sm text-text-muted">
            Paid at the 10th of each month. After expenses are paid, the leftover profit is distributed amongst owners based on their equity %.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Business Retained (%)
              </label>
              <PercentInput
                value={rules.profitDistribution.businessRetainedPercent}
                path={['profitDistribution', 'businessRetainedPercent']}
                updateRules={updateRules}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Owner Distribution (%)
              </label>
              <PercentInput
                value={rules.profitDistribution.ownerDistributionPercent}
                path={['profitDistribution', 'ownerDistributionPercent']}
                updateRules={updateRules}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-text-secondary">
                Owners (equity % must total 100)
              </label>
              <div className="mt-2 space-y-3">
                {(rules.profitDistribution.owners ?? []).map((owner, idx) => (
                  <div key={owner.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card-elevated p-3">
                    <input
                      type="text"
                      placeholder="Owner name"
                      value={owner.name}
                      onChange={(e) => {
                        const next = [...(rules.profitDistribution.owners ?? [])];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setRules((prev) => ({
                          ...prev,
                          profitDistribution: { ...prev.profitDistribution, owners: next },
                        }));
                        setHasChanges(true);
                      }}
                      className="min-w-[120px] rounded-md border border-border bg-card px-3 py-2 text-sm text-text-primary"
                    />
                    <div className="flex w-24 items-center rounded-md border border-border bg-card">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={owner.equityPercent}
                        onChange={(e) => {
                          const next = [...(rules.profitDistribution.owners ?? [])];
                          next[idx] = { ...next[idx], equityPercent: parseFloat(e.target.value) || 0 };
                          setRules((prev) => ({
                            ...prev,
                            profitDistribution: { ...prev.profitDistribution, owners: next },
                          }));
                          setHasChanges(true);
                        }}
                        className="w-full border-0 bg-transparent py-2 pl-2 pr-0 text-sm text-text-primary"
                      />
                      <span className="pr-2 text-sm text-text-secondary">%</span>
                    </div>
                    <span className="text-sm text-text-muted">equity</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (rules.profitDistribution.owners ?? []).filter((_, i) => i !== idx);
                        setRules((prev) => ({
                          ...prev,
                          profitDistribution: { ...prev.profitDistribution, owners: next },
                        }));
                        setHasChanges(true);
                      }}
                      className="rounded-md px-2 py-1 text-sm text-danger hover:bg-danger/10"
                      title="Remove owner"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const owners = rules.profitDistribution.owners ?? [];
                    const next = [...owners, { id: `owner-${Date.now()}`, name: '', equityPercent: 0 }];
                    setRules((prev) => ({
                      ...prev,
                      profitDistribution: { ...prev.profitDistribution, owners: next },
                    }));
                    setHasChanges(true);
                  }}
                  className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-text-muted hover:border-accent hover:text-accent"
                >
                  + Add owner
                </button>
                {((rules.profitDistribution.owners ?? []).reduce((s, o) => s + (o.equityPercent || 0), 0) !== 100) &&
                  (rules.profitDistribution.owners ?? []).length > 0 && (
                  <p className="text-sm text-warning">
                    Equity % total is {((rules.profitDistribution.owners ?? []).reduce((s, o) => s + (o.equityPercent || 0), 0)).toFixed(1)}% — should be 100%.
                  </p>
                )}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-text-secondary">
                Distribution Frequency
              </label>
              <select
                value={rules.profitDistribution.distributionFrequency}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'distributionFrequency'], e.target.value)
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
        </section>

        {/* SAFETY LIMITS SECTION */}
        <section className="rounded-lg border border-border bg-card p-6 dark:border-border ">
          <h2 className="mb-2 text-xl font-semibold text-text-primary">
            Safety Limits (Warnings Only)
          </h2>
          <p className="mb-6 text-sm text-text-muted">
            These thresholds are based on industry recommendations. The app will warn you when labor or food cost exceeds these limits as a share of revenue.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Max Total Labor (%)
              </label>
              <PercentInput
                value={rules.safetyLimits.maxTotalLaborPercent}
                path={['safetyLimits', 'maxTotalLaborPercent']}
                updateRules={updateRules}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Max Food Cost (%)
              </label>
              <PercentInput
                value={rules.safetyLimits.maxFoodCostPercent}
                path={['safetyLimits', 'maxFoodCostPercent']}
                updateRules={updateRules}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rules.safetyLimits.warnWhenExceeded}
                  onChange={(e) =>
                    updateRules(['safetyLimits', 'warnWhenExceeded'], e.target.checked)
                  }
                  className="mr-2"
                />
                <span className="text-sm font-medium text-text-secondary">
                  Show Warnings When Exceeded
                </span>
              </label>
            </div>
          </div>
        </section>
        </>
        )}
      </div>

      {/* Bottom Save Button */}
      <div className="mt-8 flex justify-end gap-4">
        <button
          onClick={handleReset}
          className="rounded-md border border-border px-6 py-3 text-sm font-medium text-text-secondary hover:bg-card"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`rounded-md px-6 py-3 text-sm font-medium text-white ${
            hasChanges
              ? 'bg-accent hover:bg-accent-hover'
              : 'cursor-not-allowed bg-border'
          }`}
        >
          Save All Changes
        </button>
      </div>
    </div>
  );
}

function BusinessRulesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings?tab=rules');
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <p className="text-text-muted">Redirecting to Settings…</p>
    </div>
  );
}

export default BusinessRulesRedirectPage;

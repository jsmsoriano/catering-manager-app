'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_RULES, loadRules } from '@/lib/moneyRules';
import type { MoneyRules, StaffingProfile, StaffingRoleEntry, EventType } from '@/lib/types';

export default function MoneyRulesPage() {
  const [rules, setRules] = useState<MoneyRules>(DEFAULT_RULES);
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
    overflow: 'Overflow Chef',
    full: 'Full Chef',
    buffet: 'Buffet Chef',
    assistant: 'Assistant',
  };

  const AVAILABLE_ROLES: StaffingRoleEntry[] = ['lead', 'overflow', 'full', 'buffet', 'assistant'];

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
        <h1 className="text-3xl font-bold text-text-primary">
          Business Rules
        </h1>
        <p className="mt-2 text-text-secondary">
          Configure all pricing, labor, and profit distribution rules for your business.
        </p>
      </div>

      {/* Save/Reset Actions */}
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
            hasChanges
              ? 'bg-accent hover:bg-accent-hover'
              : 'cursor-not-allowed bg-border'
          }`}
        >
          Save Changes
        </button>
        <button
          onClick={handleReset}
          className="rounded-md border border-border bg-card-elevated px-4 py-2 text-sm font-medium text-text-secondary hover:bg-card"
        >
          Reset to Defaults
        </button>
        {showSaveSuccess && (
          <span className="text-sm font-medium text-success">
            ✓ Saved successfully
          </span>
        )}
        {hasChanges && (
          <span className="text-sm text-warning">● Unsaved changes</span>
        )}
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
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Private Dinner Base Price ($/person)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rules.pricing.privateDinnerBasePrice}
                onChange={(e) =>
                  updateRules(['pricing', 'privateDinnerBasePrice'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Buffet Base Price ($/person)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rules.pricing.buffetBasePrice}
                onChange={(e) =>
                  updateRules(['pricing', 'buffetBasePrice'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Premium Add-on Min ($/person)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rules.pricing.premiumAddOnMin}
                onChange={(e) =>
                  updateRules(['pricing', 'premiumAddOnMin'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Premium Add-on Max ($/person)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rules.pricing.premiumAddOnMax}
                onChange={(e) =>
                  updateRules(['pricing', 'premiumAddOnMax'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Default Gratuity (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.pricing.defaultGratuityPercent}
                onChange={(e) =>
                  updateRules(['pricing', 'defaultGratuityPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Child Discount (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.pricing.childDiscountPercent}
                onChange={(e) =>
                  updateRules(['pricing', 'childDiscountPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
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
                Max Guests per Chef (Private)
              </label>
              <input
                type="number"
                min="1"
                value={rules.staffing.maxGuestsPerChefPrivate}
                onChange={(e) =>
                  updateRules(['staffing', 'maxGuestsPerChefPrivate'], parseInt(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Max Guests per Chef (Buffet)
              </label>
              <input
                type="number"
                min="1"
                value={rules.staffing.maxGuestsPerChefBuffet}
                onChange={(e) =>
                  updateRules(['staffing', 'maxGuestsPerChefBuffet'], parseInt(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
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
                    onChange={(e) => updateEditingProfile({ eventType: e.target.value as EventType | 'any' })}
                    className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
                  >
                    <option value="private-dinner">Private Dinner</option>
                    <option value="buffet">Buffet</option>
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
                      {profile.eventType === 'private-dinner' ? 'Private Dinner' : profile.eventType === 'buffet' ? 'Buffet' : 'Any Event'}
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
              <input
                type="number"
                min="0"
                max="100"
                value={rules.privateLabor.leadChefBasePercent}
                onChange={(e) =>
                  updateRules(['privateLabor', 'leadChefBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Lead Chef Cap ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.privateLabor.leadChefCap}
                onChange={(e) =>
                  updateRules(['privateLabor', 'leadChefCap'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Overflow Chef Base (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.privateLabor.overflowChefBasePercent}
                onChange={(e) =>
                  updateRules(['privateLabor', 'overflowChefBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Overflow Chef Cap ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.privateLabor.overflowChefCap}
                onChange={(e) =>
                  updateRules(['privateLabor', 'overflowChefCap'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Full Chef Base (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.privateLabor.fullChefBasePercent}
                onChange={(e) =>
                  updateRules(['privateLabor', 'fullChefBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Full Chef Cap ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.privateLabor.fullChefCap}
                onChange={(e) =>
                  updateRules(['privateLabor', 'fullChefCap'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Assistant Base (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.privateLabor.assistantBasePercent}
                onChange={(e) =>
                  updateRules(['privateLabor', 'assistantBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Assistant Cap ($ or leave 0 for no cap)
              </label>
              <input
                type="number"
                min="0"
                value={rules.privateLabor.assistantCap || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateRules(['privateLabor', 'assistantCap'], val === 0 ? null : val);
                }}
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
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
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rules.privateLabor.chefGratuitySplitPercent}
                  onChange={(e) =>
                    updateRules(['privateLabor', 'chefGratuitySplitPercent'], parseFloat(e.target.value))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
                />
                <p className="mt-1 text-xs text-text-muted ">
                  Split equally among all chefs on the event
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Assistant Gratuity Split (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rules.privateLabor.assistantGratuitySplitPercent}
                  onChange={(e) =>
                    updateRules(['privateLabor', 'assistantGratuitySplitPercent'], parseFloat(e.target.value))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
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
              <input
                type="number"
                min="0"
                max="100"
                value={rules.buffetLabor.chefBasePercent}
                onChange={(e) =>
                  updateRules(['buffetLabor', 'chefBasePercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Chef Cap ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.buffetLabor.chefCap}
                onChange={(e) =>
                  updateRules(['buffetLabor', 'chefCap'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
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
                Food Cost - Private (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.costs.foodCostPercentPrivate}
                onChange={(e) =>
                  updateRules(['costs', 'foodCostPercentPrivate'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Food Cost - Buffet (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.costs.foodCostPercentBuffet}
                onChange={(e) =>
                  updateRules(['costs', 'foodCostPercentBuffet'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Supplies Cost (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.costs.suppliesCostPercent}
                onChange={(e) =>
                  updateRules(['costs', 'suppliesCostPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Transportation Stipend ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.costs.transportationStipend}
                onChange={(e) =>
                  updateRules(['costs', 'transportationStipend'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
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
              <input
                type="number"
                min="0"
                value={rules.distance.baseDistanceFee}
                onChange={(e) =>
                  updateRules(['distance', 'baseDistanceFee'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Additional Fee per Increment ($)
              </label>
              <input
                type="number"
                min="0"
                value={rules.distance.additionalFeePerIncrement}
                onChange={(e) =>
                  updateRules(['distance', 'additionalFeePerIncrement'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
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
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Profit Distribution
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Business Retained (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.profitDistribution.businessRetainedPercent}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'businessRetainedPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Owner Distribution (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.profitDistribution.ownerDistributionPercent}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'ownerDistributionPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Owner A Equity (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.profitDistribution.ownerAEquityPercent}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'ownerAEquityPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Owner B Equity (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.profitDistribution.ownerBEquityPercent}
                onChange={(e) =>
                  updateRules(['profitDistribution', 'ownerBEquityPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
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
          <h2 className="mb-6 text-xl font-semibold text-text-primary">
            Safety Limits (Warnings Only)
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Max Total Labor (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.safetyLimits.maxTotalLaborPercent}
                onChange={(e) =>
                  updateRules(['safetyLimits', 'maxTotalLaborPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">
                Max Food Cost (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.safetyLimits.maxFoodCostPercent}
                onChange={(e) =>
                  updateRules(['safetyLimits', 'maxFoodCostPercent'], parseFloat(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-text-primary dark:border-border bg-card-elevated text-text-primary"
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

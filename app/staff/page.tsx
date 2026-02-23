'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDaysIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { formatPhone, isValidPhone } from '@/lib/phoneUtils';
import type {
  StaffMember,
  StaffRole,
  StaffStatus,
  DayOfWeek,
  WeeklyAvailabilityHours,
} from '@/lib/staffTypes';
import {
  ROLE_LABELS,
  getRoleDisplayLabel,
  STATUS_LABELS,
  DAY_LABELS,
  DEFAULT_WEEKLY_AVAILABILITY,
  DEFAULT_WEEKLY_AVAILABILITY_HOURS,
} from '@/lib/staffTypes';

// ─── Color maps ───────────────────────────────────────────────────────────────

const roleColors: Record<StaffRole, string> = {
  'lead-chef': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300',
  'full-chef': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
  'buffet-chef': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
  'assistant': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  'contractor': 'bg-card-elevated text-text-primary',
};

const statusColors: Record<StaffStatus, string> = {
  'active': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'inactive': 'bg-card-elevated text-text-secondary',
  'on-leave': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const MAX_PROFILE_PHOTO_BYTES = 1024 * 1024 * 2;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function loadInitialStaff(): StaffMember[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('staff');
    if (!saved) return [];
    const parsed = JSON.parse(saved) as StaffMember[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function withDefaultAvailabilityHours(value: WeeklyAvailabilityHours | undefined): WeeklyAvailabilityHours {
  const base = { ...DEFAULT_WEEKLY_AVAILABILITY_HOURS };
  if (!value) return base;
  return {
    monday: value.monday ?? base.monday,
    tuesday: value.tuesday ?? base.tuesday,
    wednesday: value.wednesday ?? base.wednesday,
    thursday: value.thursday ?? base.thursday,
    friday: value.friday ?? base.friday,
    saturday: value.saturday ?? base.saturday,
    sunday: value.sunday ?? base.sunday,
  };
}

// ─── Edit form type ───────────────────────────────────────────────────────────

interface EditForm {
  name: string;
  email: string;
  phone: string;
  profilePhoto: string;
  profileSummary: string;
  primaryRole: StaffRole;
  secondaryRoles: StaffRole[];
  status: StaffStatus;
  isOwner: boolean;
  ownerRole: 'owner-a' | 'owner-b' | undefined;
  weeklyAvailability: Record<DayOfWeek, boolean>;
  hourlyRate: string;
  notes: string;
  hireDate: string;
}

function defaultEditForm(): EditForm {
  return {
    name: '',
    email: '',
    phone: '',
    profilePhoto: '',
    profileSummary: '',
    primaryRole: 'lead-chef',
    secondaryRoles: [],
    status: 'active',
    isOwner: false,
    ownerRole: undefined,
    weeklyAvailability: { ...DEFAULT_WEEKLY_AVAILABILITY },
    hourlyRate: '',
    notes: '',
    hireDate: new Date().toISOString().split('T')[0],
  };
}

function staffToEditForm(member: StaffMember): EditForm {
  // Map legacy overflow-chef to full-chef
  const primaryRole: StaffRole = member.primaryRole === 'overflow-chef' ? 'full-chef' : member.primaryRole;
  const secondaryRoles: StaffRole[] = member.secondaryRoles.map((r) => (r === 'overflow-chef' ? 'full-chef' : r));
  return {
    name: member.name,
    email: member.email,
    phone: member.phone,
    profilePhoto: member.profilePhoto || '',
    profileSummary: member.profileSummary || '',
    primaryRole,
    secondaryRoles,
    status: member.status,
    isOwner: member.isOwner,
    ownerRole: member.ownerRole,
    weeklyAvailability: { ...member.weeklyAvailability },
    hourlyRate: member.hourlyRate?.toString() ?? '',
    notes: member.notes ?? '',
    hireDate: member.hireDate,
  };
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>(loadInitialStaff);
  const [showSetup, setShowSetup] = useState(() => loadInitialStaff().length === 0);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(defaultEditForm());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | StaffStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    primaryRole: 'lead-chef' as StaffRole,
  });
  const [addError, setAddError] = useState<string | null>(null);

  // Listen for external staff updates (e.g., Supabase sync)
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem('staff');
        if (saved) setStaff(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener('staffUpdated', handleUpdate);
    return () => window.removeEventListener('staffUpdated', handleUpdate);
  }, []);

  const selectedStaff = useMemo(
    () => staff.find((s) => s.id === selectedStaffId) ?? null,
    [staff, selectedStaffId]
  );

  // Sync edit form when selected staff changes
  useEffect(() => {
    if (selectedStaff) {
      setEditForm(staffToEditForm(selectedStaff));
      setSaveSuccess(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaffId]);

  const saveStaff = useCallback((newStaff: StaffMember[]) => {
    setStaff(newStaff);
    localStorage.setItem('staff', JSON.stringify(newStaff));
    window.dispatchEvent(new Event('staffUpdated'));
  }, []);

  const filteredStaff = useMemo(() => {
    let result = staff;
    if (filterStatus !== 'all') result = result.filter((s) => s.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q)
      );
    }
    return result;
  }, [staff, filterStatus, searchQuery]);

  const stats = useMemo(
    () => ({
      totalActive: staff.filter((s) => s.status === 'active').length,
      owners: staff.filter((s) => s.isOwner).length,
      onLeaveOrInactive: staff.filter((s) => s.status === 'on-leave' || s.status === 'inactive').length,
    }),
    [staff]
  );

  // ── Save right panel ──────────────────────────────────────────────────────

  const handleSave = () => {
    if (!selectedStaff) return;

    const errors: string[] = [];
    if (!editForm.name.trim()) errors.push('Name is required');
    if (!editForm.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errors.push('Valid email is required');
    if (!editForm.phone.trim()) errors.push('Phone is required');
    if (editForm.isOwner && !editForm.ownerRole) errors.push('Owner role must be specified');
    if (editForm.isOwner && editForm.ownerRole) {
      const dup = staff.find((s) => s.ownerRole === editForm.ownerRole && s.id !== selectedStaff.id);
      if (dup) errors.push(`${editForm.ownerRole} is already assigned to ${dup.name}`);
    }
    if (errors.length) {
      alert(errors.join('\n'));
      return;
    }

    const updated: StaffMember = {
      ...selectedStaff,
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      profilePhoto: editForm.profilePhoto || undefined,
      profileSummary: editForm.profileSummary.trim() || undefined,
      primaryRole: editForm.primaryRole,
      secondaryRoles: editForm.secondaryRoles,
      status: editForm.status,
      isOwner: editForm.isOwner,
      ownerRole: editForm.isOwner ? editForm.ownerRole : undefined,
      weeklyAvailability: editForm.weeklyAvailability,
      weeklyAvailabilityHours: withDefaultAvailabilityHours(selectedStaff.weeklyAvailabilityHours),
      hourlyRate: editForm.hourlyRate ? parseFloat(editForm.hourlyRate) : undefined,
      notes: editForm.notes.trim(),
      hireDate: editForm.hireDate,
      updatedAt: new Date().toISOString(),
    };

    saveStaff(staff.map((s) => (s.id === selectedStaff.id ? updated : s)));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDelete = () => {
    if (!selectedStaff) return;
    if (!confirm(`Delete ${selectedStaff.name}? This cannot be undone.`)) return;
    saveStaff(staff.filter((s) => s.id !== selectedStaff.id));
    setSelectedStaffId(null);
  };

  // ── Add modal ────────────────────────────────────────────────────────────

  const handleAddStaff = () => {
    const errors: string[] = [];
    if (!addForm.name.trim()) errors.push('Name is required');
    if (!addForm.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errors.push('Valid email is required');
    if (!addForm.phone.trim()) errors.push('Phone is required');
    else if (!isValidPhone(addForm.phone)) errors.push('Phone must be in (xxx)-xxx-xxxx format');
    if (errors.length) {
      setAddError(errors.join('\n'));
      return;
    }

    const id = crypto.randomUUID();
    const newMember: StaffMember = {
      id,
      name: addForm.name.trim(),
      email: addForm.email.trim(),
      phone: addForm.phone.trim(),
      primaryRole: addForm.primaryRole,
      secondaryRoles: [],
      status: 'active',
      isOwner: false,
      weeklyAvailability: { ...DEFAULT_WEEKLY_AVAILABILITY },
      weeklyAvailabilityHours: { ...DEFAULT_WEEKLY_AVAILABILITY_HOURS },
      unavailableDates: [],
      hireDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveStaff([...staff, newMember]);
    setShowAddModal(false);
    setAddForm({ name: '', email: '', phone: '', primaryRole: 'lead-chef' });
    setAddError(null);
    setSelectedStaffId(id);
  };

  // ── Setup (owner profiles) ───────────────────────────────────────────────

  const handleCreateOwners = () => {
    const ownerA: StaffMember = {
      id: crypto.randomUUID(),
      name: 'Owner A',
      email: 'ownera@example.com',
      phone: '555-0001',
      primaryRole: 'lead-chef',
      secondaryRoles: ['full-chef'],
      status: 'active',
      isOwner: true,
      ownerRole: 'owner-a',
      weeklyAvailability: { ...DEFAULT_WEEKLY_AVAILABILITY },
      weeklyAvailabilityHours: { ...DEFAULT_WEEKLY_AVAILABILITY_HOURS },
      unavailableDates: [],
      hireDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ownerB: StaffMember = {
      id: crypto.randomUUID(),
      name: 'Owner B',
      email: 'ownerb@example.com',
      phone: '555-0002',
      primaryRole: 'assistant',
      secondaryRoles: ['buffet-chef'],
      status: 'active',
      isOwner: true,
      ownerRole: 'owner-b',
      weeklyAvailability: { ...DEFAULT_WEEKLY_AVAILABILITY },
      weeklyAvailabilityHours: { ...DEFAULT_WEEKLY_AVAILABILITY_HOURS },
      unavailableDates: [],
      hireDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveStaff([ownerA, ownerB]);
    setShowSetup(false);
  };

  // ── Profile photo ────────────────────────────────────────────────────────

  const handleProfilePhotoUpload = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      alert('Profile photo must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setEditForm((prev) => ({ ...prev, profilePhoto: result }));
    };
    reader.readAsDataURL(file);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Setup modal */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="mb-3 text-xl font-bold text-text-primary">Welcome to Staff Management</h2>
            <p className="mb-5 text-sm text-text-secondary">
              Get started by creating placeholder owner profiles. You can edit their details after.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCreateOwners}
                className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                Create Owner Profiles
              </button>
              <button
                onClick={() => setShowSetup(false)}
                className="rounded-lg border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-text-primary">Add Staff Member</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddError(null);
                }}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-5">
              <Field label="Full Name" required>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  className={inputCls}
                  autoFocus
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone" required>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                  placeholder="(xxx)-xxx-xxxx"
                  className={`${inputCls} ${addForm.phone && !isValidPhone(addForm.phone) ? 'border-danger' : ''}`}
                />
                {addForm.phone && !isValidPhone(addForm.phone) && (
                  <p className="mt-1 text-xs text-danger">Format: (xxx)-xxx-xxxx</p>
                )}
              </Field>
              <Field label="Primary Role">
                <select
                  value={addForm.primaryRole}
                  onChange={(e) => setAddForm((p) => ({ ...p, primaryRole: e.target.value as StaffRole }))}
                  className={inputCls}
                >
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              {addError && <p className="text-sm text-danger">{addError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddError(null);
                }}
                className="rounded-lg border border-border bg-card-elevated px-4 py-2 text-sm text-text-secondary hover:bg-card"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStaff}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                Add Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="border-b border-border bg-card px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Team</h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              {staff.length} member{staff.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full bg-card-elevated px-3 py-1 text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">{stats.totalActive}</span> active
              </span>
              <span className="rounded-full bg-card-elevated px-3 py-1 text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">{stats.owners}</span> owner
                {stats.owners !== 1 ? 's' : ''}
              </span>
              {stats.onLeaveOrInactive > 0 && (
                <span className="rounded-full bg-card-elevated px-3 py-1 text-xs text-text-secondary">
                  <span className="font-semibold text-warning">{stats.onLeaveOrInactive}</span> unavailable
                </span>
              )}
            </div>
            <Link
              href="/staff/profile"
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-card-elevated"
            >
              My Profile
            </Link>
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              + Add Staff
            </button>
          </div>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel: staff list ── */}
        <div className={`shrink-0 flex-col border-r border-border w-full md:w-72 ${selectedStaffId ? 'hidden md:flex' : 'flex'}`}>
          {/* Search + filter */}
          <div className="space-y-2 border-b border-border p-3">
            <input
              type="text"
              placeholder="Search name, email, phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-card-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="flex flex-wrap gap-1">
              {(['all', 'active', 'on-leave', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterStatus === f
                      ? 'bg-accent text-white'
                      : 'bg-card-elevated text-text-secondary hover:bg-card'
                  }`}
                >
                  {f === 'all' ? 'All' : STATUS_LABELS[f as StaffStatus]}
                </button>
              ))}
            </div>
          </div>

          {/* Staff list */}
          <div className="flex-1 overflow-y-auto">
            {filteredStaff.length === 0 ? (
              <p className="p-4 text-center text-sm text-text-muted">
                {searchQuery || filterStatus !== 'all'
                  ? 'No staff match your filters.'
                  : 'No staff members yet. Click "+ Add Staff" to get started.'}
              </p>
            ) : (
              filteredStaff.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedStaffId(member.id)}
                  className={`w-full border-b border-border px-4 py-3 text-left transition-colors ${
                    selectedStaffId === member.id
                      ? 'border-l-2 border-l-accent bg-accent/5'
                      : 'hover:bg-card-elevated'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {member.profilePhoto ? (
                      <Image
                        src={member.profilePhoto}
                        alt={member.name}
                        width={36}
                        height={36}
                        unoptimized
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent">
                        {getInitials(member.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{member.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleColors[member.primaryRole as StaffRole] ?? roleColors['full-chef']}`}
                        >
                          {getRoleDisplayLabel(member.primaryRole)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColors[member.status]}`}
                        >
                          {STATUS_LABELS[member.status]}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: detail / edit ── */}
        <div className={`flex-1 overflow-y-auto ${selectedStaffId ? 'flex flex-col' : 'hidden md:block'}`}>
          {!selectedStaff ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
              <UserGroupIcon className="h-12 w-12 opacity-30" />
              <p className="text-sm">Select a staff member to view details</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-6 p-6">
              {/* Mobile back button */}
              <button
                onClick={() => setSelectedStaffId(null)}
                className="mb-2 flex items-center gap-1 text-sm font-medium text-accent md:hidden"
              >
                ← Back to list
              </button>
              {/* Identity header */}
              <div className="flex items-start gap-4">
                {editForm.profilePhoto ? (
                  <Image
                    src={editForm.profilePhoto}
                    alt={selectedStaff.name}
                    width={64}
                    height={64}
                    unoptimized
                    className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xl font-bold text-accent">
                    {getInitials(editForm.name || selectedStaff.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-text-primary">
                    {editForm.name || selectedStaff.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${roleColors[editForm.primaryRole as StaffRole] ?? roleColors['full-chef']}`}
                    >
                      {getRoleDisplayLabel(editForm.primaryRole)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[editForm.status]}`}
                    >
                      {STATUS_LABELS[editForm.status]}
                    </span>
                    {editForm.isOwner && editForm.ownerRole && (
                      <span className="inline-flex rounded-full bg-accent-soft-bg px-2 py-0.5 text-xs font-semibold text-accent">
                        {editForm.ownerRole === 'owner-a' ? 'Owner A' : 'Owner B'}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/staff/availability?staffId=${encodeURIComponent(selectedStaff.id)}`}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline"
                  >
                    <CalendarDaysIcon className="h-4 w-4" />
                    View in Team Calendar
                  </Link>
                </div>
              </div>

              {/* Contact */}
              <section className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Contact
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Full Name" required>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Phone" required>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                      placeholder="(xxx)-xxx-xxxx"
                      className={`${inputCls} ${editForm.phone && !isValidPhone(editForm.phone) ? 'border-danger' : ''}`}
                    />
                    {editForm.phone && !isValidPhone(editForm.phone) && (
                      <p className="mt-1 text-xs text-danger">Format: (xxx)-xxx-xxxx</p>
                    )}
                  </Field>
                  <Field label="Email" required>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </section>

              {/* Role & Status */}
              <section className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Role & Status
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Primary Role">
                    <select
                      value={editForm.primaryRole}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, primaryRole: e.target.value as StaffRole }))
                      }
                      className={inputCls}
                    >
                      {Object.entries(ROLE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, status: e.target.value as StaffStatus }))
                      }
                      className={inputCls}
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Secondary roles */}
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-text-secondary">Secondary Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ROLE_LABELS).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          const r = v as StaffRole;
                          setEditForm((p) => ({
                            ...p,
                            secondaryRoles: p.secondaryRoles.includes(r)
                              ? p.secondaryRoles.filter((x) => x !== r)
                              : [...p.secondaryRoles, r],
                          }));
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          editForm.secondaryRoles.includes(v as StaffRole)
                            ? 'bg-accent text-white'
                            : 'bg-card-elevated text-text-secondary hover:bg-card'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Owner status */}
                <div className="mt-4 space-y-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={editForm.isOwner}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          isOwner: e.target.checked,
                          ownerRole: e.target.checked ? p.ownerRole : undefined,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    Business owner
                  </label>
                  {editForm.isOwner && (
                    <Field label="Owner Role">
                      <select
                        value={editForm.ownerRole || ''}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            ownerRole: e.target.value as 'owner-a' | 'owner-b',
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="">Select owner role…</option>
                        <option value="owner-a">Owner A</option>
                        <option value="owner-b">Owner B</option>
                      </select>
                    </Field>
                  )}
                </div>
              </section>

              {/* Employment */}
              <section className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Employment
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Hourly Rate ($/hr)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.hourlyRate}
                      onChange={(e) => setEditForm((p) => ({ ...p, hourlyRate: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Hire Date">
                    <input
                      type="date"
                      value={editForm.hireDate}
                      onChange={(e) => setEditForm((p) => ({ ...p, hireDate: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </section>

              {/* Profile photo + summary */}
              <section className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Profile
                </h3>
                <div className="mb-4 flex items-center gap-4">
                  {editForm.profilePhoto ? (
                    <Image
                      src={editForm.profilePhoto}
                      alt="Profile"
                      width={56}
                      height={56}
                      unoptimized
                      className="h-14 w-14 rounded-full object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-base font-semibold text-accent ring-1 ring-border">
                      {getInitials(editForm.name)}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded-md border border-border bg-card-elevated px-3 py-1.5 text-sm text-text-secondary hover:bg-card">
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleProfilePhotoUpload(e.target.files?.[0] || null)}
                      />
                    </label>
                    {editForm.profilePhoto && (
                      <button
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, profilePhoto: '' }))}
                        className="text-sm text-danger hover:underline"
                      >
                        Remove
                      </button>
                    )}
                    <p className="text-xs text-text-muted">JPG, PNG, WEBP up to 2 MB.</p>
                  </div>
                </div>
                <Field label="Profile Summary">
                  <textarea
                    rows={2}
                    value={editForm.profileSummary}
                    onChange={(e) => setEditForm((p) => ({ ...p, profileSummary: e.target.value }))}
                    placeholder="Specialties, certifications, preferred station…"
                    className={`${inputCls} resize-none`}
                  />
                </Field>
              </section>

              {/* Weekly Availability */}
              <section className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Weekly Availability
                </h3>
                <p className="mb-4 text-xs text-text-muted">
                  Weekdays this person can generally work. For date-specific blocks, use their{' '}
                  <Link
                    href={`/staff/availability?staffId=${encodeURIComponent(selectedStaff.id)}`}
                    className="text-accent hover:underline"
                  >
                    Team Calendar
                  </Link>
                  .
                </p>
                <div className="grid grid-cols-7 gap-1.5">
                  {(
                    [
                      'monday',
                      'tuesday',
                      'wednesday',
                      'thursday',
                      'friday',
                      'saturday',
                      'sunday',
                    ] as DayOfWeek[]
                  ).map((day) => (
                    <div key={day} className="text-center">
                      <div className="mb-1 text-[10px] font-medium text-text-muted">
                        {DAY_LABELS[day]}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((p) => ({
                            ...p,
                            weeklyAvailability: {
                              ...p.weeklyAvailability,
                              [day]: !p.weeklyAvailability[day],
                            },
                          }))
                        }
                        className={`h-9 w-full rounded-md text-xs font-medium transition-colors ${
                          editForm.weeklyAvailability[day]
                            ? 'bg-success text-white hover:bg-success/90'
                            : 'bg-card-elevated text-text-muted hover:bg-card'
                        }`}
                      >
                        {editForm.weeklyAvailability[day] ? '✓' : '✕'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Notes */}
              <section className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Notes
                </h3>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Additional information about this staff member…"
                  className={`${inputCls} resize-none`}
                />
              </section>

              {/* Actions */}
              <div className="flex items-center justify-between pb-2">
                <button onClick={handleDelete} className="text-sm text-danger hover:underline">
                  Delete staff member
                </button>
                <div className="flex items-center gap-3">
                  {saveSuccess && <span className="text-sm text-success">Saved!</span>}
                  <button
                    onClick={handleSave}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

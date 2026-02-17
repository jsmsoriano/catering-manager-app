'use client';

import { useState, useMemo } from 'react';
import type {
  StaffMember,
  StaffFormData,
  StaffRole,
  StaffStatus,
  DayOfWeek,
} from '@/lib/staffTypes';
import {
  ROLE_LABELS,
  STATUS_LABELS,
  DAY_LABELS,
  DEFAULT_WEEKLY_AVAILABILITY,
} from '@/lib/staffTypes';

const roleColors: Record<StaffRole, string> = {
  'lead-chef': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300',
  'overflow-chef': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  'full-chef': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
  'buffet-chef': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
  'assistant': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  'contractor': 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300',
};

const statusColors: Record<StaffStatus, string> = {
  'active': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'inactive': 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
  'on-leave': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const MAX_PROFILE_PHOTO_BYTES = 1024 * 1024 * 2; // 2 MB

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function loadInitialStaff(): StaffMember[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('staff');
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as StaffMember[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>(loadInitialStaff);
  const [showModal, setShowModal] = useState(false);
  const [showSetup, setShowSetup] = useState(() => loadInitialStaff().length === 0);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | StaffStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState<StaffFormData>({
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
  });

  // Save staff to localStorage
  const saveStaff = (newStaff: StaffMember[]) => {
    console.log('👥 Staff: Saving', newStaff.length, 'staff members to localStorage');
    setStaff(newStaff);
    localStorage.setItem('staff', JSON.stringify(newStaff));
    // Notify other components that staff has been updated
    console.log('👥 Staff: Dispatching staffUpdated event');
    window.dispatchEvent(new Event('staffUpdated'));
  };

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
      setFormData((prev) => ({ ...prev, profilePhoto: result }));
    };
    reader.readAsDataURL(file);
  };

  // Filtered and searched staff
  const filteredStaff = useMemo(() => {
    let result = staff;

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((s) => s.status === filterStatus);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.phone.toLowerCase().includes(query)
      );
    }

    return result;
  }, [staff, filterStatus, searchQuery]);

  // Summary stats
  const stats = useMemo(() => {
    const activeStaff = staff.filter((s) => s.status === 'active');
    const owners = staff.filter((s) => s.isOwner);
    const onLeave = staff.filter((s) => s.status === 'on-leave');
    const inactive = staff.filter((s) => s.status === 'inactive');

    return {
      totalActive: activeStaff.length,
      owners: owners.length,
      availableThisWeek: activeStaff.length - onLeave.length,
      onLeaveOrInactive: onLeave.length + inactive.length,
    };
  }, [staff]);

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const errors: string[] = [];

    if (!formData.name.trim()) errors.push('Name is required');
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.push('Valid email is required');
    }
    if (!formData.phone.trim()) errors.push('Phone is required');
    if (formData.isOwner && !formData.ownerRole) {
      errors.push('Owner role must be specified for owners');
    }

    // Check for duplicate owner roles
    if (formData.isOwner && formData.ownerRole) {
      const existingOwner = staff.find(
        (s) =>
          s.ownerRole === formData.ownerRole &&
          (!selectedStaff || s.id !== selectedStaff.id)
      );
      if (existingOwner) {
        errors.push(`${formData.ownerRole} is already assigned to ${existingOwner.name}`);
      }
    }

    if (errors.length > 0) {
      alert('Please fix the following errors:\n\n' + errors.join('\n'));
      return;
    }

    const staffMember: StaffMember = {
      id: selectedStaff?.id || crypto.randomUUID(),
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      profilePhoto: formData.profilePhoto || undefined,
      profileSummary: formData.profileSummary.trim() || undefined,
      primaryRole: formData.primaryRole,
      secondaryRoles: formData.secondaryRoles,
      status: formData.status,
      isOwner: formData.isOwner,
      ownerRole: formData.isOwner ? formData.ownerRole : undefined,
      weeklyAvailability: formData.weeklyAvailability,
      unavailableDates: selectedStaff?.unavailableDates || [],
      hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : undefined,
      notes: formData.notes.trim(),
      hireDate: formData.hireDate,
      createdAt: selectedStaff?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isEditing && selectedStaff) {
      // Update existing
      saveStaff(staff.map((s) => (s.id === selectedStaff.id ? staffMember : s)));
    } else {
      // Create new
      saveStaff([...staff, staffMember]);
    }

    setShowModal(false);
    resetForm();
  };

  // Handle delete
  const handleDelete = () => {
    if (selectedStaff && confirm(`Delete ${selectedStaff.name}?`)) {
      saveStaff(staff.filter((s) => s.id !== selectedStaff.id));
      setShowModal(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedStaff(null);
    setIsEditing(false);
    setFormData({
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
    });
  };

  // Handle setup - create owner records
  const handleCreateOwners = () => {
    const ownerA: StaffMember = {
      id: crypto.randomUUID(),
      name: 'Owner A',
      email: 'ownera@example.com',
      phone: '555-0001',
      profilePhoto: undefined,
      profileSummary: '',
      primaryRole: 'lead-chef',
      secondaryRoles: ['full-chef'],
      status: 'active',
      isOwner: true,
      ownerRole: 'owner-a',
      weeklyAvailability: { ...DEFAULT_WEEKLY_AVAILABILITY },
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
      profilePhoto: undefined,
      profileSummary: '',
      primaryRole: 'assistant',
      secondaryRoles: ['buffet-chef'],
      status: 'active',
      isOwner: true,
      ownerRole: 'owner-b',
      weeklyAvailability: { ...DEFAULT_WEEKLY_AVAILABILITY },
      unavailableDates: [],
      hireDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveStaff([ownerA, ownerB]);
    setShowSetup(false);
  };

  // Toggle secondary role
  const toggleSecondaryRole = (role: StaffRole) => {
    setFormData({
      ...formData,
      secondaryRoles: formData.secondaryRoles.includes(role)
        ? formData.secondaryRoles.filter((r) => r !== role)
        : [...formData.secondaryRoles, role],
    });
  };

  // Toggle day availability
  const toggleDay = (day: DayOfWeek) => {
    setFormData({
      ...formData,
      weeklyAvailability: {
        ...formData.weeklyAvailability,
        [day]: !formData.weeklyAvailability[day],
      },
    });
  };

  return (
    <div className="h-full p-8">
      {/* Setup Modal */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Welcome to Staff Management
            </h2>
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">
              Let us get started by creating your owner profiles. You can edit their details after creation.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCreateOwners}
                className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Create Owner Profiles
              </button>
              <button
                onClick={() => setShowSetup(false)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Staff Management
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Manage your team members and their availability
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          + Add Staff
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
            Total Active Staff
          </h3>
          <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
            {stats.totalActive}
          </p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
            Currently employed
          </p>
        </div>

        <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-900 dark:bg-purple-950/20">
          <h3 className="text-sm font-medium text-purple-900 dark:text-purple-200">
            Business Owners
          </h3>
          <p className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
            {stats.owners}
          </p>
          <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
            Owner accounts
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
          <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Available This Week
          </h3>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.availableThisWeek}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Ready to work
          </p>
        </div>

        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6 dark:border-orange-900 dark:bg-orange-950/20">
          <h3 className="text-sm font-medium text-orange-900 dark:text-orange-200">
            On Leave / Inactive
          </h3>
          <p className="mt-2 text-3xl font-bold text-orange-600 dark:text-orange-400">
            {stats.onLeaveOrInactive}
          </p>
          <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
            Currently unavailable
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'active'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterStatus('on-leave')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'on-leave'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            On Leave
          </button>
          <button
            onClick={() => setFilterStatus('inactive')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filterStatus === 'inactive'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            Inactive
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Staff Table */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Weekly Availability
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    {searchQuery || filterStatus !== 'all'
                      ? 'No staff members match your filters'
                      : 'No staff members yet. Click "+ Add Staff" to get started!'}
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-4 text-sm">
                      <div className="flex items-center gap-3">
                        {member.profilePhoto ? (
                          <img
                            src={member.profilePhoto}
                            alt={`${member.name} profile`}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            {getInitials(member.name)}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {member.name}
                          </div>
                          {member.isOwner && (
                            <div className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
                              {member.ownerRole === 'owner-a' ? 'Owner A' : 'Owner B'}
                            </div>
                          )}
                          {member.profileSummary && (
                            <div className="mt-1 max-w-xs truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {member.profileSummary}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          roleColors[member.primaryRole]
                        }`}
                      >
                        {ROLE_LABELS[member.primaryRole]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                      <div>{member.phone}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {member.email}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          statusColors[member.status]
                        }`}
                      >
                        {STATUS_LABELS[member.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex gap-1">
                        {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as DayOfWeek[]).map(
                          (day) => (
                            <div
                              key={day}
                              className={`flex h-6 w-6 items-center justify-center rounded text-xs ${
                                member.weeklyAvailability[day]
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600'
                              }`}
                              title={`${DAY_LABELS[day]}: ${
                                member.weeklyAvailability[day] ? 'Available' : 'Unavailable'
                              }`}
                            >
                              {DAY_LABELS[day][0]}
                            </div>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedStaff(member);
                            setIsEditing(true);
                            setFormData({
                              name: member.name,
                              email: member.email,
                              phone: member.phone,
                              profilePhoto: member.profilePhoto || '',
                              profileSummary: member.profileSummary || '',
                              primaryRole: member.primaryRole,
                              secondaryRoles: member.secondaryRoles,
                              status: member.status,
                              isOwner: member.isOwner,
                              ownerRole: member.ownerRole,
                              weeklyAvailability: { ...member.weeklyAvailability },
                              hourlyRate: member.hourlyRate ? member.hourlyRate.toString() : '',
                              notes: member.notes || '',
                              hireDate: member.hireDate,
                            });
                            setShowModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(`Delete ${member.name}? This action cannot be undone.`)
                            ) {
                              saveStaff(staff.filter((s) => s.id !== member.id));
                            }
                          }}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {isEditing ? 'Edit Staff Member' : 'Add Staff Member'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-zinc-500 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Info */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                  Personal Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Profile */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                  Profile
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Profile Photo
                    </label>
                    <div className="mt-2 flex items-center gap-4">
                      {formData.profilePhoto ? (
                        <img
                          src={formData.profilePhoto}
                          alt="Profile preview"
                          className="h-16 w-16 rounded-full object-cover ring-1 ring-zinc-300 dark:ring-zinc-700"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800">
                          {getInitials(formData.name)}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                          Upload Photo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleProfilePhotoUpload(e.target.files?.[0] || null)}
                          />
                        </label>
                        {formData.profilePhoto && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, profilePhoto: '' })}
                            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            Remove
                          </button>
                        )}
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          JPG, PNG, or WEBP up to 2 MB.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Profile Summary
                    </label>
                    <textarea
                      rows={2}
                      value={formData.profileSummary}
                      onChange={(e) =>
                        setFormData({ ...formData, profileSummary: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="Short intro, specialties, certifications, or preferred station."
                    />
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                  Employment Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Primary Role *
                    </label>
                    <select
                      value={formData.primaryRole}
                      onChange={(e) =>
                        setFormData({ ...formData, primaryRole: e.target.value as StaffRole })
                      }
                      required
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Status *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as StaffStatus })
                      }
                      required
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Hourly Rate ($/hr)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.hourlyRate}
                      onChange={(e) =>
                        setFormData({ ...formData, hourlyRate: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Hire Date *
                    </label>
                    <input
                      type="date"
                      value={formData.hireDate}
                      onChange={(e) =>
                        setFormData({ ...formData, hireDate: e.target.value })
                      }
                      required
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Secondary Roles */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Secondary Roles (Optional)
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleSecondaryRole(value as StaffRole)}
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          formData.secondaryRoles.includes(value as StaffRole)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Owner Status */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                  Owner Status
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isOwner}
                      onChange={(e) =>
                        setFormData({ ...formData, isOwner: e.target.checked, ownerRole: e.target.checked ? formData.ownerRole : undefined })
                      }
                      className="mr-2 h-4 w-4"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      This person is a business owner
                    </span>
                  </label>
                  {formData.isOwner && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Owner Role *
                      </label>
                      <select
                        value={formData.ownerRole || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ownerRole: e.target.value as 'owner-a' | 'owner-b',
                          })
                        }
                        required
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        <option value="">Select owner role...</option>
                        <option value="owner-a">Owner A</option>
                        <option value="owner-b">Owner B</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Weekly Availability */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
                  Weekly Availability
                </h3>
                <div className="grid grid-cols-7 gap-2">
                  {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as DayOfWeek[]).map(
                    (day) => (
                      <div key={day} className="text-center">
                        <div className="mb-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {DAY_LABELS[day]}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`h-10 w-full rounded-md text-sm font-medium ${
                            formData.weeklyAvailability[day]
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {formData.weeklyAvailability[day] ? '✓' : '✕'}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Any additional information about this staff member..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                    >
                      Delete Staff Member
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                  >
                    {isEditing ? 'Update Staff Member' : 'Add Staff Member'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

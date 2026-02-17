'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type {
  DayOfWeek,
  StaffMember,
  WeeklyAvailability,
  WeeklyAvailabilityHours,
} from '@/lib/staffTypes';
import {
  DAY_LABELS,
  DEFAULT_WEEKLY_AVAILABILITY,
  DEFAULT_WEEKLY_AVAILABILITY_HOURS,
} from '@/lib/staffTypes';

const STAFF_KEY = 'staff';
const MAX_PROFILE_PHOTO_BYTES = 1024 * 1024 * 2; // 2 MB
const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

interface StaffProfileFormData {
  name: string;
  email: string;
  phone: string;
  profilePhoto: string;
  profileSummary: string;
  weeklyAvailability: WeeklyAvailability;
  weeklyAvailabilityHours: WeeklyAvailabilityHours;
  unavailableDates: string[];
}

interface InitialProfileState {
  staff: StaffMember[];
  selectedStaffId: string;
  formData: StaffProfileFormData;
}

function safeParseList<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (words.length === 0) return '?';
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

function withDefaultWeeklyAvailability(
  value: WeeklyAvailability | undefined
): WeeklyAvailability {
  return {
    monday: value?.monday ?? DEFAULT_WEEKLY_AVAILABILITY.monday,
    tuesday: value?.tuesday ?? DEFAULT_WEEKLY_AVAILABILITY.tuesday,
    wednesday: value?.wednesday ?? DEFAULT_WEEKLY_AVAILABILITY.wednesday,
    thursday: value?.thursday ?? DEFAULT_WEEKLY_AVAILABILITY.thursday,
    friday: value?.friday ?? DEFAULT_WEEKLY_AVAILABILITY.friday,
    saturday: value?.saturday ?? DEFAULT_WEEKLY_AVAILABILITY.saturday,
    sunday: value?.sunday ?? DEFAULT_WEEKLY_AVAILABILITY.sunday,
  };
}

function withDefaultWeeklyAvailabilityHours(
  value: WeeklyAvailabilityHours | undefined
): WeeklyAvailabilityHours {
  return {
    monday: value?.monday ?? DEFAULT_WEEKLY_AVAILABILITY_HOURS.monday,
    tuesday: value?.tuesday ?? DEFAULT_WEEKLY_AVAILABILITY_HOURS.tuesday,
    wednesday: value?.wednesday ?? DEFAULT_WEEKLY_AVAILABILITY_HOURS.wednesday,
    thursday: value?.thursday ?? DEFAULT_WEEKLY_AVAILABILITY_HOURS.thursday,
    friday: value?.friday ?? DEFAULT_WEEKLY_AVAILABILITY_HOURS.friday,
    saturday: value?.saturday ?? DEFAULT_WEEKLY_AVAILABILITY_HOURS.saturday,
    sunday: value?.sunday ?? DEFAULT_WEEKLY_AVAILABILITY_HOURS.sunday,
  };
}

function normalizeStaffMembers(staff: StaffMember[]): StaffMember[] {
  return staff.map((member) => ({
    ...member,
    weeklyAvailability: withDefaultWeeklyAvailability(member.weeklyAvailability),
    weeklyAvailabilityHours: withDefaultWeeklyAvailabilityHours(member.weeklyAvailabilityHours),
    unavailableDates: Array.isArray(member.unavailableDates) ? member.unavailableDates : [],
  }));
}

function loadStaffRecords(): StaffMember[] {
  if (typeof window === 'undefined') return [];
  const parsed = safeParseList<StaffMember>(window.localStorage.getItem(STAFF_KEY));
  return normalizeStaffMembers(parsed);
}

function buildProfileFormData(member: StaffMember | null): StaffProfileFormData {
  return {
    name: member?.name ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    profilePhoto: member?.profilePhoto ?? '',
    profileSummary: member?.profileSummary ?? '',
    weeklyAvailability: withDefaultWeeklyAvailability(member?.weeklyAvailability),
    weeklyAvailabilityHours: withDefaultWeeklyAvailabilityHours(member?.weeklyAvailabilityHours),
    unavailableDates: [...(member?.unavailableDates ?? [])].sort(),
  };
}

function getPreferredStaffId(staff: StaffMember[]): string {
  if (typeof window === 'undefined') return staff[0]?.id ?? '';
  const fromQuery = new URLSearchParams(window.location.search).get('staffId');
  if (fromQuery && staff.some((member) => member.id === fromQuery)) return fromQuery;
  return staff[0]?.id ?? '';
}

function loadInitialProfileState(): InitialProfileState {
  const staff = loadStaffRecords();
  const selectedStaffId = getPreferredStaffId(staff);
  const selectedStaff = staff.find((member) => member.id === selectedStaffId) ?? null;
  return {
    staff,
    selectedStaffId,
    formData: buildProfileFormData(selectedStaff),
  };
}

export default function StaffProfilePage() {
  const [initialState] = useState<InitialProfileState>(loadInitialProfileState);
  const [staff, setStaff] = useState<StaffMember[]>(initialState.staff);
  const [selectedStaffId, setSelectedStaffId] = useState(initialState.selectedStaffId);
  const [formData, setFormData] = useState<StaffProfileFormData>(initialState.formData);
  const [newUnavailableDate, setNewUnavailableDate] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedStaff = useMemo(
    () => staff.find((member) => member.id === selectedStaffId) ?? null,
    [staff, selectedStaffId]
  );

  useEffect(() => {
    const refreshFromStorage = () => {
      const refreshed = loadStaffRecords();
      const resolvedStaffId =
        selectedStaffId && refreshed.some((member) => member.id === selectedStaffId)
          ? selectedStaffId
          : refreshed[0]?.id ?? '';
      const resolvedStaff =
        refreshed.find((member) => member.id === resolvedStaffId) ?? null;

      setStaff(refreshed);
      setSelectedStaffId(resolvedStaffId);
      setFormData(buildProfileFormData(resolvedStaff));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STAFF_KEY) refreshFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('staffUpdated', refreshFromStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('staffUpdated', refreshFromStorage);
    };
  }, [selectedStaffId]);

  const handleSelectStaff = (staffId: string) => {
    const member = staff.find((entry) => entry.id === staffId) ?? null;
    setSelectedStaffId(staffId);
    setFormData(buildProfileFormData(member));
    setSaveSuccess(false);
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
      setSaveSuccess(false);
    };
    reader.readAsDataURL(file);
  };

  const toggleDay = (day: DayOfWeek) => {
    setFormData((prev) => ({
      ...prev,
      weeklyAvailability: {
        ...prev.weeklyAvailability,
        [day]: !prev.weeklyAvailability[day],
      },
    }));
    setSaveSuccess(false);
  };

  const updateDayHours = (
    day: DayOfWeek,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      weeklyAvailabilityHours: {
        ...prev.weeklyAvailabilityHours,
        [day]: {
          ...prev.weeklyAvailabilityHours[day],
          [field]: value,
        },
      },
    }));
    setSaveSuccess(false);
  };

  const addUnavailableDate = () => {
    if (!newUnavailableDate) return;
    if (formData.unavailableDates.includes(newUnavailableDate)) {
      alert('That date is already listed as unavailable.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      unavailableDates: [...prev.unavailableDates, newUnavailableDate].sort(),
    }));
    setNewUnavailableDate('');
    setSaveSuccess(false);
  };

  const removeUnavailableDate = (date: string) => {
    setFormData((prev) => ({
      ...prev,
      unavailableDates: prev.unavailableDates.filter((entry) => entry !== date),
    }));
    setSaveSuccess(false);
  };

  const handleSaveProfile = () => {
    if (!selectedStaff) return;

    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    if (!name) {
      alert('Name is required.');
      return;
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert('Enter a valid email address.');
      return;
    }
    if (!phone) {
      alert('Phone is required.');
      return;
    }

    const updatedStaff = staff.map((member) => {
      if (member.id !== selectedStaff.id) return member;
      return {
        ...member,
        name,
        email,
        phone,
        profilePhoto: formData.profilePhoto || undefined,
        profileSummary: formData.profileSummary.trim() || undefined,
        weeklyAvailability: withDefaultWeeklyAvailability(formData.weeklyAvailability),
        weeklyAvailabilityHours: withDefaultWeeklyAvailabilityHours(
          formData.weeklyAvailabilityHours
        ),
        unavailableDates: [...new Set(formData.unavailableDates)].sort(),
        updatedAt: new Date().toISOString(),
      };
    });

    setStaff(updatedStaff);
    localStorage.setItem(STAFF_KEY, JSON.stringify(updatedStaff));
    window.dispatchEvent(new Event('staffUpdated'));
    setSaveSuccess(true);
  };

  if (staff.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">My Profile</h1>
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">
            No staff profiles exist yet. Ask an admin to create a staff member first.
          </p>
          <Link
            href="/staff"
            className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Go to Staff Management
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">My Profile</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Update your contact details, profile photo, and availability preferences.
          </p>
        </div>
        <Link
          href="/staff"
          className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Back to Staff
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm dark:border-indigo-900 dark:bg-indigo-950/20">
        <p className="font-semibold text-indigo-900 dark:text-indigo-200">How to use this page</p>
        <p className="mt-1 text-indigo-800 dark:text-indigo-300">
          Keep your contact info current, set your normal weekly hours, and add date-specific
          blocks so schedulers avoid conflicts.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Staff Profile
          </label>
          <select
            value={selectedStaffId}
            onChange={(event) => handleSelectStaff(event.target.value)}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSaveProfile}
          className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          Save Profile
        </button>
        {saveSuccess && (
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Profile saved.
          </span>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-4">
          {formData.profilePhoto ? (
            <Image
              src={formData.profilePhoto}
              alt="Profile preview"
              width={72}
              height={72}
              unoptimized
              className="h-18 w-18 rounded-full object-cover ring-1 ring-zinc-300 dark:ring-zinc-700"
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800">
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
                onChange={(event) => handleProfilePhotoUpload(event.target.files?.[0] || null)}
              />
            </label>
            {formData.profilePhoto && (
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, profilePhoto: '' }))}
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                Remove
              </button>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">JPG, PNG, WEBP up to 2 MB.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, name: event.target.value }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, email: event.target.value }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, phone: event.target.value }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Profile Summary
            </label>
            <textarea
              rows={3}
              value={formData.profileSummary}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, profileSummary: event.target.value }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Share specialties, certifications, or preferred station."
            />
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Weekly Availability (Dates + Times)
        </h2>
        <div className="space-y-3">
          {DAY_ORDER.map((day) => (
            <div
              key={day}
              className="grid grid-cols-1 items-center gap-3 rounded-md border border-zinc-200 p-3 sm:grid-cols-[120px_120px_1fr_1fr] dark:border-zinc-800"
            >
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {DAY_LABELS[day]}
              </span>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={formData.weeklyAvailability[day]}
                  onChange={() => toggleDay(day)}
                />
                Available
              </label>
              <input
                type="time"
                value={formData.weeklyAvailabilityHours[day].startTime}
                onChange={(event) =>
                  updateDayHours(day, 'startTime', event.target.value)
                }
                disabled={!formData.weeklyAvailability[day]}
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900"
              />
              <input
                type="time"
                value={formData.weeklyAvailabilityHours[day].endTime}
                onChange={(event) =>
                  updateDayHours(day, 'endTime', event.target.value)
                }
                disabled={!formData.weeklyAvailability[day]}
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Date-Specific Unavailable Blocks
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Unavailable Date
            </label>
            <input
              type="date"
              value={newUnavailableDate}
              onChange={(event) => setNewUnavailableDate(event.target.value)}
              className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            type="button"
            onClick={addUnavailableDate}
            className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Add Blocked Date
          </button>
        </div>

        {formData.unavailableDates.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {formData.unavailableDates.map((date) => (
              <span
                key={date}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {date}
                <button
                  type="button"
                  onClick={() => removeUnavailableDate(date)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  aria-label={`Remove ${date}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            No blocked dates added.
          </p>
        )}
      </div>
    </div>
  );
}

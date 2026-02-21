'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { loadFromStorage, saveToStorage } from './storage';
import type { Booking } from './bookingTypes';
import type {
  CustomerId,
  CustomerProfileMeta,
  DerivedCustomer,
} from './customerTypes';
import {
  CUSTOMER_PROFILES_KEY,
  CUSTOMER_PROFILES_EVENT,
} from './customerTypes';

// ─── Identity helpers ─────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Normalize to last 10 digits for US numbers; keep as-is for shorter inputs
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function normalizeCustomerId(phone: string, email: string): CustomerId {
  const p = normalizePhone(phone ?? '');
  if (p.length >= 7) return `phone:${p}`;
  const e = (email ?? '').trim().toLowerCase();
  return e ? `email:${e}` : 'unknown';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCustomers(): {
  customers: DerivedCustomer[];
  profileMeta: Record<CustomerId, CustomerProfileMeta>;
  updateProfileMeta: (id: CustomerId, patch: Partial<CustomerProfileMeta>) => void;
} {
  const [bookings, setBookings] = useState<Booking[]>(() =>
    loadFromStorage<Booking[]>('bookings', [])
  );
  const [profileMeta, setProfileMeta] = useState<Record<CustomerId, CustomerProfileMeta>>(() =>
    loadFromStorage<Record<CustomerId, CustomerProfileMeta>>(CUSTOMER_PROFILES_KEY, {})
  );

  // Sync bookings from localStorage
  useEffect(() => {
    const reload = () => setBookings(loadFromStorage<Booking[]>('bookings', []));
    window.addEventListener('bookingsUpdated', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('bookingsUpdated', reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  // Sync profileMeta from localStorage
  useEffect(() => {
    const reload = () =>
      setProfileMeta(
        loadFromStorage<Record<CustomerId, CustomerProfileMeta>>(CUSTOMER_PROFILES_KEY, {})
      );
    window.addEventListener(CUSTOMER_PROFILES_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CUSTOMER_PROFILES_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  // Derive customers from bookings + profileMeta
  const customers = useMemo<DerivedCustomer[]>(() => {
    const map = new Map<CustomerId, Booking[]>();

    for (const booking of bookings) {
      const id = normalizeCustomerId(booking.customerPhone, booking.customerEmail);
      if (id === 'unknown') continue;
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(booking);
    }

    const result: DerivedCustomer[] = [];

    for (const [id, customerBookings] of map.entries()) {
      // Sort newest first
      const sorted = [...customerBookings].sort(
        (a, b) => b.eventDate.localeCompare(a.eventDate)
      );
      const mostRecent = sorted[0];
      const nonCancelled = sorted.filter((b) => b.status !== 'cancelled');
      const completed = sorted.filter((b) => b.status === 'completed');

      const totalRevenue = nonCancelled.reduce((sum, b) => sum + (b.total ?? 0), 0);
      const totalPaid = nonCancelled.reduce((sum, b) => sum + (b.amountPaid ?? 0), 0);

      const meta = profileMeta[id] ?? { tags: [], notes: '', updatedAt: '' };

      result.push({
        id,
        name: mostRecent.customerName,
        phone: meta.contactOverrides?.phone ?? mostRecent.customerPhone,
        email: meta.contactOverrides?.email ?? mostRecent.customerEmail,
        bookings: sorted,
        totalRevenue,
        totalPaid,
        bookingCount: sorted.length,
        completedCount: completed.length,
        lastEventDate: sorted[0]?.eventDate ?? null,
        firstEventDate: sorted[sorted.length - 1]?.eventDate ?? null,
        tags: meta.tags,
        notes: meta.notes,
      });
    }

    // Append stub-only profiles (manually created by admin, no bookings)
    for (const [id, meta] of Object.entries(profileMeta)) {
      if (meta.isStub && meta.stubName && !map.has(id as CustomerId)) {
        result.push({
          id: id as CustomerId,
          name: meta.stubName,
          phone: meta.contactOverrides?.phone ?? '',
          email: meta.contactOverrides?.email ?? '',
          bookings: [],
          totalRevenue: 0,
          totalPaid: 0,
          bookingCount: 0,
          completedCount: 0,
          lastEventDate: null,
          firstEventDate: null,
          tags: meta.tags,
          notes: meta.notes,
        });
      }
    }

    // Sort by most recent event date (stubs without dates go to end)
    return result.sort((a, b) =>
      (b.lastEventDate ?? '').localeCompare(a.lastEventDate ?? '')
    );
  }, [bookings, profileMeta]);

  const updateProfileMeta = useCallback(
    (id: CustomerId, patch: Partial<CustomerProfileMeta>) => {
      setProfileMeta((prev) => {
        const existing = prev[id] ?? { tags: [], notes: '', updatedAt: '' };
        const updated = {
          ...existing,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        const next = { ...prev, [id]: updated };
        saveToStorage(CUSTOMER_PROFILES_KEY, next);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(CUSTOMER_PROFILES_EVENT));
        }
        return next;
      });
    },
    []
  );

  return { customers, profileMeta, updateProfileMeta };
}

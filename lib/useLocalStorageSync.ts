'use client';

// ============================================================================
// useLocalStorageSync<T>
// ============================================================================
// Drop-in replacement for the repeated localStorage + window-event pattern
// found across 5+ page components.
//
// Usage:
//   const [bookings, setBookings] = useLocalStorageSync<Booking[]>(
//     'bookings',
//     [],
//     StorageEvent.Bookings
//   );
//
// - Initialises from localStorage on mount (SSR-safe).
// - Subscribes to both the 'storage' event (cross-tab) and the custom
//   domain event (same-tab, e.g. 'bookingsUpdated').
// - setBookings persists to localStorage and dispatches the domain event.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { StorageEventName } from './storageEvents';

function readFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalStorageSync<T>(
  storageKey: string,
  fallback: T,
  domainEvent: StorageEventName
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readFromStorage(storageKey, fallback));

  // Reload from storage when another tab writes or when same-tab dispatch fires.
  useEffect(() => {
    const reload = () => setValue(readFromStorage(storageKey, fallback));
    window.addEventListener('storage', reload);
    window.addEventListener(domainEvent, reload);
    return () => {
      window.removeEventListener('storage', reload);
      window.removeEventListener(domainEvent, reload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, domainEvent]);

  const set = useCallback(
    (next: T) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // quota exceeded — ignore; component state still updates
      }
      setValue(next);
      window.dispatchEvent(new Event(domainEvent));
    },
    [storageKey, domainEvent]
  );

  return [value, set];
}

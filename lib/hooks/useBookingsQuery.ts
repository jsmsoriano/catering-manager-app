'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchBookings, monthsAgo, upsertBookings, deleteBooking } from '@/lib/db/bookings';
import { normalizeBookingWorkflowFields } from '@/lib/bookingWorkflow';
import { loadFromStorage } from '@/lib/storage';
import type { Booking } from '@/lib/bookingTypes';

export const BOOKINGS_QK = ['bookings'] as const;

/** Default fetch window: past 6 months + all future events.
 *  Covers the main UI (upcoming events, recent history, active pipeline).
 *  For reports spanning older data pass { fromDate: undefined, limit: Infinity }
 *  directly to fetchBookings(). */
const DEFAULT_FROM = monthsAgo(6);

export function useBookingsQuery() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [...BOOKINGS_QK, DEFAULT_FROM],
    queryFn: () => fetchBookings(supabase!, { fromDate: DEFAULT_FROM }),
    enabled: !!supabase,
    // Serve localStorage cache instantly; treat it as stale after 30 s
    // so Supabase refetch fires without waiting for user interaction.
    initialData: () => loadFromStorage<Booking[]>('bookings', []),
    initialDataUpdatedAt: Date.now() - 30_000,
    staleTime: 30_000,
  });

  const saveBooking = useMutation({
    mutationFn: async (booking: Booking) => {
      const normalized = normalizeBookingWorkflowFields(booking);
      await upsertBookings(supabase!, [normalized]);
      return normalized;
    },
    onMutate: async (booking) => {
      await qc.cancelQueries({ queryKey: BOOKINGS_QK });
      const prev = qc.getQueryData<Booking[]>(BOOKINGS_QK);
      qc.setQueryData<Booking[]>(BOOKINGS_QK, (old = []) =>
        old.map((b) =>
          b.id === booking.id ? normalizeBookingWorkflowFields(booking) : b
        )
      );
      return { prev };
    },
    onError: (_err, _booking, ctx) => {
      if (ctx?.prev) qc.setQueryData(BOOKINGS_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOOKINGS_QK }),
  });

  const addBooking = useMutation({
    mutationFn: async (booking: Booking) => {
      const normalized = normalizeBookingWorkflowFields(booking);
      await upsertBookings(supabase!, [normalized]);
      return normalized;
    },
    onMutate: async (booking) => {
      await qc.cancelQueries({ queryKey: BOOKINGS_QK });
      const prev = qc.getQueryData<Booking[]>(BOOKINGS_QK);
      qc.setQueryData<Booking[]>(BOOKINGS_QK, (old = []) => [
        ...old,
        normalizeBookingWorkflowFields(booking),
      ]);
      return { prev };
    },
    onError: (_err, _booking, ctx) => {
      if (ctx?.prev) qc.setQueryData(BOOKINGS_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOOKINGS_QK }),
  });

  const removeBooking = useMutation({
    mutationFn: (appId: string) => deleteBooking(supabase!, appId),
    onMutate: async (appId) => {
      await qc.cancelQueries({ queryKey: BOOKINGS_QK });
      const prev = qc.getQueryData<Booking[]>(BOOKINGS_QK);
      qc.setQueryData<Booking[]>(BOOKINGS_QK, (old = []) =>
        old.filter((b) => b.id !== appId)
      );
      return { prev };
    },
    onError: (_err, _appId, ctx) => {
      if (ctx?.prev) qc.setQueryData(BOOKINGS_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOOKINGS_QK }),
  });

  return {
    bookings: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    saveBooking: saveBooking.mutateAsync,
    addBooking: addBooking.mutateAsync,
    removeBooking: removeBooking.mutateAsync,
  };
}

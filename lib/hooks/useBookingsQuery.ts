'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchBookings, upsertBookings, deleteBooking } from '@/lib/db/bookings';
import { normalizeBookingWorkflowFields } from '@/lib/bookingWorkflow';
import { loadFromStorage } from '@/lib/storage';
import type { Booking } from '@/lib/bookingTypes';

export const BOOKINGS_QK = ['bookings'] as const;

export function useBookingsQuery() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: BOOKINGS_QK,
    queryFn: () => fetchBookings(supabase!),
    enabled: !!supabase,
    // Instant first paint from localStorage cache; immediately refetched from Supabase
    initialData: () => loadFromStorage<Booking[]>('bookings', []),
    initialDataUpdatedAt: 0,
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

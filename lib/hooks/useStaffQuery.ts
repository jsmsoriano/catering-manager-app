'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchStaff, upsertStaff } from '@/lib/db/staff';
import { loadFromStorage } from '@/lib/storage';
import type { StaffMember } from '@/lib/staffTypes';

export const STAFF_QK = ['staff'] as const;

export function useStaffQuery() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: STAFF_QK,
    queryFn: () => fetchStaff(supabase!),
    enabled: !!supabase,
    initialData: () => loadFromStorage<StaffMember[]>('staff', []),
    initialDataUpdatedAt: 0,
  });

  const saveStaff = useMutation({
    mutationFn: async (members: StaffMember[]) => {
      await upsertStaff(supabase!, members);
      return members;
    },
    onMutate: async (members) => {
      await qc.cancelQueries({ queryKey: STAFF_QK });
      const prev = qc.getQueryData<StaffMember[]>(STAFF_QK);
      // Merge: update existing members, append new ones
      qc.setQueryData<StaffMember[]>(STAFF_QK, (old = []) => {
        const updatedIds = new Set(members.map((m) => m.id));
        const merged = old.map((m) => {
          const updated = members.find((u) => u.id === m.id);
          return updated ?? m;
        });
        members.forEach((m) => {
          if (!updatedIds.has(m.id) || !old.find((o) => o.id === m.id)) {
            if (!merged.find((x) => x.id === m.id)) merged.push(m);
          }
        });
        return merged;
      });
      return { prev };
    },
    onError: (_err, _members, ctx) => {
      if (ctx?.prev) qc.setQueryData(STAFF_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: STAFF_QK }),
  });

  const saveMember = useMutation({
    mutationFn: async (member: StaffMember) => {
      await upsertStaff(supabase!, [member]);
      return member;
    },
    onMutate: async (member) => {
      await qc.cancelQueries({ queryKey: STAFF_QK });
      const prev = qc.getQueryData<StaffMember[]>(STAFF_QK);
      qc.setQueryData<StaffMember[]>(STAFF_QK, (old = []) => {
        const exists = old.some((m) => m.id === member.id);
        return exists ? old.map((m) => (m.id === member.id ? member : m)) : [...old, member];
      });
      return { prev };
    },
    onError: (_err, _member, ctx) => {
      if (ctx?.prev) qc.setQueryData(STAFF_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: STAFF_QK }),
  });

  return {
    staff: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    saveStaff: saveStaff.mutateAsync,   // save many at once
    saveMember: saveMember.mutateAsync, // save a single member
  };
}

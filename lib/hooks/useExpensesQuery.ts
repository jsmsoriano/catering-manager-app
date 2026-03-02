'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchExpenses, upsertExpenses } from '@/lib/db/expenses';
import { loadFromStorage } from '@/lib/storage';
import type { Expense } from '@/lib/expenseTypes';

export const EXPENSES_QK = ['expenses'] as const;

export function useExpensesQuery() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: EXPENSES_QK,
    queryFn: () => fetchExpenses(supabase!),
    enabled: !!supabase,
    initialData: () => loadFromStorage<Expense[]>('expenses', []),
    initialDataUpdatedAt: 0,
  });

  const saveExpense = useMutation({
    mutationFn: async (expense: Expense) => {
      await upsertExpenses(supabase!, [expense]);
      return expense;
    },
    onMutate: async (expense) => {
      await qc.cancelQueries({ queryKey: EXPENSES_QK });
      const prev = qc.getQueryData<Expense[]>(EXPENSES_QK);
      qc.setQueryData<Expense[]>(EXPENSES_QK, (old = []) => {
        const exists = old.some((e) => e.id === expense.id);
        return exists ? old.map((e) => (e.id === expense.id ? expense : e)) : [expense, ...old];
      });
      return { prev };
    },
    onError: (_err, _expense, ctx) => {
      if (ctx?.prev) qc.setQueryData(EXPENSES_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: EXPENSES_QK }),
  });

  const saveExpenses = useMutation({
    mutationFn: async (expenses: Expense[]) => {
      await upsertExpenses(supabase!, expenses);
      return expenses;
    },
    onMutate: async (expenses) => {
      await qc.cancelQueries({ queryKey: EXPENSES_QK });
      const prev = qc.getQueryData<Expense[]>(EXPENSES_QK);
      qc.setQueryData<Expense[]>(EXPENSES_QK, (old = []) => {
        const incomingIds = new Set(expenses.map((e) => e.id));
        const kept = old.filter((e) => !incomingIds.has(e.id));
        return [...expenses, ...kept];
      });
      return { prev };
    },
    onError: (_err, _expenses, ctx) => {
      if (ctx?.prev) qc.setQueryData(EXPENSES_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: EXPENSES_QK }),
  });

  return {
    expenses: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    saveExpense: saveExpense.mutateAsync,   // save a single expense
    saveExpenses: saveExpenses.mutateAsync, // save many at once
  };
}

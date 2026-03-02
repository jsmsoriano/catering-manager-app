'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchCustomerPayments, upsertCustomerPayments } from '@/lib/db/customerPayments';
import { loadFromStorage } from '@/lib/storage';
import type { CustomerPaymentRecord } from '@/lib/financeTypes';

export const CUSTOMER_PAYMENTS_QK = ['customerPayments'] as const;

export function useCustomerPaymentsQuery() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: CUSTOMER_PAYMENTS_QK,
    queryFn: () => fetchCustomerPayments(supabase!),
    enabled: !!supabase,
    initialData: () => loadFromStorage<CustomerPaymentRecord[]>('customerPayments', []),
    initialDataUpdatedAt: 0,
  });

  const savePayment = useMutation({
    mutationFn: async (payment: CustomerPaymentRecord) => {
      await upsertCustomerPayments(supabase!, [payment]);
      return payment;
    },
    onMutate: async (payment) => {
      await qc.cancelQueries({ queryKey: CUSTOMER_PAYMENTS_QK });
      const prev = qc.getQueryData<CustomerPaymentRecord[]>(CUSTOMER_PAYMENTS_QK);
      qc.setQueryData<CustomerPaymentRecord[]>(CUSTOMER_PAYMENTS_QK, (old = []) => {
        const exists = old.some((p) => p.id === payment.id);
        return exists
          ? old.map((p) => (p.id === payment.id ? payment : p))
          : [payment, ...old];
      });
      return { prev };
    },
    onError: (_err, _payment, ctx) => {
      if (ctx?.prev) qc.setQueryData(CUSTOMER_PAYMENTS_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CUSTOMER_PAYMENTS_QK }),
  });

  const savePayments = useMutation({
    mutationFn: async (payments: CustomerPaymentRecord[]) => {
      await upsertCustomerPayments(supabase!, payments);
      return payments;
    },
    onMutate: async (payments) => {
      await qc.cancelQueries({ queryKey: CUSTOMER_PAYMENTS_QK });
      const prev = qc.getQueryData<CustomerPaymentRecord[]>(CUSTOMER_PAYMENTS_QK);
      qc.setQueryData<CustomerPaymentRecord[]>(CUSTOMER_PAYMENTS_QK, (old = []) => {
        const incomingIds = new Set(payments.map((p) => p.id));
        const kept = old.filter((p) => !incomingIds.has(p.id));
        return [...payments, ...kept];
      });
      return { prev };
    },
    onError: (_err, _payments, ctx) => {
      if (ctx?.prev) qc.setQueryData(CUSTOMER_PAYMENTS_QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CUSTOMER_PAYMENTS_QK }),
  });

  return {
    customerPayments: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    savePayment: savePayment.mutateAsync,   // save a single payment
    savePayments: savePayments.mutateAsync, // save many at once
  };
}

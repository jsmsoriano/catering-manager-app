'use client';

/**
 * useOrganization — fetches the current user's organization membership.
 *
 * Returns the organization the user belongs to and their role within it.
 * For the common case (single org per user), returns the first membership found.
 *
 * Used by DB layer hooks to scope queries by organization_id.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface OrgMembership {
  organizationId: string;
  organizationName: string;
  slug: string;
  productProfile: 'hibachi_private' | 'hibachi_buffet' | 'catering_pro';
  role: 'owner' | 'manager' | 'staff';
  staffId: string | null;
}

export const ORG_QK = ['organization'] as const;

export function useOrganization(): {
  membership: OrgMembership | null;
  organizationId: string | null;
  isOwner: boolean;
  isLoading: boolean;
  error: Error | null;
} {
  const supabase = useMemo(() => createClient(), []);

  const query = useQuery({
    queryKey: ORG_QK,
    queryFn: async (): Promise<OrgMembership | null> => {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('org_members')
        .select(`
          role,
          staff_id,
          organizations (
            id,
            name,
            slug,
            product_profile
          )
        `)
        .limit(1)
        .single();

      if (error || !data) return null;

      const orgs = data.organizations as unknown as {
        id: string;
        name: string;
        slug: string;
        product_profile: string;
      }[] | null;
      const org = Array.isArray(orgs) ? (orgs[0] ?? null) : (orgs ?? null);

      if (!org) return null;

      return {
        organizationId: org.id,
        organizationName: org.name,
        slug: org.slug,
        productProfile: org.product_profile as OrgMembership['productProfile'],
        role: data.role as OrgMembership['role'],
        staffId: data.staff_id ?? null,
      };
    },
    staleTime: 5 * 60_000, // org membership changes rarely
    retry: 1,
  });

  const membership = query.data ?? null;

  return {
    membership,
    organizationId: membership?.organizationId ?? null,
    isOwner: membership?.role === 'owner',
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

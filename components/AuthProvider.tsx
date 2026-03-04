'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { initSync } from '@/lib/db/sync';
import { isAdminUser } from '@/lib/auth/admin';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  syncErrors: string[];
  dismissSyncErrors: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function dismissSyncErrors() {
    setSyncErrors([]);
  }

  // One-time localStorage→Supabase migration — runs once after auth resolves.
  // React Query hooks (useBookingsQuery, etc.) own the live read/write path.
  useEffect(() => {
    if (!supabase || loading) return;
    // In BYPASS_AUTH mode or any unauthenticated state, skip DB sync.
    // This prevents noisy RLS errors while running local-only workflows.
    if (!user) {
      setSyncErrors([]);
      return;
    }
    initSync(supabase)
      .then((failed) => {
        if (failed.length > 0) setSyncErrors(failed);
      })
      .catch((err) => {
        console.error('[sync] initSync threw:', err);
        setSyncErrors(['data sync']);
      });
  }, [supabase, loading, user]);

  const isAdmin = isAdminUser(user);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signOut, syncErrors, dismissSyncErrors }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import 'server-only';

import type { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { createClient } from './server';

export async function requireUser(redirectTo = '/login'): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(redirectTo);
  }

  return user;
}

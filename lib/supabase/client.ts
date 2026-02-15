'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/supabase';

import { getSupabasePublicEnv } from './public-env';

let client: SupabaseClient<Database> | undefined;

export function createClient(): SupabaseClient<Database> {
  if (client) {
    return client;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv();
  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}

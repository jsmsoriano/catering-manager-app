import 'server-only';

import { getSupabasePublicEnv } from './public-env';

const SUPABASE_SERVICE_ROLE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseServerEnv() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv();
  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey: requireServerEnv(SUPABASE_SERVICE_ROLE_KEY),
  };
}

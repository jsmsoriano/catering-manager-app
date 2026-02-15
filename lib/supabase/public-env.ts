const SUPABASE_URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabasePublicEnv() {
  return {
    supabaseUrl: requireEnv(SUPABASE_URL_KEY),
    supabaseAnonKey: requireEnv(SUPABASE_ANON_KEY),
  };
}

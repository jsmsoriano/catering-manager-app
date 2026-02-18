import { createClient } from '@/lib/supabase/server';

const TABLES_TO_CHECK = [
  'money_rules',
  'menu_items',
  'staff',
  'bookings',
  'event_menus',
  'shopping_lists',
  'expenses',
  'reconciliations',
  'labor_payments',
  'customer_payments',
  'owner_profit_payouts',
  'retained_earnings_transactions',
  'profit_distribution_overrides',
] as const;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return Response.json(
      {
        ok: false,
        error: 'Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)',
      },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    if (!supabase) {
      return Response.json(
        { ok: false, error: 'Supabase client not available' },
        { status: 503 }
      );
    }
    const results: Record<string, { exists: boolean; error?: string }> = {};

    for (const table of TABLES_TO_CHECK) {
      const { error } = await supabase.from(table).select('*').limit(0);
      results[table] = {
        exists: !error,
        ...(error && { error: error.message }),
      };
    }

    const allExist = TABLES_TO_CHECK.every((t) => results[t].exists);
    return Response.json({
      ok: true,
      message: allExist
        ? 'Database schema is present; all tables accessible.'
        : 'Some tables are missing or not accessible. Run the migration SQL in Supabase Dashboard.',
      tables: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json(
      { ok: false, error: message },
      { status: 503 }
    );
  }
}

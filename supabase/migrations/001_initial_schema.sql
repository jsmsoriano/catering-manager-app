-- Catering Manager App – initial schema for Supabase
-- Run this in Supabase Dashboard: SQL Editor → New query → paste → Run

-- money_rules: single row config (id = 'default')
CREATE TABLE IF NOT EXISTS money_rules (
  id TEXT PRIMARY KEY DEFAULT 'default',
  rules JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- menu_items: catalog (Supabase/Postgres 13+ has gen_random_uuid())
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_per_serving NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_per_serving NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  dietary_tags TEXT[] DEFAULT '{}',
  allergens TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- staff
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  profile_photo TEXT,
  profile_summary TEXT,
  primary_role TEXT NOT NULL,
  secondary_roles TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  is_owner BOOLEAN NOT NULL DEFAULT false,
  owner_role TEXT,
  weekly_availability JSONB NOT NULL DEFAULT '{}',
  weekly_availability_hours JSONB DEFAULT '{}',
  unavailable_dates TEXT[] DEFAULT '{}',
  hourly_rate NUMERIC(10,2),
  notes TEXT,
  hire_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- bookings (core table)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  adults INT NOT NULL DEFAULT 0,
  children INT NOT NULL DEFAULT 0,
  location TEXT DEFAULT '',
  distance_miles NUMERIC(6,2) NOT NULL DEFAULT 0,
  premium_add_on NUMERIC(8,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  gratuity NUMERIC(12,2) NOT NULL DEFAULT 0,
  distance_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  service_status TEXT,
  payment_status TEXT,
  deposit_percent NUMERIC(5,2),
  deposit_amount NUMERIC(12,2),
  deposit_due_date DATE,
  balance_due_date DATE,
  amount_paid NUMERIC(12,2),
  balance_due_amount NUMERIC(12,2),
  confirmed_at TIMESTAMPTZ,
  prep_purchase_by_date DATE,
  notes TEXT DEFAULT '',
  staff_assignments JSONB DEFAULT '[]',
  staffing_profile_id UUID,
  menu_id UUID,
  menu_pricing_snapshot JSONB,
  reconciliation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- event_menus
CREATE TABLE IF NOT EXISTS event_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  guest_selections JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- shopping_lists
CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  planned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchased_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  receipt_photo TEXT,
  notes TEXT,
  source TEXT,
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- reconciliations
CREATE TABLE IF NOT EXISTS reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  actual_labor_entries JSONB DEFAULT '[]',
  notes TEXT,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- labor_payments
CREATE TABLE IF NOT EXISTS labor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_time TEXT,
  customer_name TEXT,
  staff_id UUID,
  staff_name TEXT,
  staff_role TEXT,
  chef_role TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- customer_payments
CREATE TABLE IF NOT EXISTS customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  method TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- owner_profit_payouts
CREATE TABLE IF NOT EXISTS owner_profit_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_role TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payout_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- retained_earnings_transactions
CREATE TABLE IF NOT EXISTS retained_earnings_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- profit_distribution_overrides
CREATE TABLE IF NOT EXISTS profit_distribution_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  chef_payouts JSONB DEFAULT '[]',
  owner_a_payout NUMERIC(12,2),
  owner_b_payout NUMERIC(12,2),
  retained_earnings NUMERIC(12,2),
  distribution_status TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 1: allow anon access (no RLS or permissive policy)
ALTER TABLE money_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_profit_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE retained_earnings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_distribution_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON money_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON event_menus FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shopping_lists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON reconciliations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON labor_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON customer_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON owner_profit_payouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON retained_earnings_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON profit_distribution_overrides FOR ALL USING (true) WITH CHECK (true);

-- Seed default money_rules row so app can read
INSERT INTO money_rules (id, rules, updated_at)
VALUES ('default', '{}', NOW())
ON CONFLICT (id) DO NOTHING;

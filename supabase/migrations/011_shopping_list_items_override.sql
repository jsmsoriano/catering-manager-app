-- Shopping list items: optional normalized table + override columns
-- App may keep using shopping_lists.items JSONB; this table supports Supabase-backed flows.
-- Each item row: calculated_qty (from menu), override_qty (user), final_qty = COALESCE(override_qty, calculated_qty, qty).

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'food',
  unit TEXT NOT NULL DEFAULT 'lb',
  qty NUMERIC(12,4) NOT NULL DEFAULT 1,
  calculated_qty NUMERIC(12,4),
  override_qty NUMERIC(12,4),
  final_qty NUMERIC(12,4) GENERATED ALWAYS AS (COALESCE(override_qty, calculated_qty, qty)) STORED,
  is_generated BOOLEAN NOT NULL DEFAULT false,
  is_overridden BOOLEAN NOT NULL DEFAULT false,
  source TEXT,
  unit_cost NUMERIC(12,4),
  purchased BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shopping_list_items_source_check CHECK (source IS NULL OR source IN ('menu', 'manual'))
);

COMMENT ON COLUMN shopping_list_items.calculated_qty IS 'Generated from menu; do not edit manually for menu items.';
COMMENT ON COLUMN shopping_list_items.override_qty IS 'User override; when set, final_qty uses this.';
COMMENT ON COLUMN shopping_list_items.source IS 'menu = from Generate From Menu; manual = user-added.';

CREATE INDEX IF NOT EXISTS shopping_list_items_shopping_list_id_idx ON shopping_list_items (shopping_list_id);

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON shopping_list_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 016_fix_shopping_list_items_rls.sql
-- Fix migration 011's overly-permissive RLS policy on shopping_list_items.
--
-- Problem: migration 011 created a single "Allow all for anon" policy that
-- grants unauthenticated users full CRUD on the table — contradicting the
-- app-wide pattern set in migration 008 where anon access is tightly scoped.
-- shopping_list_items is an internal operations table; anon users have no
-- legitimate reason to read or write it.
--
-- Fix: Drop the blanket policy and replace with authenticated-only access,
-- matching the pattern used for every other internal table in migration 008.
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for anon" ON shopping_list_items;

CREATE POLICY "Authenticated full access" ON shopping_list_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

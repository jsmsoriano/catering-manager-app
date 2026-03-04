-- ============================================================================
-- CLEAR ALL EVENTS — Catering Manager App
-- ============================================================================
-- PURPOSE  : Delete ALL bookings and every related row, resetting the app
--            to a clean slate.
--
-- PRESERVED (not touched):
--   • menu_items                      (your menu catalog)
--   • staff                           (your staff roster)
--   • money_rules                     (your financial settings)
--   • owner_profit_payouts            (historical payout records)
--   • retained_earnings_transactions  (historical earnings records)
--   • expenses with no booking_id     (general overhead expenses)
--
-- DELETED:
--   • bookings
--   • proposal_tokens
--   • customer_payments               (CASCADE from bookings)
--   • event_menus                     (CASCADE from bookings)
--   • shopping_lists                  (CASCADE from bookings)
--   • shopping_list_items             (CASCADE from shopping_lists)
--   • labor_payments                  (CASCADE from bookings)
--   • reconciliations                 (CASCADE from bookings)
--   • profit_distribution_overrides   (CASCADE from bookings)
--   • expenses WHERE booking_id IS NOT NULL (event-specific expenses)
--
-- ============================================================================
-- SAFETY GUARDS
-- ============================================================================
-- 1. You must type the confirmation phrase EXACTLY inside the quotes below.
-- 2. Row counts are printed before anything is deleted — read them.
-- 3. Everything runs inside one transaction. Any error = full rollback.
-- 4. After reviewing the NOTICE output, scroll down to verify 0 rows remain.
-- ============================================================================

DO $$
DECLARE
  -- ─── STEP 1: Set this to 'DELETE ALL EVENTS' to allow execution ───────────
  --            Leave it blank (default) to abort safely.
  confirm_phrase TEXT := '';

  -- ─── Row counts ────────────────────────────────────────────────────────────
  cnt_bookings        INT;
  cnt_tokens          INT;
  cnt_payments        INT;
  cnt_event_menus     INT;
  cnt_shop_lists      INT;
  cnt_shop_items      INT;
  cnt_labor           INT;
  cnt_recon           INT;
  cnt_profit_dist     INT;
  cnt_expenses        INT;

BEGIN

  -- ─── Guard: abort unless phrase matches exactly ────────────────────────────
  IF confirm_phrase IS DISTINCT FROM 'DELETE ALL EVENTS' THEN
    RAISE EXCEPTION
      E'\n\n'
      '  ╔══════════════════════════════════════════════════════╗\n'
      '  ║                     A B O R T E D                    ║\n'
      '  ╠══════════════════════════════════════════════════════╣\n'
      '  ║  Nothing was deleted.                                ║\n'
      '  ║                                                      ║\n'
      '  ║  To proceed, change line 45 to:                      ║\n'
      '  ║    confirm_phrase TEXT := ''DELETE ALL EVENTS'';      ║\n'
      '  ╚══════════════════════════════════════════════════════╝';
  END IF;

  -- ─── Count rows that will be affected ─────────────────────────────────────
  SELECT COUNT(*) INTO cnt_bookings    FROM bookings;
  SELECT COUNT(*) INTO cnt_tokens      FROM proposal_tokens;
  SELECT COUNT(*) INTO cnt_payments    FROM customer_payments;
  SELECT COUNT(*) INTO cnt_event_menus FROM event_menus;
  SELECT COUNT(*) INTO cnt_shop_lists  FROM shopping_lists;
  SELECT COUNT(*) INTO cnt_shop_items  FROM shopping_list_items;
  SELECT COUNT(*) INTO cnt_labor       FROM labor_payments;
  SELECT COUNT(*) INTO cnt_recon       FROM reconciliations;
  SELECT COUNT(*) INTO cnt_profit_dist FROM profit_distribution_overrides;
  SELECT COUNT(*) INTO cnt_expenses    FROM expenses WHERE booking_id IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '=== ROWS ABOUT TO BE DELETED ===';
  RAISE NOTICE '  bookings                       : %', cnt_bookings;
  RAISE NOTICE '  proposal_tokens                : %', cnt_tokens;
  RAISE NOTICE '  customer_payments              : %', cnt_payments;
  RAISE NOTICE '  event_menus                    : %', cnt_event_menus;
  RAISE NOTICE '  shopping_lists                 : %', cnt_shop_lists;
  RAISE NOTICE '  shopping_list_items            : %', cnt_shop_items;
  RAISE NOTICE '  labor_payments                 : %', cnt_labor;
  RAISE NOTICE '  reconciliations                : %', cnt_recon;
  RAISE NOTICE '  profit_distribution_overrides  : %', cnt_profit_dist;
  RAISE NOTICE '  expenses (event-linked only)   : %', cnt_expenses;
  RAISE NOTICE '=================================';
  RAISE NOTICE '';
  RAISE NOTICE 'PRESERVED: menu_items, staff, money_rules,';
  RAISE NOTICE '           owner_profit_payouts, retained_earnings_transactions,';
  RAISE NOTICE '           expenses with no booking (general overhead)';
  RAISE NOTICE '';

  -- ─── Safety: bail out if there is nothing to delete ───────────────────────
  IF cnt_bookings = 0 AND cnt_tokens = 0 THEN
    RAISE NOTICE 'Nothing to delete — database is already empty.';
    RETURN;
  END IF;

  -- ─── Delete in safe dependency order ──────────────────────────────────────

  -- 1. proposal_tokens — no FK, must be deleted manually
  DELETE FROM proposal_tokens;

  -- 2. Event-specific expenses — delete before bookings (SET NULL FK would
  --    orphan them; we want them gone entirely)
  DELETE FROM expenses WHERE booking_id IS NOT NULL;

  -- 3. Deleting bookings cascades automatically to:
  --      customer_payments, event_menus, shopping_lists → shopping_list_items,
  --      reconciliations, labor_payments, profit_distribution_overrides
  DELETE FROM bookings;

  -- ─── Done ─────────────────────────────────────────────────────────────────
  RAISE NOTICE '✓ All event data deleted successfully.';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Clear localStorage in the browser (DevTools → Application → Storage → Clear site data)';
  RAISE NOTICE '  2. Reload the app — you should see 0 bookings.';

END $$;

-- ─── Verification query (run separately after the DO block) ──────────────────
-- Uncomment and run this after the script above to confirm everything is gone:
--
-- SELECT
--   (SELECT COUNT(*) FROM bookings)                       AS bookings,
--   (SELECT COUNT(*) FROM proposal_tokens)                AS proposal_tokens,
--   (SELECT COUNT(*) FROM customer_payments)              AS customer_payments,
--   (SELECT COUNT(*) FROM event_menus)                    AS event_menus,
--   (SELECT COUNT(*) FROM shopping_lists)                 AS shopping_lists,
--   (SELECT COUNT(*) FROM shopping_list_items)            AS shopping_list_items,
--   (SELECT COUNT(*) FROM labor_payments)                 AS labor_payments,
--   (SELECT COUNT(*) FROM reconciliations)                AS reconciliations,
--   (SELECT COUNT(*) FROM profit_distribution_overrides)  AS profit_overrides,
--   (SELECT COUNT(*) FROM expenses WHERE booking_id IS NOT NULL) AS event_expenses;

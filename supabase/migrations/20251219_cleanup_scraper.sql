-- ==============================================================================
-- CLEANUP SCRIPT: Remove intrusive 'Bank Scraper' tables
-- ==============================================================================

-- 1. Drop Intrusive Tables
DROP TABLE IF EXISTS public.promotions CASCADE;
DROP TABLE IF EXISTS public.banks CASCADE;
DROP TABLE IF EXISTS public.stores CASCADE;

-- 2. Drop Intrusive Function
DROP FUNCTION IF EXISTS public.sync_bank_promotions(text, jsonb);

-- 3. Verify System Health (Optional - Just checks core tables exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products') THEN
      RAISE WARNING '⚠️ Table product is MISSING! Please contact support.';
  ELSE
      RAISE NOTICE '✅ Table products exists.';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales') THEN
      RAISE WARNING '⚠️ Table sales is MISSING!';
  ELSE
      RAISE NOTICE '✅ Table sales exists.';
  END IF;
END $$;

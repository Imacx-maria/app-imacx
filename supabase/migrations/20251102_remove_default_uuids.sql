-- Migration: Remove gen_random_uuid() DEFAULT from FK Columns
-- Date: 2025-11-02
-- Purpose: Fix root cause of FK constraint violations
-- Issue: DEFAULT gen_random_uuid() generates invalid UUIDs that don't exist in armazens table

-- Root Cause:
-- When INSERT statements don't specify id_local_recolha or id_local_entrega,
-- PostgreSQL uses DEFAULT gen_random_uuid() which creates random UUIDs that
-- don't exist in the armazens table, causing FK constraint violations.

-- Solution:
-- Remove the DEFAULT values. When columns are not specified, PostgreSQL will
-- use NULL instead, which is allowed by FK constraints.

BEGIN;

-- Report current state
DO $$
DECLARE
    v_recolha_default text;
    v_entrega_default text;
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'REMOVING DEFAULT gen_random_uuid() VALUES';
    RAISE NOTICE '==========================================';

    SELECT column_default INTO v_recolha_default
    FROM information_schema.columns
    WHERE table_name = 'logistica_entregas'
    AND column_name = 'id_local_recolha';

    SELECT column_default INTO v_entrega_default
    FROM information_schema.columns
    WHERE table_name = 'logistica_entregas'
    AND column_name = 'id_local_entrega';

    RAISE NOTICE 'Current DEFAULT values:';
    RAISE NOTICE '  id_local_recolha: %', COALESCE(v_recolha_default, 'NULL');
    RAISE NOTICE '  id_local_entrega: %', COALESCE(v_entrega_default, 'NULL');
    RAISE NOTICE '';
END $$;

-- Remove DEFAULT from id_local_recolha
ALTER TABLE logistica_entregas
ALTER COLUMN id_local_recolha DROP DEFAULT;

-- Remove DEFAULT from id_local_entrega
ALTER TABLE logistica_entregas
ALTER COLUMN id_local_entrega DROP DEFAULT;

-- Verify removal
DO $$
DECLARE
    v_recolha_default text;
    v_entrega_default text;
BEGIN
    SELECT column_default INTO v_recolha_default
    FROM information_schema.columns
    WHERE table_name = 'logistica_entregas'
    AND column_name = 'id_local_recolha';

    SELECT column_default INTO v_entrega_default
    FROM information_schema.columns
    WHERE table_name = 'logistica_entregas'
    AND column_name = 'id_local_entrega';

    RAISE NOTICE '==========================================';
    RAISE NOTICE 'VERIFICATION';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'New DEFAULT values:';
    RAISE NOTICE '  id_local_recolha: %', COALESCE(v_recolha_default, 'NULL');
    RAISE NOTICE '  id_local_entrega: %', COALESCE(v_entrega_default, 'NULL');
    RAISE NOTICE '';

    IF v_recolha_default IS NULL AND v_entrega_default IS NULL THEN
        RAISE NOTICE '✅ SUCCESS: DEFAULT values removed';
        RAISE NOTICE '';
        RAISE NOTICE 'Result:';
        RAISE NOTICE '  When INSERT does not specify these columns:';
        RAISE NOTICE '  - OLD behavior: gen_random_uuid() creates invalid UUID → FK error';
        RAISE NOTICE '  - NEW behavior: NULL inserted → FK allows NULL → Success!';
    ELSE
        RAISE EXCEPTION 'FAILED: DEFAULT values still exist: recolha=%, entrega=%',
            v_recolha_default, v_entrega_default;
    END IF;
END $$;

COMMIT;

-- After this migration:
-- 1. INSERT without specifying id_local_recolha/id_local_entrega → Uses NULL
-- 2. NULL values are allowed by FK constraints
-- 3. No more "gen_random_uuid() creates invalid UUID" errors
-- 4. Users can select valid armazens via UI dropdowns later

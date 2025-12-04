-- Migration: Fix Function Search Path (Version 2)
-- Date: 2025-01-20
-- Purpose: Set search_path for all functions using pg_proc.proconfig
-- 
-- PostgreSQL stores function configuration (including search_path) in pg_proc.proconfig
-- This migration uses ALTER FUNCTION ... SET to update the search_path directly

-- ============================================================================
-- Fix functions by setting search_path via proconfig
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    search_path_setting TEXT;
    func_signature TEXT;
    fixed_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting function search_path fix...';
    
    -- Loop through all functions in public schema
    FOR func_record IN
        SELECT 
            p.proname as func_name,
            pg_get_function_identity_arguments(p.oid) as func_args,
            p.oid as func_oid,
            p.proconfig as current_config
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'  -- Only regular functions
          AND p.proname NOT LIKE 'pg_%'  -- Skip PostgreSQL internal functions
          AND p.proname NOT LIKE 'gtrgm%'  -- Skip pg_trgm extension functions
          AND p.proname NOT IN ('show_limit', 'set_limit', 'show_trgm', 'similarity', 
                                'word_similarity', 'strict_word_similarity')
        ORDER BY p.proname
    LOOP
        BEGIN
            -- Check if search_path is already set in proconfig
            IF func_record.current_config IS NOT NULL THEN
                IF EXISTS (
                    SELECT 1 FROM unnest(func_record.current_config) AS config_item
                    WHERE config_item LIKE 'search_path=%'
                ) THEN
                    -- Already has search_path, skip
                    CONTINUE;
                END IF;
            END IF;
            
            -- Determine search_path based on function name patterns
            -- Functions that access phc schema
            IF func_record.func_name LIKE '%cost_center%'
               OR func_record.func_name LIKE '%department%'
               OR func_record.func_name LIKE '%salesperson%'
               OR func_record.func_name LIKE '%invoice%'
               OR func_record.func_name LIKE '%quote%'
               OR func_record.func_name LIKE '%customer%'
               OR func_record.func_name LIKE '%status_hunter%'
               OR func_record.func_name LIKE '%get_bi%'
               OR func_record.func_name LIKE '%get_fi%'
               OR func_record.func_name LIKE '%get_ft%'
               OR func_record.func_name LIKE '%search_quotes%'
               OR func_record.func_name LIKE '%is_quote%'
               OR func_record.func_name LIKE '%get_customers%'
               OR func_record.func_name LIKE '%get_quotes%'
               OR func_record.func_name LIKE '%calculate_ytd%'
               OR func_record.func_name LIKE '%calculate_quotes%'
               OR func_record.func_name LIKE '%calculate_kpis%'
               OR func_record.func_name LIKE '%get_kpis%'
            THEN
                search_path_setting := 'public, phc';
            ELSE
                -- Default to public only for other functions
                search_path_setting := 'public';
            END IF;
            
            -- Build function signature for ALTER FUNCTION
            func_signature := 'public.' || quote_ident(func_record.func_name) || '(' || func_record.func_args || ')';
            
            -- Use ALTER FUNCTION to set search_path
            -- Note: This sets it in proconfig, which is what PostgreSQL uses
            EXECUTE format('ALTER FUNCTION %s SET search_path = %s', 
                func_signature, 
                quote_literal(search_path_setting));
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Fixed search_path for function: %(%)', func_record.func_name, func_record.func_args;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING 'Could not fix function %(%): %', func_record.func_name, func_record.func_args, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '=== Summary ===';
    RAISE NOTICE 'Functions fixed: %', fixed_count;
    RAISE NOTICE 'Functions with errors: %', error_count;
END $$;

-- ============================================================================
-- Verification: Check which functions still don't have search_path set
-- ============================================================================

DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname NOT LIKE 'pg_%'
      AND p.proname NOT LIKE 'gtrgm%'
      AND p.proname NOT IN ('show_limit', 'set_limit', 'show_trgm', 'similarity', 
                            'word_similarity', 'strict_word_similarity')
      AND (
          p.proconfig IS NULL 
          OR NOT EXISTS (
              SELECT 1 FROM unnest(p.proconfig) AS config_item
              WHERE config_item LIKE 'search_path=%'
          )
      );
    
    RAISE NOTICE 'Functions without search_path after migration: %', func_count;
    
    IF func_count > 0 THEN
        RAISE WARNING 'Some functions still need fixing. Count: %', func_count;
    END IF;
END $$;


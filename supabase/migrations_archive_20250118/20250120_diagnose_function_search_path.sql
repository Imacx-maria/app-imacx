-- Diagnostic migration: Check function definitions and search_path status
-- This will help us understand why the automatic fix isn't working

DO $$
DECLARE
    func_record RECORD;
    func_def TEXT;
    has_search_path BOOLEAN;
    func_count INTEGER := 0;
    fixed_count INTEGER := 0;
    missing_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Diagnosing function search_path issues ===';
    
    -- Check a few specific functions from the warning list
    FOR func_record IN
        SELECT 
            p.proname as func_name,
            pg_get_function_identity_arguments(p.oid) as func_args,
            p.oid as func_oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND p.proname IN (
              'update_fo_planos_updated_at',
              'get_cost_center_monthly',
              'fifo_deduct_stock_on_operation',
              'status_hunter_search_fo',
              'search_quotes_by_embedding'
          )
        ORDER BY p.proname
        LIMIT 5
    LOOP
        func_count := func_count + 1;
        
        BEGIN
            func_def := pg_get_functiondef(func_record.func_oid);
            
            IF func_def IS NULL THEN
                RAISE WARNING 'Could not get definition for %(%)', func_record.func_name, func_record.func_args;
                CONTINUE;
            END IF;
            
            -- Check if search_path is set (case insensitive)
            has_search_path := func_def ~* 'SET\s+search_path';
            
            IF has_search_path THEN
                fixed_count := fixed_count + 1;
                RAISE NOTICE '✓ %(%) HAS search_path set', func_record.func_name, func_record.func_args;
            ELSE
                missing_count := missing_count + 1;
                RAISE WARNING '✗ %(%) MISSING search_path', func_record.func_name, func_record.func_args;
                
                -- Show the relevant part of the definition (around LANGUAGE/AS)
                RAISE NOTICE 'Function definition snippet (around LANGUAGE/AS):';
                RAISE NOTICE '%', substring(
                    regexp_replace(func_def, E'[\\n\\r]+', ' ', 'g'),
                    position('LANGUAGE' in upper(func_def)) - 50,
                    200
                );
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error checking %(%): %', func_record.func_name, func_record.func_args, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '=== Summary ===';
    RAISE NOTICE 'Functions checked: %', func_count;
    RAISE NOTICE 'Functions with search_path: %', fixed_count;
    RAISE NOTICE 'Functions missing search_path: %', missing_count;
    
    -- Now check total count of functions without search_path
    SELECT COUNT(*) INTO missing_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname NOT LIKE 'pg_%'
      AND p.proname NOT LIKE 'gtrgm%'
      AND p.proname NOT IN ('show_limit', 'set_limit', 'show_trgm', 'similarity', 
                            'word_similarity', 'strict_word_similarity')
      AND pg_get_functiondef(p.oid) !~* 'SET\s+search_path';
    
    RAISE NOTICE 'Total functions in public schema missing search_path: %', missing_count;
END $$;


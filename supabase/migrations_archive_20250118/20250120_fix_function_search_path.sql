-- Migration: Fix Function Search Path
-- Date: 2025-01-20
-- Purpose: Set search_path for all functions to prevent search path injection attacks
-- 
-- According to Supabase best practices, functions should have search_path set.
-- PostgreSQL doesn't support ALTER FUNCTION to change search_path, so we need to
-- recreate functions. This migration uses pg_get_functiondef to get function definitions
-- and recreates them with SET search_path added.

-- ============================================================================
-- Programmatically fix all functions without search_path
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    func_def TEXT;
    new_def TEXT;
    search_path_setting TEXT;
    func_signature TEXT;
BEGIN
    -- Loop through all functions in public schema
    FOR func_record IN
        SELECT 
            p.proname as func_name,
            pg_get_function_identity_arguments(p.oid) as func_args,
            p.oid as func_oid,
            pg_get_function_result(p.oid) as func_returns
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'  -- Only regular functions, not aggregates/window functions
          AND p.proname NOT LIKE 'pg_%'  -- Skip PostgreSQL internal functions
          AND p.proname NOT LIKE 'gtrgm%'  -- Skip pg_trgm extension functions
          AND p.proname NOT IN ('show_limit', 'set_limit', 'show_trgm', 'similarity', 
                                'word_similarity', 'strict_word_similarity', 'set_limit')
        ORDER BY p.proname
    LOOP
        BEGIN
            -- Get the function definition
            func_def := pg_get_functiondef(func_record.func_oid);
            
            -- Skip if function definition couldn't be retrieved
            IF func_def IS NULL THEN
                CONTINUE;
            END IF;
            
            -- Skip if already has search_path set
            IF func_def ~* 'SET\s+search_path' THEN
                CONTINUE;
            END IF;
            
            -- Determine search_path based on function name patterns and body content
            -- Functions that access phc schema (check function body for phc references)
            IF func_def ~* 'phc\.' 
               OR func_record.func_name LIKE '%cost_center%'
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
            
            -- Modify function definition to add SET search_path
            -- SET search_path must come before AS $$ or AS $function$
            -- Insert right before AS, after any LANGUAGE/SECURITY/STABLE/etc clauses
            
            -- Find the position of AS (with $$ or $function$)
            -- Insert SET search_path right before it
            -- This handles all cases: LANGUAGE ... AS, SECURITY DEFINER ... AS, STABLE ... AS, etc.
            
            -- Pattern: Insert SET search_path before AS $$ or AS $function$
            new_def := regexp_replace(
                func_def,
                '(\s+)(AS\s+\$\$|AS\s+\$function\$)',
                '\1SET search_path = ''' || search_path_setting || '''\2',
                'gi'
            );
            
            -- If that didn't work, try a more specific pattern
            IF new_def = func_def THEN
                -- Try to find any whitespace/newline before AS
                new_def := regexp_replace(
                    func_def,
                    '(\s+)(AS\s+)',
                    '\1SET search_path = ''' || search_path_setting || '''\2',
                    'gi'
                );
            END IF;
            
            -- If still no change, skip this function
            IF new_def = func_def THEN
                CONTINUE;
            END IF;
            
            -- Execute the modified function definition
            IF new_def != func_def AND new_def IS NOT NULL THEN
                BEGIN
                    EXECUTE new_def;
                    RAISE NOTICE 'Fixed search_path for function: %(%)', func_record.func_name, func_record.func_args;
                EXCEPTION WHEN OTHERS THEN
                    RAISE WARNING 'Error recreating function %(%): %. Definition length: %', 
                        func_record.func_name, func_record.func_args, SQLERRM, length(new_def);
                    -- Log first 500 chars of the definition for debugging
                    RAISE WARNING 'Function definition start: %', substring(new_def, 1, 500);
                END;
            ELSE
                RAISE WARNING 'Could not modify function definition for %(%). Original def length: %', 
                    func_record.func_name, func_record.func_args, length(func_def);
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not fix function %(%): %', func_record.func_name, func_record.func_args, SQLERRM;
        END;
    END LOOP;
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
      AND pg_get_functiondef(p.oid) !~* 'SET\s+search_path';
    
    RAISE NOTICE 'Functions without search_path after migration: %', func_count;
    
    IF func_count > 0 THEN
        RAISE WARNING 'Some functions still need manual fixing. Check the list above.';
    END IF;
END $$;

-- Note: Some functions may need manual fixing if the automatic process fails.
-- Check the PostgreSQL logs for any warnings about functions that couldn't be fixed.
-- To manually fix a function, use:
-- CREATE OR REPLACE FUNCTION function_name(...) 
-- ... 
-- SET search_path = 'public, phc'  -- or 'public' if it doesn't need phc
-- LANGUAGE plpgsql AS $$ ... $$;

-- Simple check: List all functions and their search_path status
-- This will help us see what's actually in the database

-- First, let's see if the functions exist at all
SELECT 
    'Function exists check' as check_type,
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
ORDER BY p.proname;

-- Now check if they have search_path
SELECT 
    'Search path check' as check_type,
    p.proname as func_name,
    pg_get_function_identity_arguments(p.oid) as func_args,
    CASE 
        WHEN pg_get_functiondef(p.oid) IS NULL THEN 'Cannot get definition'
        WHEN pg_get_functiondef(p.oid) ~* 'SET\s+search_path' THEN 'HAS search_path'
        ELSE 'MISSING search_path'
    END as search_path_status
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
ORDER BY p.proname;

-- Show actual function definition snippet for one function
SELECT 
    'Function definition' as check_type,
    p.proname as func_name,
    substring(
        pg_get_functiondef(p.oid),
        greatest(1, position('LANGUAGE' in upper(pg_get_functiondef(p.oid))) - 100),
        300
    ) as definition_snippet
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'update_fo_planos_updated_at'
LIMIT 1;


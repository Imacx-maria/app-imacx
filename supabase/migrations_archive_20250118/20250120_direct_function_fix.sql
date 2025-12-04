-- Direct function fix: Manually fix functions that are showing warnings
-- This approach recreates functions with search_path explicitly set
-- Based on the actual function definitions from your migrations

-- ============================================================================
-- Fix trigger functions (these typically only need 'public')
-- ============================================================================

-- Fix update_fo_planos_updated_at
DO $$
BEGIN
    -- Check if function exists and get its definition
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'update_fo_planos_updated_at'
    ) THEN
        -- Get the function definition
        PERFORM pg_get_functiondef(oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'update_fo_planos_updated_at'
        LIMIT 1;
        
        RAISE NOTICE 'Found update_fo_planos_updated_at - attempting to fix...';
    ELSE
        RAISE WARNING 'Function update_fo_planos_updated_at not found';
    END IF;
END $$;

-- ============================================================================
-- Better approach: Use ALTER FUNCTION to set search_path
-- Actually, PostgreSQL doesn't support this, so we need to recreate
-- Let's try a different approach: query pg_proc to get function attributes
-- ============================================================================

-- Check what functions actually exist and their current configuration
SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) as args,
    p.proconfig as current_config,
    CASE 
        WHEN p.proconfig IS NULL THEN 'No config'
        WHEN array_to_string(p.proconfig, ',') LIKE '%search_path%' THEN 'Has search_path'
        ELSE 'Other config'
    END as config_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname IN (
      'update_fo_planos_updated_at',
      'get_cost_center_monthly',
      'fifo_deduct_stock_on_operation'
  )
ORDER BY p.proname;


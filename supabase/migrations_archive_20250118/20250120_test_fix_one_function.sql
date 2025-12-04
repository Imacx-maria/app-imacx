-- Test migration: Fix one function to verify the approach works
-- This is a test to see if we can successfully add search_path to a function

-- Test with update_fo_planos_updated_at
-- First, let's see what the current definition looks like
DO $$
DECLARE
    func_def TEXT;
    func_oid OID;
BEGIN
    SELECT p.oid INTO func_oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'update_fo_planos_updated_at'
    LIMIT 1;
    
    IF func_oid IS NOT NULL THEN
        func_def := pg_get_functiondef(func_oid);
        RAISE NOTICE 'Current function definition (first 1000 chars): %', substring(func_def, 1, 1000);
        
        IF func_def ~* 'SET\s+search_path' THEN
            RAISE NOTICE 'Function already has search_path set!';
        ELSE
            RAISE NOTICE 'Function does NOT have search_path set. Need to add it.';
        END IF;
    ELSE
        RAISE WARNING 'Function update_fo_planos_updated_at not found';
    END IF;
END $$;


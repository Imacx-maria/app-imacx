-- =====================================================
-- CLEANUP: Remove conflicting pipeline function versions
-- =====================================================
-- Issue: Database has 3+ conflicting versions of get_department_pipeline_v2
-- Solution: Drop all v2 versions and use the canonical get_department_pipeline
--
-- Conflicting OIDs (from database):
-- - OID 248122: get_department_pipeline_v2(TEXT, DATE, DATE)
-- - OID 247526: get_department_pipeline_v2(TEXT, TEXT, TEXT)
-- - OID 245448: get_department_pipeline_v2(INTEGER)
--
-- The API endpoint calls: get_department_pipeline(TEXT, DATE, DATE)
-- NOT get_department_pipeline_v2, so v2 versions are safe to remove.
-- =====================================================

-- Drop all versions of get_department_pipeline_v2 (they are not used)
DROP FUNCTION IF EXISTS get_department_pipeline_v2(TEXT, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS get_department_pipeline_v2(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_department_pipeline_v2(INTEGER) CASCADE;

-- Verify the canonical function exists
-- This should be the ONLY pipeline function used by the API
-- File: app/api/gestao/departamentos/pipeline/route.ts
-- Call: supabase.rpc("get_department_pipeline", { ... })

COMMENT ON SCHEMA public IS
'Canonical pipeline function:
- get_department_pipeline(TEXT, DATE, DATE): The ONLY pipeline function used by API
  - Called from: app/api/gestao/departamentos/pipeline/route.ts
  - Parameters: (departamento_nome, start_date, end_date)
  - Returns: Pipeline quotes categorized by age for ANUAL view

Removed conflicting versions (v2 overloads) as they were never called by API.
If you see errors about missing v2 versions in old migrations, they can be ignored
as those are from development iterations and not part of production code paths.';

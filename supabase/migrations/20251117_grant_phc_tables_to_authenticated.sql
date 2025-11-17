-- =====================================================
-- GRANT PHC SCHEMA TABLE PERMISSIONS TO AUTHENTICATED ROLE
-- =====================================================
-- Issue: Department RPC functions fail with "permission denied for table"
-- Root Cause: authenticated role cannot access phc.* tables
-- Solution: Grant SELECT permissions on critical PHC tables
-- =====================================================

-- Grant schema usage
GRANT USAGE ON SCHEMA phc TO authenticated;

-- =====================================================
-- Grant SELECT on Current Year Tables (ft, bo, bi, fi, cl)
-- =====================================================
GRANT SELECT ON phc.ft TO authenticated;
GRANT SELECT ON phc.bo TO authenticated;
GRANT SELECT ON phc.bi TO authenticated;
GRANT SELECT ON phc.cl TO authenticated;
GRANT SELECT ON phc.fi TO authenticated;

-- =====================================================
-- Grant SELECT on Historical Tables (2years_ft, 2years_bo, 2years_fi)
-- =====================================================
GRANT SELECT ON phc."2years_ft" TO authenticated;
GRANT SELECT ON phc."2years_bo" TO authenticated;
GRANT SELECT ON phc."2years_fi" TO authenticated;

-- =====================================================
-- Verify grants applied
-- =====================================================
-- These queries can be run to verify the grants took effect:
-- SELECT * FROM information_schema.table_privileges
-- WHERE grantee = 'authenticated' AND table_schema = 'phc';

-- Grant permissions for 2years_ft and 2years_fi tables
-- These tables are used by the multi-year revenue API endpoint
-- The API needs direct access to these tables to fetch historical data

-- Grant SELECT on 2years_ft to service_role, authenticated, and anon
GRANT SELECT ON phc."2years_ft" TO service_role;
GRANT SELECT ON phc."2years_ft" TO authenticated;
GRANT SELECT ON phc."2years_ft" TO anon;

-- Grant SELECT on 2years_fi to service_role, authenticated, and anon
GRANT SELECT ON phc."2years_fi" TO service_role;
GRANT SELECT ON phc."2years_fi" TO authenticated;
GRANT SELECT ON phc."2years_fi" TO anon;

-- Add comments for documentation
COMMENT ON TABLE phc."2years_ft" IS 'Historical FT data: Last 2 complete years. Structure matches phc.ft table with anulado column.';
COMMENT ON TABLE phc."2years_fi" IS 'Historical FI data: Last 2 complete years. Structure matches phc.fi table.';

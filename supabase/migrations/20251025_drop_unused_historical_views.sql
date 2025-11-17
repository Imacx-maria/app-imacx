-- Drop unused historical views and tables
-- These are no longer needed as the analytics page now uses get_department_rankings_ytd() RPC function
-- which directly queries phc.ft, phc.bo, phc.2years_ft, and phc.2years_bo tables

-- Drop views
DROP VIEW IF EXISTS phc.v_ft_current_year_monthly_salesperson_norm CASCADE;
DROP VIEW IF EXISTS phc.v_bo_current_year_monthly_salesperson_norm CASCADE;
DROP VIEW IF EXISTS phc.ft_historical_monthly_salesperson CASCADE;
DROP VIEW IF EXISTS phc.bo_historical_monthly_salesperson CASCADE;

-- Drop tables
DROP TABLE IF EXISTS phc.ft_historical_monthly CASCADE;
DROP TABLE IF EXISTS phc.bo_historical_monthly CASCADE;

-- Note: We keep phc.2years_ft and phc.2years_bo as they are still actively used by the RPC function


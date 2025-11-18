-- Fix historical monthly views to properly map salesperson and department
-- These views now query 2years_bo and 2years_ft tables directly with joins
-- instead of just aliasing the simple aggregate tables

-- =====================================================
-- BO Historical Monthly with Salesperson/Department
-- =====================================================

DROP VIEW IF EXISTS phc.bo_historical_monthly_salesperson CASCADE;

CREATE VIEW phc.bo_historical_monthly_salesperson AS
WITH unm AS (
  SELECT
    department,
    LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(initials,''),         ' ','')), '[^a-z0-9]+', '', 'g')) AS k_initials,
    LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(short_name,''),       ' ','')), '[^a-z0-9]+', '', 'g')) AS k_short,
    LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(full_name,''),        ' ','')), '[^a-z0-9]+', '', 'g')) AS k_full,
    LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(standardized_name,''),' ','')), '[^a-z0-9]+', '', 'g')) AS k_std
  FROM public.user_name_mapping
  WHERE active = true AND sales = true
)
SELECT
  EXTRACT(YEAR  FROM b.document_date)::int AS year,
  EXTRACT(MONTH FROM b.document_date)::int AS month,
  b.document_type,
  COUNT(DISTINCT b.document_id)            AS document_count,
  SUM(COALESCE(b.total_value,0))           AS total_value,
  COALESCE(cl.salesperson, 'Unassigned')   AS salesperson,
  COALESCE(u.department, 'Unknown')        AS department
FROM phc."2years_bo" b
LEFT JOIN phc.cl cl ON cl.customer_id = b.customer_id
LEFT JOIN LATERAL (
  SELECT department
  FROM unm m
  WHERE LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(cl.salesperson,''),' ','')), '[^a-z0-9]+', '', 'g'))
        IN (m.k_initials, m.k_short, m.k_full, m.k_std)
  LIMIT 1
) u ON TRUE
GROUP BY 1,2,3,6,7;

GRANT SELECT ON phc.bo_historical_monthly_salesperson TO authenticated;
GRANT SELECT ON phc.bo_historical_monthly_salesperson TO anon;

COMMENT ON VIEW phc.bo_historical_monthly_salesperson IS 'Historical BO data by month with salesperson and department mapping. Queries 2years_bo table.';

-- =====================================================
-- FT Historical Monthly with Salesperson/Department
-- =====================================================

DROP VIEW IF EXISTS phc.ft_historical_monthly_salesperson CASCADE;

CREATE VIEW phc.ft_historical_monthly_salesperson AS
WITH unm AS (
  SELECT
    department,
    LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(initials,''),         ' ','')), '[^a-z0-9]+', '', 'g')) AS k_initials,
    LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(short_name,''),       ' ','')), '[^a-z0-9]+', '', 'g')) AS k_short,
    LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(full_name,''),        ' ','')), '[^a-z0-9]+', '', 'g')) AS k_full,
    LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(standardized_name,''),' ','')), '[^a-z0-9]+', '', 'g')) AS k_std
  FROM public.user_name_mapping
  WHERE active = true AND sales = true
)
SELECT
  EXTRACT(YEAR  FROM f.invoice_date)::int  AS year,
  EXTRACT(MONTH FROM f.invoice_date)::int  AS month,
  f.document_type,
  COUNT(DISTINCT f.invoice_id)             AS document_count,
  SUM(COALESCE(f.net_value,0))             AS total_value,
  COALESCE(cl.salesperson, 'Unassigned')   AS salesperson,
  COALESCE(u.department, 'Unknown')        AS department
FROM phc."2years_ft" f
LEFT JOIN phc.cl cl ON cl.customer_id = f.customer_id
LEFT JOIN LATERAL (
  SELECT department
  FROM unm m
  WHERE LOWER(REGEXP_REPLACE(TRIM(REPLACE(COALESCE(cl.salesperson,''),' ','')), '[^a-z0-9]+', '', 'g'))
        IN (m.k_initials, m.k_short, m.k_full, m.k_std)
  LIMIT 1
) u ON TRUE
WHERE COALESCE(f.anulado, '') != 'true'
GROUP BY 1,2,3,6,7;

GRANT SELECT ON phc.ft_historical_monthly_salesperson TO authenticated;
GRANT SELECT ON phc.ft_historical_monthly_salesperson TO anon;

COMMENT ON VIEW phc.ft_historical_monthly_salesperson IS 'Historical FT data by month with salesperson and department mapping. Queries 2years_ft table and excludes cancelled invoices.';


-- =====================================================
-- COMPANY-WIDE CONVERSION RATES BY ESCALÃO
-- =====================================================
-- Purpose: Get conversion rates aggregated across ALL departments
-- Based on: get_department_conversion_rates (20251220_final_fix_department_rpcs.sql)
-- Key Difference: Removes department filter + 4 JOINs for better performance
-- Performance: FASTER than department-filtered version (fewer joins, simpler plan)
-- =====================================================

DROP FUNCTION IF EXISTS get_company_conversion_rates(DATE, DATE);

CREATE OR REPLACE FUNCTION get_company_conversion_rates(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  value_bracket TEXT,
  quote_count BIGINT,
  invoice_count BIGINT,
  conversion_rate NUMERIC,
  total_quoted_value NUMERIC,
  total_invoiced_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH company_quotes AS (
    -- All quotes in period (no department filter)
    SELECT
      bo.document_id,
      bo.total_value,
      CASE
        WHEN bo.total_value < 1500 THEN '0-1500'
        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'
        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'
        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'
        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket_range
    FROM phc.bo bo
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
  ),
  converted_quotes AS (
    -- Quotes that converted to invoices (via BiStamp chain)
    -- Current year invoices
    SELECT DISTINCT
      bo.document_id,
      bo.total_value,
      CASE
        WHEN bo.total_value < 1500 THEN '0-1500'
        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'
        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'
        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'
        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket_range,
      fi.net_liquid_value as invoiced_value
    FROM phc.bo bo
    INNER JOIN phc.bi bi ON bo.document_id = bi.document_id
    INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
    INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND (ft.anulado IS NULL OR ft.anulado != 'True')

    UNION

    -- Historical (2years) invoices
    SELECT DISTINCT
      bo.document_id,
      bo.total_value,
      CASE
        WHEN bo.total_value < 1500 THEN '0-1500'
        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'
        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'
        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'
        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket_range,
      fi.net_liquid_value as invoiced_value
    FROM phc.bo bo
    INNER JOIN phc.bi bi ON bo.document_id = bi.document_id
    INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp
    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
  ),
  quote_stats AS (
    -- Aggregate quotes by bracket
    SELECT
      cq.bracket_range,
      COUNT(*) as quote_count,
      SUM(cq.total_value) as total_quoted_value
    FROM company_quotes cq
    GROUP BY cq.bracket_range
  ),
  conversion_stats AS (
    -- Aggregate converted quotes by bracket
    SELECT
      cvq.bracket_range,
      COUNT(DISTINCT cvq.document_id) as invoice_count,
      SUM(cvq.invoiced_value) as total_invoiced_value
    FROM converted_quotes cvq
    GROUP BY cvq.bracket_range
  )
  -- Final result: Join quote stats with conversion stats
  SELECT
    qs.bracket_range,
    qs.quote_count,
    COALESCE(cs.invoice_count, 0) as invoice_count,
    ROUND((COALESCE(cs.invoice_count, 0)::NUMERIC / NULLIF(qs.quote_count, 0) * 100), 2) as conversion_rate,
    ROUND(qs.total_quoted_value, 2) as total_quoted_value,
    ROUND(COALESCE(cs.total_invoiced_value, 0), 2) as total_invoiced_value
  FROM quote_stats qs
  LEFT JOIN conversion_stats cs ON qs.bracket_range = cs.bracket_range
  ORDER BY
    CASE qs.bracket_range
      WHEN '0-1500' THEN 1
      WHEN '1500-2500' THEN 2
      WHEN '2500-7500' THEN 3
      WHEN '7500-15000' THEN 4
      WHEN '15000-30000' THEN 5
      WHEN '30000+' THEN 6
    END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION get_company_conversion_rates TO authenticated;

-- =====================================================
-- TESTING QUERY (commented out)
-- =====================================================
-- Test YTD:
-- SELECT * FROM get_company_conversion_rates('2025-01-01', CURRENT_DATE);
--
-- Test MTD:
-- SELECT * FROM get_company_conversion_rates(
--   DATE_TRUNC('month', CURRENT_DATE)::DATE,
--   CURRENT_DATE
-- );

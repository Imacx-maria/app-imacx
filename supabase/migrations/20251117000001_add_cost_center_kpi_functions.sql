-- Migration: Add cost_center-aware KPI calculation functions
-- Purpose: Support filtering KPI dashboard by cost center (department)
-- Date: 2025-11-17

-- =====================================================================
-- 1. Cost Center KPI calculation (invoices/revenue)
-- =====================================================================
CREATE OR REPLACE FUNCTION calculate_kpis_by_cost_center(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'ft',
  filter_cost_center TEXT DEFAULT NULL
)
RETURNS TABLE(
  revenue NUMERIC,
  invoice_count BIGINT,
  customer_count BIGINT,
  avg_invoice_value NUMERIC
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  query_text TEXT;
BEGIN
  -- Validate source_table to prevent SQL injection
  IF source_table NOT IN ('ft', '2years_ft') THEN
    RAISE EXCEPTION 'Invalid source_table: %. Must be ft or 2years_ft', source_table;
  END IF;

  -- Build dynamic query with optional cost_center filter
  query_text := format(
    'SELECT
      COALESCE(SUM(etotal), 0)::NUMERIC as revenue,
      COUNT(DISTINCT fno)::BIGINT as invoice_count,
      COUNT(DISTINCT no)::BIGINT as customer_count,
      CASE
        WHEN COUNT(DISTINCT fno) > 0
        THEN (COALESCE(SUM(etotal), 0) / COUNT(DISTINCT fno))::NUMERIC
        ELSE 0
      END as avg_invoice_value
    FROM phc.%I
    WHERE fdata >= $1
      AND fdata <= $2
      AND anulado = false
      AND (etotal IS NOT NULL AND etotal <> 0)
      %s',
    source_table,
    CASE
      WHEN filter_cost_center IS NOT NULL
      THEN format('AND (cost_center = %L OR cost_center LIKE %L)',
                  filter_cost_center,
                  filter_cost_center || '%')
      ELSE ''
    END
  );

  RAISE NOTICE 'Executing query: %', query_text;

  RETURN QUERY EXECUTE query_text USING start_date, end_date;
END;
$$;

-- =====================================================================
-- 2. Cost Center Quotes calculation (orçamentos)
-- =====================================================================
CREATE OR REPLACE FUNCTION calculate_quotes_by_cost_center(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'bo',
  filter_cost_center TEXT DEFAULT NULL
)
RETURNS TABLE(
  quote_value NUMERIC,
  quote_count BIGINT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  query_text TEXT;
BEGIN
  -- Validate source_table to prevent SQL injection
  IF source_table NOT IN ('bo', '2years_bo') THEN
    RAISE EXCEPTION 'Invalid source_table: %. Must be bo or 2years_bo', source_table;
  END IF;

  -- Build dynamic query with optional cost_center filter
  query_text := format(
    'SELECT
      COALESCE(SUM(etotal), 0)::NUMERIC as quote_value,
      COUNT(DISTINCT obrano)::BIGINT as quote_count
    FROM phc.%I
    WHERE dataobra >= $1
      AND dataobra <= $2
      AND (etotal IS NOT NULL AND etotal <> 0)
      %s',
    source_table,
    CASE
      WHEN filter_cost_center IS NOT NULL
      THEN format('AND (cost_center = %L OR cost_center LIKE %L)',
                  filter_cost_center,
                  filter_cost_center || '%')
      ELSE ''
    END
  );

  RAISE NOTICE 'Executing query: %', query_text;

  RETURN QUERY EXECUTE query_text USING start_date, end_date;
END;
$$;

-- =====================================================================
-- Grant permissions
-- =====================================================================
GRANT EXECUTE ON FUNCTION calculate_kpis_by_cost_center TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_kpis_by_cost_center TO service_role;

GRANT EXECUTE ON FUNCTION calculate_quotes_by_cost_center TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_quotes_by_cost_center TO service_role;

-- =====================================================================
-- Comments
-- =====================================================================
COMMENT ON FUNCTION calculate_kpis_by_cost_center IS
'Calculate KPI metrics (revenue, invoices, customers) filtered by cost center.
If filter_cost_center is NULL, returns all cost centers.';

COMMENT ON FUNCTION calculate_quotes_by_cost_center IS
'Calculate quote metrics (value, count) filtered by cost center.
If filter_cost_center is NULL, returns all cost centers.';

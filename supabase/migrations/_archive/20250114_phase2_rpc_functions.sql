-- Phase 2 RPC Functions for Financial Analysis
-- Created: 2025-01-13
-- Purpose: Salesperson Performance and Cost Center Analysis

-- ============================================================================
-- 1. SALESPERSON PERFORMANCE ANALYSIS
-- ============================================================================

-- Function: Get salesperson revenue by month (from invoices)
-- Uses user_name_mapping to canonicalize salesperson and department based on initials (SIGLA)
CREATE OR REPLACE FUNCTION get_salesperson_monthly_revenue(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'ft'  -- 'ft' or '2years_ft'
)
RETURNS TABLE (
  salesperson_name TEXT,
  department TEXT,
  month DATE,
  revenue NUMERIC,
  invoice_count BIGINT,
  unique_customers BIGINT
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT
      COALESCE(
        unm.standardized_name,
        COALESCE(NULLIF(TRIM(fi.salesperson_name), ''''), ''(Não Atribuído)'')
      ) AS salesperson_name,
      COALESCE(unm.department, ''(Sem Departamento)'') AS department,
      DATE_TRUNC(''month'', ft.invoice_date)::DATE AS month,
      COALESCE(SUM(fi.net_liquid_value), 0)::NUMERIC AS revenue,
      COUNT(DISTINCT ft.invoice_id) AS invoice_count,
      COUNT(DISTINCT ft.customer_id) AS unique_customers
    FROM phc.%I ft
    JOIN phc.%I fi
      ON ft.invoice_id = fi.invoice_id
    LEFT JOIN public.user_name_mapping unm
      ON unm.active = true
      AND unm.sales = true
      AND TRIM(UPPER(fi.salesperson_name)) = TRIM(UPPER(unm.initials))
    WHERE ft.invoice_date >= $1
      AND ft.invoice_date <= $2
      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')
    GROUP BY salesperson_name, department, month
    ORDER BY month, revenue DESC
  ', source_table,
     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)
  USING start_date, end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get salesperson summary (YTD totals)
-- Aggregates by canonical salesperson and department when mapping exists
CREATE OR REPLACE FUNCTION get_salesperson_summary(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'ft'
)
RETURNS TABLE (
  salesperson_name TEXT,
  department TEXT,
  total_revenue NUMERIC,
  total_invoices BIGINT,
  unique_customers BIGINT,
  avg_invoice_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT
      COALESCE(
        unm.standardized_name,
        COALESCE(NULLIF(TRIM(fi.salesperson_name), ''''), ''(Não Atribuído)'')
      ) AS salesperson_name,
      COALESCE(unm.department, ''(Sem Departamento)'') AS department,
      COALESCE(SUM(fi.net_liquid_value), 0)::NUMERIC AS total_revenue,
      COUNT(DISTINCT ft.invoice_id) AS total_invoices,
      COUNT(DISTINCT ft.customer_id) AS unique_customers,
      CASE
        WHEN COUNT(DISTINCT ft.invoice_id) > 0
        THEN ROUND(SUM(fi.net_liquid_value) / COUNT(DISTINCT ft.invoice_id), 2)
        ELSE 0
      END::NUMERIC AS avg_invoice_value
    FROM phc.%I ft
    JOIN phc.%I fi
      ON ft.invoice_id = fi.invoice_id
    LEFT JOIN public.user_name_mapping unm
      ON unm.active = true
      AND unm.sales = true
      AND TRIM(UPPER(fi.salesperson_name)) = TRIM(UPPER(unm.initials))
    WHERE ft.invoice_date >= $1
      AND ft.invoice_date <= $2
      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')
    GROUP BY salesperson_name, department
    ORDER BY total_revenue DESC
  ', source_table,
     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)
  USING start_date, end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get salesperson performance from orders (BO table)
-- Uses user_name_mapping to canonicalize salesperson and department
CREATE OR REPLACE FUNCTION get_salesperson_order_performance(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'bo'
)
RETURNS TABLE (
  salesperson_name TEXT,
  department TEXT,
  total_orders BIGINT,
  total_order_value NUMERIC,
  unique_customers BIGINT,
  avg_order_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT
      COALESCE(
        unm.standardized_name,
        COALESCE(NULLIF(TRIM(cl.salesperson), ''''), ''(Não Atribuído)'')
      ) AS salesperson_name,
      COALESCE(unm.department, ''(Sem Departamento)'') AS department,
      COUNT(DISTINCT bo.document_id) AS total_orders,
      COALESCE(SUM(bo.total_value), 0)::NUMERIC AS total_order_value,
      COUNT(DISTINCT bo.customer_id) AS unique_customers,
      CASE
        WHEN COUNT(DISTINCT bo.document_id) > 0
        THEN ROUND(SUM(bo.total_value) / COUNT(DISTINCT bo.document_id), 2)
        ELSE 0
      END::NUMERIC AS avg_order_value
    FROM phc.%I bo
    LEFT JOIN phc.cl cl
      ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_name_mapping unm
      ON unm.active = true
      AND unm.sales = true
      AND TRIM(UPPER(cl.salesperson)) = TRIM(UPPER(unm.initials))
    WHERE bo.document_date >= $1
      AND bo.document_date <= $2
      AND bo.document_type = ''Encomenda de Cliente''
    GROUP BY salesperson_name, department
    ORDER BY total_order_value DESC
  ', source_table)
  USING start_date, end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. COST CENTER ANALYSIS
-- ============================================================================

-- Function: Get cost center quarterly trends
CREATE OR REPLACE FUNCTION get_cost_center_quarterly(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'ft'
)
RETURNS TABLE (
  cost_center TEXT,
  quarter TEXT,
  revenue NUMERIC,
  invoice_count BIGINT,
  avg_invoice_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT
      COALESCE(NULLIF(TRIM(fi.cost_center), ''''), ''(Sem Centro de Custo)'') as cost_center,
      CONCAT(EXTRACT(YEAR FROM ft.invoice_date), ''-Q'', EXTRACT(QUARTER FROM ft.invoice_date)) as quarter,
      COALESCE(SUM(fi.net_liquid_value), 0)::NUMERIC as revenue,
      COUNT(DISTINCT ft.invoice_id) as invoice_count,
      CASE
        WHEN COUNT(DISTINCT ft.invoice_id) > 0
        THEN ROUND(SUM(fi.net_liquid_value) / COUNT(DISTINCT ft.invoice_id), 2)
        ELSE 0
      END::NUMERIC as avg_invoice_value
    FROM phc.%I ft
    JOIN phc.%I fi ON ft.invoice_id = fi.invoice_id
    WHERE ft.invoice_date >= $1
      AND ft.invoice_date <= $2
      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')
    GROUP BY cost_center, quarter
    ORDER BY quarter, revenue DESC
  ', source_table,
     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)
  USING start_date, end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get cost center annual summary
CREATE OR REPLACE FUNCTION get_cost_center_summary(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'ft'
)
RETURNS TABLE (
  cost_center TEXT,
  total_revenue NUMERIC,
  total_invoices BIGINT,
  unique_customers BIGINT,
  pct_of_total NUMERIC
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    WITH cost_center_totals AS (
      SELECT
        COALESCE(NULLIF(TRIM(fi.cost_center), ''''), ''(Sem Centro de Custo)'') as cost_center,
        COALESCE(SUM(fi.net_liquid_value), 0) as revenue,
        COUNT(DISTINCT ft.invoice_id) as invoices,
        COUNT(DISTINCT ft.customer_id) as customers
      FROM phc.%I ft
      JOIN phc.%I fi ON ft.invoice_id = fi.invoice_id
      WHERE ft.invoice_date >= $1
        AND ft.invoice_date <= $2
        AND ft.document_type IN (''Factura'', ''Nota de Crédito'')
      GROUP BY cost_center
    ),
    grand_total AS (
      SELECT SUM(revenue) as total FROM cost_center_totals
    )
    SELECT
      cct.cost_center,
      cct.revenue::NUMERIC as total_revenue,
      cct.invoices as total_invoices,
      cct.customers as unique_customers,
      CASE
        WHEN gt.total > 0
        THEN ROUND((cct.revenue / gt.total * 100)::NUMERIC, 2)
        ELSE 0
      END as pct_of_total
    FROM cost_center_totals cct
    CROSS JOIN grand_total gt
    ORDER BY cct.revenue DESC
  ', source_table,
     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)
  USING start_date, end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get cost center monthly trends
CREATE OR REPLACE FUNCTION get_cost_center_monthly(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'ft'
)
RETURNS TABLE (
  cost_center TEXT,
  month DATE,
  revenue NUMERIC,
  invoice_count BIGINT
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT
      COALESCE(NULLIF(TRIM(fi.cost_center), ''''), ''(Sem Centro de Custo)'') as cost_center,
      DATE_TRUNC(''month'', ft.invoice_date)::DATE as month,
      COALESCE(SUM(fi.net_liquid_value), 0)::NUMERIC as revenue,
      COUNT(DISTINCT ft.invoice_id) as invoice_count
    FROM phc.%I ft
    JOIN phc.%I fi ON ft.invoice_id = fi.invoice_id
    WHERE ft.invoice_date >= $1
      AND ft.invoice_date <= $2
      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')
    GROUP BY cost_center, month
    ORDER BY month, revenue DESC
  ', source_table,
     CASE WHEN source_table = 'ft' THEN 'fi' ELSE '2years_fi' END)
  USING start_date, end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_salesperson_monthly_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION get_salesperson_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_salesperson_order_performance TO authenticated;
GRANT EXECUTE ON FUNCTION get_cost_center_quarterly TO authenticated;
GRANT EXECUTE ON FUNCTION get_cost_center_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_cost_center_monthly TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_salesperson_monthly_revenue IS 'Returns monthly revenue breakdown by salesperson from invoice data';
COMMENT ON FUNCTION get_salesperson_summary IS 'Returns YTD summary of salesperson performance metrics';
COMMENT ON FUNCTION get_salesperson_order_performance IS 'Returns salesperson performance from order (BO) data';
COMMENT ON FUNCTION get_cost_center_quarterly IS 'Returns quarterly revenue trends by cost center';
COMMENT ON FUNCTION get_cost_center_summary IS 'Returns annual summary with percentage share per cost center';
COMMENT ON FUNCTION get_cost_center_monthly IS 'Returns monthly revenue trends by cost center';

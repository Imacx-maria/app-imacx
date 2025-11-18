-- Phase 2: Department and Salesperson Performance Functions
-- Created: 2025-01-17
-- Purpose: Analyze sales performance by department and salesperson using user_siglas mapping

-- ============================================================================
-- 1. DEPARTMENT PERFORMANCE ANALYSIS
-- ============================================================================

-- Function: Get department performance with YTD and YoY comparisons
CREATE OR REPLACE FUNCTION get_department_performance_ytd(
  current_year INTEGER,
  ytd_end_date DATE
)
RETURNS TABLE (
  department_name TEXT,
  -- Current Year YTD
  sales_ytd NUMERIC,
  quotes_ytd NUMERIC,
  invoices_ytd BIGINT,
  customers_ytd BIGINT,
  -- Previous Year YTD (same period)
  sales_ytd_prev NUMERIC,
  quotes_ytd_prev NUMERIC,
  invoices_ytd_prev BIGINT,
  customers_ytd_prev BIGINT,
  -- Two Years Ago YTD (same period)
  sales_ytd_2y NUMERIC,
  quotes_ytd_2y NUMERIC,
  -- YoY Changes
  sales_yoy_change_pct NUMERIC,
  quotes_yoy_change_pct NUMERIC
) AS $$
DECLARE
  ytd_start_current DATE;
  ytd_end_current DATE;
  ytd_start_prev DATE;
  ytd_end_prev DATE;
  ytd_start_2y DATE;
  ytd_end_2y DATE;
BEGIN
  -- Calculate date ranges for same calendar period across years
  ytd_start_current := DATE(current_year || '-01-01');
  ytd_end_current := ytd_end_date;

  ytd_start_prev := DATE((current_year - 1) || '-01-01');
  ytd_end_prev := DATE((current_year - 1) || '-' || LPAD(EXTRACT(MONTH FROM ytd_end_date)::TEXT, 2, '0') || '-' || LPAD(EXTRACT(DAY FROM ytd_end_date)::TEXT, 2, '0'));

  ytd_start_2y := DATE((current_year - 2) || '-01-01');
  ytd_end_2y := DATE((current_year - 2) || '-' || LPAD(EXTRACT(MONTH FROM ytd_end_date)::TEXT, 2, '0') || '-' || LPAD(EXTRACT(DAY FROM ytd_end_date)::TEXT, 2, '0'));

  RETURN QUERY
  WITH
  -- Current Year Sales (from FT)
  current_sales AS (
    SELECT
      COALESCE(d.nome, 'IMACX') as dept_name,
      SUM(ft.net_value) as revenue,
      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN ft.invoice_id END) as invoice_count,
      COUNT(DISTINCT ft.customer_id) as customer_count
    FROM phc.ft ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= ytd_start_current
      AND ft.invoice_date <= ytd_end_current
      AND ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
    GROUP BY d.nome
  ),
  -- Current Year Quotes (from BO)
  current_quotes AS (
    SELECT
      COALESCE(d.nome, 'IMACX') as dept_name,
      SUM(bo.total_value) as quote_value
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= ytd_start_current
      AND bo.document_date <= ytd_end_current
      AND bo.document_type = 'Orçamento'
    GROUP BY d.nome
  ),
  -- Previous Year Sales (from 2years_FT)
  prev_sales AS (
    SELECT
      COALESCE(d.nome, 'IMACX') as dept_name,
      SUM(ft.net_value) as revenue,
      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN ft.invoice_id END) as invoice_count,
      COUNT(DISTINCT ft.customer_id) as customer_count
    FROM phc."2years_ft" ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= ytd_start_prev
      AND ft.invoice_date <= ytd_end_prev
      AND ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
    GROUP BY d.nome
  ),
  -- Previous Year Quotes (from 2years_BO)
  prev_quotes AS (
    SELECT
      COALESCE(d.nome, 'IMACX') as dept_name,
      SUM(bo.total_value) as quote_value
    FROM phc."2years_bo" bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= ytd_start_prev
      AND bo.document_date <= ytd_end_prev
      AND bo.document_type = 'Orçamento'
    GROUP BY d.nome
  ),
  -- Two Years Ago Sales (from 2years_FT)
  twoyear_sales AS (
    SELECT
      COALESCE(d.nome, 'IMACX') as dept_name,
      SUM(ft.net_value) as revenue
    FROM phc."2years_ft" ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= ytd_start_2y
      AND ft.invoice_date <= ytd_end_2y
      AND ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
    GROUP BY d.nome
  ),
  -- Two Years Ago Quotes (from 2years_BO)
  twoyear_quotes AS (
    SELECT
      COALESCE(d.nome, 'IMACX') as dept_name,
      SUM(bo.total_value) as quote_value
    FROM phc."2years_bo" bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= ytd_start_2y
      AND bo.document_date <= ytd_end_2y
      AND bo.document_type = 'Orçamento'
    GROUP BY d.nome
  )
  -- Combine all data
  SELECT
    COALESCE(cs.dept_name, cq.dept_name, ps.dept_name, pq.dept_name, ts.dept_name, tq.dept_name, 'IMACX') as department_name,
    -- Current Year
    COALESCE(cs.revenue, 0)::NUMERIC as sales_ytd,
    COALESCE(cq.quote_value, 0)::NUMERIC as quotes_ytd,
    COALESCE(cs.invoice_count, 0) as invoices_ytd,
    COALESCE(cs.customer_count, 0) as customers_ytd,
    -- Previous Year
    COALESCE(ps.revenue, 0)::NUMERIC as sales_ytd_prev,
    COALESCE(pq.quote_value, 0)::NUMERIC as quotes_ytd_prev,
    COALESCE(ps.invoice_count, 0) as invoices_ytd_prev,
    COALESCE(ps.customer_count, 0) as customers_ytd_prev,
    -- Two Years Ago
    COALESCE(ts.revenue, 0)::NUMERIC as sales_ytd_2y,
    COALESCE(tq.quote_value, 0)::NUMERIC as quotes_ytd_2y,
    -- YoY Changes
    CASE
      WHEN COALESCE(ps.revenue, 0) > 0
      THEN ROUND(((COALESCE(cs.revenue, 0) - COALESCE(ps.revenue, 0)) / ps.revenue * 100)::NUMERIC, 1)
      ELSE NULL
    END as sales_yoy_change_pct,
    CASE
      WHEN COALESCE(pq.quote_value, 0) > 0
      THEN ROUND(((COALESCE(cq.quote_value, 0) - COALESCE(pq.quote_value, 0)) / pq.quote_value * 100)::NUMERIC, 1)
      ELSE NULL
    END as quotes_yoy_change_pct
  FROM current_sales cs
  FULL OUTER JOIN current_quotes cq ON cs.dept_name = cq.dept_name
  FULL OUTER JOIN prev_sales ps ON COALESCE(cs.dept_name, cq.dept_name) = ps.dept_name
  FULL OUTER JOIN prev_quotes pq ON COALESCE(cs.dept_name, cq.dept_name, ps.dept_name) = pq.dept_name
  FULL OUTER JOIN twoyear_sales ts ON COALESCE(cs.dept_name, cq.dept_name, ps.dept_name, pq.dept_name) = ts.dept_name
  FULL OUTER JOIN twoyear_quotes tq ON COALESCE(cs.dept_name, cq.dept_name, ps.dept_name, pq.dept_name, ts.dept_name) = tq.dept_name
  WHERE COALESCE(cs.revenue, cq.quote_value, ps.revenue, pq.quote_value, ts.revenue, tq.quote_value, 0) > 0
  ORDER BY COALESCE(cs.revenue, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. SALESPERSON PERFORMANCE ANALYSIS
-- ============================================================================

-- Function: Get salesperson performance with YTD and YoY comparisons
CREATE OR REPLACE FUNCTION get_salesperson_performance_ytd(
  current_year INTEGER,
  ytd_end_date DATE
)
RETURNS TABLE (
  salesperson_name TEXT,
  department_name TEXT,
  -- Current Year YTD
  sales_ytd NUMERIC,
  quotes_ytd NUMERIC,
  invoices_ytd BIGINT,
  customers_ytd BIGINT,
  avg_ticket_ytd NUMERIC,
  -- Previous Year YTD
  sales_ytd_prev NUMERIC,
  quotes_ytd_prev NUMERIC,
  invoices_ytd_prev BIGINT,
  customers_ytd_prev BIGINT,
  -- YoY Changes
  sales_yoy_change_pct NUMERIC,
  quotes_yoy_change_pct NUMERIC
) AS $$
DECLARE
  ytd_start_current DATE;
  ytd_end_current DATE;
  ytd_start_prev DATE;
  ytd_end_prev DATE;
BEGIN
  -- Calculate date ranges for same calendar period
  ytd_start_current := DATE(current_year || '-01-01');
  ytd_end_current := ytd_end_date;

  ytd_start_prev := DATE((current_year - 1) || '-01-01');
  ytd_end_prev := DATE((current_year - 1) || '-' || LPAD(EXTRACT(MONTH FROM ytd_end_date)::TEXT, 2, '0') || '-' || LPAD(EXTRACT(DAY FROM ytd_end_date)::TEXT, 2, '0'));

  RETURN QUERY
  WITH
  -- Current Year Sales (from FT)
  current_sales AS (
    SELECT
      COALESCE(p.first_name, COALESCE(cl.salesperson, 'IMACX')) as person_name,
      COALESCE(d.nome, 'IMACX') as dept_name,
      SUM(ft.net_value) as revenue,
      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN ft.invoice_id END) as invoice_count,
      COUNT(DISTINCT ft.customer_id) as customer_count
    FROM phc.ft ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= ytd_start_current
      AND ft.invoice_date <= ytd_end_current
      AND ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
    GROUP BY p.first_name, cl.salesperson, d.nome
  ),
  -- Current Year Quotes (from BO)
  current_quotes AS (
    SELECT
      COALESCE(p.first_name, COALESCE(cl.salesperson, 'IMACX')) as person_name,
      COALESCE(d.nome, 'IMACX') as dept_name,
      SUM(bo.total_value) as quote_value
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= ytd_start_current
      AND bo.document_date <= ytd_end_current
      AND bo.document_type = 'Orçamento'
    GROUP BY p.first_name, cl.salesperson, d.nome
  ),
  -- Previous Year Sales (from 2years_FT)
  prev_sales AS (
    SELECT
      COALESCE(p.first_name, COALESCE(cl.salesperson, 'IMACX')) as person_name,
      SUM(ft.net_value) as revenue,
      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN ft.invoice_id END) as invoice_count,
      COUNT(DISTINCT ft.customer_id) as customer_count
    FROM phc."2years_ft" ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    WHERE ft.invoice_date >= ytd_start_prev
      AND ft.invoice_date <= ytd_end_prev
      AND ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
    GROUP BY p.first_name, cl.salesperson
  ),
  -- Previous Year Quotes (from 2years_BO)
  prev_quotes AS (
    SELECT
      COALESCE(p.first_name, COALESCE(cl.salesperson, 'IMACX')) as person_name,
      SUM(bo.total_value) as quote_value
    FROM phc."2years_bo" bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    WHERE bo.document_date >= ytd_start_prev
      AND bo.document_date <= ytd_end_prev
      AND bo.document_type = 'Orçamento'
    GROUP BY p.first_name, cl.salesperson
  )
  -- Combine all data
  SELECT
    COALESCE(cs.person_name, cq.person_name, ps.person_name, pq.person_name, 'IMACX') as salesperson_name,
    COALESCE(cs.dept_name, cq.dept_name, 'IMACX') as department_name,
    -- Current Year
    COALESCE(cs.revenue, 0)::NUMERIC as sales_ytd,
    COALESCE(cq.quote_value, 0)::NUMERIC as quotes_ytd,
    COALESCE(cs.invoice_count, 0) as invoices_ytd,
    COALESCE(cs.customer_count, 0) as customers_ytd,
    CASE
      WHEN COALESCE(cs.invoice_count, 0) > 0
      THEN ROUND((cs.revenue / cs.invoice_count)::NUMERIC, 2)
      ELSE 0
    END as avg_ticket_ytd,
    -- Previous Year
    COALESCE(ps.revenue, 0)::NUMERIC as sales_ytd_prev,
    COALESCE(pq.quote_value, 0)::NUMERIC as quotes_ytd_prev,
    COALESCE(ps.invoice_count, 0) as invoices_ytd_prev,
    COALESCE(ps.customer_count, 0) as customers_ytd_prev,
    -- YoY Changes
    CASE
      WHEN COALESCE(ps.revenue, 0) > 0
      THEN ROUND(((COALESCE(cs.revenue, 0) - COALESCE(ps.revenue, 0)) / ps.revenue * 100)::NUMERIC, 1)
      ELSE NULL
    END as sales_yoy_change_pct,
    CASE
      WHEN COALESCE(pq.quote_value, 0) > 0
      THEN ROUND(((COALESCE(cq.quote_value, 0) - COALESCE(pq.quote_value, 0)) / pq.quote_value * 100)::NUMERIC, 1)
      ELSE NULL
    END as quotes_yoy_change_pct
  FROM current_sales cs
  FULL OUTER JOIN current_quotes cq ON cs.person_name = cq.person_name
  FULL OUTER JOIN prev_sales ps ON COALESCE(cs.person_name, cq.person_name) = ps.person_name
  FULL OUTER JOIN prev_quotes pq ON COALESCE(cs.person_name, cq.person_name, ps.person_name) = pq.person_name
  WHERE COALESCE(cs.revenue, cq.quote_value, ps.revenue, pq.quote_value, 0) > 0
  ORDER BY COALESCE(cs.revenue, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. MONTHLY TRENDS FOR DEPARTMENTS
-- ============================================================================

-- Function: Get department monthly revenue trends
CREATE OR REPLACE FUNCTION get_department_monthly_revenue(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'ft'  -- 'ft' or '2years_ft'
)
RETURNS TABLE (
  department_name TEXT,
  month DATE,
  revenue NUMERIC,
  invoice_count BIGINT,
  unique_customers BIGINT
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT
      COALESCE(d.nome, ''Sem Departamento'') as department_name,
      DATE_TRUNC(''month'', ft.invoice_date)::DATE as month,
      COALESCE(SUM(ft.net_value), 0)::NUMERIC as revenue,
      COUNT(DISTINCT CASE WHEN ft.document_type = ''Factura'' THEN ft.invoice_id END) as invoice_count,
      COUNT(DISTINCT ft.customer_id) as unique_customers
    FROM phc.%I ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us ON UPPER(TRIM(COALESCE(cl.salesperson, ''IMACX''))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= $1
      AND ft.invoice_date <= $2
      AND ft.document_type IN (''Factura'', ''Nota de Crédito'')
      AND (ft.anulado IS NULL OR ft.anulado != ''True'')
    GROUP BY d.nome, month
    ORDER BY month, revenue DESC
  ', source_table)
  USING start_date, end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_department_performance_ytd TO authenticated;
GRANT EXECUTE ON FUNCTION get_salesperson_performance_ytd TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_monthly_revenue TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_department_performance_ytd IS 'Returns YTD department performance with 3-year comparisons';
COMMENT ON FUNCTION get_salesperson_performance_ytd IS 'Returns YTD salesperson performance with department association and YoY comparisons';
COMMENT ON FUNCTION get_department_monthly_revenue IS 'Returns monthly revenue breakdown by department';

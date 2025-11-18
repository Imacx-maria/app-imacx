-- =====================================================
-- GRANT PERMISSIONS FOR DEPARTMENT RPC FUNCTIONS
-- =====================================================
-- Issue: authenticated role cannot access phc.bo, phc.ft tables
-- Solution: Make functions SECURITY DEFINER so they run with owner's permissions
-- =====================================================

-- Drop and recreate all functions with SECURITY DEFINER

DROP FUNCTION IF EXISTS get_department_escaloes_orcamentos(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_escaloes_faturas(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_conversion_rates(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_customer_metrics(TEXT, DATE, DATE, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_pipeline(TEXT, DATE, DATE);

-- =====================================================
-- 1. GET DEPARTMENT QUOTE BRACKETS
-- =====================================================
CREATE OR REPLACE FUNCTION get_department_escaloes_orcamentos(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  value_bracket TEXT,
  quote_count BIGINT,
  total_value NUMERIC,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with owner's permissions
SET search_path = public, phc
AS $$
BEGIN
  RETURN QUERY
  WITH department_quotes AS (
    SELECT
      bo.document_id,
      bo.total_value
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  bracketed_quotes AS (
    SELECT
      CASE
        WHEN dq.total_value < 1500 THEN '0-1500'
        WHEN dq.total_value >= 1500 AND dq.total_value < 2500 THEN '1500-2500'
        WHEN dq.total_value >= 2500 AND dq.total_value < 7500 THEN '2500-7500'
        WHEN dq.total_value >= 7500 AND dq.total_value < 15000 THEN '7500-15000'
        WHEN dq.total_value >= 15000 AND dq.total_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket_range,
      dq.total_value
    FROM department_quotes dq
  ),
  bracket_stats AS (
    SELECT
      bq.bracket_range,
      COUNT(*) as quote_count,
      SUM(bq.total_value) as total_value
    FROM bracketed_quotes bq
    GROUP BY bq.bracket_range
  ),
  total_value_sum AS (
    SELECT SUM(dq.total_value) as grand_total FROM department_quotes dq
  )
  SELECT
    bs.bracket_range,
    bs.quote_count,
    ROUND(bs.total_value, 2) as total_value,
    ROUND((bs.total_value / NULLIF(tvs.grand_total, 0) * 100), 2) as percentage
  FROM bracket_stats bs
  CROSS JOIN total_value_sum tvs
  ORDER BY
    CASE bs.bracket_range
      WHEN '0-1500' THEN 1
      WHEN '1500-2500' THEN 2
      WHEN '2500-7500' THEN 3
      WHEN '7500-15000' THEN 4
      WHEN '15000-30000' THEN 5
      WHEN '30000+' THEN 6
    END;
END;
$$;

-- =====================================================
-- 2. GET DEPARTMENT INVOICE BRACKETS
-- =====================================================
CREATE OR REPLACE FUNCTION get_department_escaloes_faturas(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  value_bracket TEXT,
  invoice_count BIGINT,
  total_value NUMERIC,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with owner's permissions
SET search_path = public, phc
AS $$
BEGIN
  RETURN QUERY
  WITH department_invoices AS (
    SELECT
      ft.invoice_id,
      ft.net_value
    FROM phc.ft ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= start_date
      AND ft.invoice_date <= end_date
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND COALESCE(d.nome, 'IMACX') = departamento_nome

    UNION ALL

    SELECT
      ft.invoice_id,
      ft.net_value
    FROM phc."2years_ft" ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= start_date
      AND ft.invoice_date <= end_date
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  bracketed_invoices AS (
    SELECT
      CASE
        WHEN di.net_value < 1500 THEN '0-1500'
        WHEN di.net_value >= 1500 AND di.net_value < 2500 THEN '1500-2500'
        WHEN di.net_value >= 2500 AND di.net_value < 7500 THEN '2500-7500'
        WHEN di.net_value >= 7500 AND di.net_value < 15000 THEN '7500-15000'
        WHEN di.net_value >= 15000 AND di.net_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket_range,
      di.net_value
    FROM department_invoices di
  ),
  bracket_stats AS (
    SELECT
      bi.bracket_range,
      COUNT(*) as invoice_count,
      SUM(bi.net_value) as total_value
    FROM bracketed_invoices bi
    GROUP BY bi.bracket_range
  ),
  total_value_sum AS (
    SELECT SUM(di.net_value) as grand_total FROM department_invoices di
  )
  SELECT
    bs.bracket_range,
    bs.invoice_count,
    ROUND(bs.total_value, 2) as total_value,
    ROUND((bs.total_value / NULLIF(tvs.grand_total, 0) * 100), 2) as percentage
  FROM bracket_stats bs
  CROSS JOIN total_value_sum tvs
  ORDER BY
    CASE bs.bracket_range
      WHEN '0-1500' THEN 1
      WHEN '1500-2500' THEN 2
      WHEN '2500-7500' THEN 3
      WHEN '7500-15000' THEN 4
      WHEN '15000-30000' THEN 5
      WHEN '30000+' THEN 6
    END;
END;
$$;

-- =====================================================
-- 3. GET DEPARTMENT CONVERSION RATES
-- =====================================================
CREATE OR REPLACE FUNCTION get_department_conversion_rates(
  departamento_nome TEXT,
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
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with owner's permissions
SET search_path = public, phc
AS $$
BEGIN
  RETURN QUERY
  WITH department_quotes AS (
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
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  converted_quotes AS (
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
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND COALESCE(d.nome, 'IMACX') = departamento_nome

    UNION

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
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  quote_stats AS (
    SELECT
      dq.bracket_range,
      COUNT(*) as quote_count,
      SUM(dq.total_value) as total_quoted_value
    FROM department_quotes dq
    GROUP BY dq.bracket_range
  ),
  conversion_stats AS (
    SELECT
      cq.bracket_range,
      COUNT(DISTINCT cq.document_id) as invoice_count,
      SUM(cq.invoiced_value) as total_invoiced_value
    FROM converted_quotes cq
    GROUP BY cq.bracket_range
  )
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
$$;

-- =====================================================
-- 4. GET DEPARTMENT CUSTOMER METRICS
-- =====================================================
CREATE OR REPLACE FUNCTION get_department_customer_metrics(
  departamento_nome TEXT,
  ytd_start DATE,
  ytd_end DATE,
  lytd_start DATE,
  lytd_end DATE
)
RETURNS TABLE (
  customers_ytd BIGINT,
  customers_lytd BIGINT,
  new_customers BIGINT,
  lost_customers BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with owner's permissions
SET search_path = public, phc
AS $$
BEGIN
  RETURN QUERY
  WITH ytd_customers AS (
    SELECT DISTINCT ft.customer_id
    FROM phc.ft ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= ytd_start
      AND ft.invoice_date <= ytd_end
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  lytd_customers AS (
    SELECT DISTINCT ft.customer_id
    FROM phc."2years_ft" ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= lytd_start
      AND ft.invoice_date <= lytd_end
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  )
  SELECT
    (SELECT COUNT(*) FROM ytd_customers)::BIGINT as customers_ytd,
    (SELECT COUNT(*) FROM lytd_customers)::BIGINT as customers_lytd,
    (SELECT COUNT(*) FROM ytd_customers WHERE customer_id NOT IN (SELECT customer_id FROM lytd_customers))::BIGINT as new_customers,
    (SELECT COUNT(*) FROM lytd_customers WHERE customer_id NOT IN (SELECT customer_id FROM ytd_customers))::BIGINT as lost_customers;
END;
$$;

-- =====================================================
-- 5. GET DEPARTMENT PIPELINE
-- =====================================================
CREATE OR REPLACE FUNCTION get_department_pipeline(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  quote_number TEXT,
  quote_date DATE,
  customer_name TEXT,
  quote_value NUMERIC,
  quote_status TEXT,
  quote_days_open INTEGER,
  quote_category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with owner's permissions
SET search_path = public, phc
AS $$
BEGIN
  RETURN QUERY
  WITH department_quotes AS (
    SELECT
      bo.document_number::TEXT as q_number,
      bo.document_date as q_date,
      cl.customer_name as c_name,
      bo.total_value as q_value,
      'Pendente'::TEXT as q_status,
      (CURRENT_DATE - bo.document_date)::INTEGER as q_days_open
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
      AND NOT EXISTS (
        SELECT 1
        FROM phc.bi bi
        INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
        INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM phc.bi bi
        INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp
        INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
  ),
  categorized_quotes AS (
    SELECT
      dq.*,
      CASE
        WHEN dq.q_days_open <= 30 THEN 'top_15'
        WHEN dq.q_days_open > 30 AND dq.q_days_open <= 60 THEN 'needs_attention'
        WHEN dq.q_days_open > 60 THEN 'lost'
      END as q_category,
      ROW_NUMBER() OVER (
        PARTITION BY
          CASE
            WHEN dq.q_days_open <= 30 THEN 'top_15'
            WHEN dq.q_days_open > 30 AND dq.q_days_open <= 60 THEN 'needs_attention'
            WHEN dq.q_days_open > 60 THEN 'lost'
          END
        ORDER BY dq.q_value DESC
      ) as category_rank
    FROM department_quotes dq
  )
  SELECT
    cq.q_number,
    cq.q_date,
    cq.c_name,
    ROUND(cq.q_value, 2) as q_value,
    cq.q_status,
    cq.q_days_open,
    cq.q_category
  FROM categorized_quotes cq
  WHERE cq.category_rank <= 15
  ORDER BY
    CASE cq.q_category
      WHEN 'top_15' THEN 1
      WHEN 'needs_attention' THEN 2
      WHEN 'lost' THEN 3
    END,
    cq.q_value DESC;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION get_department_escaloes_orcamentos TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_escaloes_faturas TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_conversion_rates TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_customer_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_pipeline TO authenticated;

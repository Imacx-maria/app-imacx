-- =====================================================
-- FIX DEPARTMENT RPC FUNCTIONS - CORRECT COLUMN NAMES
-- =====================================================
-- Issues found:
-- 1. fi.net_value → fi.net_liquid_value
-- 2. anulado is TEXT not BOOLEAN (values: "True" or null)
-- 3. total_value needs table prefix to avoid ambiguity
-- =====================================================

-- Drop all existing functions first
DROP FUNCTION IF EXISTS get_department_escaloes_orcamentos(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_escaloes_faturas(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_conversion_rates(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_customer_metrics(TEXT, DATE, DATE, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_pipeline(TEXT, DATE, DATE);

-- =====================================================
-- 1. GET DEPARTMENT QUOTE BRACKETS (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION get_department_escaloes_orcamentos(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  bracket TEXT,
  quote_count BIGINT,
  total_value NUMERIC,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH department_quotes AS (
    SELECT
      bo.document_id,
      bo.total_value  -- Qualified with table prefix
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
        WHEN department_quotes.total_value < 1500 THEN '0-1500'
        WHEN department_quotes.total_value >= 1500 AND department_quotes.total_value < 2500 THEN '1500-2500'
        WHEN department_quotes.total_value >= 2500 AND department_quotes.total_value < 7500 THEN '2500-7500'
        WHEN department_quotes.total_value >= 7500 AND department_quotes.total_value < 15000 THEN '7500-15000'
        WHEN department_quotes.total_value >= 15000 AND department_quotes.total_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket,
      department_quotes.total_value
    FROM department_quotes
  ),
  bracket_stats AS (
    SELECT
      bracket,
      COUNT(*) as quote_count,
      SUM(bracketed_quotes.total_value) as total_value
    FROM bracketed_quotes
    GROUP BY bracket
  ),
  total_value_sum AS (
    SELECT SUM(department_quotes.total_value) as grand_total FROM department_quotes
  )
  SELECT
    bs.bracket,
    bs.quote_count,
    ROUND(bs.total_value, 2) as total_value,
    ROUND((bs.total_value / NULLIF(tvs.grand_total, 0) * 100), 2) as percentage
  FROM bracket_stats bs
  CROSS JOIN total_value_sum tvs
  ORDER BY
    CASE bs.bracket
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
-- 2. GET DEPARTMENT INVOICE BRACKETS (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION get_department_escaloes_faturas(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  bracket TEXT,
  invoice_count BIGINT,
  total_value NUMERIC,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH department_invoices AS (
    -- Current year invoices
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
      AND (ft.anulado IS NULL OR ft.anulado != 'True')  -- anulado is TEXT
      AND COALESCE(d.nome, 'IMACX') = departamento_nome

    UNION ALL

    -- Historical invoices
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
      AND (ft.anulado IS NULL OR ft.anulado != 'True')  -- anulado is TEXT
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  bracketed_invoices AS (
    SELECT
      CASE
        WHEN department_invoices.net_value < 1500 THEN '0-1500'
        WHEN department_invoices.net_value >= 1500 AND department_invoices.net_value < 2500 THEN '1500-2500'
        WHEN department_invoices.net_value >= 2500 AND department_invoices.net_value < 7500 THEN '2500-7500'
        WHEN department_invoices.net_value >= 7500 AND department_invoices.net_value < 15000 THEN '7500-15000'
        WHEN department_invoices.net_value >= 15000 AND department_invoices.net_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket,
      department_invoices.net_value
    FROM department_invoices
  ),
  bracket_stats AS (
    SELECT
      bracket,
      COUNT(*) as invoice_count,
      SUM(bracketed_invoices.net_value) as total_value
    FROM bracketed_invoices
    GROUP BY bracket
  ),
  total_value_sum AS (
    SELECT SUM(department_invoices.net_value) as grand_total FROM department_invoices
  )
  SELECT
    bs.bracket,
    bs.invoice_count,
    ROUND(bs.total_value, 2) as total_value,
    ROUND((bs.total_value / NULLIF(tvs.grand_total, 0) * 100), 2) as percentage
  FROM bracket_stats bs
  CROSS JOIN total_value_sum tvs
  ORDER BY
    CASE bs.bracket
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
-- 3. GET DEPARTMENT CONVERSION RATES (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION get_department_conversion_rates(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  bracket TEXT,
  quote_count BIGINT,
  invoice_count BIGINT,
  conversion_rate NUMERIC,
  total_quoted_value NUMERIC,
  total_invoiced_value NUMERIC
) AS $$
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
      END as bracket
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
      END as bracket,
      fi.net_liquid_value as invoiced_value  -- FIXED: net_liquid_value
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
      AND (ft.anulado IS NULL OR ft.anulado != 'True')  -- FIXED: TEXT comparison
      AND COALESCE(d.nome, 'IMACX') = departamento_nome

    UNION

    -- Historical invoices
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
      END as bracket,
      fi.net_liquid_value as invoiced_value  -- FIXED: net_liquid_value
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
      AND (ft.anulado IS NULL OR ft.anulado != 'True')  -- FIXED: TEXT comparison
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  quote_stats AS (
    SELECT
      bracket,
      COUNT(*) as quote_count,
      SUM(total_value) as total_quoted_value
    FROM department_quotes
    GROUP BY bracket
  ),
  conversion_stats AS (
    SELECT
      bracket,
      COUNT(DISTINCT document_id) as invoice_count,
      SUM(invoiced_value) as total_invoiced_value
    FROM converted_quotes
    GROUP BY bracket
  )
  SELECT
    qs.bracket,
    qs.quote_count,
    COALESCE(cs.invoice_count, 0) as invoice_count,
    ROUND((COALESCE(cs.invoice_count, 0)::NUMERIC / NULLIF(qs.quote_count, 0) * 100), 2) as conversion_rate,
    ROUND(qs.total_quoted_value, 2) as total_quoted_value,
    ROUND(COALESCE(cs.total_invoiced_value, 0), 2) as total_invoiced_value
  FROM quote_stats qs
  LEFT JOIN conversion_stats cs ON qs.bracket = cs.bracket
  ORDER BY
    CASE qs.bracket
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
-- 4. GET DEPARTMENT CUSTOMER METRICS (FIXED)
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
) AS $$
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
      AND (ft.anulado IS NULL OR ft.anulado != 'True')  -- FIXED: TEXT comparison
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
      AND (ft.anulado IS NULL OR ft.anulado != 'True')  -- FIXED: TEXT comparison
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  )
  SELECT
    (SELECT COUNT(*) FROM ytd_customers)::BIGINT as customers_ytd,
    (SELECT COUNT(*) FROM lytd_customers)::BIGINT as customers_lytd,
    (SELECT COUNT(*) FROM ytd_customers WHERE customer_id NOT IN (SELECT customer_id FROM lytd_customers))::BIGINT as new_customers,
    (SELECT COUNT(*) FROM lytd_customers WHERE customer_id NOT IN (SELECT customer_id FROM ytd_customers))::BIGINT as lost_customers;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. GET DEPARTMENT PIPELINE (FIXED)
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
  status TEXT,
  days_open INTEGER,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH department_quotes AS (
    SELECT
      bo.document_number::TEXT as quote_number,
      bo.document_date as quote_date,
      cl.customer_name,
      bo.total_value as quote_value,
      'Pendente' as status,
      (CURRENT_DATE - bo.document_date)::INTEGER as days_open
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
      -- Exclude converted quotes
      AND NOT EXISTS (
        SELECT 1
        FROM phc.bi bi
        INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
        INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')  -- FIXED: TEXT comparison
      )
      AND NOT EXISTS (
        SELECT 1
        FROM phc.bi bi
        INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp
        INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')  -- FIXED: TEXT comparison
      )
  ),
  categorized_quotes AS (
    SELECT
      *,
      CASE
        WHEN days_open <= 30 THEN 'top_15'
        WHEN days_open > 30 AND days_open <= 60 THEN 'needs_attention'
        WHEN days_open > 60 THEN 'lost'
      END as category,
      ROW_NUMBER() OVER (
        PARTITION BY
          CASE
            WHEN days_open <= 30 THEN 'top_15'
            WHEN days_open > 30 AND days_open <= 60 THEN 'needs_attention'
            WHEN days_open > 60 THEN 'lost'
          END
        ORDER BY quote_value DESC
      ) as category_rank
    FROM department_quotes
  )
  SELECT
    categorized_quotes.quote_number,
    categorized_quotes.quote_date,
    categorized_quotes.customer_name,
    ROUND(categorized_quotes.quote_value, 2) as quote_value,
    categorized_quotes.status,
    categorized_quotes.days_open,
    categorized_quotes.category
  FROM categorized_quotes
  WHERE category_rank <= 15
  ORDER BY
    CASE category
      WHEN 'top_15' THEN 1
      WHEN 'needs_attention' THEN 2
      WHEN 'lost' THEN 3
    END,
    quote_value DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION get_department_escaloes_orcamentos TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_escaloes_faturas TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_conversion_rates TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_customer_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_pipeline TO authenticated;

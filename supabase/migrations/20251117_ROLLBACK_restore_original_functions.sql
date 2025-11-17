-- =====================================================
-- EMERGENCY ROLLBACK: RESTORE ORIGINAL FUNCTIONS
-- =====================================================
-- This rolls back the broken mixed periods fix
-- and restores the original working UNION ALL approach
-- =====================================================

DROP FUNCTION IF EXISTS get_department_escaloes_faturas(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_conversion_rates(TEXT, DATE, DATE);

-- =====================================================
-- RESTORE ORIGINAL: GET DEPARTMENT INVOICE BRACKETS
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
) AS $$
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
$$ LANGUAGE plpgsql;

-- =====================================================
-- RESTORE ORIGINAL: GET DEPARTMENT CONVERSION RATES
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
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION get_department_escaloes_faturas TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_conversion_rates TO authenticated;

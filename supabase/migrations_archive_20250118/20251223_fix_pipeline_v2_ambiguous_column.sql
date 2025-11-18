-- =====================================================
-- FIX get_department_pipeline_v2: Ambiguous column reference
-- =====================================================
-- Issue: column reference "quote_category" is ambiguous in ORDER BY
-- Fix: Qualify all column references with table alias
-- =====================================================

DROP FUNCTION IF EXISTS get_department_pipeline_v2(TEXT, DATE, DATE);

CREATE OR REPLACE FUNCTION get_department_pipeline_v2(
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
  quote_category TEXT,
  is_dismissed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH params AS (
    SELECT 
      CURRENT_DATE AS today,
      DATE_TRUNC('year', CURRENT_DATE)::DATE AS year_start,
      CASE 
        WHEN start_date <= DATE_TRUNC('year', CURRENT_DATE)::DATE THEN 'anual'
        ELSE 'mensal'
      END AS periodo
  ),
  base_quotes AS (
    SELECT
      bo.document_id,
      bo.document_number::TEXT AS internal_quote_number,
      bo.document_date AS internal_quote_date,
      bo.customer_id AS cliente_id,
      cl.customer_name AS internal_customer_name,
      bo.total_value AS internal_quote_value,
      'pendente'::TEXT AS status_text
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE
      -- PERIOD LOGIC
      (
        ((SELECT periodo FROM params) = 'anual' AND bo.document_date >= start_date AND bo.document_date <= end_date)
        OR
        ((SELECT periodo FROM params) = 'mensal' AND bo.document_date >= CURRENT_DATE - INTERVAL '120 days')
      )
      AND bo.document_type = 'Orçamento'
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
      -- NOT INVOICED (current chain)
      AND NOT EXISTS (
        SELECT 1
        FROM phc.bi bi
        INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
        INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
      -- NOT INVOICED (2-year chain)
      AND NOT EXISTS (
        SELECT 1
        FROM phc.bi bi
        INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp
        INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
  ),
  quotes_with_flags AS (
    SELECT
      bq.*,
      COALESCE(od.is_dismissed, false) AS is_dismissed_flag,
      (p.today - bq.internal_quote_date)::INTEGER AS dias_aberto
    FROM base_quotes bq
    CROSS JOIN params p
    LEFT JOIN public.orcamentos_dismissed od ON bq.internal_quote_number = od.orcamento_number
  ),
  active_quotes AS (
    SELECT * FROM quotes_with_flags
    WHERE status_text = 'pendente' AND is_dismissed_flag = false
  ),
  lost_quotes AS (
    SELECT * FROM quotes_with_flags
    WHERE is_dismissed_flag = true
  ),
  -- YTD
  ytd_active AS (
    SELECT * FROM active_quotes
    WHERE internal_quote_date >= (SELECT year_start FROM params)
  ),
  ytd_lost AS (
    SELECT * FROM lost_quotes
    WHERE internal_quote_date >= (SELECT year_start FROM params)
  ),
  -- MONTH LOGIC
  monthly_active AS (
    SELECT * FROM active_quotes
  ),
  lost_by_age AS (
    SELECT * FROM active_quotes
    WHERE dias_aberto > 60
  ),
  monthly_lost AS (
    SELECT DISTINCT ON (internal_quote_number) *
    FROM (
      SELECT * FROM lost_quotes
      UNION ALL
      SELECT * FROM lost_by_age
    ) x
    ORDER BY internal_quote_number, internal_quote_date DESC
  ),
  mensal_top15 AS (
    SELECT * FROM monthly_active
    WHERE dias_aberto BETWEEN 0 AND 45
    ORDER BY internal_quote_value DESC
    LIMIT 15
  ),
  mensal_attention AS (
    SELECT * FROM monthly_active
    WHERE dias_aberto BETWEEN 15 AND 60
    ORDER BY dias_aberto DESC
  ),
  mensal_perdidos AS (
    SELECT * FROM monthly_lost
    ORDER BY dias_aberto DESC
  ),
  anual_top15 AS (
    SELECT * FROM ytd_active
    ORDER BY internal_quote_value DESC
    LIMIT 15
  ),
  anual_attention AS (
    SELECT * FROM ytd_active
    WHERE dias_aberto > 30
    ORDER BY dias_aberto DESC
  ),
  anual_perdidos AS (
    SELECT * FROM ytd_lost
    ORDER BY internal_quote_value DESC
  )
  SELECT
    src.internal_quote_number AS quote_number,
    src.internal_quote_date AS quote_date,
    src.internal_customer_name AS customer_name,
    src.internal_quote_value AS quote_value,
    src.status_text AS quote_status,
    src.dias_aberto AS quote_days_open,
    src.cat AS quote_category,
    src.is_dismissed_flag AS is_dismissed
  FROM (
    SELECT *, 'top_15' AS cat FROM mensal_top15 WHERE (SELECT periodo FROM params)='mensal'
    UNION ALL
    SELECT *, 'needs_attention' AS cat FROM mensal_attention WHERE (SELECT periodo FROM params)='mensal'
    UNION ALL
    SELECT *, 'lost' AS cat FROM mensal_perdidos WHERE (SELECT periodo FROM params)='mensal'
    UNION ALL
    SELECT *, 'top_15' AS cat FROM anual_top15 WHERE (SELECT periodo FROM params)='anual'
    UNION ALL
    SELECT *, 'needs_attention' AS cat FROM anual_attention WHERE (SELECT periodo FROM params)='anual'
    UNION ALL
    SELECT *, 'lost' AS cat FROM anual_perdidos WHERE (SELECT periodo FROM params)='anual'
  ) src
  ORDER BY
    CASE src.cat
      WHEN 'top_15' THEN 1
      WHEN 'needs_attention' THEN 2
      ELSE 3
    END,
    src.internal_quote_value DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_department_pipeline_v2(TEXT, DATE, DATE) TO authenticated;

-- Comment
COMMENT ON FUNCTION get_department_pipeline_v2 IS
'Pipeline function with mensal/anual logic. Fixed ambiguous column reference by using alias "cat" instead of "quote_category" in UNION subquery.';


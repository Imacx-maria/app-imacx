-- =====================================================
-- UPDATE PIPELINE DATE RANGES TO MATCH REQUIREMENTS
-- =====================================================
-- MENSAL (MTD):
--   TOP 15: Last 45 days, sorted by value DESC, limit 15
--   NEEDS ATTENTION: 15-60 days old
--   PERDIDOS: 60-90 days old
--
-- ANUAL (YTD):
--   TOP 15: Since Jan 1 AND >60 days old, sorted by value DESC, limit 15
--   NEEDS ATTENTION: Since Jan 1, top 20 customers, >€10k, >30 days old
--   PERDIDOS: Since Jan 1 AND >60 days old
-- =====================================================

DROP FUNCTION IF EXISTS get_department_pipeline(TEXT, DATE, DATE);

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
) AS $$
DECLARE
  is_mensal BOOLEAN;
BEGIN
  -- Determine if this is mensal or anual based on start_date
  is_mensal := (start_date >= DATE_TRUNC('month', CURRENT_DATE)::DATE);
  
  RETURN QUERY
  WITH department_quotes AS (
    SELECT
      bo.document_number::TEXT as q_number,
      bo.document_date as q_date,
      cl.customer_name as c_name,
      bo.total_value as q_value,
      'Pendente'::TEXT as q_status,
      (CURRENT_DATE - bo.document_date)::INTEGER as q_days_open,
      bo.customer_id as q_customer_id
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    LEFT JOIN public.orcamentos_dismissed od ON bo.document_number::TEXT = od.orcamento_number
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
      AND od.orcamento_number IS NULL  -- Exclude dismissed
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
  top_customers_ytd AS (
    -- Only for anual needs_attention: get top 20 customers by YTD revenue
    SELECT DISTINCT fi.customer_id
    FROM phc.fi fi
    INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
    WHERE ft.invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
      AND ft.invoice_date <= CURRENT_DATE
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
    GROUP BY fi.customer_id
    ORDER BY SUM(fi.net_liquid_value) DESC
    LIMIT 20
  ),
  categorized_quotes AS (
    SELECT
      dq.*,
      CASE
        -- MENSAL MODE
        WHEN is_mensal AND dq.q_days_open <= 45 THEN 'top_15'
        WHEN is_mensal AND dq.q_days_open BETWEEN 15 AND 60 THEN 'needs_attention'
        WHEN is_mensal AND dq.q_days_open BETWEEN 60 AND 90 THEN 'lost'
        
        -- ANUAL MODE
        WHEN NOT is_mensal AND dq.q_days_open > 60 THEN 'top_15'  -- For anual: old quotes, we'll filter by value
        WHEN NOT is_mensal AND dq.q_days_open > 30 
          AND dq.q_customer_id IN (SELECT customer_id FROM top_customers_ytd)
          AND dq.q_value > 10000 THEN 'needs_attention'
        WHEN NOT is_mensal AND dq.q_days_open > 60 THEN 'lost'
        
        ELSE 'excluded'
      END as q_category,
      ROW_NUMBER() OVER (
        PARTITION BY
          CASE
            -- MENSAL
            WHEN is_mensal AND dq.q_days_open <= 45 THEN 'top_15'
            WHEN is_mensal AND dq.q_days_open BETWEEN 15 AND 60 THEN 'needs_attention'
            WHEN is_mensal AND dq.q_days_open BETWEEN 60 AND 90 THEN 'lost'
            -- ANUAL
            WHEN NOT is_mensal AND dq.q_days_open > 60 THEN 'top_15'
            WHEN NOT is_mensal AND dq.q_days_open > 30 
              AND dq.q_customer_id IN (SELECT customer_id FROM top_customers_ytd)
              AND dq.q_value > 10000 THEN 'needs_attention'
            WHEN NOT is_mensal AND dq.q_days_open > 60 THEN 'lost'
            ELSE 'excluded'
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
  WHERE cq.q_category != 'excluded'
    AND (
      (cq.q_category = 'top_15' AND cq.category_rank <= 15)
      OR cq.q_category IN ('needs_attention', 'lost')
    )
  ORDER BY
    CASE cq.q_category
      WHEN 'top_15' THEN 1
      WHEN 'needs_attention' THEN 2
      WHEN 'lost' THEN 3
    END,
    cq.q_value DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_department_pipeline TO authenticated;

COMMENT ON FUNCTION get_department_pipeline IS
'Pipeline quotes with dynamic date ranges based on period:
MENSAL: TOP15 (0-45d), ATTENTION (15-60d), LOST (60-90d)
ANUAL: TOP15 (>60d, top 15 by value), ATTENTION (>30d, top 20 customers, >10k), LOST (>60d)
Excludes dismissed and invoiced quotes.';

-- =====================================================
-- FIX get_department_pipeline FUNCTION ERRORS
-- =====================================================
-- Issues:
-- 1. Case-sensitive department name comparison
-- 2. Explicit column aliases to match RETURNS TABLE
-- 3. Add SECURITY DEFINER for proper permissions
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
) 
SECURITY DEFINER
SET search_path = public, phc
LANGUAGE plpgsql
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
    WHERE bo.document_date <= end_date  -- Include all quotes created up to end_date (regardless of start_date)
      AND bo.document_type = 'Orçamento'
      -- FIXED: Case-insensitive department comparison
      AND UPPER(TRIM(COALESCE(d.nome, 'IMACX'))) = UPPER(TRIM(departamento_nome))
      -- Only include quotes that are still actionable (0-90 days old)
      AND (CURRENT_DATE - bo.document_date)::INTEGER <= 90
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
        WHEN dq.q_days_open > 60 AND dq.q_days_open <= 90 THEN 'lost'  -- 60-90 days only
        ELSE 'ancient'  -- >90 days = too old, exclude from report
      END as q_category,
      ROW_NUMBER() OVER (
        PARTITION BY
          CASE
            WHEN dq.q_days_open <= 30 THEN 'top_15'
            WHEN dq.q_days_open > 30 AND dq.q_days_open <= 60 THEN 'needs_attention'
            WHEN dq.q_days_open > 60 AND dq.q_days_open <= 90 THEN 'lost'
            ELSE 'ancient'
          END
        ORDER BY dq.q_value DESC
      ) as category_rank
    FROM department_quotes dq
  )
  SELECT
    cq.q_number::TEXT as quote_number,
    cq.q_date::DATE as quote_date,
    cq.c_name::TEXT as customer_name,
    ROUND(cq.q_value, 2)::NUMERIC as quote_value,
    cq.q_status::TEXT as quote_status,
    cq.q_days_open::INTEGER as quote_days_open,
    cq.q_category::TEXT as quote_category  -- FIXED: Explicit alias to match RETURNS TABLE
  FROM categorized_quotes cq
  WHERE cq.category_rank <= 15
    AND cq.q_category != 'ancient'  -- Exclude >90 days
  ORDER BY
    CASE cq.q_category
      WHEN 'top_15' THEN 1
      WHEN 'needs_attention' THEN 2
      WHEN 'lost' THEN 3
    END,
    cq.q_value DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_department_pipeline(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_pipeline(TEXT, DATE, DATE) TO anon;

-- Comment explaining the fix
COMMENT ON FUNCTION get_department_pipeline IS
'Returns pipeline quotes categorized by age: top_15 (0-30 days), needs_attention (30-60 days), lost (60-90 days). Ancient quotes (>90 days) are excluded. Only returns top 15 per category by value. FIXES: Case-insensitive department name comparison (UPPER/TRIM), explicit column aliases to match RETURNS TABLE, SECURITY DEFINER for proper permissions';

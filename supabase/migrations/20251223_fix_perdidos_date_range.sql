-- =====================================================
-- FIX PERDIDOS DATE RANGE: 60-90 DAYS ONLY
-- =====================================================
-- Issue: "Perdidos" category includes ALL quotes >60 days (even 200+ days old)
-- Required: Show only RECENTLY lost quotes (60-90 days) for actionable follow-up
-- Business Logic:
--   - 0-30 days = Active pipeline (might still close)
--   - 30-60 days = Needs attention (urgent follow-up)
--   - 60-90 days = Recently lost (can try to revive) ← THIS IS PERDIDOS
--   - 90+ days = Ancient history (not actionable, exclude)
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
  quote_category TEXT,
  is_dismissed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH department_quotes AS (
    SELECT
      bo.document_number::TEXT as q_number,
      bo.document_date as q_date,
      cl.customer_name as c_name,
      bo.total_value as q_value,
      'Pendente'::TEXT as q_status,
      (CURRENT_DATE - bo.document_date)::INTEGER as q_days_open,
      COALESCE(od.is_dismissed, FALSE) as q_is_dismissed
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.orcamentos_dismissed od ON bo.document_number::TEXT = od.orcamento_number
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
        WHEN dq.q_is_dismissed THEN 'lost'  -- Dismissed quotes go to lost
        WHEN dq.q_days_open <= 30 THEN 'top_15'
        WHEN dq.q_days_open > 30 AND dq.q_days_open <= 60 THEN 'needs_attention'
        WHEN dq.q_days_open > 60 AND dq.q_days_open <= 90 THEN 'lost'  -- FIXED: 60-90 days only
        ELSE 'ancient'  -- NEW: >90 days = too old, exclude from report
      END as q_category,
      ROW_NUMBER() OVER (
        PARTITION BY
          CASE
            WHEN dq.q_is_dismissed THEN 'lost'
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
    cq.q_number,
    cq.q_date,
    cq.c_name,
    ROUND(cq.q_value, 2) as q_value,
    cq.q_status,
    cq.q_days_open,
    cq.q_category,
    cq.q_is_dismissed
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_department_pipeline TO authenticated;

-- Comment explaining the change
COMMENT ON FUNCTION get_department_pipeline IS
'Returns pipeline quotes categorized by age:
- top_15: 0-30 days (active pipeline)
- needs_attention: 30-60 days (urgent follow-up)
- lost: 60-90 days (recently lost, can try to revive)
- ancient: >90 days (excluded - too old to be actionable)

IMPORTANT: Only returns top 15 per category by value.
Quotes >90 days old are excluded as they are not actionable.';

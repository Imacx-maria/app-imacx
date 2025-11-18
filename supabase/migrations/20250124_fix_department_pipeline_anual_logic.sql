-- =====================================================
-- FIX DEPARTMENT PIPELINE: ANUAL VIEW LOGIC
-- =====================================================
-- Date: 2025-01-24
-- Issue: The get_department_pipeline function has incorrect categorization for ANUAL view
--
-- Current (WRONG):
--   - top_15: 0-30 days
--   - needs_attention: 30-60 days
--   - lost: 60-90 days + dismissed
--
-- Requirement (ANUAL VIEW ONLY):
--   - TOP 15: Maiores orçamentos pendentes com 90-120 dias (≥90 AND <120)
--   - NEEDS ATTENTION: Maiores orçamentos pendentes com 60-90 dias (≥60 AND <90)
--   - PERDIDOS: Maiores orçamentos perdidos desde o início do ano (YTD + dismissed)
--
-- Business Logic:
--   1. TOP 15: Only active quotes, 90-120 days old, top 15 by value
--   2. NEEDS ATTENTION: Only active quotes, 60-90 days old, sorted by value
--   3. PERDIDOS: Dismissed OR no matching invoice, YTD only, sorted by value
--
-- NOTE: The frontend filters perdidos to 60-90 days via:
--   const filteredPerdidos = pipeline.perdidos.filter((item) =>
--     dias >= 60 && dias <= 90
--   );
--
-- So SQL returns ALL perdidos (60+), frontend applies additional filtering
-- =====================================================

-- Drop the old function
DROP FUNCTION IF EXISTS get_department_pipeline(TEXT, DATE, DATE) CASCADE;

-- Create the corrected function
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
  WITH year_start AS (
    -- Year-to-date boundary
    SELECT DATE_TRUNC('year', CURRENT_DATE)::DATE as ytd_start
  ),
  department_quotes AS (
    -- Base query: all quotes with department and age info
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
      -- Exclude invoiced quotes (BiStamp chain - current year)
      AND NOT EXISTS (
        SELECT 1
        FROM phc.bi bi
        INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
        INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
      -- Exclude invoiced quotes (BiStamp chain - 2-year historical)
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
    -- ANUAL VIEW CATEGORIZATION (business logic from CLAUDE.md)
    SELECT
      dq.*,
      CASE
        -- PERDIDOS: Dismissed quotes OR older quotes without invoice, YTD only
        WHEN dq.q_is_dismissed AND dq.q_date >= (SELECT ytd_start FROM year_start) THEN 'lost'
        -- TOP 15: Active quotes, 90-120 days old (≥90 AND <120)
        WHEN NOT dq.q_is_dismissed AND dq.q_days_open >= 90 AND dq.q_days_open < 120 THEN 'top_15'
        -- NEEDS ATTENTION: Active quotes, 60-90 days old (≥60 AND <90)
        WHEN NOT dq.q_is_dismissed AND dq.q_days_open >= 60 AND dq.q_days_open < 90 THEN 'needs_attention'
        -- PERDIDOS: Active quotes >120 days old or dismissed, YTD only
        WHEN (dq.q_days_open >= 120 OR dq.q_is_dismissed) AND dq.q_date >= (SELECT ytd_start FROM year_start) THEN 'lost'
        -- Exclude everything else (pre-YTD active quotes)
        ELSE NULL
      END as q_category,
      -- Ranking within each category by value (for LIMIT 15 on TOP_15)
      ROW_NUMBER() OVER (
        PARTITION BY
          CASE
            WHEN dq.q_is_dismissed AND dq.q_date >= (SELECT ytd_start FROM year_start) THEN 'lost'
            WHEN NOT dq.q_is_dismissed AND dq.q_days_open >= 90 AND dq.q_days_open < 120 THEN 'top_15'
            WHEN NOT dq.q_is_dismissed AND dq.q_days_open >= 60 AND dq.q_days_open < 90 THEN 'needs_attention'
            WHEN (dq.q_days_open >= 120 OR dq.q_is_dismissed) AND dq.q_date >= (SELECT ytd_start FROM year_start) THEN 'lost'
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
  WHERE cq.q_category IS NOT NULL
    AND (
      -- TOP 15: Only top 15 by value
      (cq.q_category = 'top_15' AND cq.category_rank <= 15)
      -- NEEDS ATTENTION: All (no limit)
      OR cq.q_category = 'needs_attention'
      -- PERDIDOS: All (frontend filters to 60-90 days)
      OR cq.q_category = 'lost'
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

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_department_pipeline(TEXT, DATE, DATE) TO authenticated;

-- Document the function behavior
COMMENT ON FUNCTION get_department_pipeline IS
'Returns pipeline quotes for ANUAL view categorized by business rules:

TOP 15 (Maiores orçamentos pendentes 90-120 dias):
  - Active quotes only (not dismissed)
  - No invoice exists (BiStamp chain verified)
  - Days open: ≥90 AND <120 days
  - Sorted by value DESC
  - Limited to TOP 15

NEEDS ATTENTION (Maiores orçamentos pendentes 60-90 dias):
  - Active quotes only (not dismissed)
  - No invoice exists
  - Days open: ≥60 AND <90 days
  - Sorted by value DESC
  - No limit

PERDIDOS (Maiores orçamentos perdidos YTD):
  - Dismissed flag = TRUE OR days open ≥120
  - Quote date must be YTD (≥2025-01-01)
  - Sorted by value DESC
  - No limit (frontend filters to 60-90 days for report)

CRITICAL: BETWEEN logic uses exclusive upper bounds via <120 and <90
because the business wants non-overlapping categories.
';

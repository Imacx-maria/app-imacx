-- Migration: Fix Reuniões Tabs with Dynamic Date Ranges
-- Date: 2025-11-18
-- Description: Create new parameterized RPC function for pipeline tabs with mensal/anual modes

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_department_pipeline_v2(TEXT, TEXT, TEXT);

-- Create new parameterized pipeline function
CREATE OR REPLACE FUNCTION public.get_department_pipeline_v2(
  departamento_nome TEXT,
  period TEXT,  -- 'mensal' or 'anual'
  tab_type TEXT -- 'top15', 'attention', or 'perdidos'
)
RETURNS TABLE (
  document_number TEXT,
  customer_name TEXT,
  total_value NUMERIC,
  document_date DATE,
  days_pending INTEGER,
  observacoes TEXT,
  nome_trabalho TEXT,
  orcamento_id_humano TEXT,
  customer_id TEXT
) AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  days_ago_start INTEGER;
  days_ago_end INTEGER;
BEGIN
  -- Determine date ranges based on period and tab_type
  IF period = 'mensal' THEN
    -- MENSAL logic
    IF tab_type = 'top15' THEN
      -- TOP 15: Últimos 45 dias
      start_date := CURRENT_DATE - INTERVAL '45 days';
      end_date := CURRENT_DATE;
      days_ago_start := NULL;
      days_ago_end := NULL;
    ELSIF tab_type = 'attention' THEN
      -- NEEDS ATTENTION: Entre 15 e 60 dias
      start_date := CURRENT_DATE - INTERVAL '60 days';
      end_date := CURRENT_DATE - INTERVAL '15 days';
      days_ago_start := 15;
      days_ago_end := 60;
    ELSIF tab_type = 'perdidos' THEN
      -- PERDIDOS: Entre 60 e 90 dias
      start_date := CURRENT_DATE - INTERVAL '90 days';
      end_date := CURRENT_DATE - INTERVAL '60 days';
      days_ago_start := 60;
      days_ago_end := 90;
    END IF;
  ELSIF period = 'anual' THEN
    -- ANUAL logic
    IF tab_type = 'top15' THEN
      -- TOP 15 ANUAL: Desde 1 janeiro até 60 dias atrás (auto-perdidos)
      start_date := DATE_TRUNC('year', CURRENT_DATE)::DATE;
      end_date := CURRENT_DATE;
      days_ago_start := NULL;
      days_ago_end := NULL;
    ELSIF tab_type = 'attention' THEN
      -- NEEDS ATTENTION ANUAL: Desde 1 janeiro, mais de 30 dias atrás
      -- (will be further filtered by top 20 customers and >€10k in query)
      start_date := DATE_TRUNC('year', CURRENT_DATE)::DATE;
      end_date := CURRENT_DATE - INTERVAL '30 days';
      days_ago_start := NULL;
      days_ago_end := NULL;
    ELSIF tab_type = 'perdidos' THEN
      -- PERDIDOS ANUAL: Desde 1 janeiro até 60 dias atrás
      start_date := DATE_TRUNC('year', CURRENT_DATE)::DATE;
      end_date := CURRENT_DATE;
      days_ago_start := NULL;
      days_ago_end := NULL;
    END IF;
  END IF;

  -- Main query with department filtering and dismissal/invoice exclusion
  RETURN QUERY
  WITH top_customers AS (
    -- Only used for anual attention tab
    SELECT DISTINCT
      fi.customer_id,
      SUM(fi.net_liquid_value) as total_revenue
    FROM phc.fi fi
    INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
    WHERE ft.invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
      AND ft.invoice_date <= CURRENT_DATE
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
    GROUP BY fi.customer_id
    ORDER BY total_revenue DESC
    LIMIT 20
  )
  SELECT DISTINCT
    bo.document_number::TEXT,
    COALESCE(cl.customer_name, 'N/A')::TEXT as customer_name,
    bo.total_value::NUMERIC,
    bo.document_date::DATE,
    (CURRENT_DATE - bo.document_date::DATE)::INTEGER as days_pending,
    bo.observacoes::TEXT,
    bo.nome_trabalho::TEXT,
    CONCAT('ORC-', LPAD(bo.document_number::TEXT, 5, '0'))::TEXT as orcamento_id_humano,
    bo.customer_id::TEXT
  FROM phc.bo bo
  LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
  LEFT JOIN public.user_siglas us
    ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
  LEFT JOIN public.profiles p ON us.profile_id = p.id
  LEFT JOIN public.departamentos d ON p.departamento_id = d.id
  LEFT JOIN public.orcamentos_dismissed od ON bo.document_number::TEXT = od.orcamento_number
  WHERE
    -- Department filter
    COALESCE(d.nome, 'IMACX') = departamento_nome
    -- Document type filter
    AND bo.document_type = 'Orçamento'
    -- Date range filter
    AND bo.document_date >= start_date
    AND bo.document_date <= end_date
    -- Dismissed handling
    AND (
      (period = 'anual' AND tab_type = 'perdidos') OR (period = 'anual' AND tab_type IN ('top15', 'attention') AND COALESCE(od.is_dismissed, FALSE) = FALSE)
      OR (period != 'anual' AND od.orcamento_number IS NULL)
    )
    -- Annual status/day filters
    AND (
      period != 'anual'
      OR (period = 'anual' AND tab_type = 'top15' AND bo.status = 'pendente' AND bo.document_date >= DATE_TRUNC('year', CURRENT_DATE))
      OR (period = 'anual' AND tab_type = 'attention' AND bo.status = 'pendente' AND bo.document_date >= DATE_TRUNC('year', CURRENT_DATE) AND (CURRENT_DATE - bo.document_date::DATE) >= 30)
      OR (period = 'anual' AND tab_type = 'perdidos' AND bo.document_date >= DATE_TRUNC('year', CURRENT_DATE) AND (bo.status = 'perdido' OR COALESCE(od.is_dismissed, FALSE) = TRUE))
    )
    -- Not invoiced (BiStamp chain check)
    AND NOT EXISTS (
      SELECT 1
      FROM phc.bi bi
      INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
      INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
      WHERE bi.document_id = bo.document_id
        AND (ft.anulado IS NULL OR ft.anulado != 'True')
    )
    -- Special filter for anual attention: top 20 customers + >€10k
    AND (
      (period = 'anual' AND tab_type = 'attention' AND bo.customer_id IN (SELECT customer_id FROM top_customers) AND bo.total_value > 10000)
      OR (period != 'anual' OR tab_type != 'attention')
    )
  ORDER BY
    -- Sorting logic per tab
    CASE
      WHEN tab_type = 'top15' THEN bo.total_value
      WHEN tab_type = 'perdidos' AND period = 'anual' THEN bo.total_value
      ELSE (CURRENT_DATE - bo.document_date::DATE)::NUMERIC
    END DESC
  LIMIT
    CASE
      WHEN tab_type = 'top15' THEN 15
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_department_pipeline_v2(TEXT, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_department_pipeline_v2(TEXT, TEXT, TEXT) IS
'Returns pipeline quotes for department with dynamic date ranges based on period (mensal/anual) and tab type (top15/attention/perdidos). Filters out dismissed and invoiced quotes.';

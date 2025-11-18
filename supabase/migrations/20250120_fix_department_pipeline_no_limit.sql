-- =====================================================================
-- Fix: get_department_pipeline_v2 to handle all quotes without 1000 row limit
-- 
-- Issue: The function returns individual quote rows via UNION ALL.
-- If there are more than 1000 quotes total, some will be missing.
-- 
-- Solution: Create separate functions per category so each can return
-- up to 1000 rows independently, giving us 3000 total capacity.
-- =====================================================================

-- Create separate functions for each category
-- This allows each category to return up to 1000 rows independently

-- 1. Function for Top 15 quotes (already limited to 15, but keeping separate for consistency)
CREATE OR REPLACE FUNCTION get_department_pipeline_top15(
  departamento_nome text, 
  start_date date, 
  end_date date
)
RETURNS TABLE(
  quote_number text, 
  quote_date date, 
  customer_name text, 
  quote_value numeric, 
  quote_status text, 
  quote_days_open integer, 
  is_dismissed boolean
)
SECURITY DEFINER
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
      'PENDENTE'::TEXT as q_status,
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
        SELECT 1 FROM phc.bi bi
        INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
        INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
      AND NOT EXISTS (
        SELECT 1 FROM phc.bi bi
        INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp
        INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
  )
  SELECT
    dq.q_number,
    dq.q_date,
    dq.c_name,
    ROUND(dq.q_value, 2),
    dq.q_status,
    dq.q_days_open,
    dq.q_is_dismissed
  FROM department_quotes dq
  WHERE dq.q_is_dismissed = FALSE
    AND dq.q_days_open <= 60
  ORDER BY dq.q_value DESC
  LIMIT 15;
END;
$$;

-- 2. Function for Needs Attention quotes (all quotes 0-30 days, up to 1000)
CREATE OR REPLACE FUNCTION get_department_pipeline_needs_attention(
  departamento_nome text, 
  start_date date, 
  end_date date
)
RETURNS TABLE(
  quote_number text, 
  quote_date date, 
  customer_name text, 
  quote_value numeric, 
  quote_status text, 
  quote_days_open integer, 
  is_dismissed boolean
)
SECURITY DEFINER
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
      'PENDENTE'::TEXT as q_status,
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
        SELECT 1 FROM phc.bi bi
        INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
        INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
      AND NOT EXISTS (
        SELECT 1 FROM phc.bi bi
        INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp
        INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
  )
  SELECT
    dq.q_number,
    dq.q_date,
    dq.c_name,
    ROUND(dq.q_value, 2),
    dq.q_status,
    dq.q_days_open,
    dq.q_is_dismissed
  FROM department_quotes dq
  WHERE dq.q_is_dismissed = FALSE
    AND dq.q_days_open >= 0
    AND dq.q_days_open <= 30
  ORDER BY dq.q_value DESC;
  -- No LIMIT - returns all matching quotes (up to 1000 from RPC limit)
END;
$$;

-- 3. Function for Perdidos quotes (all quotes 45+ days or dismissed, up to 1000)
CREATE OR REPLACE FUNCTION get_department_pipeline_perdidos(
  departamento_nome text, 
  start_date date, 
  end_date date
)
RETURNS TABLE(
  quote_number text, 
  quote_date date, 
  customer_name text, 
  quote_value numeric, 
  quote_status text, 
  quote_days_open integer, 
  is_dismissed boolean
)
SECURITY DEFINER
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
      'PENDENTE'::TEXT as q_status,
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
        SELECT 1 FROM phc.bi bi
        INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
        INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
      AND NOT EXISTS (
        SELECT 1 FROM phc.bi bi
        INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp
        INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
        WHERE bi.document_id = bo.document_id
          AND (ft.anulado IS NULL OR ft.anulado != 'True')
      )
  )
  SELECT
    dq.q_number,
    dq.q_date,
    dq.c_name,
    ROUND(dq.q_value, 2),
    dq.q_status,
    dq.q_days_open,
    dq.q_is_dismissed
  FROM department_quotes dq
  WHERE dq.q_days_open >= 45 OR dq.q_is_dismissed = TRUE
  ORDER BY dq.q_value DESC;
  -- No LIMIT - returns all matching quotes (up to 1000 from RPC limit)
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_department_pipeline_top15(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_pipeline_needs_attention(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_pipeline_perdidos(TEXT, DATE, DATE) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_department_pipeline_top15 IS 
'Returns top 15 quotes by value (0-60 days old) for a department. Limited to 15 rows, safe from 1000 row limit.';

COMMENT ON FUNCTION get_department_pipeline_needs_attention IS 
'Returns all quotes that need attention (0-30 days old) for a department. 
Can return up to 1000 rows (Supabase RPC limit). Ordered by value DESC.';

COMMENT ON FUNCTION get_department_pipeline_perdidos IS 
'Returns all lost quotes (45+ days old or dismissed) for a department. 
Can return up to 1000 rows (Supabase RPC limit). Ordered by value DESC.';


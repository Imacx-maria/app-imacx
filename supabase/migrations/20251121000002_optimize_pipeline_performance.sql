-- =====================================================================
-- Optimize Department Pipeline Performance
--
-- Issue: Pipeline queries timeout for IMACX/Digital on annual periods
-- Root Cause: NOT EXISTS subqueries scan all FI/BI rows without indexes
--
-- Solution:
-- 1. Add indexes on BI.document_id for faster EXISTS checks
-- 2. Add indexes on FI.bistamp for JOIN optimization
-- 3. Rewrite queries to use LEFT JOIN instead of NOT EXISTS (more efficient)
-- 4. Add statement_timeout hint for complex queries
-- =====================================================================

-- Step 1: Add critical indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_bi_document_id ON phc.bi(document_id);
CREATE INDEX IF NOT EXISTS idx_fi_bistamp ON phc.fi(bistamp);

-- Note: We cannot create indexes on phc.bo or phc.cl since they're ETL-managed
-- But we can optimize the query structure to minimize full table scans

-- Step 2: Create a helper function to check if quote is converted
-- This function uses a simpler query structure that's easier for Postgres to optimize
CREATE OR REPLACE FUNCTION is_quote_converted(p_document_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM phc.bi bi
    INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
    INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
    WHERE bi.document_id = p_document_id
      AND COALESCE(ft.anulado, 'False') != 'True'
    LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM phc.bi bi
    INNER JOIN phc."2years_fi" fi ON bi.line_id = fi.bistamp
    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
    WHERE bi.document_id = p_document_id
      AND COALESCE(ft.anulado, 'False') != 'True'
    LIMIT 1
  );
$$;

-- Step 3: Rewrite the pipeline functions with optimized query structure
-- Key optimizations:
-- - Use CTE with materialization hint
-- - Filter by date FIRST (most selective)
-- - Use helper function for conversion check
-- - Add query hints for better performance

-- 1. Optimized Top 15 Function
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
SET statement_timeout = '20s'
AS $$
BEGIN
  RETURN QUERY
  WITH department_quotes AS MATERIALIZED (
    SELECT
      bo.document_number::TEXT as q_number,
      bo.document_id as q_doc_id,
      bo.document_date as q_date,
      cl.customer_name as c_name,
      bo.total_value as q_value,
      (CURRENT_DATE - bo.document_date)::INTEGER as q_days_open,
      COALESCE(cl.salesperson, 'IMACX') as salesperson,
      COALESCE(od.is_dismissed, FALSE) as q_is_dismissed
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.orcamentos_dismissed od ON bo.document_number::TEXT = od.orcamento_number
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
  )
  SELECT
    dq.q_number,
    dq.q_date,
    dq.c_name,
    ROUND(dq.q_value, 2),
    'PENDENTE'::TEXT,
    dq.q_days_open,
    dq.q_is_dismissed
  FROM department_quotes dq
  LEFT JOIN public.user_siglas us
    ON UPPER(TRIM(dq.salesperson)) = UPPER(TRIM(us.sigla))
  LEFT JOIN public.profiles p ON us.profile_id = p.id
  LEFT JOIN public.departamentos d ON p.departamento_id = d.id
  WHERE COALESCE(d.nome, 'IMACX') = departamento_nome
    AND dq.q_is_dismissed = FALSE
    AND dq.q_days_open <= 60
    AND NOT is_quote_converted(dq.q_doc_id)
  ORDER BY dq.q_value DESC
  LIMIT 15;
END;
$$;

-- 2. Optimized Needs Attention Function
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
SET statement_timeout = '20s'
AS $$
BEGIN
  RETURN QUERY
  WITH department_quotes AS MATERIALIZED (
    SELECT
      bo.document_number::TEXT as q_number,
      bo.document_id as q_doc_id,
      bo.document_date as q_date,
      cl.customer_name as c_name,
      bo.total_value as q_value,
      (CURRENT_DATE - bo.document_date)::INTEGER as q_days_open,
      COALESCE(cl.salesperson, 'IMACX') as salesperson,
      COALESCE(od.is_dismissed, FALSE) as q_is_dismissed
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.orcamentos_dismissed od ON bo.document_number::TEXT = od.orcamento_number
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND (CURRENT_DATE - bo.document_date) >= 0
      AND (CURRENT_DATE - bo.document_date) <= 30
  )
  SELECT
    dq.q_number,
    dq.q_date,
    dq.c_name,
    ROUND(dq.q_value, 2),
    'PENDENTE'::TEXT,
    dq.q_days_open,
    dq.q_is_dismissed
  FROM department_quotes dq
  LEFT JOIN public.user_siglas us
    ON UPPER(TRIM(dq.salesperson)) = UPPER(TRIM(us.sigla))
  LEFT JOIN public.profiles p ON us.profile_id = p.id
  LEFT JOIN public.departamentos d ON p.departamento_id = d.id
  WHERE COALESCE(d.nome, 'IMACX') = departamento_nome
    AND dq.q_is_dismissed = FALSE
    AND NOT is_quote_converted(dq.q_doc_id)
  ORDER BY dq.q_value DESC;
END;
$$;

-- 3. Optimized Perdidos Function (Most Critical - This is timing out)
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
SET statement_timeout = '20s'
AS $$
BEGIN
  RETURN QUERY
  WITH department_quotes AS MATERIALIZED (
    SELECT
      bo.document_number::TEXT as q_number,
      bo.document_id as q_doc_id,
      bo.document_date as q_date,
      cl.customer_name as c_name,
      bo.total_value as q_value,
      (CURRENT_DATE - bo.document_date)::INTEGER as q_days_open,
      COALESCE(cl.salesperson, 'IMACX') as salesperson,
      COALESCE(od.is_dismissed, FALSE) as q_is_dismissed
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.orcamentos_dismissed od ON bo.document_number::TEXT = od.orcamento_number
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND ((CURRENT_DATE - bo.document_date) >= 45 OR COALESCE(od.is_dismissed, FALSE) = TRUE)
  )
  SELECT
    dq.q_number,
    dq.q_date,
    dq.c_name,
    ROUND(dq.q_value, 2),
    'PENDENTE'::TEXT,
    dq.q_days_open,
    dq.q_is_dismissed
  FROM department_quotes dq
  LEFT JOIN public.user_siglas us
    ON UPPER(TRIM(dq.salesperson)) = UPPER(TRIM(us.sigla))
  LEFT JOIN public.profiles p ON us.profile_id = p.id
  LEFT JOIN public.departamentos d ON p.departamento_id = d.id
  WHERE COALESCE(d.nome, 'IMACX') = departamento_nome
    AND NOT is_quote_converted(dq.q_doc_id)
  ORDER BY dq.q_value DESC;
END;
$$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION is_quote_converted(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_pipeline_top15(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_pipeline_needs_attention(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_pipeline_perdidos(TEXT, DATE, DATE) TO authenticated;

-- Step 5: Add helpful comments
COMMENT ON FUNCTION is_quote_converted IS
'Helper function to check if a quote (by document_id) has been converted to an invoice.
Uses indexes on bi.document_id and fi.bistamp for fast lookups.';

COMMENT ON FUNCTION get_department_pipeline_top15 IS
'OPTIMIZED: Returns top 15 quotes by value (0-60 days old) for a department.
Uses materialized CTE and helper function for better performance. Timeout: 20s.';

COMMENT ON FUNCTION get_department_pipeline_needs_attention IS
'OPTIMIZED: Returns quotes needing attention (0-30 days old) for a department.
Uses materialized CTE and helper function for better performance. Timeout: 20s.';

COMMENT ON FUNCTION get_department_pipeline_perdidos IS
'OPTIMIZED: Returns lost quotes (45+ days old or dismissed) for a department.
Uses materialized CTE and helper function for better performance. Timeout: 20s.';

-- =====================================================================
-- Department KPI RPC Functions
-- Created: 2025-11-17
-- Purpose: Calculate KPI metrics filtered by department for dashboard cards
-- =====================================================================

-- =====================================================================
-- Function: calculate_department_kpis
-- Purpose: Calculate department-specific invoice KPIs (revenue, invoices, customers)
-- Parameters:
--   - departamento_nome: Department name (Brindes, Digital, IMACX)
--   - start_date: Start of period (YYYY-MM-DD)
--   - end_date: End of period (YYYY-MM-DD)
--   - source_table: 'ft' (current year) or '2years_ft' (historical)
-- Returns: Revenue, invoice count, customer count, avg invoice value
-- =====================================================================
CREATE OR REPLACE FUNCTION calculate_department_kpis(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'ft'
)
RETURNS TABLE(
  revenue NUMERIC,
  invoice_count BIGINT,
  customer_count BIGINT,
  avg_invoice_value NUMERIC
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  query_text TEXT;
BEGIN
  -- Validate source_table to prevent SQL injection
  IF source_table NOT IN ('ft', '2years_ft') THEN
    RAISE EXCEPTION 'Invalid source_table: %. Must be ft or 2years_ft', source_table;
  END IF;

  -- Build dynamic query with department filtering
  query_text := format($query$
    SELECT
      COALESCE(SUM(
        CASE
          WHEN ft.document_type = 'Factura' THEN ft.net_value
          WHEN ft.document_type = 'Nota de Crédito' THEN -ft.net_value
          ELSE 0
        END
      ), 0) AS revenue,
      COUNT(*) AS invoice_count,
      COUNT(DISTINCT ft.customer_id) AS customer_count,
      COALESCE(
        SUM(
          CASE
            WHEN ft.document_type = 'Factura' THEN ft.net_value
            WHEN ft.document_type = 'Nota de Crédito' THEN -ft.net_value
            ELSE 0
          END
        ) / NULLIF(COUNT(CASE WHEN ft.document_type = 'Factura' THEN 1 END), 0),
        0
      ) AS avg_invoice_value
    FROM phc.%I ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= $1
      AND ft.invoice_date <= $2
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND ft.document_type IN ('Factura', 'Nota de Crédito')
      AND COALESCE(d.nome, 'IMACX') = $3
  $query$, source_table);

  -- Execute and return
  RETURN QUERY EXECUTE query_text USING start_date, end_date, departamento_nome;
END;
$$;

-- =====================================================================
-- Function: calculate_department_quotes
-- Purpose: Calculate department-specific quote KPIs
-- Parameters:
--   - departamento_nome: Department name (Brindes, Digital, IMACX)
--   - start_date: Start of period (YYYY-MM-DD)
--   - end_date: End of period (YYYY-MM-DD)
--   - source_table: 'bo' (current year) or '2years_bo' (historical)
-- Returns: Total quote value and count
-- =====================================================================
CREATE OR REPLACE FUNCTION calculate_department_quotes(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'bo'
)
RETURNS TABLE(
  quote_value NUMERIC,
  quote_count BIGINT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  query_text TEXT;
BEGIN
  -- Validate source_table to prevent SQL injection
  IF source_table NOT IN ('bo', '2years_bo') THEN
    RAISE EXCEPTION 'Invalid source_table: %. Must be bo or 2years_bo', source_table;
  END IF;

  -- Build dynamic query with department filtering
  query_text := format($query$
    SELECT
      COALESCE(SUM(bo.total_value), 0) AS quote_value,
      COUNT(*) AS quote_count
    FROM phc.%I bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= $1
      AND bo.document_date <= $2
      AND bo.document_type = 'Orçamento'
      AND COALESCE(d.nome, 'IMACX') = $3
  $query$, source_table);

  -- Execute and return
  RETURN QUERY EXECUTE query_text USING start_date, end_date, departamento_nome;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_department_kpis(TEXT, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_department_quotes(TEXT, DATE, DATE, TEXT) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION calculate_department_kpis IS 'Calculate department-specific KPIs for invoices. Filters through user_siglas → profiles → departamentos chain.';
COMMENT ON FUNCTION calculate_department_quotes IS 'Calculate department-specific KPIs for quotes. Filters through user_siglas → profiles → departamentos chain.';

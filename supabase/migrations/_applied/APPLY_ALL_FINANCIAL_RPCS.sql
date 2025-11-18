-- =====================================================================
-- COMPLETE FINANCIAL ANALYSIS RPC FUNCTIONS
-- Apply this ONCE in Supabase Dashboard SQL Editor
-- Date: 2025-12-16
-- =====================================================================

-- =====================================================================
-- 1. get_invoices_for_period
-- =====================================================================
CREATE OR REPLACE FUNCTION get_invoices_for_period(
  start_date DATE,
  end_date DATE,
  use_historical BOOLEAN DEFAULT false
)
RETURNS TABLE(
  invoice_id TEXT,
  customer_id INTEGER,
  net_value NUMERIC,
  invoice_date DATE,
  document_type TEXT,
  anulado TEXT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  source_table TEXT;
BEGIN
  IF use_historical THEN
    source_table := '2years_ft';
  ELSE
    source_table := 'ft';
  END IF;

  RETURN QUERY EXECUTE format($query$
    SELECT
      invoice_id::TEXT,
      customer_id::INTEGER,
      net_value::NUMERIC,
      invoice_date::DATE,
      document_type::TEXT,
      anulado::TEXT
    FROM phc.%I
    WHERE invoice_date >= $1
      AND invoice_date <= $2
    ORDER BY invoice_date ASC
  $query$, source_table)
  USING start_date, end_date;
END;
$$;

GRANT EXECUTE ON FUNCTION get_invoices_for_period(DATE, DATE, BOOLEAN) TO authenticated;
COMMENT ON FUNCTION get_invoices_for_period IS 'Get all invoices for a date range. Returns raw invoice data for client-side processing.';

-- =====================================================================
-- 2. get_customers_by_ids
-- =====================================================================
CREATE OR REPLACE FUNCTION get_customers_by_ids(
  customer_ids INTEGER[]
)
RETURNS TABLE(
  customer_id INTEGER,
  customer_name TEXT,
  city TEXT,
  salesperson TEXT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.customer_id::INTEGER,
    cl.customer_name::TEXT,
    cl.city::TEXT,
    cl.salesperson::TEXT
  FROM phc.cl
  WHERE cl.customer_id = ANY(customer_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION get_customers_by_ids(INTEGER[]) TO authenticated;
COMMENT ON FUNCTION get_customers_by_ids IS 'Get customer details for a list of customer IDs. Uses SECURITY DEFINER to bypass RLS.';

-- =====================================================================
-- 3. get_monthly_revenue_breakdown
-- =====================================================================
CREATE OR REPLACE FUNCTION get_monthly_revenue_breakdown(
  target_year INTEGER,
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  period TEXT,
  total_invoices BIGINT,
  valid_invoices BIGINT,
  net_revenue NUMERIC,
  gross_revenue NUMERIC,
  avg_invoice_value NUMERIC
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  source_table TEXT;
  start_date DATE;
BEGIN
  IF target_year = EXTRACT(YEAR FROM CURRENT_DATE) THEN
    source_table := 'ft';
  ELSE
    source_table := '2years_ft';
  END IF;

  start_date := make_date(target_year, 1, 1);

  RETURN QUERY EXECUTE format($query$
    SELECT
      TO_CHAR(invoice_date, 'YYYY-MM') AS period,
      COUNT(*) AS total_invoices,
      COUNT(CASE WHEN document_type = 'Factura' THEN 1 END) AS valid_invoices,
      ROUND(
        COALESCE(SUM(
          CASE
            WHEN document_type = 'Factura' THEN net_value
            WHEN document_type = 'Nota de Crédito' THEN -net_value
            ELSE 0
          END
        ), 0)::numeric,
        2
      ) AS net_revenue,
      ROUND(
        COALESCE(SUM(ABS(net_value)), 0)::numeric,
        2
      ) AS gross_revenue,
      ROUND(
        COALESCE(
          SUM(
            CASE
              WHEN document_type = 'Factura' THEN net_value
              WHEN document_type = 'Nota de Crédito' THEN -net_value
              ELSE 0
            END
          ) / NULLIF(COUNT(CASE WHEN document_type = 'Factura' THEN 1 END), 0),
          0
        )::numeric,
        2
      ) AS avg_invoice_value
    FROM phc.%I
    WHERE invoice_date >= $1
      AND invoice_date <= $2
      AND (anulado IS NULL OR anulado != 'True')
      AND document_type IN ('Factura', 'Nota de Crédito')
    GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
    ORDER BY period ASC
  $query$, source_table)
  USING start_date, end_date;
END;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_revenue_breakdown(INTEGER, DATE) TO authenticated;
COMMENT ON FUNCTION get_monthly_revenue_breakdown IS 'Get monthly revenue breakdown for a specific year, automatically selecting correct source table.';

-- =====================================================================
-- DONE! All RPC functions created.
-- =====================================================================

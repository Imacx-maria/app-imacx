-- =====================================================================
-- RPC Functions for Financial Analysis
-- Created: 2025-12-16
-- Purpose: Provide secure, performant access to PHC financial data
-- =====================================================================

-- =====================================================================
-- Function: calculate_ytd_kpis
-- Purpose: Calculate YTD KPIs (revenue, invoices, customers) for any date range
-- Parameters:
--   - start_date: Start of period (YYYY-MM-DD)
--   - end_date: End of period (YYYY-MM-DD)
--   - source_table: 'ft' (current year) or '2years_ft' (historical)
-- Returns: JSON object with revenue, invoices, customers, avgInvoiceValue
-- =====================================================================
CREATE OR REPLACE FUNCTION calculate_ytd_kpis(
  start_date DATE,
  end_date DATE,
  source_table TEXT DEFAULT 'ft'
)
RETURNS TABLE(
  revenue NUMERIC,
  invoices BIGINT,
  customers BIGINT,
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

  -- Build dynamic query
  query_text := format($query$
    SELECT
      COALESCE(SUM(
        CASE
          WHEN document_type = 'Factura' THEN net_value
          WHEN document_type = 'Nota de Crédito' THEN -net_value
          ELSE 0
        END
      ), 0) AS revenue,
      COUNT(*) AS invoices,
      COUNT(DISTINCT customer_id) AS customers,
      COALESCE(
        SUM(
          CASE
            WHEN document_type = 'Factura' THEN net_value
            WHEN document_type = 'Nota de Crédito' THEN -net_value
            ELSE 0
          END
        ) / NULLIF(COUNT(CASE WHEN document_type = 'Factura' THEN 1 END), 0),
        0
      ) AS avg_invoice_value
    FROM phc.%I
    WHERE invoice_date >= $1
      AND invoice_date <= $2
      AND (anulado IS NULL OR anulado != 'True')
      AND document_type IN ('Factura', 'Nota de Crédito')
  $query$, source_table);

  -- Execute and return
  RETURN QUERY EXECUTE query_text USING start_date, end_date;
END;
$$;

-- =====================================================================
-- Function: get_monthly_revenue_breakdown
-- Purpose: Get monthly revenue breakdown for a year
-- Parameters:
--   - target_year: Year to analyze (e.g., 2025)
--   - end_date: Optional end date (defaults to current date)
-- Returns: Monthly revenue data with aggregates
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
  -- Determine source table
  IF target_year = EXTRACT(YEAR FROM CURRENT_DATE) THEN
    source_table := 'ft';
  ELSE
    source_table := '2years_ft';
  END IF;

  -- Set start date to January 1 of target year
  start_date := make_date(target_year, 1, 1);

  -- Return monthly aggregated data
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_ytd_kpis(DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_revenue_breakdown(INTEGER, DATE) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION calculate_ytd_kpis IS 'Calculate YTD KPIs for any date range. Use source_table=ft for current year, 2years_ft for historical.';
COMMENT ON FUNCTION get_monthly_revenue_breakdown IS 'Get monthly revenue breakdown for a specific year, automatically selecting correct source table.';

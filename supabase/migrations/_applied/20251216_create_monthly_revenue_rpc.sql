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
GRANT EXECUTE ON FUNCTION get_monthly_revenue_breakdown(INTEGER, DATE) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_monthly_revenue_breakdown IS 'Get monthly revenue breakdown for a specific year, automatically selecting correct source table (ft for current year, 2years_ft for historical).';

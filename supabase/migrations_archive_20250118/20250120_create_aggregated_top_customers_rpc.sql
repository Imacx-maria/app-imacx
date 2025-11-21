-- =====================================================================
-- Function: get_aggregated_top_customers
-- Purpose: Get aggregated customer revenue data (avoids 1000 row limit)
-- Parameters:
--   - start_date: Start of period (YYYY-MM-DD)
--   - end_date: End of period (YYYY-MM-DD)
--   - use_historical: Use 2years_ft table instead of ft
-- Returns: Aggregated customer metrics (one row per customer)
-- =====================================================================
CREATE OR REPLACE FUNCTION get_aggregated_top_customers(
  start_date DATE,
  end_date DATE,
  use_historical BOOLEAN DEFAULT false
)
RETURNS TABLE(
  customer_id INTEGER,
  customer_name TEXT,
  city TEXT,
  salesperson TEXT,
  invoice_count INTEGER,
  net_revenue NUMERIC,
  first_invoice_date DATE,
  last_invoice_date DATE
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  source_table TEXT;
BEGIN
  -- Determine source table
  IF use_historical THEN
    source_table := '2years_ft';
  ELSE
    source_table := 'ft';
  END IF;

  -- Return aggregated customer data
  -- This aggregates at database level to avoid 1000 row limit
  RETURN QUERY EXECUTE format($query$
    WITH invoice_aggregates AS (
      SELECT
        -- HH Print consolidation: group customer_ids 2043 and 2149 together
        CASE 
          WHEN ft.customer_id IN (2043, 2149) THEN 2043  -- Use 2043 as the group key
          ELSE ft.customer_id
        END AS grouped_customer_id,
        COUNT(CASE WHEN ft.document_type = 'Factura' THEN 1 END) AS factura_count,
        SUM(CASE WHEN ft.document_type = 'Factura' THEN ft.net_value ELSE 0 END) AS factura_revenue,
        SUM(CASE WHEN ft.document_type = 'Nota de Crédito' THEN ft.net_value ELSE 0 END) AS nota_credito_revenue,
        MIN(ft.invoice_date) AS first_invoice,
        MAX(ft.invoice_date) AS last_invoice
      FROM phc.%I ft
      INNER JOIN phc.cl cl ON cl.customer_id = ft.customer_id
      WHERE ft.invoice_date >= $1
        AND ft.invoice_date <= $2
        AND ft.document_type IN ('Factura', 'Nota de Crédito')
        AND (
          ft.anulado IS NULL 
          OR ft.anulado = '' 
          OR ft.anulado = '0' 
          OR UPPER(ft.anulado) = 'N' 
          OR UPPER(ft.anulado) = 'FALSE'
        )
      GROUP BY 
        CASE 
          WHEN ft.customer_id IN (2043, 2149) THEN 2043
          ELSE ft.customer_id
        END
    ),
    grouped_aggregates AS (
      SELECT
        grouped_customer_id AS customer_id,
        SUM(factura_count) AS invoice_count,
        SUM(factura_revenue + nota_credito_revenue) AS net_revenue,
        MIN(first_invoice) AS first_invoice_date,
        MAX(last_invoice) AS last_invoice_date
      FROM invoice_aggregates
      GROUP BY grouped_customer_id
      HAVING SUM(factura_revenue + nota_credito_revenue) > 0  -- Only customers with positive revenue
    )
    SELECT
      ga.customer_id::INTEGER,
      CASE 
        WHEN ga.customer_id = 2043 THEN 'HH PRINT MANAGEMENT [AGRUPADO]'::TEXT
        ELSE COALESCE(cl.customer_name, 'Unknown')::TEXT
      END AS customer_name,
      COALESCE(cl.city, '')::TEXT AS city,
      COALESCE(cl.salesperson, '')::TEXT AS salesperson,
      ga.invoice_count::INTEGER,
      ga.net_revenue::NUMERIC,
      ga.first_invoice_date::DATE,
      ga.last_invoice_date::DATE
    FROM grouped_aggregates ga
    LEFT JOIN phc.cl cl ON cl.customer_id = ga.customer_id
    ORDER BY ga.net_revenue DESC
  $query$, source_table)
  USING start_date, end_date;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_aggregated_top_customers(DATE, DATE, BOOLEAN) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_aggregated_top_customers IS 'Get aggregated customer revenue data for a date range. Aggregates at database level to avoid 1000 row limit. Returns one row per customer with total revenue and invoice counts.';


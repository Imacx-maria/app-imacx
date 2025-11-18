-- =====================================================================
-- Function: get_invoices_for_period
-- Purpose: Get all invoices for a specific date range from correct table
-- Parameters:
--   - start_date: Start of period (YYYY-MM-DD)
--   - end_date: End of period (YYYY-MM-DD)
--   - use_historical: Use 2years_ft table instead of ft
-- Returns: Invoice records with customer data
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
  -- Determine source table
  IF use_historical THEN
    source_table := '2years_ft';
  ELSE
    source_table := 'ft';
  END IF;

  -- Return invoice data
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_invoices_for_period(DATE, DATE, BOOLEAN) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_invoices_for_period IS 'Get all invoices for a date range, automatically selecting correct source table. Returns raw invoice data for client-side processing.';

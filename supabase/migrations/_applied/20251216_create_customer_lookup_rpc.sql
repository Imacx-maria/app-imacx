-- =====================================================================
-- Function: get_customers_by_ids
-- Purpose: Get customer details for a list of customer IDs
-- Parameters:
--   - customer_ids: Array of customer IDs to lookup
-- Returns: Customer records with basic info
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_customers_by_ids(INTEGER[]) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_customers_by_ids IS 'Get customer details for a list of customer IDs. Uses SECURITY DEFINER to bypass RLS.';

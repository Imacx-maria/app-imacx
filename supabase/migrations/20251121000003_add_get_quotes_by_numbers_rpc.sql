-- =====================================================================
-- Add RPC function to get quote data by document numbers
--
-- Issue: Direct access to phc.bo fails with permission denied
-- Solution: Create SECURITY DEFINER function for controlled access
-- =====================================================================

CREATE OR REPLACE FUNCTION get_quotes_by_numbers(
  quote_numbers text[]
)
RETURNS TABLE(
  document_id text,
  document_number text,
  document_date date,
  customer_id integer,
  total_value numeric
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bo.document_id,
    bo.document_number::TEXT,
    bo.document_date,
    bo.customer_id,
    bo.total_value
  FROM phc.bo bo
  WHERE bo.document_number IN (SELECT unnest(quote_numbers))
    AND bo.document_type = 'Orçamento';
END;
$$;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION get_quotes_by_numbers(text[]) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_quotes_by_numbers IS
'Returns quote data from phc.bo for given document numbers.
Uses SECURITY DEFINER to allow authenticated users to query phc schema.';

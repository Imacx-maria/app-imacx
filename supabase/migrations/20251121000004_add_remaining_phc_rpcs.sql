-- =====================================================================
-- Add remaining RPC functions for PHC table access
--
-- Issue: auto-dismiss-converted endpoint needs access to bi, fi, ft tables
-- Solution: Create SECURITY DEFINER functions for controlled access
-- =====================================================================

-- 1. Function to get BI records by document_ids
CREATE OR REPLACE FUNCTION get_bi_by_document_ids(
  doc_ids text[]
)
RETURNS TABLE(
  document_id text,
  line_id text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.document_id,
    bi.line_id
  FROM phc.bi bi
  WHERE bi.document_id = ANY(doc_ids);
END;
$$;

-- 2. Function to get FI records by bistamps
CREATE OR REPLACE FUNCTION get_fi_by_bistamps(
  bistamp_list text[]
)
RETURNS TABLE(
  bistamp text,
  invoice_id text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fi.bistamp,
    fi.invoice_id
  FROM phc.fi fi
  WHERE fi.bistamp = ANY(bistamp_list);
END;
$$;

-- 3. Function to get FT records by invoice_ids (excluding cancelled)
CREATE OR REPLACE FUNCTION get_ft_by_invoice_ids(
  inv_ids text[]
)
RETURNS TABLE(
  invoice_id text,
  document_type text,
  anulado text
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ft.invoice_id,
    ft.document_type,
    ft.anulado
  FROM phc.ft ft
  WHERE ft.invoice_id = ANY(inv_ids)
    AND (ft.anulado IS NULL OR ft.anulado != 'True');
END;
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_bi_by_document_ids(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_fi_by_bistamps(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ft_by_invoice_ids(text[]) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_bi_by_document_ids IS
'Returns BI (bridge) records for given document IDs.
Uses SECURITY DEFINER to allow authenticated users to query phc schema.';

COMMENT ON FUNCTION get_fi_by_bistamps IS
'Returns FI (invoice line) records for given bistamps.
Uses SECURITY DEFINER to allow authenticated users to query phc schema.';

COMMENT ON FUNCTION get_ft_by_invoice_ids IS
'Returns FT (invoice header) records for given invoice IDs, excluding cancelled invoices.
Uses SECURITY DEFINER to allow authenticated users to query phc schema.';

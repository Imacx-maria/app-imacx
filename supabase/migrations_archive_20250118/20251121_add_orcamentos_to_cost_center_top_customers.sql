-- Add orçamentos (quotes) count to cost center top customers
-- Quotes come from phc.bo table where document_type = 'Orçamento'
-- Need to match quotes to cost centers and customers

SET search_path = public, phc;

DROP FUNCTION IF EXISTS public.get_cost_center_top_customers(text, integer);

CREATE OR REPLACE FUNCTION public.get_cost_center_top_customers(
  p_period TEXT DEFAULT 'ytd',
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  centro_custo TEXT,
  customer_id INTEGER,
  customer_name TEXT,
  city TEXT,
  salesperson TEXT,
  invoice_count INTEGER,
  quote_count INTEGER,
  conversion_rate NUMERIC,
  net_revenue NUMERIC,
  revenue_share_pct NUMERIC,
  last_invoice DATE,
  days_since_last_invoice INTEGER,
  rank INTEGER,
  total_customers_center INTEGER,
  total_revenue_center NUMERIC,
  total_invoices_center INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, phc
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Calculate date range based on period
  v_end_date := CURRENT_DATE;

  IF p_period = 'mtd' THEN
    -- Month-to-Date: First day of current month to today
    v_start_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  ELSE
    -- Year-to-Date (default): January 1st to today
    v_start_date := DATE_TRUNC('year', CURRENT_DATE)::DATE;
  END IF;

  RETURN QUERY
  WITH cost_center_mapping AS (
    -- Map cost centers based on business rules (same as cost_center_sales)
    SELECT DISTINCT
      CASE
        WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
        WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
        ELSE 'ID-Impressão Digital'
      END AS cc_name
    FROM phc.bo
    WHERE bo.document_type IN ('Orçamento', 'Encomenda a Fornecedor')
    UNION
    SELECT DISTINCT
      COALESCE(NULLIF(TRIM(fi.cost_center), ''), '(Sem Centro de Custo)') AS cc_name
    FROM phc.fi
  ),
  lines_period AS (
    SELECT
      COALESCE(NULLIF(TRIM(fi.cost_center), ''), '(Sem Centro de Custo)') AS cc_name,
      ft.customer_id AS cust_id,
      SUM(fi.net_liquid_value) AS net_rev,
      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN fi.invoice_id END) AS inv_count,
      MAX(ft.invoice_date) AS last_inv
    FROM phc.fi fi
    INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND fi.cost_center IN (
        'ID-Impressão Digital',
        'BR-Brindes',
        'IO-Impressão OFFSET'
      )
      AND ft.invoice_date >= v_start_date
      AND ft.invoice_date <= v_end_date
    GROUP BY fi.cost_center, ft.customer_id
  ),
  quotes_period AS (
    SELECT
      CASE
        WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
        WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
        ELSE 'ID-Impressão Digital'
      END AS cc_name,
      bo.customer_id AS cust_id,
      COUNT(DISTINCT bo.budget_id) AS quote_cnt
    FROM phc.bo
    WHERE bo.document_type = 'Orçamento'
      AND bo.document_date >= v_start_date
      AND bo.document_date <= v_end_date
    GROUP BY CASE
        WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
        WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
        ELSE 'ID-Impressão Digital'
      END, bo.customer_id
  ),
  center_stats AS (
    SELECT
      lines_period.cc_name,
      COUNT(*) AS total_custs,
      SUM(lines_period.inv_count) AS total_invs,
      SUM(lines_period.net_rev) AS total_rev
    FROM lines_period
    GROUP BY lines_period.cc_name
  ),
  enriched AS (
    SELECT
      lp.cc_name,
      lp.cust_id,
      COALESCE(NULLIF(TRIM(cl.customer_name), ''), '(Sem Nome)') AS cust_name,
      COALESCE(NULLIF(TRIM(cl.city), ''), '') AS cust_city,
      COALESCE(NULLIF(TRIM(cl.salesperson), ''), '(Sem Vendedor)') AS sales_person,
      lp.inv_count,
      COALESCE(qp.quote_cnt, 0) AS quote_cnt,
      lp.net_rev,
      lp.last_inv,
      GREATEST(0, CURRENT_DATE - COALESCE(lp.last_inv, CURRENT_DATE)) AS days_since,
      cs.total_custs,
      cs.total_rev,
      cs.total_invs
    FROM lines_period lp
    LEFT JOIN quotes_period qp ON qp.cc_name = lp.cc_name AND qp.cust_id = lp.cust_id
    LEFT JOIN phc.cl cl ON cl.customer_id = lp.cust_id
    INNER JOIN center_stats cs ON cs.cc_name = lp.cc_name
  ),
  ranked AS (
    SELECT
      e.cc_name,
      e.cust_id,
      e.cust_name,
      e.cust_city,
      e.sales_person,
      e.inv_count,
      e.quote_cnt,
      CASE
        WHEN e.quote_cnt > 0 THEN ROUND((e.inv_count::NUMERIC / e.quote_cnt::NUMERIC) * 100, 2)
        ELSE NULL
      END AS conv_rate,
      e.net_rev,
      e.last_inv,
      e.days_since,
      e.total_custs,
      e.total_rev,
      e.total_invs,
      CASE
        WHEN e.total_rev > 0 THEN ROUND((e.net_rev / e.total_rev) * 100, 2)
        ELSE 0
      END AS share_pct,
      ROW_NUMBER() OVER (PARTITION BY e.cc_name ORDER BY e.net_rev DESC) AS rn
    FROM enriched e
  )
  SELECT
    r.cc_name,
    r.cust_id::INTEGER,
    r.cust_name,
    r.cust_city,
    r.sales_person,
    r.inv_count::INTEGER,
    r.quote_cnt::INTEGER,
    r.conv_rate,
    r.net_rev,
    r.share_pct,
    r.last_inv,
    r.days_since::INTEGER,
    r.rn::INTEGER,
    r.total_custs::INTEGER,
    r.total_rev,
    r.total_invs::INTEGER
  FROM ranked r
  WHERE r.rn <= COALESCE(NULLIF(p_limit, 0), 20)
  ORDER BY r.cc_name, r.rn;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cost_center_top_customers(text, integer) TO authenticated;

COMMENT ON FUNCTION public.get_cost_center_top_customers IS
  'Returns top N customers per cost center for specified period (mtd or ytd) with invoice counts, quote counts, and conversion rates.';

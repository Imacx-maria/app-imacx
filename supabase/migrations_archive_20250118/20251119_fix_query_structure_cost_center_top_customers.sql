-- Fix query structure mismatch in get_cost_center_top_customers
-- The issue was using SELECT e.* which includes columns not in RETURNS TABLE
-- Need to explicitly select only the columns defined in the function signature

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
  WITH lines_period AS (
    SELECT
      COALESCE(NULLIF(TRIM(fi.cost_center), ''), '(Sem Centro de Custo)') AS cost_center,
      ft.customer_id,
      SUM(fi.net_liquid_value) AS net_revenue,
      COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN fi.invoice_id END) AS invoice_count,
      MAX(ft.invoice_date) AS last_invoice
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
  center_stats AS (
    SELECT
      lines_period.cost_center,
      COUNT(*) AS total_customers,
      SUM(lines_period.invoice_count) AS total_invoices,
      SUM(lines_period.net_revenue) AS total_revenue
    FROM lines_period
    GROUP BY lines_period.cost_center
  ),
  enriched AS (
    SELECT
      lp.cost_center,
      lp.customer_id,
      COALESCE(NULLIF(TRIM(cl.customer_name), ''), '(Sem Nome)') AS customer_name,
      COALESCE(NULLIF(TRIM(cl.city), ''), '') AS city,
      COALESCE(NULLIF(TRIM(cl.salesperson), ''), '(Sem Vendedor)') AS salesperson,
      lp.invoice_count,
      lp.net_revenue,
      lp.last_invoice,
      GREATEST(0, CURRENT_DATE - COALESCE(lp.last_invoice, CURRENT_DATE)) AS days_since_last_invoice,
      cs.total_customers,
      cs.total_revenue,
      cs.total_invoices
    FROM lines_period lp
    LEFT JOIN phc.cl cl ON cl.customer_id = lp.customer_id
    INNER JOIN center_stats cs ON cs.cost_center = lp.cost_center
  ),
  ranked AS (
    SELECT
      cost_center,
      customer_id,
      customer_name,
      city,
      salesperson,
      invoice_count,
      net_revenue,
      last_invoice,
      days_since_last_invoice,
      total_customers,
      total_revenue,
      total_invoices,
      CASE
        WHEN total_revenue > 0 THEN ROUND((net_revenue / total_revenue) * 100, 2)
        ELSE 0
      END AS share_pct,
      ROW_NUMBER() OVER (PARTITION BY cost_center ORDER BY net_revenue DESC) AS rn
    FROM enriched
  )
  SELECT
    ranked.cost_center AS centro_custo,
    ranked.customer_id::INTEGER,
    ranked.customer_name,
    ranked.city,
    ranked.salesperson,
    ranked.invoice_count::INTEGER,
    ranked.net_revenue,
    ranked.share_pct AS revenue_share_pct,
    ranked.last_invoice,
    ranked.days_since_last_invoice::INTEGER,
    ranked.rn::INTEGER AS rank,
    ranked.total_customers::INTEGER AS total_customers_center,
    ranked.total_revenue AS total_revenue_center,
    ranked.total_invoices::INTEGER AS total_invoices_center
  FROM ranked
  WHERE ranked.rn <= COALESCE(NULLIF(p_limit, 0), 20)
  ORDER BY ranked.cost_center, ranked.rn;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cost_center_top_customers(text, integer) TO authenticated;

COMMENT ON FUNCTION public.get_cost_center_top_customers IS
  'Returns top N customers per cost center for specified period (mtd or ytd). Uses dynamic date calculations based on CURRENT_DATE. Fixed query structure to match return type.';

-- Fix cost center names to use Portuguese characters (ã, Ã)
-- This updates the RPC function to filter for the correct cost center names

SET search_path = public, phc;

DROP FUNCTION IF EXISTS public.get_cost_center_top_customers_ytd(integer);

CREATE OR REPLACE FUNCTION public.get_cost_center_top_customers_ytd(
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, phc
AS $$
WITH date_params AS (
  SELECT
    CURRENT_DATE AS today,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year
),
lines_ytd AS (
  SELECT
    COALESCE(NULLIF(TRIM(fi.cost_center), ''), '(Sem Centro de Custo)') AS cost_center,
    ft.customer_id,
    SUM(fi.net_liquid_value) AS net_revenue,
    COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN fi.invoice_id END) AS invoice_count,
    MIN(ft.invoice_date) AS first_invoice,
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
    AND ft.invoice_date >= make_date((SELECT current_year FROM date_params), 1, 1)
    AND ft.invoice_date <= (SELECT today FROM date_params)
  GROUP BY fi.cost_center, ft.customer_id
),
center_stats AS (
  SELECT
    cost_center,
    COUNT(*) AS total_customers,
    SUM(invoice_count) AS total_invoices,
    SUM(net_revenue) AS total_revenue
  FROM lines_ytd
  GROUP BY cost_center
),
enriched AS (
  SELECT
    ly.cost_center,
    ly.customer_id,
    COALESCE(NULLIF(TRIM(cl.customer_name), ''), '(Sem Nome)') AS customer_name,
    COALESCE(NULLIF(TRIM(cl.city), ''), '') AS city,
    COALESCE(NULLIF(TRIM(cl.salesperson), ''), '(Sem Vendedor)') AS salesperson,
    ly.invoice_count,
    ly.net_revenue,
    ly.last_invoice,
    GREATEST(
      0,
      (SELECT today FROM date_params) - COALESCE(ly.last_invoice, (SELECT today FROM date_params))
    ) AS days_since_last_invoice,
    cs.total_customers,
    cs.total_revenue,
    cs.total_invoices
  FROM lines_ytd ly
  LEFT JOIN phc.cl cl ON cl.customer_id = ly.customer_id
  INNER JOIN center_stats cs ON cs.cost_center = ly.cost_center
),
ranked AS (
  SELECT
    e.*,
    CASE
      WHEN e.total_revenue > 0 THEN ROUND((e.net_revenue / e.total_revenue) * 100, 2)
      ELSE 0
    END AS share_pct,
    ROW_NUMBER() OVER (PARTITION BY e.cost_center ORDER BY e.net_revenue DESC) AS rn
  FROM enriched e
)
SELECT
  cost_center AS centro_custo,
  customer_id,
  customer_name,
  city,
  salesperson,
  invoice_count,
  net_revenue,
  share_pct AS revenue_share_pct,
  last_invoice,
  days_since_last_invoice::INTEGER AS days_since_last_invoice,
  rn AS rank,
  total_customers AS total_customers_center,
  total_revenue AS total_revenue_center,
  total_invoices AS total_invoices_center
FROM ranked
WHERE rn <= COALESCE(NULLIF(p_limit, 0), 20)
ORDER BY cost_center, rn;
$$;

GRANT EXECUTE ON FUNCTION public.get_cost_center_top_customers_ytd(integer) TO authenticated;

COMMENT ON FUNCTION public.get_cost_center_top_customers_ytd IS
  'Returns top N customers per cost center for YTD period. Updated to use correct Portuguese characters in cost center names.';

-- =============================================================================
-- COST CENTER PERFORMANCE QUERIES FOR FINANCIAL ANALYSIS DASHBOARD
-- =============================================================================
-- Purpose: Returns financial performance tables by cost center for IMACX dashboard
-- Usage: Execute each query separately (TABLE 1 for MÊS ATUAL, TABLE 2 for ANO ATUAL)
-- Date: 2025-11-14
-- =============================================================================


-- =============================================================================
-- TABLE 1: MÊS ATUAL (CURRENT MONTH ONLY)
-- =============================================================================
-- Returns sales data filtered to current month only
-- Columns: centro_custo, vendas, var_pct, num_faturas, num_clientes, ticket_medio
-- var_pct is always 0 for current month (no comparison available)
-- Sort: By vendas DESC
-- =============================================================================

WITH date_params AS (
  SELECT
    CURRENT_DATE as today,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER as current_month
),
sales_month AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) as vendas,
    COUNT(DISTINCT fi.invoice_id) as num_faturas,
    COUNT(DISTINCT ft.customer_id) as num_clientes,
    ROUND(SUM(fi.net_liquid_value)::numeric / NULLIF(COUNT(DISTINCT fi.invoice_id), 0), 2) as ticket_medio
  FROM phc.fi
  INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id
  WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0' OR ft.anulado = 'N')
    AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')
    AND ft.invoice_date >= make_date((SELECT current_year FROM date_params), (SELECT current_month FROM date_params), 1)
    AND ft.invoice_date <= (SELECT today FROM date_params)
  GROUP BY fi.cost_center
)
SELECT
  sm.cost_center as centro_custo,
  COALESCE(sm.vendas, 0)::numeric as vendas,
  0 as var_pct,
  COALESCE(sm.num_faturas, 0)::INTEGER as num_faturas,
  COALESCE(sm.num_clientes, 0)::INTEGER as num_clientes,
  COALESCE(sm.ticket_medio, 0)::numeric as ticket_medio
FROM sales_month sm
ORDER BY vendas DESC;


-- =============================================================================
-- TABLE 2: ANO ATUAL (YEAR-TO-DATE WITH YEAR-OVER-YEAR COMPARISON)
-- =============================================================================
-- Returns sales data from Jan 1 to today, with year-over-year comparison
-- Columns: centro_custo, vendas, var_pct, num_faturas, num_clientes, ticket_medio
-- var_pct = year-over-year % change vs same period previous year
-- Uses FULL OUTER JOIN to capture all cost centers from both years
-- Sort: By vendas DESC
-- =============================================================================

WITH date_params AS (
  SELECT
    CURRENT_DATE as today,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER as current_month,
    EXTRACT(DAY FROM CURRENT_DATE)::INTEGER as current_day
),
sales_ytd AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) as vendas,
    COUNT(DISTINCT fi.invoice_id) as num_faturas,
    COUNT(DISTINCT ft.customer_id) as num_clientes,
    ROUND(SUM(fi.net_liquid_value)::numeric / NULLIF(COUNT(DISTINCT fi.invoice_id), 0), 2) as ticket_medio
  FROM phc.fi
  INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id
  WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0' OR ft.anulado = 'N')
    AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')
    AND ft.invoice_date >= make_date((SELECT current_year FROM date_params), 1, 1)
    AND ft.invoice_date <= (SELECT today FROM date_params)
  GROUP BY fi.cost_center
),
sales_previous_year AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) as vendas_ly
  FROM phc."2years_fi" fi
  INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
  WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0' OR ft.anulado = 'N')
    AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')
    AND EXTRACT(YEAR FROM ft.invoice_date) = (SELECT current_year - 1 FROM date_params)
    AND ft.invoice_date >= make_date((SELECT current_year - 1 FROM date_params), 1, 1)
    AND ft.invoice_date <= make_date((SELECT current_year - 1 FROM date_params), (SELECT current_month FROM date_params), (SELECT current_day FROM date_params))
  GROUP BY fi.cost_center
)
SELECT
  COALESCE(sy.cost_center, py.cost_center) as centro_custo,
  COALESCE(sy.vendas, 0)::numeric as vendas,
  CASE
    WHEN COALESCE(py.vendas_ly, 0) > 0
    THEN ROUND(((COALESCE(sy.vendas, 0) - COALESCE(py.vendas_ly, 0)) / COALESCE(py.vendas_ly, 0)) * 100, 1)::numeric
    ELSE 0::numeric
  END as var_pct,
  COALESCE(sy.num_faturas, 0)::INTEGER as num_faturas,
  COALESCE(sy.num_clientes, 0)::INTEGER as num_clientes,
  COALESCE(sy.ticket_medio, 0)::numeric as ticket_medio
FROM sales_ytd sy
FULL OUTER JOIN sales_previous_year py ON sy.cost_center = py.cost_center
ORDER BY vendas DESC;

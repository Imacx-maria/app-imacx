-- ============================================================================
-- COST CENTER SALES (MES ATUAL)
-- ============================================================================
-- Purpose : Returns sales KPIs for selected cost centers in the current month.
-- Columns : centro_custo, vendas, var_pct (always 0), num_faturas,
--           num_clientes, ticket_medio
-- Filters : Factura + Nota de Crédito, exclude cancelled invoices,
--           restrict to ID, BR, IO cost centers only.
-- ============================================================================

WITH date_params AS (
  SELECT
    CURRENT_DATE AS today,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS current_month
),
filtered_lines AS (
  SELECT
    fi.cost_center,
    fi.invoice_id,
    fi.net_liquid_value,
    ft.customer_id
  FROM phc.fi
  INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id
  WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0' OR ft.anulado = 'N')
    AND fi.cost_center IN ('ID-Impressão Digital', 'ID-Impressao Digital', 'BR-Brindes', 'IO-Impressão OFFSET', 'IO-Impressao OFFSET')
    AND ft.invoice_date >= make_date((SELECT current_year FROM date_params), (SELECT current_month FROM date_params), 1)
    AND ft.invoice_date <= (SELECT today FROM date_params)
)
SELECT
  COALESCE(NULLIF(TRIM(cost_center), ''), '(Sem Centro de Custo)') AS centro_custo,
  COALESCE(SUM(net_liquid_value), 0)::NUMERIC AS vendas,
  0::NUMERIC AS var_pct,
  COUNT(DISTINCT invoice_id)::INTEGER AS num_faturas,
  COUNT(DISTINCT customer_id)::INTEGER AS num_clientes,
  CASE
    WHEN COUNT(DISTINCT invoice_id) > 0
      THEN ROUND(SUM(net_liquid_value) / COUNT(DISTINCT invoice_id), 2)
    ELSE 0
  END::NUMERIC AS ticket_medio
FROM filtered_lines
GROUP BY centro_custo
ORDER BY vendas DESC;

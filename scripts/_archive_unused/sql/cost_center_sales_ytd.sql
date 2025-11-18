-- ============================================================================
-- COST CENTER SALES (ANO ATUAL VS ANO ANTERIOR)
-- ============================================================================
-- Purpose : Returns YTD KPIs for selected cost centers with YoY comparison.
-- Columns : centro_custo, vendas, var_pct, num_faturas, num_clientes, ticket_medio
-- Filters : Factura + Nota de Crédito, exclude cancelled invoices,
--           restrict to ID, BR, IO cost centers only.
-- ============================================================================

WITH date_params AS (
  SELECT
    CURRENT_DATE AS today,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS current_month,
    EXTRACT(DAY FROM CURRENT_DATE)::INTEGER AS current_day
),
current_year_lines AS (
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
    AND ft.invoice_date >= make_date((SELECT current_year FROM date_params), 1, 1)
    AND ft.invoice_date <= (SELECT today FROM date_params)
),
previous_year_lines AS (
  SELECT
    fi.cost_center,
    fi.invoice_id,
    fi.net_liquid_value
  FROM phc."2years_fi" fi
  INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
  WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0' OR ft.anulado = 'N')
    AND fi.cost_center IN ('ID-Impressão Digital', 'ID-Impressao Digital', 'BR-Brindes', 'IO-Impressão OFFSET', 'IO-Impressao OFFSET')
    AND ft.invoice_date >= make_date((SELECT current_year - 1 FROM date_params), 1, 1)
    AND ft.invoice_date <= make_date(
      (SELECT current_year - 1 FROM date_params),
      (SELECT current_month FROM date_params),
      (SELECT current_day FROM date_params)
    )
)
SELECT
  COALESCE(NULLIF(TRIM(COALESCE(cy.cost_center, py.cost_center)), ''), '(Sem Centro de Custo)') AS centro_custo,
  COALESCE(SUM(cy.net_liquid_value), 0)::NUMERIC AS vendas,
  CASE
    WHEN COALESCE(SUM(py.net_liquid_value), 0) > 0
      THEN ROUND(((COALESCE(SUM(cy.net_liquid_value), 0) - COALESCE(SUM(py.net_liquid_value), 0)) / COALESCE(SUM(py.net_liquid_value), 0)) * 100, 1)
    ELSE 0
  END::NUMERIC AS var_pct,
  COUNT(DISTINCT cy.invoice_id)::INTEGER AS num_faturas,
  COUNT(DISTINCT cy.customer_id)::INTEGER AS num_clientes,
  CASE
    WHEN COUNT(DISTINCT cy.invoice_id) > 0
      THEN ROUND(SUM(cy.net_liquid_value) / COUNT(DISTINCT cy.invoice_id), 2)
    ELSE 0
  END::NUMERIC AS ticket_medio
FROM current_year_lines cy
FULL OUTER JOIN previous_year_lines py
  ON cy.cost_center = py.cost_center
GROUP BY centro_custo
ORDER BY vendas DESC;

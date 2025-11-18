-- ============================================================================
-- ADD COMPRAS (SUPPLIER ORDERS) TO COST CENTER SALES
-- ============================================================================
-- This migration adds a 'compras' column to the cost center sales functions
-- to show supplier order totals alongside sales for each cost center.
--
-- Business Logic:
-- - BR-Brindes: Supplier orders created by salesperson 'SP'
-- - IO-Impressão OFFSET: Supplier orders where customer_id = 87
-- - ID-Impressão Digital: All other supplier orders
-- ============================================================================

SET search_path = public, phc;

-- Drop existing functions first (required to change return type)
DROP FUNCTION IF EXISTS public.get_cost_center_sales_mtd();
DROP FUNCTION IF EXISTS public.get_cost_center_sales_ytd();

-- ============================================================================
-- MES ATUAL (CURRENT MONTH) - WITH COMPRAS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_cost_center_sales_mtd()
RETURNS TABLE (
  centro_custo TEXT,
  vendas NUMERIC,
  compras NUMERIC,
  var_pct NUMERIC,
  num_faturas INTEGER,
  num_clientes INTEGER,
  ticket_medio NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, phc
AS $$
WITH date_params AS (
  SELECT
    CURRENT_DATE AS today,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS current_month
),
sales_month AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) AS vendas,
    COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN fi.invoice_id END) AS num_faturas,
    COUNT(DISTINCT ft.customer_id) AS num_clientes,
    ROUND(
      SUM(fi.net_liquid_value)::NUMERIC /
      NULLIF(COUNT(DISTINCT CASE WHEN ft.document_type = 'Factura' THEN fi.invoice_id END), 0),
      2
    ) AS ticket_medio
  FROM phc.fi
  INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id
  WHERE (
      (ft.document_type = 'Factura' AND (ft.anulado IS NULL OR ft.anulado != 'True'))
      OR ft.document_type = 'Nota de Crédito'
    )
    AND fi.cost_center IN (
      'ID-Impressão Digital',
      'BR-Brindes',
      'IO-Impressão OFFSET'
    )
    AND ft.invoice_date >= make_date(
      (SELECT current_year FROM date_params),
      (SELECT current_month FROM date_params),
      1
    )
    AND ft.invoice_date <= (SELECT today FROM date_params)
  GROUP BY fi.cost_center
),
compras_month AS (
  SELECT
    CASE
      WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
      WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
      ELSE 'ID-Impressão Digital'
    END AS cost_center,
    SUM(bo.total_value) AS compras
  FROM phc.bo
  WHERE bo.document_type = 'Encomenda a Fornecedor'
    AND bo.total_value IS NOT NULL
    AND bo.total_value > 0
    AND bo.document_date >= make_date(
      (SELECT current_year FROM date_params),
      (SELECT current_month FROM date_params),
      1
    )
    AND bo.document_date <= (SELECT today FROM date_params)
  GROUP BY CASE
    WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
    WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
    ELSE 'ID-Impressão Digital'
  END
),
sales_previous_year AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) AS vendas_ly
  FROM phc."2years_fi" fi
  INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
  WHERE (
      (ft.document_type = 'Factura' AND (ft.anulado IS NULL OR ft.anulado != 'True'))
      OR ft.document_type = 'Nota de Crédito'
    )
    AND fi.cost_center IN (
      'ID-Impressão Digital',
      'BR-Brindes',
      'IO-Impressão OFFSET'
    )
    AND ft.invoice_date >= make_date(
      (SELECT current_year - 1 FROM date_params),
      (SELECT current_month FROM date_params),
      1
    )
    AND ft.invoice_date <= make_date(
      (SELECT current_year - 1 FROM date_params),
      (SELECT current_month FROM date_params),
      EXTRACT(DAY FROM (SELECT today FROM date_params))::INTEGER
    )
  GROUP BY fi.cost_center
)
SELECT
  COALESCE(NULLIF(TRIM(COALESCE(sm.cost_center, py.cost_center, cm.cost_center)), ''), '(Sem Centro de Custo)') AS centro_custo,
  COALESCE(sm.vendas, 0)::NUMERIC AS vendas,
  COALESCE(cm.compras, 0)::NUMERIC AS compras,
  CASE
    WHEN COALESCE(py.vendas_ly, 0) > 0
      THEN ROUND(
        ((COALESCE(sm.vendas, 0) - COALESCE(py.vendas_ly, 0)) / COALESCE(py.vendas_ly, 0)) * 100,
        1
      )
    ELSE 0
  END::NUMERIC AS var_pct,
  COALESCE(sm.num_faturas, 0)::INTEGER AS num_faturas,
  COALESCE(sm.num_clientes, 0)::INTEGER AS num_clientes,
  COALESCE(sm.ticket_medio, 0)::NUMERIC AS ticket_medio
FROM sales_month sm
FULL OUTER JOIN sales_previous_year py
  ON sm.cost_center = py.cost_center
FULL OUTER JOIN compras_month cm
  ON COALESCE(sm.cost_center, py.cost_center) = cm.cost_center
ORDER BY vendas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_cost_center_sales_mtd() TO authenticated;

-- ============================================================================
-- ANO ATUAL (YTD VS LY) - WITH COMPRAS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_cost_center_sales_ytd()
RETURNS TABLE (
  centro_custo TEXT,
  vendas NUMERIC,
  compras NUMERIC,
  var_pct NUMERIC,
  num_faturas INTEGER,
  num_clientes INTEGER,
  ticket_medio NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, phc
AS $$
WITH date_params AS (
  SELECT
    CURRENT_DATE AS today,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS current_year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS current_month,
    EXTRACT(DAY FROM CURRENT_DATE)::INTEGER AS current_day
),
sales_ytd AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) AS vendas,
    COUNT(DISTINCT fi.invoice_id) AS num_faturas,
    COUNT(DISTINCT ft.customer_id) AS num_clientes,
    ROUND(
      SUM(fi.net_liquid_value)::NUMERIC /
      NULLIF(COUNT(DISTINCT fi.invoice_id), 0),
      2
    ) AS ticket_medio
  FROM phc.fi
  INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id
  WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado != 'True')
    AND fi.cost_center IN (
      'ID-Impressão Digital',
      'BR-Brindes',
      'IO-Impressão OFFSET'
    )
    AND ft.invoice_date >= make_date((SELECT current_year FROM date_params), 1, 1)
    AND ft.invoice_date <= (SELECT today FROM date_params)
  GROUP BY fi.cost_center
),
compras_ytd AS (
  SELECT
    CASE
      WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
      WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
      ELSE 'ID-Impressão Digital'
    END AS cost_center,
    SUM(bo.total_value) AS compras
  FROM phc.bo
  WHERE bo.document_type = 'Encomenda a Fornecedor'
    AND bo.total_value IS NOT NULL
    AND bo.total_value > 0
    AND bo.document_date >= make_date((SELECT current_year FROM date_params), 1, 1)
    AND bo.document_date <= (SELECT today FROM date_params)
  GROUP BY CASE
    WHEN bo.created_by = 'SP' THEN 'BR-Brindes'
    WHEN bo.customer_id = 87 THEN 'IO-Impressão OFFSET'
    ELSE 'ID-Impressão Digital'
  END
),
sales_previous_year AS (
  SELECT
    fi.cost_center,
    SUM(fi.net_liquid_value) AS vendas_ly
  FROM phc."2years_fi" fi
  INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
  WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado != 'True')
    AND fi.cost_center IN (
      'ID-Impressão Digital',
      'BR-Brindes',
      'IO-Impressão OFFSET'
    )
    AND ft.invoice_date >= make_date((SELECT current_year - 1 FROM date_params), 1, 1)
    AND ft.invoice_date <= make_date(
      (SELECT current_year - 1 FROM date_params),
      (SELECT current_month FROM date_params),
      (SELECT current_day FROM date_params)
    )
  GROUP BY fi.cost_center
)
SELECT
  COALESCE(
    NULLIF(TRIM(COALESCE(sy.cost_center, py.cost_center, cy.cost_center)), ''),
    '(Sem Centro de Custo)'
  ) AS centro_custo,
  COALESCE(sy.vendas, 0)::NUMERIC AS vendas,
  COALESCE(cy.compras, 0)::NUMERIC AS compras,
  CASE
    WHEN COALESCE(py.vendas_ly, 0) > 0
      THEN ROUND(
        ((COALESCE(sy.vendas, 0) - COALESCE(py.vendas_ly, 0)) / COALESCE(py.vendas_ly, 0)) * 100,
        1
      )
    ELSE 0
  END::NUMERIC AS var_pct,
  COALESCE(sy.num_faturas, 0)::INTEGER AS num_faturas,
  COALESCE(sy.num_clientes, 0)::INTEGER AS num_clientes,
  COALESCE(sy.ticket_medio, 0)::NUMERIC AS ticket_medio
FROM sales_ytd sy
FULL OUTER JOIN sales_previous_year py
  ON sy.cost_center = py.cost_center
FULL OUTER JOIN compras_ytd cy
  ON COALESCE(sy.cost_center, py.cost_center) = cy.cost_center
ORDER BY vendas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_cost_center_sales_ytd() TO authenticated;

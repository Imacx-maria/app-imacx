-- Phase 2: Cost Center Multi-Year Comparison (YTD and MTD)
-- Created: 2025-01-14
-- Updated: 2025-01-14 - Fixed to include Nota de Crédito and exclude cancelled invoices
-- Purpose: Compare sales by cost center across 3 years (YTD or MTD aligned)

-- ============================================================================
-- COST CENTER MULTI-YEAR YTD COMPARISON
-- ============================================================================

-- Function: Get cost center performance with 3-year YTD comparison
CREATE OR REPLACE FUNCTION get_cost_center_multi_year_ytd(
  current_year INTEGER,
  current_month INTEGER,
  current_day INTEGER
)
RETURNS TABLE (
  cost_center TEXT,
  ano_atual NUMERIC,
  ano_anterior NUMERIC,
  ano_anterior_2 NUMERIC
) AS $$
DECLARE
  year_minus_1 INTEGER;
  year_minus_2 INTEGER;
BEGIN
  year_minus_1 := current_year - 1;
  year_minus_2 := current_year - 2;

  RETURN QUERY
  WITH
  -- Current Year Data (from fi and ft) - YTD
  current_year_data AS (
    SELECT
      fi.cost_center,
      SUM(fi.net_liquid_value) as vendas
    FROM phc.fi
    INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id
    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')
      AND ft.invoice_date >= make_date(current_year, 1, 1)
      AND ft.invoice_date <= CURRENT_DATE
    GROUP BY fi.cost_center
  ),
  -- Year Minus 1 Data (from 2years_fi and 2years_ft) - YTD (same period)
  year_minus_1_data AS (
    SELECT
      fi.cost_center,
      SUM(fi.net_liquid_value) as vendas
    FROM phc."2years_fi" fi
    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')
      AND EXTRACT(YEAR FROM ft.invoice_date) = year_minus_1
      AND ft.invoice_date >= make_date(year_minus_1, 1, 1)
      AND ft.invoice_date <= make_date(year_minus_1, current_month, current_day)
    GROUP BY fi.cost_center
  ),
  -- Year Minus 2 Data (from 2years_fi and 2years_ft) - YTD (same period)
  year_minus_2_data AS (
    SELECT
      fi.cost_center,
      SUM(fi.net_liquid_value) as vendas
    FROM phc."2years_fi" fi
    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')
      AND EXTRACT(YEAR FROM ft.invoice_date) = year_minus_2
      AND ft.invoice_date >= make_date(year_minus_2, 1, 1)
      AND ft.invoice_date <= make_date(year_minus_2, current_month, current_day)
    GROUP BY fi.cost_center
  ),
  -- Merge all years
  merged_data AS (
    SELECT
      COALESCE(cy.cost_center, y1.cost_center, y2.cost_center) as cost_center,
      COALESCE(cy.vendas, 0) as ano_atual,
      COALESCE(y1.vendas, 0) as ano_anterior,
      COALESCE(y2.vendas, 0) as ano_anterior_2
    FROM current_year_data cy
    FULL OUTER JOIN year_minus_1_data y1 ON cy.cost_center = y1.cost_center
    FULL OUTER JOIN year_minus_2_data y2 ON cy.cost_center = y2.cost_center
  )
  SELECT * FROM merged_data
  ORDER BY ano_atual DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COST CENTER MULTI-YEAR MTD COMPARISON
-- ============================================================================

-- Function: Get cost center performance with 3-year MTD comparison
CREATE OR REPLACE FUNCTION get_cost_center_multi_year_mtd(
  current_year INTEGER,
  current_month INTEGER,
  current_day INTEGER
)
RETURNS TABLE (
  cost_center TEXT,
  ano_atual NUMERIC,
  ano_anterior NUMERIC,
  ano_anterior_2 NUMERIC
) AS $$
DECLARE
  year_minus_1 INTEGER;
  year_minus_2 INTEGER;
BEGIN
  year_minus_1 := current_year - 1;
  year_minus_2 := current_year - 2;

  RETURN QUERY
  WITH
  -- Current Year Data (from fi and ft) - MTD (current month only)
  current_year_data AS (
    SELECT
      fi.cost_center,
      SUM(fi.net_liquid_value) as vendas
    FROM phc.fi
    INNER JOIN phc.ft ON fi.invoice_id = ft.invoice_id
    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')
      AND ft.invoice_date >= make_date(current_year, current_month, 1)
      AND ft.invoice_date <= CURRENT_DATE
    GROUP BY fi.cost_center
  ),
  -- Year Minus 1 Data (from 2years_fi and 2years_ft) - MTD (same month, same day range)
  year_minus_1_data AS (
    SELECT
      fi.cost_center,
      SUM(fi.net_liquid_value) as vendas
    FROM phc."2years_fi" fi
    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')
      AND EXTRACT(YEAR FROM ft.invoice_date) = year_minus_1
      AND EXTRACT(MONTH FROM ft.invoice_date) = current_month
      AND ft.invoice_date >= make_date(year_minus_1, current_month, 1)
      AND ft.invoice_date <= make_date(year_minus_1, current_month, current_day)
    GROUP BY fi.cost_center
  ),
  -- Year Minus 2 Data (from 2years_fi and 2years_ft) - MTD (same month, same day range)
  year_minus_2_data AS (
    SELECT
      fi.cost_center,
      SUM(fi.net_liquid_value) as vendas
    FROM phc."2years_fi" fi
    INNER JOIN phc."2years_ft" ft ON fi.invoice_id = ft.invoice_id
    WHERE ft.document_type IN ('Factura', 'Nota de Crédito')
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND fi.cost_center IN ('ID-Impressão Digital', 'BR-Brindes', 'IO-Impressão OFFSET')
      AND EXTRACT(YEAR FROM ft.invoice_date) = year_minus_2
      AND EXTRACT(MONTH FROM ft.invoice_date) = current_month
      AND ft.invoice_date >= make_date(year_minus_2, current_month, 1)
      AND ft.invoice_date <= make_date(year_minus_2, current_month, current_day)
    GROUP BY fi.cost_center
  ),
  -- Merge all years
  merged_data AS (
    SELECT
      COALESCE(cy.cost_center, y1.cost_center, y2.cost_center) as cost_center,
      COALESCE(cy.vendas, 0) as ano_atual,
      COALESCE(y1.vendas, 0) as ano_anterior,
      COALESCE(y2.vendas, 0) as ano_anterior_2
    FROM current_year_data cy
    FULL OUTER JOIN year_minus_1_data y1 ON cy.cost_center = y1.cost_center
    FULL OUTER JOIN year_minus_2_data y2 ON cy.cost_center = y2.cost_center
  )
  SELECT * FROM merged_data
  ORDER BY ano_atual DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_cost_center_multi_year_ytd TO authenticated;
GRANT EXECUTE ON FUNCTION get_cost_center_multi_year_mtd TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_cost_center_multi_year_ytd IS 'Returns 3-year YTD comparison of sales by cost center (ID, BR, IO). Includes both Factura and Nota de Crédito, excludes cancelled invoices.';
COMMENT ON FUNCTION get_cost_center_multi_year_mtd IS 'Returns 3-year MTD comparison of sales by cost center (ID, BR, IO) - same month, same day range. Includes both Factura and Nota de Crédito, excludes cancelled invoices.';

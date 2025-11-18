-- ============================================================================
-- Financial Analysis Verification Queries
-- ============================================================================
-- Purpose: Verify that API logic matches database reality
-- Date: 2025-01-13
-- Schema: phc (all PHC tables are in the phc schema)
-- ============================================================================

-- ============================================================================
-- 1. YTD 2025 REVENUE (Current Year)
-- ============================================================================
-- Should match: /api/financial-analysis/kpi-dashboard (YTD current)

SELECT
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value  -- SUBTRACT credits
    ELSE 0
  END), 0) as receita_total_2025
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True');

-- ============================================================================
-- 2. YTD 2025 INVOICE COUNT
-- ============================================================================
-- Should match: /api/financial-analysis/kpi-dashboard (YTD invoices current)

SELECT COUNT(*) as num_faturas_2025
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type = 'Factura'
  AND (anulado IS NULL OR anulado != 'True');

-- ============================================================================
-- 3. YTD 2025 UNIQUE CUSTOMERS
-- ============================================================================
-- Should match: /api/financial-analysis/kpi-dashboard (YTD customers current)

SELECT COUNT(DISTINCT customer_id) as num_clientes_2025
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type = 'Factura'
  AND (anulado IS NULL OR anulado != 'True')
  AND customer_id IS NOT NULL;

-- ============================================================================
-- 4. YTD 2025 TICKET MÉDIO (Average Invoice Value)
-- ============================================================================
-- Should match: /api/financial-analysis/kpi-dashboard (YTD avgInvoiceValue current)

SELECT
  CASE
    WHEN COUNT(*) > 0 THEN
      COALESCE(SUM(CASE
        WHEN document_type = 'Factura' THEN net_value
        WHEN document_type = 'Nota de Crédito' THEN -net_value
        ELSE 0
      END), 0) / COUNT(*)
    ELSE 0
  END as ticket_medio_2025
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type = 'Factura'
  AND (anulado IS NULL OR anulado != 'True');

-- ============================================================================
-- 5. YTD 2024 REVENUE (Previous Year - Same Period)
-- ============================================================================
-- Should match: /api/financial-analysis/kpi-dashboard (YTD previous)
-- Note: Uses phc."2years_ft" for historical data

SELECT
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as receita_total_2024
FROM phc."2years_ft"
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
  AND invoice_date <= CURRENT_DATE - INTERVAL '1 year'
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True');

-- ============================================================================
-- 6. YTD 2024 INVOICE COUNT (Previous Year)
-- ============================================================================

SELECT COUNT(*) as num_faturas_2024
FROM phc."2years_ft"
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')
  AND invoice_date <= CURRENT_DATE - INTERVAL '1 year'
  AND document_type = 'Factura'
  AND (anulado IS NULL OR anulado != 'True');

-- ============================================================================
-- 7. MONTHLY REVENUE BREAKDOWN (2025)
-- ============================================================================
-- Should match: /api/financial-analysis/monthly-revenue

SELECT
  TO_CHAR(invoice_date, 'YYYY-MM') as period,
  COUNT(CASE WHEN document_type = 'Factura' THEN 1 END) as num_faturas,
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as receita_liquida,
  CASE
    WHEN COUNT(CASE WHEN document_type = 'Factura' THEN 1 END) > 0 THEN
      COALESCE(SUM(CASE
        WHEN document_type = 'Factura' THEN net_value
        WHEN document_type = 'Nota de Crédito' THEN -net_value
        ELSE 0
      END), 0) / COUNT(CASE WHEN document_type = 'Factura' THEN 1 END)
    ELSE 0
  END as ticket_medio
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True')
GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
ORDER BY period;

-- ============================================================================
-- 8. TOP 10 CUSTOMERS YTD 2025
-- ============================================================================
-- Should match: /api/financial-analysis/top-customers

WITH customer_revenue AS (
  SELECT
    ft.customer_id,
    cl.customer_name,
    cl.city,
    cl.salesperson,
    COUNT(CASE WHEN ft.document_type = 'Factura' THEN 1 END) as num_faturas,
    COALESCE(SUM(CASE
      WHEN ft.document_type = 'Factura' THEN ft.net_value
      WHEN ft.document_type = 'Nota de Crédito' THEN -ft.net_value
      ELSE 0
    END), 0) as receita_liquida,
    MIN(ft.invoice_date) as primeira_fatura,
    MAX(ft.invoice_date) as ultima_fatura
  FROM phc.ft ft
  INNER JOIN phc.cl cl ON ft.customer_id = cl.customer_id
  WHERE ft.invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
    AND ft.invoice_date <= CURRENT_DATE
    AND ft.document_type IN ('Factura', 'Nota de Crédito')
    AND (ft.anulado IS NULL OR ft.anulado != 'True')
  GROUP BY ft.customer_id, cl.customer_name, cl.city, cl.salesperson
)
SELECT
  ROW_NUMBER() OVER (ORDER BY receita_liquida DESC) as rank,
  customer_id,
  customer_name,
  city,
  salesperson,
  num_faturas,
  receita_liquida,
  ROUND(receita_liquida * 100.0 / SUM(receita_liquida) OVER (), 2) as percentagem_receita,
  primeira_fatura,
  ultima_fatura,
  CURRENT_DATE - ultima_fatura as dias_desde_ultima_fatura
FROM customer_revenue
WHERE receita_liquida > 0
ORDER BY receita_liquida DESC
LIMIT 10;

-- ============================================================================
-- 9. VERIFY CREDIT NOTES ARE BEING SUBTRACTED
-- ============================================================================
-- This query shows Facturas vs Notas de Crédito side-by-side

SELECT
  document_type,
  COUNT(*) as count,
  SUM(net_value) as total_bruto,
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as total_liquido
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True')
GROUP BY document_type
ORDER BY document_type;

-- ============================================================================
-- 10. VERIFY CANCELLED INVOICES ARE EXCLUDED
-- ============================================================================
-- Compare counts with/without anulado filter

SELECT
  'COM filtro anulado' as tipo,
  COUNT(*) as total_docs,
  COUNT(CASE WHEN document_type = 'Factura' THEN 1 END) as faturas,
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as receita_liquida
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True')

UNION ALL

SELECT
  'SEM filtro anulado' as tipo,
  COUNT(*) as total_docs,
  COUNT(CASE WHEN document_type = 'Factura' THEN 1 END) as faturas,
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as receita_liquida
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type IN ('Factura', 'Nota de Crédito');

-- ============================================================================
-- 11. MTD (Month-To-Date) COMPARISON
-- ============================================================================
-- Current month YTD vs same period last year

SELECT
  'MTD 2025' as period,
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as receita_liquida
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True')

UNION ALL

SELECT
  'MTD 2024' as period,
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as receita_liquida
FROM phc."2years_ft"
WHERE invoice_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 year')
  AND invoice_date <= CURRENT_DATE - INTERVAL '1 year'
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True');

-- ============================================================================
-- 12. QTD (Quarter-To-Date) COMPARISON
-- ============================================================================
-- Current quarter YTD vs same period last year

SELECT
  'QTD 2025' as period,
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as receita_liquida
FROM phc.ft
WHERE invoice_date >= DATE_TRUNC('quarter', CURRENT_DATE)
  AND invoice_date <= CURRENT_DATE
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True')

UNION ALL

SELECT
  'QTD 2024' as period,
  COALESCE(SUM(CASE
    WHEN document_type = 'Factura' THEN net_value
    WHEN document_type = 'Nota de Crédito' THEN -net_value
    ELSE 0
  END), 0) as receita_liquida
FROM phc."2years_ft"
WHERE invoice_date >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '1 year')
  AND invoice_date <= CURRENT_DATE - INTERVAL '1 year'
  AND document_type IN ('Factura', 'Nota de Crédito')
  AND (anulado IS NULL OR anulado != 'True');

-- ============================================================================
-- END OF VERIFICATION QUERIES
-- ============================================================================

-- =====================================================
-- FIX CRITICAL BUG: DEPARTMENT MIXED PERIODS
-- =====================================================
-- PROBLEM:
--   - get_department_escaloes_faturas uses UNION ALL mixing 2023+2024+2025
--   - get_department_conversion_rates compares quotes 2025 with invoices from 3 years
--   - This creates misleading metrics and conversion rates
--
-- SOLUTION:
--   - Faturas: Return ONLY current year data with optional YoY comparison
--   - Conversion: Compare quotes vs invoices from SAME period
--   - Add new columns: total_faturas_lytd, total_valor_lytd, variacao_pct
-- =====================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS get_department_escaloes_faturas(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_department_conversion_rates(TEXT, DATE, DATE);

-- =====================================================
-- 1. GET DEPARTMENT INVOICE BRACKETS (FIXED - NO MORE UNION ALL)
-- =====================================================
-- Returns current year data with previous year comparison
CREATE OR REPLACE FUNCTION get_department_escaloes_faturas(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  value_bracket TEXT,
  invoice_count BIGINT,
  total_value NUMERIC,
  percentage NUMERIC,
  invoice_count_lytd BIGINT,      -- NEW: Last Year To Date
  total_value_lytd NUMERIC,        -- NEW: Last Year To Date value
  variacao_pct NUMERIC             -- NEW: Year-over-Year variation %
) AS $$
DECLARE
  current_year INTEGER;
  lytd_start_date DATE;
  lytd_end_date DATE;
BEGIN
  -- Calculate corresponding LYTD period
  current_year := EXTRACT(YEAR FROM start_date);
  lytd_start_date := start_date - INTERVAL '1 year';
  lytd_end_date := end_date - INTERVAL '1 year';

  RETURN QUERY
  WITH
  -- Current Year Invoices (2025)
  current_invoices AS (
    SELECT
      ft.invoice_id,
      ft.net_value,
      CASE
        WHEN ft.net_value < 1500 THEN '0-1500'
        WHEN ft.net_value >= 1500 AND ft.net_value < 2500 THEN '1500-2500'
        WHEN ft.net_value >= 2500 AND ft.net_value < 7500 THEN '2500-7500'
        WHEN ft.net_value >= 7500 AND ft.net_value < 15000 THEN '7500-15000'
        WHEN ft.net_value >= 15000 AND ft.net_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket_range
    FROM phc.ft ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= start_date
      AND ft.invoice_date <= end_date
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  -- Previous Year Invoices (2024) - Same Period
  lytd_invoices AS (
    SELECT
      ft.invoice_id,
      ft.net_value,
      CASE
        WHEN ft.net_value < 1500 THEN '0-1500'
        WHEN ft.net_value >= 1500 AND ft.net_value < 2500 THEN '1500-2500'
        WHEN ft.net_value >= 2500 AND ft.net_value < 7500 THEN '2500-7500'
        WHEN ft.net_value >= 7500 AND ft.net_value < 15000 THEN '7500-15000'
        WHEN ft.net_value >= 15000 AND ft.net_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket_range
    FROM phc."2years_ft" ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= lytd_start_date
      AND ft.invoice_date <= lytd_end_date
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  -- Current year stats
  current_stats AS (
    SELECT
      bracket_range,
      COUNT(*) as invoice_count,
      SUM(net_value) as total_value
    FROM current_invoices
    GROUP BY bracket_range
  ),
  -- Previous year stats
  lytd_stats AS (
    SELECT
      bracket_range,
      COUNT(*) as invoice_count_lytd,
      SUM(net_value) as total_value_lytd
    FROM lytd_invoices
    GROUP BY bracket_range
  ),
  -- Total for percentage calculation (current year only)
  total_value_sum AS (
    SELECT SUM(net_value) as grand_total FROM current_invoices
  ),
  -- Combine current + LYTD with FULL OUTER JOIN
  combined AS (
    SELECT
      COALESCE(cs.bracket_range, ls.bracket_range) as bracket_range,
      COALESCE(cs.invoice_count, 0) as invoice_count,
      COALESCE(cs.total_value, 0) as total_value,
      COALESCE(ls.invoice_count_lytd, 0) as invoice_count_lytd,
      COALESCE(ls.total_value_lytd, 0) as total_value_lytd
    FROM current_stats cs
    FULL OUTER JOIN lytd_stats ls ON cs.bracket_range = ls.bracket_range
  )
  SELECT
    c.bracket_range,
    c.invoice_count,
    ROUND(c.total_value, 2) as total_value,
    ROUND((c.total_value / NULLIF(tvs.grand_total, 0) * 100), 2) as percentage,
    c.invoice_count_lytd,
    ROUND(c.total_value_lytd, 2) as total_value_lytd,
    -- Calculate YoY variation percentage
    CASE
      WHEN c.total_value_lytd > 0 THEN
        ROUND(((c.total_value - c.total_value_lytd) / c.total_value_lytd * 100), 1)
      ELSE NULL
    END as variacao_pct
  FROM combined c
  CROSS JOIN total_value_sum tvs
  WHERE c.invoice_count > 0 OR c.invoice_count_lytd > 0  -- Show brackets with data in either period
  ORDER BY
    CASE c.bracket_range
      WHEN '0-1500' THEN 1
      WHEN '1500-2500' THEN 2
      WHEN '2500-7500' THEN 3
      WHEN '7500-15000' THEN 4
      WHEN '15000-30000' THEN 5
      WHEN '30000+' THEN 6
    END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. GET DEPARTMENT CONVERSION RATES (FIXED - SAME PERIOD COMPARISON)
-- =====================================================
-- Compares quotes vs invoices from THE SAME PERIOD (2025 vs 2025)
CREATE OR REPLACE FUNCTION get_department_conversion_rates(
  departamento_nome TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  value_bracket TEXT,
  quote_count BIGINT,
  invoice_count BIGINT,
  conversion_rate NUMERIC,
  total_quoted_value NUMERIC,
  total_invoiced_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Quotes from the period
  department_quotes AS (
    SELECT
      bo.document_id,
      bo.total_value,
      CASE
        WHEN bo.total_value < 1500 THEN '0-1500'
        WHEN bo.total_value >= 1500 AND bo.total_value < 2500 THEN '1500-2500'
        WHEN bo.total_value >= 2500 AND bo.total_value < 7500 THEN '2500-7500'
        WHEN bo.total_value >= 7500 AND bo.total_value < 15000 THEN '7500-15000'
        WHEN bo.total_value >= 15000 AND bo.total_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket_range
    FROM phc.bo bo
    LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE bo.document_date >= start_date
      AND bo.document_date <= end_date
      AND bo.document_type = 'Orçamento'
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  -- Invoices from THE SAME PERIOD (not 3 years!)
  department_invoices AS (
    SELECT
      ft.invoice_id,
      ft.net_value,
      ft.customer_id,
      CASE
        WHEN ft.net_value < 1500 THEN '0-1500'
        WHEN ft.net_value >= 1500 AND ft.net_value < 2500 THEN '1500-2500'
        WHEN ft.net_value >= 2500 AND ft.net_value < 7500 THEN '2500-7500'
        WHEN ft.net_value >= 7500 AND ft.net_value < 15000 THEN '7500-15000'
        WHEN ft.net_value >= 15000 AND ft.net_value < 30000 THEN '15000-30000'
        ELSE '30000+'
      END as bracket_range
    FROM phc.ft ft
    LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
    LEFT JOIN public.user_siglas us
      ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
    LEFT JOIN public.profiles p ON us.profile_id = p.id
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE ft.invoice_date >= start_date
      AND ft.invoice_date <= end_date
      AND (ft.anulado IS NULL OR ft.anulado != 'True')
      AND COALESCE(d.nome, 'IMACX') = departamento_nome
  ),
  -- Quote statistics
  quote_stats AS (
    SELECT
      bracket_range,
      COUNT(*) as quote_count,
      SUM(total_value) as total_quoted_value
    FROM department_quotes
    GROUP BY bracket_range
  ),
  -- Invoice statistics (same period as quotes!)
  invoice_stats AS (
    SELECT
      bracket_range,
      COUNT(*) as invoice_count,
      SUM(net_value) as total_invoiced_value
    FROM department_invoices
    GROUP BY bracket_range
  )
  -- Combine quotes and invoices
  SELECT
    qs.bracket_range,
    qs.quote_count,
    COALESCE(invs.invoice_count, 0) as invoice_count,
    ROUND((COALESCE(invs.invoice_count, 0)::NUMERIC / NULLIF(qs.quote_count, 0) * 100), 2) as conversion_rate,
    ROUND(qs.total_quoted_value, 2) as total_quoted_value,
    ROUND(COALESCE(invs.total_invoiced_value, 0), 2) as total_invoiced_value
  FROM quote_stats qs
  LEFT JOIN invoice_stats invs ON qs.bracket_range = invs.bracket_range
  ORDER BY
    CASE qs.bracket_range
      WHEN '0-1500' THEN 1
      WHEN '1500-2500' THEN 2
      WHEN '2500-7500' THEN 3
      WHEN '7500-15000' THEN 4
      WHEN '15000-30000' THEN 5
      WHEN '30000+' THEN 6
    END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION get_department_escaloes_faturas TO authenticated;
GRANT EXECUTE ON FUNCTION get_department_conversion_rates TO authenticated;

-- =====================================================
-- VALIDATION NOTES
-- =====================================================
-- After applying this migration:
--
-- 1. Orçamentos: Uses ONLY phc.bo (2025 data) ✅ Already correct
-- 2. Faturas: Uses ONLY phc.ft (2025) with comparison to phc.2years_ft (2024) ✅ FIXED
-- 3. Conversão: Compares quotes 2025 vs invoices 2025 (same period) ✅ FIXED
-- 4. New fields available:
--    - invoice_count_lytd: Invoice count from previous year same period
--    - total_value_lytd: Invoice value from previous year same period
--    - variacao_pct: Year-over-Year percentage change
--
-- The UI can now display:
-- - "Faturas 2025 (YTD)" with comparison to "2024 (YTD)"
-- - "Taxa de Conversão 2025" (quotes 2025 vs invoices 2025)
-- - No more "últimos 3 anos" or "períodos mistos"
-- =====================================================

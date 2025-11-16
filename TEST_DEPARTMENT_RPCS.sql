-- =====================================================
-- DEPARTMENT RPC TESTING QUERIES
-- =====================================================
-- Run each query separately in Supabase SQL Editor
-- Report back any errors you get
-- =====================================================

-- =====================================================
-- TEST 1: GET DEPARTMENT ESCALÕES ORÇAMENTOS
-- =====================================================
-- Expected: Should return quote counts by bracket for Brindes department

SELECT * FROM get_department_escaloes_orcamentos(
  'Brindes',           -- department name
  '2025-01-01',        -- start date
  CURRENT_DATE         -- end date
);

-- If this fails, try this simpler version to debug:
-- This tests just the department_quotes CTE
SELECT
  bo.document_id,
  bo.total_value,
  d.nome as department_name
FROM phc.bo bo
LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
LEFT JOIN public.user_siglas us
  ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
LEFT JOIN public.profiles p ON us.profile_id = p.id
LEFT JOIN public.departamentos d ON p.departamento_id = d.id
WHERE bo.document_date >= '2025-01-01'
  AND bo.document_date <= CURRENT_DATE
  AND bo.document_type = 'Orçamento'
  AND COALESCE(d.nome, 'IMACX') = 'Brindes'
LIMIT 10;


-- =====================================================
-- TEST 2: GET DEPARTMENT ESCALÕES FATURAS
-- =====================================================
-- Expected: Should return invoice counts by bracket for Brindes department

SELECT * FROM get_department_escaloes_faturas(
  'Brindes',           -- department name
  '2025-01-01',        -- start date
  CURRENT_DATE         -- end date
);

-- If this fails, try this simpler version to debug:
-- This tests the invoice join for current year
SELECT
  ft.invoice_id,
  ft.net_value,
  ft.anulado,
  d.nome as department_name
FROM phc.ft ft
LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
LEFT JOIN public.user_siglas us
  ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
LEFT JOIN public.profiles p ON us.profile_id = p.id
LEFT JOIN public.departamentos d ON p.departamento_id = d.id
WHERE ft.invoice_date >= '2025-01-01'
  AND ft.invoice_date <= CURRENT_DATE
  AND ft.anulado = false
  AND COALESCE(d.nome, 'IMACX') = 'Brindes'
LIMIT 10;


-- =====================================================
-- TEST 3: GET DEPARTMENT CONVERSION RATES
-- =====================================================
-- Expected: Should return conversion rates by bracket for Brindes

SELECT * FROM get_department_conversion_rates(
  'Brindes',           -- department name
  '2025-01-01',        -- start date
  CURRENT_DATE         -- end date
);

-- If this fails, try this simpler version to debug:
-- This tests the BiStamp link from quote to invoice
SELECT
  bo.document_id,
  bo.total_value as quote_value,
  bi.line_id,
  fi.net_value as invoice_value
FROM phc.bo bo
INNER JOIN phc.bi bi ON bo.document_id = bi.document_id
INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
LEFT JOIN public.user_siglas us
  ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
LEFT JOIN public.profiles p ON us.profile_id = p.id
LEFT JOIN public.departamentos d ON p.departamento_id = d.id
WHERE bo.document_date >= '2025-01-01'
  AND bo.document_date <= CURRENT_DATE
  AND bo.document_type = 'Orçamento'
  AND ft.anulado = false
  AND COALESCE(d.nome, 'IMACX') = 'Brindes'
LIMIT 10;


-- =====================================================
-- TEST 4: GET DEPARTMENT CUSTOMER METRICS
-- =====================================================
-- Expected: Should return customer counts YTD vs LYTD for Brindes

SELECT * FROM get_department_customer_metrics(
  'Brindes',           -- department name
  '2025-01-01',        -- YTD start
  CURRENT_DATE,        -- YTD end
  '2024-01-01',        -- LYTD start
  '2024-11-16'         -- LYTD end (same day last year)
);

-- If this fails, try this simpler version to debug:
-- This tests just YTD customers
SELECT DISTINCT
  ft.customer_id,
  cl.customer_name,
  d.nome as department_name
FROM phc.ft ft
LEFT JOIN phc.cl cl ON ft.customer_id = cl.customer_id
LEFT JOIN public.user_siglas us
  ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
LEFT JOIN public.profiles p ON us.profile_id = p.id
LEFT JOIN public.departamentos d ON p.departamento_id = d.id
WHERE ft.invoice_date >= '2025-01-01'
  AND ft.invoice_date <= CURRENT_DATE
  AND ft.anulado = false
  AND COALESCE(d.nome, 'IMACX') = 'Brindes'
LIMIT 10;


-- =====================================================
-- TEST 5: GET DEPARTMENT PIPELINE
-- =====================================================
-- Expected: Should return open quotes by category for Brindes

SELECT * FROM get_department_pipeline(
  'Brindes',           -- department name
  '2025-01-01',        -- start date
  CURRENT_DATE         -- end date
);

-- If this fails, try this simpler version to debug:
-- This tests open quotes (no invoices yet)
SELECT
  bo.document_number,
  bo.document_date,
  cl.customer_name,
  bo.total_value,
  (CURRENT_DATE - bo.document_date) as days_open,
  d.nome as department_name
FROM phc.bo bo
LEFT JOIN phc.cl cl ON bo.customer_id = cl.customer_id
LEFT JOIN public.user_siglas us
  ON UPPER(TRIM(COALESCE(cl.salesperson, 'IMACX'))) = UPPER(TRIM(us.sigla))
LEFT JOIN public.profiles p ON us.profile_id = p.id
LEFT JOIN public.departamentos d ON p.departamento_id = d.id
WHERE bo.document_date >= '2025-01-01'
  AND bo.document_date <= CURRENT_DATE
  AND bo.document_type = 'Orçamento'
  AND COALESCE(d.nome, 'IMACX') = 'Brindes'
  -- Exclude converted quotes
  AND NOT EXISTS (
    SELECT 1
    FROM phc.bi bi
    INNER JOIN phc.fi fi ON bi.line_id = fi.bistamp
    INNER JOIN phc.ft ft ON fi.invoice_id = ft.invoice_id
    WHERE bi.document_id = bo.document_id
      AND ft.anulado = false
  )
LIMIT 10;


-- =====================================================
-- DIAGNOSTIC QUERIES
-- =====================================================
-- Run these to understand the data structure

-- Check department names
SELECT id, nome, codigo, is_vendas, active
FROM departamentos
WHERE active = true
ORDER BY nome;

-- Check user_siglas mapping
SELECT
  us.sigla,
  p.departamento_id,
  d.nome as department_name,
  COUNT(*) as count
FROM user_siglas us
JOIN profiles p ON us.profile_id = p.id
LEFT JOIN departamentos d ON p.departamento_id = d.id
GROUP BY us.sigla, p.departamento_id, d.nome
ORDER BY d.nome, us.sigla;

-- Check PHC table field names and types
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'phc'
  AND table_name = 'bo'
  AND column_name IN ('total_value', 'document_type', 'document_date')
ORDER BY ordinal_position;

SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'phc'
  AND table_name = 'ft'
  AND column_name IN ('net_value', 'anulado', 'document_type', 'invoice_date')
ORDER BY ordinal_position;

SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'phc'
  AND table_name = 'fi'
  AND column_name IN ('net_value', 'bistamp')
ORDER BY ordinal_position;

-- Check if anulado is text or boolean
SELECT DISTINCT anulado, pg_typeof(anulado) as type
FROM phc.ft
LIMIT 10;

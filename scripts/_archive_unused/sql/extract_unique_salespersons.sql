-- Extract all unique salesperson names from PHC tables
-- This helps identify what siglas/salesperson names need to be assigned to users

-- Combine all unique salesperson values from different PHC tables
WITH all_salespersons AS (
  -- From phc.fi (invoice lines - current year)
  SELECT DISTINCT
    salesperson_name AS salesperson,
    'phc.fi' AS source_table
  FROM phc.fi
  WHERE salesperson_name IS NOT NULL
    AND TRIM(salesperson_name) != ''

  UNION

  -- From phc.cl (customers/clients)
  SELECT DISTINCT
    salesperson AS salesperson,
    'phc.cl' AS source_table
  FROM phc.cl
  WHERE salesperson IS NOT NULL
    AND TRIM(salesperson) != ''

  UNION

  -- From phc."2years_ft" (invoices - 2 year history) - Note: quoted because starts with number
  SELECT DISTINCT
    salesperson_name AS salesperson,
    'phc.2years_ft' AS source_table
  FROM phc."2years_ft"
  WHERE salesperson_name IS NOT NULL
    AND TRIM(salesperson_name) != ''

  UNION

  -- From phc."2years_fi" (invoice lines - 2 year history) - Note: quoted because starts with number
  SELECT DISTINCT
    salesperson_name AS salesperson,
    'phc.2years_fi' AS source_table
  FROM phc."2years_fi"
  WHERE salesperson_name IS NOT NULL
    AND TRIM(salesperson_name) != ''
)

-- Get unique salesperson names with sources and count occurrences
SELECT
  salesperson,
  STRING_AGG(DISTINCT source_table, ', ' ORDER BY source_table) AS found_in_tables,
  COUNT(DISTINCT source_table) AS table_count
FROM all_salespersons
GROUP BY salesperson
ORDER BY salesperson;

-- Summary: Total unique salespersons
-- SELECT COUNT(DISTINCT salesperson) as total_unique_salespersons FROM all_salespersons;

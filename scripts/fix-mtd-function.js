/**
 * Fix MTD Function - Direct SQL Execution
 * Run with: node scripts/fix-mtd-function.js
 */

const fs = require('fs');
const path = require('path');

// Import admin client
const { createAdminClient } = require('../utils/supabaseAdmin.ts');

const SQL = `
CREATE OR REPLACE FUNCTION public.get_cost_center_sales_mtd()
RETURNS TABLE (
  centro_custo TEXT,
  vendas NUMERIC,
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
    AND (ft.anulado IS NULL OR ft.anulado = '' OR ft.anulado = '0' OR ft.anulado = 'N')
    AND TRIM(fi.cost_center) IN (
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
)
SELECT
  COALESCE(NULLIF(TRIM(sm.cost_center), ''), '(Sem Centro de Custo)') AS centro_custo,
  COALESCE(sm.vendas, 0)::NUMERIC AS vendas,
  0::NUMERIC AS var_pct,
  COALESCE(sm.num_faturas, 0)::INTEGER AS num_faturas,
  COALESCE(sm.num_clientes, 0)::INTEGER AS num_clientes,
  COALESCE(sm.ticket_medio, 0)::NUMERIC AS ticket_medio
FROM sales_month sm
ORDER BY vendas DESC;
$$;
`;

async function main() {
  console.log('🔧 Fixing MTD Function\n');

  try {
    const supabase = createAdminClient();

    console.log('   Applying TRIM fix to cost_center filter...\n');

    // Test the current function first
    console.log('📊 BEFORE fix:');
    const { data: beforeData, error: beforeError } = await supabase.rpc('get_cost_center_sales_mtd');

    if (beforeError) {
      console.log('   ⚠️  Error calling function:', beforeError.message);
    } else {
      console.log(`   Rows returned: ${beforeData?.length || 0}`);
      if (beforeData && beforeData.length > 0) {
        console.table(beforeData);
      }
    }

    console.log('\n📝 To apply the fix, you need to run this SQL in Supabase SQL Editor:');
    console.log('\n' + '='.repeat(80));
    console.log(SQL);
    console.log('='.repeat(80) + '\n');

    console.log('📋 INSTRUCTIONS:');
    console.log('   1. Open https://supabase.com/dashboard/project/bnfixjkjrbfalgcqhzof/sql/new');
    console.log('   2. Copy the SQL above (or use TEMP/docs/FIX_MTD_FUNCTION.sql)');
    console.log('   3. Paste and click RUN');
    console.log('   4. Come back and run: node scripts/test-mtd-function.js\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

/**
 * Debug script to check multi-year revenue data structure
 * Run: node scripts/debug_multiyear_data.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nviqkrrhzbgtzklxwxkr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aXFrcnJoemJndHprbHh3eGtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzIxMjU1MywiZXhwIjoyMDQyNzg4NTUzfQ.4frvQFi_j-mO3cXzV-YBD5xtT12SdDpFMvBujWE0sQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMultiYearData() {
  console.log('\n=== Multi-Year Revenue Debug ===\n');

  const now = new Date();
  const currentYear = now.getFullYear();

  // Test current year (2025) post-April data
  console.log('1. Testing 2025 post-April data via RPC:');
  const { data: rows2025, error: error2025 } = await supabase.rpc('get_invoices_for_period', {
    start_date: '2025-05-01',
    end_date: '2025-11-30',
    use_historical: false,
  });

  if (error2025) {
    console.error('Error:', error2025);
  } else {
    console.log(`Total rows returned: ${rows2025.length}`);

    if (rows2025.length > 0) {
      console.log('\nSample row 0:', {
        invoice_date: rows2025[0].invoice_date,
        invoice_date_type: typeof rows2025[0].invoice_date,
        net_value: rows2025[0].net_value,
        net_value_type: typeof rows2025[0].net_value,
        document_type: rows2025[0].document_type,
        anulado: rows2025[0].anulado,
      });

      console.log('\nSample row (last):', {
        invoice_date: rows2025[rows2025.length - 1].invoice_date,
        invoice_date_type: typeof rows2025[rows2025.length - 1].invoice_date,
        net_value: rows2025[rows2025.length - 1].net_value,
        net_value_type: typeof rows2025[rows2025.length - 1].net_value,
        document_type: rows2025[rows2025.length - 1].document_type,
        anulado: rows2025[rows2025.length - 1].anulado,
      });

      // Count by month
      const monthCounts = {};
      for (const row of rows2025) {
        const d = new Date(row.invoice_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      }
      console.log('\nMonth distribution:', monthCounts);

      // Test date parsing
      console.log('\nDate parsing tests:');
      const testRow = rows2025[0];
      const d1 = new Date(testRow.invoice_date);
      console.log(`  new Date("${testRow.invoice_date}"):`, d1, 'isValid:', !isNaN(d1.getTime()));
      console.log(`  getFullYear():`, d1.getFullYear());
      console.log(`  getMonth():`, d1.getMonth());

      // Test net_value parsing
      console.log('\nNet value parsing tests:');
      const netValue = Number(testRow.net_value || 0);
      console.log(`  Number("${testRow.net_value}"):`, netValue, 'isNaN:', isNaN(netValue));
    }
  }

  // Test full year aggregation (same as API)
  console.log('\n\n2. Testing full year 2025 aggregation (Jan-Nov):');
  const { data: fullYear, error: errorFull } = await supabase.rpc('get_invoices_for_period', {
    start_date: '2025-01-01',
    end_date: now.toISOString().split('T')[0],
    use_historical: false,
  });

  if (errorFull) {
    console.error('Error:', errorFull);
  } else {
    console.log(`Total rows for 2025: ${fullYear.length}`);

    // Aggregate by month (same logic as API)
    const monthMap = new Map();
    let skippedInvalidType = 0;
    let skippedCancelled = 0;
    let processedRows = 0;

    for (const row of fullYear) {
      const isValidType = row.document_type === 'Factura' || row.document_type === 'Nota de Crédito';
      const isNotCancelled = !row.anulado || row.anulado !== 'True';

      if (!isValidType) {
        skippedInvalidType++;
        continue;
      }
      if (!isNotCancelled) {
        skippedCancelled++;
        continue;
      }

      const d = new Date(row.invoice_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const current = monthMap.get(key) || 0;
      monthMap.set(key, current + Number(row.net_value || 0));
      processedRows++;
    }

    console.log('Processing summary:', {
      totalRows: fullYear.length,
      skippedInvalidType,
      skippedCancelled,
      processedRows,
      uniqueMonths: monthMap.size,
    });

    console.log('\nMonths in map:', Array.from(monthMap.keys()).sort());

    console.log('\nRevenue by month:');
    for (const [month, revenue] of Array.from(monthMap.entries()).sort()) {
      console.log(`  ${month}: €${Math.round(revenue).toLocaleString()}`);
    }
  }
}

checkMultiYearData().catch(console.error);

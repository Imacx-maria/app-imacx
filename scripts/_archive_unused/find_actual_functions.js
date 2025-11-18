const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bnfixjkjrbfalgcqhzof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuZml4amtqcmJmYWxnY3Foem9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDY0NzMxNiwiZXhwIjoyMDYwMjIzMzE2fQ.tlB_snZsX5mY3g453yyx3DFVrVSa7xxU6JUx_yzIoBc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findActualFunctions() {
  console.log('='.repeat(80));
  console.log('SEARCHING FOR ACTUAL DEPARTMENT FUNCTIONS');
  console.log('='.repeat(80));
  console.log();

  // Try possible function names based on the hint
  const possibleFunctions = [
    'get_department_rankings_ytd',
    'get_department_rankings_mtd',
    'get_department_conversion_rates_ytd',
    'get_department_conversion_rates_mtd',
    'get_department_conversion_rates_by_escalao',
    'get_company_conversion_rates_by_escalao',
    'get_department_data',
    'get_department_stats',
    'get_department_performance'
  ];

  console.log('Testing possible function names:');
  console.log('-'.repeat(80));

  for (const funcName of possibleFunctions) {
    try {
      // Try with year parameter only (for YTD/MTD functions)
      const { data, error } = await supabase.rpc(funcName, {
        target_year: 2025
      });

      if (error) {
        if (error.message.includes('Could not find the function')) {
          console.log(`❌ ${funcName}`);
        } else {
          console.log(`✓ ${funcName} - EXISTS`);
          console.log(`   Parameters: target_year (and possibly others)`);
          console.log(`   Error when called: ${error.message.substring(0, 100)}`);
        }
      } else {
        console.log(`✓✓ ${funcName} - EXISTS AND WORKS`);
        console.log(`   Returned ${data ? data.length : 0} rows`);
        if (data && data.length > 0) {
          console.log(`   Sample columns:`, Object.keys(data[0]).join(', '));
        }
      }
    } catch (e) {
      // Try with both year and month
      try {
        const { data, error } = await supabase.rpc(funcName, {
          target_year: 2025,
          target_month: 11
        });

        if (error) {
          if (!error.message.includes('Could not find the function')) {
            console.log(`✓ ${funcName} - EXISTS (requires year + month)`);
            console.log(`   Error: ${error.message.substring(0, 100)}`);
          }
        } else {
          console.log(`✓✓ ${funcName} - EXISTS AND WORKS (year + month)`);
          console.log(`   Returned ${data ? data.length : 0} rows`);
        }
      } catch (e2) {
        // Function doesn't exist
      }
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('Testing specific functions mentioned in migrations:');
  console.log('-'.repeat(80));

  // Check the exact function signature from migration files
  const migrationFunctions = [
    { name: 'get_department_rankings_ytd', params: { target_year: 2025 } },
    { name: 'get_department_rankings_mtd', params: { target_year: 2025, target_month: 11 } },
    { name: 'get_company_conversion_rates_by_escalao', params: { target_year: 2025 } }
  ];

  for (const func of migrationFunctions) {
    try {
      const { data, error } = await supabase.rpc(func.name, func.params);

      if (error) {
        console.log(`\n${func.name}:`);
        console.log(`  Status: ${error.message.includes('Could not find') ? 'DOES NOT EXIST' : 'EXISTS BUT ERROR'}`);
        console.log(`  Error: ${error.message}`);
        if (error.hint) console.log(`  Hint: ${error.hint}`);
      } else {
        console.log(`\n${func.name}:`);
        console.log(`  Status: ✓✓ EXISTS AND WORKS`);
        console.log(`  Rows returned: ${data ? data.length : 0}`);
        if (data && data.length > 0) {
          console.log(`  Sample data:`, JSON.stringify(data[0], null, 2));
        }
      }
    } catch (e) {
      console.log(`\n${func.name}:`);
      console.log(`  Status: ERROR - ${e.message}`);
    }
  }

  console.log();
  console.log('='.repeat(80));
}

findActualFunctions().catch(console.error);

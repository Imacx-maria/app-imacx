const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bnfixjkjrbfalgcqhzof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuZml4amtqcmJmYWxnY3Foem9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDY0NzMxNiwiZXhwIjoyMDYwMjIzMzE2fQ.tlB_snZsX5mY3g453yyx3DFVrVSa7xxU6JUx_yzIoBc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHintedFunctions() {
  console.log('='.repeat(80));
  console.log('CHECKING FUNCTIONS FROM SUPABASE HINTS');
  console.log('='.repeat(80));
  console.log();

  // Functions suggested by Supabase error hints
  const hintedFunctions = [
    { name: 'get_department_rankings_ytd', params: { target_year: 2025 } },
    { name: 'get_company_conversion_rates', params: { target_year: 2025 } }
  ];

  for (const func of hintedFunctions) {
    console.log(`\nTesting: ${func.name}`);
    console.log('-'.repeat(80));

    try {
      const { data, error } = await supabase.rpc(func.name, func.params);

      if (error) {
        console.log(`❌ Error calling ${func.name}:`);
        console.log(`   Message: ${error.message}`);
        console.log(`   Code: ${error.code}`);
        if (error.hint) console.log(`   Hint: ${error.hint}`);
        if (error.details) console.log(`   Details: ${error.details}`);
      } else {
        console.log(`✓✓ ${func.name} - SUCCESS!`);
        console.log(`   Rows returned: ${data ? data.length : 0}`);
        if (data && data.length > 0) {
          console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
          console.log(`   First row:`, JSON.stringify(data[0], null, 2));
        } else {
          console.log(`   (No data returned - might be empty result set)`);
        }
      }
    } catch (e) {
      console.log(`❌ Exception: ${e.message}`);
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('CHECKING FOR ANY get_* FUNCTIONS');
  console.log('='.repeat(80));
  console.log();

  // Try some common function names that might exist
  const commonFunctions = [
    'get_user',
    'get_profile',
    'get_permissions',
    'get_roles',
    'get_kpi_data',
    'get_financial_data',
    'get_company_data'
  ];

  console.log('Checking common function patterns:');
  for (const funcName of commonFunctions) {
    try {
      const { data, error } = await supabase.rpc(funcName, {});

      if (!error || !error.message.includes('Could not find')) {
        console.log(`✓ ${funcName} exists`);
      }
    } catch (e) {
      // Silently skip non-existent functions
    }
  }

  console.log('\n' + '='.repeat(80));
}

checkHintedFunctions().catch(console.error);

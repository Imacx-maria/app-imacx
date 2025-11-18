const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bnfixjkjrbfalgcqhzof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuZml4amtqcmJmYWxnY3Foem9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDY0NzMxNiwiZXhwIjoyMDYwMjIzMzE2fQ.tlB_snZsX5mY3g453yyx3DFVrVSa7xxU6JUx_yzIoBc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAppliedMigrations() {
  console.log('='.repeat(80));
  console.log('CHECKING APPLIED MIGRATIONS AND EXISTING FUNCTIONS');
  console.log('='.repeat(80));
  console.log();

  // Check for migration tracking tables
  console.log('1. Checking for migration tracking:');
  console.log('-'.repeat(80));

  const possibleTables = ['schema_migrations', 'supabase_migrations', '_migrations'];

  for (const table of possibleTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(5);

      if (!error) {
        console.log(`✓ Found migration table: ${table}`);
        console.log(`  Sample entries:`, data);
      }
    } catch (e) {
      // Table doesn't exist
    }
  }

  console.log();
  console.log('2. Testing known working functions:');
  console.log('-'.repeat(80));

  // Test the function we know exists from the migration
  const knownFunctions = [
    { name: 'get_department_rankings_ytd', params: {} },
    { name: 'calculate_department_kpis', params: {
      departamento_nome: 'IMACX',
      start_date: '2025-01-01',
      end_date: '2025-11-17',
      source_table: 'ft'
    }},
    { name: 'calculate_department_quotes', params: {
      departamento_nome: 'IMACX',
      start_date: '2025-01-01',
      end_date: '2025-11-17',
      source_table: 'bo'
    }},
    { name: 'get_department_escaloes_orcamentos', params: {
      departamento_nome: 'IMACX',
      start_date: '2025-01-01',
      end_date: '2025-11-17'
    }},
    { name: 'get_department_escaloes_faturas', params: {
      departamento_nome: 'IMACX',
      start_date: '2025-01-01',
      end_date: '2025-11-17'
    }},
    { name: 'get_department_conversion_rates', params: {
      departamento_nome: 'IMACX',
      start_date: '2025-01-01',
      end_date: '2025-11-17'
    }},
    { name: 'get_department_customer_metrics', params: {
      departamento_nome: 'IMACX',
      ytd_start: '2025-01-01',
      ytd_end: '2025-11-17',
      lytd_start: '2024-01-01',
      lytd_end: '2024-11-17'
    }},
    { name: 'get_department_pipeline', params: {
      departamento_nome: 'IMACX',
      start_date: '2025-01-01',
      end_date: '2025-11-17'
    }}
  ];

  for (const func of knownFunctions) {
    try {
      console.log(`\nTesting: ${func.name}`);
      const { data, error } = await supabase.rpc(func.name, func.params);

      if (error) {
        if (error.message.includes('Could not find the function')) {
          console.log(`  ❌ DOES NOT EXIST`);
        } else {
          console.log(`  ✓ EXISTS (execution error: ${error.message.substring(0, 80)})`);
        }
      } else {
        console.log(`  ✓✓ EXISTS AND WORKS`);
        console.log(`     Returned ${data ? data.length : 0} rows`);
        if (data && data.length > 0) {
          console.log(`     Columns: ${Object.keys(data[0]).join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`  ❌ ERROR: ${e.message.substring(0, 80)}`);
    }
  }

  console.log();
  console.log('3. Checking user_name_mapping vs user_siglas:');
  console.log('-'.repeat(80));

  // Check which user mapping table exists
  try {
    const { data: unmData, error: unmError } = await supabase
      .from('user_name_mapping')
      .select('*', { count: 'exact', head: true });

    if (unmError) {
      console.log(`❌ user_name_mapping - ${unmError.message.substring(0, 80)}`);
    } else {
      console.log(`✓ user_name_mapping exists`);
    }
  } catch (e) {
    console.log(`❌ user_name_mapping - ${e.message.substring(0, 80)}`);
  }

  try {
    const { data: usData, error: usError } = await supabase
      .from('user_siglas')
      .select('*', { count: 'exact', head: true });

    if (usError) {
      console.log(`❌ user_siglas - ${usError.message.substring(0, 80)}`);
    } else {
      console.log(`✓ user_siglas exists`);
    }
  } catch (e) {
    console.log(`❌ user_siglas - ${e.message.substring(0, 80)}`);
  }

  try {
    const { data: deptData, error: deptError } = await supabase
      .from('departamentos')
      .select('*');

    if (deptError) {
      console.log(`❌ departamentos - ${deptError.message.substring(0, 80)}`);
    } else {
      console.log(`✓ departamentos exists - ${deptData.length} departments found`);
      console.log(`  Departments:`, deptData.map(d => d.nome).join(', '));
    }
  } catch (e) {
    console.log(`❌ departamentos - ${e.message.substring(0, 80)}`);
  }

  console.log();
  console.log('='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

checkAppliedMigrations().catch(console.error);

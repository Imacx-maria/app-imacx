/**
 * Script to apply monthly revenue RPC function migration
 * Run: node scripts/apply_monthly_revenue_migration.js
 */

const fs = require('fs');
const path = require('path');

console.log('📋 Monthly Revenue RPC Migration\n');
console.log('=' .repeat(60));

const sqlPath = path.join(__dirname, '../supabase/migrations/_applied/20251216_create_monthly_revenue_rpc.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('\n📄 Migration File:');
console.log('   supabase/migrations/_applied/20251216_create_monthly_revenue_rpc.sql\n');

console.log('📦 Function to Create:');
console.log('   get_monthly_revenue_breakdown(target_year, end_date)\n');

console.log('🔧 How to Apply:\n');
console.log('1. Go to Supabase Dashboard → SQL Editor');
console.log('   https://supabase.com/dashboard/project/bnfixjkjrbfalgcqhzof/sql\n');

console.log('2. Copy the SQL below and paste it into the SQL Editor:\n');
console.log('=' .repeat(60));
console.log(sql);
console.log('=' .repeat(60));

console.log('\n3. Click "Run" to execute the SQL\n');

console.log('✅ After applying, test with:\n');
console.log('   node -e "');
console.log('   const { createClient } = require(\'@supabase/supabase-js\');');
console.log('   require(\'dotenv\').config({ path: \'.env.local\' });');
console.log('   const supabase = createClient(');
console.log('     process.env.NEXT_PUBLIC_SUPABASE_URL,');
console.log('     process.env.SUPABASE_SERVICE_ROLE_KEY');
console.log('   );');
console.log('   (async () => {');
console.log('     const { data, error } = await supabase.rpc(\'get_monthly_revenue_breakdown\', {');
console.log('       target_year: 2025,');
console.log('       end_date: \'2025-11-16\'');
console.log('     });');
console.log('     if (error) console.error(\'❌\', error);');
console.log('     else console.log(\'✅ Found\', data.length, \'months of data\');');
console.log('   })();');
console.log('   "\n');

console.log('📚 Documentation:');
console.log('   TEMP/docs/features/FINANCIAL_ANALYSIS_MONTHLY_REVENUE_FIX.md\n');

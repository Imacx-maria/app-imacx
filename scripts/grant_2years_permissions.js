/**
 * Script to grant permissions on 2years_ft and 2years_fi tables
 * Run with: node scripts/grant_2years_permissions.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function grantPermissions() {
  console.log('🔧 Granting permissions on 2years_ft and 2years_fi tables...\n');

  const grants = [
    'GRANT SELECT ON phc."2years_ft" TO service_role',
    'GRANT SELECT ON phc."2years_ft" TO authenticated',
    'GRANT SELECT ON phc."2years_ft" TO anon',
    'GRANT SELECT ON phc."2years_fi" TO service_role',
    'GRANT SELECT ON phc."2years_fi" TO authenticated',
    'GRANT SELECT ON phc."2years_fi" TO anon',
  ];

  for (const grant of grants) {
    console.log(`Executing: ${grant}`);
    const { error } = await supabase.rpc('exec', { sql: grant });

    if (error) {
      console.error(`❌ Error executing grant: ${error.message}`);
      console.log('\n⚠️  The error above is expected if there\'s no exec RPC function.');
      console.log('📝 Please run the migration manually using:');
      console.log('   npx supabase db push\n');
      process.exit(1);
    } else {
      console.log(`✅ ${grant}\n`);
    }
  }

  console.log('✅ All permissions granted successfully!');
}

grantPermissions().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

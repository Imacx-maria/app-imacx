/**
 * Test MTD Function After Fix
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  // Skip comments and empty lines
  line = line.trim();
  if (!line || line.startsWith('#')) return;

  const equalIndex = line.indexOf('=');
  if (equalIndex > 0) {
    const key = line.substring(0, equalIndex).trim();
    const value = line.substring(equalIndex + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing credentials:');
  console.error('   supabaseUrl:', supabaseUrl);
  console.error('   supabaseServiceKey:', supabaseServiceKey ? '[PRESENT]' : '[MISSING]');
  console.error('\nAvailable env keys:', Object.keys(env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

async function test() {
  console.log('🧪 Testing get_cost_center_sales_mtd()...\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data, error } = await supabase.rpc('get_cost_center_sales_mtd');

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log(`📊 Rows returned: ${data?.length || 0}\n`);

  if (!data || data.length === 0) {
    console.log('⚠️  Still returning 0 rows!');
    console.log('   The TRIM fix was not sufficient.');
    console.log('   Next step: Check cost_center encoding/spelling');
  } else {
    console.log('✅ SUCCESS! Data returned:\n');
    console.table(data);

    const total = data.reduce((sum, cc) => sum + Number(cc.vendas), 0);
    console.log(`\n💰 Total MTD Sales: €${total.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`);
    console.log('\n🎉 The UI should now display this data!');
  }
}

test();

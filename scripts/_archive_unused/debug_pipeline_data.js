const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugPipelineData() {
  console.log('🔍 Debugging vw_orcamentos_pipeline data...\n');

  try {
    // Query all data from the view
    const { data, error } = await supabase
      .from('vw_orcamentos_pipeline')
      .select('*')
      .order('document_date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Error fetching data:', error);
      return;
    }

    console.log(`✅ Total records found: ${data.length}\n`);

    // Group by departamento and status
    const grouped = {};
    data.forEach(item => {
      const key = `${item.departamento} - ${item.status}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });

    // Display summary
    console.log('📊 Summary by Department and Status:');
    Object.entries(grouped).forEach(([key, items]) => {
      console.log(`  ${key}: ${items.length} items`);
    });

    console.log('\n🔍 Sample data (first 5 records):');
    data.slice(0, 5).forEach((item, idx) => {
      console.log(`\n  [${idx + 1}] ${item.departamento} - ${item.status}`);
      console.log(`      Document Date: ${item.document_date}`);
      console.log(`      Total Value: €${item.total_value}`);
      console.log(`      Cliente: ${item.cliente_nome}`);
    });

    // Check for PERDIDO status specifically
    const perdidos = data.filter(item => item.status === 'PERDIDO');
    console.log(`\n🔴 Total PERDIDO records: ${perdidos.length}`);
    
    if (perdidos.length > 0) {
      console.log('   Sample PERDIDO records:');
      perdidos.slice(0, 3).forEach((item, idx) => {
        const daysOld = Math.floor((Date.now() - new Date(item.document_date).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   [${idx + 1}] ${item.departamento} - ${item.cliente_nome} - €${item.total_value} - ${daysOld} days old`);
      });
    }

    // Check date range for last 60 days
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const perdidosLast60 = perdidos.filter(item => new Date(item.document_date) >= sixtyDaysAgo);
    console.log(`\n📅 PERDIDO records in last 60 days: ${perdidosLast60.length}`);

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

debugPipelineData();

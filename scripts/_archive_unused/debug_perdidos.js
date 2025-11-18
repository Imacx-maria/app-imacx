const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugPerdidos() {
  console.log('🔍 Debugging PERDIDOS data...\n');

  try {
    // Query: Orçamentos NÃO faturados (sem invoice)
    const { data: unfactured, error: unfacturedError } = await supabase
      .from('vw_orcamentos_pipeline')
      .select('*')
      .is('invoice_id', null)
      .order('document_date', { ascending: true })
      .limit(50);

    if (unfacturedError) {
      console.error('❌ Error fetching unfactured:', unfacturedError);
      return;
    }

    console.log(`📊 Total unfactured quotes (no invoice): ${unfactured.length}\n`);

    // Group by age
    const today = new Date();
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const older60 = unfactured.filter(item => new Date(item.document_date) < sixtyDaysAgo);
    const younger60 = unfactured.filter(item => new Date(item.document_date) >= sixtyDaysAgo);

    console.log(`🔴 Unfactured > 60 days: ${older60.length}`);
    console.log(`🟡 Unfactured < 60 days: ${younger60.length}\n`);

    if (older60.length > 0) {
      console.log('📋 Top 10 oldest unfactured (should be PERDIDO):');
      older60.slice(0, 10).forEach((item, idx) => {
        const daysOld = Math.floor((today.getTime() - new Date(item.document_date).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  [${idx + 1}] ${item.departamento} | ${item.cliente_nome} | €${item.total_value} | ${daysOld} days old | Status: ${item.status}`);
      });
    }

    // Check what the view is returning for status
    console.log('\n🔍 Checking view status calculation:');
    const { data: viewData, error: viewError } = await supabase
      .from('vw_orcamentos_pipeline')
      .select('*')
      .is('invoice_id', null)
      .order('document_date', { ascending: true })
      .limit(5);

    if (!viewError && viewData) {
      viewData.forEach((item, idx) => {
        const daysOld = Math.floor((today.getTime() - new Date(item.document_date).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  [${idx + 1}] Date: ${item.document_date} | Days: ${daysOld} | Status: ${item.status} | Should be: ${daysOld > 60 ? 'PERDIDO' : 'PENDENTE'}`);
      });
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

debugPerdidos();

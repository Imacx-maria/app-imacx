const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log('🧪 COMPREHENSIVE TEST OF ALL FIXES\n');
  console.log('=' .repeat(80));

  try {
    // Test 1: Check view exists and has data
    console.log('\n✅ TEST 1: View vw_orcamentos_pipeline exists and has data');
    const { data: viewData, error: viewError } = await supabase
      .from('vw_orcamentos_pipeline')
      .select('*')
      .limit(1);

    if (viewError) {
      console.error('❌ Error:', viewError.message);
    } else {
      console.log(`✓ View exists and accessible`);
      console.log(`✓ Sample record:`, viewData[0] ? {
        orcamento_numero: viewData[0].orcamento_numero,
        cliente_nome: viewData[0].cliente_nome,
        status: viewData[0].status,
        departamento: viewData[0].departamento
      } : 'No data');
    }

    // Test 2: Check PERDIDO records exist
    console.log('\n✅ TEST 2: PERDIDO records (quotes >60 days old, not invoiced)');
    const { data: perdidosData, error: perdidosError } = await supabase
      .from('vw_orcamentos_pipeline')
      .select('*')
      .eq('status', 'PERDIDO')
      .order('total_value', { ascending: false })
      .limit(5);

    if (perdidosError) {
      console.error('❌ Error:', perdidosError.message);
    } else {
      console.log(`✓ Found ${perdidosData.length} PERDIDO records`);
      if (perdidosData.length > 0) {
        perdidosData.forEach((item, idx) => {
          const daysOld = Math.floor((new Date() - new Date(item.document_date)) / (1000 * 60 * 60 * 24));
          console.log(`  [${idx + 1}] ${item.departamento} | ${item.cliente_nome} | €${item.total_value} | ${daysOld} days old`);
        });
      }
    }

    // Test 3: Check APROVADO records exist
    console.log('\n✅ TEST 3: APROVADO records (quotes that became invoices)');
    const { data: aprovadosData, error: aprovadosError } = await supabase
      .from('vw_orcamentos_pipeline')
      .select('*')
      .eq('status', 'APROVADO')
      .order('invoice_date', { ascending: false })
      .limit(5);

    if (aprovadosError) {
      console.error('❌ Error:', aprovadosError.message);
    } else {
      console.log(`✓ Found ${aprovadosData.length} APROVADO records`);
      if (aprovadosData.length > 0) {
        aprovadosData.forEach((item, idx) => {
          console.log(`  [${idx + 1}] ${item.departamento} | ${item.cliente_nome} | €${item.total_value} | Invoice: ${item.invoice_numero}`);
        });
      }
    }

    // Test 4: Check PENDENTE records exist
    console.log('\n✅ TEST 4: PENDENTE records (recent quotes, not yet invoiced)');
    const { data: pendenteData, error: pendenteError } = await supabase
      .from('vw_orcamentos_pipeline')
      .select('*')
      .eq('status', 'PENDENTE')
      .order('document_date', { ascending: false })
      .limit(5);

    if (pendenteError) {
      console.error('❌ Error:', pendenteError.message);
    } else {
      console.log(`✓ Found ${pendenteData.length} PENDENTE records`);
      if (pendenteData.length > 0) {
        pendenteData.forEach((item, idx) => {
          const daysOld = Math.floor((new Date() - new Date(item.document_date)) / (1000 * 60 * 60 * 24));
          console.log(`  [${idx + 1}] ${item.departamento} | ${item.cliente_nome} | €${item.total_value} | ${daysOld} days old`);
        });
      }
    }

    // Test 5: Check department filtering works
    console.log('\n✅ TEST 5: Department filtering (Brindes, Digital, IMACX)');
    const departments = ['Brindes', 'Digital', 'IMACX'];
    for (const dept of departments) {
      const { data: deptData, error: deptError } = await supabase
        .from('vw_orcamentos_pipeline')
        .select('*')
        .eq('departamento', dept)
        .limit(1);

      if (deptError) {
        console.log(`  ✗ ${dept}: Error - ${deptError.message}`);
      } else {
        console.log(`  ✓ ${dept}: ${deptData.length} records found`);
      }
    }

    // Test 6: Check pipeline API endpoint
    console.log('\n✅ TEST 6: Pipeline API endpoint');
    const pipelineResponse = await fetch('http://localhost:3000/api/gestao/departamentos/pipeline?departamento=Brindes');
    if (pipelineResponse.ok) {
      const pipelineData = await pipelineResponse.json();
      console.log(`✓ API endpoint working`);
      console.log(`  - Top 15: ${pipelineData.metadata.counts.top15} records`);
      console.log(`  - Needs Attention: ${pipelineData.metadata.counts.needsAttention} records`);
      console.log(`  - Perdidos: ${pipelineData.metadata.counts.perdidos} records`);
      console.log(`  - Aprovados: ${pipelineData.metadata.counts.aprovados} records`);
    } else {
      console.log(`✗ API endpoint error: ${pipelineResponse.status}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS COMPLETED\n');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
})();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAPIFlow() {
  console.log('Testing Department Analysis API Flow (mimicking what API route does)...\n');

  const now = new Date();
  const currentYear = now.getFullYear();

  const startDate = new Date(currentYear, 0, 1).toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];
  const lytdStartDate = new Date(currentYear - 1, 0, 1).toISOString().split('T')[0];
  const lytdEndDate = new Date(currentYear - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];

  console.log(`Date Range: ${startDate} to ${endDate}`);
  console.log(`LYTD Range: ${lytdStartDate} to ${lytdEndDate}\n`);

  const departments = ["Brindes", "Digital", "IMACX"];

  // Mimic what the API route does
  const results = await Promise.all(
    departments.map(async (dept) => {
      try {
        // 1. Escalões de Orçamentos
        const { data: orcamentosData, error: orcamentosError } =
          await supabase.rpc("get_department_escaloes_orcamentos", {
            departamento_nome: dept,
            start_date: startDate,
            end_date: endDate,
          });

        if (orcamentosError) {
          console.error(`❌ Error fetching orcamentos for ${dept}:`, orcamentosError);
        }

        // 2. Escalões de Faturas
        const { data: faturasData, error: faturasError } = await supabase.rpc(
          "get_department_escaloes_faturas",
          {
            departamento_nome: dept,
            start_date: startDate,
            end_date: endDate,
          },
        );

        if (faturasError) {
          console.error(`❌ Error fetching faturas for ${dept}:`, faturasError);
        }

        // 3. Conversion Rates
        const { data: conversaoData, error: conversaoError } =
          await supabase.rpc("get_department_conversion_rates", {
            departamento_nome: dept,
            start_date: startDate,
            end_date: endDate,
          });

        if (conversaoError) {
          console.error(`❌ Error fetching conversion for ${dept}:`, conversaoError);
        }

        // 4. Customer Metrics
        const { data: clientesData, error: clientesError } =
          await supabase.rpc("get_department_customer_metrics", {
            departamento_nome: dept,
            ytd_start: startDate,
            ytd_end: endDate,
            lytd_start: lytdStartDate,
            lytd_end: lytdEndDate,
          });

        if (clientesError) {
          console.error(`❌ Error fetching customers for ${dept}:`, clientesError);
        }

        return {
          departamento: dept,
          orcamentos: (orcamentosData || []).map((row) => ({
            departamento: dept,
            escaloes_valor: row.value_bracket,
            total_orcamentos: row.quote_count,
            total_valor: row.total_value,
            percentage: row.percentage,
          })),
          faturas: (faturasData || []).map((row) => ({
            departamento: dept,
            escaloes_valor: row.value_bracket,
            total_faturas: row.invoice_count,
            total_valor: row.total_value,
            percentage: row.percentage,
          })),
          conversao: (conversaoData || []).map((row) => ({
            departamento: dept,
            escalao: row.value_bracket,
            total_orcamentos: row.quote_count,
            total_faturas: row.invoice_count,
            taxa_conversao_pct: row.conversion_rate,
            total_valor_orcado: row.total_quoted_value,
            total_valor_faturado: row.total_invoiced_value,
          })),
          clientes:
            clientesData && clientesData.length > 0
              ? {
                  departamento: dept,
                  clientes_ytd: clientesData[0].customers_ytd,
                  clientes_lytd: clientesData[0].customers_lytd,
                  clientes_novos: clientesData[0].new_customers,
                  clientes_perdidos: clientesData[0].lost_customers,
                }
              : {
                  departamento: dept,
                  clientes_ytd: 0,
                  clientes_lytd: 0,
                  clientes_novos: 0,
                  clientes_perdidos: 0,
                },
        };
      } catch (error) {
        console.error(`❌ Error fetching data for ${dept}:`, error);
        return {
          departamento: dept,
          orcamentos: [],
          faturas: [],
          conversao: [],
          clientes: {
            departamento: dept,
            clientes_ytd: 0,
            clientes_lytd: 0,
            clientes_novos: 0,
            clientes_perdidos: 0,
          },
        };
      }
    }),
  );

  // Flatten results (what API route does)
  const orcamentos = results.flatMap((r) => r.orcamentos);
  const faturas = results.flatMap((r) => r.faturas);
  const conversao = results.flatMap((r) => r.conversao);
  const clientes = results.map((r) => r.clientes);

  console.log('\n📊 API Response Structure:');
  console.log('  Orcamentos:', orcamentos.length, 'rows');
  console.log('  Faturas:', faturas.length, 'rows');
  console.log('  Conversao:', conversao.length, 'rows');
  console.log('  Clientes:', clientes.length, 'rows');

  if (orcamentos.length > 0) {
    console.log('\n✅ Sample Orcamento (Brindes):');
    const brindesOrc = orcamentos.filter(o => o.departamento === 'Brindes')[0];
    console.log('  ', brindesOrc);
  }

  if (faturas.length > 0) {
    console.log('\n✅ Sample Fatura (Brindes):');
    const brindesFat = faturas.filter(f => f.departamento === 'Brindes')[0];
    console.log('  ', brindesFat);
  }

  if (clientes.length > 0) {
    console.log('\n✅ Sample Cliente (Brindes):');
    const brindesCli = clientes.filter(c => c.departamento === 'Brindes')[0];
    console.log('  ', brindesCli);
  }

  // Test filtering by department (what frontend does)
  console.log('\n📊 Testing Frontend Filter Logic:');
  const selectedDepartment = 'Brindes';
  const filteredOrcamentos = orcamentos.filter(item => item.departamento === selectedDepartment);
  console.log(`  Filtered Orcamentos for ${selectedDepartment}:`, filteredOrcamentos.length);
  if (filteredOrcamentos.length > 0) {
    console.log('    Sample:', filteredOrcamentos[0]);
  } else {
    console.error('    ❌ NO DATA after filtering! This is the problem!');
  }
}

testAPIFlow().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

/**
 * Test script for Department Analysis RPC Functions
 *
 * Run with: node scripts/test_department_rpcs.js
 *
 * This script tests all 5 new RPC functions to verify they return data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const departments = ['Brindes', 'Digital', 'IMACX'];

async function testDepartmentRPCs() {
  console.log('🧪 Testing Department Analysis RPC Functions\n');
  console.log('='.repeat(60));

  const now = new Date();
  const currentYear = now.getFullYear();
  const ytdStart = `${currentYear}-01-01`;
  const ytdEnd = now.toISOString().split('T')[0];
  const lytdStart = `${currentYear - 1}-01-01`;
  const lytdEnd = new Date(currentYear - 1, now.getMonth(), now.getDate())
    .toISOString()
    .split('T')[0];

  console.log(`\n📅 Date Ranges:`);
  console.log(`   YTD:  ${ytdStart} to ${ytdEnd}`);
  console.log(`   LYTD: ${lytdStart} to ${lytdEnd}\n`);
  console.log('='.repeat(60));

  for (const dept of departments) {
    console.log(`\n🏢 Testing Department: ${dept}`);
    console.log('-'.repeat(60));

    // Test 1: Escalões de Orçamentos
    try {
      const { data, error } = await supabase.rpc(
        'get_department_escaloes_orcamentos',
        {
          departamento_nome: dept,
          start_date: ytdStart,
          end_date: ytdEnd,
        }
      );

      if (error) {
        console.log(`❌ Escalões Orçamentos: ERROR - ${error.message}`);
      } else {
        const totalQuotes = data.reduce((sum, row) => sum + Number(row.quote_count), 0);
        const totalValue = data.reduce((sum, row) => sum + Number(row.total_value), 0);
        console.log(
          `✅ Escalões Orçamentos: ${data.length} brackets, ${totalQuotes} quotes, €${totalValue.toFixed(2)}`
        );
      }
    } catch (err) {
      console.log(`❌ Escalões Orçamentos: EXCEPTION - ${err.message}`);
    }

    // Test 2: Escalões de Faturas
    try {
      const { data, error } = await supabase.rpc(
        'get_department_escaloes_faturas',
        {
          departamento_nome: dept,
          start_date: ytdStart,
          end_date: ytdEnd,
        }
      );

      if (error) {
        console.log(`❌ Escalões Faturas: ERROR - ${error.message}`);
      } else {
        const totalInvoices = data.reduce((sum, row) => sum + Number(row.invoice_count), 0);
        const totalValue = data.reduce((sum, row) => sum + Number(row.total_value), 0);
        console.log(
          `✅ Escalões Faturas: ${data.length} brackets, ${totalInvoices} invoices, €${totalValue.toFixed(2)}`
        );
      }
    } catch (err) {
      console.log(`❌ Escalões Faturas: EXCEPTION - ${err.message}`);
    }

    // Test 3: Conversion Rates
    try {
      const { data, error } = await supabase.rpc(
        'get_department_conversion_rates',
        {
          departamento_nome: dept,
          start_date: ytdStart,
          end_date: ytdEnd,
        }
      );

      if (error) {
        console.log(`❌ Conversion Rates: ERROR - ${error.message}`);
      } else {
        const avgConversion = data.length > 0
          ? (data.reduce((sum, row) => sum + Number(row.conversion_rate), 0) / data.length).toFixed(1)
          : 0;
        console.log(
          `✅ Conversion Rates: ${data.length} brackets, Avg rate: ${avgConversion}%`
        );
      }
    } catch (err) {
      console.log(`❌ Conversion Rates: EXCEPTION - ${err.message}`);
    }

    // Test 4: Customer Metrics
    try {
      const { data, error } = await supabase.rpc(
        'get_department_customer_metrics',
        {
          departamento_nome: dept,
          ytd_start: ytdStart,
          ytd_end: ytdEnd,
          lytd_start: lytdStart,
          lytd_end: lytdEnd,
        }
      );

      if (error) {
        console.log(`❌ Customer Metrics: ERROR - ${error.message}`);
      } else if (data && data.length > 0) {
        const metrics = data[0];
        console.log(
          `✅ Customer Metrics: YTD=${metrics.customers_ytd}, LYTD=${metrics.customers_lytd}, ` +
          `New=${metrics.new_customers}, Lost=${metrics.lost_customers}`
        );
      } else {
        console.log(`⚠️  Customer Metrics: No data returned`);
      }
    } catch (err) {
      console.log(`❌ Customer Metrics: EXCEPTION - ${err.message}`);
    }

    // Test 5: Pipeline
    try {
      const { data, error } = await supabase.rpc('get_department_pipeline', {
        departamento_nome: dept,
        start_date: ytdStart,
        end_date: ytdEnd,
      });

      if (error) {
        console.log(`❌ Pipeline: ERROR - ${error.message}`);
      } else {
        const top15 = data.filter((row) => row.category === 'top_15').length;
        const attention = data.filter((row) => row.category === 'needs_attention').length;
        const lost = data.filter((row) => row.category === 'lost').length;
        console.log(
          `✅ Pipeline: Top15=${top15}, Needs Attention=${attention}, Lost=${lost}`
        );
      }
    } catch (err) {
      console.log(`❌ Pipeline: EXCEPTION - ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test Complete\n');
}

// Run tests
testDepartmentRPCs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

/**
 * Test MTD API Endpoint
 */

async function testAPI() {
  const baseURL = 'http://localhost:3000';

  console.log('🧪 Testing MTD API Endpoint...\n');

  try {
    const response = await fetch(`${baseURL}/api/financial-analysis/cost-center-sales?period=mtd`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('📊 API Response:');
    console.log(`   Status: ${response.status} OK`);
    console.log(`   Cost Centers: ${data.costCenters?.length || 0} rows`);
    console.log(`   Period: ${data.metadata?.period}`);
    console.log(`   Date Range: ${data.metadata?.startDate} to ${data.metadata?.endDate}\n`);

    if (data.costCenters && data.costCenters.length > 0) {
      console.log('✅ Cost Centers Data:\n');
      console.table(data.costCenters);

      const totalVendas = data.costCenters.reduce((sum, cc) => sum + cc.vendas, 0);
      console.log(`\n💰 Total MTD Sales: €${totalVendas.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`);
      console.log('\n🎉 API is working! The UI should display this data.');
    } else {
      console.log('⚠️  API returned empty costCenters array');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the Next.js dev server is running:');
    console.log('   npm run dev');
    process.exit(1);
  }
}

testAPI();

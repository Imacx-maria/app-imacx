/**
 * Performance Audit Script
 * 
 * This script navigates through all pages and collects performance metrics.
 * Run this in the browser console after logging in.
 * 
 * Usage:
 * 1. Login to the app
 * 2. Open browser console (F12)
 * 3. Copy and paste this script
 * 4. Wait for it to complete
 * 5. Results will be logged and saved to localStorage
 */

interface PageRoute {
  path: string;
  name: string;
  requiresAuth?: boolean;
}

const PAGES_TO_AUDIT: PageRoute[] = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/designer-flow', name: 'Designer Flow' },
  { path: '/designer-flow/analytics', name: 'Designer Flow Analytics' },
  { path: '/producao', name: 'Produção' },
  { path: '/producao/operacoes', name: 'Produção Operações' },
  { path: '/producao/analytics', name: 'Produção Analytics' },
  { path: '/gestao/analise-financeira', name: 'Análise Financeira' },
  { path: '/gestao/faturacao', name: 'Faturação' },
  { path: '/stocks/gestao', name: 'Stocks Gestão' },
  { path: '/definicoes/utilizadores', name: 'Definições Utilizadores' },
  { path: '/definicoes/funcoes', name: 'Definições Funções' },
  { path: '/definicoes/materiais', name: 'Definições Materiais' },
  { path: '/definicoes/maquinas', name: 'Definições Máquinas' },
  { path: '/definicoes/armazens', name: 'Definições Armazéns' },
  { path: '/definicoes/complexidade', name: 'Definições Complexidade' },
  { path: '/definicoes/transportadoras', name: 'Definições Transportadoras' },
  { path: '/definicoes/feriados', name: 'Definições Feriados' },
  { path: '/definicoes/user-name-mapping', name: 'User Name Mapping' },
  { path: '/reports/top10-brindes', name: 'Top 10 Brindes' },
  { path: '/reports/ai-executive-report', name: 'AI Executive Report' },
];

interface PerformanceAuditResult {
  page: string;
  name: string;
  timestamp: number;
  domContentLoadedTime: number;
  loadCompleteTime: number;
  resourceCount: number;
  slowestResources: Array<{ name: string; duration: number; type: string }>;
  error?: string;
}

async function auditPage(page: PageRoute): Promise<PerformanceAuditResult> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    
    // Clear previous metrics
    performance.clearResourceTimings();
    
    // Navigate to page
    window.location.href = page.path;
    
    // Wait for page to load
    window.addEventListener('load', () => {
      setTimeout(() => {
        try {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          
          const slowestResources = resources
            .map((r) => ({
              name: r.name,
              duration: r.duration,
              type: r.initiatorType,
            }))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5);
          
          const result: PerformanceAuditResult = {
            page: page.path,
            name: page.name,
            timestamp: Date.now(),
            domContentLoadedTime: navigation.domContentLoadedEventEnd - navigation.startTime,
            loadCompleteTime: navigation.loadEventEnd - navigation.startTime,
            resourceCount: resources.length,
            slowestResources,
          };
          
          resolve(result);
        } catch (error: any) {
          resolve({
            page: page.path,
            name: page.name,
            timestamp: Date.now(),
            domContentLoadedTime: 0,
            loadCompleteTime: 0,
            resourceCount: 0,
            slowestResources: [],
            error: error.message,
          });
        }
      }, 2000); // Wait 2 seconds after load
    }, { once: true });
  });
}

async function runAudit() {
  console.log('🚀 Starting performance audit...');
  console.log(`📋 Auditing ${PAGES_TO_AUDIT.length} pages`);
  
  const results: PerformanceAuditResult[] = [];
  
  for (const page of PAGES_TO_AUDIT) {
    console.log(`\n⏳ Auditing: ${page.name} (${page.path})`);
    try {
      const result = await auditPage(page);
      results.push(result);
      console.log(`✅ Completed: ${page.name}`);
      console.log(`   DOM Content Loaded: ${result.domContentLoadedTime.toFixed(2)}ms`);
      console.log(`   Load Complete: ${result.loadCompleteTime.toFixed(2)}ms`);
      console.log(`   Resources: ${result.resourceCount}`);
      
      // Wait before next page
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`❌ Error auditing ${page.name}:`, error);
      results.push({
        page: page.path,
        name: page.name,
        timestamp: Date.now(),
        domContentLoadedTime: 0,
        loadCompleteTime: 0,
        resourceCount: 0,
        slowestResources: [],
        error: error.message,
      });
    }
  }
  
  // Save results
  localStorage.setItem('performanceAuditResults', JSON.stringify(results));
  
  // Generate report
  console.log('\n📊 PERFORMANCE AUDIT REPORT');
  console.log('='.repeat(80));
  
  results.sort((a, b) => b.loadCompleteTime - a.loadCompleteTime);
  
  console.log('\n🐌 Slowest Pages (by Load Complete Time):');
  results.slice(0, 10).forEach((result, index) => {
    console.log(`${index + 1}. ${result.name} (${result.page})`);
    console.log(`   Load Complete: ${result.loadCompleteTime.toFixed(2)}ms`);
    console.log(`   DOM Content Loaded: ${result.domContentLoadedTime.toFixed(2)}ms`);
    console.log(`   Resources: ${result.resourceCount}`);
    if (result.error) {
      console.log(`   ⚠️  Error: ${result.error}`);
    }
  });
  
  const avgLoadTime = results.reduce((sum, r) => sum + r.loadCompleteTime, 0) / results.length;
  const avgDomTime = results.reduce((sum, r) => sum + r.domContentLoadedTime, 0) / results.length;
  
  console.log('\n📈 Summary:');
  console.log(`   Total Pages Audited: ${results.length}`);
  console.log(`   Average Load Complete Time: ${avgLoadTime.toFixed(2)}ms`);
  console.log(`   Average DOM Content Loaded Time: ${avgDomTime.toFixed(2)}ms`);
  console.log(`   Fastest Page: ${results[results.length - 1]?.name} (${results[results.length - 1]?.loadCompleteTime.toFixed(2)}ms)`);
  console.log(`   Slowest Page: ${results[0]?.name} (${results[0]?.loadCompleteTime.toFixed(2)}ms)`);
  
  console.log('\n💾 Results saved to localStorage: performanceAuditResults');
  console.log('   To export: JSON.parse(localStorage.getItem("performanceAuditResults"))');
  
  return results;
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).runPerformanceAudit = runAudit;
  console.log('✅ Performance audit script loaded!');
  console.log('   Run: runPerformanceAudit()');
}

export { runAudit, PAGES_TO_AUDIT };


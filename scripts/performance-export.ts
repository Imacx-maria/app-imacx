/**
 * Performance Data Export Utility
 *
 * Run this in the browser console to export collected performance data
 * After you've navigated through various pages with PerformanceMonitor enabled
 */

interface StoredPerformanceMetric {
  page: string;
  timestamp: number;
  domContentLoadedTime: number;
  loadCompleteTime: number;
  resources: Array<{
    name: string;
    duration: number;
    size: number;
    type: string;
  }>;
}

function exportPerformanceData() {
  const data = localStorage.getItem('performanceAudits');

  if (!data) {
    console.error('❌ No performance data found in localStorage');
    console.log('💡 Navigate through pages to collect data first');
    return null;
  }

  const audits: StoredPerformanceMetric[] = JSON.parse(data);

  if (audits.length === 0) {
    console.error('❌ Performance data is empty');
    return null;
  }

  console.log('📊 PERFORMANCE AUDIT RESULTS');
  console.log('='.repeat(80));
  console.log(`\n📋 Total measurements: ${audits.length}`);

  // Group by page
  const byPage = audits.reduce((acc, metric) => {
    if (!acc[metric.page]) {
      acc[metric.page] = [];
    }
    acc[metric.page].push(metric);
    return acc;
  }, {} as Record<string, StoredPerformanceMetric[]>);

  // Calculate averages per page
  const pageStats = Object.entries(byPage).map(([page, metrics]) => {
    const avgDom = metrics.reduce((sum, m) => sum + m.domContentLoadedTime, 0) / metrics.length;
    const avgLoad = metrics.reduce((sum, m) => sum + m.loadCompleteTime, 0) / metrics.length;
    const avgResources = metrics.reduce((sum, m) => sum + m.resources.length, 0) / metrics.length;

    return {
      page,
      measurements: metrics.length,
      avgDomContentLoaded: avgDom,
      avgLoadComplete: avgLoad,
      avgResourceCount: avgResources,
    };
  }).sort((a, b) => b.avgLoadComplete - a.avgLoadComplete);

  console.log('\n🐌 Pages by Load Time (slowest first):\n');
  pageStats.forEach((stat, index) => {
    console.log(`${index + 1}. ${stat.page}`);
    console.log(`   Measurements: ${stat.measurements}`);
    console.log(`   Avg DOM Content Loaded: ${stat.avgDomContentLoaded.toFixed(2)}ms`);
    console.log(`   Avg Load Complete: ${stat.avgLoadComplete.toFixed(2)}ms`);
    console.log(`   Avg Resources: ${Math.round(stat.avgResourceCount)}`);
    console.log('');
  });

  // Find slowest resources across all pages
  const allResources = audits.flatMap(audit => audit.resources);
  const slowestResources = allResources
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  console.log('\n🐌 Slowest Resources (top 10):\n');
  slowestResources.forEach((resource, index) => {
    const url = new URL(resource.name);
    const shortName = url.pathname.split('/').pop() || url.pathname;
    console.log(`${index + 1}. ${shortName}`);
    console.log(`   Duration: ${resource.duration.toFixed(2)}ms`);
    console.log(`   Type: ${resource.type}`);
    console.log(`   Size: ${(resource.size / 1024).toFixed(2)} KB`);
    console.log(`   Full URL: ${resource.name}`);
    console.log('');
  });

  // Overall stats
  const totalAvgDom = pageStats.reduce((sum, s) => sum + s.avgDomContentLoaded, 0) / pageStats.length;
  const totalAvgLoad = pageStats.reduce((sum, s) => sum + s.avgLoadComplete, 0) / pageStats.length;

  console.log('\n📈 Overall Statistics:');
  console.log(`   Pages Measured: ${Object.keys(byPage).length}`);
  console.log(`   Total Measurements: ${audits.length}`);
  console.log(`   Overall Avg DOM Content Loaded: ${totalAvgDom.toFixed(2)}ms`);
  console.log(`   Overall Avg Load Complete: ${totalAvgLoad.toFixed(2)}ms`);
  console.log(`   Fastest Page: ${pageStats[pageStats.length - 1]?.page} (${pageStats[pageStats.length - 1]?.avgLoadComplete.toFixed(2)}ms)`);
  console.log(`   Slowest Page: ${pageStats[0]?.page} (${pageStats[0]?.avgLoadComplete.toFixed(2)}ms)`);

  console.log('\n💾 Export Options:');
  console.log('   1. Copy to clipboard: copy(JSON.stringify(window.performanceExportData))');
  console.log('   2. Download as JSON: downloadPerformanceData()');
  console.log('   3. Clear data: localStorage.removeItem("performanceAudits")');

  // Store for export
  (window as any).performanceExportData = { byPage: pageStats, rawData: audits };

  return pageStats;
}

function downloadPerformanceData() {
  const data = (window as any).performanceExportData;
  if (!data) {
    console.error('❌ Run exportPerformanceData() first');
    return;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `performance-audit-${new Date().toISOString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('✅ Downloaded performance data');
}

function clearPerformanceData() {
  localStorage.removeItem('performanceAudits');
  (window as any).performanceExportData = null;
  console.log('✅ Cleared performance data');
}

// Make functions available globally
if (typeof window !== 'undefined') {
  (window as any).exportPerformanceData = exportPerformanceData;
  (window as any).downloadPerformanceData = downloadPerformanceData;
  (window as any).clearPerformanceData = clearPerformanceData;
}

export { exportPerformanceData, downloadPerformanceData, clearPerformanceData };

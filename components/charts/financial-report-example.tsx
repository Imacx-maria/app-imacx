'use client';

/**
 * Financial Report Example for Boss Presentation
 *
 * This shows how to use IMACX chart components to create
 * professional reports similar to analise-financeira page
 */

import {
  ImacxBarChart,
  ImacxLineChart,
  ImacxKpiCard,
  ImacxTable,
} from './index';

// Example: KPI Dashboard Section
export const KPIDashboard = ({ kpiData }: { kpiData: any }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <ImacxKpiCard
        label="Vendas MTD"
        value={kpiData?.vendas_mtd?.toLocaleString('pt-PT', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
        }) || '€ 0'}
        change={kpiData?.vendas_mtd_var_pct}
        changeLabel="vs ano anterior"
      />

      <ImacxKpiCard
        label="Vendas YTD"
        value={kpiData?.vendas_ytd?.toLocaleString('pt-PT', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
        }) || '€ 0'}
        change={kpiData?.vendas_ytd_var_pct}
        changeLabel="vs ano anterior"
      />

      <ImacxKpiCard
        label="Margem Média"
        value={`${kpiData?.margem_media?.toFixed(1) || '0'}%`}
        change={kpiData?.margem_var_pct}
        changeLabel="vs ano anterior"
      />

      <ImacxKpiCard
        label="Nº Clientes"
        value={kpiData?.num_clientes || 0}
        change={kpiData?.clientes_var_pct}
        changeLabel="vs ano anterior"
      />
    </div>
  );
};

// Example: Multi-Year Revenue Chart
export const MultiYearRevenueChart = ({ data }: { data: any[] }) => {
  // Transform your data to match chart format
  // Assuming data comes from the multi-year API endpoint
  const chartData = data.map(item => ({
    month: item.month,
    'Vendas 2023': item.vendas_2023 || 0,
    'Vendas 2024': item.vendas_2024 || 0,
    'Vendas 2025': item.vendas_2025 || 0,
  }));

  return (
    <div className="imx-border bg-card p-6">
      <h2 className="mb-4 text-lg">Evolução de Vendas (Últimos 3 Anos)</h2>
      <ImacxBarChart
        data={chartData}
        dataKey={['Vendas 2023', 'Vendas 2024', 'Vendas 2025']}
        xAxisKey="month"
        height={400}
      />
    </div>
  );
};

// Example: Monthly Revenue Trend
export const MonthlyRevenueTrend = ({ data }: { data: any[] }) => {
  const chartData = data.map(item => ({
    month: item.month,
    vendas: item.vendas || 0,
    compras: item.compras || 0,
    margem: item.margem || 0,
  }));

  return (
    <div className="imx-border bg-card p-6">
      <h2 className="mb-4 text-lg">Tendência Mensal de Vendas</h2>
      <ImacxLineChart
        data={chartData}
        lines={[
          { dataKey: 'vendas', name: 'Vendas' },
          { dataKey: 'compras', name: 'Compras' },
          { dataKey: 'margem', name: 'Margem' },
        ]}
        xAxisKey="month"
        height={350}
      />
    </div>
  );
};

// Example: Top Customers Table
export const TopCustomersTable = ({ customers }: { customers: any[] }) => {
  const columns = [
    {
      key: 'ranking',
      header: '#',
      align: 'center' as const,
    },
    {
      key: 'cliente',
      header: 'Cliente',
    },
    {
      key: 'total_vendas',
      header: 'Vendas',
      align: 'right' as const,
      format: (v: number) => v.toLocaleString('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
      }),
    },
    {
      key: 'num_faturas',
      header: 'Faturas',
      align: 'right' as const,
    },
    {
      key: 'ticket_medio',
      header: 'Ticket Médio',
      align: 'right' as const,
      format: (v: number) => v.toLocaleString('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
      }),
    },
    {
      key: 'margem_pct',
      header: 'Margem %',
      align: 'right' as const,
      format: (v: number) => `${v.toFixed(1)}%`,
    },
  ];

  // Add ranking to data
  const tableData = customers.map((c, idx) => ({
    ...c,
    ranking: idx + 1,
  }));

  return (
    <div className="imx-border bg-card p-6">
      <h2 className="mb-4 text-lg">Top 10 Clientes - YTD</h2>
      <ImacxTable columns={columns} data={tableData} />
    </div>
  );
};

// Example: Cost Center Performance Table
export const CostCenterPerformanceTable = ({ data }: { data: any[] }) => {
  const columns = [
    {
      key: 'cost_center',
      header: 'Centro de Custo',
    },
    {
      key: 'vendas_ytd',
      header: 'Vendas YTD',
      align: 'right' as const,
      format: (v: number) => v.toLocaleString('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
      }),
    },
    {
      key: 'crescimento_pct',
      header: 'Crescimento %',
      align: 'right' as const,
      format: (v: number) => {
        const sign = v > 0 ? '+' : '';
        return `${sign}${v.toFixed(1)}%`;
      },
    },
    {
      key: 'margem_pct',
      header: 'Margem %',
      align: 'right' as const,
      format: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      key: 'num_clientes',
      header: 'Clientes',
      align: 'right' as const,
    },
  ];

  return (
    <div className="imx-border bg-card p-6">
      <h2 className="mb-4 text-lg">Performance por Centro de Custo</h2>
      <ImacxTable columns={columns} data={data} />
    </div>
  );
};

// Complete Report Example - Combine Everything
export const FinancialReportForBoss = () => {
  // In your actual implementation, fetch this data from your APIs
  // This is just showing the structure

  const mockKpiData = {
    vendas_mtd: 125000,
    vendas_mtd_var_pct: 12.5,
    vendas_ytd: 850000,
    vendas_ytd_var_pct: 15.3,
    margem_media: 32.4,
    margem_var_pct: -2.1,
    num_clientes: 247,
    clientes_var_pct: 8.3,
  };

  const mockMultiYearData = [
    { month: 'JAN', vendas_2023: 45000, vendas_2024: 52000, vendas_2025: 61000 },
    { month: 'FEV', vendas_2023: 48000, vendas_2024: 55000, vendas_2025: 58000 },
    // ... more months
  ];

  const mockTopCustomers = [
    { cliente: 'EMPRESA A', total_vendas: 125000, num_faturas: 45, ticket_medio: 2778, margem_pct: 35.2 },
    { cliente: 'EMPRESA B', total_vendas: 98000, num_faturas: 32, ticket_medio: 3063, margem_pct: 28.5 },
    // ... more customers
  ];

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl mb-2">Relatório Financeiro - Novembro 2025</h1>
        <p className="text-sm text-muted-foreground">
          Preparado em {new Date().toLocaleDateString('pt-PT')}
        </p>
      </div>

      {/* KPI Dashboard */}
      <KPIDashboard kpiData={mockKpiData} />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MultiYearRevenueChart data={mockMultiYearData} />
        <MonthlyRevenueTrend data={[]} />
      </div>

      {/* Tables Section */}
      <TopCustomersTable customers={mockTopCustomers} />
      <CostCenterPerformanceTable data={[]} />
    </div>
  );
};

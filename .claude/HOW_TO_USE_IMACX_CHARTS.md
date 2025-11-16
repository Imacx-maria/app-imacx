# How to Use IMACX Charts in Your Reports

## 🎯 Quick Start - Creating Reports for Your Boss

### Step 1: Import the Components

At the top of your file (e.g., `app/gestao/analise-financeira/page.tsx`):

```tsx
import {
  ImacxBarChart,
  ImacxLineChart,
  ImacxKpiCard,
  ImacxTable,
} from '@/components/charts';
```

### Step 2: Replace Existing Charts

#### Before (Old Recharts Code):
```tsx
<ResponsiveContainer width="100%" height={400}>
  <BarChart data={multiYearChartData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="month" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Bar dataKey="Vendas_2023" fill="#8884d8" />
    <Bar dataKey="Vendas_2024" fill="#82ca9d" />
    <Bar dataKey="Vendas_2025" fill="#ffc658" />
  </BarChart>
</ResponsiveContainer>
```

#### After (IMACX Components):
```tsx
<ImacxBarChart
  data={multiYearChartData}
  dataKey={['Vendas_2023', 'Vendas_2024', 'Vendas_2025']}
  xAxisKey="month"
  height={400}
/>
```

**Benefits:**
- ✅ 80% less code
- ✅ Automatic design system styling
- ✅ Automatic dark mode support
- ✅ UPPERCASE text, proper borders, no rounded corners

---

## 📊 Real Examples from Your Page

### 1. KPI Cards (Top Metrics)

Replace your current MetricCard with ImacxKpiCard:

```tsx
{/* OLD CODE */}
<MetricCard
  title="Vendas MTD"
  value={formatCurrency(kpiData?.vendas_mtd || 0)}
  change={kpiData?.vendas_mtd_var_pct}
  changeLabel="vs ano anterior"
/>

{/* NEW CODE */}
<ImacxKpiCard
  label="Vendas MTD"
  value={formatCurrency(kpiData?.vendas_mtd || 0)}
  change={kpiData?.vendas_mtd_var_pct}
  changeLabel="vs ano anterior"
/>
```

### 2. Multi-Year Revenue Chart (Lines 1631-1690)

Replace the entire ResponsiveContainer block:

```tsx
{/* NEW CODE - Much cleaner! */}
<div className="imx-border bg-card p-6">
  <h2 className="mb-4 text-lg">Evolução de Vendas (Últimos 3 Anos)</h2>
  <ImacxBarChart
    data={multiYearChartData}
    dataKey={['Vendas_2023', 'Vendas_2024', 'Vendas_2025']}
    xAxisKey="month"
    height={400}
  />
</div>
```

### 3. Cancellation Rate Chart (Lines 1770-1820)

```tsx
{/* OLD: Complex Recharts setup */}
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={cancellationChartData}>
    {/* 15+ lines of configuration... */}
  </LineChart>
</ResponsiveContainer>

{/* NEW: One simple component */}
<div className="imx-border bg-card p-6">
  <h2 className="mb-4 text-lg">Taxa de Cancelamento</h2>
  <ImacxLineChart
    data={cancellationChartData}
    lines={[{ dataKey: 'Taxa Cancelamento', name: 'Taxa %' }]}
    xAxisKey="month"
    height={300}
  />
</div>
```

### 4. Top Customers Table (Lines 1839-1943)

Replace your complex table with sorting:

```tsx
{/* Define columns once */}
const topCustomersColumns = [
  { key: 'ranking', header: '#', align: 'center' },
  { key: 'cliente', header: 'Cliente' },
  { 
    key: 'total_vendas', 
    header: 'Vendas YTD',
    align: 'right',
    format: (v: number) => formatCurrency(v)
  },
  { key: 'num_faturas', header: 'Faturas', align: 'right' },
  { 
    key: 'ticket_medio', 
    header: 'Ticket Médio',
    align: 'right',
    format: (v: number) => formatCurrency(v)
  },
];

{/* Use the table */}
<div className="imx-border bg-card p-6">
  <h2 className="mb-4 text-lg">Top 10 Clientes</h2>
  <ImacxTable 
    columns={topCustomersColumns} 
    data={sortedTopCustomers.slice(0, 10)} 
  />
</div>
```

---

## 📝 Creating a Complete Report Page

Here's a complete example for a new report page:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ImacxBarChart, ImacxKpiCard, ImacxTable } from '@/components/charts';
import { createClient } from '@/utils/supabase';

export default function ReportPage() {
  const supabase = createClient();
  const [kpiData, setKpiData] = useState<any>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    // Fetch KPI data
    const kpiRes = await fetch('/api/financial-analysis/kpi-dashboard');
    const kpi = await kpiRes.json();
    setKpiData(kpi);
    
    // Fetch sales data
    const salesRes = await fetch('/api/financial-analysis/monthly-revenue');
    const sales = await salesRes.json();
    setSalesData(sales);
  };
  
  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl">Relatório Executivo</h1>
        <p className="text-sm text-muted-foreground">
          Novembro 2025 - Preparado em {new Date().toLocaleDateString('pt-PT')}
        </p>
      </div>
      
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ImacxKpiCard
          label="Vendas YTD"
          value={`€ ${(kpiData?.vendas_ytd || 0).toLocaleString('pt-PT')}`}
          change={kpiData?.vendas_ytd_var_pct}
          changeLabel="vs 2024"
        />
        <ImacxKpiCard
          label="Margem"
          value={`${(kpiData?.margem_media || 0).toFixed(1)}%`}
          change={kpiData?.margem_var_pct}
        />
        <ImacxKpiCard
          label="Clientes"
          value={kpiData?.num_clientes || 0}
          change={kpiData?.clientes_var_pct}
        />
        <ImacxKpiCard
          label="Faturas"
          value={kpiData?.num_faturas || 0}
          change={kpiData?.faturas_var_pct}
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="imx-border bg-card p-6">
          <h2 className="mb-4 text-lg">Vendas Mensais 2025</h2>
          <ImacxBarChart
            data={salesData}
            dataKey="vendas"
            xAxisKey="month"
            height={350}
          />
        </div>
        
        <div className="imx-border bg-card p-6">
          <h2 className="mb-4 text-lg">Evolução de Margem</h2>
          <ImacxLineChart
            data={salesData}
            lines={[
              { dataKey: 'margem_pct', name: 'Margem %' }
            ]}
            xAxisKey="month"
            height={350}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## 🎨 Styling Tips

### 1. Always Use Card Wrapper
```tsx
<div className="imx-border bg-card p-6">
  <h2 className="mb-4 text-lg">Chart Title</h2>
  <ImacxBarChart ... />
</div>
```

### 2. Grid Layouts for Multiple Charts
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div className="imx-border bg-card p-6">...</div>
  <div className="imx-border bg-card p-6">...</div>
</div>
```

### 3. Use Design System Colors
The charts automatically use `--chart-1` through `--chart-12` from your design system!

---

## 📄 Exporting to PDF

To make your boss happy, add a "Download PDF" button:

```tsx
import { Button } from '@/components/ui/button';

const exportToPDF = () => {
  // Use browser print dialog
  window.print();
};

<Button onClick={exportToPDF} variant="outline">
  Download PDF
</Button>
```

Add this CSS for print:
```css
@media print {
  .no-print { display: none; }
  .imx-border { break-inside: avoid; }
}
```

---

## 🚀 Quick Migration Checklist

To convert your existing analise-financeira page:

1. **Import IMACX components** at the top
2. **Replace MetricCard** with `ImacxKpiCard` (lines 112-200)
3. **Replace ResponsiveContainer + BarChart** with `ImacxBarChart` (lines 1631-1690)
4. **Replace ResponsiveContainer + LineChart** with `ImacxLineChart` (lines 1770-1820)
5. **Replace table JSX** with `ImacxTable` (lines 1839+)
6. **Remove unused Recharts imports**
7. **Test in light + dark mode**
8. **Run build** to verify

---

## 💡 Pro Tips

1. **Reuse your existing data fetching** - The components work with your current API structure
2. **Keep your formatCurrency helpers** - Use them in table `format` functions
3. **Sorting still works** - Pass sorted data to `ImacxTable`
4. **Responsive by default** - Charts scale automatically
5. **Dark mode just works** - No extra configuration needed

---

## 📚 See Full Examples

- **Complete report**: `components/charts/financial-report-example.tsx`
- **Dashboard example**: `components/charts/dashboard-example.tsx`
- **All components**: `components/charts/index.ts`

---

**Need help?** Check the skill documentation in `.claude/skills/imacx-charts-tables.md`

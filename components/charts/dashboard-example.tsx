"use client";

/**
 * IMACX Dashboard Example
 *
 * Demonstrates all IMACX chart and table components
 * Use this as a reference for implementing charts in your pages
 */

import { memo } from "react";
import {
  ImacxBarChart,
  ImacxLineChart,
  ImacxPieChart,
  ImacxTable,
  ImacxKpiCard,
} from "./index";

const DashboardExampleInternal = () => {
  // Sample data
  const salesData = [
    { month: "JAN", vendas: 45000, custos: 32000 },
    { month: "FEV", vendas: 52000, custos: 35000 },
    { month: "MAR", vendas: 48000, custos: 33000 },
    { month: "ABR", vendas: 61000, custos: 38000 },
    { month: "MAI", vendas: 58000, custos: 36000 },
    { month: "JUN", vendas: 67000, custos: 42000 },
  ];

  const departmentData = [
    { name: "ID-Impressão Digital", value: 125000 },
    { name: "BR-Brindes", value: 89000 },
    { name: "IO-Impressão OFFSET", value: 156000 },
  ];

  const tableData = [
    {
      codigo: "PRD001",
      descricao: "IMPRESSÃO A3",
      quantidade: 150,
      valor: 2250,
    },
    { codigo: "PRD002", descricao: "CORTE VINIL", quantidade: 75, valor: 1125 },
    {
      codigo: "PRD003",
      descricao: "IMPRESSÃO FLEXÍVEL",
      quantidade: 200,
      valor: 4000,
    },
  ];

  const tableColumns = [
    { key: "codigo", header: "Código" },
    { key: "descricao", header: "Descrição" },
    { key: "quantidade", header: "Quantidade", align: "right" as const },
    {
      key: "valor",
      header: "Valor",
      align: "right" as const,
      format: (v: number) => `${v.toLocaleString("pt-PT")} €`,
    },
  ];

  return (
    <div className="space-y-8 p-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ImacxKpiCard
          label="Vendas YTD"
          value="€ 370.000"
          change={12.5}
          changeLabel="vs 2024"
        />
        <ImacxKpiCard
          label="Margem Média"
          value="32.4%"
          change={-2.1}
          changeLabel="vs 2024"
        />
        <ImacxKpiCard label="Clientes Ativos" value={247} change={8.3} />
        <ImacxKpiCard label="Encomendas" value={1852} change={15.7} />
      </div>

      {/* Bar Chart */}
      <div className="imx-border bg-card p-6">
        <h2 className="mb-4 text-lg uppercase">Vendas vs Custos</h2>
        <ImacxBarChart
          data={salesData}
          dataKey={["vendas", "custos"]}
          xAxisKey="month"
        />
      </div>

      {/* Line Chart */}
      <div className="imx-border bg-card p-6">
        <h2 className="mb-4 text-lg uppercase">Tendência de Vendas</h2>
        <ImacxLineChart
          data={salesData}
          lines={[
            { dataKey: "vendas", name: "Vendas" },
            { dataKey: "custos", name: "Custos" },
          ]}
          xAxisKey="month"
        />
      </div>

      {/* Pie Chart */}
      <div className="imx-border bg-card p-6">
        <h2 className="mb-4 text-lg uppercase">Vendas por Departamento</h2>
        <ImacxPieChart
          data={departmentData}
          innerRadius={50} // Donut chart
        />
      </div>

      {/* Data Table */}
      <div className="imx-border bg-card p-6">
        <h2 className="mb-4 text-lg uppercase">Produtos Mais Vendidos</h2>
        <ImacxTable columns={tableColumns} data={tableData} />
      </div>
    </div>
  );
};

export const DashboardExample = memo(DashboardExampleInternal);

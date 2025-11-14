"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Euro,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type {
  KPIDashboardData,
  MonthlyRevenueResponse,
  TopCustomersResponse,
  MultiYearRevenueResponse,
  CostCenterPerformanceResponse,
} from "@/types/financial-analysis";

// ============================================================================
// Helper Components
// ============================================================================

interface MetricCardProps {
  title: string;
  value: number;
  previousValue: number;
  change: number;
  formatter?: (value: number) => string;
  subtitle?: string;
}

const MetricCard = ({
  title,
  value,
  previousValue,
  change,
  formatter = (v) => v.toLocaleString(),
  subtitle = "vs. período anterior",
}: MetricCardProps) => {
  const isPositive = change >= 0;
  const changeAbs = Math.abs(change);

  return (
    <Card className="p-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-normal">{formatter(value)}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-foreground" />
            ) : (
              <TrendingDown className="h-4 w-4 text-foreground" />
            )}
            <span className="text-sm">
              {isPositive ? "+" : "-"}
              {changeAbs.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Ano anterior</p>
            <p className="text-sm font-normal">{formatter(previousValue)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export default function AnaliseFinanceiraPage() {
  const supabase = createBrowserClient();

  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpiData, setKpiData] = useState<KPIDashboardData | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] =
    useState<MonthlyRevenueResponse | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomersResponse | null>(
    null,
  );
  const [multiYearRevenue, setMultiYearRevenue] =
    useState<MultiYearRevenueResponse | null>(null);
  const [costCenterPerformance, setCostCenterPerformance] =
    useState<CostCenterPerformanceResponse | null>(null);
  const [salespersonPerformance, setSalespersonPerformance] = useState<
    any | null
  >(null);
  const [costCenterSales, setCostCenterSales] = useState<any | null>(null);

  // Main tab navigation
  const [mainTab, setMainTab] = useState<
    "visao-geral" | "centro-custo" | "vendedores" | "operacoes"
  >("visao-geral");

  // Period tab navigation (within each main tab)
  const [activeTab, setActiveTab] = useState<"mtd" | "ytd" | "qtd">("mtd");

  type TopCustomersSortColumn =
    | "rank"
    | "customerName"
    | "salesperson"
    | "invoiceCount"
    | "netRevenue"
    | "revenueSharePct"
    | "lastInvoice";

  const [topSortColumn, setTopSortColumn] =
    useState<TopCustomersSortColumn>("netRevenue");
  const [topSortDirection, setTopSortDirection] = useState<"asc" | "desc">(
    "desc",
  );

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchAllData = useCallback(
    async (
      tab: "mtd" | "ytd" | "qtd" = activeTab,
      section:
        | "visao-geral"
        | "centro-custo"
        | "vendedores"
        | "operacoes" = mainTab,
    ) => {
      setLoading(true);
      setError(null);

      try {
        // Always fetch KPI data (used across multiple tabs)
        const kpiResponse = await fetch(
          "/api/financial-analysis/kpi-dashboard",
        );
        if (!kpiResponse.ok) {
          throw new Error("Failed to fetch KPI data");
        }
        const kpiJson = await kpiResponse.json();
        setKpiData(kpiJson);

        // Conditional data fetching based on active section
        if (section === "visao-geral") {
          // VISÃO GERAL section data
          // 2) MONTHLY REVENUE - existing behavior (YTD series)
          const revenueResponse = await fetch(
            "/api/financial-analysis/monthly-revenue",
          );
          if (!revenueResponse.ok) {
            throw new Error("Failed to fetch monthly revenue data");
          }
          const revenueJson = await revenueResponse.json();
          setMonthlyRevenue(revenueJson);

          // 3) TOP CUSTOMERS
          const topPeriod = tab === "mtd" ? "mtd" : "ytd";
          const customersResponse = await fetch(
            `/api/financial-analysis/top-customers?limit=20&period=${topPeriod}`,
          );
          if (!customersResponse.ok) {
            throw new Error("Failed to fetch top customers data");
          }
          const customersJson = await customersResponse.json();
          setTopCustomers(customersJson);

          // 4) MULTI-YEAR REVENUE for VENDAS 3-year YTD chart
          const multiYearResponse = await fetch(
            "/api/financial-analysis/multi-year-revenue",
          );
          if (!multiYearResponse.ok) {
            throw new Error("Failed to fetch multi-year revenue data");
          }
          const multiYearJson = await multiYearResponse.json();
          setMultiYearRevenue(multiYearJson);
        } else if (section === "centro-custo") {
          // CENTRO CUSTO section data
          // 5) COST CENTER PERFORMANCE (3-year comparison - MTD or YTD based on tab)
          const costCenterPeriod = tab === "mtd" ? "mtd" : "ytd";
          const costCenterResponse = await fetch(
            `/api/financial-analysis/cost-center-performance?period=${costCenterPeriod}`,
          );
          if (!costCenterResponse.ok) {
            console.warn("Failed to fetch cost center performance data");
          } else {
            const costCenterJson = await costCenterResponse.json();
            setCostCenterPerformance(costCenterJson);
          }

          // 7) COST CENTER SALES TABLE (MTD or YTD based on tab)
          const costCenterSalesResponse = await fetch(
            `/api/financial-analysis/cost-center-sales?period=${tab}`,
          );
          if (!costCenterSalesResponse.ok) {
            console.warn("Failed to fetch cost center sales data");
          } else {
            const costCenterSalesJson = await costCenterSalesResponse.json();
            setCostCenterSales(costCenterSalesJson);
          }
        } else if (section === "vendedores") {
          // VENDEDORES section data
          // 6) SALESPERSON PERFORMANCE
          const salespersonResponse = await fetch(
            "/api/financial-analysis/salesperson-performance",
          );
          if (!salespersonResponse.ok) {
            console.warn("Failed to fetch salesperson performance data");
          } else {
            const salespersonJson = await salespersonResponse.json();
            setSalespersonPerformance(salespersonJson);
          }
        }
        // OPERACOES section has no data fetching yet (placeholder)
      } catch (err) {
        console.error("Error fetching financial analysis data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, mainTab],
  );

  useEffect(() => {
    fetchAllData(activeTab, mainTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // Formatters
  // ============================================================================

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-PT").format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // ============================================================================
  // Render Loading State
  // ============================================================================

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-foreground">ANÁLISE FINANCEIRA</h1>
            <p className="text-muted-foreground mt-2">
              Dashboard executivo de análise financeira
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">A carregar dados...</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render Error State
  // ============================================================================

  if (error) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-foreground">ANÁLISE FINANCEIRA</h1>
            <p className="text-muted-foreground mt-2">
              Dashboard executivo de análise financeira
            </p>
          </div>
        </div>
        <Card className="p-6">
          <div className="text-center">
            <p className="text-foreground mb-4">
              Erro ao carregar dados: {error}
            </p>
            <Button
              variant="default"
              onClick={() => fetchAllData(activeTab, mainTab)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // Get Active Period Data
  // ============================================================================

  const activePeriodData = kpiData ? kpiData[activeTab] : null;

  // ============================================================================
  // Prepare Chart Data
  // ============================================================================

  // Prepare VENDAS 3-year YTD chart data from multiYearRevenue
  // Align by month index (JAN..YTD) and, for each year, use that year's YYYY-MM.
  const multiYearChartData =
    multiYearRevenue && multiYearRevenue.years.length === 3
      ? (() => {
          const [y0, y1, y2] = multiYearRevenue.years;

          const findRevenue = (year: number, monthIndex: number): number => {
            const series = multiYearRevenue.series.find((s) => s.year === year);
            if (!series) return 0;

            const ym = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
            const point = series.points.find((p) => p.month === ym);
            return point ? Math.round(point.revenue) : 0;
          };

          const now = new Date();
          const currentMonthIndex = now.getMonth(); // 0-based
          const rows: Record<string, string | number>[] = [];

          for (let m = 0; m <= currentMonthIndex; m++) {
            rows.push({
              month: new Date(y0, m, 1).toLocaleDateString("pt-PT", {
                month: "short",
              }),
              [`Vendas_${y0}`]: findRevenue(y0, m),
              [`Vendas_${y1}`]: findRevenue(y1, m),
              [`Vendas_${y2}`]: findRevenue(y2, m),
            });
          }

          return rows;
        })()
      : [];

  const cancellationChartData =
    monthlyRevenue?.monthlyData
      .slice()
      .reverse()
      .map((item) => ({
        month: item.period,
        "Taxa Cancelamento": item.cancellationRate,
      })) || [];

  // ============================================================================
  // Top Customers Sorting
  // ============================================================================

  const sortedTopCustomers =
    topCustomers?.customers.slice().sort((a, b) => {
      const dir = topSortDirection === "asc" ? 1 : -1;

      const getValue = (c: (typeof topCustomers.customers)[number]) => {
        switch (topSortColumn) {
          case "customerName":
            return c.customerName || "";
          case "salesperson":
            return c.salesperson || "";
          case "invoiceCount":
            return c.invoiceCount;
          case "netRevenue":
            return c.netRevenue;
          case "revenueSharePct":
            return c.revenueSharePct;
          case "lastInvoice":
            return c.lastInvoice || "";
          case "rank":
          default:
            return c.rank;
        }
      };

      const av = getValue(a);
      const bv = getValue(b);

      if (typeof av === "number" && typeof bv === "number") {
        if (av === bv) return 0;
        return av > bv ? dir : -dir;
      }

      const as = String(av);
      const bs = String(bv);
      if (as === bs) return 0;
      return as > bs ? dir : -dir;
    }) || [];

  const handleTopSort = (column: TopCustomersSortColumn) => {
    setTopSortDirection((prevDir) =>
      topSortColumn === column ? (prevDir === "asc" ? "desc" : "asc") : "desc",
    );
    setTopSortColumn(column);
  };

  const renderSortIcon = (column: TopCustomersSortColumn) => {
    if (topSortColumn !== column) return null;
    return topSortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-foreground">ANÁLISE FINANCEIRA</h1>
          <p className="text-muted-foreground mt-2">
            Dashboard executivo de análise financeira e KPIs
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchAllData(activeTab, mainTab)}
          className="h-10"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2">
        <Button
          variant={mainTab === "visao-geral" ? "default" : "outline"}
          onClick={() => {
            setMainTab("visao-geral");
            fetchAllData(activeTab, "visao-geral");
          }}
          className="h-10"
        >
          VISÃO GERAL
        </Button>
        <Button
          variant={mainTab === "centro-custo" ? "default" : "outline"}
          onClick={() => {
            setMainTab("centro-custo");
            fetchAllData(activeTab, "centro-custo");
          }}
          className="h-10"
        >
          CENTRO CUSTO
        </Button>
        <Button
          variant={mainTab === "vendedores" ? "default" : "outline"}
          onClick={() => {
            setMainTab("vendedores");
            fetchAllData(activeTab, "vendedores");
          }}
          className="h-10"
        >
          VENDEDORES
        </Button>
        <Button
          variant={mainTab === "operacoes" ? "default" : "outline"}
          onClick={() => {
            setMainTab("operacoes");
            fetchAllData(activeTab, "operacoes");
          }}
          className="h-10"
        >
          OPERAÇÕES
        </Button>
      </div>

      {/* Period Tabs (shown for tabs that have MTD/YTD views) */}
      {mainTab !== "operacoes" && (
        <div className="flex gap-2">
          <Button
            variant={activeTab === "mtd" ? "default" : "outline"}
            onClick={() => {
              setActiveTab("mtd");
              fetchAllData("mtd", mainTab);
            }}
            className="h-10"
          >
            Mês Atual
          </Button>
          <Button
            variant={activeTab === "ytd" ? "default" : "outline"}
            onClick={() => {
              setActiveTab("ytd");
              fetchAllData("ytd", mainTab);
            }}
            className="h-10"
          >
            Ano Atual
          </Button>
        </div>
      )}

      {/* ========================================== */}
      {/* VISÃO GERAL TAB CONTENT */}
      {/* ========================================== */}
      {mainTab === "visao-geral" && (
        <>
          {/* KPI Cards */}
          {activePeriodData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <MetricCard
                title="Receita Total"
                value={activePeriodData.revenue.current}
                previousValue={activePeriodData.revenue.previous}
                change={activePeriodData.revenue.change}
                formatter={formatCurrency}
              />
              <MetricCard
                title="Nº Faturas"
                value={activePeriodData.invoices.current}
                previousValue={activePeriodData.invoices.previous}
                change={activePeriodData.invoices.change}
                formatter={formatNumber}
              />
              <MetricCard
                title="Nº Clientes"
                value={activePeriodData.customers.current}
                previousValue={activePeriodData.customers.previous}
                change={activePeriodData.customers.change}
                formatter={formatNumber}
              />
              <MetricCard
                title="Ticket Médio"
                value={activePeriodData.avgInvoiceValue.current}
                previousValue={activePeriodData.avgInvoiceValue.previous}
                change={activePeriodData.avgInvoiceValue.change}
                formatter={formatCurrency}
              />
              <MetricCard
                title="Orçamentos Valor"
                value={activePeriodData.quoteValue.current}
                previousValue={activePeriodData.quoteValue.previous}
                change={activePeriodData.quoteValue.change}
                formatter={formatCurrency}
              />
              <MetricCard
                title="Orçamentos Qtd"
                value={activePeriodData.quoteCount.current}
                previousValue={activePeriodData.quoteCount.previous}
                change={activePeriodData.quoteCount.change}
                formatter={formatNumber}
              />
              <MetricCard
                title="Taxa Conversão"
                value={activePeriodData.conversionRate.current}
                previousValue={activePeriodData.conversionRate.previous}
                change={activePeriodData.conversionRate.change}
                formatter={formatPercent}
              />
              <MetricCard
                title="Orçamento Médio"
                value={activePeriodData.avgQuoteValue.current}
                previousValue={activePeriodData.avgQuoteValue.previous}
                change={activePeriodData.avgQuoteValue.change}
                formatter={formatCurrency}
              />
            </div>
          )}

          {/* VENDAS 3-year YTD Comparison Chart */}
          {multiYearRevenue && multiYearChartData.length > 0 && (
            <Card className="p-6">
              <div className="space-y-4">
                <h2 className="text-xl text-foreground">
                  Vendas {multiYearRevenue.years[0]} vs{" "}
                  {multiYearRevenue.years[1]} vs {multiYearRevenue.years[2]}{" "}
                  (YTD)
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  {/* Add left margin so first point and Y-axis are fully visible */}
                  <LineChart
                    data={multiYearChartData}
                    margin={{ top: 10, right: 30, bottom: 20, left: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend />
                    {multiYearRevenue.years.map((year, index) => {
                      const key = `Vendas_${year}`;
                      // Respect design system: use CSS variables only.
                      // Original request: swap colors so 2024 is yellow and 2025 is black.
                      const isMostRecent = index === 0; // current year
                      const stroke = isMostRecent
                        ? "var(--foreground)" // 2025 -> black
                        : index === 1
                          ? "var(--primary)" // 2024 -> yellow
                          : "var(--orange)"; // 2023 -> orange
                      return (
                        <Line
                          key={year}
                          type="monotone"
                          dataKey={key}
                          stroke={stroke}
                          strokeWidth={2}
                          dot={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Cancellation Rate Chart removed to prioritize VENDAS multi-year chart */}

          {/* Top Customers Table */}
          {topCustomers && (
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl text-foreground">
                    Top 20 Clientes YTD
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Total:{" "}
                      {formatCurrency(topCustomers.summary.topCustomersRevenue)}
                    </span>
                    <span>
                      {formatPercent(topCustomers.summary.topCustomersSharePct)}{" "}
                      do total
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="w-12 cursor-pointer select-none"
                          onClick={() => handleTopSort("rank")}
                        >
                          #{renderSortIcon("rank")}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleTopSort("customerName")}
                        >
                          Cliente
                          {renderSortIcon("customerName")}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleTopSort("salesperson")}
                        >
                          Vendedor
                          {renderSortIcon("salesperson")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleTopSort("invoiceCount")}
                        >
                          Nº Faturas
                          {renderSortIcon("invoiceCount")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleTopSort("netRevenue")}
                        >
                          Receita
                          {renderSortIcon("netRevenue")}
                        </TableHead>
                        {/* Ano Anterior (YTD only) */}
                        {activeTab === "ytd" && (
                          <TableHead className="text-right">
                            Ano Anterior
                          </TableHead>
                        )}
                        {/* Var % vs Ano Anterior (YTD only) */}
                        {activeTab === "ytd" && (
                          <TableHead className="text-right">Var %</TableHead>
                        )}
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleTopSort("revenueSharePct")}
                        >
                          % Total
                          {renderSortIcon("revenueSharePct")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleTopSort("lastInvoice")}
                        >
                          {activeTab === "mtd"
                            ? "Última Fatura (Mês)"
                            : "Última Fatura"}
                          {renderSortIcon("lastInvoice")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTopCustomers.map((customer) => {
                        const isYtd = activeTab === "ytd";
                        const prevValue =
                          isYtd && customer.previousNetRevenue != null
                            ? customer.previousNetRevenue
                            : null;
                        const deltaPct =
                          isYtd && customer.previousDeltaPct != null
                            ? customer.previousDeltaPct
                            : null;

                        // Color code: green if current > previous, red if current < previous
                        const deltaClass =
                          deltaPct == null
                            ? ""
                            : deltaPct > 0
                              ? "text-success"
                              : deltaPct < 0
                                ? "text-destructive"
                                : "";

                        return (
                          <TableRow key={customer.customerId}>
                            <TableCell>{customer.rank}</TableCell>
                            <TableCell className="font-normal">
                              {customer.customerName}
                            </TableCell>
                            <TableCell>{customer.salesperson}</TableCell>
                            <TableCell className="text-right">
                              {formatNumber(customer.invoiceCount)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(customer.netRevenue)}
                            </TableCell>
                            {isYtd && (
                              <TableCell className="text-right">
                                {prevValue != null
                                  ? formatCurrency(prevValue)
                                  : "-"}
                              </TableCell>
                            )}
                            {isYtd && (
                              <TableCell className={`text-right ${deltaClass}`}>
                                {deltaPct != null
                                  ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(
                                      1,
                                    )}%`
                                  : "-"}
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              {formatPercent(customer.revenueSharePct)}
                            </TableCell>
                            <TableCell className="text-right">
                              {customer.lastInvoice}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ========================================== */}
      {/* CENTRO CUSTO TAB CONTENT */}
      {/* ========================================== */}
      {mainTab === "centro-custo" && (
        <>
          {/* Cost Center Performance Chart - 3 Year Comparison */}
          {costCenterPerformance && costCenterPerformance.costCenters && (
            <Card className="p-6">
              <div className="space-y-4">
                <h2 className="text-xl text-foreground">
                  VENDAS POR CENTRO DE CUSTO (
                  {costCenterPerformance.metadata.period.toUpperCase()}) -
                  Comparação 3 Anos
                </h2>
                <p className="text-sm text-muted-foreground">
                  {costCenterPerformance.metadata.period === "mtd"
                    ? `Comparação do mês de ${costCenterPerformance.metadata.periodLabel} (até dia ${costCenterPerformance.metadata.currentDay}) entre ${costCenterPerformance.years[0]}, ${costCenterPerformance.years[1]} e ${costCenterPerformance.years[2]}`
                    : `Comparação YTD (até ${costCenterPerformance.metadata.ytdEndDate}) entre ${costCenterPerformance.years[0]}, ${costCenterPerformance.years[1]} e ${costCenterPerformance.years[2]}`}
                </p>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={costCenterPerformance.costCenters}
                    margin={{ top: 10, right: 30, bottom: 60, left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="costCenter"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value))}
                    />
                    <Legend />
                    <Bar
                      dataKey="currentYear"
                      fill="var(--foreground)"
                      name={`${costCenterPerformance.years[0]}`}
                    />
                    <Bar
                      dataKey="previousYear"
                      fill="var(--primary)"
                      name={`${costCenterPerformance.years[1]}`}
                    />
                    <Bar
                      dataKey="twoYearsAgo"
                      fill="var(--orange)"
                      name={`${costCenterPerformance.years[2]}`}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">
                      Total {costCenterPerformance.years[0]}
                    </p>
                    <p className="text-lg font-normal">
                      {formatCurrency(
                        costCenterPerformance.costCenters.reduce(
                          (sum, cc) => sum + cc.currentYear,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Total {costCenterPerformance.years[1]}
                    </p>
                    <p className="text-lg font-normal">
                      {formatCurrency(
                        costCenterPerformance.costCenters.reduce(
                          (sum, cc) => sum + cc.previousYear,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Total {costCenterPerformance.years[2]}
                    </p>
                    <p className="text-lg font-normal">
                      {formatCurrency(
                        costCenterPerformance.costCenters.reduce(
                          (sum, cc) => sum + cc.twoYearsAgo,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                </div>
                {/* Individual Cost Center Details */}
                <div className="imx-border-t pt-4">
                  <h3 className="text-sm font-normal mb-3">
                    Detalhes por Centro de Custo
                  </h3>
                  <div className="space-y-3">
                    {costCenterPerformance.costCenters.map((cc) => (
                      <div
                        key={cc.costCenter}
                        className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm"
                      >
                        <div className="font-normal">{cc.costCenter}</div>
                        <div>
                          <span className="text-muted-foreground">
                            {costCenterPerformance.years[0]}:{" "}
                          </span>
                          {formatCurrency(cc.currentYear)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            {costCenterPerformance.years[1]}:{" "}
                          </span>
                          {formatCurrency(cc.previousYear)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            {costCenterPerformance.years[2]}:{" "}
                          </span>
                          {formatCurrency(cc.twoYearsAgo)}
                        </div>
                        <div
                          className={
                            cc.yoyChangePct !== null && cc.yoyChangePct > 0
                              ? "text-success"
                              : cc.yoyChangePct !== null && cc.yoyChangePct < 0
                                ? "text-destructive"
                                : ""
                          }
                        >
                          <span className="text-muted-foreground">
                            Var YoY:{" "}
                          </span>
                          {cc.yoyChangePct !== null
                            ? `${cc.yoyChangePct > 0 ? "+" : ""}${cc.yoyChangePct.toFixed(1)}%`
                            : "N/A"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Cost Center Sales Table - Dynamic based on tab */}
          {costCenterSales && costCenterSales.costCenters && (
            <Card className="p-6">
              <div className="space-y-4">
                <h2 className="text-xl text-foreground">
                  {activeTab === "mtd"
                    ? "VENDAS POR CENTRO DE CUSTO - MÊS ATUAL"
                    : "VENDAS POR CENTRO DE CUSTO - ANO ATUAL"}
                </h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Centro de Custo</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                        <TableHead className="text-right">Var %</TableHead>
                        <TableHead className="text-right">Nº Faturas</TableHead>
                        <TableHead className="text-right">
                          Nº Clientes
                        </TableHead>
                        <TableHead className="text-right">
                          Ticket Médio
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costCenterSales.costCenters.map((cc: any) => {
                        const changeClass =
                          cc.var_pct === null || cc.var_pct === 0
                            ? ""
                            : cc.var_pct > 0
                              ? "text-success"
                              : "text-destructive";

                        return (
                          <TableRow key={cc.centro_custo}>
                            <TableCell className="font-normal">
                              {cc.centro_custo}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(cc.vendas)}
                            </TableCell>
                            <TableCell className={`text-right ${changeClass}`}>
                              {cc.var_pct !== null && cc.var_pct !== 0
                                ? `${cc.var_pct > 0 ? "+" : ""}${cc.var_pct.toFixed(1)}%`
                                : activeTab === "mtd"
                                  ? "-"
                                  : "0.0%"}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(cc.num_faturas)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(cc.num_clientes)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(cc.ticket_medio)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm imx-border-t pt-4">
                  <div>
                    <p className="text-muted-foreground">
                      Total Vendas {activeTab === "mtd" ? "Mês Atual" : "YTD"}
                    </p>
                    <p className="text-lg font-normal">
                      {formatCurrency(
                        costCenterSales.costCenters.reduce(
                          (sum: number, cc: any) => sum + cc.vendas,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Faturas</p>
                    <p className="text-lg font-normal">
                      {formatNumber(
                        costCenterSales.costCenters.reduce(
                          (sum: number, cc: any) => sum + cc.num_faturas,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Centros de Custo</p>
                    <p className="text-lg font-normal">
                      {costCenterSales.costCenters.length}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ========================================== */}
      {/* VENDEDORES TAB CONTENT */}
      {/* ========================================== */}
      {mainTab === "vendedores" && (
        <>
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl text-foreground">
                ANÁLISE DE VENDEDORES -{" "}
                {activeTab === "mtd" ? "MÊS ATUAL" : "ANO ATUAL"}
              </h2>
              <p className="text-muted-foreground">
                Conteúdo em desenvolvimento. Esta secção apresentará análise
                detalhada de performance por vendedor.
              </p>
            </div>
          </Card>
        </>
      )}

      {/* ========================================== */}
      {/* OPERAÇÕES TAB CONTENT */}
      {/* ========================================== */}
      {mainTab === "operacoes" && (
        <>
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl text-foreground">MÉTRICAS OPERACIONAIS</h2>
              <p className="text-muted-foreground">
                Conteúdo em desenvolvimento. Esta secção apresentará métricas e
                análises operacionais.
              </p>
            </div>
          </Card>
        </>
      )}

      {/* Data Quality Info */}
      {kpiData && (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>
              Dados gerados em:{" "}
              {new Date(kpiData.generatedAt).toLocaleString("pt-PT")}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

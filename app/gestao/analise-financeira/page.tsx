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
  CostCenterTopCustomersResponse,
} from "@/types/financial-analysis";

// ============================================================================
// Constants
// ============================================================================

const COST_CENTERS = [
  "ID-Impressão Digital",
  "BR-Brindes",
  "IO-Impressão OFFSET",
] as const;

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
  const [costCenterSales, setCostCenterSales] = useState<any | null>(null);
  const [costCenterTopCustomers, setCostCenterTopCustomers] =
    useState<CostCenterTopCustomersResponse | null>(null);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string | null>(
    null,
  );

  // Main tab navigation
  const [mainTab, setMainTab] = useState<
    "visao-geral" | "centro-custo" | "departamentos" | "operacoes"
  >("visao-geral");

  // Departamentos tab states
  const [departmentView, setDepartmentView] = useState<"analise" | "reunioes">(
    "analise",
  );
  const [selectedDepartment, setSelectedDepartment] = useState<
    "Brindes" | "Digital" | "IMACX"
  >("Brindes");
  const [pipelineTab, setPipelineTab] = useState<
    "top15" | "attention" | "lost"
  >("top15");

  // Departamentos data - Análise
  const [departmentOrcamentos, setDepartmentOrcamentos] = useState<any[]>([]);
  const [departmentFaturas, setDepartmentFaturas] = useState<any[]>([]);
  const [departmentConversao, setDepartmentConversao] = useState<any[]>([]);
  const [departmentClientes, setDepartmentClientes] = useState<any[]>([]);

  // Departamentos data - Reuniões (Pipeline)
  const [pipelineData, setPipelineData] = useState<any>(null);

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

  // Cost Center Sales sort state
  type CostCenterSalesSortColumn =
    | "centro_custo"
    | "vendas"
    | "var_pct"
    | "num_faturas"
    | "num_clientes"
    | "ticket_medio"
    | "compras"
    | "margem"
    | "margem_pct";

  const [salesSortColumn, setSalesSortColumn] =
    useState<CostCenterSalesSortColumn>("vendas");
  const [salesSortDirection, setSalesSortDirection] = useState<"asc" | "desc">(
    "desc",
  );

  // Cost Center Performance sort state
  type CostCenterPerformanceSortColumn =
    | "cost_center"
    | "receita_liquida"
    | "var_pct"
    | "num_faturas"
    | "num_clientes"
    | "ticket_medio";

  const [perfSortColumn, setPerfSortColumn] =
    useState<CostCenterPerformanceSortColumn>("receita_liquida");
  const [perfSortDirection, setPerfSortDirection] = useState<"asc" | "desc">(
    "desc",
  );

  // Cost Center Top Customers sort state
  type CostCenterTopCustomersSortColumn =
    | "rank"
    | "customerName"
    | "salesperson"
    | "invoiceCount"
    | "quoteCount"
    | "conversionRate"
    | "netRevenue"
    | "revenueSharePct"
    | "lastInvoice";

  const [ccTopSortColumn, setCcTopSortColumn] =
    useState<CostCenterTopCustomersSortColumn>("rank");
  const [ccTopSortDirection, setCcTopSortDirection] = useState<"asc" | "desc">(
    "asc",
  );

  // Department Orcamentos sort state
  type DepartmentOrcamentosSortColumn =
    | "escaloes_valor"
    | "total_orcamentos"
    | "total_valor";
  const [deptOrcSortColumn, setDeptOrcSortColumn] =
    useState<DepartmentOrcamentosSortColumn>("escaloes_valor");
  const [deptOrcSortDirection, setDeptOrcSortDirection] = useState<
    "asc" | "desc"
  >("asc");

  // Department Faturas sort state
  type DepartmentFaturasSortColumn =
    | "escaloes_valor"
    | "total_faturas"
    | "total_valor";
  const [deptFatSortColumn, setDeptFatSortColumn] =
    useState<DepartmentFaturasSortColumn>("escaloes_valor");
  const [deptFatSortDirection, setDeptFatSortDirection] = useState<
    "asc" | "desc"
  >("asc");

  // Department Conversao sort state
  type DepartmentConversaoSortColumn =
    | "escalao"
    | "total_orcamentos"
    | "total_faturas"
    | "taxa_conversao_pct";
  const [deptConvSortColumn, setDeptConvSortColumn] =
    useState<DepartmentConversaoSortColumn>("escalao");
  const [deptConvSortDirection, setDeptConvSortDirection] = useState<
    "asc" | "desc"
  >("asc");

  // Pipeline Top 15 sort state
  type PipelineTop15SortColumn = "cliente_nome" | "total" | "dias_decorridos";
  const [top15SortColumn, setTop15SortColumn] =
    useState<PipelineTop15SortColumn>("total");
  const [top15SortDirection, setTop15SortDirection] = useState<"asc" | "desc">(
    "desc",
  );

  // Pipeline Needs Attention sort state
  type PipelineAttentionSortColumn =
    | "cliente_nome"
    | "total"
    | "dias_decorridos";
  const [attentionSortColumn, setAttentionSortColumn] =
    useState<PipelineAttentionSortColumn>("dias_decorridos");
  const [attentionSortDirection, setAttentionSortDirection] = useState<
    "asc" | "desc"
  >("desc");

  // Pipeline Perdidos sort state
  type PipelinePerdidosSortColumn =
    | "cliente_nome"
    | "total"
    | "dias_decorridos";
  const [perdidosSortColumn, setPerdidosSortColumn] =
    useState<PipelinePerdidosSortColumn>("dias_decorridos");
  const [perdidosSortDirection, setPerdidosSortDirection] = useState<
    "asc" | "desc"
  >("desc");

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchAllData = useCallback(
    async (
      tab: "mtd" | "ytd" | "qtd" = activeTab,
      section:
        | "visao-geral"
        | "centro-custo"
        | "departamentos"
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

          const topCustomersResponse = await fetch(
            `/api/financial-analysis/cost-center-top-customers?period=${tab}&limit=20`,
          );
          if (!topCustomersResponse.ok) {
            console.warn(
              "Failed to fetch cost center top customers - showing empty state",
            );
            // Create empty response structure so table still renders
            const now = new Date();
            const emptyResponse: CostCenterTopCustomersResponse = {
              costCenters: COST_CENTERS.map((center) => ({
                costCenter: center,
                customers: [],
                summary: {
                  totalCustomers: 0,
                  totalRevenue: 0,
                  totalInvoices: 0,
                },
              })),
              metadata: {
                period: tab as "ytd" | "mtd",
                startDate:
                  tab === "mtd"
                    ? new Date(now.getFullYear(), now.getMonth(), 1)
                        .toISOString()
                        .split("T")[0]
                    : new Date(now.getFullYear(), 0, 1)
                        .toISOString()
                        .split("T")[0],
                endDate: now.toISOString().split("T")[0],
                limit: 20,
                generatedAt: now.toISOString(),
              },
            };
            setCostCenterTopCustomers(emptyResponse);
            setSelectedCostCenter(COST_CENTERS[0]);
          } else {
            const topCustomersJson =
              (await topCustomersResponse.json()) as CostCenterTopCustomersResponse;
            console.log(
              "📊 [Cost Center Top Customers] Response:",
              topCustomersJson,
            );
            console.log(
              "📊 [Cost Center Top Customers] First center customers:",
              topCustomersJson.costCenters[0]?.customers?.length || 0,
            );
            setCostCenterTopCustomers(topCustomersJson);
            setSelectedCostCenter((previous) => {
              if (
                previous &&
                topCustomersJson.costCenters.some(
                  (cc) => cc.costCenter === previous,
                )
              ) {
                return previous;
              }
              return topCustomersJson.costCenters[0]?.costCenter ?? null;
            });
          }
        } else if (section === "departamentos") {
          // DEPARTAMENTOS section data
          // Fetch análise data (escalões, conversão, clientes)
          const periodo = tab === "mtd" ? "mensal" : "anual";
          const analiseResponse = await fetch(
            `/api/gestao/departamentos/analise?periodo=${periodo}`,
          );
          if (!analiseResponse.ok) {
            console.warn("Failed to fetch departamentos analise data");
          } else {
            const analiseJson = await analiseResponse.json();
            console.log("📊 [Departamentos] Análise data received:", {
              orcamentos: analiseJson.orcamentos?.length || 0,
              faturas: analiseJson.faturas?.length || 0,
              conversao: analiseJson.conversao?.length || 0,
              clientes: analiseJson.clientes?.length || 0,
            });
            if (analiseJson.orcamentos?.length > 0) {
              console.log("  Sample orcamento:", analiseJson.orcamentos[0]);
            }
            if (analiseJson.faturas?.length > 0) {
              console.log("  Sample fatura:", analiseJson.faturas[0]);
            }
            setDepartmentOrcamentos(analiseJson.orcamentos || []);
            setDepartmentFaturas(analiseJson.faturas || []);
            setDepartmentConversao(analiseJson.conversao || []);
            setDepartmentClientes(analiseJson.clientes || []);
          }

          // Fetch pipeline data for reuniões
          const pipelineResponse = await fetch(
            `/api/gestao/departamentos/pipeline?departamento=${selectedDepartment}&periodo=${periodo}`,
          );
          if (!pipelineResponse.ok) {
            console.warn("Failed to fetch departamentos pipeline data");
          } else {
            const pipelineJson = await pipelineResponse.json();
            console.log(
              "📊 [Frontend] Pipeline data received for",
              selectedDepartment,
            );
            console.log(
              "  - Top15 count:",
              pipelineJson.metadata?.counts?.top15,
            );
            console.log(
              "  - NeedsAttention count:",
              pipelineJson.metadata?.counts?.needsAttention,
            );
            console.log(
              "  - Perdidos count:",
              pipelineJson.metadata?.counts?.perdidos,
            );
            console.log(
              "  - Aprovados count:",
              pipelineJson.metadata?.counts?.aprovados,
            );
            if (pipelineJson.top15?.length > 0) {
              console.log(
                "  - Top15[0] cliente:",
                pipelineJson.top15[0]?.cliente_nome,
              );
            }
            if (pipelineJson.needsAttention?.length > 0) {
              console.log(
                "  - NeedsAttention[0] cliente:",
                pipelineJson.needsAttention[0]?.cliente_nome,
              );
            }
            setPipelineData(pipelineJson);
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
    [activeTab, mainTab, selectedDepartment],
  );

  useEffect(() => {
    fetchAllData(activeTab, mainTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch pipeline data when selectedDepartment changes in Reuniões view
  useEffect(() => {
    if (mainTab === "departamentos" && departmentView === "reunioes") {
      fetchAllData(activeTab, "departamentos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment]);

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
  // Cost Center Sales Sorting
  // ============================================================================

  const handleSalesSort = (column: CostCenterSalesSortColumn) => {
    setSalesSortDirection((prevDir) =>
      salesSortColumn === column
        ? prevDir === "asc"
          ? "desc"
          : "asc"
        : "desc",
    );
    setSalesSortColumn(column);
  };

  const renderSalesSortIcon = (column: CostCenterSalesSortColumn) => {
    if (salesSortColumn !== column) return null;
    return salesSortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedCostCenterSales =
    costCenterSales?.costCenters.slice().sort((a: any, b: any) => {
      const dir = salesSortDirection === "asc" ? 1 : -1;
      let av, bv;

      switch (salesSortColumn) {
        case "centro_custo":
          av = a.centro_custo || "";
          bv = b.centro_custo || "";
          break;
        case "vendas":
          av = a.vendas;
          bv = b.vendas;
          break;
        case "var_pct":
          av = a.var_pct ?? -Infinity;
          bv = b.var_pct ?? -Infinity;
          break;
        case "num_faturas":
          av = a.num_faturas;
          bv = b.num_faturas;
          break;
        case "num_clientes":
          av = a.num_clientes;
          bv = b.num_clientes;
          break;
        case "ticket_medio":
          av = a.ticket_medio;
          bv = b.ticket_medio;
          break;
        case "compras":
          av = a.compras || 0;
          bv = b.compras || 0;
          break;
        case "margem":
          av = a.vendas - (a.compras || 0);
          bv = b.vendas - (b.compras || 0);
          break;
        case "margem_pct":
          av =
            a.vendas > 0 ? ((a.vendas - (a.compras || 0)) / a.vendas) * 100 : 0;
          bv =
            b.vendas > 0 ? ((b.vendas - (b.compras || 0)) / b.vendas) * 100 : 0;
          break;
        default:
          av = 0;
          bv = 0;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av > bv ? dir : av < bv ? -dir : 0;
    }) || [];

  // ============================================================================
  // Cost Center Performance Sorting
  // ============================================================================

  const handlePerfSort = (column: CostCenterPerformanceSortColumn) => {
    setPerfSortDirection((prevDir) =>
      perfSortColumn === column ? (prevDir === "asc" ? "desc" : "asc") : "desc",
    );
    setPerfSortColumn(column);
  };

  const renderPerfSortIcon = (column: CostCenterPerformanceSortColumn) => {
    if (perfSortColumn !== column) return null;
    return perfSortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedCostCenterPerformance =
    costCenterPerformance?.costCenters.slice().sort((a: any, b: any) => {
      const dir = perfSortDirection === "asc" ? 1 : -1;
      let av, bv;

      switch (perfSortColumn) {
        case "cost_center":
          av = a.cost_center || "";
          bv = b.cost_center || "";
          break;
        case "receita_liquida":
          av = a.receita_liquida;
          bv = b.receita_liquida;
          break;
        case "var_pct":
          av = a.var_pct ?? -Infinity;
          bv = b.var_pct ?? -Infinity;
          break;
        case "num_faturas":
          av = a.num_faturas;
          bv = b.num_faturas;
          break;
        case "num_clientes":
          av = a.num_clientes;
          bv = b.num_clientes;
          break;
        case "ticket_medio":
          av = a.ticket_medio;
          bv = b.ticket_medio;
          break;
        default:
          av = 0;
          bv = 0;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av > bv ? dir : av < bv ? -dir : 0;
    }) || [];

  // ============================================================================
  // Cost Center Top Customers Sorting
  // ============================================================================

  const handleCcTopSort = (column: CostCenterTopCustomersSortColumn) => {
    setCcTopSortDirection((prevDir) =>
      ccTopSortColumn === column ? (prevDir === "asc" ? "desc" : "asc") : "asc",
    );
    setCcTopSortColumn(column);
  };

  const renderCcTopSortIcon = (column: CostCenterTopCustomersSortColumn) => {
    if (ccTopSortColumn !== column) return null;
    return ccTopSortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedCostCenterTopCustomers =
    costCenterTopCustomers?.costCenters
      .find((cc) => cc.costCenter === selectedCostCenter)
      ?.customers.slice()
      .sort((a: any, b: any) => {
        const dir = ccTopSortDirection === "asc" ? 1 : -1;
        let av, bv;

        switch (ccTopSortColumn) {
          case "rank":
            av = a.rank;
            bv = b.rank;
            break;
          case "customerName":
            av = a.customerName || "";
            bv = b.customerName || "";
            break;
          case "salesperson":
            av = a.salesperson || "";
            bv = b.salesperson || "";
            break;
          case "invoiceCount":
            av = a.invoiceCount;
            bv = b.invoiceCount;
            break;
          case "quoteCount":
            av = a.quoteCount;
            bv = b.quoteCount;
            break;
          case "conversionRate":
            av = a.conversionRate ?? -Infinity;
            bv = b.conversionRate ?? -Infinity;
            break;
          case "netRevenue":
            av = a.netRevenue;
            bv = b.netRevenue;
            break;
          case "revenueSharePct":
            av = a.revenueSharePct;
            bv = b.revenueSharePct;
            break;
          case "lastInvoice":
            av = a.lastInvoice || "";
            bv = b.lastInvoice || "";
            break;
          default:
            av = 0;
            bv = 0;
        }

        if (typeof av === "string" && typeof bv === "string") {
          return av.localeCompare(bv) * dir;
        }
        return av > bv ? dir : av < bv ? -dir : 0;
      }) || [];

  const costCenterSelectionOptions = costCenterTopCustomers
    ? costCenterTopCustomers.costCenters
    : [];
  const selectedCostCenterBlock =
    selectedCostCenter && costCenterTopCustomers
      ? costCenterTopCustomers.costCenters.find(
          (cc) => cc.costCenter === selectedCostCenter,
        )
      : null;

  // ============================================================================
  // Helper: Escalão Order
  // ============================================================================

  const escalaoOrder: { [key: string]: number } = {
    "0-1500": 1,
    "1500-2500": 2,
    "2500-7500": 3,
    "7500-15000": 4,
    "15000-30000": 5,
    "30000+": 6,
  };

  const getEscalaoOrder = (escalao: string): number => {
    return escalaoOrder[escalao] || 999;
  };

  // ============================================================================
  // Department Orçamentos Sorting
  // ============================================================================

  const handleDeptOrcSort = (column: DepartmentOrcamentosSortColumn) => {
    setDeptOrcSortDirection((prevDir) =>
      deptOrcSortColumn === column
        ? prevDir === "asc"
          ? "desc"
          : "asc"
        : "desc",
    );
    setDeptOrcSortColumn(column);
  };

  const renderDeptOrcSortIcon = (column: DepartmentOrcamentosSortColumn) => {
    if (deptOrcSortColumn !== column) return null;
    return deptOrcSortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedDepartmentOrcamentos = departmentOrcamentos
    .filter((item) => item.departamento === selectedDepartment)
    .slice()
    .sort((a, b) => {
      const dir = deptOrcSortDirection === "asc" ? 1 : -1;
      let av, bv;

      switch (deptOrcSortColumn) {
        case "escaloes_valor":
          // Use custom escalão order
          av = getEscalaoOrder(a.escaloes_valor || "");
          bv = getEscalaoOrder(b.escaloes_valor || "");
          break;
        case "total_orcamentos":
          av = a.total_orcamentos;
          bv = b.total_orcamentos;
          break;
        case "total_valor":
        default:
          av = a.total_valor;
          bv = b.total_valor;
          break;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av > bv ? dir : av < bv ? -dir : 0;
    });

  // ============================================================================
  // Department Faturas Sorting
  // ============================================================================

  const handleDeptFatSort = (column: DepartmentFaturasSortColumn) => {
    setDeptFatSortDirection((prevDir) =>
      deptFatSortColumn === column
        ? prevDir === "asc"
          ? "desc"
          : "asc"
        : "desc",
    );
    setDeptFatSortColumn(column);
  };

  const renderDeptFatSortIcon = (column: DepartmentFaturasSortColumn) => {
    if (deptFatSortColumn !== column) return null;
    return deptFatSortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedDepartmentFaturas = departmentFaturas
    .filter((item) => item.departamento === selectedDepartment)
    .slice()
    .sort((a, b) => {
      const dir = deptFatSortDirection === "asc" ? 1 : -1;
      let av, bv;

      switch (deptFatSortColumn) {
        case "escaloes_valor":
          // Use custom escalão order
          av = getEscalaoOrder(a.escaloes_valor || "");
          bv = getEscalaoOrder(b.escaloes_valor || "");
          break;
        case "total_faturas":
          av = a.total_faturas;
          bv = b.total_faturas;
          break;
        case "total_valor":
        default:
          av = a.total_valor;
          bv = b.total_valor;
          break;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av > bv ? dir : av < bv ? -dir : 0;
    });

  // ============================================================================
  // Department Conversão Sorting
  // ============================================================================

  const handleDeptConvSort = (column: DepartmentConversaoSortColumn) => {
    setDeptConvSortDirection((prevDir) =>
      deptConvSortColumn === column
        ? prevDir === "asc"
          ? "desc"
          : "asc"
        : "desc",
    );
    setDeptConvSortColumn(column);
  };

  const renderDeptConvSortIcon = (column: DepartmentConversaoSortColumn) => {
    if (deptConvSortColumn !== column) return null;
    return deptConvSortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedDepartmentConversao = departmentConversao
    .filter((item) => item.departamento === selectedDepartment)
    .slice()
    .sort((a, b) => {
      const dir = deptConvSortDirection === "asc" ? 1 : -1;
      let av, bv;

      switch (deptConvSortColumn) {
        case "escalao":
          // Use custom escalão order
          av = getEscalaoOrder(a.escalao || "");
          bv = getEscalaoOrder(b.escalao || "");
          break;
        case "total_orcamentos":
          av = a.total_orcamentos;
          bv = b.total_orcamentos;
          break;
        case "total_faturas":
          av = a.total_faturas;
          bv = b.total_faturas;
          break;
        case "taxa_conversao_pct":
        default:
          av = a.taxa_conversao_pct ?? -Infinity;
          bv = b.taxa_conversao_pct ?? -Infinity;
          break;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av > bv ? dir : av < bv ? -dir : 0;
    });

  // ============================================================================
  // Pipeline Top 15 Sorting
  // ============================================================================

  const handleTop15Sort = (column: PipelineTop15SortColumn) => {
    setTop15SortDirection((prevDir) =>
      top15SortColumn === column
        ? prevDir === "asc"
          ? "desc"
          : "asc"
        : "desc",
    );
    setTop15SortColumn(column);
  };

  const renderTop15SortIcon = (column: PipelineTop15SortColumn) => {
    if (top15SortColumn !== column) return null;
    return top15SortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedTop15 = (pipelineData?.top15 || [])
    .slice()
    .sort((a: any, b: any) => {
      const dir = top15SortDirection === "asc" ? 1 : -1;
      let av, bv;

      switch (top15SortColumn) {
        case "cliente_nome":
          av = a.cliente_nome || "";
          bv = b.cliente_nome || "";
          break;
        case "dias_decorridos":
          av = a.dias_decorridos || 0;
          bv = b.dias_decorridos || 0;
          break;
        case "total":
        default:
          av = a.total_value || 0;
          bv = b.total_value || 0;
          break;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av > bv ? dir : av < bv ? -dir : 0;
    });

  // ============================================================================
  // Pipeline Needs Attention Sorting
  // ============================================================================

  const handleAttentionSort = (column: PipelineAttentionSortColumn) => {
    setAttentionSortDirection((prevDir) =>
      attentionSortColumn === column
        ? prevDir === "asc"
          ? "desc"
          : "asc"
        : "desc",
    );
    setAttentionSortColumn(column);
  };

  const renderAttentionSortIcon = (column: PipelineAttentionSortColumn) => {
    if (attentionSortColumn !== column) return null;
    return attentionSortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedAttention = (pipelineData?.needsAttention || [])
    .slice()
    .sort((a: any, b: any) => {
      const dir = attentionSortDirection === "asc" ? 1 : -1;
      let av, bv;

      switch (attentionSortColumn) {
        case "cliente_nome":
          av = a.cliente_nome || "";
          bv = b.cliente_nome || "";
          break;
        case "total":
          av = a.total_value || 0;
          bv = b.total_value || 0;
          break;
        case "dias_decorridos":
        default:
          av = a.dias_decorridos || 0;
          bv = b.dias_decorridos || 0;
          break;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av > bv ? dir : av < bv ? -dir : 0;
    });

  // ============================================================================
  // Pipeline Perdidos Sorting
  // ============================================================================

  const handlePerdidosSort = (column: PipelinePerdidosSortColumn) => {
    setPerdidosSortDirection((prevDir) =>
      perdidosSortColumn === column
        ? prevDir === "asc"
          ? "desc"
          : "asc"
        : "desc",
    );
    setPerdidosSortColumn(column);
  };

  const renderPerdidosSortIcon = (column: PipelinePerdidosSortColumn) => {
    if (perdidosSortColumn !== column) return null;
    return perdidosSortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const sortedPerdidos = (pipelineData?.perdidos || [])
    .slice()
    .sort((a: any, b: any) => {
      const dir = perdidosSortDirection === "asc" ? 1 : -1;
      let av, bv;

      switch (perdidosSortColumn) {
        case "cliente_nome":
          av = a.cliente_nome || "";
          bv = b.cliente_nome || "";
          break;
        case "total":
          av = a.total_value || 0;
          bv = b.total_value || 0;
          break;
        case "dias_decorridos":
        default:
          av = a.dias_decorridos || 0;
          bv = b.dias_decorridos || 0;
          break;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av > bv ? dir : av < bv ? -dir : 0;
    });

  // ============================================================================
  // Gerar Relatório
  // ============================================================================

  const gerarRelatorio = async () => {
    const hoje = new Date().toLocaleDateString("pt-PT");
    const mes = new Date().toLocaleDateString("pt-PT", {
      month: "long",
      year: "numeric",
    });

    // Buscar TODOS os dados do endpoint dedicado
    try {
      const response = await fetch("/api/gestao/departamentos/report");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error("Erro ao buscar dados do relatório");
      }

      console.log("Dados do relatório:", data);
      console.log("Top Customers:", data.topCustomers);
      console.log("Cost Center Sales:", data.costCenterSales);
      console.log("Cost Center Top Customers:", data.costCenterTopCustomers);
      console.log("Monthly Revenue:", data.monthlyRevenue);
      console.log("Multi Year Revenue:", data.multiYearRevenue);
      console.log("Rankings:", data.rankings);
      console.log("Clientes:", data.clientes);

      // Calcular métricas
      const totalOrcamentosYTD = data.totais.orcamentos.ytd;
      const totalOrcamentosLYTD = data.totais.orcamentos.lytd;
      const totalFaturasYTD = data.totais.faturas.ytd;
      const totalFaturasLYTD = data.totais.faturas.lytd;

      const crescimentoOrcamentos =
        totalOrcamentosLYTD > 0
          ? ((totalOrcamentosYTD - totalOrcamentosLYTD) / totalOrcamentosLYTD) *
            100
          : 0;

      const crescimentoFaturas =
        totalFaturasLYTD > 0
          ? ((totalFaturasYTD - totalFaturasLYTD) / totalFaturasLYTD) * 100
          : 0;

      const taxaConversaoGlobal =
        totalOrcamentosYTD > 0
          ? (totalFaturasYTD / totalOrcamentosYTD) * 100
          : 0;

      // Calcular total de needs attention
      const totalNeedsAttention = Object.values(data.pipeline).reduce(
        (sum: number, dept: any) =>
          sum +
          dept.needsAttention.reduce(
            (s: number, item: any) => s + (item.total_value || 0),
            0,
          ),
        0,
      );

      // Calcular quantidade total de orçamentos YTD (count from all pipeline data)
      const allQuotesYTD = Object.values(data.pipeline).reduce(
        (total: number, dept: any) => {
          // Count all quotes in this department's pipeline (top15 + needsAttention + perdidos + aprovados)
          const deptQuotes =
            (dept.top15?.length || 0) +
            (dept.needsAttention?.length || 0) +
            (dept.perdidos?.length || 0) +
            (dept.aprovados?.length || 0);
          return total + deptQuotes;
        },
        0,
      );

      // Calcular orçamento médio
      const orcamentoMedio =
        allQuotesYTD > 0 ? totalOrcamentosYTD / allQuotesYTD : 0;

      // Formatar dados completos para o relatório
      const relatorio = `# RELATÓRIO FINANCEIRO IMACX COMPLETO - ${mes.toUpperCase()}

---
**Data:** ${hoje}
**Período:** YTD (Year-to-Date)
**Preparado por:** Sistema de Análise IMACX
---

## 📊 SUMÁRIO EXECUTIVO

### KPIs Principais

| Métrica | Valor YTD | Ano Anterior (LYTD) | Variação |
|---------|-----------|---------------------|----------|
| **Volume Orçamentos** | ${totalOrcamentosYTD.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${totalOrcamentosLYTD.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${crescimentoOrcamentos > 0 ? "+" : ""}${crescimentoOrcamentos.toFixed(1)}% |
| **Nº Orçamentos** | ${allQuotesYTD} | - | - |
| **Orçamento Médio** | ${orcamentoMedio.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | - | - |
| **Volume Faturas** | ${totalFaturasYTD.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${totalFaturasLYTD.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${crescimentoFaturas > 0 ? "+" : ""}${crescimentoFaturas.toFixed(1)}% |
| **Taxa de Conversão** | ${taxaConversaoGlobal.toFixed(1)}% | - | - |
| **Nº de Departamentos** | 3 | - | - |

${
  data.kpi
    ? `
### Métricas Adicionais do Dashboard

| Indicador | Valor |
|-----------|-------|
| **Receita Total** | ${(data.kpi.totalRevenue || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} |
| **Clientes Ativos** | ${data.kpi.activeCustomers || 0} |
| **Ticket Médio** | ${(data.kpi.averageOrderValue || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} |
| **Total de Faturas** | ${data.kpi.totalInvoices || 0} |
${data.kpi.growthRate !== undefined ? `| **Taxa de Crescimento** | ${data.kpi.growthRate.toFixed(1)}% |` : ""}
`
    : ""
}

### 🎯 Destaques Executivos

**Performance Geral:**
${
  crescimentoOrcamentos > 0 && crescimentoFaturas > 0
    ? `✅ A empresa apresenta **crescimento positivo** tanto em orçamentos (${crescimentoOrcamentos > 0 ? "+" : ""}${crescimentoOrcamentos.toFixed(1)}%) como em faturas (${crescimentoFaturas > 0 ? "+" : ""}${crescimentoFaturas.toFixed(1)}%).`
    : crescimentoOrcamentos > 0 && crescimentoFaturas <= 0
      ? `⚠️ **Situação mista**: Orçamentos crescem ${crescimentoOrcamentos.toFixed(1)}%, mas faturas ${crescimentoFaturas < 0 ? "caem" : "estagnaram"} ${crescimentoFaturas.toFixed(1)}%. Necessário analisar taxa de conversão.`
      : crescimentoOrcamentos <= 0 && crescimentoFaturas > 0
        ? `⚠️ **Padrão atípico**: Faturas crescem ${crescimentoFaturas.toFixed(1)}% apesar de orçamentos ${crescimentoOrcamentos < 0 ? "caírem" : "estagnarem"} ${crescimentoOrcamentos.toFixed(1)}%. Indica melhor qualificação ou aproveitamento de backlog.`
        : `🔴 **Alerta crítico**: Decréscimo em orçamentos (${crescimentoOrcamentos.toFixed(1)}%) e faturas (${crescimentoFaturas.toFixed(1)}%). Requer ação imediata.`
}

**Pipeline Comercial:**
- Total de oportunidades em atenção: ${Object.values(data.pipeline).reduce((sum: number, dept: any) => sum + dept.needsAttention.length, 0)} (${totalNeedsAttention.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })})
- Taxa de conversão global: ${taxaConversaoGlobal.toFixed(1)}%
${
  totalNeedsAttention > 100000
    ? `- ⚠️ **ATENÇÃO URGENTE**: Mais de €100k em oportunidades paradas há >14 dias`
    : totalNeedsAttention > 50000
      ? `- ⚠️ Valor significativo (>€50k) em oportunidades que precisam follow-up`
      : `- ✅ Pipeline em gestão adequada`
}

**Top Clientes:**
${
  data.topCustomers && data.topCustomers.length > 0
    ? `- Top 20 clientes representam ${data.topCustomers
        .slice(0, 20)
        .reduce((sum: number, c: any) => sum + (c.total_revenue || 0), 0)
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- Cliente #1: **${data.topCustomers[0]?.customer_name || data.topCustomers[0]?.nome || "N/A"}** (${(data.topCustomers[0]?.total_revenue || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })})`
    : "- Dados não disponíveis"
}

---

## 💼 ANÁLISE DETALHADA POR DEPARTAMENTO

${["Brindes", "Digital", "IMACX"]
  .map((dept) => {
    const orcDept = data.orcamentos.filter((o: any) => o.departamento === dept);
    const fatDept = data.faturas.filter((f: any) => f.departamento === dept);
    const convDept = data.conversao.filter((c: any) => c.departamento === dept);

    // Buscar dados adicionais do performance raw
    const perfDept = data.raw?.performance?.find(
      (p: any) => p.department_name === dept,
    );

    const totalOrcDept = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_ytd || 0),
      0,
    );
    const totalOrcDeptLYTD = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_lytd || 0),
      0,
    );
    const totalFatDept = fatDept.reduce(
      (sum: number, item: any) => sum + (item.total_faturas_ytd || 0),
      0,
    );
    const totalFatDeptLYTD = fatDept.reduce(
      (sum: number, item: any) => sum + (item.total_faturas_lytd || 0),
      0,
    );

    const crescDept =
      totalOrcDeptLYTD > 0
        ? ((totalOrcDept - totalOrcDeptLYTD) / totalOrcDeptLYTD) * 100
        : 0;

    const crescFatDept =
      totalFatDeptLYTD > 0
        ? ((totalFatDept - totalFatDeptLYTD) / totalFatDeptLYTD) * 100
        : 0;

    const taxaConvDept =
      totalOrcDept > 0 ? (totalFatDept / totalOrcDept) * 100 : 0;

    const qtdFaturas = perfDept?.invoices_ytd || 0;
    const qtdClientes = perfDept?.customers_ytd || 0;
    const ticketMedio = qtdFaturas > 0 ? totalFatDept / qtdFaturas : 0;

    return `
### ${dept}

#### Métricas Financeiras

| Métrica | Valor YTD | Valor LYTD | Variação |
|---------|-----------|------------|----------|
| **Orçamentos** | ${totalOrcDept.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${totalOrcDeptLYTD.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${crescDept > 0 ? "+" : ""}${crescDept.toFixed(1)}% |
| **Faturas** | ${totalFatDept.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${totalFatDeptLYTD > 0 ? totalFatDeptLYTD.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "-"} | ${totalFatDeptLYTD > 0 ? (crescFatDept > 0 ? "+" : "") + crescFatDept.toFixed(1) + "%" : "-"} |
| **Taxa Conversão** | ${taxaConvDept.toFixed(1)}% | - | - |

#### Métricas Operacionais

| Indicador | Valor |
|-----------|-------|
| **Nº Faturas YTD** | ${qtdFaturas} |
| **Nº Clientes YTD** | ${qtdClientes} |
| **Ticket Médio** | ${ticketMedio > 0 ? ticketMedio.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "-"} |
| **Faturas por Cliente** | ${qtdClientes > 0 ? (qtdFaturas / qtdClientes).toFixed(1) : "-"} |

#### Performance Resumida

${
  crescDept > 0 && crescFatDept > 0
    ? "✅ **Crescimento positivo** em orçamentos e faturas - departamento em boa trajetória"
    : crescDept > 0 && crescFatDept <= 0
      ? "⚠️ **Atenção**: Orçamentos crescem mas faturas não acompanham - analisar conversão"
      : crescDept <= 0 && crescFatDept > 0
        ? "⚠️ **Mix interessante**: Faturas crescem apesar de orçamentos em queda - melhor qualificação?"
        : "🔴 **Alerta**: Decréscimo em orçamentos e faturas - ação imediata necessária"
}
`;
  })
  .join("\n---\n")}

---

## 📊 ANÁLISE POR ESCALÕES DE VALOR

### Distribuição de Orçamentos por Faixa de Valor

| Escalão | Nº Orçamentos | Valor Total | Aprovados | Pendentes | Perdidos |
|---------|---------------|-------------|-----------|-----------|----------|
${data.escaloes && data.escaloes.length > 0 ? data.escaloes.map((e: any) => `| **${e.escalao}** | ${e.total_quotes} | ${e.total_value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${e.approved} | ${e.pending} | ${e.lost} |`).join("\n") : "| - | - | - | - | - | - |"}

**Análise:**
- Escalões menores (0-1500€) representam maior volume de transações
- Escalões maiores (>15000€) concentram maior valor
- Taxa de conversão varia significativamente por escalão

---

## 👥 ANÁLISE DE PERFORMANCE POR VENDEDOR

### Esforço, Conversão e Mix de Valores

${
  data.salespersons && data.salespersons.length > 0
    ? `
| Vendedor | Nº Orçamentos | Valor Total | Taxa Conversão | Ticket Médio | Aprovados |
|----------|---------------|-------------|----------------|--------------|----------|
${data.salespersons
  .slice(0, 15)
  .map(
    (sp: any) =>
      `| **${sp.salesperson}** | ${sp.total_quotes} | ${sp.total_value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${sp.conversion_rate.toFixed(1)}% | ${sp.avg_quote_value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${sp.approved_quotes} |`,
  )
  .join("\n")}

### Detalhes por Vendedor

${data.salespersons
  .slice(0, 10)
  .map(
    (sp: any) => `
#### ${sp.salesperson}

- **Esforço (Nº Orçamentos):** ${sp.total_quotes}
- **Valor Total:** ${sp.total_value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- **Taxa de Conversão:** ${sp.conversion_rate.toFixed(1)}%
- **Ticket Médio:** ${sp.avg_quote_value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- **Aprovados:** ${sp.approved_quotes} (${sp.approved_value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })})
- **Pendentes:** ${sp.pending_quotes} (${sp.pending_value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })})
- **Perdidos:** ${sp.lost_quotes} (${sp.lost_value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })})
`,
  )
  .join("\n")}
`
    : "\n*Dados de vendedores não disponíveis*\n"
}

---

## 📈 PIPELINE COMERCIAL DETALHADO

${["Brindes", "Digital", "IMACX"]
  .map((dept) => {
    const pipeline = data.pipeline[dept];
    const totalPipeline = pipeline.top15.reduce(
      (sum: number, item: any) => sum + (item.total_value || 0),
      0,
    );
    const totalNeedsAttention = pipeline.needsAttention.reduce(
      (sum: number, item: any) => sum + (item.total_value || 0),
      0,
    );
    const totalPerdidos = pipeline.perdidos.reduce(
      (sum: number, item: any) => sum + (item.total_value || 0),
      0,
    );
    const totalAprovados = pipeline.aprovados.reduce(
      (sum: number, item: any) => sum + (item.total_value || 0),
      0,
    );

    return `
### ${dept}

#### Resumo Geral

| Categoria | Quantidade | Valor Total |
|-----------|------------|-------------|
| **Top 15 do Mês** | ${pipeline.top15.length} | ${totalPipeline.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} |
| **Needs Attention** | ${pipeline.needsAttention.length} | ${totalNeedsAttention.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} |
| **Perdidos (60d)** | ${pipeline.perdidos.length} | ${totalPerdidos.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} |
| **Aprovados (60d)** | ${pipeline.aprovados.length} | ${totalAprovados.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} |

${
  pipeline.top15.length > 0
    ? `
#### 🔝 Top 15 Oportunidades

| # | ORC# | Cliente | Valor | Status | Data | Dias |
|---|------|---------|-------|--------|------|------|
${pipeline.top15
  .slice(0, 15)
  .map((item: any, idx: number) => {
    const orcNum = item.orcamento_numero || item.document_number || "-";
    const cliente = item.cliente_nome || item.customer_name || "N/A";
    const valor = (item.total_value || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    });
    const status = item.status || "N/A";
    const data = item.document_date
      ? new Date(item.document_date).toLocaleDateString("pt-PT")
      : "N/A";
    const dias = item.document_date
      ? Math.floor(
          (new Date().getTime() - new Date(item.document_date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : "-";

    return `| ${idx + 1} | ${orcNum} | **${cliente}** | ${valor} | ${status} | ${data} | ${dias} |`;
  })
  .join("\n")}
`
    : ""
}

${
  pipeline.needsAttention.length > 0
    ? `
#### ⚠️ Oportunidades que Precisam Atenção (>€7.500, +14 dias)

| ORC# | Cliente | Valor | Data | Dias Pendente |
|------|---------|-------|------|---------------|
${pipeline.needsAttention
  .map((item: any) => {
    const orcNum = item.orcamento_numero || item.document_number || "-";
    const cliente =
      item.cliente_nome ||
      item.customer_name ||
      item.client_name ||
      "Cliente não identificado";
    const valor = (item.total_value || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    });
    const data = item.document_date
      ? new Date(item.document_date).toLocaleDateString("pt-PT")
      : "N/A";
    const dias = Math.floor(
      (new Date().getTime() - new Date(item.document_date).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return `| ${orcNum} | **${cliente}** | ${valor} | ${data} | ${dias} |`;
  })
  .join("\n")}

**Total em risco:** ${totalNeedsAttention.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`
    : ""
}

${
  pipeline.aprovados.length > 0
    ? `
#### ✅ Aprovados Recentes (60 dias)

- Total aprovado: ${totalAprovados.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- Quantidade: ${pipeline.aprovados.length} orçamentos
${pipeline.aprovados
  .slice(0, 5)
  .map(
    (item: any, idx: number) => `
- **${item.cliente_nome || item.customer_name || "N/A"}** - ${(item.total_value || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`,
  )
  .join("")}
`
    : ""
}

${
  pipeline.perdidos.length > 0
    ? `
#### ❌ Perdidos Recentes (60 dias)

**Resumo:**
- Total perdido: ${totalPerdidos.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
- Quantidade: ${pipeline.perdidos.length} orçamentos
- Taxa de perda: ${((pipeline.perdidos.length / (pipeline.perdidos.length + pipeline.aprovados.length)) * 100).toFixed(1)}%

| ORC# | Cliente | Valor | Data | Dias | Motivo |
|------|---------|-------|------|------|--------|
${pipeline.perdidos
  .slice(0, 20)
  .map((item: any) => {
    const orcNum = item.orcamento_numero || item.document_number || "-";
    const cliente = item.cliente_nome || item.customer_name || "N/A";
    const valor = (item.total_value || 0).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
    });
    const data = item.document_date
      ? new Date(item.document_date).toLocaleDateString("pt-PT")
      : "N/A";
    const dias = item.document_date
      ? Math.floor(
          (new Date().getTime() - new Date(item.document_date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : "-";
    const motivo = item.motivo || "-";

    return `| ${orcNum} | **${cliente}** | ${valor} | ${data} | ${dias} | ${motivo} |`;
  })
  .join("\n")}
`
    : ""
}
`;
  })
  .join("\n---\n")}

---

## 🏆 TOP 20 CLIENTES YTD

${
  data.topCustomers && data.topCustomers.length > 0
    ? `
| # | Cliente | Valor YTD | Ano Anterior | Var % | % Total | Nº Faturas | Ticket Médio |
|---|---------|-----------|--------------|-------|---------|------------|--------------|
${data.topCustomers
  .slice(0, 20)
  .map((c: any, idx: number) => {
    const revenue = c.total_revenue || 0;
    const prevRevenue = c.previousNetRevenue || c.previous_net_revenue || 0;
    const varPct = c.previousDeltaPct || c.previous_delta_pct || 0;
    const sharePct = c.revenueSharePct || c.revenue_share_pct || 0;
    const invoiceCount = c.invoice_count || 0;
    const ticketMedio = invoiceCount > 0 ? revenue / invoiceCount : 0;

    return `| ${idx + 1} | **${c.customer_name || c.nome || "N/A"}** | ${revenue.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${prevRevenue.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${varPct > 0 ? "+" : ""}${varPct.toFixed(1)}% | ${sharePct.toFixed(1)}% | ${invoiceCount} | ${ticketMedio.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} |`;
  })
  .join("\n")}

**Total Top 20:** ${data.topCustomers
        .slice(0, 20)
        .reduce((sum: number, c: any) => sum + (c.total_revenue || 0), 0)
        .toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`
    : "Sem dados disponíveis"
}

---

## 📊 ANÁLISE POR CENTRO DE CUSTO

### Performance Detalhada YTD

${
  data.costCenterSales && data.costCenterSales.length > 0
    ? `
| Centro de Custo | MTD | YTD Atual | YTD Ano Anterior | Crescimento |
|-----------------|-----|-----------|------------------|-------------|
${data.costCenterSales
  .map((cc: any) => {
    const crescimento =
      cc.lytd > 0 ? ((cc.ytd_current - cc.lytd) / cc.lytd) * 100 : 0;
    return `| **${cc.cost_center_name || cc.cost_center}** | ${(cc.mtd_current || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${(cc.ytd_current || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${(cc.lytd || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${crescimento > 0 ? "+" : ""}${crescimento.toFixed(1)}% |`;
  })
  .join("\n")}

**Total Geral YTD:** ${data.costCenterSales.reduce((sum: number, cc: any) => sum + (cc.ytd_current || 0), 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`
    : "Sem dados disponíveis"
}

### Top 20 Clientes por Centro de Custo

${
  data.costCenterTopCustomers && data.costCenterTopCustomers.length > 0
    ? data.costCenterTopCustomers
        .map(
          (cc: any) => `
#### ${cc.cost_center_name || cc.cost_center || cc.costCenter}

${
  cc.customers && cc.customers.length > 0
    ? `
| # | Cliente | Vendedor | Receita | % Centro | Nº Faturas | Nº Orçamentos | Conversão | Última Fatura |
|---|---------|----------|---------|----------|------------|---------------|-----------|---------------|
${cc.customers
  .slice(0, 20)
  .map((c: any) => {
    const rank = c.rank || 0;
    const name = c.client_name || c.customer_name || "N/A";
    const salesperson = c.salesperson || "-";
    const revenue = c.total_amount || c.total_revenue || 0;
    const sharePct = c.revenue_share_pct || 0;
    const invoiceCount = c.invoice_count || 0;
    const quoteCount = c.quote_count || 0;
    const conversionRate = c.conversion_rate != null ? c.conversion_rate : 0;
    const lastInvoice = c.last_invoice
      ? new Date(c.last_invoice).toLocaleDateString("pt-PT")
      : "-";

    return `| ${rank} | **${name}** | ${salesperson} | ${revenue.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${sharePct.toFixed(1)}% | ${invoiceCount} | ${quoteCount} | ${conversionRate.toFixed(0)}% | ${lastInvoice} |`;
  })
  .join("\n")}

**Total:** ${cc.customers.reduce((sum: number, c: any) => sum + (c.total_amount || c.total_revenue || 0), 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`
    : "Sem clientes registados"
}
`,
        )
        .join("\n")
    : "Sem dados disponíveis"
}

---

## 📈 VENDAS MENSAIS YTD

${
  data.monthlyRevenue && data.monthlyRevenue.length > 0
    ? `
| Mês | Departamento | Valor | Faturas | Clientes |
|-----|--------------|-------|---------|----------|
${data.monthlyRevenue
  .slice(0, 36)
  .map((m: any) => {
    const monthDate = new Date(m.month);
    const monthName = monthDate.toLocaleDateString("pt-PT", {
      month: "long",
      year: "numeric",
    });
    return `| **${monthName}** | ${m.department_name || "N/A"} | ${(m.revenue || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${m.invoice_count || 0} | ${m.unique_customers || 0} |`;
  })
  .join("\n")}
`
    : "Sem dados disponíveis"
}

---

## 📊 COMPARAÇÃO MULTI-ANO POR CENTRO DE CUSTO (Últimos 3 Anos YTD)

${
  data.multiYearRevenue && data.multiYearRevenue.length > 0
    ? `
| Centro de Custo | ${new Date().getFullYear() - 2} | ${new Date().getFullYear() - 1} | ${new Date().getFullYear()} | Variação YoY |
|----------------|------|------|------|--------------|
${data.multiYearRevenue
  .map((cc: any) => {
    const ano2 = cc.ano_anterior_2 || 0;
    const ano1 = cc.ano_anterior || 0;
    const ano0 = cc.ano_atual || 0;
    const variacao = ano1 > 0 ? ((ano0 - ano1) / ano1) * 100 : 0;
    return `| **${cc.cost_center || "N/A"}** | ${ano2.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${ano1.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${ano0.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${variacao > 0 ? "+" : ""}${variacao.toFixed(1)}% |`;
  })
  .join("\n")}

**Total ${new Date().getFullYear()}:** ${data.multiYearRevenue.reduce((sum: number, cc: any) => sum + (cc.ano_atual || 0), 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
`
    : "Sem dados disponíveis"
}

---

## 🏅 RANKINGS DE PERFORMANCE

${
  data.rankings && data.rankings.length > 0
    ? `
### Top Performers

| Ranking | Entidade | Valor YTD | Crescimento | Nº Clientes |
|---------|----------|-----------|-------------|-------------|
${data.rankings
  .slice(0, 10)
  .map(
    (r: any, idx: number) =>
      `| ${idx + 1} | **${r.name || r.department_name || r.entity}** | ${(r.ytd_revenue || r.total_revenue || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${(r.growth_percentage || r.yoy_growth || 0).toFixed(1)}% | ${r.customer_count || r.customers || "-"} |`,
  )
  .join("\n")}
`
    : "Sem dados disponíveis"
}

---

## 👥 ANÁLISE DE CLIENTES

### Movimento de Clientes YTD

${
  data.clientes && data.clientes.length > 0
    ? `
| Categoria | Quantidade |
|-----------|------------|
| **Clientes Ativos** | ${data.clientes.find((c: any) => c.tipo === "ytd")?.quantidade || 0} |
| **Novos Clientes** | ${data.clientes.filter((c: any) => c.tipo === "novo").length} |
| **Clientes Perdidos** | ${data.clientes.filter((c: any) => c.tipo === "perdido").length} |
`
    : "Sem dados disponíveis"
}

---

## 🎯 CONCLUSÕES E RECOMENDAÇÕES

### Sumário de Performance

| Indicador | Valor YTD | vs Ano Anterior | Status |
|-----------|-----------|-----------------|--------|
| **Orçamentos** | ${totalOrcamentosYTD.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${crescimentoOrcamentos > 0 ? "+" : ""}${crescimentoOrcamentos.toFixed(1)}% | ${crescimentoOrcamentos > 10 ? "🟢 Excelente" : crescimentoOrcamentos > 0 ? "🟡 Positivo" : crescimentoOrcamentos > -10 ? "🟠 Atenção" : "🔴 Crítico"} |
| **Faturas** | ${totalFaturasYTD.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} | ${crescimentoFaturas > 0 ? "+" : ""}${crescimentoFaturas.toFixed(1)}% | ${crescimentoFaturas > 10 ? "🟢 Excelente" : crescimentoFaturas > 0 ? "🟡 Positivo" : crescimentoFaturas > -10 ? "🟠 Atenção" : "🔴 Crítico"} |
| **Taxa Conversão** | ${taxaConversaoGlobal.toFixed(1)}% | - | ${taxaConversaoGlobal > 70 ? "🟢 Ótima" : taxaConversaoGlobal > 50 ? "🟡 Boa" : taxaConversaoGlobal > 30 ? "🟠 Média" : "🔴 Baixa"} |
${data.kpi ? `| **Clientes Ativos** | ${data.kpi.activeCustomers || 0} | - | - |` : ""}

### 📋 Ações Prioritárias

${(() => {
  const acoes = [];

  // Análise de crescimento
  if (crescimentoOrcamentos > 0 && crescimentoFaturas > 0) {
    acoes.push(
      "**1. ✅ Consolidar Crescimento**\n   - Manter estratégia comercial atual\n   - Documentar best practices dos departamentos de melhor performance\n   - Reforçar equipes que demonstram resultados positivos",
    );
  } else if (crescimentoOrcamentos > 0 && crescimentoFaturas <= 0) {
    acoes.push(
      "**1. ⚠️ URGENTE: Melhorar Taxa de Conversão**\n   - Análise detalhada do funil de vendas\n   - Identificar pontos de atrito no processo comercial\n   - Reunião com equipas para entender bloqueios na conversão\n   - Revisão de pricing e condições comerciais",
    );
  } else if (crescimentoOrcamentos <= 0 && crescimentoFaturas > 0) {
    acoes.push(
      "**1. 🔍 Analisar Eficiência Operacional**\n   - Investigar por que faturas crescem com menos orçamentos\n   - Avaliar qualidade de qualificação de leads\n   - Considerar aumentar esforço comercial para manter tendência",
    );
  } else {
    acoes.push(
      "**1. 🚨 CRÍTICO: Reversão de Tendência Negativa**\n   - Análise de causa raiz imediata\n   - Revisão completa da estratégia comercial\n   - Reunião executiva de emergência\n   - Plano de ação de 30 dias para recuperação",
    );
  }

  // Pipeline
  if (totalNeedsAttention > 100000) {
    acoes.push(
      `**2. 💰 CRÍTICO: Recuperar Pipeline Parado**\n   - **${totalNeedsAttention.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}** em oportunidades >14 dias\n   - Follow-up imediato com todos os clientes da lista "Needs Attention"\n   - Definir responsáveis e prazos para cada oportunidade\n   - Revisão semanal até reduzir para <€50k`,
    );
  } else if (totalNeedsAttention > 50000) {
    acoes.push(
      `**2. ⚠️ Gestão Ativa de Pipeline**\n   - ${totalNeedsAttention.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} em oportunidades que precisam atenção\n   - Priorizar follow-up nos próximos 7 dias\n   - Estabelecer SLA de resposta para oportunidades >€7.500`,
    );
  }

  // Departamentos
  const deptsComProblemas = ["Brindes", "Digital", "IMACX"].filter((dept) => {
    const orcDept = data.orcamentos.filter((o: any) => o.departamento === dept);
    const fatDept = data.faturas.filter((f: any) => f.departamento === dept);
    const totalOrcDept = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_ytd || 0),
      0,
    );
    const totalOrcDeptLYTD = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_lytd || 0),
      0,
    );
    const crescDept =
      totalOrcDeptLYTD > 0
        ? ((totalOrcDept - totalOrcDeptLYTD) / totalOrcDeptLYTD) * 100
        : 0;
    return crescDept < 0;
  });

  if (deptsComProblemas.length > 0) {
    acoes.push(
      `**3. 🎯 Focar em Departamentos com Dificuldades**\n   - ${deptsComProblemas.join(", ")} apresenta(m) decréscimo\n   - Análise específica de causas por departamento\n   - Benchmarking com departamentos de melhor performance\n   - Plano de recuperação individualizado`,
    );
  }

  // Top clientes
  if (data.topCustomers && data.topCustomers.length > 0) {
    const top5Total = data.topCustomers
      .slice(0, 5)
      .reduce((sum: number, c: any) => sum + (c.total_revenue || 0), 0);
    const percentTop5 = (top5Total / totalFaturasYTD) * 100;

    if (percentTop5 > 50) {
      acoes.push(
        `**${acoes.length + 1}. ⚠️ Diversificação de Carteira**\n   - Top 5 clientes representam ${percentTop5.toFixed(1)}% da receita\n   - Risco de concentração elevado\n   - Ativar programa de aquisição de novos clientes\n   - Desenvolver clientes de médio porte`,
      );
    }
  }

  return acoes.join("\n\n");
})()}

### 💡 Oportunidades Identificadas

${(() => {
  const oportunidades = [];

  // Pipeline aprovados
  const totalAprovados = Object.values(data.pipeline).reduce(
    (sum: number, dept: any) =>
      sum +
      dept.aprovados.reduce(
        (s: number, item: any) => s + (item.total_value || 0),
        0,
      ),
    0,
  );

  if (totalAprovados > 0) {
    oportunidades.push(
      `- **${totalAprovados.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}** em orçamentos aprovados nos últimos 60 dias - garantir execução e faturação eficiente`,
    );
  }

  // Top 15 do mês
  const totalTop15 = Object.values(data.pipeline).reduce(
    (sum: number, dept: any) =>
      sum +
      dept.top15.reduce(
        (s: number, item: any) => s + (item.total_value || 0),
        0,
      ),
    0,
  );

  if (totalTop15 > 0) {
    oportunidades.push(
      `- **${totalTop15.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}** em pipeline ativo do mês atual - focar em fechamento antes do fim do período`,
    );
  }

  // Taxa de conversão baixa
  if (taxaConversaoGlobal < 50) {
    oportunidades.push(
      `- Taxa de conversão de ${taxaConversaoGlobal.toFixed(1)}% indica potencial de melhoria - cada 10% de aumento representa ~${(totalOrcamentosYTD * 0.1).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} adicionais`,
    );
  }

  // Crescimento de algum departamento
  const deptsCrescendo = ["Brindes", "Digital", "IMACX"].filter((dept) => {
    const orcDept = data.orcamentos.filter((o: any) => o.departamento === dept);
    const totalOrcDept = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_ytd || 0),
      0,
    );
    const totalOrcDeptLYTD = orcDept.reduce(
      (sum: number, item: any) => sum + (item.total_orcamentos_lytd || 0),
      0,
    );
    const crescDept =
      totalOrcDeptLYTD > 0
        ? ((totalOrcDept - totalOrcDeptLYTD) / totalOrcDeptLYTD) * 100
        : 0;
    return crescDept > 15;
  });

  if (deptsCrescendo.length > 0) {
    oportunidades.push(
      `- Departamento(s) ${deptsCrescendo.join(", ")} com forte crescimento - analisar estratégias de sucesso para replicar`,
    );
  }

  return oportunidades.length > 0
    ? oportunidades.join("\n")
    : "- Continuar monitorização de KPIs e identificação proativa de oportunidades";
})()}

### 📊 Próxima Revisão

**Recomendações para próximo relatório:**
- Acompanhar evolução das ações prioritárias definidas
- Monitorizar taxa de conversão semanal
- Revisar status de oportunidades "Needs Attention"
- Analisar tendência de crescimento mês a mês
- Avaliar performance individual dos centros de custo

---

*Relatório gerado automaticamente pelo Sistema de Análise Financeira IMACX*
*Data de geração: ${new Date().toLocaleString("pt-PT")}*
*Para questões ou esclarecimentos: gestao@imacx.pt*
*Confidencial - Uso interno apenas*
`;

      // Criar download do relatório
      const blob = new Blob([relatorio], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-imacx-${new Date().toISOString().split("T")[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      alert(
        "Erro ao gerar relatório. Verifica se os dados estão carregados e tenta novamente.",
      );
    }
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchAllData(activeTab, mainTab)}
            className="h-10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="default" onClick={gerarRelatorio} className="h-10">
            <FileText className="h-4 w-4 mr-2" />
            Gerar Relatório
          </Button>
        </div>
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
          variant={mainTab === "departamentos" ? "default" : "outline"}
          onClick={() => {
            setMainTab("departamentos");
            fetchAllData(activeTab, "departamentos");
          }}
          className="h-10"
        >
          DEPARTAMENTOS
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
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleSalesSort("centro_custo")}
                        >
                          Centro de Custo{renderSalesSortIcon("centro_custo")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleSalesSort("vendas")}
                        >
                          Vendas{renderSalesSortIcon("vendas")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleSalesSort("var_pct")}
                        >
                          Var %{renderSalesSortIcon("var_pct")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleSalesSort("num_faturas")}
                        >
                          Nº Faturas{renderSalesSortIcon("num_faturas")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleSalesSort("num_clientes")}
                        >
                          Nº Clientes{renderSalesSortIcon("num_clientes")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleSalesSort("ticket_medio")}
                        >
                          Ticket Médio{renderSalesSortIcon("ticket_medio")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleSalesSort("compras")}
                        >
                          Compras{renderSalesSortIcon("compras")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleSalesSort("margem")}
                        >
                          Margem{renderSalesSortIcon("margem")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleSalesSort("margem_pct")}
                        >
                          Margem %{renderSalesSortIcon("margem_pct")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCostCenterSales.map((cc: any) => {
                        const changeClass =
                          cc.var_pct === null || cc.var_pct === 0
                            ? ""
                            : cc.var_pct > 0
                              ? "text-success"
                              : "text-destructive";

                        const margem = cc.vendas - (cc.compras || 0);
                        const margemPct =
                          cc.vendas > 0 ? (margem / cc.vendas) * 100 : 0;
                        const margemClass =
                          margemPct >= 50
                            ? "text-success"
                            : margemPct >= 30
                              ? ""
                              : "text-warning";

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
                            <TableCell className="text-right">
                              {formatCurrency(cc.compras)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(margem)}
                            </TableCell>
                            <TableCell className={`text-right ${margemClass}`}>
                              {margemPct.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm imx-border-t pt-4">
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
                    <p className="text-muted-foreground">
                      Total Compras {activeTab === "mtd" ? "Mês Atual" : "YTD"}
                    </p>
                    <p className="text-lg font-normal">
                      {formatCurrency(
                        costCenterSales.costCenters.reduce(
                          (sum: number, cc: any) => sum + (cc.compras || 0),
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Total Margem {activeTab === "mtd" ? "Mês Atual" : "YTD"}
                    </p>
                    <p className="text-lg font-normal">
                      {formatCurrency(
                        costCenterSales.costCenters.reduce(
                          (sum: number, cc: any) =>
                            sum + (cc.vendas - (cc.compras || 0)),
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Margem % Média</p>
                    <p className="text-lg font-normal">
                      {(() => {
                        const totalVendas = costCenterSales.costCenters.reduce(
                          (sum: number, cc: any) => sum + cc.vendas,
                          0,
                        );
                        const totalCompras = costCenterSales.costCenters.reduce(
                          (sum: number, cc: any) => sum + (cc.compras || 0),
                          0,
                        );
                        const avgMargemPct =
                          totalVendas > 0
                            ? ((totalVendas - totalCompras) / totalVendas) * 100
                            : 0;
                        return `${avgMargemPct.toFixed(1)}%`;
                      })()}
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

          {costCenterTopCustomers && costCenterSelectionOptions.length > 0 && (
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl text-foreground">
                      Top 20 Clientes YTD por Centro de Custo
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Dados YTD ({costCenterTopCustomers.metadata.startDate} a{" "}
                      {costCenterTopCustomers.metadata.endDate}). Esta tabela
                      apresenta sempre o acumulado anual, independentemente do
                      período selecionado acima.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {costCenterSelectionOptions.map((option) => (
                      <Button
                        key={option.costCenter}
                        variant={
                          selectedCostCenter === option.costCenter
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => setSelectedCostCenter(option.costCenter)}
                      >
                        {option.costCenter}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedCostCenterBlock ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                      <div>
                        <p className="text-muted-foreground">
                          Receita Centro (YTD)
                        </p>
                        <p className="text-lg font-normal">
                          {formatCurrency(
                            selectedCostCenterBlock.summary.totalRevenue,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Nº Clientes com Receita
                        </p>
                        <p className="text-lg font-normal">
                          {formatNumber(
                            selectedCostCenterBlock.summary.totalCustomers,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Nº Faturas (YTD)
                        </p>
                        <p className="text-lg font-normal">
                          {formatNumber(
                            selectedCostCenterBlock.summary.totalInvoices,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className="w-12 cursor-pointer select-none"
                              onClick={() => handleCcTopSort("rank")}
                            >
                              #{renderCcTopSortIcon("rank")}
                            </TableHead>
                            <TableHead
                              className="cursor-pointer select-none"
                              onClick={() => handleCcTopSort("customerName")}
                            >
                              Cliente{renderCcTopSortIcon("customerName")}
                            </TableHead>
                            <TableHead
                              className="cursor-pointer select-none"
                              onClick={() => handleCcTopSort("salesperson")}
                            >
                              Vendedor{renderCcTopSortIcon("salesperson")}
                            </TableHead>
                            <TableHead
                              className="text-right cursor-pointer select-none"
                              onClick={() => handleCcTopSort("invoiceCount")}
                            >
                              Nº Faturas{renderCcTopSortIcon("invoiceCount")}
                            </TableHead>
                            <TableHead
                              className="text-right cursor-pointer select-none"
                              onClick={() => handleCcTopSort("quoteCount")}
                            >
                              Nº Orçamentos{renderCcTopSortIcon("quoteCount")}
                            </TableHead>
                            <TableHead
                              className="text-right cursor-pointer select-none"
                              onClick={() => handleCcTopSort("conversionRate")}
                            >
                              Conversão{renderCcTopSortIcon("conversionRate")}
                            </TableHead>
                            <TableHead
                              className="text-right cursor-pointer select-none"
                              onClick={() => handleCcTopSort("netRevenue")}
                            >
                              Receita{renderCcTopSortIcon("netRevenue")}
                            </TableHead>
                            <TableHead
                              className="text-right cursor-pointer select-none"
                              onClick={() => handleCcTopSort("revenueSharePct")}
                            >
                              % Centro{renderCcTopSortIcon("revenueSharePct")}
                            </TableHead>
                            <TableHead
                              className="text-right cursor-pointer select-none"
                              onClick={() => handleCcTopSort("lastInvoice")}
                            >
                              Última Fatura{renderCcTopSortIcon("lastInvoice")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedCostCenterTopCustomers &&
                          sortedCostCenterTopCustomers.length > 0 ? (
                            sortedCostCenterTopCustomers.map((customer) => (
                              <TableRow
                                key={`${selectedCostCenterBlock.costCenter}-${customer.customerId}`}
                              >
                                <TableCell>{customer.rank}</TableCell>
                                <TableCell className="font-normal">
                                  <div>
                                    <p>{customer.customerName}</p>
                                    {customer.city && (
                                      <p className="text-xs text-muted-foreground">
                                        {customer.city}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{customer.salesperson}</TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(customer.invoiceCount)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(customer.quoteCount)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {customer.conversionRate != null
                                    ? `${customer.conversionRate.toFixed(1)}%`
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(customer.netRevenue)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatPercent(customer.revenueSharePct)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {customer.lastInvoice || "-"}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={9}
                                className="text-center text-muted-foreground"
                              >
                                Sem clientes com receita neste centro.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Seleciona um centro de custo para ver o detalhe dos
                    clientes.
                  </p>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ========================================== */}
      {/* DEPARTAMENTOS TAB CONTENT */}
      {/* ========================================== */}
      {mainTab === "departamentos" && (
        <>
          {/* Toggle between Análise and Reuniões */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={departmentView === "analise" ? "default" : "outline"}
              onClick={() => setDepartmentView("analise")}
              className="h-10"
            >
              ANÁLISE
            </Button>
            <Button
              variant={departmentView === "reunioes" ? "default" : "outline"}
              onClick={() => setDepartmentView("reunioes")}
              className="h-10"
            >
              REUNIÕES
            </Button>
          </div>

          {/* ANÁLISE VIEW */}
          {departmentView === "analise" && (
            <>
              {/* Department Selector for Análise */}
              <div className="flex gap-2 mb-6">
                <Button
                  variant={
                    selectedDepartment === "Brindes" ? "default" : "outline"
                  }
                  onClick={() => setSelectedDepartment("Brindes")}
                  className="h-10"
                >
                  BRINDES
                </Button>
                <Button
                  variant={
                    selectedDepartment === "Digital" ? "default" : "outline"
                  }
                  onClick={() => setSelectedDepartment("Digital")}
                  className="h-10"
                >
                  DIGITAL
                </Button>
                <Button
                  variant={
                    selectedDepartment === "IMACX" ? "default" : "outline"
                  }
                  onClick={() => setSelectedDepartment("IMACX")}
                  className="h-10"
                >
                  IMACX
                </Button>
              </div>

              <Card className="p-6 mb-6">
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    📊 Dados do Ano Anterior (2024) - Base: 2years_bo/fi tables
                  </p>
                </div>
                <h2 className="text-xl text-foreground mb-4">
                  ANÁLISE {selectedDepartment.toUpperCase()} - Ano Anterior
                  (2024)
                </h2>

                {/* KPI Card for selected department */}
                {departmentClientes
                  .filter(
                    (dept: any) => dept.departamento === selectedDepartment,
                  )
                  .map((dept: any) => (
                    <Card key={dept.departamento} className="p-4 mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Clientes
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-xs text-muted-foreground">
                            Clientes YTD:
                          </span>
                          <p className="text-2xl font-medium">
                            {dept.clientes_ytd}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">
                            Novos:
                          </span>
                          <p className="text-2xl font-medium text-green-600 dark:text-green-400">
                            +{dept.clientes_novos}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">
                            Perdidos:
                          </span>
                          <p className="text-2xl font-medium text-red-600 dark:text-red-400">
                            -{dept.clientes_perdidos}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}

                {/* Orçamentos por Escalão */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4">
                    Orçamentos por Escalão
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleDeptOrcSort("escaloes_valor")}
                        >
                          Escalão
                          {renderDeptOrcSortIcon("escaloes_valor")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleDeptOrcSort("total_orcamentos")}
                        >
                          Quantidade
                          {renderDeptOrcSortIcon("total_orcamentos")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleDeptOrcSort("total_valor")}
                        >
                          Valor Total
                          {renderDeptOrcSortIcon("total_valor")}
                        </TableHead>
                        <TableHead className="text-right">% Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDepartmentOrcamentos.map(
                        (row: any, idx: number) => {
                          const totalValor = sortedDepartmentOrcamentos.reduce(
                            (sum: number, r: any) =>
                              sum + parseFloat(r.total_valor),
                            0,
                          );
                          const percentage =
                            totalValor > 0
                              ? (
                                  (parseFloat(row.total_valor) / totalValor) *
                                  100
                                ).toFixed(1)
                              : "0.0";

                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">
                                {row.escaloes_valor}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.total_orcamentos}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(row.total_valor)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {percentage}%
                              </TableCell>
                            </TableRow>
                          );
                        },
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Faturas por Escalão */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4">
                    Faturas por Escalão
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleDeptFatSort("escaloes_valor")}
                        >
                          Escalão
                          {renderDeptFatSortIcon("escaloes_valor")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleDeptFatSort("total_faturas")}
                        >
                          Quantidade
                          {renderDeptFatSortIcon("total_faturas")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleDeptFatSort("total_valor")}
                        >
                          Valor Total
                          {renderDeptFatSortIcon("total_valor")}
                        </TableHead>
                        <TableHead className="text-right">% Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDepartmentFaturas.map((row: any, idx: number) => {
                        const totalValor = sortedDepartmentFaturas.reduce(
                          (sum: number, r: any) =>
                            sum + parseFloat(r.total_valor),
                          0,
                        );
                        const percentage =
                          totalValor > 0
                            ? (
                                (parseFloat(row.total_valor) / totalValor) *
                                100
                              ).toFixed(1)
                            : "0.0";

                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {row.escaloes_valor}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.total_faturas}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(row.total_valor)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {percentage}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Taxa de Conversão por Escalão */}
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Taxa de Conversão por Escalão
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleDeptConvSort("escalao")}
                        >
                          Escalão
                          {renderDeptConvSortIcon("escalao")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleDeptConvSort("total_orcamentos")}
                        >
                          Orçamentos
                          {renderDeptConvSortIcon("total_orcamentos")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleDeptConvSort("total_faturas")}
                        >
                          Faturas
                          {renderDeptConvSortIcon("total_faturas")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() =>
                            handleDeptConvSort("taxa_conversao_pct")
                          }
                        >
                          Taxa Conv.
                          {renderDeptConvSortIcon("taxa_conversao_pct")}
                        </TableHead>
                        <TableHead className="text-right">Valor Orç.</TableHead>
                        <TableHead className="text-right">Valor Fat.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDepartmentConversao.map(
                        (row: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {row.escalao}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.total_orcamentos}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.total_faturas}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  row.taxa_conversao_pct >= 30
                                    ? "text-green-600 dark:text-green-400 font-medium"
                                    : row.taxa_conversao_pct >= 15
                                      ? "text-yellow-600 dark:text-yellow-400 font-medium"
                                      : "text-red-600 dark:text-red-400 font-medium"
                                }
                              >
                                {row.taxa_conversao_pct}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {formatCurrency(row.valor_orcamentos)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {formatCurrency(row.valor_faturas)}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}

          {/* REUNIÕES VIEW */}
          {departmentView === "reunioes" && (
            <>
              {/* Department Selector */}
              <div className="flex gap-2 mb-6">
                <Button
                  variant={
                    selectedDepartment === "Brindes" ? "default" : "outline"
                  }
                  onClick={() => {
                    setSelectedDepartment("Brindes");
                  }}
                  className="h-10"
                >
                  BRINDES
                </Button>
                <Button
                  variant={
                    selectedDepartment === "Digital" ? "default" : "outline"
                  }
                  onClick={() => {
                    setSelectedDepartment("Digital");
                  }}
                  className="h-10"
                >
                  DIGITAL
                </Button>
                <Button
                  variant={
                    selectedDepartment === "IMACX" ? "default" : "outline"
                  }
                  onClick={() => {
                    setSelectedDepartment("IMACX");
                  }}
                  className="h-10"
                >
                  IMACX
                </Button>
              </div>

              {/* Pipeline Tabs */}
              <div className="flex gap-2 mb-6">
                <Button
                  variant={pipelineTab === "top15" ? "default" : "outline"}
                  onClick={() => setPipelineTab("top15")}
                  className="h-10"
                >
                  TOP 15
                </Button>
                <Button
                  variant={pipelineTab === "attention" ? "default" : "outline"}
                  onClick={() => setPipelineTab("attention")}
                  className="h-10"
                >
                  NEEDS ATTENTION
                  {pipelineData?.needsAttention?.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
                      {pipelineData.needsAttention.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant={pipelineTab === "lost" ? "default" : "outline"}
                  onClick={() => setPipelineTab("lost")}
                  className="h-10"
                >
                  PERDIDOS
                </Button>
              </div>

              {/* TOP 15 */}
              {pipelineTab === "top15" && (
                <Card className="p-6">
                  <h3 className="text-lg font-medium mb-4">
                    Top 15 Orçamentos - {selectedDepartment}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ORC#</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleTop15Sort("cliente_nome")}
                        >
                          Cliente
                          {renderTop15SortIcon("cliente_nome")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleTop15Sort("total")}
                        >
                          Valor
                          {renderTop15SortIcon("total")}
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleTop15Sort("dias_decorridos")}
                        >
                          Dias
                          {renderTop15SortIcon("dias_decorridos")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTop15.map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">
                            {row.orcamento_id_humano}
                          </TableCell>
                          <TableCell>
                            {new Date(row.document_date).toLocaleDateString(
                              "pt-PT",
                            )}
                          </TableCell>
                          <TableCell>{row.cliente_nome}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(row.total_value)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                row.status === "APROVADO"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : row.status === "PERDIDO"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              }`}
                            >
                              {row.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                row.dias_decorridos > 30
                                  ? "text-red-600 dark:text-red-400"
                                  : row.dias_decorridos > 14
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : ""
                              }
                            >
                              {row.dias_decorridos}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}

              {/* NEEDS ATTENTION */}
              {pipelineTab === "attention" && (
                <Card className="p-6">
                  <h3 className="text-lg font-medium mb-4">
                    Orçamentos que Precisam Atenção - {selectedDepartment}
                  </h3>
                  {pipelineData?.needsAttention?.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ORC#</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => handleAttentionSort("cliente_nome")}
                          >
                            Cliente
                            {renderAttentionSortIcon("cliente_nome")}
                          </TableHead>
                          <TableHead
                            className="text-right cursor-pointer select-none"
                            onClick={() => handleAttentionSort("total")}
                          >
                            Valor
                            {renderAttentionSortIcon("total")}
                          </TableHead>
                          <TableHead
                            className="text-right cursor-pointer select-none"
                            onClick={() =>
                              handleAttentionSort("dias_decorridos")
                            }
                          >
                            Dias Pendente
                            {renderAttentionSortIcon("dias_decorridos")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedAttention.map((row: any, idx: number) => (
                          <TableRow
                            key={idx}
                            className="imx-border-l-4 imx-border-l-red-500"
                          >
                            <TableCell className="font-mono text-sm">
                              {row.orcamento_id_humano}
                            </TableCell>
                            <TableCell>
                              {new Date(row.document_date).toLocaleDateString(
                                "pt-PT",
                              )}
                            </TableCell>
                            <TableCell>{row.cliente_nome}</TableCell>
                            <TableCell className="text-right font-medium text-lg">
                              {formatCurrency(row.total_value)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                {row.dias_decorridos} dias
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground">
                      Nenhum orçamento precisa de atenção urgente. ✅
                    </p>
                  )}
                </Card>
              )}

              {/* PERDIDOS */}
              {pipelineTab === "lost" && (
                <Card className="p-6">
                  <h3 className="text-lg font-medium mb-4">
                    Orçamentos Perdidos (últimos 60 dias) - {selectedDepartment}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ORC#</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handlePerdidosSort("cliente_nome")}
                        >
                          Cliente
                          {renderPerdidosSortIcon("cliente_nome")}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handlePerdidosSort("total")}
                        >
                          Valor
                          {renderPerdidosSortIcon("total")}
                        </TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handlePerdidosSort("dias_decorridos")}
                        >
                          Dias
                          {renderPerdidosSortIcon("dias_decorridos")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPerdidos.map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">
                            {row.orcamento_id_humano}
                          </TableCell>
                          <TableCell>
                            {new Date(row.document_date).toLocaleDateString(
                              "pt-PT",
                            )}
                          </TableCell>
                          <TableCell>{row.cliente_nome}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(row.total_value)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.motivo}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.dias_decorridos}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ========================================== */}
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

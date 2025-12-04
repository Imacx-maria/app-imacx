"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, FileText } from "lucide-react";
import { generateFinancialReport } from "./utils/reportGenerator";
import { getEscalaoOrder } from "./utils/formatters";
import { OverviewTab } from "./components/OverviewTab";
import { CostCenterTab } from "./components/CostCenterTab";
import { DepartmentsTab } from "./components/DepartmentsTab";
import { useFinancialData } from "./hooks/useFinancialData";
import { useSort } from "./hooks/useSort";

// Types for Sorting
type TopCustomersSortColumn =
  | "rank"
  | "customerName"
  | "salesperson"
  | "invoiceCount"
  | "netRevenue"
  | "revenueSharePct"
  | "lastInvoice";

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

type CostCenterPerformanceSortColumn =
  | "cost_center"
  | "receita_liquida"
  | "var_pct"
  | "num_faturas"
  | "num_clientes"
  | "ticket_medio";

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

type DepartmentOrcamentosSortColumn =
  | "escaloes_valor"
  | "total_orcamentos"
  | "total_valor";

type DepartmentFaturasSortColumn =
  | "escaloes_valor"
  | "total_faturas"
  | "total_valor";

type DepartmentConversaoSortColumn =
  | "escalao"
  | "total_orcamentos"
  | "total_faturas"
  | "taxa_conversao_pct";

type PipelineTop15SortColumn =
  | "orcamento_id_humano"
  | "document_date"
  | "cliente_nome"
  | "total"
  | "dias_decorridos";

type PipelineAttentionSortColumn =
  | "orcamento_id_humano"
  | "document_date"
  | "cliente_nome"
  | "total"
  | "dias_decorridos";

type PipelinePerdidosSortColumn =
  | "orcamento_id_humano"
  | "document_date"
  | "cliente_nome"
  | "total"
  | "dias_decorridos";

type CompanyConversaoSortColumn =
  | "escalao"
  | "total_orcamentos"
  | "total_faturas"
  | "taxa_conversao_pct";

export default function AnaliseFinanceiraPage() {
  // State
  const [mainTab, setMainTab] = useState<
    "visao-geral" | "centro-custo" | "departamentos" | "operacoes"
  >("visao-geral");
  const [activeTab, setActiveTab] = useState<"mtd" | "ytd" | "qtd">("mtd");
  const [departmentView, setDepartmentView] = useState<"analise" | "reunioes">(
    "analise",
  );
  const [selectedDepartment, setSelectedDepartment] = useState<
    "Brindes" | "Digital" | "IMACX"
  >("Brindes");
  const [pipelineTab, setPipelineTab] = useState<
    "top15" | "attention" | "lost"
  >("top15");
  const [analiseTab, setAnaliseTab] = useState<
    "orcamentos" | "faturas" | "conversao" | "graficos"
  >("orcamentos");
  const [selectedCostCenter, setSelectedCostCenter] = useState<string | null>(
    null,
  );

  // Data Hook
  const {
    loading,
    error,
    isRefreshing,
    kpiData,
    monthlyRevenue,
    topCustomers,
    multiYearRevenue,
    costCenterPerformance,
    costCenterSales,
    costCenterTopCustomers,
    companyConversao,
    departmentKpiData,
    departmentOrcamentos,
    departmentFaturas,
    departmentConversao,
    departmentClientes,
    pipelineData,
    allDepartmentsKpi,
    setAllDepartmentsKpi,
    initialCostCenter,
    fetchAllDepartmentsKpi,
    fetchAllInitialData,
    syncStateFromCache,
    handleFastRefresh,
    handleDismissOrcamento,
    // Cost Center Multi-Year Chart
    costCenterMultiYear,
    selectedCostCenterFilter,
    handleCostCenterFilterChange,
  } = useFinancialData();

  // Initial data fetch
  useEffect(() => {
    fetchAllInitialData();
  }, [fetchAllInitialData]);

  // Initialize selected cost center
  useEffect(() => {
    if (initialCostCenter && !selectedCostCenter) {
      setSelectedCostCenter(initialCostCenter);
    }
  }, [initialCostCenter, selectedCostCenter]);

  // Sync cache on tab/dept change
  useEffect(() => {
    syncStateFromCache(activeTab, selectedDepartment);
  }, [activeTab, selectedDepartment, syncStateFromCache]);

  // Pipeline tab adjustment
  useEffect(() => {
    if (activeTab === "mtd" && pipelineTab === "lost") {
      setPipelineTab("top15");
    }
  }, [activeTab, pipelineTab]);

  // Fetch Charts data
  useEffect(() => {
    if (
      mainTab === "departamentos" &&
      departmentView === "analise" &&
      analiseTab === "graficos" &&
      !allDepartmentsKpi
    ) {
      const period = activeTab === "mtd" ? "mtd" : "ytd";
      fetchAllDepartmentsKpi(period).then((data) => {
        setAllDepartmentsKpi(data);
      });
    }
  }, [
    analiseTab,
    mainTab,
    departmentView,
    activeTab,
    fetchAllDepartmentsKpi,
    allDepartmentsKpi,
    setAllDepartmentsKpi,
  ]);

  // Sorting Hooks
  const {
    sortColumn: topSortColumn,
    sortDirection: topSortDirection,
    handleSort: handleTopSort,
  } = useSort<TopCustomersSortColumn>("netRevenue", "desc");

  const {
    sortColumn: salesSortColumn,
    sortDirection: salesSortDirection,
    handleSort: handleSalesSort,
  } = useSort<CostCenterSalesSortColumn>("vendas", "desc");

  const {
    sortColumn: perfSortColumn,
    sortDirection: perfSortDirection,
    handleSort: handlePerfSort,
  } = useSort<CostCenterPerformanceSortColumn>("receita_liquida", "desc");

  const {
    sortColumn: ccTopSortColumn,
    sortDirection: ccTopSortDirection,
    handleSort: handleCcTopSort,
  } = useSort<CostCenterTopCustomersSortColumn>("rank", "asc");

  const {
    sortColumn: deptOrcSortColumn,
    sortDirection: deptOrcSortDirection,
    handleSort: handleDeptOrcSort,
  } = useSort<DepartmentOrcamentosSortColumn>("escaloes_valor", "asc");

  const {
    sortColumn: deptFatSortColumn,
    sortDirection: deptFatSortDirection,
    handleSort: handleDeptFatSort,
  } = useSort<DepartmentFaturasSortColumn>("escaloes_valor", "asc");

  const {
    sortColumn: deptConvSortColumn,
    sortDirection: deptConvSortDirection,
    handleSort: handleDeptConvSort,
  } = useSort<DepartmentConversaoSortColumn>("escalao", "asc");

  const {
    sortColumn: top15SortColumn,
    sortDirection: top15SortDirection,
    handleSort: handleTop15Sort,
  } = useSort<PipelineTop15SortColumn>("total", "desc");

  const {
    sortColumn: attentionSortColumn,
    sortDirection: attentionSortDirection,
    handleSort: handleAttentionSort,
  } = useSort<PipelineAttentionSortColumn>("dias_decorridos", "desc");

  const {
    sortColumn: perdidosSortColumn,
    sortDirection: perdidosSortDirection,
    handleSort: handlePerdidosSort,
  } = useSort<PipelinePerdidosSortColumn>("dias_decorridos", "desc");

  const {
    sortColumn: companyConvSortColumn,
    sortDirection: companyConvSortDirection,
    handleSort: handleCompanyConvSort,
  } = useSort<CompanyConversaoSortColumn>("escalao", "asc");

  // --- Derived Data / Sorting Logic (Copied from original, using useMemo) ---

  // sortedTopCustomers
  const sortedTopCustomers = useMemo(
    () =>
      topCustomers?.customers.slice().sort((a, b) => {
        const dir = topSortDirection === "asc" ? 1 : -1;
        const getValue = (c: any) => {
          // simplified type
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
      }) || [],
    [topCustomers, topSortColumn, topSortDirection],
  );

  // sortedCostCenterSales
  const sortedCostCenterSales = useMemo(
    () =>
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
              a.vendas > 0
                ? ((a.vendas - (a.compras || 0)) / a.vendas) * 100
                : 0;
            bv =
              b.vendas > 0
                ? ((b.vendas - (b.compras || 0)) / b.vendas) * 100
                : 0;
            break;
          default:
            av = 0;
            bv = 0;
        }
        if (typeof av === "string" && typeof bv === "string")
          return av.localeCompare(bv) * dir;
        return av > bv ? dir : av < bv ? -dir : 0;
      }) || [],
    [costCenterSales, salesSortColumn, salesSortDirection],
  );

  // sortedCostCenterTopCustomers
  const sortedCostCenterTopCustomers = useMemo(
    () =>
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
          if (typeof av === "string" && typeof bv === "string")
            return av.localeCompare(bv) * dir;
          return av > bv ? dir : av < bv ? -dir : 0;
        }) || [],
    [
      costCenterTopCustomers,
      selectedCostCenter,
      ccTopSortColumn,
      ccTopSortDirection,
    ],
  );

  // sortedDepartmentOrcamentos
  const sortedDepartmentOrcamentos = useMemo(
    () =>
      departmentOrcamentos
        .filter((item) => item.departamento === selectedDepartment)
        .slice()
        .sort((a, b) => {
          const dir = deptOrcSortDirection === "asc" ? 1 : -1;
          let av, bv;
          switch (deptOrcSortColumn) {
            case "escaloes_valor":
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
          if (typeof av === "string" && typeof bv === "string")
            return av.localeCompare(bv) * dir;
          return av > bv ? dir : av < bv ? -dir : 0;
        }),
    [
      departmentOrcamentos,
      selectedDepartment,
      deptOrcSortColumn,
      deptOrcSortDirection,
    ],
  );

  // sortedDepartmentFaturas
  const sortedDepartmentFaturas = useMemo(
    () =>
      departmentFaturas
        .filter((item) => item.departamento === selectedDepartment)
        .slice()
        .sort((a, b) => {
          const dir = deptFatSortDirection === "asc" ? 1 : -1;
          let av, bv;
          switch (deptFatSortColumn) {
            case "escaloes_valor":
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
          if (typeof av === "string" && typeof bv === "string")
            return av.localeCompare(bv) * dir;
          return av > bv ? dir : av < bv ? -dir : 0;
        }),
    [
      departmentFaturas,
      selectedDepartment,
      deptFatSortColumn,
      deptFatSortDirection,
    ],
  );

  // sortedDepartmentConversao
  const sortedDepartmentConversao = useMemo(
    () =>
      departmentConversao
        .filter((item) => item.departamento === selectedDepartment)
        .slice()
        .sort((a, b) => {
          const dir = deptConvSortDirection === "asc" ? 1 : -1;
          let av, bv;
          switch (deptConvSortColumn) {
            case "escalao":
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
          if (typeof av === "string" && typeof bv === "string")
            return av.localeCompare(bv) * dir;
          return av > bv ? dir : av < bv ? -dir : 0;
        }),
    [
      departmentConversao,
      selectedDepartment,
      deptConvSortColumn,
      deptConvSortDirection,
    ],
  );

  // sortedTop15
  const sortedTop15 = useMemo(
    () =>
      (pipelineData?.top15 || []).slice().sort((a: any, b: any) => {
        const dir = top15SortDirection === "asc" ? 1 : -1;
        let av, bv;
        switch (top15SortColumn) {
          case "orcamento_id_humano":
            av = a.orcamento_id_humano || "";
            bv = b.orcamento_id_humano || "";
            break;
          case "document_date":
            av = new Date(a.document_date).getTime();
            bv = new Date(b.document_date).getTime();
            break;
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
        if (typeof av === "string" && typeof bv === "string")
          return av.localeCompare(bv) * dir;
        return av > bv ? dir : av < bv ? -dir : 0;
      }),
    [pipelineData, top15SortColumn, top15SortDirection],
  );

  // sortedAttention
  const sortedAttention = useMemo(
    () =>
      (pipelineData?.needsAttention || []).slice().sort((a: any, b: any) => {
        const dir = attentionSortDirection === "asc" ? 1 : -1;
        let av, bv;
        switch (attentionSortColumn) {
          case "orcamento_id_humano":
            av = a.orcamento_id_humano || "";
            bv = b.orcamento_id_humano || "";
            break;
          case "document_date":
            av = new Date(a.document_date).getTime();
            bv = new Date(b.document_date).getTime();
            break;
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
        if (typeof av === "string" && typeof bv === "string")
          return av.localeCompare(bv) * dir;
        return av > bv ? dir : av < bv ? -dir : 0;
      }),
    [pipelineData, attentionSortColumn, attentionSortDirection],
  );

  // sortedPerdidos
  const sortedPerdidos = useMemo(
    () =>
      (pipelineData?.perdidos || []).slice().sort((a: any, b: any) => {
        const dir = perdidosSortDirection === "asc" ? 1 : -1;
        let av, bv;
        switch (perdidosSortColumn) {
          case "orcamento_id_humano":
            av = a.orcamento_id_humano || "";
            bv = b.orcamento_id_humano || "";
            break;
          case "document_date":
            av = new Date(a.document_date).getTime();
            bv = new Date(b.document_date).getTime();
            break;
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
        if (typeof av === "string" && typeof bv === "string")
          return av.localeCompare(bv) * dir;
        return av > bv ? dir : av < bv ? -dir : 0;
      }),
    [pipelineData, perdidosSortColumn, perdidosSortDirection],
  );

  // sortedCompanyConversao
  const sortedCompanyConversao = useMemo(
    () =>
      companyConversao.slice().sort((a, b) => {
        const dir = companyConvSortDirection === "asc" ? 1 : -1;
        let av, bv;
        switch (companyConvSortColumn) {
          case "escalao":
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
        if (typeof av === "string" && typeof bv === "string")
          return av.localeCompare(bv) * dir;
        return av > bv ? dir : av < bv ? -dir : 0;
      }),
    [companyConversao, companyConvSortColumn, companyConvSortDirection],
  );

  // Company Conversao Totals
  const companyConversaoTotals = useMemo(() => {
    if (!companyConversao || companyConversao.length === 0) {
      return {
        totalOrcamentos: 0,
        totalFaturas: 0,
        totalValorOrcado: 0,
        totalValorFaturado: 0,
        totalRow: null,
      };
    }
    const totals = companyConversao.reduce(
      (acc, row) => {
        acc.totalOrcamentos += row.total_orcamentos || 0;
        acc.totalFaturas += row.total_faturas || 0;
        acc.totalValorOrcado += row.total_valor_orcado || 0;
        acc.totalValorFaturado += row.total_valor_faturado || 0;
        return acc;
      },
      {
        totalOrcamentos: 0,
        totalFaturas: 0,
        totalValorOrcado: 0,
        totalValorFaturado: 0,
      },
    );

    const avgValorOrcado =
      totals.totalOrcamentos > 0
        ? totals.totalValorOrcado / totals.totalOrcamentos
        : 0;
    const avgValorFaturado =
      totals.totalFaturas > 0
        ? totals.totalValorFaturado / totals.totalFaturas
        : 0;
    const taxaConversaoTotal =
      totals.totalOrcamentos > 0
        ? (totals.totalFaturas / totals.totalOrcamentos) * 100
        : 0;

    return {
      ...totals,
      totalRow: {
        escalao: "TOTAL",
        total_orcamentos: totals.totalOrcamentos,
        total_faturas: totals.totalFaturas,
        taxa_conversao_pct: taxaConversaoTotal,
        peso_pct: 100,
        avg_valor_orcado: avgValorOrcado,
        avg_valor_faturado: avgValorFaturado,
      },
    };
  }, [companyConversao]);

  // Multi-Year Charts Data Preparation
  const multiYearChartData = useMemo(() => {
    if (!multiYearRevenue || multiYearRevenue.years.length !== 3) return [];
    const [y0, y1, y2] = multiYearRevenue.years;
    const findRevenue = (year: number, monthIndex: number): number => {
      const series = multiYearRevenue.series.find((s) => s.year === year);
      if (!series) return 0;
      const ym = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const point = series.points.find((p) => p.month === ym);
      return point ? Math.round(point.revenue) : 0;
    };
    const now = new Date();
    const currentMonthIndex = now.getMonth();
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
  }, [multiYearRevenue]);

  // Department Charts Data
  const departmentChartData1 = useMemo(() => {
    if (!allDepartmentsKpi) return [];
    return ["Brindes", "Digital", "IMACX"].map((dept) => ({
      department: dept,
      orcamentosValor:
        allDepartmentsKpi[dept]?.[activeTab]?.quoteValue?.current || 0,
      receitaTotal: allDepartmentsKpi[dept]?.[activeTab]?.revenue?.current || 0,
    }));
  }, [allDepartmentsKpi, activeTab]);

  const departmentChartData2 = useMemo(() => {
    if (!allDepartmentsKpi) return [];
    return ["Brindes", "Digital", "IMACX"].map((dept) => ({
      department: dept,
      orcamentosQtd:
        allDepartmentsKpi[dept]?.[activeTab]?.quoteCount?.current || 0,
      nFaturas: allDepartmentsKpi[dept]?.[activeTab]?.invoices?.current || 0,
    }));
  }, [allDepartmentsKpi, activeTab]);

  const departmentChartData3 = useMemo(() => {
    if (!allDepartmentsKpi) return [];
    return ["Brindes", "Digital", "IMACX"].map((dept) => ({
      department: dept,
      nClientes: allDepartmentsKpi[dept]?.[activeTab]?.customers?.current || 0,
    }));
  }, [allDepartmentsKpi, activeTab]);

  const departmentChartData4 = useMemo(() => {
    if (!allDepartmentsKpi) return [];
    return ["Brindes", "Digital", "IMACX"].map((dept) => ({
      department: dept,
      orcamentoMedio:
        allDepartmentsKpi[dept]?.[activeTab]?.avgQuoteValue?.current || 0,
      ticketMedio:
        allDepartmentsKpi[dept]?.[activeTab]?.avgInvoiceValue?.current || 0,
    }));
  }, [allDepartmentsKpi, activeTab]);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const activePeriodData = kpiData ? kpiData[activeTab] : null;
  const costCenterSelectionOptions = costCenterTopCustomers
    ? costCenterTopCustomers.costCenters
    : [];
  const selectedCostCenterBlock =
    selectedCostCenter && costCenterTopCustomers
      ? costCenterTopCustomers.costCenters.find(
          (cc) => cc.costCenter === selectedCostCenter,
        )
      : null;

  // Rendering
  if (loading) {
    return (
      <div className="w-full space-y-6 px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-foreground">ANÁLISE FINANCEIRA</h1>
            <p className="text-muted-foreground mt-2">
              Dashboard executivo de análise financeira
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="h-4 w-32 animate-pulse bg-muted rounded mb-4" />
              <div className="h-8 w-24 animate-pulse bg-muted rounded mb-2" />
              <div className="h-4 w-20 animate-pulse bg-muted rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-foreground">ANÁLISE FINANCEIRA</h1>
          </div>
        </div>
        <Card className="p-6">
          <div className="text-center">
            <p className="text-foreground mb-4">
              Erro ao carregar dados: {error}
            </p>
            <Button variant="default" onClick={() => fetchAllInitialData()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    );
  }

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
            onClick={() => handleFastRefresh(activeTab, selectedDepartment)}
            className="h-10"
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing ? "A atualizar PHC..." : "Atualizar PHC"}
          </Button>
          <Button
            variant="default"
            onClick={generateFinancialReport}
            className="h-10"
          >
            <FileText className="h-4 w-4 mr-2" />
            Gerar Relatório
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2">
        <Button
          variant={mainTab === "visao-geral" ? "default" : "outline"}
          onClick={() => setMainTab("visao-geral")}
          className="h-10"
        >
          VISÃO GERAL
        </Button>
        <Button
          variant={mainTab === "centro-custo" ? "default" : "outline"}
          onClick={() => setMainTab("centro-custo")}
          className="h-10"
        >
          CENTRO CUSTO
        </Button>
        <Button
          variant={mainTab === "departamentos" ? "default" : "outline"}
          onClick={() => setMainTab("departamentos")}
          className="h-10"
        >
          DEPARTAMENTOS
        </Button>
        <Button
          variant={mainTab === "operacoes" ? "default" : "outline"}
          onClick={() => setMainTab("operacoes")}
          className="h-10"
        >
          OPERAÇÕES
        </Button>
      </div>

      {/* Period Tabs */}
      {mainTab !== "operacoes" && (
        <div className="flex gap-2">
          <Button
            variant={activeTab === "mtd" ? "default" : "outline"}
            onClick={() => setActiveTab("mtd")}
            className="h-10"
          >
            Mês Atual
          </Button>
          <Button
            variant={activeTab === "ytd" ? "default" : "outline"}
            onClick={() => setActiveTab("ytd")}
            className="h-10"
          >
            Ano Atual
          </Button>
        </div>
      )}

      {/* VISÃO GERAL TAB CONTENT */}
      {mainTab === "visao-geral" && (
        <OverviewTab
          activePeriodData={activePeriodData}
          activeTab={activeTab}
          multiYearRevenue={multiYearRevenue}
          multiYearChartData={multiYearChartData}
          topCustomers={topCustomers}
          sortedTopCustomers={sortedTopCustomers}
          handleTopSort={handleTopSort}
          topSortColumn={topSortColumn}
          topSortDirection={topSortDirection}
          companyConversao={companyConversao}
          sortedCompanyConversao={sortedCompanyConversao}
          companyConversaoTotals={companyConversaoTotals}
          handleCompanyConvSort={handleCompanyConvSort}
          companyConvSortColumn={companyConvSortColumn}
          companyConvSortDirection={companyConvSortDirection}
          currentYear={currentYear}
        />
      )}

      {/* CENTRO CUSTO TAB CONTENT */}
      {mainTab === "centro-custo" && (
        <CostCenterTab
          costCenterPerformance={costCenterPerformance}
          costCenterSales={costCenterSales}
          sortedCostCenterSales={sortedCostCenterSales}
          handleSalesSort={handleSalesSort}
          salesSortColumn={salesSortColumn}
          salesSortDirection={salesSortDirection}
          activeTab={activeTab}
          costCenterTopCustomers={costCenterTopCustomers}
          costCenterSelectionOptions={costCenterSelectionOptions}
          selectedCostCenter={selectedCostCenter}
          setSelectedCostCenter={setSelectedCostCenter}
          selectedCostCenterBlock={selectedCostCenterBlock}
          handleCcTopSort={handleCcTopSort}
          ccTopSortColumn={ccTopSortColumn}
          ccTopSortDirection={ccTopSortDirection}
          sortedCostCenterTopCustomers={sortedCostCenterTopCustomers}
          costCenterMultiYear={costCenterMultiYear}
          onCostCenterChartChange={handleCostCenterFilterChange}
          selectedCostCenterChartFilter={selectedCostCenterFilter}
        />
      )}

      {/* DEPARTAMENTOS TAB CONTENT */}
      {mainTab === "departamentos" && (
        <DepartmentsTab
          departmentView={departmentView}
          setDepartmentView={setDepartmentView}
          selectedDepartment={selectedDepartment}
          setSelectedDepartment={setSelectedDepartment}
          activeTab={activeTab}
          currentYear={currentYear}
          previousYear={previousYear}
          analiseTab={analiseTab}
          setAnaliseTab={setAnaliseTab}
          departmentKpiData={departmentKpiData}
          departmentClientes={departmentClientes}
          sortedDepartmentOrcamentos={sortedDepartmentOrcamentos}
          handleDeptOrcSort={handleDeptOrcSort}
          deptOrcSortColumn={deptOrcSortColumn}
          deptOrcSortDirection={deptOrcSortDirection}
          sortedDepartmentFaturas={sortedDepartmentFaturas}
          handleDeptFatSort={handleDeptFatSort}
          deptFatSortColumn={deptFatSortColumn}
          deptFatSortDirection={deptFatSortDirection}
          sortedDepartmentConversao={sortedDepartmentConversao}
          handleDeptConvSort={handleDeptConvSort}
          deptConvSortColumn={deptConvSortColumn}
          deptConvSortDirection={deptConvSortDirection}
          allDepartmentsKpi={allDepartmentsKpi}
          departmentChartData1={departmentChartData1}
          departmentChartData2={departmentChartData2}
          departmentChartData3={departmentChartData3}
          departmentChartData4={departmentChartData4}
          pipelineTab={pipelineTab}
          setPipelineTab={setPipelineTab}
          pipelineData={pipelineData}
          sortedTop15={sortedTop15}
          handleTop15Sort={handleTop15Sort}
          top15SortColumn={top15SortColumn}
          top15SortDirection={top15SortDirection}
          handleDismissOrcamento={handleDismissOrcamento}
          sortedAttention={sortedAttention}
          handleAttentionSort={handleAttentionSort}
          attentionSortColumn={attentionSortColumn}
          attentionSortDirection={attentionSortDirection}
          sortedPerdidos={sortedPerdidos}
          handlePerdidosSort={handlePerdidosSort}
          perdidosSortColumn={perdidosSortColumn}
          perdidosSortDirection={perdidosSortDirection}
        />
      )}

      {/* OPERAÇÕES TAB CONTENT */}
      {mainTab === "operacoes" && (
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl text-foreground">MÉTRICAS OPERACIONAIS</h2>
            <p className="text-muted-foreground">
              Conteúdo em desenvolvimento. Esta secção apresentará métricas e
              análises operacionais.
            </p>
          </div>
        </Card>
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

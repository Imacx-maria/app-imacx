import { useState, useRef, useCallback, useEffect } from "react";
import {
  KPIDashboardData,
  MonthlyRevenueResponse,
  TopCustomersResponse,
  MultiYearRevenueResponse,
  CostCenterPerformanceResponse,
  CostCenterTopCustomersResponse,
} from "@/types/financial-analysis";

// LocalStorage cache key and expiry (24 hours)
const CACHE_KEY = "financial-analysis-cache";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  timestamp: number;
  kpiData: KPIDashboardData | null;
  monthlyRevenue: MonthlyRevenueResponse | null;
  topCustomers: {
    mtd: TopCustomersResponse | null;
    ytd: TopCustomersResponse | null;
  };
  multiYearRevenue: MultiYearRevenueResponse | null;
  costCenterPerformance: {
    mtd: CostCenterPerformanceResponse | null;
    ytd: CostCenterPerformanceResponse | null;
  };
  costCenterSales: { mtd: any; ytd: any };
  costCenterTopCustomers: {
    mtd: CostCenterTopCustomersResponse | null;
    ytd: CostCenterTopCustomersResponse | null;
  };
  companyConversao: { mtd: any[]; ytd: any[] };
  departmentKpi: { [dept: string]: { mtd: any; ytd: any } };
  departmentAnalise: { mtd: any; ytd: any };
  departmentPipeline: { [dept: string]: { mtd: any; ytd: any } };
  costCenterMultiYear: any;
}

function loadFromLocalStorage(): CachedData | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CachedData;
    // Check if cache is expired
    if (Date.now() - parsed.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: CachedData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save to localStorage:", e);
  }
}

export function useFinancialData() {
  // Cache ref - will be populated after mount
  const cachedData = useRef<CachedData | null>(null);
  const hasHydrated = useRef(false);

  // Always start with loading=true for SSR consistency
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data states - all start empty, will be populated from cache after mount
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
  const [companyConversao, setCompanyConversao] = useState<any[]>([]);

  // Department data states
  const [departmentKpiData, setDepartmentKpiData] =
    useState<KPIDashboardData | null>(null);
  const [departmentOrcamentos, setDepartmentOrcamentos] = useState<any[]>([]);
  const [departmentFaturas, setDepartmentFaturas] = useState<any[]>([]);
  const [departmentConversao, setDepartmentConversao] = useState<any[]>([]);
  const [departmentClientes, setDepartmentClientes] = useState<any[]>([]);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [allDepartmentsKpi, setAllDepartmentsKpi] = useState<any>(null);

  // Initial Cost Center selection logic helper
  const [initialCostCenter, setInitialCostCenter] = useState<string | null>(
    null,
  );

  // Cost Center Multi-Year Revenue Chart data
  const [costCenterMultiYear, setCostCenterMultiYear] = useState<any>(null);
  const [selectedCostCenterFilter, setSelectedCostCenterFilter] =
    useState<string>("ID-Impressão Digital");

  // Cache
  const dataCache = useRef<{
    [key: string]: {
      timestamp: number;
      data: any;
    };
  }>({});

  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;

    const cached = loadFromLocalStorage();
    if (cached) {
      console.log("📦 [Cache] Loading data from localStorage");
      cachedData.current = cached;

      // Populate all state from cache
      setKpiData(cached.kpiData);
      setMonthlyRevenue(cached.monthlyRevenue);
      setTopCustomers(cached.topCustomers?.mtd || null);
      setMultiYearRevenue(cached.multiYearRevenue);
      setCostCenterPerformance(cached.costCenterPerformance?.mtd || null);
      setCostCenterSales(cached.costCenterSales?.mtd || null);
      setCostCenterTopCustomers(cached.costCenterTopCustomers?.mtd || null);
      setCompanyConversao(cached.companyConversao?.mtd || []);
      setDepartmentKpiData(cached.departmentKpi?.Brindes?.mtd || null);
      setDepartmentOrcamentos(cached.departmentAnalise?.mtd?.orcamentos || []);
      setDepartmentFaturas(cached.departmentAnalise?.mtd?.faturas || []);
      setDepartmentConversao(cached.departmentAnalise?.mtd?.conversao || []);
      setDepartmentClientes(cached.departmentAnalise?.mtd?.clientes || []);
      setPipelineData(cached.departmentPipeline?.Brindes?.mtd || null);
      setCostCenterMultiYear(cached.costCenterMultiYear);

      // Also populate the memory cache for tab switching
      dataCache.current = {
        kpi: { timestamp: cached.timestamp, data: cached.kpiData },
        monthlyRevenue: {
          timestamp: cached.timestamp,
          data: cached.monthlyRevenue,
        },
        topCustomers: {
          timestamp: cached.timestamp,
          data: cached.topCustomers,
        },
        multiYearRevenue: {
          timestamp: cached.timestamp,
          data: cached.multiYearRevenue,
        },
        companyConversao: {
          timestamp: cached.timestamp,
          data: cached.companyConversao,
        },
        costCenterPerformance: {
          timestamp: cached.timestamp,
          data: cached.costCenterPerformance,
        },
        costCenterSales: {
          timestamp: cached.timestamp,
          data: cached.costCenterSales,
        },
        costCenterTopCustomers: {
          timestamp: cached.timestamp,
          data: cached.costCenterTopCustomers,
        },
        departmentKpi: {
          timestamp: cached.timestamp,
          data: cached.departmentKpi,
        },
        departmentAnalise: {
          timestamp: cached.timestamp,
          data: cached.departmentAnalise,
        },
        departmentPipeline: {
          timestamp: cached.timestamp,
          data: cached.departmentPipeline,
        },
      };

      if (cached.costCenterTopCustomers?.mtd?.costCenters?.[0]) {
        setInitialCostCenter(
          cached.costCenterTopCustomers.mtd.costCenters[0].costCenter,
        );
      }

      setLoading(false);
    }
  }, []);

  // Fetch cost center multi-year revenue data
  const fetchCostCenterMultiYear = useCallback(async (costCenter: string) => {
    try {
      const response = await fetch(
        `/api/financial-analysis/cost-center-multi-year-revenue?costCenter=${encodeURIComponent(costCenter)}`,
      );
      if (response.ok) {
        const data = await response.json();
        setCostCenterMultiYear(data);
        return data;
      }
      return null;
    } catch (err) {
      console.error("Error fetching cost center multi-year revenue:", err);
      return null;
    }
  }, []);

  // Handle cost center filter change
  const handleCostCenterFilterChange = useCallback(
    async (costCenter: string) => {
      setSelectedCostCenterFilter(costCenter);
      await fetchCostCenterMultiYear(costCenter);
    },
    [fetchCostCenterMultiYear],
  );

  const fetchAllDepartmentsKpi = useCallback(async (period: "mtd" | "ytd") => {
    const departments = ["Brindes", "Digital", "IMACX"];

    try {
      const results = await Promise.all(
        departments.map((dept) =>
          fetch(
            `/api/gestao/departamentos/kpi?departamento=${encodeURIComponent(
              dept,
            )}&period=${period}`,
          )
            .then((res) => {
              if (!res.ok) {
                console.warn(`Failed to fetch KPI for ${dept}:`, res.status);
                return null;
              }
              return res.json();
            })
            .catch((err) => {
              console.error(`Error fetching KPI for ${dept}:`, err);
              return null;
            }),
        ),
      );

      return {
        Brindes: results[0],
        Digital: results[1],
        IMACX: results[2],
      };
    } catch (error) {
      console.error("Error fetching all departments KPI:", error);
      return null;
    }
  }, []);

  const fetchAllInitialData = useCallback(async (forceRefresh = false) => {
    // If we have cached data and not forcing refresh, skip fetching
    if (!forceRefresh && cachedData.current) {
      console.log("📦 [Cache] Using cached data, skipping API calls");
      setLoading(false);
      return;
    }

    console.log("🔄 [Initial Load] Fetching ALL tab data in parallel...");
    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        fetch("/api/financial-analysis/kpi-dashboard"),
        fetch("/api/financial-analysis/monthly-revenue"),
        fetch("/api/financial-analysis/top-customers?limit=20&period=mtd"),
        fetch("/api/financial-analysis/top-customers?limit=20&period=ytd"),
        fetch("/api/financial-analysis/multi-year-revenue"),
        fetch("/api/financial-analysis/conversion-rates?period=mtd"),
        fetch("/api/financial-analysis/conversion-rates?period=ytd"),
        fetch("/api/financial-analysis/cost-center-performance?period=mtd"),
        fetch("/api/financial-analysis/cost-center-performance?period=ytd"),
        fetch("/api/financial-analysis/cost-center-sales?period=mtd"),
        fetch("/api/financial-analysis/cost-center-sales?period=ytd"),
        fetch(
          "/api/financial-analysis/cost-center-top-customers?period=mtd&limit=20",
        ),
        fetch(
          "/api/financial-analysis/cost-center-top-customers?period=ytd&limit=20",
        ),
        fetch("/api/gestao/departamentos/kpi?departamento=Brindes&period=mtd"),
        fetch("/api/gestao/departamentos/kpi?departamento=Brindes&period=ytd"),
        fetch("/api/gestao/departamentos/kpi?departamento=Digital&period=mtd"),
        fetch("/api/gestao/departamentos/kpi?departamento=Digital&period=ytd"),
        fetch("/api/gestao/departamentos/kpi?departamento=IMACX&period=mtd"),
        fetch("/api/gestao/departamentos/kpi?departamento=IMACX&period=ytd"),
        fetch("/api/gestao/departamentos/analise?periodo=mensal"),
        fetch("/api/gestao/departamentos/analise?periodo=anual"),
        fetch(
          "/api/gestao/departamentos/pipeline?departamento=Brindes&periodo=mensal",
        ),
        fetch(
          "/api/gestao/departamentos/pipeline?departamento=Brindes&periodo=anual",
        ),
        fetch(
          "/api/gestao/departamentos/pipeline?departamento=Digital&periodo=mensal",
        ),
        fetch(
          "/api/gestao/departamentos/pipeline?departamento=Digital&periodo=anual",
        ),
        fetch(
          "/api/gestao/departamentos/pipeline?departamento=IMACX&periodo=mensal",
        ),
        fetch(
          "/api/gestao/departamentos/pipeline?departamento=IMACX&periodo=anual",
        ),
      ]);

      const extractJson = async (result: PromiseSettledResult<Response>) => {
        if (result.status === "fulfilled" && result.value.ok) {
          return await result.value.json();
        }
        return null;
      };

      const [
        kpiDataRes,
        monthlyRevData,
        topMtdData,
        topYtdData,
        multiYearData,
        convMtdData,
        convYtdData,
        ccPerfMtdData,
        ccPerfYtdData,
        ccSalesMtdData,
        ccSalesYtdData,
        ccTopMtdData,
        ccTopYtdData,
        brindesKpiMtdData,
        brindesKpiYtdData,
        digitalKpiMtdData,
        digitalKpiYtdData,
        imacxKpiMtdData,
        imacxKpiYtdData,
        analiseMtdData,
        analiseYtdData,
        brindesPipeMtdData,
        brindesPipeYtdData,
        digitalPipeMtdData,
        digitalPipeYtdData,
        imacxPipeMtdData,
        imacxPipeYtdData,
      ] = await Promise.all(results.map(extractJson));

      dataCache.current = {
        kpi: { timestamp: Date.now(), data: kpiDataRes },
        monthlyRevenue: { timestamp: Date.now(), data: monthlyRevData },
        topCustomers: {
          timestamp: Date.now(),
          data: { mtd: topMtdData, ytd: topYtdData },
        },
        multiYearRevenue: { timestamp: Date.now(), data: multiYearData },
        companyConversao: {
          timestamp: Date.now(),
          data: {
            mtd: convMtdData?.conversao || [],
            ytd: convYtdData?.conversao || [],
          },
        },
        costCenterPerformance: {
          timestamp: Date.now(),
          data: { mtd: ccPerfMtdData, ytd: ccPerfYtdData },
        },
        costCenterSales: {
          timestamp: Date.now(),
          data: { mtd: ccSalesMtdData, ytd: ccSalesYtdData },
        },
        costCenterTopCustomers: {
          timestamp: Date.now(),
          data: { mtd: ccTopMtdData, ytd: ccTopYtdData },
        },
        departmentKpi: {
          timestamp: Date.now(),
          data: {
            Brindes: { mtd: brindesKpiMtdData, ytd: brindesKpiYtdData },
            Digital: { mtd: digitalKpiMtdData, ytd: digitalKpiYtdData },
            IMACX: { mtd: imacxKpiMtdData, ytd: imacxKpiYtdData },
          },
        },
        departmentAnalise: {
          timestamp: Date.now(),
          data: { mtd: analiseMtdData, ytd: analiseYtdData },
        },
        departmentPipeline: {
          timestamp: Date.now(),
          data: {
            Brindes: { mtd: brindesPipeMtdData, ytd: brindesPipeYtdData },
            Digital: { mtd: digitalPipeMtdData, ytd: digitalPipeYtdData },
            IMACX: { mtd: imacxPipeMtdData, ytd: imacxPipeYtdData },
          },
        },
      };

      setKpiData(kpiDataRes);
      setMonthlyRevenue(monthlyRevData);
      setTopCustomers(topYtdData);
      setMultiYearRevenue(multiYearData);
      setCompanyConversao(convYtdData?.conversao || []);
      setCostCenterPerformance(ccPerfYtdData);
      setCostCenterSales(ccSalesYtdData);
      setCostCenterTopCustomers(ccTopYtdData);

      if (ccTopYtdData?.costCenters?.[0]) {
        setInitialCostCenter(ccTopYtdData.costCenters[0].costCenter);
      }

      setDepartmentKpiData(brindesKpiYtdData);
      setDepartmentOrcamentos(analiseYtdData?.orcamentos || []);
      setDepartmentFaturas(analiseYtdData?.faturas || []);
      setDepartmentConversao(analiseYtdData?.conversao || []);
      setDepartmentClientes(analiseYtdData?.clientes || []);
      setPipelineData(brindesPipeYtdData);

      // Fetch cost center multi-year data with default filter
      let ccMultiYearData = null;
      try {
        const ccMultiYearResp = await fetch(
          `/api/financial-analysis/cost-center-multi-year-revenue?costCenter=${encodeURIComponent("ID-Impressão Digital")}`,
        );
        if (ccMultiYearResp.ok) {
          ccMultiYearData = await ccMultiYearResp.json();
          setCostCenterMultiYear(ccMultiYearData);
          console.log(
            "✅ [Initial Load] Cost center multi-year data loaded:",
            ccMultiYearData?.series?.length,
            "series",
          );
        }
      } catch (ccErr) {
        console.error("Error fetching cost center multi-year:", ccErr);
      }

      // Save to localStorage for instant loading next time
      const cacheToSave: CachedData = {
        timestamp: Date.now(),
        kpiData: kpiDataRes,
        monthlyRevenue: monthlyRevData,
        topCustomers: { mtd: topMtdData, ytd: topYtdData },
        multiYearRevenue: multiYearData,
        costCenterPerformance: { mtd: ccPerfMtdData, ytd: ccPerfYtdData },
        costCenterSales: { mtd: ccSalesMtdData, ytd: ccSalesYtdData },
        costCenterTopCustomers: { mtd: ccTopMtdData, ytd: ccTopYtdData },
        companyConversao: {
          mtd: convMtdData?.conversao || [],
          ytd: convYtdData?.conversao || [],
        },
        departmentKpi: {
          Brindes: { mtd: brindesKpiMtdData, ytd: brindesKpiYtdData },
          Digital: { mtd: digitalKpiMtdData, ytd: digitalKpiYtdData },
          IMACX: { mtd: imacxKpiMtdData, ytd: imacxKpiYtdData },
        },
        departmentAnalise: { mtd: analiseMtdData, ytd: analiseYtdData },
        departmentPipeline: {
          Brindes: { mtd: brindesPipeMtdData, ytd: brindesPipeYtdData },
          Digital: { mtd: digitalPipeMtdData, ytd: digitalPipeYtdData },
          IMACX: { mtd: imacxPipeMtdData, ytd: imacxPipeYtdData },
        },
        costCenterMultiYear: ccMultiYearData,
      };
      saveToLocalStorage(cacheToSave);
      cachedData.current = cacheToSave;

      console.log("✅ [Initial Load] All data fetched and cached!");
    } catch (err) {
      console.error("❌ [Initial Load] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncStateFromCache = useCallback(
    (tab: "mtd" | "ytd" | "qtd", dept: "Brindes" | "Digital" | "IMACX") => {
      const cache = dataCache.current;
      const effectiveTab = tab === "qtd" ? "ytd" : tab;

      if (cache.topCustomers?.data) {
        setTopCustomers(cache.topCustomers.data[effectiveTab] || null);
      }
      if (cache.companyConversao?.data) {
        setCompanyConversao(cache.companyConversao.data[effectiveTab] || []);
      }
      if (cache.costCenterPerformance?.data) {
        setCostCenterPerformance(
          cache.costCenterPerformance.data[effectiveTab] || null,
        );
      }
      if (cache.costCenterSales?.data) {
        setCostCenterSales(cache.costCenterSales.data[effectiveTab] || null);
      }
      if (cache.costCenterTopCustomers?.data) {
        setCostCenterTopCustomers(
          cache.costCenterTopCustomers.data[effectiveTab] || null,
        );
      }
      if (cache.departmentKpi?.data?.[dept]) {
        setDepartmentKpiData(
          cache.departmentKpi.data[dept][effectiveTab] || null,
        );
      }
      if (cache.departmentAnalise?.data) {
        const analiseData = cache.departmentAnalise.data[effectiveTab];
        setDepartmentOrcamentos(analiseData?.orcamentos || []);
        setDepartmentFaturas(analiseData?.faturas || []);
        setDepartmentConversao(analiseData?.conversao || []);
        setDepartmentClientes(analiseData?.clientes || []);
      }
      if (cache.departmentPipeline?.data?.[dept]) {
        setPipelineData(
          cache.departmentPipeline.data[dept][effectiveTab] || null,
        );
      }
    },
    [],
  );

  const handleFastRefresh = useCallback(
    async (
      activeTab: "mtd" | "ytd" | "qtd",
      selectedDepartment: "Brindes" | "Digital" | "IMACX",
    ) => {
      setIsRefreshing(true);
      try {
        console.log("🗑️ [Refresh] Clearing cache and refreshing data...");
        // Clear both memory and localStorage cache
        dataCache.current = {};
        cachedData.current = null;
        if (typeof window !== "undefined") {
          localStorage.removeItem(CACHE_KEY);
        }

        const resp = await fetch("/api/etl/incremental", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "fast_all" }),
        });

        if (!resp.ok) {
          const details = await resp.json().catch(() => ({}));
          const message =
            (details && (details.message || details.error)) ||
            "Erro ao correr a atualizacao rapida do PHC.";
          throw new Error(message);
        }

        // Force refresh - ignore cache
        await fetchAllInitialData(true);
        syncStateFromCache(activeTab, selectedDepartment);
      } catch (err) {
        console.error("Erro ao executar atualizacao rapida do PHC:", err);
        alert(
          "Falha ao atualizar rapidamente o PHC (run_fast_all_tables_sync). Verifica a configuracao do ETL e tenta novamente.",
        );
      } finally {
        setIsRefreshing(false);
      }
    },
    [fetchAllInitialData, syncStateFromCache],
  );

  const handleDismissOrcamento = useCallback(
    async (orcamentoNumber: string, currentState: boolean) => {
      const newState = !currentState;
      const action = newState ? "inativar" : "reativar";

      if (!confirm(`Deseja ${action} este orçamento?`)) {
        return;
      }

      try {
        const response = await fetch(
          "/api/gestao/departamentos/dismiss-orcamento",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orcamento_number: orcamentoNumber,
              is_dismissed: newState,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update orcamento");
        }

        setPipelineData((prev: any) => {
          if (!prev) return prev;
          const updateOrcamentos = (orcamentos: any[]) =>
            orcamentos.map((orc) =>
              orc.orcamento_id_humano === orcamentoNumber
                ? { ...orc, is_dismissed: newState }
                : orc,
            );

          return {
            ...prev,
            top15: prev.top15 ? updateOrcamentos(prev.top15) : [],
            needsAttention: prev.needsAttention
              ? updateOrcamentos(prev.needsAttention)
              : [],
            perdidos: prev.perdidos ? updateOrcamentos(prev.perdidos) : [],
          };
        });
      } catch (err) {
        console.error("Error dismissing orcamento:", err);
        alert("Falha ao atualizar o orçamento. Tenta novamente.");
      }
    },
    [],
  );

  return {
    loading,
    setLoading,
    error,
    setError,
    isRefreshing,
    setIsRefreshing,
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
    setPipelineData,
    allDepartmentsKpi,
    setAllDepartmentsKpi,
    initialCostCenter,
    dataCache,
    fetchAllInitialData,
    fetchAllDepartmentsKpi,
    syncStateFromCache,
    handleFastRefresh,
    handleDismissOrcamento,
    // Cost Center Multi-Year Chart
    costCenterMultiYear,
    selectedCostCenterFilter,
    handleCostCenterFilterChange,
  };
}

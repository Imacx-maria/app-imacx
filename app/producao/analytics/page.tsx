"use client";

/**
 * Production Analytics Dashboard
 *
 * Performance metrics and insights for production workflow
 * - Job completion times and rates
 * - Complexity and value distribution
 * - Designer lead time tracking
 * - Bottleneck identification
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImacxBarChart } from "@/components/charts/imacx-bar-chart";
import { ImacxKpiCard } from "@/components/charts/imacx-kpi-card";
import { ImacxSortableTable } from "@/components/charts/imacx-sortable-table";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import type {
  ProductionKPIs,
  CycleTimeRow,
  ComplexityDistribution,
  ValueDistribution,
  DesignerLeadTime,
  BottleneckJob,
  PeriodType,
  ChartDataPoint,
} from "./types";

export default function ProductionAnalyticsPage() {
  // Period selection
  const [activeTab, setActiveTab] = useState<PeriodType>("ytd");

  // Data state
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<ProductionKPIs | null>(null);
  const [cycleTimeData, setCycleTimeData] = useState<CycleTimeRow[]>([]);
  const [cycleTimeByComplexity, setCycleTimeByComplexity] = useState<
    CycleTimeRow[]
  >([]);
  const [cycleTimeByValue, setCycleTimeByValue] = useState<CycleTimeRow[]>([]);
  const [complexityData, setComplexityData] = useState<
    ComplexityDistribution[]
  >([]);
  const [valueData, setValueData] = useState<ValueDistribution[]>([]);
  const [designerLeadData, setDesignerLeadData] = useState<DesignerLeadTime[]>(
    [],
  );
  const [bottleneckData, setBottleneckData] = useState<BottleneckJob[]>([]);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel fetch all endpoints for better performance
      const [
        kpiRes,
        cycleTimeRes,
        cycleTimeComplexityRes,
        cycleTimeValueRes,
        complexityRes,
        valueRes,
        designerLeadRes,
        bottleneckRes,
      ] = await Promise.all([
        fetch(`/api/production-analytics/kpi?period=${activeTab}`),
        fetch(
          `/api/production-analytics/cycle-times?period=${activeTab}&group_by=time_range`,
        ),
        fetch(
          `/api/production-analytics/cycle-times?period=${activeTab}&group_by=complexity`,
        ),
        fetch(
          `/api/production-analytics/cycle-times?period=${activeTab}&group_by=value_bracket`,
        ),
        fetch(`/api/production-analytics/complexity?period=${activeTab}`),
        fetch(`/api/production-analytics/value?period=${activeTab}`),
        fetch(
          `/api/production-analytics/designer-lead?period=${activeTab}&group_by=complexity`,
        ),
        fetch(`/api/production-analytics/bottlenecks?days_threshold=10`),
      ]);

      const kpi = await kpiRes.json();
      const cycleTime = await cycleTimeRes.json();
      const cycleTimeComplexity = await cycleTimeComplexityRes.json();
      const cycleTimeValue = await cycleTimeValueRes.json();
      const complexity = await complexityRes.json();
      const value = await valueRes.json();
      const designerLead = await designerLeadRes.json();
      const bottleneck = await bottleneckRes.json();

      setKpiData(kpi);
      setCycleTimeData(cycleTime.data || []);
      setCycleTimeByComplexity(cycleTimeComplexity.data || []);
      setCycleTimeByValue(cycleTimeValue.data || []);
      setComplexityData(complexity.data || []);
      setValueData(value.data || []);
      setDesignerLeadData(designerLead.data || []);
      setBottleneckData(bottleneck.data || []);
    } catch (error) {
      console.error("Error fetching production analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Transform cycle time data for time range chart
  const cycleTimeChartData = useMemo(() => {
    // Define proper order for ranges
    const rangeOrder: Record<string, number> = {
      "1-7 DIAS": 1,
      "8-14 DIAS": 2,
      "15-30 DIAS": 3,
      "31-60 DIAS": 4,
      "60+ DIAS": 5,
    };

    return cycleTimeData
      .map((row) => ({
        range: row.grouping_key,
        "Nº Jobs": row.job_count,
        order: rangeOrder[row.grouping_key] || 999,
      }))
      .sort((a, b) => a.order - b.order);
  }, [cycleTimeData]);

  // Transform complexity data for chart
  const complexityChartData = useMemo(() => {
    // Define complexity order (project types)
    const complexityOrder: Record<string, number> = {
      STANDARD: 1,
      ESPECIAL: 2,
      VINIL: 3,
      PROTÓTIPO: 4,
      "EXPOSITOR REPETIÇÃO": 5,
      "EXPOSITOR NOVO": 6,
      OFFSET: 7,
      "SEM COMPLEXIDADE": 999,
    };

    return complexityData
      .map((row) => ({
        complexidade: row.complexidade,
        "Nº Jobs": row.job_count,
        "Dias Médios": row.avg_completion_days || 0,
        order: complexityOrder[row.complexidade?.toUpperCase() || ""] || 999,
      }))
      .sort((a, b) => a.order - b.order);
  }, [complexityData]);

  // Transform cycle time by complexity for chart
  const cycleTimeComplexityChartData = useMemo(() => {
    // Define complexity order (project types)
    const complexityOrder: Record<string, number> = {
      STANDARD: 1,
      ESPECIAL: 2,
      VINIL: 3,
      PROTÓTIPO: 4,
      "EXPOSITOR REPETIÇÃO": 5,
      "EXPOSITOR NOVO": 6,
      OFFSET: 7,
      "SEM COMPLEXIDADE": 999,
    };

    return cycleTimeByComplexity
      .map((row) => ({
        complexidade: row.grouping_key,
        "Dias Médios": row.avg_days,
        "Nº Jobs": row.job_count,
        order: complexityOrder[row.grouping_key.toUpperCase()] || 999,
      }))
      .sort((a, b) => a.order - b.order);
  }, [cycleTimeByComplexity]);

  // Transform value data for chart
  const valueChartData = useMemo(() => {
    return valueData
      .map((row) => ({
        bracket: row.value_bracket,
        "Nº Jobs": row.job_count,
        "Valor Total": row.total_value / 1000, // Convert to thousands
      }))
      .sort((a, b) => b["Valor Total"] - a["Valor Total"]); // Sort by total value descending
  }, [valueData]);

  // Transform designer lead time data
  const designerLeadChartData = useMemo(() => {
    // Define complexity order (project types)
    const complexityOrder: Record<string, number> = {
      STANDARD: 1,
      ESPECIAL: 2,
      VINIL: 3,
      PROTÓTIPO: 4,
      "EXPOSITOR REPETIÇÃO": 5,
      "EXPOSITOR NOVO": 6,
      OFFSET: 7,
      "SEM COMPLEXIDADE": 999,
    };

    return designerLeadData
      .map((row) => ({
        complexidade: row.grouping_key,
        "Dias até 1ª Maquete": row.avg_days_to_first_mockup,
        "Nº Jobs": row.job_count,
        order: complexityOrder[row.grouping_key?.toUpperCase()?.trim()] || 999,
      }))
      .sort((a, b) => a.order - b.order);
  }, [designerLeadData]);

  // Bottleneck table columns
  const bottleneckColumns = [
    { key: "numero_fo", header: "FO", sortable: true },
    { key: "numero_orc", header: "ORC", sortable: true },
    { key: "nome_campanha", header: "Campanha", sortable: true },
    { key: "cliente", header: "Cliente", sortable: true },
    {
      key: "days_in_production",
      header: "Dias",
      align: "right" as const,
      sortable: true,
    },
    {
      key: "job_value",
      header: "Valor",
      align: "right" as const,
      sortable: true,
      format: (value: number) => `€${value.toLocaleString("pt-PT")}`,
    },
    { key: "missing_data", header: "Estado", sortable: true },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/producao">
              <Button variant="ghost" size="sm">
                ← VOLTAR
              </Button>
            </Link>
            <h1 className="text-2xl">ANÁLISE DE PRODUÇÃO</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 uppercase">
            Métricas e indicadores de desempenho de produção
          </p>
        </div>
        <Button onClick={fetchAllData} disabled={loading} variant="outline">
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          ATUALIZAR
        </Button>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "mtd" ? "default" : "outline"}
          onClick={() => setActiveTab("mtd")}
          disabled={loading}
        >
          MÊS ATUAL
        </Button>
        <Button
          variant={activeTab === "ytd" ? "default" : "outline"}
          onClick={() => setActiveTab("ytd")}
          disabled={loading}
        >
          ANO ATUAL
        </Button>
      </div>

      {loading && !kpiData ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ImacxKpiCard
              label="JOBS INICIADOS"
              value={kpiData?.total_jobs || 0}
              changeLabel={`${kpiData?.jobs_without_logistics || 0} sem logística`}
            />
            <ImacxKpiCard
              label="JOBS CONCLUÍDOS"
              value={kpiData?.completed_jobs || 0}
              changeLabel={`${kpiData?.completion_rate?.toFixed(1) || "0.0"}% concluídos`}
            />
            <ImacxKpiCard
              label="TEMPO MÉDIO (DIAS)"
              value={kpiData?.avg_cycle_days?.toFixed(1) || "0.0"}
              changeLabel="Entrada → Conclusão"
            />
            <ImacxKpiCard
              label="VALOR CONCLUÍDO"
              value={`€${Math.round((kpiData?.total_value_completed || 0) / 1000)}K`}
              changeLabel={`${kpiData?.jobs_without_value || 0} sem valor`}
            />
          </div>

          {/* Cycle Time Distribution */}
          <Card className="imx-border p-6">
            <h3 className="text-lg mb-4">
              DISTRIBUIÇÃO POR TEMPO DE CONCLUSÃO
            </h3>
            <p className="text-xs text-muted-foreground mb-4 uppercase">
              Número de jobs por intervalo de tempo (entrada → conclusão)
            </p>
            <ImacxBarChart
              data={cycleTimeChartData}
              dataKey="Nº Jobs"
              xAxisKey="range"
              height={500}
            />
          </Card>

          {/* Complexity and Value Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="imx-border p-6">
              <h3 className="text-lg mb-4">DISTRIBUIÇÃO POR COMPLEXIDADE</h3>
              <p className="text-xs text-muted-foreground mb-4 uppercase">
                Jobs por nível de complexidade
              </p>
              <ImacxBarChart
                data={complexityChartData}
                dataKey="Nº Jobs"
                xAxisKey="complexidade"
                height={400}
              />
            </Card>

            <Card className="imx-border p-6">
              <h3 className="text-lg mb-4">DISTRIBUIÇÃO POR VALOR</h3>
              <p className="text-xs text-muted-foreground mb-4 uppercase">
                Jobs por faixa de valor (€K)
              </p>
              <ImacxBarChart
                data={valueChartData}
                dataKey={["Nº Jobs", "Valor Total"]}
                xAxisKey="bracket"
                height={400}
              />
            </Card>
          </div>

          {/* Cycle Time Analysis Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="imx-border p-6">
              <h3 className="text-lg mb-4">TEMPO MÉDIO POR COMPLEXIDADE</h3>
              <p className="text-xs text-muted-foreground mb-4 uppercase">
                Dias médios de conclusão por nível
              </p>
              <ImacxBarChart
                data={cycleTimeComplexityChartData}
                dataKey="Dias Médios"
                xAxisKey="complexidade"
                height={400}
              />
            </Card>

            <Card className="imx-border p-6">
              <h3 className="text-lg mb-4">TEMPO ATÉ 1ª MAQUETE</h3>
              <p className="text-xs text-muted-foreground mb-4 uppercase">
                Dias médios até primeiro envio de design
              </p>
              <ImacxBarChart
                data={designerLeadChartData}
                dataKey="Dias até 1ª Maquete"
                xAxisKey="complexidade"
                height={400}
              />
            </Card>
          </div>

          {/* Bottleneck Table */}
          <Card className="imx-border p-6">
            <h3 className="text-lg mb-4">JOBS EM BOTTLENECK (&gt;10 DIAS)</h3>
            <p className="text-xs text-muted-foreground mb-4 uppercase">
              {bottleneckData.length} jobs sem conclusão há mais de 10 dias
            </p>
            <ImacxSortableTable
              data={bottleneckData}
              columns={bottleneckColumns}
              defaultSortColumn="days_in_production"
              defaultSortDirection="desc"
            />
          </Card>
        </>
      )}
    </div>
  );
}

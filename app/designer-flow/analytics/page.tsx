"use client";

/**
 * Designer Analytics Dashboard
 *
 * Performance metrics and insights for designer workflow
 * - Work distribution by complexity and designer
 * - Cycle time analysis
 * - Approval cycles and revision tracking
 * - Bottleneck identification
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImacxBarChart } from "@/components/charts/imacx-bar-chart";
import { ImacxLineChart } from "@/components/charts/imacx-line-chart";
import { ImacxKpiCard } from "@/components/charts/imacx-kpi-card";
import { ImacxTable } from "@/components/charts/imacx-table";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import type {
  DesignerKPIs,
  ComplexityDistributionRow,
  CycleTimeRow,
  WorkloadRow,
  RevisionMetrics,
  BottleneckItem,
  ApprovalCycleMetrics,
  PeriodType,
  ChartDataPoint,
} from "./types";

export default function DesignerAnalyticsPage() {
  // Period selection
  const [activeTab, setActiveTab] = useState<PeriodType>("ytd");

  // Data state
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<DesignerKPIs | null>(null);
  const [complexityData, setComplexityData] = useState<
    ComplexityDistributionRow[]
  >([]);
  const [cycleTimeData, setCycleTimeData] = useState<CycleTimeRow[]>([]);
  const [cycleTimeByComplexity, setCycleTimeByComplexity] = useState<
    CycleTimeRow[]
  >([]);
  const [workloadData, setWorkloadData] = useState<WorkloadRow[]>([]);
  const [revisionData, setRevisionData] = useState<RevisionMetrics | null>(
    null,
  );
  const [bottleneckData, setBottleneckData] = useState<BottleneckItem[]>([]);
  const [approvalMetrics, setApprovalMetrics] =
    useState<ApprovalCycleMetrics | null>(null);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel fetch all endpoints for better performance
      const [
        kpiRes,
        complexityRes,
        cycleTimeRes,
        cycleTimeComplexityRes,
        workloadRes,
        revisionRes,
        bottleneckRes,
        approvalRes,
      ] = await Promise.all([
        fetch(`/api/designer-analytics/kpi?period=${activeTab}`),
        fetch(`/api/designer-analytics/complexity?period=${activeTab}`),
        fetch(
          `/api/designer-analytics/cycle-times?period=${activeTab}&group_by=month`,
        ),
        fetch(
          `/api/designer-analytics/cycle-times?period=${activeTab}&group_by=complexity`,
        ),
        fetch(`/api/designer-analytics/workload?period=${activeTab}`),
        fetch(`/api/designer-analytics/revisions?period=${activeTab}`),
        fetch(`/api/designer-analytics/bottlenecks?days_threshold=7`),
        fetch(`/api/designer-analytics/approval-cycles?period=${activeTab}`),
      ]);

      const kpi = await kpiRes.json();
      const complexity = await complexityRes.json();
      const cycleTime = await cycleTimeRes.json();
      const cycleTimeComplexity = await cycleTimeComplexityRes.json();
      const workload = await workloadRes.json();
      const revision = await revisionRes.json();
      const bottleneck = await bottleneckRes.json();
      const approval = await approvalRes.json();

      setKpiData(kpi);
      setComplexityData(complexity.data || []);
      setCycleTimeData(cycleTime.data || []);
      setCycleTimeByComplexity(cycleTimeComplexity.data || []);
      setWorkloadData(workload.data || []);
      setRevisionData(revision.data);
      setBottleneckData(bottleneck.data || []);
      setApprovalMetrics(approval.data);
    } catch (error) {
      console.error("Error fetching designer analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Transform complexity data for Chart 1: By Complexity (stacked by designer)
  const complexityByComplexityData = useMemo(() => {
    if (!complexityData.length) return [];

    // Group by complexity, with designers as columns
    const grouped = complexityData.reduce((acc, row) => {
      const existing = acc.find(
        (item: any) => item.complexidade === row.complexidade,
      );
      if (existing) {
        existing[row.designer] = row.item_count;
      } else {
        acc.push({
          complexidade: row.complexidade,
          [row.designer]: row.item_count,
        });
      }
      return acc;
    }, [] as ChartDataPoint[]);

    return grouped;
  }, [complexityData]);

  // Get unique designer names for Chart 1
  const designerNames = useMemo(() => {
    const names = new Set<string>();
    complexityData.forEach((row) => names.add(row.designer));
    return Array.from(names);
  }, [complexityData]);

  // Transform complexity data for Chart 2: By Designer (stacked by complexity)
  const complexityByDesignerData = useMemo(() => {
    if (!complexityData.length) return [];

    // Group by designer, with complexities as columns
    const grouped = complexityData.reduce((acc, row) => {
      const existing = acc.find((item: any) => item.designer === row.designer);
      if (existing) {
        existing[row.complexidade] = row.item_count;
      } else {
        acc.push({
          designer: row.designer,
          [row.complexidade]: row.item_count,
        });
      }
      return acc;
    }, [] as ChartDataPoint[]);

    return grouped;
  }, [complexityData]);

  // Get unique complexity levels for Chart 2
  const complexityLevels = useMemo(() => {
    const levels = new Set<string>();
    complexityData.forEach((row) => levels.add(row.complexidade));
    return Array.from(levels);
  }, [complexityData]);

  // Transform cycle time data for Chart 3
  const cycleTimeChartData = useMemo(() => {
    return cycleTimeData.map((row) => ({
      month: row.grouping_key,
      "Entrada → Saída": row.avg_days_entrada_saida,
      "Entrada → Paginação": row.avg_days_entrada_paginacao || 0,
    }));
  }, [cycleTimeData]);

  // Transform cycle time by complexity for Chart 4
  const cycleTimeComplexityChartData = useMemo(() => {
    return cycleTimeByComplexity.map((row) => ({
      complexidade: row.grouping_key,
      "Dias Médios": row.avg_days_entrada_saida,
      "Itens Concluídos": row.completed_items,
    }));
  }, [cycleTimeByComplexity]);

  // Transform approval cycles for chart
  const approvalCyclesChartData = useMemo(() => {
    if (!approvalMetrics) return [];

    return [
      { cycles: "1 Ciclo", count: approvalMetrics.items_with_1_cycle },
      { cycles: "2 Ciclos", count: approvalMetrics.items_with_2_cycles },
      { cycles: "3 Ciclos", count: approvalMetrics.items_with_3_cycles },
      { cycles: "4 Ciclos", count: approvalMetrics.items_with_4_cycles },
      { cycles: "5 Ciclos", count: approvalMetrics.items_with_5_cycles },
      { cycles: "6 Ciclos", count: approvalMetrics.items_with_6_cycles },
    ];
  }, [approvalMetrics]);

  // Transform workload data for line chart
  const workloadChartData = useMemo(() => {
    if (!workloadData.length) return [];

    // Group by month, with designers as separate lines
    const grouped = workloadData.reduce((acc, row) => {
      const existing = acc.find((item: any) => item.month === row.month);
      if (existing) {
        existing[row.designer] = row.completed_items;
      } else {
        acc.push({
          month: row.month,
          [row.designer]: row.completed_items,
        });
      }
      return acc;
    }, [] as ChartDataPoint[]);

    return grouped;
  }, [workloadData]);

  // Get unique designers for workload chart
  const workloadDesigners = useMemo(() => {
    const designers = new Set<string>();
    workloadData.forEach((row) => designers.add(row.designer));
    return Array.from(designers);
  }, [workloadData]);

  // Bottleneck table columns
  const bottleneckColumns = [
    { key: "numero_fo", header: "FO" },
    { key: "nome_campanha", header: "Campanha" },
    { key: "descricao", header: "Item" },
    { key: "designer", header: "Designer" },
    { key: "current_stage", header: "Estado" },
    { key: "days_in_stage", header: "Dias", align: "right" as const },
    { key: "complexidade", header: "Complexidade" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/designer-flow">
              <Button variant="ghost" size="sm">
                ← VOLTAR
              </Button>
            </Link>
            <h1 className="text-2xl">ANÁLISE DE DESEMPENHO - DESIGNERS</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 uppercase">
            Métricas e indicadores de produtividade
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
              label="ITENS CONCLUÍDOS"
              value={kpiData?.completed_items || 0}
              changeLabel={`${kpiData?.total_items || 0} total`}
            />
            <ImacxKpiCard
              label="TEMPO MÉDIO (DIAS)"
              value={kpiData?.avg_cycle_days?.toFixed(1) || "0.0"}
              changeLabel="Entrada → Saída"
            />
            <ImacxKpiCard
              label="TAXA 1ª APROVAÇÃO"
              value={`${kpiData?.first_time_approval_rate?.toFixed(1) || "0.0"}%`}
              changeLabel="Aprovados no 1º envio"
            />
            <ImacxKpiCard
              label="TAXA DE REVISÃO"
              value={`${kpiData?.revision_rate?.toFixed(1) || "0.0"}%`}
              changeLabel={`${kpiData?.bottleneck_items || 0} bloqueados`}
            />
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="imx-border p-6">
              <h3 className="text-lg mb-4">TRABALHOS POR COMPLEXIDADE</h3>
              <p className="text-xs text-muted-foreground mb-4 uppercase">
                Distribuição por nível de complexidade (designers empilhados)
              </p>
              <ImacxBarChart
                data={complexityByComplexityData}
                dataKey={designerNames}
                xAxisKey="complexidade"
                height={350}
              />
            </Card>

            <Card className="imx-border p-6">
              <h3 className="text-lg mb-4">TRABALHOS POR DESIGNER</h3>
              <p className="text-xs text-muted-foreground mb-4 uppercase">
                Distribuição por designer (complexidade empilhada)
              </p>
              <ImacxBarChart
                data={complexityByDesignerData}
                dataKey={complexityLevels}
                xAxisKey="designer"
                height={350}
              />
            </Card>
          </div>

          {/* Cycle Time Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="imx-border p-6">
              <h3 className="text-lg mb-4">TEMPO MÉDIO DE CICLO</h3>
              <p className="text-xs text-muted-foreground mb-4 uppercase">
                Evolução mensal dos tempos de processamento
              </p>
              <ImacxBarChart
                data={cycleTimeChartData}
                dataKey={["Entrada → Saída", "Entrada → Paginação"]}
                xAxisKey="month"
                height={350}
              />
            </Card>

            <Card className="imx-border p-6">
              <h3 className="text-lg mb-4">TEMPO MÉDIO POR COMPLEXIDADE</h3>
              <p className="text-xs text-muted-foreground mb-4 uppercase">
                Dias médios de processamento por nível
              </p>
              <ImacxBarChart
                data={cycleTimeComplexityChartData}
                dataKey="Dias Médios"
                xAxisKey="complexidade"
                height={350}
              />
            </Card>
          </div>

          {/* Approval Cycles */}
          <Card className="imx-border p-6">
            <h3 className="text-lg mb-4">CICLOS DE APROVAÇÃO</h3>
            <p className="text-xs text-muted-foreground mb-4 uppercase">
              Distribuição de iterações (M1→A1 até M6→A6)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="imx-border p-4">
                <p className="text-xs text-muted-foreground uppercase">
                  Ciclos Médios
                </p>
                <p className="text-2xl">
                  {approvalMetrics?.avg_cycles?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div className="imx-border p-4">
                <p className="text-xs text-muted-foreground uppercase">
                  Taxa 1ª Aprovação
                </p>
                <p className="text-2xl">
                  {approvalMetrics?.first_time_approval_rate?.toFixed(1) ||
                    "0.0"}
                  %
                </p>
              </div>
              <div className="imx-border p-4">
                <p className="text-xs text-muted-foreground uppercase">
                  Total Itens
                </p>
                <p className="text-2xl">{approvalMetrics?.total_items || 0}</p>
              </div>
            </div>
            <ImacxBarChart
              data={approvalCyclesChartData}
              dataKey="count"
              xAxisKey="cycles"
              height={300}
            />
          </Card>

          {/* Workload Over Time */}
          <Card className="imx-border p-6">
            <h3 className="text-lg mb-4">ITENS CONCLUÍDOS AO LONGO DO TEMPO</h3>
            <p className="text-xs text-muted-foreground mb-4 uppercase">
              Produtividade mensal por designer
            </p>
            <ImacxLineChart
              data={workloadChartData}
              lines={workloadDesigners.map((designer) => ({
                dataKey: designer,
              }))}
              xAxisKey="month"
              height={350}
            />
          </Card>

          {/* Bottleneck Table */}
          <Card className="imx-border p-6">
            <h3 className="text-lg mb-4">ITENS EM BOTTLENECK (&gt;7 DIAS)</h3>
            <p className="text-xs text-muted-foreground mb-4 uppercase">
              {bottleneckData.length} itens sem progresso há mais de 7 dias
            </p>
            <ImacxTable data={bottleneckData} columns={bottleneckColumns} />
          </Card>
        </>
      )}
    </div>
  );
}

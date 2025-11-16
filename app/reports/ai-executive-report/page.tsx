"use client";

import { useEffect, useState } from "react";
import {
  ImacxBarChart,
  ImacxLineChart,
  ImacxKpiCard,
  ImacxTable,
} from "@/components/charts";
import type { ColumnConfig } from "@/components/charts/imacx-table";

interface AIAnalysis {
  executiveSummary: string;
  keyInsights: string[];
  opportunities: string[];
  risks: string[];
  recommendations: string[];
}

interface KPIData {
  vendas_mtd?: number;
  vendas_ytd?: number;
  vendas_ytd_var_pct?: number;
  num_clientes?: number;
  num_faturas_ytd?: number;
  ticket_medio?: number;
  margem_media?: number;
  [key: string]: any; // Allow any additional fields
}

interface MonthlyData {
  mes: string;
  vendas: number;
  num_faturas: number;
  margem_pct?: number;
}

interface CustomerData {
  nome: string;
  total_vendas: number;
  num_faturas: number;
}

export default function AIExecutiveReportPage() {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyData[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerData[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);

  useEffect(() => {
    fetchFinancialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch KPI Dashboard data
      const kpiResponse = await fetch("/api/financial-analysis/kpi-dashboard");
      const kpiResult = await kpiResponse.json();

      // Fetch Monthly Revenue data
      const monthlyResponse = await fetch(
        "/api/financial-analysis/monthly-revenue",
      );
      const monthlyResult = await monthlyResponse.json();

      // Fetch Top Customers data
      const customersResponse = await fetch(
        "/api/financial-analysis/top-customers",
      );
      const customersResult = await customersResponse.json();

      // Set the fetched data
      setKpiData(kpiResult);
      setMonthlyRevenue(monthlyResult.monthlyData || monthlyResult || []);
      setTopCustomers(customersResult.topCustomers || customersResult || []);

      setLoading(false);

      // Trigger AI analysis
      await generateAIAnalysis(
        kpiResult,
        monthlyResult.monthlyData || monthlyResult || [],
        customersResult.topCustomers || customersResult || [],
      );
    } catch (err) {
      console.error("Error fetching financial data:", err);
      setError("Failed to fetch financial data");
      setLoading(false);
    }
  };

  const generateAIAnalysis = async (
    kpi: KPIData,
    monthly: MonthlyData[],
    customers: CustomerData[],
  ) => {
    try {
      setAnalyzing(true);

      const response = await fetch("/api/ai/analyze-financial-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpiData: kpi,
          monthlyRevenue: monthly,
          topCustomers: customers,
        }),
      });

      if (!response.ok) {
        throw new Error("AI analysis failed");
      }

      const result = await response.json();

      // Map API response to our interface
      const mappedAnalysis: AIAnalysis = {
        executiveSummary: result.sections?.summary || result.analysis || "",
        keyInsights: result.sections?.insights || [],
        opportunities: result.sections?.opportunities || [],
        risks: result.sections?.risks || [],
        recommendations: result.sections?.recommendations || [],
      };

      setAiAnalysis(mappedAnalysis);
      setAnalyzing(false);
    } catch (err) {
      console.error("Error generating AI analysis:", err);
      setError("Failed to generate AI analysis");
      setAnalyzing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg uppercase text-muted-foreground">
            A CARREGAR DADOS FINANCEIROS...
          </div>
          <div className="h-1 w-64 bg-accent">
            <div className="h-full w-1/2 animate-pulse bg-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="imx-border bg-destructive/10 p-8 text-center">
          <div className="mb-2 text-lg uppercase text-destructive">ERRO</div>
          <div className="text-sm text-muted-foreground">{error}</div>
        </div>
      </div>
    );
  }

  const customerColumns: ColumnConfig[] = [
    { key: "nome", header: "CLIENTE", align: "left" },
    {
      key: "total_vendas",
      header: "RECEITA TOTAL",
      align: "right",
      format: (value) =>
        new Intl.NumberFormat("pt-PT", {
          style: "currency",
          currency: "EUR",
        }).format(value),
    },
    { key: "num_faturas", header: "N° FATURAS", align: "center" },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header with Print Button */}
      <div className="mb-8 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl uppercase text-foreground">
            RELATÓRIO EXECUTIVO COM ANÁLISE IA
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            GERADO EM{" "}
            {new Date()
              .toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
              .toUpperCase()}
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="imx-border bg-primary px-6 py-3 uppercase text-primary-foreground hover:bg-primary/90"
        >
          IMPRIMIR / EXPORTAR PDF
        </button>
      </div>

      {/* Print Header */}
      <div className="mb-8 hidden print:block">
        <h1 className="text-3xl uppercase text-foreground">
          RELATÓRIO EXECUTIVO COM ANÁLISE IA
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          GERADO EM{" "}
          {new Date()
            .toLocaleDateString("pt-PT", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
            .toUpperCase()}
        </p>
      </div>

      {/* KPI Cards */}
      {kpiData && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ImacxKpiCard
            label="RECEITA YTD"
            value={new Intl.NumberFormat("pt-PT", {
              style: "currency",
              currency: "EUR",
            }).format(kpiData.vendas_ytd || 0)}
            change={kpiData.vendas_ytd_var_pct}
            changeLabel="VS. ANO ANTERIOR"
          />
          <ImacxKpiCard
            label="RECEITA MTD"
            value={new Intl.NumberFormat("pt-PT", {
              style: "currency",
              currency: "EUR",
            }).format(kpiData.vendas_mtd || 0)}
            changeLabel="MÊS ATUAL"
          />
          <ImacxKpiCard
            label="CLIENTES ATIVOS"
            value={(kpiData.num_clientes || 0).toString()}
            changeLabel="YTD"
          />
          <ImacxKpiCard
            label="TICKET MÉDIO"
            value={new Intl.NumberFormat("pt-PT", {
              style: "currency",
              currency: "EUR",
            }).format(kpiData.ticket_medio || 0)}
            changeLabel="POR FATURA"
          />
        </div>
      )}

      {/* AI Executive Summary */}
      {analyzing && (
        <div className="mb-8 imx-border bg-accent p-6">
          <div className="mb-2 text-lg uppercase text-foreground">
            ANÁLISE IA EM PROGRESSO...
          </div>
          <div className="h-1 w-full bg-muted">
            <div className="h-full w-3/4 animate-pulse bg-primary"></div>
          </div>
        </div>
      )}

      {aiAnalysis && (
        <div className="mb-8 imx-border bg-card p-6">
          <h2 className="mb-4 text-xl uppercase text-foreground">
            SUMÁRIO EXECUTIVO (ANÁLISE IA)
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {aiAnalysis.executiveSummary}
          </p>
        </div>
      )}

      {/* Monthly Revenue Chart */}
      {monthlyRevenue.length > 0 && (
        <div className="mb-8 imx-border bg-card p-6">
          <h2 className="mb-4 text-xl uppercase text-foreground">
            RECEITA MENSAL
          </h2>
          <ImacxLineChart
            data={monthlyRevenue}
            lines={[{ dataKey: "vendas", name: "RECEITA" }]}
            xAxisKey="mes"
            height={300}
          />
        </div>
      )}

      {/* AI Key Insights */}
      {aiAnalysis && aiAnalysis.keyInsights.length > 0 && (
        <div className="mb-8 imx-border bg-card p-6">
          <h2 className="mb-4 text-xl uppercase text-foreground">
            INSIGHTS PRINCIPAIS
          </h2>
          <ul className="space-y-2">
            {aiAnalysis.keyInsights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 bg-primary"></span>
                <span className="text-sm leading-relaxed text-foreground">
                  {insight}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Customers Table */}
      {topCustomers.length > 0 && (
        <div className="mb-8 imx-border bg-card p-6">
          <h2 className="mb-4 text-xl uppercase text-foreground">
            TOP 10 CLIENTES
          </h2>
          <ImacxTable
            columns={customerColumns}
            data={topCustomers.slice(0, 10)}
          />
        </div>
      )}

      {/* Top Customers Bar Chart */}
      {topCustomers.length > 0 && (
        <div className="mb-8 imx-border bg-card p-6">
          <h2 className="mb-4 text-xl uppercase text-foreground">
            TOP 10 CLIENTES - RECEITA
          </h2>
          <ImacxBarChart
            data={topCustomers.slice(0, 10).map((c) => ({
              name:
                c.nome.length > 20 ? c.nome.substring(0, 20) + "..." : c.nome,
              value: c.total_vendas,
            }))}
            dataKey="value"
            xAxisKey="name"
            height={300}
          />
        </div>
      )}

      {/* AI Opportunities */}
      {aiAnalysis && aiAnalysis.opportunities.length > 0 && (
        <div className="mb-8 imx-border bg-card p-6">
          <h2 className="mb-4 text-xl uppercase text-foreground">
            OPORTUNIDADES
          </h2>
          <ul className="space-y-2">
            {aiAnalysis.opportunities.map((opportunity, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 bg-[oklch(0.65_0.1_140)]"></span>
                <span className="text-sm leading-relaxed text-foreground">
                  {opportunity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Risks */}
      {aiAnalysis && aiAnalysis.risks.length > 0 && (
        <div className="mb-8 imx-border bg-card p-6">
          <h2 className="mb-4 text-xl uppercase text-foreground">
            RISCOS & PREOCUPAÇÕES
          </h2>
          <ul className="space-y-2">
            {aiAnalysis.risks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 bg-destructive"></span>
                <span className="text-sm leading-relaxed text-foreground">
                  {risk}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Recommendations */}
      {aiAnalysis && aiAnalysis.recommendations.length > 0 && (
        <div className="mb-8 imx-border bg-card p-6">
          <h2 className="mb-4 text-xl uppercase text-foreground">
            RECOMENDAÇÕES ACIONÁVEIS
          </h2>
          <ul className="space-y-3">
            {aiAnalysis.recommendations.map((recommendation, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center bg-primary text-xs text-primary-foreground">
                  {idx + 1}
                </span>
                <span className="text-sm leading-relaxed text-foreground">
                  {recommendation}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 imx-border-t pt-4 text-center text-xs text-muted-foreground">
        <p>RELATÓRIO GERADO AUTOMATICAMENTE PELO SISTEMA IMACX</p>
        <p className="mt-1">
          ANÁLISE INTELIGENTE FORNECIDA POR CLAUDE 3.5 SONNET VIA OPENROUTER
        </p>
      </div>
    </div>
  );
}

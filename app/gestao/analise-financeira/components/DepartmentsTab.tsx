import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ArrowUp, ArrowDown, RefreshCw, ArrowLeft, ArrowRight } from "lucide-react";
import { MetricCard } from "./MetricCard";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  getDiasDecorridosClassName,
  getEscalaoOrder,
} from "../utils/formatters";
import type { KPIDashboardData } from "@/types/financial-analysis";

interface DepartmentsTabProps {
  departmentView: "analise" | "reunioes";
  setDepartmentView: (view: "analise" | "reunioes") => void;
  selectedDepartment: "Brindes" | "Digital" | "IMACX";
  setSelectedDepartment: (dept: "Brindes" | "Digital" | "IMACX") => void;
  activeTab: "mtd" | "ytd" | "qtd";
  currentYear: number;
  previousYear: number;
  analiseTab: "orcamentos" | "faturas" | "conversao" | "graficos";
  setAnaliseTab: (
    tab: "orcamentos" | "faturas" | "conversao" | "graficos",
  ) => void;
  departmentKpiData: KPIDashboardData | null;
  departmentClientes: any[];
  sortedDepartmentOrcamentos: any[];
  handleDeptOrcSort: (column: any) => void;
  deptOrcSortColumn: string;
  deptOrcSortDirection: "asc" | "desc";
  sortedDepartmentFaturas: any[];
  handleDeptFatSort: (column: any) => void;
  deptFatSortColumn: string;
  deptFatSortDirection: "asc" | "desc";
  sortedDepartmentConversao: any[];
  handleDeptConvSort: (column: any) => void;
  deptConvSortColumn: string;
  deptConvSortDirection: "asc" | "desc";
  allDepartmentsKpi: any;
  departmentChartData1: any[];
  departmentChartData2: any[];
  departmentChartData3: any[];
  departmentChartData4: any[];
  pipelineTab: "top15" | "attention" | "lost";
  setPipelineTab: (tab: "top15" | "attention" | "lost") => void;
  pipelineData: any;
  sortedTop15: any[];
  handleTop15Sort: (column: any) => void;
  top15SortColumn: string;
  top15SortDirection: "asc" | "desc";
  handleDismissOrcamento: (
    orcamentoNumber: string,
    currentState: boolean,
  ) => void;
  sortedAttention: any[];
  handleAttentionSort: (column: any) => void;
  attentionSortColumn: string;
  attentionSortDirection: "asc" | "desc";
  sortedPerdidos: any[];
  handlePerdidosSort: (column: any) => void;
  perdidosSortColumn: string;
  perdidosSortDirection: "asc" | "desc";
}

export function DepartmentsTab({
  departmentView,
  setDepartmentView,
  selectedDepartment,
  setSelectedDepartment,
  activeTab,
  currentYear,
  previousYear,
  analiseTab,
  setAnaliseTab,
  departmentKpiData,
  departmentClientes,
  sortedDepartmentOrcamentos,
  handleDeptOrcSort,
  deptOrcSortColumn,
  deptOrcSortDirection,
  sortedDepartmentFaturas,
  handleDeptFatSort,
  deptFatSortColumn,
  deptFatSortDirection,
  sortedDepartmentConversao,
  handleDeptConvSort,
  deptConvSortColumn,
  deptConvSortDirection,
  allDepartmentsKpi,
  departmentChartData1,
  departmentChartData2,
  departmentChartData3,
  departmentChartData4,
  pipelineTab,
  setPipelineTab,
  pipelineData,
  sortedTop15,
  handleTop15Sort,
  top15SortColumn,
  top15SortDirection,
  handleDismissOrcamento,
  sortedAttention,
  handleAttentionSort,
  attentionSortColumn,
  attentionSortDirection,
  sortedPerdidos,
  handlePerdidosSort,
  perdidosSortColumn,
  perdidosSortDirection,
}: DepartmentsTabProps) {
  const ITEMS_PER_PAGE = 40;

  // Pagination state for each table
  const [orcamentosPage, setOrcamentosPage] = useState(1);
  const [faturasPage, setFaturasPage] = useState(1);
  const [conversaoPage, setConversaoPage] = useState(1);
  const [top15Page, setTop15Page] = useState(1);
  const [attentionPage, setAttentionPage] = useState(1);
  const [perdidosPage, setPerdidosPage] = useState(1);

  // Reset pagination when filters change
  useEffect(() => {
    setOrcamentosPage(1);
  }, [sortedDepartmentOrcamentos.length, selectedDepartment, activeTab]);

  useEffect(() => {
    setFaturasPage(1);
  }, [sortedDepartmentFaturas.length, selectedDepartment, activeTab]);

  useEffect(() => {
    setConversaoPage(1);
  }, [sortedDepartmentConversao.length, selectedDepartment, activeTab]);

  useEffect(() => {
    setTop15Page(1);
  }, [sortedTop15.length, selectedDepartment, pipelineTab]);

  useEffect(() => {
    setAttentionPage(1);
  }, [sortedAttention.length, selectedDepartment, pipelineTab]);

  useEffect(() => {
    setPerdidosPage(1);
  }, [sortedPerdidos.length, selectedDepartment, pipelineTab]);

  // Paginated data
  const orcamentosTotalPages = Math.ceil(sortedDepartmentOrcamentos.length / ITEMS_PER_PAGE);
  const paginatedOrcamentos = useMemo(() => {
    const startIndex = (orcamentosPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedDepartmentOrcamentos.slice(startIndex, endIndex);
  }, [sortedDepartmentOrcamentos, orcamentosPage]);

  const faturasTotalPages = Math.ceil(sortedDepartmentFaturas.length / ITEMS_PER_PAGE);
  const paginatedFaturas = useMemo(() => {
    const startIndex = (faturasPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedDepartmentFaturas.slice(startIndex, endIndex);
  }, [sortedDepartmentFaturas, faturasPage]);

  const conversaoTotalPages = Math.ceil(sortedDepartmentConversao.length / ITEMS_PER_PAGE);
  const paginatedConversao = useMemo(() => {
    const startIndex = (conversaoPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedDepartmentConversao.slice(startIndex, endIndex);
  }, [sortedDepartmentConversao, conversaoPage]);

  const top15TotalPages = Math.ceil(sortedTop15.length / ITEMS_PER_PAGE);
  const paginatedTop15 = useMemo(() => {
    const startIndex = (top15Page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedTop15.slice(startIndex, endIndex);
  }, [sortedTop15, top15Page]);

  const attentionTotalPages = Math.ceil(sortedAttention.length / ITEMS_PER_PAGE);
  const paginatedAttention = useMemo(() => {
    const startIndex = (attentionPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedAttention.slice(startIndex, endIndex);
  }, [sortedAttention, attentionPage]);

  const perdidosTotalPages = Math.ceil(sortedPerdidos.length / ITEMS_PER_PAGE);
  const paginatedPerdidos = useMemo(() => {
    const startIndex = (perdidosPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedPerdidos.slice(startIndex, endIndex);
  }, [sortedPerdidos, perdidosPage]);

  const renderSortIcon = (
    column: string,
    currentColumn: string,
    direction: "asc" | "desc",
  ) => {
    if (currentColumn !== column) return null;
    return direction === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const PaginationControls = (props: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemLabel: string;
    onPageChange: (page: number) => void;
  }) => {
    const { currentPage, totalPages, totalItems, itemLabel, onPageChange } = props;
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
        <div className="text-muted-foreground">
          Página {currentPage} de {totalPages} ({totalItems} {itemLabel})
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
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
          {/* Department Selector with GRÁFICOS as 4th option */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={selectedDepartment === "Brindes" ? "default" : "outline"}
              onClick={() => {
                setSelectedDepartment("Brindes");
                setAnaliseTab("orcamentos");
              }}
              className="h-10"
            >
              BRINDES
            </Button>
            <Button
              variant={selectedDepartment === "Digital" ? "default" : "outline"}
              onClick={() => {
                setSelectedDepartment("Digital");
                setAnaliseTab("orcamentos");
              }}
              className="h-10"
            >
              DIGITAL
            </Button>
            <Button
              variant={selectedDepartment === "IMACX" ? "default" : "outline"}
              onClick={() => {
                setSelectedDepartment("IMACX");
                setAnaliseTab("orcamentos");
              }}
              className="h-10"
            >
              IMACX
            </Button>
            <Button
              variant={analiseTab === "graficos" ? "default" : "outline"}
              onClick={() => setAnaliseTab("graficos")}
              className="h-10"
            >
              GRÁFICOS
            </Button>
          </div>

          {/* KPI Cards - Filtrados por Departamento (hide for GRÁFICOS) */}
          {analiseTab !== "graficos" &&
            departmentKpiData &&
            departmentKpiData[activeTab] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                <MetricCard
                  title="Receita Total"
                  value={departmentKpiData[activeTab].revenue.current}
                  previousValue={departmentKpiData[activeTab].revenue.previous}
                  change={departmentKpiData[activeTab].revenue.change}
                  formatter={formatCurrency}
                  subtitle={
                    activeTab === "mtd"
                      ? "vs. mês anterior"
                      : "vs. período anterior"
                  }
                />
                <MetricCard
                  title="Nº Faturas"
                  value={departmentKpiData[activeTab].invoices.current}
                  previousValue={departmentKpiData[activeTab].invoices.previous}
                  change={departmentKpiData[activeTab].invoices.change}
                  formatter={formatNumber}
                  subtitle={
                    activeTab === "mtd"
                      ? "vs. mês anterior"
                      : "vs. período anterior"
                  }
                />
                <MetricCard
                  title="Nº Clientes"
                  value={departmentKpiData[activeTab].customers.current}
                  previousValue={
                    departmentKpiData[activeTab].customers.previous
                  }
                  change={departmentKpiData[activeTab].customers.change}
                  formatter={formatNumber}
                  subtitle={
                    activeTab === "mtd"
                      ? "vs. mês anterior"
                      : "vs. período anterior"
                  }
                />
                <MetricCard
                  title="Ticket Médio"
                  value={departmentKpiData[activeTab].avgInvoiceValue.current}
                  previousValue={
                    departmentKpiData[activeTab].avgInvoiceValue.previous
                  }
                  change={departmentKpiData[activeTab].avgInvoiceValue.change}
                  formatter={formatCurrency}
                  subtitle={
                    activeTab === "mtd"
                      ? "vs. mês anterior"
                      : "vs. período anterior"
                  }
                />
                <MetricCard
                  title="Orçamentos Valor"
                  value={departmentKpiData[activeTab].quoteValue.current}
                  previousValue={
                    departmentKpiData[activeTab].quoteValue.previous
                  }
                  change={departmentKpiData[activeTab].quoteValue.change}
                  formatter={formatCurrency}
                  subtitle={
                    activeTab === "mtd"
                      ? "vs. mês anterior"
                      : "vs. período anterior"
                  }
                />
                <MetricCard
                  title="Orçamentos Qtd"
                  value={departmentKpiData[activeTab].quoteCount.current}
                  previousValue={
                    departmentKpiData[activeTab].quoteCount.previous
                  }
                  change={departmentKpiData[activeTab].quoteCount.change}
                  formatter={formatNumber}
                  subtitle={
                    activeTab === "mtd"
                      ? "vs. mês anterior"
                      : "vs. período anterior"
                  }
                />
                <MetricCard
                  title="Taxa Conversão"
                  value={departmentKpiData[activeTab].conversionRate.current}
                  previousValue={
                    departmentKpiData[activeTab].conversionRate.previous
                  }
                  change={departmentKpiData[activeTab].conversionRate.change}
                  formatter={formatPercent}
                  subtitle={
                    activeTab === "mtd"
                      ? "vs. mês anterior"
                      : "vs. período anterior"
                  }
                />
                <MetricCard
                  title="Orçamento Médio"
                  value={departmentKpiData[activeTab].avgQuoteValue.current}
                  previousValue={
                    departmentKpiData[activeTab].avgQuoteValue.previous
                  }
                  change={departmentKpiData[activeTab].avgQuoteValue.change}
                  formatter={formatCurrency}
                  subtitle={
                    activeTab === "mtd"
                      ? "vs. mês anterior"
                      : "vs. período anterior"
                  }
                />
              </div>
            )}

          <Card className="p-6 mb-6">
            <h2 className="text-xl text-foreground mb-4">
              ANÁLISE {selectedDepartment.toUpperCase()} -{" "}
              {activeTab === "mtd" ? "Mês Atual" : "Ano Atual"} ({currentYear})
            </h2>

            {/* KPI Card for selected department */}
            {analiseTab !== "graficos" &&
              departmentClientes
                .filter((dept: any) => dept.departamento === selectedDepartment)
                .map((dept: any) => (
                  <Card key={dept.departamento} className="p-4 mb-6">
                    <h3 className="text-sm font-medium text-foreground mb-3">
                      Movimento de Clientes (Comparação YTD {currentYear} vs YTD{" "}
                      {previousYear})
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">
                          Clientes Ativos (YTD {currentYear}):
                        </span>
                        <p className="text-2xl font-medium">
                          {dept.clientes_ytd}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Total de clientes com faturas em {currentYear}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">
                          Novos em {currentYear}:
                        </span>
                        <p className="text-2xl font-medium text-green-600 dark:text-green-400">
                          +{dept.clientes_novos}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Clientes que não existiam em {previousYear}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">
                          Perdidos de {previousYear}:
                        </span>
                        <p className="text-2xl font-medium text-red-600 dark:text-red-400">
                          -{dept.clientes_perdidos}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Clientes de {previousYear} que não voltaram
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}

            {/* Orçamentos por Escalão */}
            {analiseTab === "orcamentos" && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium">
                    Orçamentos por Escalão - {currentYear}{" "}
                    {activeTab === "mtd" ? "(Mês Atual)" : "(YTD)"}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Fonte: phc.bo • Apenas orçamentos de {currentYear}{" "}
                  {activeTab === "mtd"
                    ? "do mês corrente"
                    : "acumulados no ano"}
                </p>
                <Table className="w-full table-fixed imx-table-compact">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleDeptOrcSort("escaloes_valor")}
                      >
                        Escalão
                        {renderSortIcon(
                          "escaloes_valor",
                          deptOrcSortColumn,
                          deptOrcSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleDeptOrcSort("total_orcamentos")}
                      >
                        Quantidade
                        {renderSortIcon(
                          "total_orcamentos",
                          deptOrcSortColumn,
                          deptOrcSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleDeptOrcSort("total_valor")}
                      >
                        Valor Total
                        {renderSortIcon(
                          "total_valor",
                          deptOrcSortColumn,
                          deptOrcSortDirection,
                        )}
                      </TableHead>
                      <TableHead className="text-right">% Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrcamentos.map((row: any, idx: number) => {
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
                    })}
                  </TableBody>
                </Table>

                <PaginationControls
                  currentPage={orcamentosPage}
                  totalPages={orcamentosTotalPages}
                  totalItems={sortedDepartmentOrcamentos.length}
                  itemLabel="escalões"
                  onPageChange={setOrcamentosPage}
                />
              </div>
            )}

            {/* Faturas por Escalão */}
            {analiseTab === "faturas" && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium">
                    Faturas por Escalão - {currentYear}{" "}
                    {activeTab === "mtd" ? "(Mês Atual)" : "(Ano Atual)"}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Fonte: phc.ft • Apenas faturas de {currentYear}{" "}
                  {activeTab === "mtd"
                    ? "do mês corrente"
                    : "acumuladas no ano"}
                </p>
                <Table className="w-full table-fixed imx-table-compact">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleDeptFatSort("escaloes_valor")}
                      >
                        Escalão
                        {renderSortIcon(
                          "escaloes_valor",
                          deptFatSortColumn,
                          deptFatSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleDeptFatSort("total_faturas")}
                      >
                        Quantidade
                        {renderSortIcon(
                          "total_faturas",
                          deptFatSortColumn,
                          deptFatSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleDeptFatSort("total_valor")}
                      >
                        Valor Total
                        {renderSortIcon(
                          "total_valor",
                          deptFatSortColumn,
                          deptFatSortDirection,
                        )}
                      </TableHead>
                      <TableHead className="text-right">% Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFaturas.map((row: any, idx: number) => {
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

                <PaginationControls
                  currentPage={faturasPage}
                  totalPages={faturasTotalPages}
                  totalItems={sortedDepartmentFaturas.length}
                  itemLabel="escalões"
                  onPageChange={setFaturasPage}
                />
              </div>
            )}

            {/* Taxa de Conversão por Escalão */}
            {analiseTab === "conversao" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium">
                    Taxa de Conversão por Escalão - {currentYear}{" "}
                    {activeTab === "mtd" ? "(Mês Atual)" : "(Ano Atual)"}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Orçamentos vs Faturas do mesmo período {currentYear}{" "}
                  {activeTab === "mtd" ? "(mês corrente)" : "(ano corrente)"}
                </p>
                <Table className="w-full table-fixed imx-table-compact">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleDeptConvSort("escalao")}
                      >
                        Escalão
                        {renderSortIcon(
                          "escalao",
                          deptConvSortColumn,
                          deptConvSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleDeptConvSort("total_orcamentos")}
                      >
                        Orçamentos
                        {renderSortIcon(
                          "total_orcamentos",
                          deptConvSortColumn,
                          deptConvSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleDeptConvSort("total_faturas")}
                      >
                        Faturas
                        {renderSortIcon(
                          "total_faturas",
                          deptConvSortColumn,
                          deptConvSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleDeptConvSort("taxa_conversao_pct")}
                      >
                        Taxa Conv.
                        {renderSortIcon(
                          "taxa_conversao_pct",
                          deptConvSortColumn,
                          deptConvSortDirection,
                        )}
                      </TableHead>
                      <TableHead className="text-right">Valor Orç.</TableHead>
                      <TableHead className="text-right">Valor Fat.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedConversao.map((row: any, idx: number) => (
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
                          {formatCurrency(row.total_valor_orcado || 0)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(row.total_valor_faturado || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <PaginationControls
                  currentPage={conversaoPage}
                  totalPages={conversaoTotalPages}
                  totalItems={sortedDepartmentConversao.length}
                  itemLabel="escalões"
                  onPageChange={setConversaoPage}
                />
              </div>
            )}

            {/* GRÁFICOS Tab */}
            {analiseTab === "graficos" && (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Comparação visual entre os 3 departamentos (Brindes, Digital,
                  IMACX) - {activeTab === "mtd" ? "Mês Atual" : "Ano Atual"}
                </p>

                {!allDepartmentsKpi ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        A CARREGAR DADOS...
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chart 1: Stacked Bar - Orçamentos Valor + Receita Total */}
                    <div className="imx-border bg-card p-6">
                      <h3 className="text-lg font-medium mb-2">
                        ORÇAMENTOS VALOR VS RECEITA TOTAL
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Comparação do valor total de orçamentos e receita
                        efetiva por departamento
                      </p>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                          data={departmentChartData1}
                          margin={{
                            top: 10,
                            right: 30,
                            bottom: 60,
                            left: 80,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="department" />
                          <YAxis
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <Tooltip
                            formatter={(value: any) =>
                              formatCurrency(Number(value))
                            }
                          />
                          <Legend
                            wrapperStyle={{
                              color: "var(--foreground)",
                            }}
                          />
                          <Bar
                            dataKey="orcamentosValor"
                            stackId="a"
                            fill="var(--accent)"
                            name="Orçamentos Valor"
                          />
                          <Bar
                            dataKey="receitaTotal"
                            stackId="a"
                            fill="var(--primary)"
                            name="Receita Total"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Chart 2: Stacked Bar - Orçamentos Qtd + Nº Faturas */}
                    <div className="imx-border bg-card p-6">
                      <h3 className="text-lg font-medium mb-2">
                        ORÇAMENTOS QUANTIDADE VS Nº FATURAS
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Comparação do número de orçamentos e faturas emitidas
                        por departamento
                      </p>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                          data={departmentChartData2}
                          margin={{
                            top: 10,
                            right: 30,
                            bottom: 60,
                            left: 80,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="department" />
                          <YAxis />
                          <Tooltip
                            formatter={(value: any) =>
                              formatNumber(Number(value))
                            }
                          />
                          <Legend
                            wrapperStyle={{
                              color: "var(--foreground)",
                            }}
                          />
                          <Bar
                            dataKey="orcamentosQtd"
                            stackId="a"
                            fill="var(--accent)"
                            name="Orçamentos Qtd"
                          />
                          <Bar
                            dataKey="nFaturas"
                            stackId="a"
                            fill="var(--primary)"
                            name="Nº Faturas"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Chart 3: Simple Bar - Nº Clientes */}
                    <div className="imx-border bg-card p-6">
                      <h3 className="text-lg font-medium mb-2">
                        NÚMERO DE CLIENTES
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Total de clientes ativos por departamento
                      </p>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                          data={departmentChartData3}
                          margin={{
                            top: 10,
                            right: 30,
                            bottom: 60,
                            left: 80,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="department" />
                          <YAxis />
                          <Tooltip
                            formatter={(value: any) =>
                              formatNumber(Number(value))
                            }
                          />
                          <Legend
                            wrapperStyle={{
                              color: "var(--foreground)",
                            }}
                          />
                          <Bar
                            dataKey="nClientes"
                            fill="var(--primary)"
                            name="Nº Clientes"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Chart 4: Grouped Bar - Orçamento Médio + Ticket Médio */}
                    <div className="imx-border bg-card p-6">
                      <h3 className="text-lg font-medium mb-2">
                        ORÇAMENTO MÉDIO VS TICKET MÉDIO
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Comparação dos valores médios de orçamentos e faturas
                        por departamento
                      </p>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart
                          data={departmentChartData4}
                          margin={{
                            top: 10,
                            right: 30,
                            bottom: 60,
                            left: 80,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="department" />
                          <YAxis
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <Tooltip
                            formatter={(value: any) =>
                              formatCurrency(Number(value))
                            }
                          />
                          <Legend
                            wrapperStyle={{
                              color: "var(--foreground)",
                            }}
                          />
                          <Bar
                            dataKey="orcamentoMedio"
                            fill="var(--accent)"
                            name="Orçamento Médio"
                          />
                          <Bar
                            dataKey="ticketMedio"
                            fill="var(--primary)"
                            name="Ticket Médio"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {/* REUNIÕES VIEW */}
      {departmentView === "reunioes" && (
        <>
          {/* Department Selector */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={selectedDepartment === "Brindes" ? "default" : "outline"}
              onClick={() => {
                setSelectedDepartment("Brindes");
              }}
              className="h-10"
            >
              BRINDES
            </Button>
            <Button
              variant={selectedDepartment === "Digital" ? "default" : "outline"}
              onClick={() => {
                setSelectedDepartment("Digital");
              }}
              className="h-10"
            >
              DIGITAL
            </Button>
            <Button
              variant={selectedDepartment === "IMACX" ? "default" : "outline"}
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
            {/* PERDIDOS tab only visible in ANO ATUAL (ytd) mode */}
            {activeTab !== "mtd" && (
              <Button
                variant={pipelineTab === "lost" ? "default" : "outline"}
                onClick={() => setPipelineTab("lost")}
                className="h-10"
              >
                PERDIDOS
              </Button>
            )}
          </div>

          {/* TOP 15 */}
          {pipelineTab === "top15" && (
            <Card className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium">
                  Top 15 Orçamentos - {selectedDepartment}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === "mtd"
                    ? "Maiores orçamentos dos últimos 45 dias ainda pendentes."
                    : "Maiores orçamentos perdidos desde 1 de janeiro até hoje."}
                </p>
              </div>
              <Table className="w-full table-fixed imx-table-compact">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleTop15Sort("orcamento_id_humano")}
                    >
                      ORC#
                      {renderSortIcon(
                        "orcamento_id_humano",
                        top15SortColumn,
                        top15SortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleTop15Sort("document_date")}
                    >
                      Data
                      {renderSortIcon(
                        "document_date",
                        top15SortColumn,
                        top15SortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleTop15Sort("cliente_nome")}
                    >
                      Cliente
                      {renderSortIcon(
                        "cliente_nome",
                        top15SortColumn,
                        top15SortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleTop15Sort("total")}
                    >
                      Valor
                      {renderSortIcon(
                        "total",
                        top15SortColumn,
                        top15SortDirection,
                      )}
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleTop15Sort("dias_decorridos")}
                    >
                      Dias
                      {renderSortIcon(
                        "dias_decorridos",
                        top15SortColumn,
                        top15SortDirection,
                      )}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTop15.map((row: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Checkbox
                          checked={row.is_dismissed}
                          onCheckedChange={() =>
                            handleDismissOrcamento(
                              row.orcamento_id_humano?.replace("ORC-", "") ||
                                row.document_number,
                              row.is_dismissed,
                            )
                          }
                        />
                      </TableCell>
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
                          className={getDiasDecorridosClassName(
                            row.dias_decorridos,
                          )}
                        >
                          {row.dias_decorridos}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <PaginationControls
                currentPage={top15Page}
                totalPages={top15TotalPages}
                totalItems={sortedTop15.length}
                itemLabel="orçamentos"
                onPageChange={setTop15Page}
              />
            </Card>
          )}

          {/* NEEDS ATTENTION */}
          {pipelineTab === "attention" && (
            <Card className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium">
                  Orçamentos que Precisam Atenção - {selectedDepartment}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === "mtd"
                    ? "Orçamentos entre 15 e 60 dias sem avanço."
                    : "Clientes principais com orçamentos relevantes no ano e mais de 30 dias sem avanço."}
                </p>
              </div>
              {pipelineData?.needsAttention?.length > 0 ? (
                <>
                <Table className="w-full table-fixed imx-table-compact">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() =>
                          handleAttentionSort("orcamento_id_humano")
                        }
                      >
                        ORC#
                        {renderSortIcon(
                          "orcamento_id_humano",
                          attentionSortColumn,
                          attentionSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleAttentionSort("document_date")}
                      >
                        Data
                        {renderSortIcon(
                          "document_date",
                          attentionSortColumn,
                          attentionSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleAttentionSort("cliente_nome")}
                      >
                        Cliente
                        {renderSortIcon(
                          "cliente_nome",
                          attentionSortColumn,
                          attentionSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleAttentionSort("total")}
                      >
                        Valor
                        {renderSortIcon(
                          "total",
                          attentionSortColumn,
                          attentionSortDirection,
                        )}
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleAttentionSort("dias_decorridos")}
                      >
                        Dias Pendente
                        {renderSortIcon(
                          "dias_decorridos",
                          attentionSortColumn,
                          attentionSortDirection,
                        )}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAttention.map((row: any, idx: number) => (
                      <TableRow
                        key={idx}
                        className="imx-border-l-4 imx-border-l-red-500"
                      >
                        <TableCell>
                          <Checkbox
                            checked={row.is_dismissed}
                            onCheckedChange={() =>
                              handleDismissOrcamento(
                                row.orcamento_id_humano?.replace("ORC-", "") ||
                                  row.document_number,
                                row.is_dismissed,
                              )
                            }
                          />
                        </TableCell>
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

                <PaginationControls
                  currentPage={attentionPage}
                  totalPages={attentionTotalPages}
                  totalItems={sortedAttention.length}
                  itemLabel="orçamentos"
                  onPageChange={setAttentionPage}
                />
                </>
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
              <div className="mb-4">
                <h3 className="text-lg font-medium">
                  Orçamentos Perdidos - {selectedDepartment}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === "mtd"
                    ? "Orçamentos com mais de 60 dias sem resposta."
                    : "Todos os orçamentos perdidos desde o início do ano."}
                </p>
              </div>
              <Table className="w-full table-fixed imx-table-compact">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handlePerdidosSort("orcamento_id_humano")}
                    >
                      ORC#
                      {renderSortIcon(
                        "orcamento_id_humano",
                        perdidosSortColumn,
                        perdidosSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handlePerdidosSort("document_date")}
                    >
                      Data
                      {renderSortIcon(
                        "document_date",
                        perdidosSortColumn,
                        perdidosSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handlePerdidosSort("cliente_nome")}
                    >
                      Cliente
                      {renderSortIcon(
                        "cliente_nome",
                        perdidosSortColumn,
                        perdidosSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handlePerdidosSort("total")}
                    >
                      Valor
                      {renderSortIcon(
                        "total",
                        perdidosSortColumn,
                        perdidosSortDirection,
                      )}
                    </TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handlePerdidosSort("dias_decorridos")}
                    >
                      Dias
                      {renderSortIcon(
                        "dias_decorridos",
                        perdidosSortColumn,
                        perdidosSortDirection,
                      )}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPerdidos.map((row: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Checkbox
                          checked={row.is_dismissed}
                          onCheckedChange={() =>
                            handleDismissOrcamento(
                              row.orcamento_id_humano?.replace("ORC-", "") ||
                                row.document_number,
                              row.is_dismissed,
                            )
                          }
                        />
                      </TableCell>
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

              <PaginationControls
                currentPage={perdidosPage}
                totalPages={perdidosTotalPages}
                totalItems={sortedPerdidos.length}
                itemLabel="orçamentos"
                onPageChange={setPerdidosPage}
              />
            </Card>
          )}
        </>
      )}
    </>
  );
}

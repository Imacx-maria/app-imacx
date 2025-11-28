"use client";

import { useMemo } from "react";
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ArrowUp, ArrowDown } from "lucide-react";
import type {
  KPIDashboardData,
  TopCustomersResponse,
  MultiYearRevenueResponse,
} from "@/types/financial-analysis";
import { MetricCard } from "../components";
import {
  useTopCustomersSorting,
  useCompanyConversaoSorting,
  type SortingState,
} from "../hooks/useSortingState";
import { getEscalaoOrder } from "../utils/formatters";

// ============================================================================
// Types
// ============================================================================

interface VisaoGeralTabProps {
  activeTab: "mtd" | "ytd" | "qtd";
  kpiData: KPIDashboardData | null;
  topCustomers: TopCustomersResponse | null;
  multiYearRevenue: MultiYearRevenueResponse | null;
  companyConversao: any[];
  currentYear: number;
}

// ============================================================================
// Formatters (local to avoid circular deps)
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
// Component
// ============================================================================

export default function VisaoGeralTab({
  activeTab,
  kpiData,
  topCustomers,
  multiYearRevenue,
  companyConversao,
  currentYear,
}: VisaoGeralTabProps) {
  // Sorting hooks
  const topCustomersSort = useTopCustomersSorting();
  const companyConversaoSort = useCompanyConversaoSorting();

  // Generic sort icon renderer
  const renderSortIcon = <T extends string>(
    column: T,
    sortState: SortingState<T>
  ) => {
    if (sortState.column !== column) return null;
    return sortState.direction === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  // Get active period data
  const activePeriodData = kpiData ? kpiData[activeTab] : null;

  // Prepare multi-year chart data
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

  // Sort top customers
  const sortedTopCustomers = useMemo(() => {
    if (!topCustomers?.customers) return [];

    return topCustomers.customers.slice().sort((a, b) => {
      const dir = topCustomersSort.direction === "asc" ? 1 : -1;

      const getValue = (c: (typeof topCustomers.customers)[number]) => {
        switch (topCustomersSort.column) {
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
    });
  }, [topCustomers, topCustomersSort.column, topCustomersSort.direction]);

  // Sort company conversion data
  const sortedCompanyConversao = useMemo(() => {
    return companyConversao.slice().sort((a, b) => {
      const dir = companyConversaoSort.direction === "asc" ? 1 : -1;
      let av, bv;

      switch (companyConversaoSort.column) {
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

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      return av > bv ? dir : av < bv ? -dir : 0;
    });
  }, [companyConversao, companyConversaoSort.column, companyConversaoSort.direction]);

  // Calculate totals for company conversion table
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
      }
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

  return (
    <>
      {/* KPI Cards */}
      {activePeriodData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
              Vendas {multiYearRevenue.years[0]} vs {multiYearRevenue.years[1]}{" "}
              vs {multiYearRevenue.years[2]} (YTD)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
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
                  const isMostRecent = index === 0;
                  const stroke = isMostRecent
                    ? "var(--foreground)"
                    : index === 1
                      ? "var(--primary)"
                      : "var(--orange)";
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

      {/* Top Customers Table */}
      {topCustomers && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl text-foreground">Top 20 Clientes YTD</h2>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Total:{" "}
                  {formatCurrency(topCustomers.summary.topCustomersRevenue)}
                </span>
                <span>
                  {formatPercent(topCustomers.summary.topCustomersSharePct)} do
                  total
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="w-12 cursor-pointer select-none"
                      onClick={() => topCustomersSort.handleSort("rank")}
                    >
                      #{renderSortIcon("rank", topCustomersSort)}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() =>
                        topCustomersSort.handleSort("customerName")
                      }
                    >
                      Cliente
                      {renderSortIcon("customerName", topCustomersSort)}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => topCustomersSort.handleSort("salesperson")}
                    >
                      Vendedor
                      {renderSortIcon("salesperson", topCustomersSort)}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() =>
                        topCustomersSort.handleSort("invoiceCount")
                      }
                    >
                      Nº Faturas
                      {renderSortIcon("invoiceCount", topCustomersSort)}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => topCustomersSort.handleSort("netRevenue")}
                    >
                      Receita
                      {renderSortIcon("netRevenue", topCustomersSort)}
                    </TableHead>
                    {activeTab === "ytd" && (
                      <TableHead className="text-right">Ano Anterior</TableHead>
                    )}
                    {activeTab === "ytd" && (
                      <TableHead className="text-right">Var %</TableHead>
                    )}
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() =>
                        topCustomersSort.handleSort("revenueSharePct")
                      }
                    >
                      % Total
                      {renderSortIcon("revenueSharePct", topCustomersSort)}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => topCustomersSort.handleSort("lastInvoice")}
                    >
                      {activeTab === "mtd"
                        ? "Última Fatura (Mês)"
                        : "Última Fatura"}
                      {renderSortIcon("lastInvoice", topCustomersSort)}
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
                              ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`
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

      {/* Taxa de Conversão por Escalão - Company Wide */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl text-foreground">
              Taxa de Conversão por Escalão - Empresa Geral
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeTab === "mtd" ? "Mês Atual" : "Ano Atual"} ({currentYear})
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Orçamentos vs Faturas do mesmo período {currentYear}{" "}
            {activeTab === "mtd" ? "(mês corrente)" : "(ano corrente)"} -
            Agregado de todos os departamentos
          </p>
          {companyConversao && companyConversao.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() =>
                        companyConversaoSort.handleSort("escalao")
                      }
                    >
                      Escalão
                      {renderSortIcon("escalao", companyConversaoSort)}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() =>
                        companyConversaoSort.handleSort("total_orcamentos")
                      }
                    >
                      Orçamentos
                      {renderSortIcon("total_orcamentos", companyConversaoSort)}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() =>
                        companyConversaoSort.handleSort("total_faturas")
                      }
                    >
                      Faturas
                      {renderSortIcon("total_faturas", companyConversaoSort)}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() =>
                        companyConversaoSort.handleSort("taxa_conversao_pct")
                      }
                    >
                      Taxa Conv.
                      {renderSortIcon(
                        "taxa_conversao_pct",
                        companyConversaoSort
                      )}
                    </TableHead>
                    <TableHead className="text-right">% Peso</TableHead>
                    <TableHead className="text-right">
                      Valor Orç. (AVG)
                    </TableHead>
                    <TableHead className="text-right">
                      Valor Fat. (AVG)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCompanyConversao.map((row: any, idx: number) => {
                    const pesoPct =
                      companyConversaoTotals.totalOrcamentos > 0
                        ? (row.total_orcamentos /
                            companyConversaoTotals.totalOrcamentos) *
                          100
                        : 0;
                    const avgValorOrcado =
                      row.total_orcamentos > 0
                        ? (row.total_valor_orcado || 0) / row.total_orcamentos
                        : 0;
                    const avgValorFaturado =
                      row.total_faturas > 0
                        ? (row.total_valor_faturado || 0) / row.total_faturas
                        : 0;

                    return (
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
                          {pesoPct.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(avgValorOrcado)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(avgValorFaturado)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {companyConversaoTotals.totalRow && (
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell className="font-semibold">
                        {companyConversaoTotals.totalRow.escalao}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {companyConversaoTotals.totalRow.total_orcamentos}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {companyConversaoTotals.totalRow.total_faturas}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span
                          className={
                            companyConversaoTotals.totalRow.taxa_conversao_pct >=
                            30
                              ? "text-green-600 dark:text-green-400"
                              : companyConversaoTotals.totalRow
                                    .taxa_conversao_pct >= 15
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-red-600 dark:text-red-400"
                          }
                        >
                          {companyConversaoTotals.totalRow.taxa_conversao_pct.toFixed(
                            1
                          )}
                          %
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {companyConversaoTotals.totalRow.peso_pct.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(
                          companyConversaoTotals.totalRow.avg_valor_orcado
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(
                          companyConversaoTotals.totalRow.avg_valor_faturado
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">
                Sem dados disponíveis - A função SQL pode não estar aplicada
              </p>
              <p className="text-xs">
                Execute:{" "}
                <code className="bg-muted px-2 py-1 rounded">
                  npx supabase db push
                </code>
              </p>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

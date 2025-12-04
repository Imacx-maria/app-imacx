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
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { MetricCard } from "./MetricCard";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import type {
  MultiYearRevenueResponse,
  TopCustomersResponse,
} from "@/types/financial-analysis";

interface OverviewTabProps {
  activePeriodData: any;
  activeTab: "mtd" | "ytd" | "qtd";
  multiYearRevenue: MultiYearRevenueResponse | null;
  multiYearChartData: any[];
  topCustomers: TopCustomersResponse | null;
  sortedTopCustomers: any[];
  handleTopSort: (column: any) => void;
  topSortColumn: string;
  topSortDirection: "asc" | "desc";
  companyConversao: any[];
  sortedCompanyConversao: any[];
  companyConversaoTotals: any;
  handleCompanyConvSort: (column: any) => void;
  companyConvSortColumn: string;
  companyConvSortDirection: "asc" | "desc";
  currentYear: number;
}

export function OverviewTab({
  activePeriodData,
  activeTab,
  multiYearRevenue,
  multiYearChartData,
  topCustomers,
  sortedTopCustomers,
  handleTopSort,
  topSortColumn,
  topSortDirection,
  companyConversao,
  sortedCompanyConversao,
  companyConversaoTotals,
  handleCompanyConvSort,
  companyConvSortColumn,
  companyConvSortDirection,
  currentYear,
}: OverviewTabProps) {
  // Pagination state for Top Customers table
  const [topCustomersPage, setTopCustomersPage] = useState(1);
  const ITEMS_PER_PAGE = 40;

  // Pagination state for Company Conversão table
  const [conversaoPage, setConversaoPage] = useState(1);

  // Reset pagination when data changes
  useEffect(() => {
    setTopCustomersPage(1);
  }, [sortedTopCustomers.length, activeTab]);

  useEffect(() => {
    setConversaoPage(1);
  }, [sortedCompanyConversao.length, activeTab]);

  // Paginated data for Top Customers
  const topCustomersTotalPages = Math.ceil(
    sortedTopCustomers.length / ITEMS_PER_PAGE,
  );
  const paginatedTopCustomers = useMemo(() => {
    const startIndex = (topCustomersPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedTopCustomers.slice(startIndex, endIndex);
  }, [sortedTopCustomers, topCustomersPage]);

  // Paginated data for Company Conversão
  const conversaoTotalPages = Math.ceil(
    sortedCompanyConversao.length / ITEMS_PER_PAGE,
  );
  const paginatedCompanyConversao = useMemo(() => {
    const startIndex = (conversaoPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedCompanyConversao.slice(startIndex, endIndex);
  }, [sortedCompanyConversao, conversaoPage]);

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

  return (
    <div className="space-y-6">
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
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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
              <Table className="w-full table-fixed imx-table-compact">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="w-12 cursor-pointer select-none"
                      onClick={() => handleTopSort("rank")}
                    >
                      #{renderSortIcon("rank", topSortColumn, topSortDirection)}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleTopSort("customerName")}
                    >
                      Cliente
                      {renderSortIcon(
                        "customerName",
                        topSortColumn,
                        topSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleTopSort("salesperson")}
                    >
                      Vendedor
                      {renderSortIcon(
                        "salesperson",
                        topSortColumn,
                        topSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleTopSort("invoiceCount")}
                    >
                      Nº Faturas
                      {renderSortIcon(
                        "invoiceCount",
                        topSortColumn,
                        topSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleTopSort("netRevenue")}
                    >
                      Receita
                      {renderSortIcon(
                        "netRevenue",
                        topSortColumn,
                        topSortDirection,
                      )}
                    </TableHead>
                    {activeTab === "ytd" && (
                      <TableHead className="text-right">Ano Anterior</TableHead>
                    )}
                    {activeTab === "ytd" && (
                      <TableHead className="text-right">Var %</TableHead>
                    )}
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleTopSort("revenueSharePct")}
                    >
                      % Total
                      {renderSortIcon(
                        "revenueSharePct",
                        topSortColumn,
                        topSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleTopSort("lastInvoice")}
                    >
                      {activeTab === "mtd"
                        ? "Última Fatura (Mês)"
                        : "Última Fatura"}
                      {renderSortIcon(
                        "lastInvoice",
                        topSortColumn,
                        topSortDirection,
                      )}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTopCustomers.map((customer) => {
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

            {topCustomersTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
                <div className="text-muted-foreground">
                  Página {topCustomersPage} de {topCustomersTotalPages} (
                  {sortedTopCustomers.length} clientes)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setTopCustomersPage(Math.max(1, topCustomersPage - 1))
                    }
                    disabled={topCustomersPage === 1}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setTopCustomersPage(
                        Math.min(topCustomersTotalPages, topCustomersPage + 1),
                      )
                    }
                    disabled={topCustomersPage === topCustomersTotalPages}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
              <Table className="w-full table-fixed imx-table-compact">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleCompanyConvSort("escalao")}
                    >
                      Escalão
                      {renderSortIcon(
                        "escalao",
                        companyConvSortColumn,
                        companyConvSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleCompanyConvSort("total_orcamentos")}
                    >
                      Orçamentos
                      {renderSortIcon(
                        "total_orcamentos",
                        companyConvSortColumn,
                        companyConvSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleCompanyConvSort("total_faturas")}
                    >
                      Faturas
                      {renderSortIcon(
                        "total_faturas",
                        companyConvSortColumn,
                        companyConvSortDirection,
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() =>
                        handleCompanyConvSort("taxa_conversao_pct")
                      }
                    >
                      Taxa Conv.
                      {renderSortIcon(
                        "taxa_conversao_pct",
                        companyConvSortColumn,
                        companyConvSortDirection,
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
                  {paginatedCompanyConversao.map((row: any, idx: number) => {
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
                            companyConversaoTotals.totalRow
                              .taxa_conversao_pct >= 30
                              ? "text-green-600 dark:text-green-400"
                              : companyConversaoTotals.totalRow
                                    .taxa_conversao_pct >= 15
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-red-600 dark:text-red-400"
                          }
                        >
                          {companyConversaoTotals.totalRow.taxa_conversao_pct.toFixed(
                            1,
                          )}
                          %
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {companyConversaoTotals.totalRow.peso_pct.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(
                          companyConversaoTotals.totalRow.avg_valor_orcado,
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(
                          companyConversaoTotals.totalRow.avg_valor_faturado,
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {companyConversao &&
            companyConversao.length > 0 &&
            conversaoTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
                <div className="text-muted-foreground">
                  Página {conversaoPage} de {conversaoTotalPages} (
                  {sortedCompanyConversao.length} escalões)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setConversaoPage(Math.max(1, conversaoPage - 1))
                    }
                    disabled={conversaoPage === 1}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setConversaoPage(
                        Math.min(conversaoTotalPages, conversaoPage + 1),
                      )
                    }
                    disabled={conversaoPage === conversaoTotalPages}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

          {(!companyConversao || companyConversao.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">
                ⚠️ Sem dados disponíveis - A função SQL pode não estar aplicada
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
    </div>
  );
}

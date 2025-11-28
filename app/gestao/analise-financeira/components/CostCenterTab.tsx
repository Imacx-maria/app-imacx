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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import type {
  CostCenterPerformanceResponse,
  CostCenterTopCustomersResponse,
} from "@/types/financial-analysis";

interface CostCenterTabProps {
  costCenterPerformance: CostCenterPerformanceResponse | null;
  costCenterSales: any;
  sortedCostCenterSales: any[];
  handleSalesSort: (column: any) => void;
  salesSortColumn: string;
  salesSortDirection: "asc" | "desc";
  activeTab: "mtd" | "ytd" | "qtd";
  costCenterTopCustomers: CostCenterTopCustomersResponse | null;
  costCenterSelectionOptions: any[];
  selectedCostCenter: string | null;
  setSelectedCostCenter: (costCenter: string) => void;
  selectedCostCenterBlock: any;
  handleCcTopSort: (column: any) => void;
  ccTopSortColumn: string;
  ccTopSortDirection: "asc" | "desc";
  sortedCostCenterTopCustomers: any[];
}

export function CostCenterTab({
  costCenterPerformance,
  costCenterSales,
  sortedCostCenterSales,
  handleSalesSort,
  salesSortColumn,
  salesSortDirection,
  activeTab,
  costCenterTopCustomers,
  costCenterSelectionOptions,
  selectedCostCenter,
  setSelectedCostCenter,
  selectedCostCenterBlock,
  handleCcTopSort,
  ccTopSortColumn,
  ccTopSortDirection,
  sortedCostCenterTopCustomers,
}: CostCenterTabProps) {
  // Pagination state for Sales table
  const [salesPage, setSalesPage] = useState(1);
  // Pagination state for Top Customers table
  const [topCustomersPage, setTopCustomersPage] = useState(1);
  const ITEMS_PER_PAGE = 40;

  // Reset pagination when data changes
  useEffect(() => {
    setSalesPage(1);
  }, [sortedCostCenterSales.length, activeTab]);

  useEffect(() => {
    setTopCustomersPage(1);
  }, [sortedCostCenterTopCustomers.length, selectedCostCenter]);

  // Paginated data for Sales
  const salesTotalPages = Math.ceil(sortedCostCenterSales.length / ITEMS_PER_PAGE);
  const paginatedSales = useMemo(() => {
    const startIndex = (salesPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedCostCenterSales.slice(startIndex, endIndex);
  }, [sortedCostCenterSales, salesPage]);

  // Paginated data for Top Customers
  const topCustomersTotalPages = Math.ceil(sortedCostCenterTopCustomers.length / ITEMS_PER_PAGE);
  const paginatedTopCustomers = useMemo(() => {
    const startIndex = (topCustomersPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedCostCenterTopCustomers.slice(startIndex, endIndex);
  }, [sortedCostCenterTopCustomers, topCustomersPage]);

  const renderSortIcon = (
    column: string,
    currentColumn: string,
    direction: "asc" | "desc"
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
                      0
                    )
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
                      0
                    )
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
                      0
                    )
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
                      <span className="text-muted-foreground">Var YoY: </span>
                      {cc.yoyChangePct !== null
                        ? `${cc.yoyChangePct > 0 ? "+" : ""}${cc.yoyChangePct.toFixed(
                            1
                          )}%`
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
              <Table className="w-full table-fixed imx-table-compact">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSalesSort("centro_custo")}
                    >
                      Centro de Custo
                      {renderSortIcon(
                        "centro_custo",
                        salesSortColumn,
                        salesSortDirection
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSalesSort("vendas")}
                    >
                      Vendas
                      {renderSortIcon(
                        "vendas",
                        salesSortColumn,
                        salesSortDirection
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSalesSort("var_pct")}
                    >
                      Var %
                      {renderSortIcon(
                        "var_pct",
                        salesSortColumn,
                        salesSortDirection
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSalesSort("num_faturas")}
                    >
                      Nº Faturas
                      {renderSortIcon(
                        "num_faturas",
                        salesSortColumn,
                        salesSortDirection
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSalesSort("num_clientes")}
                    >
                      Nº Clientes
                      {renderSortIcon(
                        "num_clientes",
                        salesSortColumn,
                        salesSortDirection
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSalesSort("ticket_medio")}
                    >
                      Ticket Médio
                      {renderSortIcon(
                        "ticket_medio",
                        salesSortColumn,
                        salesSortDirection
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSalesSort("compras")}
                    >
                      Compras
                      {renderSortIcon(
                        "compras",
                        salesSortColumn,
                        salesSortDirection
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSalesSort("margem")}
                    >
                      Margem
                      {renderSortIcon(
                        "margem",
                        salesSortColumn,
                        salesSortDirection
                      )}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSalesSort("margem_pct")}
                    >
                      Margem %
                      {renderSortIcon(
                        "margem_pct",
                        salesSortColumn,
                        salesSortDirection
                      )}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSales.map((cc: any) => {
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
                            ? `${cc.var_pct > 0 ? "+" : ""}${cc.var_pct.toFixed(
                                1
                              )}%`
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

            {salesTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
                <div className="text-muted-foreground">
                  Página {salesPage} de {salesTotalPages} ({sortedCostCenterSales.length} centros de custo)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSalesPage(Math.max(1, salesPage - 1))}
                    disabled={salesPage === 1}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSalesPage(Math.min(salesTotalPages, salesPage + 1))}
                    disabled={salesPage === salesTotalPages}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm imx-border-t pt-4">
              <div>
                <p className="text-muted-foreground">
                  Total Vendas {activeTab === "mtd" ? "Mês Atual" : "YTD"}
                </p>
                <p className="text-lg font-normal">
                  {formatCurrency(
                    costCenterSales.costCenters.reduce(
                      (sum: number, cc: any) => sum + cc.vendas,
                      0
                    )
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
                      0
                    )
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
                      0
                    )
                  )}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Margem % Média</p>
                <p className="text-lg font-normal">
                  {(() => {
                    const totalVendas = costCenterSales.costCenters.reduce(
                      (sum: number, cc: any) => sum + cc.vendas,
                      0
                    );
                    const totalCompras = costCenterSales.costCenters.reduce(
                      (sum: number, cc: any) => sum + (cc.compras || 0),
                      0
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
                      0
                    )
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
                        selectedCostCenterBlock.summary.totalRevenue
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Nº Clientes com Receita
                    </p>
                    <p className="text-lg font-normal">
                      {formatNumber(
                        selectedCostCenterBlock.summary.totalCustomers
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Nº Faturas (YTD)</p>
                    <p className="text-lg font-normal">
                      {formatNumber(
                        selectedCostCenterBlock.summary.totalInvoices
                      )}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table className="w-full table-fixed imx-table-compact">
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="w-12 cursor-pointer select-none"
                          onClick={() => handleCcTopSort("rank")}
                        >
                          #{renderSortIcon(
                            "rank",
                            ccTopSortColumn,
                            ccTopSortDirection
                          )}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleCcTopSort("customerName")}
                        >
                          Cliente
                          {renderSortIcon(
                            "customerName",
                            ccTopSortColumn,
                            ccTopSortDirection
                          )}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => handleCcTopSort("salesperson")}
                        >
                          Vendedor
                          {renderSortIcon(
                            "salesperson",
                            ccTopSortColumn,
                            ccTopSortDirection
                          )}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleCcTopSort("invoiceCount")}
                        >
                          Nº Faturas
                          {renderSortIcon(
                            "invoiceCount",
                            ccTopSortColumn,
                            ccTopSortDirection
                          )}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleCcTopSort("quoteCount")}
                        >
                          Nº Orçamentos
                          {renderSortIcon(
                            "quoteCount",
                            ccTopSortColumn,
                            ccTopSortDirection
                          )}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleCcTopSort("conversionRate")}
                        >
                          Conversão
                          {renderSortIcon(
                            "conversionRate",
                            ccTopSortColumn,
                            ccTopSortDirection
                          )}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleCcTopSort("netRevenue")}
                        >
                          Receita
                          {renderSortIcon(
                            "netRevenue",
                            ccTopSortColumn,
                            ccTopSortDirection
                          )}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleCcTopSort("revenueSharePct")}
                        >
                          % Centro
                          {renderSortIcon(
                            "revenueSharePct",
                            ccTopSortColumn,
                            ccTopSortDirection
                          )}
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleCcTopSort("lastInvoice")}
                        >
                          Última Fatura
                          {renderSortIcon(
                            "lastInvoice",
                            ccTopSortColumn,
                            ccTopSortDirection
                          )}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTopCustomers &&
                      paginatedTopCustomers.length > 0 ? (
                        paginatedTopCustomers.map((customer) => (
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

                {topCustomersTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
                    <div className="text-muted-foreground">
                      Página {topCustomersPage} de {topCustomersTotalPages} ({sortedCostCenterTopCustomers.length} clientes)
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTopCustomersPage(Math.max(1, topCustomersPage - 1))}
                        disabled={topCustomersPage === 1}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTopCustomersPage(Math.min(topCustomersTotalPages, topCustomersPage + 1))}
                        disabled={topCustomersPage === topCustomersTotalPages}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Seleciona um centro de custo para ver o detalhe dos clientes.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// Sorting utilities for the financial analysis dashboard

import { getEscalaoOrder } from "./formatters";

export type SortDirection = "asc" | "desc";

// ============================================================================
// Sort Column Types
// ============================================================================

export type TopCustomersSortColumn =
  | "rank"
  | "customerName"
  | "salesperson"
  | "invoiceCount"
  | "netRevenue"
  | "revenueSharePct"
  | "lastInvoice";

export type CostCenterSalesSortColumn =
  | "centro_custo"
  | "vendas"
  | "var_pct"
  | "num_faturas"
  | "num_clientes"
  | "ticket_medio"
  | "compras"
  | "margem"
  | "margem_pct";

export type CostCenterPerformanceSortColumn =
  | "cost_center"
  | "receita_liquida"
  | "var_pct"
  | "num_faturas"
  | "num_clientes"
  | "ticket_medio";

export type CostCenterTopCustomersSortColumn =
  | "rank"
  | "customerName"
  | "salesperson"
  | "invoiceCount"
  | "quoteCount"
  | "conversionRate"
  | "netRevenue"
  | "revenueSharePct"
  | "lastInvoice";

export type DepartmentOrcamentosSortColumn =
  | "escaloes_valor"
  | "total_orcamentos"
  | "total_valor";

export type DepartmentFaturasSortColumn =
  | "escaloes_valor"
  | "total_faturas"
  | "total_valor";

export type DepartmentConversaoSortColumn =
  | "escalao"
  | "total_orcamentos"
  | "total_faturas"
  | "taxa_conversao_pct";

export type PipelineSortColumn =
  | "orcamento_id_humano"
  | "document_date"
  | "cliente_nome"
  | "total"
  | "dias_decorridos";

export type CompanyConversaoSortColumn =
  | "escalao"
  | "total_orcamentos"
  | "total_faturas"
  | "taxa_conversao_pct";

// ============================================================================
// Generic Sorting Helper
// ============================================================================

export function createSortHandler<T extends string>(
  currentColumn: T,
  setColumn: (col: T) => void,
  setDirection: (dir: SortDirection) => void,
  currentDirection: SortDirection
) {
  return (column: T) => {
    setDirection(
      currentColumn === column
        ? currentDirection === "asc"
          ? "desc"
          : "asc"
        : "desc"
    );
    setColumn(column);
  };
}

// ============================================================================
// Top Customers Sorting
// ============================================================================

export function sortTopCustomers<
  T extends {
    rank: number;
    customerName?: string;
    salesperson?: string;
    invoiceCount: number;
    netRevenue: number;
    revenueSharePct: number;
    lastInvoice?: string;
  }
>(customers: T[], column: TopCustomersSortColumn, direction: SortDirection): T[] {
  return customers.slice().sort((a, b) => {
    const dir = direction === "asc" ? 1 : -1;

    const getValue = (c: T) => {
      switch (column) {
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
}

// ============================================================================
// Cost Center Sales Sorting
// ============================================================================

export function sortCostCenterSales<
  T extends {
    centro_custo?: string;
    vendas: number;
    var_pct?: number;
    num_faturas: number;
    num_clientes: number;
    ticket_medio: number;
    compras?: number;
  }
>(items: T[], column: CostCenterSalesSortColumn, direction: SortDirection): T[] {
  return items.slice().sort((a, b) => {
    const dir = direction === "asc" ? 1 : -1;
    let av: string | number, bv: string | number;

    switch (column) {
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
        av = a.vendas > 0 ? ((a.vendas - (a.compras || 0)) / a.vendas) * 100 : 0;
        bv = b.vendas > 0 ? ((b.vendas - (b.compras || 0)) / b.vendas) * 100 : 0;
        break;
      default:
        av = 0;
        bv = 0;
    }

    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * dir;
    }
    return av > bv ? dir : av < bv ? -dir : 0;
  });
}

// ============================================================================
// Cost Center Performance Sorting
// ============================================================================

export function sortCostCenterPerformance<
  T extends {
    cost_center?: string;
    receita_liquida?: number;
    netRevenue?: number;
    var_pct?: number;
    num_faturas?: number;
    invoiceCount?: number;
    num_clientes?: number;
    customerCount?: number;
    ticket_medio?: number;
    avgTicket?: number;
  }
>(items: T[], column: CostCenterPerformanceSortColumn, direction: SortDirection): T[] {
  return items.slice().sort((a, b) => {
    const dir = direction === "asc" ? 1 : -1;
    let av: string | number, bv: string | number;

    switch (column) {
      case "cost_center":
        av = a.cost_center || "";
        bv = b.cost_center || "";
        break;
      case "receita_liquida":
        av = a.receita_liquida ?? a.netRevenue ?? 0;
        bv = b.receita_liquida ?? b.netRevenue ?? 0;
        break;
      case "var_pct":
        av = a.var_pct ?? -Infinity;
        bv = b.var_pct ?? -Infinity;
        break;
      case "num_faturas":
        av = a.num_faturas ?? a.invoiceCount ?? 0;
        bv = b.num_faturas ?? b.invoiceCount ?? 0;
        break;
      case "num_clientes":
        av = a.num_clientes ?? a.customerCount ?? 0;
        bv = b.num_clientes ?? b.customerCount ?? 0;
        break;
      case "ticket_medio":
        av = a.ticket_medio ?? a.avgTicket ?? 0;
        bv = b.ticket_medio ?? b.avgTicket ?? 0;
        break;
      default:
        av = 0;
        bv = 0;
    }

    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * dir;
    }
    return av > bv ? dir : av < bv ? -dir : 0;
  });
}

// ============================================================================
// Escalão-based Sorting (for conversion tables)
// ============================================================================

export function sortByEscalao<
  T extends {
    escalao?: string;
    escaloes_valor?: string;
    total_orcamentos?: number;
    total_faturas?: number;
    total_valor?: number;
    taxa_conversao_pct?: number;
  }
>(
  items: T[],
  column: DepartmentConversaoSortColumn | DepartmentOrcamentosSortColumn | DepartmentFaturasSortColumn | CompanyConversaoSortColumn,
  direction: SortDirection
): T[] {
  return items.slice().sort((a, b) => {
    const dir = direction === "asc" ? 1 : -1;
    let av: number, bv: number;

    switch (column) {
      case "escalao":
      case "escaloes_valor":
        av = getEscalaoOrder(a.escalao || a.escaloes_valor || "");
        bv = getEscalaoOrder(b.escalao || b.escaloes_valor || "");
        break;
      case "total_orcamentos":
        av = a.total_orcamentos ?? 0;
        bv = b.total_orcamentos ?? 0;
        break;
      case "total_faturas":
        av = a.total_faturas ?? 0;
        bv = b.total_faturas ?? 0;
        break;
      case "total_valor":
        av = a.total_valor ?? 0;
        bv = b.total_valor ?? 0;
        break;
      case "taxa_conversao_pct":
        av = a.taxa_conversao_pct ?? -Infinity;
        bv = b.taxa_conversao_pct ?? -Infinity;
        break;
      default:
        av = 0;
        bv = 0;
    }

    return av > bv ? dir : av < bv ? -dir : 0;
  });
}

// ============================================================================
// Pipeline Sorting
// ============================================================================

export function sortPipeline<
  T extends {
    orcamento_id_humano?: string;
    document_date?: string;
    cliente_nome?: string;
    total?: number;
    dias_decorridos?: number;
  }
>(items: T[], column: PipelineSortColumn, direction: SortDirection): T[] {
  return items.slice().sort((a, b) => {
    const dir = direction === "asc" ? 1 : -1;
    let av: string | number, bv: string | number;

    switch (column) {
      case "orcamento_id_humano":
        av = a.orcamento_id_humano || "";
        bv = b.orcamento_id_humano || "";
        break;
      case "document_date":
        av = a.document_date || "";
        bv = b.document_date || "";
        break;
      case "cliente_nome":
        av = a.cliente_nome || "";
        bv = b.cliente_nome || "";
        break;
      case "total":
        av = a.total ?? 0;
        bv = b.total ?? 0;
        break;
      case "dias_decorridos":
        av = a.dias_decorridos ?? 0;
        bv = b.dias_decorridos ?? 0;
        break;
      default:
        av = 0;
        bv = 0;
    }

    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * dir;
    }
    return av > bv ? dir : av < bv ? -dir : 0;
  });
}

// ============================================================================
// Cost Center Top Customers Sorting
// ============================================================================

export function sortCostCenterTopCustomers<
  T extends {
    rank: number;
    customerName?: string;
    salesperson?: string;
    invoiceCount?: number;
    quoteCount?: number;
    conversionRate?: number;
    netRevenue: number;
    revenueSharePct?: number;
    lastInvoice?: string;
  }
>(items: T[], column: CostCenterTopCustomersSortColumn, direction: SortDirection): T[] {
  return items.slice().sort((a, b) => {
    const dir = direction === "asc" ? 1 : -1;
    let av: string | number, bv: string | number;

    switch (column) {
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
        av = a.invoiceCount ?? 0;
        bv = b.invoiceCount ?? 0;
        break;
      case "quoteCount":
        av = a.quoteCount ?? 0;
        bv = b.quoteCount ?? 0;
        break;
      case "conversionRate":
        av = a.conversionRate ?? 0;
        bv = b.conversionRate ?? 0;
        break;
      case "netRevenue":
        av = a.netRevenue;
        bv = b.netRevenue;
        break;
      case "revenueSharePct":
        av = a.revenueSharePct ?? 0;
        bv = b.revenueSharePct ?? 0;
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
  });
}

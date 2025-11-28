"use client";

import { useState, useCallback } from "react";
import type { SortDirection } from "../utils/sorting";

export interface SortingState<T extends string> {
  column: T;
  direction: SortDirection;
  handleSort: (column: T) => void;
}

export function useSortingState<T extends string>(
  defaultColumn: T,
  defaultDirection: SortDirection = "desc"
): SortingState<T> {
  const [column, setColumn] = useState<T>(defaultColumn);
  const [direction, setDirection] = useState<SortDirection>(defaultDirection);

  const handleSort = useCallback(
    (newColumn: T) => {
      if (column === newColumn) {
        setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setColumn(newColumn);
        setDirection("desc");
      }
    },
    [column]
  );

  return { column, direction, handleSort };
}

// Pre-configured sorting hooks for specific tables
export function useTopCustomersSorting() {
  return useSortingState<
    | "rank"
    | "customerName"
    | "salesperson"
    | "invoiceCount"
    | "netRevenue"
    | "revenueSharePct"
    | "lastInvoice"
  >("netRevenue", "desc");
}

export function useCostCenterSalesSorting() {
  return useSortingState<
    | "centro_custo"
    | "vendas"
    | "var_pct"
    | "num_faturas"
    | "num_clientes"
    | "ticket_medio"
    | "compras"
    | "margem"
    | "margem_pct"
  >("vendas", "desc");
}

export function useCostCenterPerformanceSorting() {
  return useSortingState<
    | "cost_center"
    | "receita_liquida"
    | "var_pct"
    | "num_faturas"
    | "num_clientes"
    | "ticket_medio"
  >("receita_liquida", "desc");
}

export function useCostCenterTopCustomersSorting() {
  return useSortingState<
    | "rank"
    | "customerName"
    | "salesperson"
    | "invoiceCount"
    | "quoteCount"
    | "conversionRate"
    | "netRevenue"
    | "revenueSharePct"
    | "lastInvoice"
  >("rank", "asc");
}

export function useDepartmentOrcamentosSorting() {
  return useSortingState<"escaloes_valor" | "total_orcamentos" | "total_valor">(
    "escaloes_valor",
    "asc"
  );
}

export function useDepartmentFaturasSorting() {
  return useSortingState<"escaloes_valor" | "total_faturas" | "total_valor">(
    "escaloes_valor",
    "asc"
  );
}

export function useDepartmentConversaoSorting() {
  return useSortingState<
    "escalao" | "total_orcamentos" | "total_faturas" | "taxa_conversao_pct"
  >("escalao", "asc");
}

export function usePipelineSorting(
  defaultColumn:
    | "orcamento_id_humano"
    | "document_date"
    | "cliente_nome"
    | "total"
    | "dias_decorridos" = "total"
) {
  return useSortingState<
    | "orcamento_id_humano"
    | "document_date"
    | "cliente_nome"
    | "total"
    | "dias_decorridos"
  >(defaultColumn, "desc");
}

export function useCompanyConversaoSorting() {
  return useSortingState<
    "escalao" | "total_orcamentos" | "total_faturas" | "taxa_conversao_pct"
  >("escalao", "asc");
}

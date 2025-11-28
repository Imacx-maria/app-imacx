"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PermissionGuard from "@/components/PermissionGuard";
import { FaturacaoTable } from "./components/FaturacaoTable";
import { FilterBar } from "./components/FilterBar";
import { useFaturacaoData } from "./hooks/useFaturacaoData";
import { useFaturacaoFilters } from "./hooks/useFaturacaoFilters";
import { ItemRow, SortConfig } from "./types";

export default function FaturacaoPage() {
  // State management
  const [jobsTab, setJobsTab] = useState<"por_facturar" | "facturados">(
    "por_facturar",
  );
  const [subTab, setSubTab] = useState<"em_curso" | "pendentes">("em_curso");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 40;

  // Custom hooks
  const { filters, debouncedFilters, setFilter, clearFilters } =
    useFaturacaoFilters();

  // Fetch ALL filtered data (regardless of tabs)
  const {
    items: allFilteredItems,
    loading,
    isRefreshing,
    refresh,
    toggleFacturado,
  } = useFaturacaoData({
    filters: debouncedFilters,
  });

  // Sorting state
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([
    { column: "numero_fo", direction: "desc" },
  ]);

  // Toggle sort handler
  const handleSort = (column: string, isShiftKey: boolean) => {
    if (isShiftKey) {
      const existingIndex = sortConfigs.findIndex(
        (config) => config.column === column,
      );
      if (existingIndex >= 0) {
        const newConfigs = [...sortConfigs];
        newConfigs[existingIndex].direction =
          newConfigs[existingIndex].direction === "asc" ? "desc" : "asc";
        setSortConfigs(newConfigs);
      } else {
        setSortConfigs([...sortConfigs, { column, direction: "asc" }]);
      }
    } else {
      const existingConfig = sortConfigs.find(
        (config) => config.column === column,
      );
      if (sortConfigs.length === 1 && existingConfig) {
        setSortConfigs([
          {
            column,
            direction: existingConfig.direction === "asc" ? "desc" : "asc",
          },
        ]);
      } else {
        setSortConfigs([{ column, direction: "asc" }]);
      }
    }
  };

  // Helper to get sort value
  const getSortValue = useCallback((item: ItemRow, column: string): any => {
    switch (column) {
      case "numero_fo":
        return item.numero_fo;
      case "numero_orc":
        return item.numero_orc || 0;
      case "nome_campanha":
        return item.nome_campanha;
      case "cliente":
        return item.cliente || "";
      case "descricao":
        return item.descricao || "";
      case "created_at":
        return new Date(item.created_at || "").getTime();
      case "data_saida":
        return item.data_saida ? new Date(item.data_saida).getTime() : 0;
      case "dias":
        return item.dias_trabalho || 0;
      case "concluido":
        return item.concluido ? 1 : 0;
      default:
        return "";
    }
  }, []);

  // Filter items by current tabs
  const items = useMemo(() => {
    let filtered = [...allFilteredItems];

    if (jobsTab === "por_facturar") {
      filtered = filtered.filter((item) => !item.facturado);

      if (subTab === "pendentes") {
        filtered = filtered.filter((item) => item.pendente);
      } else {
        filtered = filtered.filter((item) => !item.pendente);
      }
    } else {
      // facturados tab
      filtered = filtered.filter((item) => item.facturado);
    }

    return filtered;
  }, [allFilteredItems, jobsTab, subTab]);

  // Compute tab counts from all filtered items
  const tabCounts = useMemo(() => {
    const porFacturar = allFilteredItems.filter((item) => !item.facturado);
    const emCurso = porFacturar.filter((item) => !item.pendente).length;
    const pendentes = porFacturar.filter((item) => item.pendente).length;
    const facturados = allFilteredItems.filter((item) => item.facturado).length;

    return { emCurso, pendentes, facturados };
  }, [allFilteredItems]);

  // Sort and paginate items
  const sortedItems = useMemo(() => {
    let sorted = [...items];
    sorted.sort((a, b) => {
      for (const config of sortConfigs) {
        const aValue = getSortValue(a, config.column);
        const bValue = getSortValue(b, config.column);

        if (aValue < bValue) return config.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return config.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [items, sortConfigs, getSortValue]);

  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedItems.slice(startIndex, endIndex);
  }, [sortedItems, currentPage, ITEMS_PER_PAGE]);

  // Reset to page 1 when data changes or filters/tabs change
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length, jobsTab, subTab, debouncedFilters]);

  return (
    <PermissionGuard>
      <div className="w-full space-y-6 px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Gestão de Faturação
          </h1>
          <p className="text-muted-foreground">
            Gerenciar faturação de trabalhos
          </p>
        </div>

        {/* Global Filters - ABOVE ALL TABS */}
        <FilterBar
          filters={filters}
          onFilterChange={setFilter}
          onClear={clearFilters}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
        />

        <Tabs
          value={jobsTab}
          onValueChange={(value: any) => setJobsTab(value)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="por_facturar">Por Facturar</TabsTrigger>
            <TabsTrigger value="facturados">
              Facturados ({tabCounts.facturados})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="por_facturar" className="space-y-4">
            <Tabs
              value={subTab}
              onValueChange={(value: any) => setSubTab(value)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="em_curso">
                  Em Curso ({tabCounts.emCurso})
                </TabsTrigger>
                <TabsTrigger value="pendentes">
                  Pendentes ({tabCounts.pendentes})
                </TabsTrigger>
              </TabsList>

              <TabsContent
                key="em_curso"
                value="em_curso"
                className="space-y-4"
              >
                <FaturacaoTable
                  items={paginatedItems}
                  sortConfigs={sortConfigs}
                  onSort={handleSort}
                  onToggleFacturado={toggleFacturado}
                  loading={loading}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </TabsContent>

              <TabsContent
                key="pendentes"
                value="pendentes"
                className="space-y-4"
              >
                <FaturacaoTable
                  items={paginatedItems}
                  sortConfigs={sortConfigs}
                  onSort={handleSort}
                  onToggleFacturado={toggleFacturado}
                  loading={loading}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="facturados" className="space-y-4">
            <FaturacaoTable
              items={paginatedItems}
              sortConfigs={sortConfigs}
              onSort={handleSort}
              onToggleFacturado={toggleFacturado}
              loading={loading}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}

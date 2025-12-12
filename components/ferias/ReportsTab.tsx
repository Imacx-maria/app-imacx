"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RotateCw,
  Download,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";
import {
  useVacationSummary,
  useDepartamentos,
  useRHEmployees,
} from "@/hooks/useFerias";
import { useDebounce } from "@/hooks/useDebounce";
import {
  formatVacationBalance,
  getVacationStatus,
} from "@/utils/ferias/vacationHelpers";

const ITEMS_PER_PAGE = 40;

type SortColumn = "name" | "departamento" | "remaining" | "used";
type SortDirection = "asc" | "desc";

export default function ReportsTab() {
  // State
  const [searchFilter, setSearchFilter] = useState("");
  const [departamentoFilter, setDepartamentoFilter] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("remaining");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Debounced search
  const debouncedSearch = useDebounce(searchFilter, 300);

  // Hooks
  const { summary, totals, loading, error, refresh } = useVacationSummary(
    departamentoFilter ? parseInt(departamentoFilter) : undefined,
  );
  const { departamentos } = useDepartamentos();
  const { employees: employeesForDeptFilter } = useRHEmployees({
    is_active: true,
  });

  const departamentosWithPeople = useMemo(() => {
    if (!employeesForDeptFilter.length) return departamentos;
    const deptIds = new Set(
      employeesForDeptFilter
        .map((e) => e.departamento_id)
        .filter((id): id is number => typeof id === "number"),
    );
    return departamentos.filter((d) => deptIds.has(d.id));
  }, [departamentos, employeesForDeptFilter]);

  // Filter and sort summary
  const filteredAndSortedSummary = useMemo(() => {
    // First filter by search
    let filtered = summary;
    if (debouncedSearch.trim()) {
      const search = debouncedSearch.toLowerCase();
      filtered = summary.filter(
        (s) =>
          s.employee_name.toLowerCase().includes(search) ||
          s.employee_sigla.toLowerCase().includes(search),
      );
    }

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "name":
          comparison = a.employee_name.localeCompare(b.employee_name);
          break;
        case "departamento":
          comparison = (a.departamento_nome || "").localeCompare(
            b.departamento_nome || "",
          );
          break;
        case "remaining":
          comparison = a.remaining - b.remaining;
          break;
        case "used":
          comparison = a.current_used - b.current_used;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [summary, sortColumn, sortDirection, debouncedSearch]);

  const totalPages = Math.ceil(
    filteredAndSortedSummary.length / ITEMS_PER_PAGE,
  );
  const paginatedSummary = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedSummary.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE,
    );
  }, [filteredAndSortedSummary, currentPage]);

  // Handlers
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const { exportVacationReportsToExcel } =
        await import("@/utils/ferias/exportVacationReportsToExcel");
      await exportVacationReportsToExcel({
        rows: filteredAndSortedSummary,
        fileName: `ferias_relatorio_saldos_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
    } catch (err) {
      console.error("Failed to export vacation report", err);
    } finally {
      setIsExporting(false);
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column)
      return <span className="inline-block w-3 h-3 ml-1" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="inline-block h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="inline-block h-3 w-3 ml-1" />
    );
  };

  const handleClearFilters = () => {
    setSearchFilter("");
    setDepartamentoFilter("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Relatorios</h2>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => refresh()}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleExportExcel}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar Excel</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Pesquisar nome ou sigla..."
          value={searchFilter}
          onChange={(e) => {
            setSearchFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="h-10 w-96"
        />
        <Select
          value={departamentoFilter || "all"}
          onValueChange={(value) => {
            setDepartamentoFilter(value === "all" ? "" : value);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-48">
            <SelectValue placeholder="Todos os departamentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {departamentosWithPeople.map((dept) => (
              <SelectItem key={dept.id} value={String(dept.id)}>
                {dept.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={handleClearFilters}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Limpar filtros</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Balance Table */}
      <div className="bg-background w-full">
        <Table className="w-full table-fixed imx-table-compact">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px] imx-border-b text-center">
                Sigla
              </TableHead>
              <TableHead
                className="cursor-pointer imx-border-b select-none"
                onClick={() => handleSort("name")}
              >
                Nome
                <SortIcon column="name" />
              </TableHead>
              <TableHead
                className="w-[240px] cursor-pointer imx-border-b select-none whitespace-nowrap"
                onClick={() => handleSort("departamento")}
              >
                Dept
                <SortIcon column="departamento" />
              </TableHead>
              <TableHead className="w-[80px] imx-border-b text-center">
                Anterior
              </TableHead>
              <TableHead className="w-[80px] imx-border-b text-center">
                Atual
              </TableHead>
              <TableHead
                className="w-[80px] cursor-pointer imx-border-b text-center select-none"
                onClick={() => handleSort("used")}
              >
                Usado
                <SortIcon column="used" />
              </TableHead>
              <TableHead
                className="w-[80px] cursor-pointer imx-border-b text-center select-none"
                onClick={() => handleSort("remaining")}
              >
                Restante
                <SortIcon column="remaining" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
                </TableCell>
              </TableRow>
            ) : paginatedSummary.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Nenhum colaborador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginatedSummary.map((row) => {
                const status = getVacationStatus(
                  row.remaining,
                  row.previous_balance + row.current_total,
                );
                const statusClass =
                  status === "critical"
                    ? "text-destructive"
                    : status === "warning"
                      ? "text-warning"
                      : "";

                return (
                  <TableRow key={row.employee_id}>
                    <TableCell className="w-[70px] text-center">
                      {row.employee_sigla}
                    </TableCell>
                    <TableCell>{row.employee_name}</TableCell>
                    <TableCell className="w-[240px] truncate">
                      {row.departamento_nome || "-"}
                    </TableCell>
                    <TableCell className="w-[80px] text-center">
                      {formatVacationBalance(row.previous_balance)}
                    </TableCell>
                    <TableCell className="w-[80px] text-center">
                      {formatVacationBalance(row.current_total)}
                    </TableCell>
                    <TableCell className="w-[80px] text-center">
                      {formatVacationBalance(row.current_used)}
                    </TableCell>
                    <TableCell
                      className={`w-[80px] text-center ${statusClass}`}
                    >
                      {formatVacationBalance(row.remaining)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
          <div className="text-muted-foreground">
            Pagina {currentPage} de {totalPages} (
            {filteredAndSortedSummary.length} colaboradores)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  RotateCw,
  Edit,
  Trash2,
  X,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  useEmployeeSituations,
  useRHEmployees,
  useSituationTypes,
  useDepartamentos,
} from "@/hooks/useFerias";
import AbsenceForm from "./AbsenceForm";
import DatePicker from "@/components/ui/DatePicker";
import type {
  EmployeeSituationWithDetails,
  SituationFilters,
} from "@/types/ferias";
import {
  formatDateDisplay,
  formatVacationBalance,
} from "@/utils/ferias/vacationHelpers";

const ITEMS_PER_PAGE = 40;

type SortColumn = "employee" | "type" | "start_date" | "end_date" | "days";
type SortDirection = "asc" | "desc";

interface AbsencesTabProps {
  onDataChange?: () => void;
}

export default function AbsencesTab({ onDataChange }: AbsencesTabProps) {
  // State
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [startDateFilter, setStartDateFilter] = useState<Date | undefined>(
    undefined,
  );
  const [endDateFilter, setEndDateFilter] = useState<Date | undefined>(
    undefined,
  );

  // Debounced search for employee
  const debouncedEmployeeSearch = useDebounce(employeeSearch, 300);
  const [sortColumn, setSortColumn] = useState<SortColumn>("start_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingSituation, setEditingSituation] =
    useState<EmployeeSituationWithDetails | null>(null);

  // Build filters (employee search is handled client-side)
  const filters: SituationFilters = useMemo(
    () => ({
      situation_type_id: typeFilter || undefined,
      start_date: startDateFilter?.toISOString().split("T")[0],
      end_date: endDateFilter?.toISOString().split("T")[0],
    }),
    [typeFilter, startDateFilter, endDateFilter],
  );

  // Hooks
  const { situations, loading, error, refresh, deleteSituation } =
    useEmployeeSituations(filters);
  const { employees } = useRHEmployees({ is_active: true });
  const { situationTypes } = useSituationTypes();
  const { departamentos } = useDepartamentos();

  // Sort, filter by employee search, and paginate
  const sortedSituations = useMemo(() => {
    // First filter by employee search
    let filtered = situations;
    if (debouncedEmployeeSearch.trim()) {
      const search = debouncedEmployeeSearch.toLowerCase();
      filtered = situations.filter(
        (s) =>
          s.employee?.name.toLowerCase().includes(search) ||
          s.employee?.sigla.toLowerCase().includes(search),
      );
    }

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "employee":
          comparison = (a.employee?.name || "").localeCompare(
            b.employee?.name || "",
          );
          break;
        case "type":
          comparison = (a.situation_type?.name || "").localeCompare(
            b.situation_type?.name || "",
          );
          break;
        case "start_date":
          comparison =
            new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
          break;
        case "end_date":
          comparison =
            new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
          break;
        case "days":
          comparison = a.business_days - b.business_days;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [situations, sortColumn, sortDirection, debouncedEmployeeSearch]);

  const totalPages = Math.ceil(sortedSituations.length / ITEMS_PER_PAGE);
  const paginatedSituations = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedSituations.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedSituations, currentPage]);

  // Reset pagination when filters change
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Handlers
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleClearFilters = () => {
    setEmployeeSearch("");
    setTypeFilter("");
    setStartDateFilter(undefined);
    setEndDateFilter(undefined);
    resetPagination();
  };

  const handleEdit = (situation: EmployeeSituationWithDetails) => {
    setEditingSituation(situation);
    setIsSheetOpen(true);
  };

  const handleDelete = async (situation: EmployeeSituationWithDetails) => {
    const employeeName = situation.employee?.name || "colaborador";
    if (
      !confirm(
        `Tem certeza que deseja eliminar esta ausencia de ${employeeName}?`,
      )
    )
      return;

    try {
      await deleteSituation(situation.id);
      onDataChange?.();
    } catch (err: any) {
      alert(`Erro ao eliminar: ${err.message}`);
    }
  };

  const handleFormSuccess = () => {
    setIsSheetOpen(false);
    setEditingSituation(null);
    refresh();
    onDataChange?.();
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Ausencias</h2>
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
                  onClick={() => {
                    setEditingSituation(null);
                    setIsSheetOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Registar Ausencia</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Pesquisar colaborador..."
          value={employeeSearch}
          onChange={(e) => {
            setEmployeeSearch(e.target.value);
            resetPagination();
          }}
          className="h-10 w-96"
        />
        <Select
          value={typeFilter || "all"}
          onValueChange={(value) => {
            setTypeFilter(value === "all" ? "" : value);
            resetPagination();
          }}
        >
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {situationTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.code} - {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">De:</span>
          <DatePicker
            value={startDateFilter}
            onChange={(date) => {
              setStartDateFilter(date);
              resetPagination();
            }}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">Ate:</span>
          <DatePicker
            value={endDateFilter}
            onChange={(date) => {
              setEndDateFilter(date);
              resetPagination();
            }}
          />
        </div>
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

      {/* Table */}
      <div className="bg-background w-full">
        <Table className="w-full table-fixed imx-table-compact">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px] imx-border-b text-center">
                Sigla
              </TableHead>
              <TableHead
                className="cursor-pointer imx-border-b select-none"
                onClick={() => handleSort("employee")}
              >
                Colaborador
                <SortIcon column="employee" />
              </TableHead>
              <TableHead
                className="w-[140px] cursor-pointer imx-border-b select-none"
                onClick={() => handleSort("type")}
              >
                Tipo
                <SortIcon column="type" />
              </TableHead>
              <TableHead
                className="w-[100px] cursor-pointer imx-border-b text-center select-none"
                onClick={() => handleSort("start_date")}
              >
                Inicio
                <SortIcon column="start_date" />
              </TableHead>
              <TableHead
                className="w-[100px] cursor-pointer imx-border-b text-center select-none"
                onClick={() => handleSort("end_date")}
              >
                Fim
                <SortIcon column="end_date" />
              </TableHead>
              <TableHead
                className="w-[80px] cursor-pointer imx-border-b text-center select-none"
                onClick={() => handleSort("days")}
              >
                Dias
                <SortIcon column="days" />
              </TableHead>
              <TableHead className="w-[90px] imx-border-b text-center">
                Acoes
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
            ) : paginatedSituations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Nenhuma ausencia encontrada.
                </TableCell>
              </TableRow>
            ) : (
              paginatedSituations.map((situation) => (
                <TableRow key={situation.id}>
                  <TableCell className="w-[80px] text-center">
                    {situation.employee?.sigla || "-"}
                  </TableCell>
                  <TableCell>{situation.employee?.name || "-"}</TableCell>
                  <TableCell className="w-[140px]">
                    <span className="text-xs">
                      {situation.situation_type?.code} -{" "}
                      {situation.situation_type?.name}
                    </span>
                  </TableCell>
                  <TableCell className="w-[100px] text-center">
                    {formatDateDisplay(situation.start_date)}
                  </TableCell>
                  <TableCell className="w-[100px] text-center">
                    {formatDateDisplay(situation.end_date)}
                  </TableCell>
                  <TableCell className="w-[80px] text-center">
                    {formatVacationBalance(situation.business_days)}
                  </TableCell>
                  <TableCell className="w-[90px]">
                    <div className="flex justify-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="default"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(situation)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDelete(situation)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
          <div className="text-muted-foreground">
            Pagina {currentPage} de {totalPages} ({sortedSituations.length}{" "}
            ausencias)
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

      {/* Absence Form Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editingSituation ? "Editar Ausencia" : "Registar Ausencia"}
            </SheetTitle>
            <SheetDescription>
              {editingSituation
                ? "Atualize os dados da ausencia"
                : "Preencha os dados para registar uma ausencia"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <AbsenceForm
              situation={editingSituation}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setIsSheetOpen(false);
                setEditingSituation(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

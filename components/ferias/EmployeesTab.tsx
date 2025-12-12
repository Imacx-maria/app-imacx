"use client";

import { useState, useMemo, useCallback } from "react";
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
import { useRHEmployees, useDepartamentos } from "@/hooks/useFerias";
import { useDebounce } from "@/hooks/useDebounce";
import EmployeeForm from "./EmployeeForm";
import VacationBalanceCard from "./VacationBalanceCard";
import type { RHEmployeeWithDepartment, EmployeeFilters } from "@/types/ferias";
import { CONTRACT_TYPE_LABELS } from "@/types/ferias";
import {
  formatDateDisplay,
  formatVacationBalance,
  calculateRemainingDays,
} from "@/utils/ferias/vacationHelpers";

const ITEMS_PER_PAGE = 40;

type SortColumn =
  | "sigla"
  | "name"
  | "departamento"
  | "contract_type"
  | "remaining";
type SortDirection = "asc" | "desc";

interface EmployeesTabProps {
  onDataChange?: () => void;
}

export default function EmployeesTab({ onDataChange }: EmployeesTabProps) {
  // State
  const [searchFilter, setSearchFilter] = useState("");
  const [departamentoFilter, setDepartamentoFilter] = useState<string>("");
  const [contractTypeFilter, setContractTypeFilter] = useState<string>("");
  const [isActiveFilter, setIsActiveFilter] = useState<string>("true");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] =
    useState<RHEmployeeWithDepartment | null>(null);
  const [selectedEmployee, setSelectedEmployee] =
    useState<RHEmployeeWithDepartment | null>(null);

  // Debounced search
  const debouncedSearch = useDebounce(searchFilter, 300);
  const effectiveSearch =
    debouncedSearch.trim().length >= 2 ? debouncedSearch : "";

  // Build filters
  const filters: EmployeeFilters = useMemo(
    () => ({
      search: effectiveSearch || undefined,
      departamento_id: departamentoFilter
        ? parseInt(departamentoFilter)
        : undefined,
      contract_type: contractTypeFilter as
        | "contract"
        | "freelancer"
        | undefined,
      is_active: isActiveFilter === "" ? undefined : isActiveFilter === "true",
    }),
    [effectiveSearch, departamentoFilter, contractTypeFilter, isActiveFilter],
  );

  // Hooks
  const { employees, loading, error, refresh, deleteEmployee } =
    useRHEmployees(filters);
  const { departamentos } = useDepartamentos();
  const { employees: employeesForDeptFilter } = useRHEmployees({
    is_active: isActiveFilter === "" ? undefined : isActiveFilter === "true",
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

  // Sort and paginate
  const sortedEmployees = useMemo(() => {
    const sorted = [...employees].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "sigla":
          comparison = a.sigla.localeCompare(b.sigla);
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "departamento":
          comparison = (a.departamento?.nome || "").localeCompare(
            b.departamento?.nome || "",
          );
          break;
        case "contract_type":
          comparison = a.contract_type.localeCompare(b.contract_type);
          break;
        case "remaining":
          const aRemaining = calculateRemainingDays(
            a.previous_year_balance,
            a.current_year_total || 0,
            a.current_year_used,
          );
          const bRemaining = calculateRemainingDays(
            b.previous_year_balance,
            b.current_year_total || 0,
            b.current_year_used,
          );
          comparison = aRemaining - bRemaining;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [employees, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedEmployees, currentPage]);

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
    setSearchFilter("");
    setDepartamentoFilter("");
    setContractTypeFilter("");
    setIsActiveFilter("true");
    resetPagination();
  };

  const handleEdit = (employee: RHEmployeeWithDepartment) => {
    setEditingEmployee(employee);
    setIsSheetOpen(true);
  };

  const handleDelete = async (employee: RHEmployeeWithDepartment) => {
    if (!confirm(`Tem certeza que deseja eliminar ${employee.name}?`)) return;

    try {
      await deleteEmployee(employee.id);
      onDataChange?.();
    } catch (err: any) {
      alert(`Erro ao eliminar: ${err.message}`);
    }
  };

  const handleFormSuccess = () => {
    setIsSheetOpen(false);
    setEditingEmployee(null);
    refresh();
    onDataChange?.();
  };

  const handleViewBalance = (employee: RHEmployeeWithDepartment) => {
    setSelectedEmployee(employee);
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
        <h2 className="text-lg">Colaboradores</h2>
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
                    setEditingEmployee(null);
                    setIsSheetOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Adicionar Colaborador</TooltipContent>
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
            resetPagination();
          }}
          className="h-10 w-96"
        />
        <Select
          value={departamentoFilter || "all"}
          onValueChange={(value) => {
            setDepartamentoFilter(value === "all" ? "" : value);
            resetPagination();
          }}
        >
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="Departamento" />
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
        <Select
          value={contractTypeFilter || "all"}
          onValueChange={(value) => {
            setContractTypeFilter(value === "all" ? "" : value);
            resetPagination();
          }}
        >
          <SelectTrigger className="h-10 w-32">
            <SelectValue placeholder="Contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="contract">Contrato</SelectItem>
            <SelectItem value="freelancer">Freelancer</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={isActiveFilter || "all"}
          onValueChange={(value) => {
            setIsActiveFilter(value === "all" ? "" : value);
            resetPagination();
          }}
        >
          <SelectTrigger className="h-10 w-28">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativos</SelectItem>
            <SelectItem value="false">Inativos</SelectItem>
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

      {/* Table */}
      <div className="bg-background w-full">
        <Table className="w-full table-fixed imx-table-compact">
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-[80px] cursor-pointer imx-border-b text-center select-none"
                onClick={() => handleSort("sigla")}
              >
                Sigla
                <SortIcon column="sigla" />
              </TableHead>
              <TableHead
                className="cursor-pointer imx-border-b select-none"
                onClick={() => handleSort("name")}
              >
                Nome
                <SortIcon column="name" />
              </TableHead>
              <TableHead
                className="w-[140px] cursor-pointer imx-border-b select-none"
                onClick={() => handleSort("departamento")}
              >
                Departamento
                <SortIcon column="departamento" />
              </TableHead>
              <TableHead
                className="w-[130px] cursor-pointer imx-border-b text-center select-none"
                onClick={() => handleSort("contract_type")}
              >
                Contrato
                <SortIcon column="contract_type" />
              </TableHead>
              <TableHead className="w-[100px] imx-border-b text-center">
                Admissao
              </TableHead>
              <TableHead
                className="w-[120px] cursor-pointer imx-border-b text-center select-none"
                onClick={() => handleSort("remaining")}
              >
                Restantes
                <SortIcon column="remaining" />
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
            ) : paginatedEmployees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Nenhum colaborador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginatedEmployees.map((employee) => {
                const remaining = calculateRemainingDays(
                  employee.previous_year_balance,
                  employee.current_year_total || 0,
                  employee.current_year_used,
                );
                return (
                  <TableRow
                    key={employee.id}
                    className={!employee.is_active ? "opacity-50" : ""}
                  >
                    <TableCell className="w-[80px] text-center">
                      {employee.sigla}
                    </TableCell>
                    <TableCell>
                      <button
                        className="text-left hover:underline"
                        onClick={() => handleViewBalance(employee)}
                      >
                        {employee.name}
                      </button>
                    </TableCell>
                    <TableCell className="w-[140px]">
                      {employee.departamento?.nome || "-"}
                    </TableCell>
                    <TableCell className="w-[130px] text-center">
                      {CONTRACT_TYPE_LABELS[employee.contract_type]}
                    </TableCell>
                    <TableCell className="w-[100px] text-center">
                      {formatDateDisplay(employee.admission_date)}
                    </TableCell>
                    <TableCell className="w-[120px] text-center">
                      {formatVacationBalance(remaining)}
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
                                onClick={() => handleEdit(employee)}
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
                                onClick={() => handleDelete(employee)}
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
            Pagina {currentPage} de {totalPages} ({sortedEmployees.length}{" "}
            colaboradores)
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

      {/* Employee Form Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editingEmployee ? "Editar Colaborador" : "Novo Colaborador"}
            </SheetTitle>
            <SheetDescription>
              {editingEmployee
                ? "Atualize as informacoes do colaborador"
                : "Preencha os dados para criar um novo colaborador"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <EmployeeForm
              employee={editingEmployee}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setIsSheetOpen(false);
                setEditingEmployee(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Vacation Balance Sheet */}
      <Sheet
        open={!!selectedEmployee}
        onOpenChange={() => setSelectedEmployee(null)}
      >
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Saldo de Ferias</SheetTitle>
            <SheetDescription>
              {selectedEmployee?.name} ({selectedEmployee?.sigla})
            </SheetDescription>
          </SheetHeader>
          {selectedEmployee && (
            <div className="mt-6">
              <VacationBalanceCard employee={selectedEmployee} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

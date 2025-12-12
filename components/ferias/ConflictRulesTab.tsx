"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  RotateCw,
  Edit,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  Users,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useVacationConflictRules, useRHEmployees } from "@/hooks/useFerias";
import { useDebounce } from "@/hooks/useDebounce";
import ConflictRuleForm from "./ConflictRuleForm";
import type { VacationConflictRuleWithMembers } from "@/types/ferias";

const ITEMS_PER_PAGE = 40;

interface ConflictRulesTabProps {
  onDataChange?: () => void;
}

export default function ConflictRulesTab({
  onDataChange,
}: ConflictRulesTabProps) {
  // State
  const [searchFilter, setSearchFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingRule, setEditingRule] =
    useState<VacationConflictRuleWithMembers | null>(null);
  const [deleteConfirmRule, setDeleteConfirmRule] =
    useState<VacationConflictRuleWithMembers | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  // Debounced search
  const debouncedSearch = useDebounce(searchFilter, 300);

  // Hooks
  const { rules, loading, error, refresh, deleteRule, deleteSubRule } =
    useVacationConflictRules();
  const { employees } = useRHEmployees({ is_active: true });

  // Filter rules based on search
  const filteredRules = useMemo(() => {
    if (!debouncedSearch.trim()) return rules;

    const searchLower = debouncedSearch.toLowerCase();
    return rules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(searchLower) ||
        rule.description?.toLowerCase().includes(searchLower) ||
        rule.members.some(
          (m) =>
            m.name.toLowerCase().includes(searchLower) ||
            m.sigla.toLowerCase().includes(searchLower),
        ),
    );
  }, [rules, debouncedSearch]);

  // Paginate filtered rules
  const totalPages = Math.ceil(filteredRules.length / ITEMS_PER_PAGE);
  const paginatedRules = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRules.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRules, currentPage]);

  // Reset pagination when filters change
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Handlers
  const handleClearFilters = () => {
    setSearchFilter("");
    resetPagination();
  };

  const handleEdit = (rule: VacationConflictRuleWithMembers) => {
    setEditingRule(rule);
    setIsSheetOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmRule) return;

    try {
      await deleteRule(deleteConfirmRule.id);
      setDeleteConfirmRule(null);
      onDataChange?.();
    } catch (err: any) {
      alert(`Erro ao eliminar: ${err.message}`);
    }
  };

  const handleDeleteSubRule = async (subRuleId: string) => {
    if (!confirm("Tem certeza que deseja eliminar esta sub-regra?")) return;

    try {
      await deleteSubRule(subRuleId);
      onDataChange?.();
    } catch (err: any) {
      alert(`Erro ao eliminar sub-regra: ${err.message}`);
    }
  };

  const handleFormSuccess = () => {
    setIsSheetOpen(false);
    setEditingRule(null);
    refresh();
    onDataChange?.();
  };

  const toggleExpanded = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg">Regras de Conflito</h2>
          <p className="text-sm text-muted-foreground">
            Define grupos de colaboradores que nao podem estar ausentes ao mesmo
            tempo
          </p>
        </div>
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
                    setEditingRule(null);
                    setIsSheetOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Nova Regra</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Pesquisar regra ou colaborador..."
          value={searchFilter}
          onChange={(e) => {
            setSearchFilter(e.target.value);
            resetPagination();
          }}
          className="h-10 w-96"
        />
        {searchFilter && (
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
              <TooltipContent>Limpar filtro</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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
              <TableHead className="w-[40px] imx-border-b"></TableHead>
              <TableHead className="w-[200px] imx-border-b">Nome</TableHead>
              <TableHead className="imx-border-b">Membros</TableHead>
              <TableHead className="w-[120px] imx-border-b text-center">
                Max Ausentes
              </TableHead>
              <TableHead className="w-[80px] imx-border-b text-center">
                Estado
              </TableHead>
              <TableHead className="w-[90px] imx-border-b text-center">
                Acoes
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
                </TableCell>
              </TableRow>
            ) : paginatedRules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  {rules.length === 0
                    ? "Nenhuma regra definida. Crie uma nova regra para comecar."
                    : "Nenhuma regra encontrada."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedRules.map((rule) => {
                const isExpanded = expandedRules.has(rule.id);
                const hasSubRules = rule.sub_rules && rule.sub_rules.length > 0;

                return (
                  <>
                    <TableRow
                      key={rule.id}
                      className={!rule.is_active ? "opacity-50" : ""}
                    >
                      <TableCell className="text-center">
                        {hasSubRules && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleExpanded(rule.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rule.name}</div>
                          {rule.description && (
                            <div className="text-xs text-muted-foreground">
                              {rule.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.members.map((member) => (
                            <Badge
                              key={member.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {member.sigla}
                            </Badge>
                          ))}
                          {rule.members.length === 0 && (
                            <span className="text-muted-foreground text-xs">
                              Sem membros
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {rule.max_absent} de {rule.members.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={rule.is_active ? "default" : "secondary"}
                        >
                          {rule.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="default"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEdit(rule)}
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
                                  onClick={() => setDeleteConfirmRule(rule)}
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

                    {/* Sub-rules */}
                    {isExpanded &&
                      rule.sub_rules?.map((subRule) => (
                        <TableRow key={subRule.id} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-3 w-3 text-warning" />
                              <span className="text-sm">
                                {subRule.description || "Sub-regra"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {subRule.employees?.map((emp) => (
                                <Badge
                                  key={emp.id}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {emp.sigla}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">
                              max {subRule.max_absent}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                subRule.is_active ? "default" : "secondary"
                              }
                              className="text-xs"
                            >
                              {subRule.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:text-destructive"
                                      onClick={() =>
                                        handleDeleteSubRule(subRule.id)
                                      }
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Eliminar sub-regra
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </>
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
            Pagina {currentPage} de {totalPages} ({filteredRules.length}{" "}
            regras)
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

      {/* Info box */}
      {!loading && rules.length > 0 && (
        <div className="flex items-start gap-3 rounded-md imx-border bg-muted/50 p-4">
          <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Como funcionam as regras?
            </p>
            <p className="mt-1">
              Quando agendar ferias ou baixa medica para um colaborador, o
              sistema verifica se existe conflito com outros membros do grupo.
              Se o limite de ausentes simultaneos for excedido, sera mostrado um
              aviso - mas podera prosseguir se necessario.
            </p>
          </div>
        </div>
      )}

      {/* Rule Form Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editingRule ? "Editar Regra" : "Nova Regra de Conflito"}
            </SheetTitle>
            <SheetDescription>
              {editingRule
                ? "Atualize a regra de conflito"
                : "Defina um grupo de colaboradores e o numero maximo que podem estar ausentes ao mesmo tempo"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ConflictRuleForm
              rule={editingRule}
              employees={employees}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setIsSheetOpen(false);
                setEditingRule(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmRule}
        onOpenChange={() => setDeleteConfirmRule(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar regra de conflito?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja eliminar a regra &quot;
              {deleteConfirmRule?.name}&quot;? Esta acao nao pode ser desfeita.
              {deleteConfirmRule?.sub_rules &&
                deleteConfirmRule.sub_rules.length > 0 && (
                  <span className="block mt-2 text-warning">
                    Aviso: Esta regra tem {deleteConfirmRule.sub_rules.length}{" "}
                    sub-regra(s) que tambem serao eliminadas.
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

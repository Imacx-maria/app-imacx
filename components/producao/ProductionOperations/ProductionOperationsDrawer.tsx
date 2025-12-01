"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { NewExecutionForm } from "./NewExecutionForm";
import { AddPlanForm } from "./AddPlanForm";
import { PlanRow, type PlanUpdateData } from "./PlanRow";
import type {
  ProductionOperationsDrawerProps,
  ExecutionFormData,
  NewPlanData,
} from "./types";

// Designer plano interface (from designer_planos table)
interface DesignerPlano {
  id: string;
  item_id: string;
  plano_nome: string;
  tipo_operacao: "Impressao" | "Corte" | "Impressao_Flexiveis";
  // Material info
  material?: string;
  caracteristicas?: string;
  cor?: string;
  material_id?: string;
  // Print info
  cores?: string;
  quantidade?: number;
  notas?: string;
  plano_ordem?: number;
}

// Execution interface
interface Execution {
  id: string;
  plano_nome: string;
  Tipo_Op: string;
  maquina?: string;
  operador_id?: string;
  num_placas_print?: number;
  num_placas_corte?: number;
  notas?: string;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

// Items base info
interface ItemsBaseInfo {
  id: string;
  descricao: string;
  codigo?: string;
  quantidade?: number;
  folha_obra_id: string;
  folhas_obras?: {
    numero_fo?: string;
    nome_campanha?: string;
  };
}

export function ProductionOperationsDrawer({
  isOpen,
  onClose,
  itemId,
  supabase,
  onRefresh,
}: ProductionOperationsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Item info from items_base
  const [itemInfo, setItemInfo] = useState<ItemsBaseInfo | null>(null);

  // Plans from designer_planos
  const [planos, setPlanos] = useState<DesignerPlano[]>([]);

  // Executions (from producao_operacoes)
  const [executions, setExecutions] = useState<Execution[]>([]);

  // Machines map (UUID -> name)
  const [machinesMap, setMachinesMap] = useState<Map<string, string>>(
    new Map(),
  );

  // Expanded plans (to show their executions)
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(
    new Set(),
  );

  // Form states
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showAddPlanCorte, setShowAddPlanCorte] = useState(false); // Separate state for Corte tab
  const [showExecutionFormForPlan, setShowExecutionFormForPlan] = useState<
    string | null
  >(null);
  const [formLoading, setFormLoading] = useState(false);

  // Edit execution state
  const [editingExecutionId, setEditingExecutionId] = useState<string | null>(
    null,
  );
  const [editQuantidade, setEditQuantidade] = useState<number>(0);
  const [editNotas, setEditNotas] = useState<string>("");

  // Fetch item info and plans
  const fetchData = useCallback(async () => {
    if (!itemId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch item info from items_base
      const { data: itemData, error: itemError } = await supabase
        .from("items_base")
        .select(
          `
          id,
          descricao,
          codigo,
          quantidade,
          folha_obra_id,
          folhas_obras (
            Numero_do_,
            Trabalho
          )
        `,
        )
        .eq("id", itemId)
        .single();

      if (itemError) {
        throw new Error(itemError.message);
      }

      // Transform folhas_obras data
      const transformedItem: ItemsBaseInfo = {
        ...itemData,
        folhas_obras: itemData.folhas_obras
          ? {
              numero_fo: (itemData.folhas_obras as any).Numero_do_,
              nome_campanha: (itemData.folhas_obras as any).Trabalho,
            }
          : undefined,
      };

      setItemInfo(transformedItem);

      // Fetch plans from designer_planos
      const { data: planosData, error: planosError } = await supabase
        .from("designer_planos")
        .select("*")
        .eq("item_id", itemId)
        .order("plano_ordem", { ascending: true });

      if (planosError) {
        console.error("Error fetching planos:", planosError);
      } else {
        setPlanos(planosData || []);
      }

      // Fetch executions from producao_operacoes
      const { data: execData, error: execError } = await supabase
        .from("producao_operacoes")
        .select(
          `
          id,
          plano_nome,
          Tipo_Op,
          maquina,
          operador_id,
          num_placas_print,
          num_placas_corte,
          notas,
          created_at,
          profiles (first_name, last_name)
        `,
        )
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });

      if (!execError && execData) {
        setExecutions(execData as Execution[]);
      }

      // Fetch machines to map UUID to name
      const { data: machinesData, error: machinesError } = await supabase
        .from("maquinas_operacao")
        .select("id, nome_maquina");

      if (!machinesError && machinesData) {
        const map = new Map<string, string>();
        machinesData.forEach((m: any) => map.set(m.id, m.nome_maquina));
        setMachinesMap(map);
      }
    } catch (err: any) {
      console.error("[ProductionOperationsDrawer] Error:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [itemId, supabase]);

  useEffect(() => {
    if (isOpen && itemId) {
      fetchData();
    }
  }, [isOpen, itemId, fetchData]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setItemInfo(null);
      setPlanos([]);
      setExecutions([]);
      setMachinesMap(new Map());
      setExpandedPlanIds(new Set());
      setShowAddPlan(false);
      setShowAddPlanCorte(false);
      setShowExecutionFormForPlan(null);
      setError(null);
    }
  }, [isOpen]);

  // Helper to get machine name from UUID
  const getMachineName = useCallback(
    (machineId: string | undefined) => {
      if (!machineId) return "-";
      return machinesMap.get(machineId) || machineId;
    },
    [machinesMap],
  );

  // Group plans by type
  const impressaoPlanos = useMemo(
    () =>
      planos.filter(
        (p) =>
          p.tipo_operacao === "Impressao" ||
          p.tipo_operacao === "Impressao_Flexiveis",
      ),
    [planos],
  );

  const cortePlanos = useMemo(
    () => planos.filter((p) => p.tipo_operacao === "Corte"),
    [planos],
  );

  // Get executions for a plan
  const getExecutionsForPlan = useCallback(
    (planNome: string, tipoOp: string) => {
      return executions.filter(
        (e) => e.plano_nome === planNome && e.Tipo_Op === tipoOp,
      );
    },
    [executions],
  );

  // Calculate total executed for a plan (single type - legacy)
  const getTotalExecuted = useCallback(
    (planNome: string, tipoOp: string) => {
      const planExecs = getExecutionsForPlan(planNome, tipoOp);

      if (tipoOp === "Impressao" || tipoOp === "Impressao_Flexiveis") {
        return planExecs.reduce((sum, e) => sum + (e.num_placas_print || 0), 0);
      } else {
        return planExecs.reduce((sum, e) => sum + (e.num_placas_corte || 0), 0);
      }
    },
    [getExecutionsForPlan],
  );

  // Calculate print AND cut totals for a plan (dual progress)
  // This aggregates all executions matching the plan name, regardless of tipo_operacao
  const getPrintAndCutTotals = useCallback(
    (planNome: string) => {
      // Find all executions for this plan name (both print and cut)
      const allPlanExecs = executions.filter((e) => e.plano_nome === planNome);

      // Sum print executions (Impressao or Impressao_Flexiveis)
      const printTotal = allPlanExecs.reduce(
        (sum, e) => sum + (e.num_placas_print || 0),
        0,
      );

      // Sum cut executions
      const cutTotal = allPlanExecs.reduce(
        (sum, e) => sum + (e.num_placas_corte || 0),
        0,
      );

      return { printTotal, cutTotal };
    },
    [executions],
  );

  // Toggle plan expansion
  const togglePlanExpansion = (planId: string) => {
    setExpandedPlanIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  // Handle adding a new plan (for Impressão/Corte tab)
  const handleAddPlan = async (data: NewPlanData) => {
    if (!itemId) return;

    setFormLoading(true);
    try {
      const nextOrdem =
        Math.max(0, ...planos.map((p) => p.plano_ordem || 0)) + 1;

      const { data: newPlano, error } = await supabase
        .from("designer_planos")
        .insert({
          item_id: itemId,
          plano_nome: data.nome,
          tipo_operacao: data.cores ? "Impressao" : "Corte",
          // Material info - always save material info regardless of source
          material: data.material_tipo || null,
          caracteristicas: data.material_espessura || null,
          cor: data.material_acabamento || null,
          material_id: data.material_id || null,
          // Print info
          cores: data.cores,
          quantidade: data.quantidade_chapas,
          notas: data.notas,
          plano_ordem: nextOrdem,
        })
        .select()
        .single();

      if (error) throw error;

      setPlanos([...planos, newPlano]);
      setShowAddPlan(false);
      onRefresh?.();
    } catch (err: any) {
      console.error("[ProductionOperationsDrawer] Error creating plan:", err);
      alert(`Erro ao criar plano: ${err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle adding a new plan (for Corte-only tab)
  const handleAddPlanCorte = async (data: NewPlanData) => {
    if (!itemId) return;

    setFormLoading(true);
    try {
      const nextOrdem =
        Math.max(0, ...planos.map((p) => p.plano_ordem || 0)) + 1;

      const { data: newPlano, error } = await supabase
        .from("designer_planos")
        .insert({
          item_id: itemId,
          plano_nome: data.nome,
          tipo_operacao: "Corte", // Always Corte for this tab
          // Material info - always save material info regardless of source
          material: data.material_tipo || null,
          caracteristicas: data.material_espessura || null,
          cor: data.material_acabamento || null,
          material_id: data.material_id || null,
          // No cores for corte-only
          cores: null,
          quantidade: data.quantidade_chapas,
          notas: data.notas,
          plano_ordem: nextOrdem,
        })
        .select()
        .single();

      if (error) throw error;

      setPlanos([...planos, newPlano]);
      setShowAddPlanCorte(false);
      onRefresh?.();
    } catch (err: any) {
      console.error(
        "[ProductionOperationsDrawer] Error creating corte plan:",
        err,
      );
      alert(`Erro ao criar plano: ${err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle adding execution
  const handleAddExecution = async (
    planId: string,
    data: ExecutionFormData,
  ) => {
    if (!itemId || !itemInfo) return;

    setFormLoading(true);
    try {
      const plan = planos.find((p) => p.id === planId);
      if (!plan) throw new Error("Plan not found");

      // Lookup machine tipo to determine operation type
      const { data: machineData } = await supabase
        .from("maquinas_operacao")
        .select("tipo")
        .eq("id", data.maquina)
        .single();

      // Derive Tipo_Op from machine tipo (Impressao or Corte)
      const tipoOp = machineData?.tipo || "Impressao";
      const isCorte = tipoOp === "Corte";

      // Generate no_interno: FO prefix + date + type prefix + time
      const now = new Date();
      const dateStr = format(now, "yyyyMMdd");
      const timeStr = format(now, "HHmmss");
      const foShort = itemInfo.folhas_obras?.numero_fo?.substring(0, 6) || "FO";
      const typePrefix = isCorte
        ? "CRT"
        : tipoOp === "Impressao_Flexiveis"
          ? "FLX"
          : "IMP";
      const no_interno = `${foShort}-${dateStr}-${typePrefix}-${timeStr}`;

      // Create execution in producao_operacoes
      const { error } = await supabase.from("producao_operacoes").insert({
        item_id: itemId,
        folha_obra_id: itemInfo.folha_obra_id,
        plano_nome: plan.plano_nome,
        Tipo_Op: tipoOp,
        no_interno,
        maquina: data.maquina,
        operador_id: data.operador_id || null,
        num_placas_print: !isCorte ? data.quantidade_executada : null,
        num_placas_corte: isCorte ? data.quantidade_executada : null,
        notas: data.notas,
      });

      if (error) throw error;

      setShowExecutionFormForPlan(null);
      await fetchData();
      onRefresh?.();
    } catch (err: any) {
      console.error(
        "[ProductionOperationsDrawer] Error creating execution:",
        err,
      );
      alert(`Erro ao registar execução: ${err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle updating plan material info (called from PlanRow)
  const handleUpdatePlan = useCallback(
    async (planId: string, data: PlanUpdateData) => {
      try {
        const { error } = await supabase
          .from("designer_planos")
          .update({
            material: data.material || null,
            caracteristicas: data.caracteristicas || null,
            cor: data.cor || null,
            material_id: data.material_id || null,
            cores: data.cores || null,
            quantidade: data.quantidade || null,
          })
          .eq("id", planId);

        if (error) throw error;

        // Update local state
        setPlanos((prev) =>
          prev.map((p) => {
            if (p.id === planId) {
              return {
                ...p,
                material: data.material,
                caracteristicas: data.caracteristicas,
                cor: data.cor,
                material_id: data.material_id,
                cores: data.cores,
                quantidade: data.quantidade,
              };
            }
            return p;
          }),
        );
      } catch (err: any) {
        console.error("[ProductionOperationsDrawer] Error updating plan:", err);
      }
    },
    [supabase],
  );

  // Handle deleting an execution
  const handleDeleteExecution = useCallback(
    async (executionId: string) => {
      if (!confirm("Tem a certeza que deseja eliminar esta execução?")) {
        return;
      }

      try {
        const { error } = await supabase
          .from("producao_operacoes")
          .delete()
          .eq("id", executionId);

        if (error) throw error;

        // Update local state
        setExecutions((prev) => prev.filter((e) => e.id !== executionId));
        onRefresh?.();
      } catch (err: any) {
        console.error(
          "[ProductionOperationsDrawer] Error deleting execution:",
          err,
        );
        alert(`Erro ao eliminar execução: ${err.message}`);
      }
    },
    [supabase, onRefresh],
  );

  // Handle deleting a plan
  const handleDeletePlan = useCallback(
    async (planId: string) => {
      const plan = planos.find((p) => p.id === planId);
      const planExecs = executions.filter(
        (e) => e.plano_nome === plan?.plano_nome,
      );

      if (planExecs.length > 0) {
        if (
          !confirm(
            `Este plano tem ${planExecs.length} execução(ões). Eliminar o plano irá também eliminar todas as execuções. Continuar?`,
          )
        ) {
          return;
        }
      } else {
        if (!confirm("Tem a certeza que deseja eliminar este plano?")) {
          return;
        }
      }

      try {
        // First delete related executions
        if (planExecs.length > 0) {
          const { error: execError } = await supabase
            .from("producao_operacoes")
            .delete()
            .eq("item_id", itemId)
            .eq("plano_nome", plan?.plano_nome);

          if (execError) throw execError;
        }

        // Then delete the plan
        const { error } = await supabase
          .from("designer_planos")
          .delete()
          .eq("id", planId);

        if (error) throw error;

        // Update local state
        setPlanos((prev) => prev.filter((p) => p.id !== planId));
        if (plan) {
          setExecutions((prev) =>
            prev.filter((e) => e.plano_nome !== plan.plano_nome),
          );
        }
        onRefresh?.();
      } catch (err: any) {
        console.error("[ProductionOperationsDrawer] Error deleting plan:", err);
        alert(`Erro ao eliminar plano: ${err.message}`);
      }
    },
    [supabase, planos, executions, itemId, onRefresh],
  );

  // Start editing an execution
  const handleStartEdit = useCallback((exec: Execution) => {
    setEditingExecutionId(exec.id);
    setEditQuantidade(exec.num_placas_print || exec.num_placas_corte || 0);
    setEditNotas(exec.notas || "");
  }, []);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingExecutionId(null);
    setEditQuantidade(0);
    setEditNotas("");
  }, []);

  // Save edited execution
  const handleSaveEdit = useCallback(
    async (executionId: string, isImpressao: boolean) => {
      try {
        const updateData: Record<string, any> = {
          notas: editNotas || null,
        };

        if (isImpressao) {
          updateData.num_placas_print = editQuantidade;
        } else {
          updateData.num_placas_corte = editQuantidade;
        }

        const { error } = await supabase
          .from("producao_operacoes")
          .update(updateData)
          .eq("id", executionId);

        if (error) throw error;

        // Update local state
        setExecutions((prev) =>
          prev.map((e) => {
            if (e.id === executionId) {
              return {
                ...e,
                num_placas_print: isImpressao
                  ? editQuantidade
                  : e.num_placas_print,
                num_placas_corte: !isImpressao
                  ? editQuantidade
                  : e.num_placas_corte,
                notas: editNotas || undefined,
              };
            }
            return e;
          }),
        );

        setEditingExecutionId(null);
        onRefresh?.();
      } catch (err: any) {
        console.error(
          "[ProductionOperationsDrawer] Error updating execution:",
          err,
        );
        alert(`Erro ao atualizar execução: ${err.message}`);
      }
    },
    [supabase, editQuantidade, editNotas, onRefresh],
  );

  // Render executions table for a plan (shown when expanded)
  const renderExecutionsTable = (plan: DesignerPlano) => {
    // Get ALL executions for this plan (both print and cut)
    const planExecutions = executions.filter(
      (e) => e.plano_nome === plan.plano_nome,
    );

    return (
      <div className="ml-8 mt-2 mb-4 space-y-3">
        {/* Execution form (if adding) */}
        {showExecutionFormForPlan === plan.id && (
          <NewExecutionForm
            planoId={plan.id}
            planoNome={plan.plano_nome}
            operationType={plan.tipo_operacao}
            onSubmit={(data) => handleAddExecution(plan.id, data)}
            onCancel={() => setShowExecutionFormForPlan(null)}
            loading={formLoading}
          />
        )}

        {/* Executions table */}
        {planExecutions.length > 0 && (
          <div className="mr-4">
            <Table className="imx-table-compact table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="imx-border-b text-xs w-28">
                    Data/Hora
                  </TableHead>
                  <TableHead className="imx-border-b text-xs w-24">
                    Operador
                  </TableHead>
                  <TableHead className="imx-border-b text-xs w-24">
                    Máquina
                  </TableHead>
                  <TableHead className="imx-border-b text-xs text-right w-16">
                    Qtd
                  </TableHead>
                  <TableHead className="imx-border-b text-xs">Notas</TableHead>
                  <TableHead className="imx-border-b text-xs w-20 text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planExecutions.map((exec) => {
                  const isEditing = editingExecutionId === exec.id;
                  // Determine if this execution is print or cut based on its Tipo_Op
                  const execIsImpressao = exec.Tipo_Op !== "Corte";
                  const execQty = execIsImpressao
                    ? exec.num_placas_print
                    : exec.num_placas_corte;
                  return (
                    <TableRow key={exec.id}>
                      <TableCell className="text-xs w-28">
                        {format(new Date(exec.created_at), "dd/MM HH:mm", {
                          locale: pt,
                        })}
                      </TableCell>
                      <TableCell className="text-xs w-24 truncate">
                        {exec.profiles?.first_name || "-"}
                      </TableCell>
                      <TableCell className="text-xs w-24 truncate">
                        {getMachineName(exec.maquina)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium w-16">
                        {isEditing ? (
                          <Input
                            type="number"
                            min={1}
                            value={editQuantidade}
                            onChange={(e) =>
                              setEditQuantidade(parseInt(e.target.value) || 0)
                            }
                            className="w-14 h-6 text-xs text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          execQty
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {isEditing ? (
                          <Input
                            value={editNotas}
                            onChange={(e) => setEditNotas(e.target.value)}
                            placeholder="Notas"
                            className="h-6 text-xs"
                          />
                        ) : (
                          exec.notas || "-"
                        )}
                      </TableCell>
                      <TableCell className="text-xs w-20">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  handleSaveEdit(exec.id, execIsImpressao)
                                }
                              >
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleStartEdit(exec)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleDeleteExecution(exec.id)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  // Handle opening execution form for a plan (triggered from PlanRow header button)
  const handleOpenExecutionForm = useCallback((planId: string) => {
    // Expand the plan if not already expanded
    setExpandedPlanIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(planId);
      return newSet;
    });
    // Show the execution form
    setShowExecutionFormForPlan(planId);
  }, []);

  // Render a single plan row with inline editing and expandable executions (full mode - IMP + CRT)
  const renderPlanWithExecutions = (plan: DesignerPlano) => {
    const totalExecuted = getTotalExecuted(plan.plano_nome, plan.tipo_operacao);
    // Get all executions for this plan name (any tipo_op)
    const allPlanExecutions = executions.filter(
      (e) => e.plano_nome === plan.plano_nome,
    );
    const executionCount = allPlanExecutions.length;
    const isExpanded = expandedPlanIds.has(plan.id);

    // Get dual progress totals (print and cut separately)
    const { printTotal, cutTotal } = getPrintAndCutTotals(plan.plano_nome);

    return (
      <PlanRow
        key={plan.id}
        plan={plan}
        totalExecuted={totalExecuted}
        printExecuted={printTotal}
        cutExecuted={cutTotal}
        executionCount={executionCount}
        isExpanded={isExpanded}
        onToggleExpand={() => togglePlanExpansion(plan.id)}
        onUpdatePlan={handleUpdatePlan}
        onAddExecution={handleOpenExecutionForm}
        onDeletePlan={handleDeletePlan}
        mode="full"
      >
        {renderExecutionsTable(plan)}
      </PlanRow>
    );
  };

  // Render a single plan row for cut-only tab (only CRT progress)
  const renderCortePlanWithExecutions = (plan: DesignerPlano) => {
    const totalExecuted = getTotalExecuted(plan.plano_nome, plan.tipo_operacao);
    // Get all executions for this plan name (any tipo_op)
    const allPlanExecutions = executions.filter(
      (e) => e.plano_nome === plan.plano_nome,
    );
    const executionCount = allPlanExecutions.length;
    const isExpanded = expandedPlanIds.has(plan.id);

    // Get dual progress totals (print and cut separately)
    const { printTotal, cutTotal } = getPrintAndCutTotals(plan.plano_nome);

    return (
      <PlanRow
        key={plan.id}
        plan={plan}
        totalExecuted={totalExecuted}
        printExecuted={printTotal}
        cutExecuted={cutTotal}
        executionCount={executionCount}
        isExpanded={isExpanded}
        onToggleExpand={() => togglePlanExpansion(plan.id)}
        onUpdatePlan={handleUpdatePlan}
        onAddExecution={handleOpenExecutionForm}
        onDeletePlan={handleDeletePlan}
        mode="cut-only"
      >
        {renderExecutionsTable(plan)}
      </PlanRow>
    );
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <div className="w-full px-4">
          <DrawerHeader className="flex items-center justify-between px-0">
            <DrawerTitle className="uppercase">
              Operações de Produção
            </DrawerTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DrawerHeader>

          <div
            className="overflow-y-auto pb-4"
            style={{ maxHeight: "calc(90vh - 80px)" }}
          >
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive imx-border">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && itemInfo && (
              <div className="space-y-6">
                {/* Item Summary */}
                <Card className="imx-border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {itemInfo.codigo || "N/A"} - {itemInfo.descricao}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        FO: {itemInfo.folhas_obras?.numero_fo || "N/A"} |
                        Campanha:{" "}
                        {itemInfo.folhas_obras?.nome_campanha || "N/A"} |
                        Quantidade: {itemInfo.quantidade || 0}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {planos.length} plano{planos.length !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="secondary">
                        {executions.length}{" "}
                        {executions.length !== 1 ? "execuções" : "execução"}
                      </Badge>
                    </div>
                  </div>
                </Card>

                {/* Tabs for Impressão/Corte and Corte only */}
                <Tabs defaultValue="impressao" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="impressao">
                      Impressão / Corte ({impressaoPlanos.length})
                    </TabsTrigger>
                    <TabsTrigger value="corte">
                      Corte ({cortePlanos.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab: Impressão / Corte */}
                  <TabsContent value="impressao" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium uppercase">
                        Planos de Impressão / Corte
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddPlan(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Plano
                      </Button>
                    </div>

                    {showAddPlan && (
                      <AddPlanForm
                        itemId={itemId!}
                        tipo="impressao"
                        processo="impressao_corte"
                        existingPlanNames={planos.map((p) => p.plano_nome)}
                        onSubmit={handleAddPlan}
                        onCancel={() => setShowAddPlan(false)}
                        loading={formLoading}
                      />
                    )}

                    {impressaoPlanos.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum plano de impressão. Adicione um plano ou aguarde
                        o designer.
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {impressaoPlanos.map(renderPlanWithExecutions)}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab: Corte */}
                  <TabsContent value="corte" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium uppercase">
                        Planos de Corte
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddPlanCorte(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Plano
                      </Button>
                    </div>

                    {showAddPlanCorte && (
                      <AddPlanForm
                        itemId={itemId!}
                        tipo="corte"
                        processo="so_corte"
                        existingPlanNames={planos.map((p) => p.plano_nome)}
                        onSubmit={handleAddPlanCorte}
                        onCancel={() => setShowAddPlanCorte(false)}
                        loading={formLoading}
                      />
                    )}

                    {cortePlanos.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum plano de corte. Adicione um plano ou aguarde o
                        designer.
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {cortePlanos.map(renderCortePlanWithExecutions)}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

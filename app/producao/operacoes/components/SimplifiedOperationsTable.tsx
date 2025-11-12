import React, { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { CheckCircle2, Trash2, Copy, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import SimpleNotasPopover from "@/components/custom/SimpleNotasPopover";
import { useTableData } from "@/hooks/useTableData";
import { useMaterialsCascading } from "@/hooks/useMaterialsCascading";
import { logOperationCreation, logFieldUpdate } from "@/utils/auditLogging";
import type { ProductionOperationWithRelations } from "@/types/producao";

interface SimplifiedOperationsTableProps {
  operations: ProductionOperationWithRelations[];
  itemId: string;
  folhaObraId: string;
  supabase: any;
  onRefresh: () => void;
  loading?: boolean;
}

interface OperationGroup {
  sourceOp: ProductionOperationWithRelations | null;
  executionOps: ProductionOperationWithRelations[];
  totalExecuted: number;
  plannedQty: number;
  progressPercent: number;
  jobId: string;
  type: "print" | "cut" | "cut-from-print";
}

export const SimplifiedOperationsTable: React.FC<
  SimplifiedOperationsTableProps
> = ({
  operations,
  itemId,
  folhaObraId,
  supabase,
  onRefresh,
  loading = false,
}) => {
  const { operators, machines } = useTableData();
  const {
    materialOptions,
    getCaracteristicaOptions,
    getCorOptions,
    getMaterialId,
    materialsData,
  } = useMaterialsCascading();

  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  // Group operations by job for better visualization
  const operationGroups = React.useMemo((): OperationGroup[] => {
    const groups: OperationGroup[] = [];

    // Group print operations by print_job_id
    const printJobIds = [
      ...new Set(
        operations.filter((op) => op.print_job_id).map((op) => op.print_job_id),
      ),
    ];

    printJobIds.forEach((jobId) => {
      const jobOps = operations.filter((op) => op.print_job_id === jobId);
      const sourceOp = jobOps.find((op) => op.is_source_record) || null;
      const executionOps = jobOps.filter((op) => !op.is_source_record);

      const totalExecuted = executionOps.reduce(
        (sum, op) => sum + (op.num_placas_print || 0),
        0,
      );

      const plannedQty = sourceOp?.qt_print_planned || 0;

      groups.push({
        sourceOp,
        executionOps,
        totalExecuted,
        plannedQty,
        progressPercent:
          plannedQty > 0 ? (totalExecuted / plannedQty) * 100 : 0,
        jobId: jobId!,
        type: "print",
      });
    });

    // Group cut-only operations by cut_job_id
    const cutJobIds = [
      ...new Set(
        operations
          .filter((op) => op.cut_job_id && !op.source_impressao_id)
          .map((op) => op.cut_job_id),
      ),
    ];

    cutJobIds.forEach((jobId) => {
      const jobOps = operations.filter((op) => op.cut_job_id === jobId);
      const sourceOp = jobOps.find((op) => op.is_source_record) || null;
      const executionOps = jobOps.filter((op) => !op.is_source_record);

      const totalExecuted = executionOps.reduce(
        (sum, op) => sum + (op.num_placas_corte || 0),
        0,
      );

      const plannedQty = sourceOp?.qt_corte_planned || 0;

      groups.push({
        sourceOp,
        executionOps,
        totalExecuted,
        plannedQty,
        progressPercent:
          plannedQty > 0 ? (totalExecuted / plannedQty) * 100 : 0,
        jobId: jobId!,
        type: "cut",
      });
    });

    // Group cut-from-print operations by source_impressao_id
    const cutFromPrintGroups = new Map<
      string,
      ProductionOperationWithRelations[]
    >();
    operations
      .filter((op) => op.source_impressao_id)
      .forEach((op) => {
        const group = cutFromPrintGroups.get(op.source_impressao_id!) || [];
        group.push(op);
        cutFromPrintGroups.set(op.source_impressao_id!, group);
      });

    cutFromPrintGroups.forEach((cutOps, sourceImpressaoId) => {
      // Find the print job this cut is linked to
      const printSourceOp = operations.find(
        (op) => op.id === sourceImpressaoId,
      );
      const printGroup = groups.find(
        (g) => g.jobId === printSourceOp?.print_job_id && g.type === "print",
      );

      const totalCut = cutOps.reduce(
        (sum, op) => sum + (op.num_placas_corte || 0),
        0,
      );
      const maxCuttable = printGroup?.totalExecuted || 0; // Can't cut more than printed
      const plannedQty = printGroup?.plannedQty || 0;

      groups.push({
        sourceOp: printSourceOp || null,
        executionOps: cutOps,
        totalExecuted: totalCut,
        plannedQty: Math.min(plannedQty, maxCuttable), // Limited by what's printed
        progressPercent: plannedQty > 0 ? (totalCut / plannedQty) * 100 : 0,
        jobId: sourceImpressaoId,
        type: "cut-from-print",
      });
    });

    return groups.sort((a, b) => {
      // Sort by type (print first, then cut-from-print, then cut-only)
      const typeOrder = { print: 0, "cut-from-print": 1, cut: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });
  }, [operations]);

  // Simple inline duplication function
  const handleDuplicateOperation = useCallback(
    async (sourceOp: ProductionOperationWithRelations) => {
      try {
        const now = new Date();
        const dateStr = format(now, "yyyyMMdd");
        const timeStr = format(now, "HHmmss");
        const randomStr = Math.random().toString(36).substring(7);

        const duplicateData = {
          ...sourceOp,
          id: undefined, // Let database generate new ID
          no_interno: `${sourceOp.no_interno}-DUP-${timeStr}-${randomStr}`,

          // Preserve job linkage
          print_job_id: sourceOp.print_job_id,
          cut_job_id: sourceOp.cut_job_id,
          source_impressao_id: sourceOp.source_impressao_id,

          // Reset execution fields for operator to fill
          num_placas_print: 0,
          num_placas_corte: 0,
          operador_id: null,
          maquina: null,
          concluido: false,
          data_conclusao: null,
          observacoes: null,

          // Track duplication
          is_source_record: false, // Never duplicate as source
          parent_operation_id: sourceOp.is_source_record
            ? sourceOp.id
            : sourceOp.parent_operation_id,

          // Clear old batch fields (being phased out)
          batch_id: null,
          batch_parent_id: null,
          placas_neste_batch: null,
          total_placas: null,

          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("producao_operacoes")
          .insert([duplicateData])
          .select()
          .single();

        if (error) throw error;

        // Log the duplication
        await logOperationCreation(supabase, data.id, duplicateData);

        // Refresh to show new operation
        onRefresh();
      } catch (error) {
        console.error("Error duplicating operation:", error);
        alert("Erro ao duplicar operação. Verifique a consola.");
      }
    },
    [supabase, onRefresh],
  );

  // Handle field updates with validation
  const handleFieldUpdate = useCallback(
    async (operationId: string, field: string, value: any) => {
      const fieldKey = `${operationId}-${field}`;
      setSavingFields((prev) => new Set(prev).add(fieldKey));

      try {
        const oldValue = operations.find((op) => op.id === operationId)?.[
          field as keyof ProductionOperationWithRelations
        ];

        // Update in database
        const { error } = await supabase
          .from("producao_operacoes")
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq("id", operationId);

        if (error) {
          // Check if it's a validation error from our trigger
          if (error.message.includes("cannot exceed")) {
            alert(`Erro de validação: ${error.message}`);
          } else {
            throw error;
          }
          return;
        }

        // Log the change
        await logFieldUpdate(supabase, operationId, field, oldValue, value);

        // Update local state
        setFieldValues((prev) => ({
          ...prev,
          [`${operationId}-${field}`]: value,
        }));

        // Refresh to get updated totals
        onRefresh();
      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        alert(`Erro ao atualizar ${field}`);
      } finally {
        setSavingFields((prev) => {
          const next = new Set(prev);
          next.delete(fieldKey);
          return next;
        });
      }
    },
    [operations, supabase, onRefresh],
  );

  // Handle operation deletion
  const handleDeleteOperation = useCallback(
    async (operationId: string) => {
      if (!confirm("Tem certeza que deseja eliminar esta operação?")) return;

      try {
        const { error } = await supabase
          .from("producao_operacoes")
          .delete()
          .eq("id", operationId);

        if (error) throw error;

        onRefresh();
      } catch (error) {
        console.error("Error deleting operation:", error);
        alert("Erro ao eliminar operação");
      }
    },
    [supabase, onRefresh],
  );

  // Handle completion toggle
  const handleToggleComplete = useCallback(
    async (operationId: string, currentValue: boolean) => {
      const newValue = !currentValue;
      const completionDate = newValue ? new Date().toISOString() : null;

      await handleFieldUpdate(operationId, "concluido", newValue);
      if (completionDate) {
        await handleFieldUpdate(operationId, "data_conclusao", completionDate);
      }
    },
    [handleFieldUpdate],
  );

  const getOperationTypeColor = (tipo: string) => {
    switch (tipo) {
      case "Impressao":
      case "Impressao_Flexiveis":
        return "bg-blue-100 text-blue-800";
      case "Corte":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500";
    if (percent >= 75) return "bg-blue-500";
    if (percent >= 50) return "bg-yellow-500";
    if (percent >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">Carregando operações...</div>
    );
  }

  return (
    <div className="space-y-6">
      {operationGroups.map((group) => (
        <div key={group.jobId} className="border rounded-lg p-4 space-y-4">
          {/* Group Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge
                className={getOperationTypeColor(
                  group.type === "cut-from-print"
                    ? "Corte"
                    : group.sourceOp?.tipo_operacao || "",
                )}
              >
                {group.type === "print"
                  ? "Impressão"
                  : group.type === "cut-from-print"
                    ? "Corte de Impressão"
                    : "Corte Direto"}
              </Badge>

              {group.sourceOp?.plano_nome && (
                <span className="font-medium">{group.sourceOp.plano_nome}</span>
              )}

              {group.sourceOp?.cores && (
                <Badge variant="outline">{group.sourceOp.cores}</Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {group.totalExecuted} / {group.plannedQty} placas
              </div>
              <div className="w-32">
                <Progress value={group.progressPercent} className="h-2" />
              </div>
              <span className="text-sm font-medium">
                {Math.round(group.progressPercent)}%
              </span>
            </div>
          </div>

          {/* Warning for cut-from-print if trying to cut more than printed */}
          {group.type === "cut-from-print" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>
                Máximo cortável: {group.plannedQty} placas (baseado no que foi
                impresso)
              </span>
            </div>
          )}

          {/* Operations Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Nº Interno</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Máquina</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-center">Quantidade</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Source record (if exists) - shown as reference only */}
              {group.sourceOp && (
                <TableRow className="bg-muted/50">
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Plano Original - Quantidade Planeada: {group.plannedQty}{" "}
                    placas
                  </TableCell>
                </TableRow>
              )}

              {/* Execution records */}
              {group.executionOps.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    <div className="py-4 space-y-2">
                      <p>Nenhuma execução registada</p>
                      {group.sourceOp && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDuplicateOperation(group.sourceOp!)
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Iniciar Primeira Execução
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                group.executionOps.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>
                      {op.data_operacao
                        ? format(new Date(op.data_operacao), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {op.no_interno}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={
                          fieldValues[`${op.id}-operador_id`] ??
                          op.operador_id ??
                          ""
                        }
                        onValueChange={(value) =>
                          handleFieldUpdate(op.id, "operador_id", value)
                        }
                        disabled={savingFields.has(`${op.id}-operador_id`)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((operator) => (
                            <SelectItem
                              key={operator.value}
                              value={operator.value}
                            >
                              {operator.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={
                          fieldValues[`${op.id}-maquina`] ?? op.maquina ?? ""
                        }
                        onValueChange={(value) =>
                          handleFieldUpdate(op.id, "maquina", value)
                        }
                        disabled={savingFields.has(`${op.id}-maquina`)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {machines.map((machine) => (
                            <SelectItem
                              key={machine.value}
                              value={machine.value}
                            >
                              {machine.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {/* Material selection - simplified for now */}
                      <span className="text-sm text-muted-foreground">
                        {op.material_id ? "Definido" : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        className="w-20 text-center"
                        value={
                          fieldValues[
                            `${op.id}-${group.type === "print" ? "num_placas_print" : "num_placas_corte"}`
                          ] ??
                          (group.type === "print"
                            ? op.num_placas_print
                            : op.num_placas_corte) ??
                          0
                        }
                        onChange={(e) => {
                          const field =
                            group.type === "print"
                              ? "num_placas_print"
                              : "num_placas_corte";
                          handleFieldUpdate(
                            op.id,
                            field,
                            parseFloat(e.target.value) || 0,
                          );
                        }}
                        disabled={savingFields.has(
                          `${op.id}-${group.type === "print" ? "num_placas_print" : "num_placas_corte"}`,
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <SimpleNotasPopover
                        value={op.notas || ""}
                        onSave={(value) =>
                          handleFieldUpdate(op.id, "notas", value)
                        }
                        buttonSize="icon"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={op.concluido ?? false}
                        onCheckedChange={() =>
                          handleToggleComplete(op.id, op.concluido ?? false)
                        }
                        disabled={savingFields.has(`${op.id}-concluido`)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDuplicateOperation(op)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Duplicar para outro turno/máquina
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteOperation(op.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Eliminar operação</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}

              {/* Add new execution row button */}
              {group.executionOps.length > 0 &&
                group.totalExecuted < group.plannedQty && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Duplicate the last execution or the source
                          const opToDuplicate =
                            group.executionOps[group.executionOps.length - 1] ||
                            group.sourceOp;
                          if (opToDuplicate)
                            handleDuplicateOperation(opToDuplicate);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Execução (Outro turno/máquina)
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </div>
      ))}

      {operationGroups.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma operação encontrada para este item
        </div>
      )}
    </div>
  );
};

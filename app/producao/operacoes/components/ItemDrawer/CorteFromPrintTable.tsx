"use client";

/**
 * CorteFromPrintTable Component
 * Handles Corte operations linked to print jobs
 */

import React, { useMemo, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import DatePicker from "@/components/custom/DatePicker";
import SimpleNotasPopover from "@/components/custom/SimpleNotasPopover";
import { useTableData } from "@/hooks/useTableData";
import { useMaterialsCascading } from "@/hooks/useMaterialsCascading";
import { logFieldUpdate, logOperationDeletion } from "@/utils/auditLogging";
import { duplicateOperationRow } from "../../utils/operationsHelpers";
import { Copy, Trash2 } from "lucide-react";
import type { ProductionOperation, CorteFromPrintTableProps } from "../../types";

function CorteFromPrintTableInner({
  operations,
  itemId,
  folhaObraId,
  supabase,
  onRefresh,
  onMainRefresh,
}: CorteFromPrintTableProps) {
  const { operators, machines } = useTableData();
  const { materialsData } = useMaterialsCascading();

  // Group operations by source_impressao_id for aggregation
  const groupedOps = useMemo(() => {
    const groups: Record<
      string,
      {
        sourceId: string;
        operations: ProductionOperation[];
        totalCut: number;
        qtPrint: number;
        material: string;
        carateristica: string;
        cor: string;
        nPal: string;
      }
    > = {};

    operations.forEach((op) => {
      if (!op.source_impressao_id) return;

      if (!groups[op.source_impressao_id]) {
        groups[op.source_impressao_id] = {
          sourceId: op.source_impressao_id,
          operations: [],
          totalCut: 0,
          qtPrint: op.QT_print || 0,
          material: "",
          carateristica: "",
          cor: "",
          nPal: op.N_Pal || "",
        };

        if (op.material_id && materialsData.length > 0) {
          const mat = materialsData.find((m) => m.id === op.material_id);
          if (mat) {
            groups[op.source_impressao_id].material = mat.material || "";
            groups[op.source_impressao_id].carateristica =
              mat.carateristica || "";
            groups[op.source_impressao_id].cor = mat.cor || "";
          }
        }
      }

      groups[op.source_impressao_id].operations.push(op);
      groups[op.source_impressao_id].totalCut += op.num_placas_corte || 0;
    });

    return Object.values(groups);
  }, [operations, materialsData]);

  const handleFieldChange = useCallback(
    async (operationId: string, field: string, value: any) => {
      try {
        let normalizedValue = value;

        if (field === "num_placas_corte") {
          const op = operations.find((o) => o.id === operationId);
          const n = parseFloat(String(value));
          normalizedValue = Number.isFinite(n) ? n : 0;

          if (op && op.source_impressao_id) {
            const group = groupedOps.find(
              (g) => g.sourceId === op.source_impressao_id
            );
            if (group) {
              const newTotal =
                group.totalCut - (op.num_placas_corte || 0) + normalizedValue;
              if (newTotal > group.qtPrint) {
                alert(
                  `Total de corte (${newTotal}) não pode exceder QT Print (${group.qtPrint})`
                );
                return;
              }
            }
          }
        }

        const operation = operations.find((op) => op.id === operationId);
        const oldValue = operation ? (operation as any)[field] : null;

        const { error } = await supabase
          .from("producao_operacoes")
          .update({ [field]: normalizedValue })
          .eq("id", operationId);

        if (error) throw error;

        await logFieldUpdate(
          supabase,
          operationId,
          field,
          oldValue,
          normalizedValue
        );

        onRefresh();
        onMainRefresh();
      } catch (err) {
        console.error("Error updating operation:", err);
        alert("Erro ao atualizar operação");
      }
    },
    [operations, groupedOps, supabase, onRefresh, onMainRefresh]
  );

  const handleDuplicateRow = useCallback(
    async (operation: ProductionOperation) => {
      try {
        const result = await duplicateOperationRow(supabase, operation);
        if (!result.success) {
          alert(`Erro ao duplicar operação: ${result.error}`);
          return;
        }
        onRefresh();
        onMainRefresh();
      } catch (err) {
        console.error("Error duplicating operation:", err);
        alert("Erro ao duplicar operação");
      }
    },
    [supabase, onRefresh, onMainRefresh]
  );

  const handleDeleteOperation = useCallback(
    async (operationId: string) => {
      if (!window.confirm("Tem certeza que deseja eliminar esta operação?"))
        return;

      try {
        const operation = operations.find((op) => op.id === operationId);

        const { error } = await supabase
          .from("producao_operacoes")
          .delete()
          .eq("id", operationId);

        if (error) throw error;

        if (operation) {
          await logOperationDeletion(supabase, operationId, operation);
        }

        onRefresh();
        onMainRefresh();
      } catch (err) {
        console.error("Error deleting operation:", err);
        alert("Erro ao eliminar operação");
      }
    },
    [operations, supabase, onRefresh, onMainRefresh]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg">Corte a partir de Impressão</h3>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Data</TableHead>
              <TableHead className="w-[120px]">Operador</TableHead>
              <TableHead className="w-[120px]">Máquina</TableHead>
              <TableHead className="w-[100px]">QT Print</TableHead>
              <TableHead className="w-[100px]">Corte</TableHead>
              <TableHead className="w-[50px]">Notas</TableHead>
              <TableHead className="w-[70px] text-center">C</TableHead>
              <TableHead className="w-[90px] text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((op) => (
              <TableRow key={op.id}>
                {/* Data */}
                <TableCell>
                  <DatePicker
                    selected={
                      op.data_operacao ? new Date(op.data_operacao) : undefined
                    }
                    onSelect={(date: Date | undefined) =>
                      handleFieldChange(
                        op.id,
                        "data_operacao",
                        date ? date.toISOString().split("T")[0] : null
                      )
                    }
                  />
                </TableCell>

                {/* Operador */}
                <TableCell>
                  <Select
                    value={op.operador_id || ""}
                    onValueChange={(v) =>
                      handleFieldChange(op.id, "operador_id", v || null)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Operador" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Máquina */}
                <TableCell>
                  <Select
                    value={op.maquina || ""}
                    onValueChange={(v) =>
                      handleFieldChange(op.id, "maquina", v || null)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Máquina" />
                    </SelectTrigger>
                    <SelectContent>
                      {machines
                        .filter((m) => m.tipo === "Corte")
                        .map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* QT Print (read-only from linked print) */}
                <TableCell>{op.QT_print ?? "-"}</TableCell>

                {/* Corte */}
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    value={String(op.num_placas_corte ?? "")}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d+(\.\d{0,1})?$/.test(value)) {
                        handleFieldChange(op.id, "num_placas_corte", value);
                      }
                    }}
                    className="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </TableCell>

                {/* Notas */}
                <TableCell>
                  <SimpleNotasPopover
                    value={op.observacoes || ""}
                    onSave={(value) =>
                      handleFieldChange(op.id, "observacoes", value)
                    }
                    placeholder="Notas..."
                    label="Notas"
                    buttonSize="icon"
                  />
                </TableCell>

                {/* Concluído */}
                <TableCell>
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={op.concluido || false}
                      onCheckedChange={(checked) =>
                        handleFieldChange(op.id, "concluido", !!checked)
                      }
                    />
                  </div>
                </TableCell>

                {/* Ações */}
                <TableCell>
                  <div className="flex gap-1 justify-center">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleDuplicateRow(op)}
                      title="Duplicar linha"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => handleDeleteOperation(op.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export const CorteFromPrintTable = memo(CorteFromPrintTableInner);

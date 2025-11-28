"use client";

/**
 * ImpressaoOperationsTable Component
 * Handles Impressão operations table with inline editing
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Combobox from "@/components/ui/Combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import DatePicker from "@/components/custom/DatePicker";
import SimpleNotasPopover from "@/components/custom/SimpleNotasPopover";
import { useTableData } from "@/hooks/useTableData";
import { useMaterialsCascading } from "@/hooks/useMaterialsCascading";
import {
  logOperationCreation,
  logFieldUpdate,
  logOperationDeletion,
} from "@/utils/auditLogging";
import {
  duplicateOperationRow,
  validateOperationQuantity,
} from "../../utils/operationsHelpers";
import { createFirstExecutionFromSource } from "../../utils/importPlanosLogic";
import { OperationProgress } from "../OperationProgress";
import { Plus, Trash2, Copy, Play } from "lucide-react";
import type {
  ProductionOperation,
  ProductionItem,
  MaterialSelection,
  PrintJobSummary,
} from "../../types";

interface ImpressaoOperationsTableProps {
  operations: ProductionOperation[];
  itemId: string;
  folhaObraId: string;
  item: ProductionItem;
  supabase: any;
  onRefresh: () => void;
  onMainRefresh: () => void;
}

function ImpressaoOperationsTableInner({
  operations,
  itemId,
  folhaObraId,
  item,
  supabase,
  onRefresh,
  onMainRefresh,
}: ImpressaoOperationsTableProps) {
  const { operators, machines } = useTableData();
  const {
    materialOptions,
    getCaracteristicaOptions,
    getCorOptions,
    getMaterialId,
    materialsData,
  } = useMaterialsCascading();

  const [materialSelections, setMaterialSelections] = useState<
    Record<string, MaterialSelection>
  >({});
  const [paletteSelections, setPaletteSelections] = useState<
    Record<string, string>
  >({});
  const [paletes, setPaletes] = useState<any[]>([]);
  const [paletesLoading, setPaletesLoading] = useState(false);

  // Print job summaries for progress tracking
  const printSummaries = useMemo<PrintJobSummary[]>(() => {
    const result: PrintJobSummary[] = [];

    const sources = operations.filter(
      (op) => op.is_source_record && op.print_job_id
    );

    sources.forEach((source) => {
      const planned = source.qt_print_planned || 0;
      const execRows = operations.filter(
        (op) =>
          op.print_job_id === source.print_job_id &&
          op.is_source_record !== true
      );
      const executed =
        execRows.reduce((sum, op) => sum + (op.num_placas_print || 0), 0) || 0;
      const remaining = Math.max(0, planned - executed);
      const progress =
        planned > 0 ? Math.round((executed / planned) * 100) : 0;

      result.push({
        id: source.print_job_id || source.id,
        no_interno: source.no_interno || null,
        plano_nome: source.plano_nome || null,
        planned,
        executed,
        remaining,
        progress,
      });
    });

    return result;
  }, [operations]);

  // Fetch paletes
  useEffect(() => {
    const fetchPaletes = async () => {
      setPaletesLoading(true);
      try {
        const { data, error } = await supabase
          .from("paletes")
          .select("*")
          .order("no_palete", { ascending: false });

        if (!error && data) {
          setPaletes(data);
        }
      } catch (err) {
        console.error("Error fetching paletes:", err);
      } finally {
        setPaletesLoading(false);
      }
    };

    fetchPaletes();
  }, [supabase]);

  // Initialize material and palette selections
  useEffect(() => {
    const newMaterialSelections: Record<string, MaterialSelection> = {};
    const newPaletteSelections: Record<string, string> = {};

    operations.forEach((op) => {
      if (op.N_Pal && paletes.length > 0) {
        const palette = paletes.find((p) => p.no_palete === op.N_Pal);

        if (palette) {
          newPaletteSelections[op.id] = palette.id;

          if (palette.ref_cartao && materialsData.length > 0) {
            const materialRecord = materialsData.find(
              (m) => m.referencia === palette.ref_cartao
            );

            if (materialRecord) {
              newMaterialSelections[op.id] = {
                material: materialRecord.material?.toUpperCase() || undefined,
                carateristica:
                  materialRecord.carateristica?.toUpperCase() || undefined,
                cor: materialRecord.cor?.toUpperCase() || undefined,
              };
            }
          }
        }
      }

      if (
        !newMaterialSelections[op.id] &&
        op.material_id &&
        materialsData.length > 0
      ) {
        const materialRecord = materialsData.find(
          (m) => m.id === op.material_id
        );
        if (materialRecord) {
          newMaterialSelections[op.id] = {
            material: materialRecord.material?.toUpperCase() || undefined,
            carateristica:
              materialRecord.carateristica?.toUpperCase() || undefined,
            cor: materialRecord.cor?.toUpperCase() || undefined,
          };
        }
      }
    });

    setMaterialSelections(newMaterialSelections);
    setPaletteSelections(newPaletteSelections);
  }, [operations, materialsData, paletes]);

  const isMaterialFromPalette = useCallback(
    (operationId: string) => {
      return !!paletteSelections[operationId];
    },
    [paletteSelections]
  );

  const handleFieldChange = useCallback(
    async (operationId: string, field: string, value: any) => {
      try {
        let normalizedValue = value;
        if (field === "num_placas_print" || field === "num_placas_corte") {
          const n = parseFloat(String(value));
          normalizedValue = Number.isFinite(n) ? n : 0;

          const operation = operations.find((op) => op.id === operationId);
          if (operation && normalizedValue > 0) {
            const validation = await validateOperationQuantity(
              supabase,
              operation,
              normalizedValue
            );

            if (!validation.valid) {
              alert(`Erro de validação: ${validation.error}`);
              return;
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

        // Sync Impressao -> Corte when relevant fields change
        if (
          operation?.Tipo_Op === "Impressao" &&
          [
            "material_id",
            "num_placas_print",
            "notas_imp",
            "N_Pal",
            "data_operacao",
          ].includes(field)
        ) {
          const { data: linkedCorteOps } = await supabase
            .from("producao_operacoes")
            .select("id")
            .eq("source_impressao_id", operationId);

          if (linkedCorteOps && linkedCorteOps.length > 0) {
            const corteUpdate: Record<string, any> = {};
            if (field === "material_id")
              corteUpdate.material_id = normalizedValue;
            if (field === "num_placas_print")
              corteUpdate.QT_print = normalizedValue;
            if (field === "notas_imp") corteUpdate.notas = normalizedValue;
            if (field === "N_Pal") corteUpdate.N_Pal = normalizedValue;
            if (field === "data_operacao")
              corteUpdate.data_operacao = normalizedValue;

            if (Object.keys(corteUpdate).length > 0) {
              for (const corteOp of linkedCorteOps) {
                const { error: syncErr } = await supabase
                  .from("producao_operacoes")
                  .update(corteUpdate)
                  .eq("id", corteOp.id);

                if (!syncErr) {
                  for (const [k, v] of Object.entries(corteUpdate)) {
                    await logFieldUpdate(supabase, corteOp.id, k, undefined, v);
                  }
                }
              }
            }
          }
        }

        onRefresh();
      } catch (err) {
        console.error("Error updating operation:", err);
        alert("Erro ao atualizar operação");
      }
    },
    [operations, supabase, onRefresh]
  );

  const handleDuplicateRow = useCallback(
    async (operation: ProductionOperation) => {
      const result = await duplicateOperationRow(supabase, operation);

      if (result.success) {
        onRefresh();
        onMainRefresh();
      } else {
        alert(`Erro ao duplicar operação: ${result.error}`);
      }
    },
    [supabase, onRefresh, onMainRefresh]
  );

  const handleStartExecution = useCallback(
    async (operation: ProductionOperation) => {
      try {
        const resp = await createFirstExecutionFromSource(operation, supabase);
        if (!resp.success) {
          alert(resp.error || "Erro ao iniciar execução");
          return;
        }
        onRefresh();
        onMainRefresh();
      } catch (err: any) {
        console.error("Error starting execution:", err);
        alert("Erro ao iniciar execução");
      }
    },
    [supabase, onRefresh, onMainRefresh]
  );

  const handleAddOperation = useCallback(async () => {
    try {
      const now = new Date();
      const dateStr = format(now, "yyyyMMdd");
      const timeStr = format(now, "HHmmss");
      const foShort = item.folhas_obras?.numero_fo?.substring(0, 6) || "FO";
      const no_interno = `${foShort}-${dateStr}-IMP-${timeStr}`;

      const operationData = {
        item_id: itemId,
        folha_obra_id: folhaObraId,
        Tipo_Op: "Impressao",
        data_operacao: new Date().toISOString().split("T")[0],
        no_interno,
        num_placas_print: 0,
        num_placas_corte: 0,
        concluido: false,
      };

      const { data: savedOperation, error } = await supabase
        .from("producao_operacoes")
        .insert([operationData])
        .select()
        .single();

      if (error) throw error;

      await logOperationCreation(supabase, savedOperation.id, operationData);

      // Auto-create linked Corte operation
      const corteNoInterno = `${no_interno}-CORTE`;

      const corteData = {
        Tipo_Op: "Corte",
        item_id: itemId,
        folha_obra_id: folhaObraId,
        data_operacao: new Date().toISOString().split("T")[0],
        no_interno: corteNoInterno,
        num_placas_corte: 0,
        QT_print: 0,
        source_impressao_id: savedOperation.id,
        concluido: false,
      };

      const { data: corteOp, error: corteError } = await supabase
        .from("producao_operacoes")
        .insert([corteData])
        .select()
        .single();

      if (!corteError && corteOp) {
        await logOperationCreation(supabase, corteOp.id, corteData);
      }

      onRefresh();
      onMainRefresh();
    } catch (err) {
      console.error("Error adding operation:", err);
      alert("Erro ao adicionar operação");
    }
  }, [item, itemId, folhaObraId, supabase, onRefresh, onMainRefresh]);

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

  const handlePaletteSelection = useCallback(
    async (operationId: string, paletteId: string) => {
      if (!paletteId) {
        setPaletteSelections((prev) => ({
          ...prev,
          [operationId]: "",
        }));

        setMaterialSelections((prev) => ({
          ...prev,
          [operationId]: {
            material: undefined,
            carateristica: undefined,
            cor: undefined,
          },
        }));

        await handleFieldChange(operationId, "N_Pal", "");
        await handleFieldChange(operationId, "material_id", null);
        return;
      }

      const selectedPalette = paletes.find((p) => p.id === paletteId);

      if (!selectedPalette) return;

      setPaletteSelections((prev) => ({
        ...prev,
        [operationId]: paletteId,
      }));

      await handleFieldChange(operationId, "N_Pal", selectedPalette.no_palete);

      if (selectedPalette.ref_cartao) {
        const matchingMaterial = materialsData.find(
          (m) => m.referencia === selectedPalette.ref_cartao
        );

        if (matchingMaterial) {
          await handleFieldChange(
            operationId,
            "material_id",
            matchingMaterial.id
          );

          setMaterialSelections((prev) => ({
            ...prev,
            [operationId]: {
              material: matchingMaterial.material?.toUpperCase() || undefined,
              carateristica:
                matchingMaterial.carateristica?.toUpperCase() || undefined,
              cor: matchingMaterial.cor?.toUpperCase() || undefined,
            },
          }));
        }
      }
    },
    [paletes, materialsData, handleFieldChange]
  );

  const handleMaterialChange = useCallback(
    (
      operationId: string,
      field: "material" | "carateristica" | "cor",
      value: string
    ) => {
      setMaterialSelections((prev) => {
        const current = prev[operationId] || {};

        if (field === "material") {
          const newSelection = {
            material: value,
            carateristica: undefined,
            cor: undefined,
          };
          const materialId = getMaterialId(value);
          handleFieldChange(operationId, "material_id", materialId || null);
          return { ...prev, [operationId]: newSelection };
        }

        if (field === "carateristica") {
          const newSelection = {
            ...current,
            carateristica: value,
            cor: undefined,
          };
          const materialId = getMaterialId(current.material, value);
          handleFieldChange(operationId, "material_id", materialId || null);
          return { ...prev, [operationId]: newSelection };
        }

        if (field === "cor") {
          const newSelection = { ...current, cor: value };
          const materialId = getMaterialId(
            current.material,
            current.carateristica,
            value
          );
          handleFieldChange(operationId, "material_id", materialId || null);
          return { ...prev, [operationId]: newSelection };
        }

        return prev;
      });
    },
    [getMaterialId, handleFieldChange]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg uppercase">Operações de Impressão</h3>
        <Button size="sm" variant="default" onClick={handleAddOperation}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </div>

      {printSummaries.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase text-muted-foreground">
            Progresso de Impressão (planeado vs executado)
          </h4>
          <div className="space-y-2">
            {printSummaries.map((summary) => (
              <OperationProgress
                key={summary.id}
                planned={summary.planned}
                executed={summary.executed}
                remaining={summary.remaining}
                progress={summary.progress}
                operationType="print"
                showDetails={false}
              />
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Data</TableHead>
              <TableHead className="w-[100px]">Plano</TableHead>
              <TableHead className="w-[60px]">Cores</TableHead>
              <TableHead className="w-[120px]">Operador</TableHead>
              <TableHead className="w-[120px]">Máquina</TableHead>
              <TableHead className="w-[140px]">Palete</TableHead>
              <TableHead className="w-[120px]">Material</TableHead>
              <TableHead className="w-[120px]">Características</TableHead>
              <TableHead className="w-[120px]">Cor</TableHead>
              <TableHead className="w-[80px]">Print</TableHead>
              <TableHead className="w-[50px]">Notas</TableHead>
              <TableHead className="w-[130px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((op) => (
              <TableRow key={op.id}>
                {/* Data */}
                <TableCell>
                  <DatePicker
                    selected={
                      op.data_operacao
                        ? new Date(op.data_operacao)
                        : undefined
                    }
                    onSelect={(date: Date | undefined) => {
                      handleFieldChange(
                        op.id,
                        "data_operacao",
                        date ? date.toISOString().split("T")[0] : null
                      );
                    }}
                  />
                </TableCell>

                {/* Plano Nome */}
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Input
                      value={op.plano_nome || ""}
                      onChange={(e) =>
                        handleFieldChange(op.id, "plano_nome", e.target.value)
                      }
                      placeholder="Plano A"
                      className="w-full text-sm"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {op.batch_id && (
                        <Badge variant="outline" className="text-xs">
                          Lote {op.placas_neste_batch}/{op.total_placas}
                        </Badge>
                      )}
                      {op.plano_nome && (
                        <Badge variant="outline" className="text-xs">
                          Do Designer
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Cores */}
                <TableCell>
                  <Input
                    value={op.cores || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d?\/?\d?$/.test(value) || value === "") {
                        handleFieldChange(op.id, "cores", value);
                      }
                    }}
                    placeholder="4/4"
                    className="w-[50px] text-sm font-mono text-center"
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
                        .filter((m) => m.tipo === "Impressao")
                        .map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Palete */}
                <TableCell>
                  <Combobox
                    options={[
                      { value: "", label: "Sem palete" },
                      ...paletes.map((palete) => ({
                        value: palete.id,
                        label: palete.no_palete,
                      })),
                    ]}
                    value={paletteSelections[op.id] || op.N_Pal || ""}
                    onChange={(v) => handlePaletteSelection(op.id, v)}
                  />
                </TableCell>

                {/* Material */}
                <TableCell>
                  <Combobox
                    options={materialOptions}
                    value={materialSelections[op.id]?.material || ""}
                    onChange={(v) =>
                      handleMaterialChange(op.id, "material", v)
                    }
                    disabled={isMaterialFromPalette(op.id)}
                  />
                </TableCell>

                {/* Características */}
                <TableCell>
                  <Combobox
                    options={getCaracteristicaOptions(
                      materialSelections[op.id]?.material
                    )}
                    value={materialSelections[op.id]?.carateristica || ""}
                    onChange={(v) =>
                      handleMaterialChange(op.id, "carateristica", v)
                    }
                    disabled={isMaterialFromPalette(op.id)}
                  />
                </TableCell>

                {/* Cor */}
                <TableCell>
                  <Combobox
                    options={getCorOptions(
                      materialSelections[op.id]?.material,
                      materialSelections[op.id]?.carateristica
                    )}
                    value={materialSelections[op.id]?.cor || ""}
                    onChange={(v) => handleMaterialChange(op.id, "cor", v)}
                    disabled={isMaterialFromPalette(op.id)}
                  />
                </TableCell>

                {/* Num Placas Print */}
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    value={String(op.num_placas_print ?? "")}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d+(\.\d{0,1})?$/.test(value)) {
                        handleFieldChange(op.id, "num_placas_print", value);
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

                {/* Ações */}
                <TableCell>
                  <div className="flex gap-1">
                    {op.is_source_record && (
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleStartExecution(op)}
                        title="Iniciar execução"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
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

export const ImpressaoOperationsTable = memo(ImpressaoOperationsTableInner);

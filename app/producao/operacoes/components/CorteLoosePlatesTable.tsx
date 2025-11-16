"use client";

/**
 * Corte Loose Plates Table Component
 * For standalone cutting operations (not linked to print jobs)
 */

import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";

// Debounce utility for performance optimization
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Combobox from "@/components/ui/Combobox";
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
import {
  logOperationCreation,
  logFieldUpdate,
  logOperationDeletion,
} from "@/utils/auditLogging";
import { Plus, Trash2, Copy } from "lucide-react";
import {
  CopyButton,
  DeleteButton,
  ActionColumn,
} from "@/components/custom/ActionButtons";
import {
  duplicateOperationRow,
  validateOperationQuantity,
} from "../utils/operationsHelpers";

interface ProductionOperation {
  id: string;
  data_operacao: string;
  operador_id?: string | null;
  folha_obra_id: string;
  item_id: string;
  no_interno: string;
  Tipo_Op?: string;
  maquina?: string | null;
  material_id?: string | null;
  stock_consumido_id?: string | null;
  num_placas_print?: number | null;
  num_placas_corte?: number | null;
  QT_print?: number | null;
  observacoes?: string | null;
  notas?: string | null;
  notas_imp?: string | null;
  status?: string;
  concluido?: boolean;
  data_conclusao?: string | null;
  created_at?: string;
  updated_at?: string;
  N_Pal?: string | null;
  tem_corte?: boolean | null;
  source_impressao_id?: string | null;
  plano_nome?: string | null;
  cores?: string | null;
  batch_id?: string | null;
  batch_parent_id?: string | null;
  total_placas?: number | null;
  placas_neste_batch?: number | null;
}

interface ProductionItem {
  id: string;
  folha_obra_id: string;
  descricao: string;
  codigo?: string | null;
  quantidade?: number | null;
  folhas_obras?: {
    numero_fo?: string;
    nome_campanha?: string;
  } | null;
}

interface CorteLoosePlatesTableProps {
  operations: ProductionOperation[];
  itemId: string;
  folhaObraId: string;
  item: ProductionItem;
  supabase: any;
  onRefresh: () => void;
  onMainRefresh: () => void;
}

export function CorteLoosePlatesTable({
  operations,
  itemId,
  folhaObraId,
  item,
  supabase,
  onRefresh,
  onMainRefresh,
}: CorteLoosePlatesTableProps) {
  const { operators, machines } = useTableData();
  const {
    materialOptions,
    getCaracteristicaOptions,
    getCorOptions,
    getMaterialId,
    materialsData,
  } = useMaterialsCascading();

  const [materialSelections, setMaterialSelections] = useState<{
    [operationId: string]: {
      material?: string;
      carateristica?: string;
      cor?: string;
    };
  }>({});
  const [paletteSelections, setPaletteSelections] = useState<{
    [operationId: string]: string;
  }>({});
  const [paletes, setPaletes] = useState<any[]>([]);

  // Local state for immediate UI updates (performance optimization)
  const [localValues, setLocalValues] = useState<{
    [operationId: string]: { [field: string]: any };
  }>({});

  // Fetch paletes
  useEffect(() => {
    const fetchPaletes = async () => {
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
      }
    };

    fetchPaletes();
  }, [supabase]);

  // Check if material is from palette
  const isMaterialFromPalette = (operationId: string) => {
    return !!paletteSelections[operationId];
  };

  // Initialize material and palette selections from existing operations
  useEffect(() => {
    const initSelections = () => {
      const newMaterialSelections: {
        [operationId: string]: {
          material?: string;
          carateristica?: string;
          cor?: string;
        };
      } = {};
      const newPaletteSelections: { [operationId: string]: string } = {};

      operations.forEach((op) => {
        // Initialize palette selections from N_Pal field
        if (op.N_Pal && paletes.length > 0) {
          const palette = paletes.find((p) => p.no_palete === op.N_Pal);

          if (palette) {
            newPaletteSelections[op.id] = palette.id;

            // If palette has ref_cartao, find and populate material
            if (palette.ref_cartao && materialsData.length > 0) {
              const materialRecord = materialsData.find(
                (m) => m.referencia === palette.ref_cartao,
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

        // Initialize material selections from material_id (if no palette)
        if (
          !newMaterialSelections[op.id] &&
          op.material_id &&
          materialsData.length > 0
        ) {
          const materialRecord = materialsData.find(
            (m) => m.id === op.material_id,
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
    };

    initSelections();
  }, [operations, materialsData, paletes]);

  const handleFieldChange = async (
    operationId: string,
    field: string,
    value: any,
  ) => {
    try {
      // Normalize numeric fields
      let normalizedValue = value;
      if (field === "num_placas_corte") {
        const n = parseFloat(String(value));
        normalizedValue = Number.isFinite(n) ? n : 0;

        const operation = operations.find((op) => op.id === operationId);
        if (operation) {
          const validation = await validateOperationQuantity(
            supabase,
            operation as any,
            normalizedValue,
          );
          if (!validation.valid) {
            alert(`Erro de valida��o: ${validation.error}`);
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
        normalizedValue,
      );
      onRefresh();
    } catch (err) {
      console.error("Error updating operation:", err);
      alert("Erro ao atualizar operação");
    }
  };

  // Debounced version for text/number inputs (500ms delay for smooth typing)
  const debouncedFieldChange = useCallback(
    (opId: string, field: string, value: any) => {
      const debounced = debounce(() => {
        handleFieldChange(opId, field, value);
      }, 500);
      debounced();
    },
    [operations], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleAddOperation = async () => {
    try {
      const now = new Date();
      const dateStr = format(now, "yyyyMMdd");
      const timeStr = format(now, "HHmmss");
      const foShort = item.folhas_obras?.numero_fo?.substring(0, 6) || "FO";
      const no_interno = `${foShort}-${dateStr}-CRT-${timeStr}`;

      const operationData = {
        item_id: itemId,
        folha_obra_id: folhaObraId,
        Tipo_Op: "Corte",
        data_operacao: new Date().toISOString().split("T")[0],
        no_interno,
        num_placas_corte: 0,
        source_impressao_id: null, // Explicitly null for loose plates
        concluido: false,
      };

      const { data: savedOperation, error } = await supabase
        .from("producao_operacoes")
        .insert([operationData])
        .select()
        .single();

      if (error) throw error;

      await logOperationCreation(supabase, savedOperation.id, operationData);
      onRefresh();
      onMainRefresh();
    } catch (err) {
      console.error("Error adding operation:", err);
      alert("Erro ao adicionar operação");
    }
  };

  const handleDuplicateOperation = async (operationId: string) => {
    try {
      const sourceOp = operations.find((op) => op.id === operationId);
      if (!sourceOp) return;

      const result = await duplicateOperationRow(supabase, sourceOp as any);
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
  };

  const handleDeleteOperation = async (operationId: string) => {
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
  };

  const handlePaletteSelection = async (
    operationId: string,
    paletteId: string,
  ) => {
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
        (m) => m.referencia === selectedPalette.ref_cartao,
      );

      if (matchingMaterial) {
        await handleFieldChange(
          operationId,
          "material_id",
          matchingMaterial.id,
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
  };

  const handleMaterialChange = (
    operationId: string,
    field: "material" | "carateristica" | "cor",
    value: string,
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
          value,
        );
        handleFieldChange(operationId, "material_id", materialId || null);
        return { ...prev, [operationId]: newSelection };
      }

      return prev;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg">Operações de Corte (Chapas Soltas)</h3>
        <Button size="sm" variant="default" onClick={handleAddOperation}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Data</TableHead>
              <TableHead className="w-[150px]">Plano</TableHead>
              <TableHead className="w-[120px]">Operador</TableHead>
              <TableHead className="w-[120px]">Máquina</TableHead>
              <TableHead className="w-[140px]">Palete</TableHead>
              <TableHead className="w-[120px]">Material</TableHead>
              <TableHead className="w-[120px]">Características</TableHead>
              <TableHead className="w-[120px]">Cor</TableHead>
              <TableHead className="w-[80px]">Corte</TableHead>
              <TableHead className="w-[50px]">Notas</TableHead>
              <TableHead className="w-[50px] text-center">C</TableHead>
              <TableHead className="w-[70px] text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((op) => {
              return (
                <TableRow key={op.id}>
                  {/* Data - Icon only */}
                  <TableCell className="w-[50px]">
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
                          date ? date.toISOString().split("T")[0] : null,
                        );
                      }}
                      iconOnly
                    />
                  </TableCell>

                  {/* Plano Nome */}
                  <TableCell>
                    <Input
                      value={op.plano_nome || ""}
                      onChange={(e) => {
                        handleFieldChange(op.id, "plano_nome", e.target.value);
                      }}
                      placeholder="Plano A"
                      className="w-full text-sm"
                    />
                  </TableCell>

                  <TableCell>
                    <Select
                      value={op.operador_id || ""}
                      onValueChange={(v) => {
                        handleFieldChange(op.id, "operador_id", v);
                      }}
                    >
                      <SelectTrigger>
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

                  <TableCell>
                    <Select
                      value={op.maquina || ""}
                      onValueChange={(v) => {
                        handleFieldChange(op.id, "maquina", v);
                      }}
                    >
                      <SelectTrigger>
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
                      onChange={(v) => {
                        handlePaletteSelection(op.id, v);
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <Combobox
                      options={materialOptions}
                      value={materialSelections[op.id]?.material || ""}
                      onChange={(v) => {
                        handleMaterialChange(op.id, "material", v);
                      }}
                      disabled={isMaterialFromPalette(op.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <Combobox
                      options={getCaracteristicaOptions(
                        materialSelections[op.id]?.material,
                      )}
                      value={materialSelections[op.id]?.carateristica || ""}
                      onChange={(v) => {
                        handleMaterialChange(op.id, "carateristica", v);
                      }}
                      disabled={isMaterialFromPalette(op.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <Combobox
                      options={getCorOptions(
                        materialSelections[op.id]?.material,
                        materialSelections[op.id]?.carateristica,
                      )}
                      value={materialSelections[op.id]?.cor || ""}
                      onChange={(v) => {
                        handleMaterialChange(op.id, "cor", v);
                      }}
                      disabled={isMaterialFromPalette(op.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={String(
                        localValues[op.id]?.num_placas_corte ??
                          op.num_placas_corte ??
                          "",
                      )}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Update local state immediately for smooth UI
                        setLocalValues((prev) => ({
                          ...prev,
                          [op.id]: {
                            ...prev[op.id],
                            num_placas_corte: value,
                          },
                        }));
                        // Debounced save to database
                        debouncedFieldChange(op.id, "num_placas_corte", value);
                      }}
                      className="w-full"
                    />
                  </TableCell>

                  <TableCell>
                    <SimpleNotasPopover
                      value={op.observacoes || ""}
                      onSave={(value) => {
                        handleFieldChange(op.id, "observacoes", value);
                      }}
                      placeholder="Notas..."
                      label="Notas"
                      buttonSize="icon"
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={op.concluido || false}
                        onCheckedChange={(checked) =>
                          handleFieldChange(op.id, "concluido", checked)
                        }
                      />
                    </div>
                  </TableCell>

                  <ActionColumn width="w-[100px]">
                    <CopyButton
                      onClick={() => handleDuplicateOperation(op.id)}
                      title="Duplicar operação (para múltiplos turnos/máquinas)"
                    />
                    <DeleteButton
                      onClick={() => handleDeleteOperation(op.id)}
                      title="Eliminar operação"
                    />
                  </ActionColumn>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {operations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma operação de corte solta.
          </div>
        )}
      </div>
    </div>
  );
}
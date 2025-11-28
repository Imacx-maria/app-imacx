"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Trash2, Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { useMaterialsCascading } from "@/hooks/useMaterialsCascading";
import { useTableData } from "@/hooks/useTableData";
import { useCoresImpressao } from "@/hooks/useCoresImpressao";
import Combobox from "@/components/ui/Combobox";
import {
  DeleteButton,
  ActionColumn,
  AddButton,
} from "@/components/custom/ActionButtons";

export interface DesignerPlano {
  id?: string;
  plano_nome: string;
  tipo_operacao: "Impressao" | "Corte" | "Impressao_Flexiveis";
  maquina?: string;
  material?: string;
  caracteristicas?: string;
  cor?: string;
  material_id?: string | null;
  cores?: string;
  quantidade?: number;
  notas?: string;
  plano_ordem?: number;
}

interface PlanosTableProps {
  itemId: string;
  planos: DesignerPlano[];
  onPlanosChange: (planos: DesignerPlano[]) => void;
  supabase: any;
}

export default function PlanosTable({
  itemId,
  planos,
  onPlanosChange,
  supabase,
}: PlanosTableProps) {
  const {
    materialOptions,
    getCaracteristicaOptions,
    getCorOptions,
    getMaterialId,
  } = useMaterialsCascading();
  const { machines } = useTableData();
  const {
    cores: coresOptions,
    loading: coresLoading,
    error: coresError,
  } = useCoresImpressao();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 40;

  // Debug log for cores options
  useEffect(() => {
    console.log("🎨 [PlanosTable] Cores options updated:", coresOptions);
    console.log("🎨 [PlanosTable] Cores loading:", coresLoading);
    console.log("🎨 [PlanosTable] Cores error:", coresError);
  }, [coresOptions, coresLoading, coresError]);

  // Reset to page 1 when planos change
  useEffect(() => {
    setCurrentPage(1);
  }, [planos.length]);

  // Pagination calculations
  const totalPages = Math.ceil(planos.length / ITEMS_PER_PAGE);
  const paginatedPlanos = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return planos.slice(startIndex, endIndex);
  }, [planos, currentPage]);

  // Convert machines to combobox format (value = UUID, label = name)
  const machineOptions = machines.map((m) => ({
    value: m.value, // UUID from database
    label: m.label.toUpperCase(),
  }));

  const [materialSelections, setMaterialSelections] = useState<{
    [key: string]: {
      material?: string;
      caracteristicas?: string;
      cor?: string;
    };
  }>({});

  // Debounce timers for text inputs
  const debounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Initialize material selections from existing planos
  useEffect(() => {
    const selections: typeof materialSelections = {};
    planos.forEach((plano) => {
      if (plano.id) {
        selections[plano.id] = {
          material: plano.material?.toUpperCase(),
          caracteristicas: plano.caracteristicas?.toUpperCase(),
          cor: plano.cor?.toUpperCase(),
        };
      }
    });
    setMaterialSelections(selections);
  }, [planos]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timersRef = debounceTimers.current;
    return () => {
      const timers = Object.values(timersRef);
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleAddPlano = async () => {
    const nextOrdem = Math.max(0, ...planos.map((p) => p.plano_ordem || 0)) + 1;
    const planoLetter = String.fromCharCode(64 + nextOrdem); // A, B, C, etc.

    try {
      const planoData = {
        plano_nome: `Plano ${planoLetter}`,
        tipo_operacao: "Impressao" as const,
        plano_ordem: nextOrdem,
        item_id: itemId,
        quantidade: 0,
      };

      const { data, error } = await supabase
        .from("designer_planos")
        .insert([planoData])
        .select()
        .single();

      if (error) throw error;

      onPlanosChange([...planos, data]);
    } catch (error) {
      console.error("Error creating plano:", error);
      alert("Erro ao criar plano");
    }
  };

  const handleUpdateField = useCallback(
    async (
      planoId: string,
      field: keyof DesignerPlano,
      value: any,
      debounce = false,
    ) => {
      // Update local state immediately for responsiveness
      onPlanosChange(
        planos.map((p) => (p.id === planoId ? { ...p, [field]: value } : p)),
      );

      const updateDatabase = async () => {
        try {
          const updates: Record<string, any> = { [field]: value };

          // If updating material selections, also update material_id
          if (
            field === "material" ||
            field === "caracteristicas" ||
            field === "cor"
          ) {
            const selections = materialSelections[planoId] || {};
            const material = field === "material" ? value : selections.material;
            const caracteristicas =
              field === "caracteristicas" ? value : selections.caracteristicas;
            const cor = field === "cor" ? value : selections.cor;

            updates.material = material;
            updates.caracteristicas = caracteristicas;
            updates.cor = cor;
            updates.material_id =
              material && caracteristicas && cor
                ? getMaterialId(material, caracteristicas, cor)
                : null;
          }

          const { error } = await supabase
            .from("designer_planos")
            .update(updates)
            .eq("id", planoId);

          if (error) throw error;
        } catch (error) {
          console.error("Error updating plano:", error);
        }
      };

      if (debounce) {
        // Clear existing timer for this field
        const timerKey = `${planoId}-${field}`;
        if (debounceTimers.current[timerKey]) {
          clearTimeout(debounceTimers.current[timerKey]);
        }
        // Set new timer
        debounceTimers.current[timerKey] = setTimeout(updateDatabase, 800);
      } else {
        // Update immediately
        await updateDatabase();
      }
    },
    [planos, onPlanosChange, supabase, materialSelections, getMaterialId],
  );

  const handleDeletePlano = async (planoId: string) => {
    if (!confirm("Tem certeza que deseja eliminar este plano?")) return;

    try {
      const { error } = await supabase
        .from("designer_planos")
        .delete()
        .eq("id", planoId);

      if (error) throw error;

      onPlanosChange(planos.filter((p) => p.id !== planoId));
    } catch (error) {
      console.error("Error deleting plano:", error);
      alert("Erro ao eliminar plano");
    }
  };

  const handleMaterialChange = (
    planoId: string,
    field: "material" | "caracteristicas" | "cor",
    value: string,
  ) => {
    setMaterialSelections((prev) => {
      const current = prev[planoId] || {};

      if (field === "material") {
        return { ...prev, [planoId]: { material: value } };
      } else if (field === "caracteristicas") {
        return {
          ...prev,
          [planoId]: { ...current, caracteristicas: value, cor: undefined },
        };
      } else {
        return { ...prev, [planoId]: { ...current, cor: value } };
      }
    });

    // Auto-save the material change
    handleUpdateField(planoId, field, value, false);
  };

  const renderMaterialInputs = (planoId: string) => {
    const selection = materialSelections[planoId] || {};

    console.log(`[PlanosTable] renderMaterialInputs for ${planoId}:`, {
      selection,
      materialOptionsCount: materialOptions.length,
      caracteristicasCount: getCaracteristicaOptions(selection.material).length,
      coresCount: getCorOptions(selection.material, selection.caracteristicas)
        .length,
    });

    return (
      <div className="flex gap-2">
        <Combobox
          options={materialOptions}
          value={selection.material || ""}
          onChange={(value) => handleMaterialChange(planoId, "material", value)}
          placeholder="Material"
          className="w-[150px]"
          emptyMessage={
            materialOptions.length === 0
              ? "Nenhum material disponível"
              : "Nenhuma opção encontrada."
          }
        />
        <Combobox
          options={getCaracteristicaOptions(selection.material)}
          value={selection.caracteristicas || ""}
          onChange={(value) =>
            handleMaterialChange(planoId, "caracteristicas", value)
          }
          placeholder="Caract."
          disabled={!selection.material}
          className="w-[125px]"
          emptyMessage={
            selection.material &&
            getCaracteristicaOptions(selection.material).length === 0
              ? "Nenhuma característica"
              : "Selecione material"
          }
        />
        <Combobox
          options={getCorOptions(selection.material, selection.caracteristicas)}
          value={selection.cor || ""}
          onChange={(value) => handleMaterialChange(planoId, "cor", value)}
          placeholder="Cor"
          disabled={!selection.caracteristicas}
          className="w-[150px]"
          emptyMessage={
            selection.caracteristicas &&
            getCorOptions(selection.material, selection.caracteristicas)
              .length === 0
              ? "Nenhuma cor"
              : "Selecione caract."
          }
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Planos de Produção</h4>
        <AddButton onClick={handleAddPlano} size="sm">
          ADICIONAR PLANO
        </AddButton>
      </div>

      <div className="rounded-md imx-border">
        <Table className="w-full table-fixed imx-table-compact">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Nome</TableHead>
              <TableHead className="w-[100px]">Tipo Op</TableHead>
              <TableHead className="w-[180px]">Máquina</TableHead>
              <TableHead className="w-[425px]">Material</TableHead>
              <TableHead className="w-[140px]">Cores</TableHead>
              <TableHead className="w-[80px]">Qtd</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  Nenhum plano criado. Clique em &quot;Adicionar Plano&quot;
                  para começar.
                </TableCell>
              </TableRow>
            )}

            {paginatedPlanos.map((plano) => (
              <TableRow key={plano.id}>
                <TableCell>
                  <Input
                    value={plano.plano_nome}
                    onChange={(e) => {
                      const value = e.target.value;
                      onPlanosChange(
                        planos.map((p) =>
                          p.id === plano.id ? { ...p, plano_nome: value } : p,
                        ),
                      );
                      handleUpdateField(plano.id!, "plano_nome", value, true);
                    }}
                    className="w-full h-9 text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={plano.tipo_operacao}
                    onValueChange={(value: any) => {
                      onPlanosChange(
                        planos.map((p) =>
                          p.id === plano.id
                            ? { ...p, tipo_operacao: value }
                            : p,
                        ),
                      );
                      handleUpdateField(
                        plano.id!,
                        "tipo_operacao",
                        value,
                        false,
                      );
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Impressao">Impressão</SelectItem>
                      <SelectItem value="Corte">Corte</SelectItem>
                      <SelectItem value="Impressao_Flexiveis">
                        Flexíveis
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Combobox
                    options={machineOptions}
                    value={plano.maquina || ""}
                    onChange={(value) => {
                      onPlanosChange(
                        planos.map((p) =>
                          p.id === plano.id ? { ...p, maquina: value } : p,
                        ),
                      );
                      handleUpdateField(plano.id!, "maquina", value, false);
                    }}
                    placeholder="Máquina"
                    className="w-full"
                  />
                </TableCell>
                <TableCell>{renderMaterialInputs(plano.id!)}</TableCell>
                <TableCell>
                  <Combobox
                    options={coresOptions}
                    value={plano.cores || ""}
                    onChange={(value) => {
                      onPlanosChange(
                        planos.map((p) =>
                          p.id === plano.id ? { ...p, cores: value } : p,
                        ),
                      );
                      handleUpdateField(plano.id!, "cores", value, false);
                    }}
                    placeholder="Cores"
                    className="w-[140px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={plano.quantidade || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Validate: allow max 1 decimal place
                      if (value === "" || /^\d+(\.\d{0,1})?$/.test(value)) {
                        const numValue = value === "" ? 0 : parseFloat(value);
                        onPlanosChange(
                          planos.map((p) =>
                            p.id === plano.id
                              ? { ...p, quantidade: numValue }
                              : p,
                          ),
                        );
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const numValue = value === "" ? 0 : parseFloat(value);
                      handleUpdateField(
                        plano.id!,
                        "quantidade",
                        numValue,
                        false,
                      );
                    }}
                    className="w-[70px] h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={plano.notas || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      onPlanosChange(
                        planos.map((p) =>
                          p.id === plano.id ? { ...p, notas: value } : p,
                        ),
                      );
                      handleUpdateField(plano.id!, "notas", value, true);
                    }}
                    className="h-9 text-sm"
                    placeholder="Notas..."
                  />
                </TableCell>
                <ActionColumn width="w-[70px]">
                  <DeleteButton
                    onClick={() => handleDeletePlano(plano.id!)}
                    title="Eliminar plano"
                  />
                </ActionColumn>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
          <div className="text-muted-foreground">
            Página {currentPage} de {totalPages} ({planos.length} planos)
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
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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

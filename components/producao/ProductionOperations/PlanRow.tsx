"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { useMaterialsCascading } from "@/hooks/useMaterialsCascading";
import { createBrowserClient } from "@/utils/supabase";

interface PlanRowProps {
  plan: {
    id: string;
    plano_nome: string;
    tipo_operacao: string;
    material?: string;
    caracteristicas?: string;
    cor?: string;
    material_id?: string;
    cores?: string;
    quantidade?: number;
  };
  totalExecuted: number;
  printExecuted: number; // Print operations executed
  cutExecuted: number; // Cut operations executed
  executionCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdatePlan: (planId: string, data: PlanUpdateData) => Promise<void>;
  onAddExecution: (planId: string) => void;
  onDeletePlan?: (planId: string) => void;
  children?: React.ReactNode; // Executions table
  mode?: "full" | "cut-only"; // "full" shows IMP+CRT, "cut-only" shows only CRT
}

export interface PlanUpdateData {
  material_source: "palette" | "individual";
  palette_number?: string;
  material?: string;
  caracteristicas?: string;
  cor?: string;
  material_id?: string;
  cores?: string;
  quantidade?: number;
}

export function PlanRow({
  plan,
  totalExecuted,
  printExecuted,
  cutExecuted,
  executionCount,
  isExpanded,
  onToggleExpand,
  onUpdatePlan,
  onAddExecution,
  onDeletePlan,
  children,
  mode = "full",
}: PlanRowProps) {
  const supabase = useMemo(() => createBrowserClient(), []);

  const {
    materialOptions,
    getCaracteristicaOptions,
    getCorOptions,
    getMaterialId,
  } = useMaterialsCascading();

  // Cores options from cores_impressao table
  const [coresOptions, setCoresOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // Fetch cores options
  useEffect(() => {
    const fetchCores = async () => {
      const { data, error } = await supabase
        .from("cores_impressao")
        .select("n_cores")
        .order("n_cores", { ascending: true });

      if (!error && data) {
        setCoresOptions(
          data.map((c: any) => ({
            value: c.n_cores,
            label: c.n_cores,
          })),
        );
      }
    };
    fetchCores();
  }, [supabase]);

  // Material source is always individual for existing plans (N_Pal not stored in designer_planos)
  const [materialSource, setMaterialSource] = useState<
    "palette" | "individual"
  >("individual");
  const [paletteNumber, setPaletteNumber] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState(plan.material || "");
  const [selectedCaracteristica, setSelectedCaracteristica] = useState(
    plan.caracteristicas || "",
  );
  const [selectedCor, setSelectedCor] = useState(plan.cor || "");
  const [cores, setCores] = useState(plan.cores || "");
  const [quantidade, setQuantidade] = useState<number>(plan.quantidade || 0);

  // Calculate dual progress (print and cut separately)
  const printProgress =
    quantidade > 0 ? Math.min(100, (printExecuted / quantidade) * 100) : 0;
  const cutProgress =
    quantidade > 0 ? Math.min(100, (cutExecuted / quantidade) * 100) : 0;
  // Show cores only in full mode and when not a cut-only plan
  const showCores = mode === "full" && plan.tipo_operacao !== "Corte";

  // Sync with plan prop changes
  useEffect(() => {
    setMaterialSource("individual");
    setPaletteNumber("");
    setSelectedMaterial(plan.material || "");
    setSelectedCaracteristica(plan.caracteristicas || "");
    setSelectedCor(plan.cor || "");
    setCores(plan.cores || "");
    setQuantidade(plan.quantidade || 0);
  }, [
    plan.id,
    plan.material,
    plan.caracteristicas,
    plan.cor,
    plan.cores,
    plan.quantidade,
  ]);

  // Get cascading options
  const caracteristicaOptions = useMemo(
    () => getCaracteristicaOptions(selectedMaterial),
    [getCaracteristicaOptions, selectedMaterial],
  );

  const corOptions = useMemo(
    () => getCorOptions(selectedMaterial, selectedCaracteristica),
    [getCorOptions, selectedMaterial, selectedCaracteristica],
  );

  // Get material ID
  const materialId = useMemo(() => {
    if (materialSource === "individual" && selectedMaterial) {
      return getMaterialId(
        selectedMaterial,
        selectedCaracteristica,
        selectedCor,
      );
    }
    return null;
  }, [
    materialSource,
    selectedMaterial,
    selectedCaracteristica,
    selectedCor,
    getMaterialId,
  ]);

  // Auto-save on changes (debounced)
  const saveChanges = useCallback(async () => {
    const data: PlanUpdateData = {
      material_source: materialSource,
      palette_number: materialSource === "palette" ? paletteNumber : undefined,
      material: materialSource === "individual" ? selectedMaterial : undefined,
      caracteristicas:
        materialSource === "individual" ? selectedCaracteristica : undefined,
      cor: materialSource === "individual" ? selectedCor : undefined,
      material_id: materialId || undefined,
      cores: showCores ? cores : undefined,
      quantidade: quantidade,
    };
    await onUpdatePlan(plan.id, data);
  }, [
    plan.id,
    materialSource,
    paletteNumber,
    selectedMaterial,
    selectedCaracteristica,
    selectedCor,
    materialId,
    cores,
    showCores,
    quantidade,
    onUpdatePlan,
  ]);

  // Handle material source change
  const handleSourceChange = (value: "palette" | "individual") => {
    setMaterialSource(value);
    if (value === "palette") {
      setSelectedMaterial("");
      setSelectedCaracteristica("");
      setSelectedCor("");
    } else {
      setPaletteNumber("");
    }
  };

  // Handle palette number blur (save on blur)
  const handlePaletteBlur = () => {
    if (paletteNumber && materialSource === "palette") {
      saveChanges();
    }
  };

  // Handle material selection change
  const handleMaterialChange = (value: string) => {
    setSelectedMaterial(value);
    setSelectedCaracteristica("");
    setSelectedCor("");
  };

  // Handle caracteristica change
  const handleCaracteristicaChange = (value: string) => {
    setSelectedCaracteristica(value);
    setSelectedCor("");
  };

  // Handle cor change (final selection - save)
  const handleCorChange = (value: string) => {
    setSelectedCor(value);
    // Save after selecting cor
    setTimeout(() => saveChanges(), 100);
  };

  // Handle cores change (from combobox)
  const handleCoresChange = (value: string) => {
    setCores(value);
    // Save after selecting cores
    setTimeout(() => saveChanges(), 100);
  };

  // Handle quantidade blur
  const handleQuantidadeBlur = () => {
    saveChanges();
  };

  return (
    <div className="imx-border mb-2">
      {/* Plan row with inline editing */}
      <div className="p-3 space-y-3">
        {/* Row 1: Plan name, progress, expand */}
        <div className="flex items-center gap-4">
          <div
            className="flex-shrink-0 cursor-pointer"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>

          <div className="font-medium text-lg">{plan.plano_nome}</div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Qtd:</Label>
            <Input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
              onBlur={handleQuantidadeBlur}
              className="w-20 h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Progress bars: IMP and CRT (full mode) or just CRT (cut-only mode) */}
          <div className="flex items-center gap-4">
            {/* Print progress - only show in full mode */}
            {mode === "full" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  IMP:
                </span>
                <div className="flex items-center gap-1 w-24">
                  <Progress value={printProgress} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {printExecuted}/{quantidade}
                  </span>
                </div>
              </div>
            )}
            {/* Cut progress - always show */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                CRT:
              </span>
              <div className="flex items-center gap-1 w-24">
                <Progress value={cutProgress} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {cutExecuted}/{quantidade}
                </span>
              </div>
            </div>
          </div>

          <Badge variant="outline" className="text-xs">
            {executionCount} exec.
          </Badge>
        </div>

        {/* Row 2: Material selection + Nova Execução button */}
        <div className="flex items-center gap-6 pl-8">
          {/* Left side: Material controls */}
          <div className="flex items-center gap-4 flex-1">
            <RadioGroup
              value={materialSource}
              onValueChange={handleSourceChange}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="palette" id={`pal-${plan.id}`} />
                <Label
                  htmlFor={`pal-${plan.id}`}
                  className="cursor-pointer text-sm"
                >
                  Palete
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id={`ind-${plan.id}`} />
                <Label
                  htmlFor={`ind-${plan.id}`}
                  className="cursor-pointer text-sm"
                >
                  Individual
                </Label>
              </div>
            </RadioGroup>

            {materialSource === "palette" && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">
                  N.º Palete:
                </Label>
                <Input
                  value={paletteNumber}
                  onChange={(e) => setPaletteNumber(e.target.value)}
                  onBlur={handlePaletteBlur}
                  placeholder="Ex: 245"
                  className="w-24 h-8"
                />
              </div>
            )}

            {materialSource === "individual" && (
              <>
                <Combobox
                  value={selectedMaterial}
                  onChange={handleMaterialChange}
                  options={materialOptions}
                  placeholder="Material"
                  emptyMessage="Nenhum"
                  className="w-40"
                />
                <Combobox
                  value={selectedCaracteristica}
                  onChange={handleCaracteristicaChange}
                  options={caracteristicaOptions}
                  placeholder="Caract."
                  emptyMessage="Selec. material"
                  disabled={!selectedMaterial}
                  className="w-32"
                />
                <Combobox
                  value={selectedCor}
                  onChange={handleCorChange}
                  options={corOptions}
                  placeholder="Cor"
                  emptyMessage="Selec. caract."
                  disabled={!selectedCaracteristica}
                  className="w-52"
                />
              </>
            )}

            {showCores && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Cores:</Label>
                <Combobox
                  value={cores}
                  onChange={handleCoresChange}
                  options={coresOptions}
                  placeholder="Cores"
                  emptyMessage="Nenhum"
                  className="w-28"
                />
              </div>
            )}
          </div>

          {/* Right side: Nova Execução + Delete button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAddExecution(plan.id)}
              className="whitespace-nowrap"
            >
              <Plus className="h-3 w-3 mr-1" />
              Nova Execução
            </Button>
            {onDeletePlan && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDeletePlan(plan.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded executions */}
      {isExpanded && children}
    </div>
  );
}

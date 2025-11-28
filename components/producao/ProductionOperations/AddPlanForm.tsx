"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { useMaterialsCascading } from "@/hooks/useMaterialsCascading";
import type { AddPlanFormProps, NewPlanData } from "./types";

export function AddPlanForm({
  itemId,
  tipo,
  processo,
  existingPlanNames,
  onSubmit,
  onCancel,
  loading = false,
}: AddPlanFormProps) {
  // Materials cascading hook
  const {
    materialOptions,
    getCaracteristicaOptions,
    getCorOptions,
    getMaterialId,
    loading: materialsLoading,
  } = useMaterialsCascading();

  // Suggest next letter for plan name
  const suggestedName = useMemo(() => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const usedLetters = new Set(existingPlanNames.map((n) => n.toUpperCase()));
    return letters.find((l) => !usedLetters.has(l)) || "A";
  }, [existingPlanNames]);

  // Form state
  const [nome, setNome] = useState(suggestedName);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [cores, setCores] = useState("");
  const [notas, setNotas] = useState("");

  // Material origin
  const [materialSource, setMaterialSource] = useState<"palette" | "individual">("palette");
  const [paletteNumber, setPaletteNumber] = useState("");

  // Cascading material selection (for individual plates)
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedCaracteristica, setSelectedCaracteristica] = useState("");
  const [selectedCor, setSelectedCor] = useState("");

  const showCores = tipo === "impressao";

  // Reset material fields when source changes
  useEffect(() => {
    if (materialSource === "palette") {
      setSelectedMaterial("");
      setSelectedCaracteristica("");
      setSelectedCor("");
    } else {
      setPaletteNumber("");
    }
  }, [materialSource]);

  // Reset dependent fields when parent selection changes
  useEffect(() => {
    setSelectedCaracteristica("");
    setSelectedCor("");
  }, [selectedMaterial]);

  useEffect(() => {
    setSelectedCor("");
  }, [selectedCaracteristica]);

  // Get cascading options
  const caracteristicaOptions = useMemo(() => 
    getCaracteristicaOptions(selectedMaterial),
    [getCaracteristicaOptions, selectedMaterial]
  );

  const corOptions = useMemo(() => 
    getCorOptions(selectedMaterial, selectedCaracteristica),
    [getCorOptions, selectedMaterial, selectedCaracteristica]
  );

  // Get material ID from selection
  const materialId = useMemo(() => {
    if (materialSource === "individual" && selectedMaterial) {
      return getMaterialId(selectedMaterial, selectedCaracteristica, selectedCor);
    }
    return null;
  }, [materialSource, selectedMaterial, selectedCaracteristica, selectedCor, getMaterialId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || quantidade <= 0) {
      return;
    }

    // Validate material
    if (materialSource === "palette" && !paletteNumber) {
      alert("Por favor introduza o número da palete");
      return;
    }
    if (materialSource === "individual" && !selectedMaterial) {
      alert("Por favor selecione o material");
      return;
    }

    const data: NewPlanData = {
      nome,
      quantidade_chapas: quantidade,
      notas: notas || undefined,
      // Material info
      material_source: materialSource,
      palette_number: materialSource === "palette" ? paletteNumber : undefined,
      material_tipo: materialSource === "individual" ? selectedMaterial : undefined,
      material_espessura: materialSource === "individual" ? selectedCaracteristica : undefined,
      material_acabamento: materialSource === "individual" ? selectedCor : undefined,
      material_id: materialId || undefined,
    };

    if (showCores) {
      data.cores = cores || undefined;
    }

    await onSubmit(data);
  };

  if (materialsLoading) {
    return (
      <Card className="imx-border p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">A carregar materiais...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="imx-border p-4">
      <h4 className="text-sm font-medium mb-4">
        Novo Plano de {tipo === "impressao" ? "Impressão" : "Corte"}
      </h4>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Plano *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              placeholder="A, B, C..."
              maxLength={2}
              className="max-w-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade de Chapas *</Label>
            <Input
              id="quantidade"
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
              className="max-w-[150px]"
            />
          </div>
        </div>

        {/* Material Origin */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Origem do Material *</Label>
            <RadioGroup
              value={materialSource}
              onValueChange={(v) => setMaterialSource(v as "palette" | "individual")}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="palette" id="palette" />
                <Label htmlFor="palette" className="cursor-pointer">Palete</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual" className="cursor-pointer">Placa Individual</Label>
              </div>
            </RadioGroup>
          </div>

          {materialSource === "palette" && (
            <div className="space-y-2">
              <Label htmlFor="paletteNumber">Número da Palete *</Label>
              <Input
                id="paletteNumber"
                value={paletteNumber}
                onChange={(e) => setPaletteNumber(e.target.value)}
                placeholder="Ex: 245"
                className="max-w-[200px]"
              />
            </div>
          )}

          {materialSource === "individual" && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Material *</Label>
                <Combobox
                  value={selectedMaterial}
                  onChange={setSelectedMaterial}
                  options={materialOptions}
                  placeholder="Selecionar material"
                  emptyMessage="Nenhum material encontrado"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Características</Label>
                <Combobox
                  value={selectedCaracteristica}
                  onChange={setSelectedCaracteristica}
                  options={caracteristicaOptions}
                  placeholder="Selecionar"
                  emptyMessage={selectedMaterial ? "Nenhuma característica" : "Selecione material"}
                  disabled={!selectedMaterial}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <Combobox
                  value={selectedCor}
                  onChange={setSelectedCor}
                  options={corOptions}
                  placeholder="Selecionar"
                  emptyMessage={selectedCaracteristica ? "Nenhuma cor" : "Selecione características"}
                  disabled={!selectedCaracteristica}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {showCores && (
          <div className="space-y-2">
            <Label htmlFor="cores">Cores de Impressão</Label>
            <Input
              id="cores"
              value={cores}
              onChange={(e) => setCores(e.target.value)}
              placeholder="Ex: 4/4, 4/0, CMYK"
              className="max-w-[200px]"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notas">Notas</Label>
          <Textarea
            id="notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observações (opcional)"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Plano
          </Button>
        </div>
      </form>
    </Card>
  );
}

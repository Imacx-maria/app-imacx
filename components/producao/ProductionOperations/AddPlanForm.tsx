"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Check, X } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { useMaterialsCascading } from "@/hooks/useMaterialsCascading";
import { createBrowserClient } from "@/utils/supabase";
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
  const supabase = useMemo(() => createBrowserClient(), []);

  // Materials cascading hook
  const {
    materialOptions,
    getCaracteristicaOptions,
    getCorOptions,
    getMaterialId,
    loading: materialsLoading,
  } = useMaterialsCascading();

  // Cores options from cores_impressao table
  const [coresOptions, setCoresOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // Palette options from paletes table
  const [paletteOptions, setPaletteOptions] = useState<
    {
      value: string;
      label: string;
      material?: string;
      caracteristica?: string;
      cor?: string;
    }[]
  >([]);
  const [paletteLoading, setPaletteLoading] = useState(false);

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

  // Fetch palette options with material info
  useEffect(() => {
    const fetchPalettes = async () => {
      setPaletteLoading(true);
      try {
        // Fetch paletes with their ref_cartao to match with materiais
        const { data: paletesData, error: paletesError } = await supabase
          .from("paletes")
          .select("no_palete, ref_cartao")
          .order("no_palete", { ascending: false })
          .limit(100);

        if (paletesError) {
          console.error("Error fetching paletes:", paletesError);
          return;
        }

        if (!paletesData || paletesData.length === 0) {
          setPaletteOptions([]);
          return;
        }

        // Get unique ref_cartao values to fetch material info
        const refCartaos = [
          ...new Set(paletesData.map((p) => p.ref_cartao).filter(Boolean)),
        ];

        // Fetch material info for these ref_cartao values
        let materiaisMap = new Map<
          string,
          { material: string; carateristica: string; cor: string }
        >();

        if (refCartaos.length > 0) {
          const { data: materiaisData, error: materiaisError } = await supabase
            .from("materiais")
            .select("referencia, material, carateristica, cor")
            .in("referencia", refCartaos);

          if (!materiaisError && materiaisData) {
            materiaisData.forEach((m: any) => {
              if (m.referencia) {
                materiaisMap.set(m.referencia, {
                  material: m.material || "",
                  carateristica: m.carateristica || "",
                  cor: m.cor || "",
                });
              }
            });
          }
        }

        // Build palette options with material info
        const options = paletesData.map((p: any) => {
          const matInfo = p.ref_cartao
            ? materiaisMap.get(p.ref_cartao)
            : undefined;
          return {
            value: p.no_palete,
            label: p.no_palete,
            material: matInfo?.material,
            caracteristica: matInfo?.carateristica,
            cor: matInfo?.cor,
          };
        });

        setPaletteOptions(options);
      } catch (err) {
        console.error("Error loading palettes:", err);
      } finally {
        setPaletteLoading(false);
      }
    };

    fetchPalettes();
  }, [supabase]);

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

  // Material origin
  const [materialSource, setMaterialSource] = useState<
    "palette" | "individual"
  >("individual");
  const [paletteNumber, setPaletteNumber] = useState("");

  // Material info from palette (read-only display)
  const [paletteMaterial, setPaletteMaterial] = useState("");
  const [paletteCaracteristica, setPaletteCaracteristica] = useState("");
  const [paletteCor, setPaletteCor] = useState("");

  // Cascading material selection (for individual plates)
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedCaracteristica, setSelectedCaracteristica] = useState("");
  const [selectedCor, setSelectedCor] = useState("");

  const showCores = tipo === "impressao";

  // Handle palette selection - auto-fill material info
  const handlePaletteChange = useCallback(
    (value: string) => {
      setPaletteNumber(value);

      // Find palette info and auto-fill material fields
      const paletteInfo = paletteOptions.find((p) => p.value === value);
      if (paletteInfo) {
        setPaletteMaterial(paletteInfo.material || "");
        setPaletteCaracteristica(paletteInfo.caracteristica || "");
        setPaletteCor(paletteInfo.cor || "");
      } else {
        setPaletteMaterial("");
        setPaletteCaracteristica("");
        setPaletteCor("");
      }
    },
    [paletteOptions],
  );

  // Reset material fields when source changes
  useEffect(() => {
    if (materialSource === "palette") {
      setSelectedMaterial("");
      setSelectedCaracteristica("");
      setSelectedCor("");
    } else {
      setPaletteNumber("");
      setPaletteMaterial("");
      setPaletteCaracteristica("");
      setPaletteCor("");
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
  const caracteristicaOptions = useMemo(
    () => getCaracteristicaOptions(selectedMaterial),
    [getCaracteristicaOptions, selectedMaterial],
  );

  const corOptions = useMemo(
    () => getCorOptions(selectedMaterial, selectedCaracteristica),
    [getCorOptions, selectedMaterial, selectedCaracteristica],
  );

  // Get material ID from selection
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || quantidade <= 0) {
      return;
    }

    // For palette source, use the palette material info
    const finalMaterial =
      materialSource === "palette" ? paletteMaterial : selectedMaterial;
    const finalCaracteristica =
      materialSource === "palette"
        ? paletteCaracteristica
        : selectedCaracteristica;
    const finalCor = materialSource === "palette" ? paletteCor : selectedCor;

    const data: NewPlanData = {
      nome,
      quantidade_chapas: quantidade,
      // Material info
      material_source: materialSource,
      palette_number: materialSource === "palette" ? paletteNumber : undefined,
      material_tipo: finalMaterial || undefined,
      material_espessura: finalCaracteristica || undefined,
      material_acabamento: finalCor || undefined,
      material_id: materialId || undefined,
    };

    if (showCores) {
      data.cores = cores || undefined;
    }

    await onSubmit(data);
  };

  if (materialsLoading) {
    return (
      <div className="imx-border p-3">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">
            A carregar...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="imx-border mb-2">
      <form onSubmit={handleSubmit}>
        {/* Row 1: Plan name + QTD + action buttons */}
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-4">
            {/* Plan name input */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Plano</span>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                placeholder="A"
                className="w-24 h-8 font-medium"
              />
            </div>

            <div className="flex-1" />

            {/* Quantidade */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Qtd:</Label>
              <Input
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
                className="w-20 h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="h-8"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Criar
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="h-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Row 2: Material selection + Cores */}
          <div className="flex items-center gap-4 pl-0">
            {/* Material source radio */}
            <RadioGroup
              value={materialSource}
              onValueChange={(v) =>
                setMaterialSource(v as "palette" | "individual")
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="palette" id="add-pal" />
                <Label htmlFor="add-pal" className="cursor-pointer text-sm">
                  Palete
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="add-ind" />
                <Label htmlFor="add-ind" className="cursor-pointer text-sm">
                  Individual
                </Label>
              </div>
            </RadioGroup>

            {/* Palette selection with combobox */}
            {materialSource === "palette" && (
              <>
                <Combobox
                  value={paletteNumber}
                  onChange={handlePaletteChange}
                  options={paletteOptions}
                  placeholder="N.º Palete"
                  emptyMessage={
                    paletteLoading ? "A carregar..." : "Nenhuma palete"
                  }
                  className="w-28"
                />
                {/* Show material info from palette (read-only) */}
                {paletteNumber && (
                  <>
                    <div className="imx-border px-3 py-1.5 text-sm min-w-[120px] truncate">
                      {paletteMaterial || "-"}
                    </div>
                    <div className="imx-border px-3 py-1.5 text-sm min-w-[100px] truncate">
                      {paletteCaracteristica || "-"}
                    </div>
                    <div className="imx-border px-3 py-1.5 text-sm min-w-[100px] truncate">
                      {paletteCor || "-"}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Individual material selection */}
            {materialSource === "individual" && (
              <>
                <Combobox
                  value={selectedMaterial}
                  onChange={setSelectedMaterial}
                  options={materialOptions}
                  placeholder="Material"
                  emptyMessage="Nenhum"
                  className="w-40"
                />
                <Combobox
                  value={selectedCaracteristica}
                  onChange={setSelectedCaracteristica}
                  options={caracteristicaOptions}
                  placeholder="Caract."
                  emptyMessage="Selec. material"
                  disabled={!selectedMaterial}
                  className="w-32"
                />
                <Combobox
                  value={selectedCor}
                  onChange={setSelectedCor}
                  options={corOptions}
                  placeholder="Cor"
                  emptyMessage="Selec. caract."
                  disabled={!selectedCaracteristica}
                  className="w-52"
                />
              </>
            )}

            {/* Cores (only for impressao) */}
            {showCores && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Cores:</Label>
                <Combobox
                  value={cores}
                  onChange={setCores}
                  options={coresOptions}
                  placeholder="Cores"
                  emptyMessage="Nenhum"
                  className="w-28"
                />
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

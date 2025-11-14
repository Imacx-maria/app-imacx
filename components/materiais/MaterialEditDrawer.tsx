"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import CreatableCombobox from "@/components/custom/CreatableCombobox";
import Combobox from "@/components/ui/Combobox";

interface Material {
  id: string;
  tipo: string | null;
  referencia: string | null;
  ref_fornecedor: string | null;
  ref_cliente: string | null;
  material: string | null;
  carateristica: string | null;
  cor: string | null;
  tipo_canal: string | null;
  size_x: number | null;
  size_y: number | null;
  m2_placa: number | null;
  valor_placa: number | null;
  valor_m2: number | null;
  qt_palete: number | null;
  fornecedor_id: string | null;
  fornecedor: string | null;
  stock_minimo: number | null;
  stock_critico: number | null;
  ORC: boolean | null;
  created_at: string;
  updated_at: string;
}

interface FornecedorOption {
  value: string;
  label: string;
}

interface MaterialEditDrawerProps {
  open: boolean;
  onClose: () => void;
  material: Material | null;
  onSave: () => void;
}

export default function MaterialEditDrawer({
  open,
  onClose,
  material,
  onSave,
}: MaterialEditDrawerProps) {
  const [editData, setEditData] = useState<Material | null>(material);
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [fornecedoresLoading, setFornecedoresLoading] = useState(false);
  const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);
  const [availableCaracteristicas, setAvailableCaracteristicas] = useState<
    string[]
  >([]);
  const [availableCores, setAvailableCores] = useState<string[]>([]);
  const [availableTipos, setAvailableTipos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createBrowserClient();

  // Update editData when material prop changes
  useEffect(() => {
    setEditData(material);
  }, [material]);

  // Fetch fornecedores
  useEffect(() => {
    const fetchFornecedores = async () => {
      setFornecedoresLoading(true);
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome_forn")
        .order("nome_forn", { ascending: true });
      if (!error && data) {
        const mappedFornecedores = data.map((f: any) => ({
          value: String(f.id),
          label: f.nome_forn,
        }));
        setFornecedores(mappedFornecedores);
      }
      setFornecedoresLoading(false);
    };
    fetchFornecedores();
  }, [supabase]);

  // Fetch tipos
  const fetchTipos = async () => {
    const { data } = await supabase
      .from("materiais")
      .select("tipo")
      .not("tipo", "is", null);
    const tipos = Array.from(
      new Set(
        data
          ?.map((item) => item.tipo && item.tipo.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
    setAvailableTipos(tipos);
  };

  // Fetch materials for cascading dropdowns
  const fetchMaterials = async (tipo: string) => {
    const { data } = await supabase
      .from("materiais")
      .select("material, tipo")
      .not("material", "is", null)
      .not("tipo", "is", null);
    const filtered = data?.filter(
      (item) =>
        item.tipo &&
        typeof item.tipo === "string" &&
        item.tipo.trim().toUpperCase() === tipo,
    );
    setAvailableMaterials(
      Array.from(
        new Set(
          filtered
            ?.map((item) => item.material && item.material.trim().toUpperCase())
            .filter(Boolean),
        ),
      ),
    );
  };

  // Fetch características for cascading dropdowns
  const fetchCaracteristicas = async (tipo: string, material: string) => {
    const { data } = await supabase
      .from("materiais")
      .select("carateristica, tipo, material")
      .not("carateristica", "is", null)
      .not("tipo", "is", null)
      .not("material", "is", null);
    const filtered = data?.filter((item) => {
      const itemTipo =
        item.tipo &&
        typeof item.tipo === "string" &&
        item.tipo.trim().toUpperCase();
      const itemMaterial =
        item.material &&
        typeof item.material === "string" &&
        item.material.trim().toUpperCase();
      return itemTipo === tipo && itemMaterial === material;
    });
    setAvailableCaracteristicas(
      Array.from(
        new Set(
          filtered
            ?.map(
              (item) =>
                item.carateristica && item.carateristica.trim().toUpperCase(),
            )
            .filter(Boolean),
        ),
      ),
    );
  };

  // Fetch cores for cascading dropdowns
  const fetchCores = async (
    tipo: string,
    material: string,
    carateristica: string,
  ) => {
    const { data } = await supabase
      .from("materiais")
      .select("cor, tipo, material, carateristica")
      .not("cor", "is", null)
      .not("tipo", "is", null)
      .not("material", "is", null)
      .not("carateristica", "is", null);
    const filtered = data?.filter(
      (item) =>
        item.tipo &&
        typeof item.tipo === "string" &&
        item.tipo.trim().toUpperCase() === tipo &&
        item.material &&
        typeof item.material === "string" &&
        item.material.trim().toUpperCase() === material &&
        item.carateristica &&
        typeof item.carateristica === "string" &&
        item.carateristica.trim().toUpperCase() === carateristica,
    );
    setAvailableCores(
      Array.from(
        new Set(
          filtered
            ?.map((item) => item.cor && item.cor.trim().toUpperCase())
            .filter(Boolean),
        ),
      ),
    );
  };

  // Initialize data when drawer opens
  useEffect(() => {
    if (open) {
      fetchTipos();
      setAvailableMaterials([]);
      setAvailableCaracteristicas([]);
      setAvailableCores([]);
      // If editing, prefetch next combobox levels
      if (material?.tipo) fetchMaterials(material.tipo);
      if (material?.tipo && material?.material)
        fetchCaracteristicas(material.tipo, material.material);
      if (material?.tipo && material?.material && material?.carateristica)
        fetchCores(material.tipo, material.material, material.carateristica);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, material]);

  const handleInputChange = (
    field: keyof Material,

    value: string | number | boolean | null,
  ) => {
    if (!editData) return;

    // Base update
    let next: Material = { ...editData, [field]: value } as Material;

    // Auto-calc 1: when size_x or size_y changes, recalc m2_placa from mm to m²
    if (field === "size_x" || field === "size_y") {
      const sizeX = field === "size_x" ? (value as number | null) : next.size_x;
      const sizeY = field === "size_y" ? (value as number | null) : next.size_y;

      if (sizeX && sizeY && sizeX > 0 && sizeY > 0) {
        // mm -> m => divide by 1000, area in m²
        const m2 = (sizeX / 1000) * (sizeY / 1000);
        next.m2_placa = parseFloat(m2.toFixed(4));

        // If we already have valor_m2, keep VL PLACA in sync
        if (next.valor_m2 && next.valor_m2 > 0) {
          const vlPlaca = next.valor_m2 * next.m2_placa;
          next.valor_placa = parseFloat(vlPlaca.toFixed(4));
        }
      } else {
        // If dimensions are incomplete/invalid, clear m2_placa but don't touch prices
        next.m2_placa = null;
      }
    }

    // Auto-calc 2: when valor_placa is edited, recalc valor_m2 using m2_placa
    if (field === "valor_placa") {
      const vlPlaca = typeof value === "number" ? value : null;
      if (
        vlPlaca !== null &&
        vlPlaca > 0 &&
        next.m2_placa &&
        next.m2_placa > 0
      ) {
        const valorM2 = vlPlaca / next.m2_placa;
        next.valor_m2 = parseFloat(valorM2.toFixed(4));
      }
    }

    // Auto-calc 3: when valor_m2 is edited, recalc valor_placa using m2_placa
    if (field === "valor_m2") {
      const valorM2 = typeof value === "number" ? value : null;
      if (
        valorM2 !== null &&
        valorM2 > 0 &&
        next.m2_placa &&
        next.m2_placa > 0
      ) {
        const vlPlaca = valorM2 * next.m2_placa;
        next.valor_placa = parseFloat(vlPlaca.toFixed(4));
      }
    }

    setEditData(next);
  };

  // Cascading combobox handlers
  const handleTipoChange = async (selectedTipo: string) => {
    const normalizedTipo = selectedTipo.trim().toUpperCase();
    handleInputChange("tipo", normalizedTipo);
    handleInputChange("material", "");
    handleInputChange("carateristica", "");
    handleInputChange("cor", "");
    await fetchMaterials(normalizedTipo);
    setAvailableCaracteristicas([]);
    setAvailableCores([]);
  };

  const handleMaterialChange = async (selectedMaterial: string) => {
    const normalizedMaterial = selectedMaterial.trim().toUpperCase();
    handleInputChange("material", normalizedMaterial);
    handleInputChange("carateristica", "");
    handleInputChange("cor", "");
    await fetchCaracteristicas(
      editData?.tipo?.trim().toUpperCase() ?? "",
      normalizedMaterial,
    );
    setAvailableCores([]);
  };

  const handleCaracteristicaChange = async (selectedCaracteristica: string) => {
    const normalizedCaracteristica = selectedCaracteristica
      .trim()
      .toUpperCase();
    handleInputChange("carateristica", normalizedCaracteristica);
    handleInputChange("cor", "");
    await fetchCores(
      editData?.tipo?.trim().toUpperCase() ?? "",
      editData?.material?.trim().toUpperCase() ?? "",
      normalizedCaracteristica,
    );
  };

  const handleCorChange = (selectedCor: string) => {
    const normalizedCor = selectedCor.trim().toUpperCase();
    handleInputChange("cor", normalizedCor);
  };

  const handleSave = async () => {
    if (!editData) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("materiais")
        .update({
          tipo: editData.tipo,
          material: editData.material,
          carateristica: editData.carateristica,
          cor: editData.cor,
          valor_m2: editData.valor_m2,
          fornecedor: editData.fornecedor,
          fornecedor_id: editData.fornecedor_id,
          size_x: editData.size_x,
          size_y: editData.size_y,
          m2_placa: editData.m2_placa,
          valor_placa: editData.valor_placa,
          qt_palete: editData.qt_palete,
          ORC: editData.ORC,
          stock_minimo: editData.stock_minimo,
          stock_critico: editData.stock_critico,
        })
        .eq("id", editData.id);

      if (!error) {
        onSave();
        onClose();
      }
    } catch (error) {
      console.error("Error updating material:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const materialOptions = availableMaterials.map((material) => ({
    value: material,
    label: material,
  }));

  const caracteristicaOptions = availableCaracteristicas.map(
    (caracteristica) => ({
      value: caracteristica,
      label: caracteristica,
    }),
  );

  const corOptions = availableCores.map((cor) => ({
    value: cor,
    label: cor,
  }));

  const tipoOptions = availableTipos.map((tipo) => ({
    value: tipo,
    label: tipo,
  }));

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "";
    return value.toString();
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="!top-auto !bottom-0 !left-0 !right-0 h-auto max-h-[90vh] !transform-none overflow-y-auto rounded-none !filter-none !backdrop-filter-none will-change-auto">
        <DrawerHeader className="relative py-4">
          <Button
            size="icon"
            variant="outline"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 h-10 w-10 rounded-none"
          >
            X
          </Button>
          <DrawerTitle className="flex items-center gap-2 uppercase text-xl">
            Editar Material
          </DrawerTitle>
          <DrawerDescription>
            Edite todos os campos do material.
          </DrawerDescription>
        </DrawerHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4 p-4 pb-6"
        >
          {/* SECTION 1: FORNECEDOR & ORC */}
          <div
            className="p-3 imx-border "
            style={{ backgroundColor: "var(--section-bg)" }}
          >
            <h3 className="text-sm font-normal uppercase mb-2 pb-1 imx-border-b ">
              Fornecedor
            </h3>
            <div className="flex gap-3 items-end">
              <div className="w-48">
                <Label className="text-xs uppercase">Ref. Fornecedor</Label>
                <Input
                  type="text"
                  maxLength={20}
                  value={editData?.ref_fornecedor ?? ""}
                  onChange={(e) =>
                    handleInputChange("ref_fornecedor", e.target.value)
                  }
                  className="mt-1 h-10"
                  placeholder="REF. FORNECEDOR"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs uppercase">Fornecedor</Label>
                <CreatableCombobox
                  value={
                    editData?.fornecedor_id
                      ? String(editData.fornecedor_id).toUpperCase()
                      : ""
                  }
                  onChange={(val) =>
                    handleInputChange(
                      "fornecedor_id",
                      val ? val.toUpperCase() : "",
                    )
                  }
                  onCreateNew={async (inputValue: string) => {
                    const newOption = {
                      value: inputValue.toUpperCase(),
                      label: inputValue.toUpperCase(),
                    };
                    setFornecedores((prev) => [...prev, newOption]);
                    return newOption;
                  }}
                  options={fornecedores.map((f) => ({
                    ...f,
                    label: f.label.toUpperCase(),
                  }))}
                  loading={fornecedoresLoading}
                  className="mt-1 h-10"
                  placeholder="FORNECEDOR"
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id="orc-checkbox"
                  checked={!!editData?.ORC}
                  onCheckedChange={(val) =>
                    handleInputChange("ORC", val as boolean)
                  }
                />
                <Label
                  htmlFor="orc-checkbox"
                  className="text-xs uppercase cursor-pointer"
                >
                  ORC
                </Label>
              </div>
            </div>
          </div>

          {/* SECTION 2: CARACTERÍSTICAS MATERIAL */}
          <div
            className="p-3 imx-border "
            style={{ backgroundColor: "var(--section-bg)" }}
          >
            <h3 className="text-sm font-normal uppercase mb-2 pb-1 imx-border-b ">
              Características Material
            </h3>

            {/* Single Row: TIPO, MATERIAL, CARACTERÍSTICAS, COR */}
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs uppercase">Tipo</Label>
                <Combobox
                  value={editData?.tipo?.toUpperCase() ?? ""}
                  onChange={handleTipoChange}
                  options={tipoOptions}
                  placeholder="TIPO"
                  className="mt-1 h-10 w-full"
                  maxWidth="100%"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs uppercase">Material</Label>
                <CreatableCombobox
                  value={editData?.material?.toUpperCase() ?? ""}
                  onChange={handleMaterialChange}
                  onCreateNew={async (inputValue: string) => {
                    const newOption = {
                      value: inputValue.toUpperCase(),
                      label: inputValue.toUpperCase(),
                    };
                    setAvailableMaterials((prev) => [
                      ...prev,
                      inputValue.toUpperCase(),
                    ]);
                    return newOption;
                  }}
                  options={materialOptions}
                  disabled={!editData?.tipo}
                  className="mt-1 h-10"
                  placeholder="MATERIAL"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs uppercase">Características</Label>
                <CreatableCombobox
                  value={editData?.carateristica?.toUpperCase() ?? ""}
                  onChange={handleCaracteristicaChange}
                  onCreateNew={async (inputValue: string) => {
                    const newOption = {
                      value: inputValue.toUpperCase(),
                      label: inputValue.toUpperCase(),
                    };
                    setAvailableCaracteristicas((prev) => [
                      ...prev,
                      inputValue.toUpperCase(),
                    ]);
                    return newOption;
                  }}
                  options={caracteristicaOptions}
                  disabled={!editData?.material}
                  className="mt-1 h-10"
                  placeholder="CARACTERÍSTICAS"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs uppercase">Cor</Label>
                <CreatableCombobox
                  value={editData?.cor?.toUpperCase() ?? ""}
                  onChange={handleCorChange}
                  onCreateNew={async (inputValue: string) => {
                    const newOption = {
                      value: inputValue.toUpperCase(),
                      label: inputValue.toUpperCase(),
                    };
                    setAvailableCores((prev) => [
                      ...prev,
                      inputValue.toUpperCase(),
                    ]);
                    return newOption;
                  }}
                  options={corOptions}
                  disabled={!editData?.carateristica}
                  className="mt-1 h-10"
                  placeholder="COR"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3 & 4: VALOR MATERIAL and LOGÍSTICA - SIDE BY SIDE */}
          <div className="grid grid-cols-2 gap-4">
            {/* VALOR MATERIAL */}
            <div
              className="p-3 imx-border "
              style={{ backgroundColor: "var(--section-bg)" }}
            >
              <h3 className="text-sm font-normal uppercase mb-2 pb-1 imx-border-b ">
                Valor Material
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase">X (mm)</Label>

                  <Input
                    type="number"
                    step="0.01"
                    maxLength={6}
                    value={editData?.size_x?.toString() ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "size_x",

                        e.target.value === ""
                          ? null
                          : parseFloat(e.target.value),
                      )
                    }
                    className="mt-1 h-10 w-full text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase">Y (mm)</Label>

                  <Input
                    type="number"
                    step="0.01"
                    maxLength={6}
                    value={editData?.size_y?.toString() ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "size_y",

                        e.target.value === ""
                          ? null
                          : parseFloat(e.target.value),
                      )
                    }
                    className="mt-1 h-10 w-full text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase">M2 PLACA/ROLO</Label>

                  <Input
                    type="number"
                    step="0.01"
                    maxLength={6}
                    value={formatCurrency(editData?.m2_placa)}
                    onChange={(e) =>
                      handleInputChange(
                        "m2_placa",

                        e.target.value === ""
                          ? null
                          : parseFloat(e.target.value),
                      )
                    }
                    className="mt-1 h-10 w-full text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase">Valor/m²</Label>

                  <Input
                    type="number"
                    step="0.01"
                    maxLength={6}
                    value={formatCurrency(editData?.valor_m2)}
                    onChange={(e) =>
                      handleInputChange(
                        "valor_m2",

                        e.target.value === ""
                          ? null
                          : parseFloat(e.target.value),
                      )
                    }
                    className="mt-1 h-10 w-full text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs uppercase">VL PLACA / ROLO</Label>

                  <Input
                    type="number"
                    step="0.01"
                    maxLength={6}
                    value={formatCurrency(editData?.valor_placa)}
                    onChange={(e) =>
                      handleInputChange(
                        "valor_placa",

                        e.target.value === ""
                          ? null
                          : parseFloat(e.target.value),
                      )
                    }
                    className="mt-1 h-10 w-full text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>

            {/* LOGÍSTICA */}
            <div
              className="p-3 imx-border "
              style={{ backgroundColor: "var(--section-bg)" }}
            >
              <h3 className="text-sm font-normal uppercase mb-2 pb-1 imx-border-b ">
                Logística
              </h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs uppercase">QT PAL</Label>
                  <Input
                    type="number"
                    maxLength={6}
                    value={editData?.qt_palete?.toString() ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "qt_palete",
                        parseInt(e.target.value) || null,
                      )
                    }
                    className="mt-1 h-10 w-full text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase">Stock Mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    maxLength={6}
                    value={formatCurrency(editData?.stock_minimo)}
                    onChange={(e) =>
                      handleInputChange(
                        "stock_minimo",
                        parseFloat(e.target.value) || null,
                      )
                    }
                    className="mt-1 h-10 w-full text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase">Stock Crítico</Label>
                  <Input
                    type="number"
                    step="0.01"
                    maxLength={6}
                    value={formatCurrency(editData?.stock_critico)}
                    onChange={(e) =>
                      handleInputChange(
                        "stock_critico",
                        parseFloat(e.target.value) || null,
                      )
                    }
                    className="mt-1 h-10 w-full text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BUTTONS */}
          <div className="flex gap-2 justify-end pt-2">
            <DrawerClose asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-none"
              >
                Cancelar
              </Button>
            </DrawerClose>
            <Button
              type="submit"
              className="h-10 rounded-none"
              disabled={submitting}
            >
              {submitting ? (
                <span className="mr-2 h-4 w-4 animate-spin">⟳</span>
              ) : null}
              Atualizar
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

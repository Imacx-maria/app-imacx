'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer'
import CreatableCombobox from '@/components/custom/CreatableCombobox'
import Combobox from '@/components/ui/Combobox'

interface Material {
  id: string
  tipo: string | null
  referencia: string | null
  ref_fornecedor: string | null
  ref_cliente: string | null
  material: string | null
  carateristica: string | null
  cor: string | null
  tipo_canal: string | null
  dimensoes: string | null
  valor_m2_custo: number | null
  valor_placa: number | null
  valor_m2: number | null
  qt_palete: number | null
  fornecedor_id: string | null
  fornecedor: string | null
  stock_minimo: number | null
  stock_critico: number | null
  ORC: boolean | null
  created_at: string
  updated_at: string
}

interface FornecedorOption {
  value: string
  label: string
}

interface MaterialEditDrawerProps {
  open: boolean
  onClose: () => void
  material: Material | null
  onSave: () => void
}

export default function MaterialEditDrawer({
  open,
  onClose,
  material,
  onSave,
}: MaterialEditDrawerProps) {
  const [editData, setEditData] = useState<Material | null>(material)
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([])
  const [fornecedoresLoading, setFornecedoresLoading] = useState(false)
  const [availableMaterials, setAvailableMaterials] = useState<string[]>([])
  const [availableCaracteristicas, setAvailableCaracteristicas] = useState<string[]>([])
  const [availableCores, setAvailableCores] = useState<string[]>([])
  const [availableTipos, setAvailableTipos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const supabase = createBrowserClient()

  // Update editData when material prop changes
  useEffect(() => {
    setEditData(material)
  }, [material])

  // Fetch fornecedores
  useEffect(() => {
    const fetchFornecedores = async () => {
      setFornecedoresLoading(true)
      const { data, error } = await supabase
        .from('fornecedores')
        .select('id, nome_forn')
        .order('nome_forn', { ascending: true })
      if (!error && data) {
        const mappedFornecedores = data.map((f: any) => ({
          value: String(f.id),
          label: f.nome_forn,
        }))
        setFornecedores(mappedFornecedores)
      }
      setFornecedoresLoading(false)
    }
    fetchFornecedores()
  }, [supabase])

  // Fetch tipos
  const fetchTipos = async () => {
    const { data } = await supabase
      .from('materiais')
      .select('tipo')
      .not('tipo', 'is', null)
    const tipos = Array.from(
      new Set(
        data
          ?.map((item) => item.tipo && item.tipo.trim().toUpperCase())
          .filter(Boolean),
      ),
    )
    setAvailableTipos(tipos)
  }

  // Fetch materials for cascading dropdowns
  const fetchMaterials = async (tipo: string) => {
    const { data } = await supabase
      .from('materiais')
      .select('material, tipo')
      .not('material', 'is', null)
      .not('tipo', 'is', null)
    const filtered = data?.filter(
      (item) =>
        item.tipo &&
        typeof item.tipo === 'string' &&
        item.tipo.trim().toUpperCase() === tipo,
    )
    setAvailableMaterials(
      Array.from(
        new Set(
          filtered
            ?.map(
              (item) =>
                item.material && item.material.trim().toUpperCase(),
            )
            .filter(Boolean),
        ),
      ),
    )
  }

  // Fetch características for cascading dropdowns
  const fetchCaracteristicas = async (tipo: string, material: string) => {
    const { data } = await supabase
      .from('materiais')
      .select('carateristica, tipo, material')
      .not('carateristica', 'is', null)
      .not('tipo', 'is', null)
      .not('material', 'is', null)
    const filtered = data?.filter((item) => {
      const itemTipo =
        item.tipo &&
        typeof item.tipo === 'string' &&
        item.tipo.trim().toUpperCase()
      const itemMaterial =
        item.material &&
        typeof item.material === 'string' &&
        item.material.trim().toUpperCase()
      return itemTipo === tipo && itemMaterial === material
    })
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
    )
  }

  // Fetch cores for cascading dropdowns
  const fetchCores = async (
    tipo: string,
    material: string,
    carateristica: string,
  ) => {
    const { data } = await supabase
      .from('materiais')
      .select('cor, tipo, material, carateristica')
      .not('cor', 'is', null)
      .not('tipo', 'is', null)
      .not('material', 'is', null)
      .not('carateristica', 'is', null)
    const filtered = data?.filter(
      (item) =>
        item.tipo &&
        typeof item.tipo === 'string' &&
        item.tipo.trim().toUpperCase() === tipo &&
        item.material &&
        typeof item.material === 'string' &&
        item.material.trim().toUpperCase() === material &&
        item.carateristica &&
        typeof item.carateristica === 'string' &&
        item.carateristica.trim().toUpperCase() === carateristica,
    )
    setAvailableCores(
      Array.from(
        new Set(
          filtered
            ?.map((item) => item.cor && item.cor.trim().toUpperCase())
            .filter(Boolean),
        ),
      ),
    )
  }

  // Initialize data when drawer opens
  useEffect(() => {
    if (open) {
      fetchTipos()
      setAvailableMaterials([])
      setAvailableCaracteristicas([])
      setAvailableCores([])
      // If editing, prefetch next combobox levels
      if (material?.tipo) fetchMaterials(material.tipo)
      if (material?.tipo && material?.material)
        fetchCaracteristicas(material.tipo, material.material)
      if (
        material?.tipo &&
        material?.material &&
        material?.carateristica
      )
        fetchCores(material.tipo, material.material, material.carateristica)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, material])

  const handleInputChange = (
    field: keyof Material,
    value: string | number | boolean | null,
  ) => {
    if (!editData) return
    setEditData((prev) => (prev ? { ...prev, [field]: value } : null))
  }

  // Cascading combobox handlers
  const handleTipoChange = async (selectedTipo: string) => {
    const normalizedTipo = selectedTipo.trim().toUpperCase()
    handleInputChange('tipo', normalizedTipo)
    handleInputChange('material', '')
    handleInputChange('carateristica', '')
    handleInputChange('cor', '')
    await fetchMaterials(normalizedTipo)
    setAvailableCaracteristicas([])
    setAvailableCores([])
  }

  const handleMaterialChange = async (selectedMaterial: string) => {
    const normalizedMaterial = selectedMaterial.trim().toUpperCase()
    handleInputChange('material', normalizedMaterial)
    handleInputChange('carateristica', '')
    handleInputChange('cor', '')
    await fetchCaracteristicas(
      editData?.tipo?.trim().toUpperCase() ?? '',
      normalizedMaterial,
    )
    setAvailableCores([])
  }

  const handleCaracteristicaChange = async (selectedCaracteristica: string) => {
    const normalizedCaracteristica = selectedCaracteristica.trim().toUpperCase()
    handleInputChange('carateristica', normalizedCaracteristica)
    handleInputChange('cor', '')
    await fetchCores(
      editData?.tipo?.trim().toUpperCase() ?? '',
      editData?.material?.trim().toUpperCase() ?? '',
      normalizedCaracteristica,
    )
  }

  const handleCorChange = (selectedCor: string) => {
    const normalizedCor = selectedCor.trim().toUpperCase()
    handleInputChange('cor', normalizedCor)
  }

  const handleSave = async () => {
    if (!editData) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('materiais')
        .update({
          tipo: editData.tipo,
          material: editData.material,
          carateristica: editData.carateristica,
          cor: editData.cor,
          valor_m2: editData.valor_m2,
          referencia: editData.referencia,
          ref_cliente: editData.ref_cliente,
          ref_fornecedor: editData.ref_fornecedor,
          fornecedor: editData.fornecedor,
          fornecedor_id: editData.fornecedor_id,
          tipo_canal: editData.tipo_canal,
          dimensoes: editData.dimensoes,
          valor_m2_custo: editData.valor_m2_custo,
          valor_placa: editData.valor_placa,
          qt_palete: editData.qt_palete,
          ORC: editData.ORC,
          stock_minimo: editData.stock_minimo,
          stock_critico: editData.stock_critico,
        })
        .eq('id', editData.id)

      if (!error) {
        onSave()
        onClose()
      }
    } catch (error) {
      console.error('Error updating material:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const materialOptions = availableMaterials.map((material) => ({
    value: material,
    label: material,
  }))

  const caracteristicaOptions = availableCaracteristicas.map((caracteristica) => ({
    value: caracteristica,
    label: caracteristica,
  }))

  const corOptions = availableCores.map((cor) => ({
    value: cor,
    label: cor,
  }))

  const tipoOptions = availableTipos.map((tipo) => ({
    value: tipo,
    label: tipo,
  }))

  const formatCurrency = (value: number | null) => {
    if (value === null) return ''
    return value.toString()
  }

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="!top-0 h-[98vh] max-h-[98vh] min-h-[98vh] !transform-none overflow-y-auto rounded-none !filter-none !backdrop-filter-none will-change-auto">
        <DrawerHeader className="relative">
          <Button
            size="icon"
            variant="outline"
            onClick={onClose}
            className="absolute top-6 right-6 z-10 h-10 w-10 rounded-none"
          >
            X
          </Button>
          <DrawerTitle className="flex items-center gap-2 uppercase">
            Editar Material
          </DrawerTitle>
          <DrawerDescription>
            Edite todos os campos do material.
          </DrawerDescription>
        </DrawerHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="space-y-6 p-6"
        >
          <div className="grid grid-cols-1 gap-6">
            {/* Fornecedor and Tipo - side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Fornecedor
                </Label>
                <CreatableCombobox
                  value={
                    editData?.fornecedor_id
                      ? String(editData.fornecedor_id).toUpperCase()
                      : ''
                  }
                  onChange={(val) =>
                    handleInputChange(
                      'fornecedor_id',
                      val ? val.toUpperCase() : '',
                    )
                  }
                  onCreateNew={async (inputValue: string) => {
                    const newOption = {
                      value: inputValue.toUpperCase(),
                      label: inputValue.toUpperCase(),
                    }
                    setFornecedores((prev) => [...prev, newOption])
                    return newOption
                  }}
                  options={fornecedores.map((f) => ({
                    ...f,
                    label: f.label.toUpperCase(),
                  }))}
                  loading={fornecedoresLoading}
                  className="mt-2 w-full"
                  placeholder="FORNECEDOR"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Tipo
                </Label>
                <Combobox
                  value={editData?.tipo?.toUpperCase() ?? ''}
                  onChange={handleTipoChange}
                  options={tipoOptions}
                  placeholder="SELECIONE O TIPO"
                  className="mt-2"
                />
              </div>
            </div>

            {/* Material Info - Input Fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Material
                </Label>
                <CreatableCombobox
                  value={editData?.material?.toUpperCase() ?? ''}
                  onChange={handleMaterialChange}
                  onCreateNew={async (inputValue: string) => {
                    const newOption = {
                      value: inputValue.toUpperCase(),
                      label: inputValue.toUpperCase(),
                    }
                    setAvailableMaterials((prev) => [
                      ...prev,
                      inputValue.toUpperCase(),
                    ])
                    return newOption
                  }}
                  options={materialOptions}
                  disabled={!editData?.tipo}
                  className="mt-2"
                  placeholder="SELECIONE OU CRIE MATERIAL"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Características
                </Label>
                <CreatableCombobox
                  value={editData?.carateristica?.toUpperCase() ?? ''}
                  onChange={handleCaracteristicaChange}
                  onCreateNew={async (inputValue: string) => {
                    const newOption = {
                      value: inputValue.toUpperCase(),
                      label: inputValue.toUpperCase(),
                    }
                    setAvailableCaracteristicas((prev) => [
                      ...prev,
                      inputValue.toUpperCase(),
                    ])
                    return newOption
                  }}
                  options={caracteristicaOptions}
                  disabled={!editData?.material}
                  className="mt-2"
                  placeholder="SELECIONE OU CRIE CARACTERÍSTICA"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Cor
                </Label>
                <CreatableCombobox
                  value={editData?.cor?.toUpperCase() ?? ''}
                  onChange={handleCorChange}
                  onCreateNew={async (inputValue: string) => {
                    const newOption = {
                      value: inputValue.toUpperCase(),
                      label: inputValue.toUpperCase(),
                    }
                    setAvailableCores((prev) => [
                      ...prev,
                      inputValue.toUpperCase(),
                    ])
                    return newOption
                  }}
                  options={corOptions}
                  disabled={!editData?.carateristica}
                  className="mt-2"
                  placeholder="SELECIONE OU CRIE COR"
                />
              </div>
            </div>

            {/* References - 3 columns */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Referência
                </Label>
                <Input
                  value={editData?.referencia ?? ''}
                  onChange={(e) =>
                    handleInputChange('referencia', e.target.value)
                  }
                  className="mt-2 h-10 rounded-none"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Ref. Cliente
                </Label>
                <Input
                  value={editData?.ref_cliente ?? ''}
                  onChange={(e) =>
                    handleInputChange('ref_cliente', e.target.value)
                  }
                  className="mt-2 h-10 rounded-none"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Ref. Fornecedor
                </Label>
                <Input
                  value={editData?.ref_fornecedor ?? ''}
                  onChange={(e) =>
                    handleInputChange('ref_fornecedor', e.target.value)
                  }
                  className="mt-2 h-10 rounded-none"
                />
              </div>
            </div>

            {/* Channel and Dimensions - 2 columns */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Tipo Canal
                </Label>
                <Input
                  value={editData?.tipo_canal ?? ''}
                  onChange={(e) =>
                    handleInputChange('tipo_canal', e.target.value)
                  }
                  className="mt-2 h-10 rounded-none"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Dimensões
                </Label>
                <Input
                  value={editData?.dimensoes ?? ''}
                  onChange={(e) =>
                    handleInputChange('dimensoes', e.target.value)
                  }
                  className="mt-2 h-10 rounded-none"
                />
              </div>
            </div>

            {/* Pricing - 3 columns */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-semibold uppercase">
                  VL/M² NET
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formatCurrency(editData?.valor_m2_custo)}
                  onChange={(e) =>
                    handleInputChange(
                      'valor_m2_custo',
                      parseFloat(e.target.value) || null,
                    )
                  }
                  className="mt-2 h-10 rounded-none text-right"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  VL PLACA
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formatCurrency(editData?.valor_placa)}
                  onChange={(e) =>
                    handleInputChange(
                      'valor_placa',
                      parseFloat(e.target.value) || null,
                    )
                  }
                  className="mt-2 h-10 rounded-none text-right"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Valor/m²
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formatCurrency(editData?.valor_m2)}
                  onChange={(e) =>
                    handleInputChange(
                      'valor_m2',
                      parseFloat(e.target.value) || null,
                    )
                  }
                  className="mt-2 h-10 rounded-none text-right"
                />
              </div>
            </div>

            {/* Quantity, Stock levels and ORC - 4 columns */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-semibold uppercase">
                  QT PAL
                </Label>
                <Input
                  type="number"
                  value={editData?.qt_palete?.toString() ?? ''}
                  onChange={(e) =>
                    handleInputChange(
                      'qt_palete',
                      parseInt(e.target.value) || null,
                    )
                  }
                  className="mt-2 h-10 rounded-none text-right"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Stock Mínimo
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formatCurrency(editData?.stock_minimo)}
                  onChange={(e) =>
                    handleInputChange(
                      'stock_minimo',
                      parseFloat(e.target.value) || null,
                    )
                  }
                  className="mt-2 h-10 rounded-none text-right"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  Stock Crítico
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formatCurrency(editData?.stock_critico)}
                  onChange={(e) =>
                    handleInputChange(
                      'stock_critico',
                      parseFloat(e.target.value) || null,
                    )
                  }
                  className="mt-2 h-10 rounded-none text-right"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold uppercase">
                  ORC
                </Label>
                <div className="mt-2 flex items-center">
                  <Checkbox
                    checked={!!editData?.ORC}
                    onCheckedChange={(val) =>
                      handleInputChange('ORC', val as boolean)
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {editData?.ORC ? 'Sim' : 'Não'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <Button type="submit" className="h-10 flex-1 rounded-none" disabled={submitting}>
              {submitting ? (
                <span className="mr-2 h-4 w-4 animate-spin">⟳</span>
              ) : null}
              Atualizar
            </Button>
            <DrawerClose asChild>
              <Button type="button" variant="outline" className="h-10 rounded-none">
                Cancelar
              </Button>
            </DrawerClose>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

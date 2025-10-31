'use client'

/**
 * Corte Loose Plates Table Component
 * For standalone cutting operations (not linked to print jobs)
 */

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import Combobox from '@/components/ui/Combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DatePicker from '@/components/custom/DatePicker'
import SimpleNotasPopover from '@/components/custom/SimpleNotasPopover'
import { useTableData } from '@/hooks/useTableData'
import { useMaterialsCascading } from '@/hooks/useMaterialsCascading'
import {
  logOperationCreation,
  logFieldUpdate,
  logOperationDeletion,
} from '@/utils/auditLogging'
import { Plus, Trash2, Edit3, Check, XSquare } from 'lucide-react'

interface ProductionOperation {
  id: string
  data_operacao: string
  operador_id?: string | null
  folha_obra_id: string
  item_id: string
  no_interno: string
  Tipo_Op?: string
  maquina?: string | null
  material_id?: string | null
  stock_consumido_id?: string | null
  num_placas_print?: number | null
  num_placas_corte?: number | null
  QT_print?: number | null
  observacoes?: string | null
  notas?: string | null
  notas_imp?: string | null
  status?: string
  concluido?: boolean
  data_conclusao?: string | null
  created_at?: string
  updated_at?: string
  N_Pal?: string | null
  tem_corte?: boolean | null
  source_impressao_id?: string | null
}

interface ProductionItem {
  id: string
  folha_obra_id: string
  descricao: string
  codigo?: string | null
  quantidade?: number | null
  folhas_obras?: {
    numero_fo?: string
    nome_campanha?: string
  } | null
}

interface CorteLoosePlatesTableProps {
  operations: ProductionOperation[]
  itemId: string
  folhaObraId: string
  item: ProductionItem
  supabase: any
  onRefresh: () => void
  onMainRefresh: () => void
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
  const { operators, machines } = useTableData()
  const { materialOptions, getCaracteristicaOptions, getCorOptions, getMaterialId, materialsData } = useMaterialsCascading()

  const [materialSelections, setMaterialSelections] = useState<{
    [operationId: string]: { material?: string; carateristica?: string; cor?: string }
  }>({})
  const [paletteSelections, setPaletteSelections] = useState<{
    [operationId: string]: string
  }>({})
  const [paletes, setPaletes] = useState<any[]>([])

  // Edit mode state
  const [editingRowIds, setEditingRowIds] = useState<Set<string>>(new Set())
  const [editDrafts, setEditDrafts] = useState<Record<string, Record<string, any>>>({})

  // Fetch paletes
  useEffect(() => {
    const fetchPaletes = async () => {
      try {
        const { data, error } = await supabase
          .from('paletes')
          .select('*')
          .order('no_palete', { ascending: false })

        if (!error && data) {
          setPaletes(data)
        }
      } catch (err) {
        console.error('Error fetching paletes:', err)
      }
    }

    fetchPaletes()
  }, [supabase])

  // Check if material is from palette
  const isMaterialFromPalette = (operationId: string) => {
    return !!paletteSelections[operationId]
  }

  // Initialize material and palette selections from existing operations
  useEffect(() => {
    const initSelections = () => {
      const newMaterialSelections: { [operationId: string]: { material?: string; carateristica?: string; cor?: string } } = {}
      const newPaletteSelections: { [operationId: string]: string } = {}

      operations.forEach((op) => {
        // Initialize palette selections from N_Pal field
        if (op.N_Pal && paletes.length > 0) {
          const palette = paletes.find((p) => p.no_palete === op.N_Pal)

          if (palette) {
            newPaletteSelections[op.id] = palette.id

            // If palette has ref_cartao, find and populate material
            if (palette.ref_cartao && materialsData.length > 0) {
              const materialRecord = materialsData.find((m) => m.referencia === palette.ref_cartao)

              if (materialRecord) {
                newMaterialSelections[op.id] = {
                  material: materialRecord.material?.toUpperCase() || undefined,
                  carateristica: materialRecord.carateristica?.toUpperCase() || undefined,
                  cor: materialRecord.cor?.toUpperCase() || undefined,
                }
              }
            }
          }
        }

        // Initialize material selections from material_id (if no palette)
        if (!newMaterialSelections[op.id] && op.material_id && materialsData.length > 0) {
          const materialRecord = materialsData.find((m) => m.id === op.material_id)
          if (materialRecord) {
            newMaterialSelections[op.id] = {
              material: materialRecord.material?.toUpperCase() || undefined,
              carateristica: materialRecord.carateristica?.toUpperCase() || undefined,
              cor: materialRecord.cor?.toUpperCase() || undefined,
            }
          }
        }
      })

      setMaterialSelections(newMaterialSelections)
      setPaletteSelections(newPaletteSelections)
    }

    initSelections()
  }, [operations, materialsData, paletes])

  // Edit mode functions
  const startEdit = (opId: string) => {
    const op = operations.find((o) => o.id === opId)
    if (!op) return

    setEditingRowIds((prev) => new Set(prev).add(opId))
    setEditDrafts((prev) => ({
      ...prev,
      [opId]: {
        data_operacao: op.data_operacao || '',
        operador_id: op.operador_id || '',
        maquina: op.maquina || '',
        num_placas_corte: op.num_placas_corte ?? '',
        observacoes: op.observacoes || '',
        material_id: op.material_id || null,
        N_Pal: op.N_Pal || '',
      },
    }))
  }

  const cancelEdit = (opId: string) => {
    setEditingRowIds((prev) => {
      const newSet = new Set(prev)
      newSet.delete(opId)
      return newSet
    })
    setEditDrafts((prev) => {
      const newDrafts = { ...prev }
      delete newDrafts[opId]
      return newDrafts
    })
  }

  const acceptEdit = async (opId: string) => {
    const draft = editDrafts[opId]
    if (!draft) return

    try {
      const operation = operations.find(op => op.id === opId)
      if (!operation) return

      // Normalize fields
      const normalizedDraft = { ...draft }

      // Normalize numeric fields
      if (normalizedDraft.num_placas_corte !== undefined) {
        const n = parseInt(String(normalizedDraft.num_placas_corte))
        normalizedDraft.num_placas_corte = Number.isFinite(n) ? n : 0
      }

      // Convert empty strings to null for UUID fields
      const uuidFields = ['operador_id', 'material_id', 'maquina']
      uuidFields.forEach(field => {
        if (normalizedDraft[field] === '') {
          normalizedDraft[field] = null
        }
      })

      // VALIDATION: Check required fields before saving
      const finalOperador = normalizedDraft.operador_id ?? operation.operador_id
      const finalMaquina = normalizedDraft.maquina ?? operation.maquina
      const finalPalete = normalizedDraft.N_Pal ?? operation.N_Pal
      const finalMaterialId = normalizedDraft.material_id ?? operation.material_id

      if (!finalOperador) {
        alert('Por favor, selecione o Operador antes de guardar.')
        return
      }

      if (!finalMaquina) {
        alert('Por favor, selecione a Máquina antes de guardar.')
        return
      }

      // Must have EITHER palette OR material
      if (!finalPalete && !finalMaterialId) {
        alert('Por favor, selecione um Palete OU preencha Material/Características/Cor antes de guardar.')
        return
      }

      // Update database
      const { error } = await supabase
        .from('producao_operacoes')
        .update(normalizedDraft)
        .eq('id', opId)

      if (error) throw error

      // Log audit for changed fields
      for (const [field, newValue] of Object.entries(normalizedDraft)) {
        const oldValue = (operation as any)[field]
        if (oldValue !== newValue) {
          await logFieldUpdate(supabase, opId, field, oldValue, newValue)
        }
      }

      cancelEdit(opId)
      onRefresh()
      onMainRefresh()
    } catch (err) {
      console.error('Error accepting edit:', err)
      alert('Erro ao guardar alterações')
    }
  }

  const changeField = (opId: string, field: string, value: any) => {
    setEditDrafts((prev) => ({
      ...prev,
      [opId]: {
        ...(prev[opId] || {}),
        [field]: value,
      },
    }))
  }

  const handleFieldChange = async (operationId: string, field: string, value: any) => {
    try {
      // Normalize numeric fields
      let normalizedValue = value
      if (field === 'num_placas_corte') {
        const n = parseInt(String(value))
        normalizedValue = Number.isFinite(n) ? n : 0
      }

      const operation = operations.find(op => op.id === operationId)
      const oldValue = operation ? (operation as any)[field] : null

      const { error } = await supabase
        .from('producao_operacoes')
        .update({ [field]: normalizedValue })
        .eq('id', operationId)

      if (error) throw error

      await logFieldUpdate(supabase, operationId, field, oldValue, normalizedValue)
      onRefresh()
    } catch (err) {
      console.error('Error updating operation:', err)
      alert('Erro ao atualizar operação')
    }
  }

  const handleAddOperation = async () => {
    try {
      const now = new Date()
      const dateStr = format(now, 'yyyyMMdd')
      const timeStr = format(now, 'HHmmss')
      const foShort = item.folhas_obras?.numero_fo?.substring(0, 6) || 'FO'
      const no_interno = `${foShort}-${dateStr}-CRT-${timeStr}`

      const operationData = {
        item_id: itemId,
        folha_obra_id: folhaObraId,
        Tipo_Op: 'Corte',
        data_operacao: new Date().toISOString().split('T')[0],
        no_interno,
        num_placas_corte: 0,
        source_impressao_id: null, // Explicitly null for loose plates
        concluido: false,
      }

      const { data: savedOperation, error } = await supabase
        .from('producao_operacoes')
        .insert([operationData])
        .select()
        .single()

      if (error) throw error

      await logOperationCreation(supabase, savedOperation.id, operationData)
      onRefresh()
      onMainRefresh()
    } catch (err) {
      console.error('Error adding operation:', err)
      alert('Erro ao adicionar operação')
    }
  }

  const handleDeleteOperation = async (operationId: string) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta operação?')) return

    try {
      const operation = operations.find(op => op.id === operationId)

      const { error } = await supabase.from('producao_operacoes').delete().eq('id', operationId)

      if (error) throw error

      if (operation) {
        await logOperationDeletion(supabase, operationId, operation)
      }

      onRefresh()
      onMainRefresh()
    } catch (err) {
      console.error('Error deleting operation:', err)
      alert('Erro ao eliminar operação')
    }
  }

  const handlePaletteSelection = async (operationId: string, paletteId: string) => {
    if (!paletteId) {
      setPaletteSelections((prev) => ({
        ...prev,
        [operationId]: '',
      }))

      setMaterialSelections((prev) => ({
        ...prev,
        [operationId]: {
          material: undefined,
          carateristica: undefined,
          cor: undefined,
        },
      }))

      await handleFieldChange(operationId, 'N_Pal', '')
      await handleFieldChange(operationId, 'material_id', null)
      return
    }

    const selectedPalette = paletes.find((p) => p.id === paletteId)

    if (!selectedPalette) return

    setPaletteSelections((prev) => ({
      ...prev,
      [operationId]: paletteId,
    }))

    await handleFieldChange(operationId, 'N_Pal', selectedPalette.no_palete)

    if (selectedPalette.ref_cartao) {
      const matchingMaterial = materialsData.find(
        (m) => m.referencia === selectedPalette.ref_cartao
      )

      if (matchingMaterial) {
        await handleFieldChange(operationId, 'material_id', matchingMaterial.id)

        setMaterialSelections((prev) => ({
          ...prev,
          [operationId]: {
            material: matchingMaterial.material?.toUpperCase() || undefined,
            carateristica: matchingMaterial.carateristica?.toUpperCase() || undefined,
            cor: matchingMaterial.cor?.toUpperCase() || undefined,
          },
        }))
      }
    }
  }

  const handleMaterialChange = (operationId: string, field: 'material' | 'carateristica' | 'cor', value: string) => {
    const isEditing = editingRowIds.has(operationId)

    setMaterialSelections((prev) => {
      const current = prev[operationId] || {}

      if (field === 'material') {
        const newSelection = { material: value, carateristica: undefined, cor: undefined }
        const materialId = getMaterialId(value)

        if (isEditing) {
          changeField(operationId, 'material_id', materialId || null)
        } else {
          handleFieldChange(operationId, 'material_id', materialId || null)
        }

        return { ...prev, [operationId]: newSelection }
      }

      if (field === 'carateristica') {
        const newSelection = { ...current, carateristica: value, cor: undefined }
        const materialId = getMaterialId(current.material, value)

        if (isEditing) {
          changeField(operationId, 'material_id', materialId || null)
        } else {
          handleFieldChange(operationId, 'material_id', materialId || null)
        }

        return { ...prev, [operationId]: newSelection }
      }

      if (field === 'cor') {
        const newSelection = { ...current, cor: value }
        const materialId = getMaterialId(current.material, current.carateristica, value)

        if (isEditing) {
          changeField(operationId, 'material_id', materialId || null)
        } else {
          handleFieldChange(operationId, 'material_id', materialId || null)
        }

        return { ...prev, [operationId]: newSelection }
      }

      return prev
    })
  }

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
              <TableHead className="w-[120px]">Data</TableHead>
              <TableHead className="w-[120px]">Operador</TableHead>
              <TableHead className="w-[120px]">Máquina</TableHead>
              <TableHead className="w-[140px]">Palete</TableHead>
              <TableHead className="w-[120px]">Material</TableHead>
              <TableHead className="w-[120px]">Características</TableHead>
              <TableHead className="w-[120px]">Cor</TableHead>
              <TableHead className="w-[80px]">Corte</TableHead>
              <TableHead className="w-[50px]">Notas</TableHead>
              <TableHead className="w-[60px]">C</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((op) => {
              const isEditing = editingRowIds.has(op.id)

              return (
                <TableRow key={op.id} className={isEditing ? 'bg-accent' : ''}>
                  <TableCell>
                    <DatePicker
                      selected={
                        isEditing && editDrafts[op.id]?.data_operacao
                          ? new Date(editDrafts[op.id].data_operacao)
                          : op.data_operacao
                          ? new Date(op.data_operacao)
                          : undefined
                      }
                      onSelect={(date: Date | undefined) => {
                        if (isEditing) {
                          changeField(op.id, 'data_operacao', date ? date.toISOString() : null)
                        }
                      }}
                      disabled={!isEditing}
                    />
                  </TableCell>

                  <TableCell>
                    <Select
                      value={isEditing ? (editDrafts[op.id]?.operador_id || '') : (op.operador_id || '')}
                      onValueChange={(v) => {
                        if (isEditing) {
                          changeField(op.id, 'operador_id', v)
                        }
                      }}
                      disabled={!isEditing}
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
                      value={isEditing ? (editDrafts[op.id]?.maquina || '') : (op.maquina || '')}
                      onValueChange={(v) => {
                        if (isEditing) {
                          changeField(op.id, 'maquina', v)
                        }
                      }}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Máquina" />
                      </SelectTrigger>
                      <SelectContent>
                        {machines
                          .filter((m) => m.tipo === 'Corte')
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
                        { value: '', label: 'Sem palete' },
                        ...paletes.map((palete) => ({ value: palete.id, label: palete.no_palete })),
                      ]}
                      value={paletteSelections[op.id] || op.N_Pal || ''}
                      onChange={(v) => {
                        if (isEditing) {
                          handlePaletteSelection(op.id, v)
                          changeField(op.id, 'N_Pal', v)
                        }
                      }}
                      disabled={!isEditing}
                    />
                  </TableCell>

                  <TableCell>
                    <Combobox
                      options={materialOptions}
                      value={materialSelections[op.id]?.material || ''}
                      onChange={(v) => {
                        if (isEditing) {
                          handleMaterialChange(op.id, 'material', v)
                        }
                      }}
                      disabled={!isEditing || isMaterialFromPalette(op.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <Combobox
                      options={getCaracteristicaOptions(materialSelections[op.id]?.material)}
                      value={materialSelections[op.id]?.carateristica || ''}
                      onChange={(v) => {
                        if (isEditing) {
                          handleMaterialChange(op.id, 'carateristica', v)
                        }
                      }}
                      disabled={!isEditing || isMaterialFromPalette(op.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <Combobox
                      options={getCorOptions(materialSelections[op.id]?.material, materialSelections[op.id]?.carateristica)}
                      value={materialSelections[op.id]?.cor || ''}
                      onChange={(v) => {
                        if (isEditing) {
                          handleMaterialChange(op.id, 'cor', v)
                        }
                      }}
                      disabled={!isEditing || isMaterialFromPalette(op.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={isEditing && editDrafts[op.id]?.num_placas_corte !== undefined
                        ? String(editDrafts[op.id]?.num_placas_corte ?? '')
                        : String(op.num_placas_corte ?? '')}
                      onChange={(e) => {
                        if (isEditing) {
                          changeField(op.id, 'num_placas_corte', e.target.value)
                        }
                      }}
                      disabled={!isEditing}
                      className="w-full"
                    />
                  </TableCell>

                  <TableCell>
                    <SimpleNotasPopover
                      value={isEditing ? (editDrafts[op.id]?.observacoes || '') : (op.observacoes || '')}
                      onSave={(value) => {
                        if (isEditing) {
                          changeField(op.id, 'observacoes', value)
                        }
                      }}
                      placeholder="Notas..."
                      label="Notas"
                      buttonSize="icon"
                      disabled={!isEditing}
                    />
                  </TableCell>

                  <TableCell>
                    <Checkbox
                      checked={op.concluido || false}
                      onCheckedChange={(checked) => handleFieldChange(op.id, 'concluido', checked)}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-1">
                      {!isEditing ? (
                        <>
                          <Button size="icon" variant="outline" onClick={() => startEdit(op.id)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="destructive" onClick={() => handleDeleteOperation(op.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="default" onClick={() => acceptEdit(op.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="destructive" onClick={() => cancelEdit(op.id)}>
                            <XSquare className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
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
  )
}

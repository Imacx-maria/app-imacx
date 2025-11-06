'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Plus, Save, X } from 'lucide-react'
import { useMaterialsCascading } from '@/hooks/useMaterialsCascading'
import { useTableData } from '@/hooks/useTableData'
import { useCoresImpressao } from '@/hooks/useCoresImpressao'
import Combobox from '@/components/ui/Combobox'

export interface DesignerPlano {
  id?: string
  plano_nome: string
  tipo_operacao: 'Impressao' | 'Corte' | 'Impressao_Flexiveis'
  maquina?: string
  material?: string
  caracteristicas?: string
  cor?: string
  material_id?: string | null
  cores?: string
  quantidade?: number
  notas?: string
  plano_ordem?: number
}

interface PlanosTableProps {
  itemId: string
  planos: DesignerPlano[]
  onPlanosChange: (planos: DesignerPlano[]) => void
  supabase: any
}

export default function PlanosTable({
  itemId,
  planos,
  onPlanosChange,
  supabase,
}: PlanosTableProps) {
  const { materialOptions, getCaracteristicaOptions, getCorOptions, getMaterialId } =
    useMaterialsCascading()
  const { machines } = useTableData()
  const { cores: coresOptions, loading: coresLoading, error: coresError } = useCoresImpressao()

  // Debug log for cores options
  useEffect(() => {
    console.log('🎨 [PlanosTable] Cores options updated:', coresOptions)
    console.log('🎨 [PlanosTable] Cores loading:', coresLoading)
    console.log('🎨 [PlanosTable] Cores error:', coresError)
  }, [coresOptions, coresLoading, coresError])

  // Convert machines to combobox format (value = UUID, label = name)
  const machineOptions = machines.map((m) => ({
    value: m.value, // UUID from database
    label: m.label.toUpperCase(),
  }))

  const [editingId, setEditingId] = useState<string | null>(null)
  const [newPlano, setNewPlano] = useState<DesignerPlano | null>(null)
  const [materialSelections, setMaterialSelections] = useState<{
    [key: string]: { material?: string; caracteristicas?: string; cor?: string }
  }>({})

  // Initialize material selections from existing planos
  useEffect(() => {
    const selections: typeof materialSelections = {}
    planos.forEach((plano) => {
      if (plano.id) {
        selections[plano.id] = {
          material: plano.material?.toUpperCase(),
          caracteristicas: plano.caracteristicas?.toUpperCase(),
          cor: plano.cor?.toUpperCase(),
        }
      }
    })
    setMaterialSelections(selections)
  }, [planos])

  const handleAddPlano = () => {
    const nextOrdem = Math.max(0, ...planos.map((p) => p.plano_ordem || 0)) + 1
    const planoLetter = String.fromCharCode(64 + nextOrdem) // A, B, C, etc.

    setNewPlano({
      plano_nome: `Plano ${planoLetter}`,
      tipo_operacao: 'Impressao',
      plano_ordem: nextOrdem,
    })
  }

  const handleSaveNewPlano = async () => {
    if (!newPlano?.plano_nome || !newPlano?.tipo_operacao) {
      alert('Nome do plano e tipo de operação são obrigatórios')
      return
    }

    try {
      const planoData = {
        ...newPlano,
        item_id: itemId,
        material: materialSelections.new?.material,
        caracteristicas: materialSelections.new?.caracteristicas,
        cor: materialSelections.new?.cor,
        material_id: materialSelections.new
          ? getMaterialId(
              materialSelections.new.material,
              materialSelections.new.caracteristicas,
              materialSelections.new.cor
            )
          : null,
      }

      const { data, error } = await supabase
        .from('designer_planos')
        .insert([planoData])
        .select()
        .single()

      if (error) throw error

      onPlanosChange([...planos, data])
      setNewPlano(null)
      setMaterialSelections((prev) => {
        const { new: _, ...rest } = prev
        return rest
      })
    } catch (error) {
      console.error('Error saving plano:', error)
      alert('Erro ao guardar plano')
    }
  }

  const handleUpdatePlano = async (plano: DesignerPlano) => {
    if (!plano.id) return

    try {
      const planoData = {
        ...plano,
        material: materialSelections[plano.id]?.material,
        caracteristicas: materialSelections[plano.id]?.caracteristicas,
        cor: materialSelections[plano.id]?.cor,
        material_id: materialSelections[plano.id]
          ? getMaterialId(
              materialSelections[plano.id].material,
              materialSelections[plano.id].caracteristicas,
              materialSelections[plano.id].cor
            )
          : null,
      }

      const { error } = await supabase
        .from('designer_planos')
        .update(planoData)
        .eq('id', plano.id)

      if (error) throw error

      onPlanosChange(planos.map((p) => (p.id === plano.id ? { ...p, ...planoData } : p)))
      setEditingId(null)
    } catch (error) {
      console.error('Error updating plano:', error)
      alert('Erro ao atualizar plano')
    }
  }

  const handleDeletePlano = async (planoId: string) => {
    if (!confirm('Tem certeza que deseja eliminar este plano?')) return

    try {
      const { error } = await supabase.from('designer_planos').delete().eq('id', planoId)

      if (error) throw error

      onPlanosChange(planos.filter((p) => p.id !== planoId))
    } catch (error) {
      console.error('Error deleting plano:', error)
      alert('Erro ao eliminar plano')
    }
  }

  const handleMaterialChange = (
    planoId: string | 'new',
    field: 'material' | 'caracteristicas' | 'cor',
    value: string
  ) => {
    setMaterialSelections((prev) => {
      const current = prev[planoId] || {}

      if (field === 'material') {
        return { ...prev, [planoId]: { material: value } }
      } else if (field === 'caracteristicas') {
        return {
          ...prev,
          [planoId]: { ...current, caracteristicas: value, cor: undefined },
        }
      } else {
        return { ...prev, [planoId]: { ...current, cor: value } }
      }
    })
  }

  const renderMaterialInputs = (planoId: string | 'new', readOnly: boolean = false) => {
    const selection = materialSelections[planoId] || {}

    return (
      <div className="flex gap-2">
        <Combobox
          options={materialOptions}
          value={selection.material || ''}
          onChange={(value) => handleMaterialChange(planoId, 'material', value)}
          placeholder="Material"
          disabled={readOnly}
          className="w-[150px]"
        />
        <Combobox
          options={getCaracteristicaOptions(selection.material)}
          value={selection.caracteristicas || ''}
          onChange={(value) => handleMaterialChange(planoId, 'caracteristicas', value)}
          placeholder="Caract."
          disabled={!selection.material || readOnly}
          className="w-[125px]"
        />
        <Combobox
          options={getCorOptions(selection.material, selection.caracteristicas)}
          value={selection.cor || ''}
          onChange={(value) => handleMaterialChange(planoId, 'cor', value)}
          placeholder="Cor"
          disabled={!selection.caracteristicas || readOnly}
          className="w-[150px]"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Planos de Produção</h4>
        <Button size="sm" onClick={handleAddPlano} disabled={!!newPlano}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Plano
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
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
            {planos.length === 0 && !newPlano && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum plano criado. Clique em &quot;Adicionar Plano&quot; para começar.
                </TableCell>
              </TableRow>
            )}

            {planos.map((plano) => {
              const isEditing = editingId === plano.id

              return (
                <TableRow key={plano.id}>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={plano.plano_nome}
                        onChange={(e) =>
                          onPlanosChange(
                            planos.map((p) =>
                              p.id === plano.id ? { ...p, plano_nome: e.target.value } : p
                            )
                          )
                        }
                        className="w-full"
                      />
                    ) : (
                      <span className="font-mono">{plano.plano_nome}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select
                        value={plano.tipo_operacao}
                        onValueChange={(value: any) =>
                          onPlanosChange(
                            planos.map((p) =>
                              p.id === plano.id ? { ...p, tipo_operacao: value } : p
                            )
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Impressao">Impressão</SelectItem>
                          <SelectItem value="Corte">Corte</SelectItem>
                          <SelectItem value="Impressao_Flexiveis">Flexíveis</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">
                        {plano.tipo_operacao === 'Impressao'
                          ? 'Impressão'
                          : plano.tipo_operacao === 'Corte'
                          ? 'Corte'
                          : 'Flexíveis'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Combobox
                        options={machineOptions}
                        value={plano.maquina || ''}
                        onChange={(value) =>
                          onPlanosChange(
                            planos.map((p) =>
                              p.id === plano.id ? { ...p, maquina: value } : p
                            )
                          )
                        }
                        placeholder="Máquina"
                        className="w-full"
                      />
                    ) : (
                      <span className="text-sm">
                        {plano.maquina ? machines.find(m => m.value === plano.maquina)?.label || plano.maquina : '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{renderMaterialInputs(plano.id!, !isEditing)}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Combobox
                        options={coresOptions}
                        value={plano.cores || ''}
                        onChange={(value) =>
                          onPlanosChange(
                            planos.map((p) =>
                              p.id === plano.id ? { ...p, cores: value } : p
                            )
                          )
                        }
                        placeholder="Cores"
                        className="w-[140px]"
                      />
                    ) : (
                      <span className="text-sm font-mono">{plano.cores || '-'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={plano.quantidade || ''}
                        onChange={(e) => {
                          const value = e.target.value
                          // Validate: allow max 1 decimal place
                          if (value === '' || /^\d+(\.\d{0,1})?$/.test(value)) {
                            const numValue = value === '' ? 0 : parseFloat(value)
                            onPlanosChange(
                              planos.map((p) =>
                                p.id === plano.id
                                  ? { ...p, quantidade: numValue }
                                  : p
                              )
                            )
                          }
                        }}
                        className="w-[70px]"
                      />
                    ) : (
                      <span className="text-sm">{plano.quantidade || 0}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={plano.notas || ''}
                        onChange={(e) =>
                          onPlanosChange(
                            planos.map((p) =>
                              p.id === plano.id ? { ...p, notas: e.target.value } : p
                            )
                          )
                        }
                      />
                    ) : (
                      <span className="text-sm">{plano.notas || '-'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleUpdatePlano(plano)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingId(plano.id!)}
                          >
                            <span className="text-xs">✎</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeletePlano(plano.id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}

            {newPlano && (
              <TableRow className="bg-muted/50">
                <TableCell>
                  <Input
                    value={newPlano.plano_nome}
                    onChange={(e) => setNewPlano({ ...newPlano, plano_nome: e.target.value })}
                    placeholder="Plano A"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={newPlano.tipo_operacao}
                    onValueChange={(value: any) =>
                      setNewPlano({ ...newPlano, tipo_operacao: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Impressao">Impressão</SelectItem>
                      <SelectItem value="Corte">Corte</SelectItem>
                      <SelectItem value="Impressao_Flexiveis">Flexíveis</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Combobox
                    options={machineOptions}
                    value={newPlano.maquina || ''}
                    onChange={(value) => setNewPlano({ ...newPlano, maquina: value })}
                    placeholder="Máquina"
                    className="w-full"
                  />
                </TableCell>
                <TableCell>{renderMaterialInputs('new')}</TableCell>
                <TableCell>
                  <Combobox
                    options={coresOptions}
                    value={newPlano.cores || ''}
                    onChange={(value) => setNewPlano({ ...newPlano, cores: value })}
                    placeholder="Cores"
                    className="w-[140px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newPlano.quantidade || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      // Validate: allow max 1 decimal place
                      if (value === '' || /^\d+(\.\d{0,1})?$/.test(value)) {
                        const numValue = value === '' ? 0 : parseFloat(value)
                        setNewPlano({ ...newPlano, quantidade: numValue })
                      }
                    }}
                    placeholder="10"
                    className="w-[70px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={newPlano.notas || ''}
                    onChange={(e) => setNewPlano({ ...newPlano, notas: e.target.value })}
                    placeholder="Notas..."
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={handleSaveNewPlano}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setNewPlano(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

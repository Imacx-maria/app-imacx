'use client'

import React, { useState, useMemo } from 'react'
import type { CheckedState } from '@radix-ui/react-checkbox'
import {
  ChevronDown,
  ChevronRight,
  ReceiptText,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react'

import { createBrowserClient } from '@/utils/supabase'
import type { Item, UpdateItemParams } from '@/app/designer-flow/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table'
import PlanosTable, { type DesignerPlano } from '@/components/designer/PlanosTable'

type ComplexidadeOption = {
  value: string
  label: string
}

type ComplexidadeComponentProps = {
  value: string
  onChange: (value: string) => void
  options: ComplexidadeOption[]
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  className?: string
}

interface DesignerItemCardProps {
  item: Item
  jobId: string
  jobDataIn: string | null
  index: number
  onUpdate: (params: UpdateItemParams) => void
  onDescricaoChange: (itemId: string, value: string) => void
  onCodigoChange: (itemId: string, value: string) => void
  onOpenPathDialog: (jobId: string, item: Item, index: number) => void
  ComplexidadeCombobox: (props: ComplexidadeComponentProps) => React.ReactElement
  complexidades: ComplexidadeOption[]
  isLoadingComplexidades: boolean
  onComplexidadeChange: (itemId: string, grau: string | null) => Promise<void>
  isOpen?: boolean
  onToggle?: (open: boolean) => void
  planos?: DesignerPlano[]
  onPlanosChange?: (planos: DesignerPlano[]) => void
}

const getCurrentStage = (item: Item): string => {
  if (item.paginacao) return 'Paginação'

  if (item.r6) return 'R6 Recusada'
  if (item.r5) return 'R5 Recusada'
  if (item.r4) return 'R4 Recusada'
  if (item.r3) return 'R3 Recusada'
  if (item.r2) return 'R2 Recusada'
  if (item.r1) return 'R1 Recusada'

  if (item.aprovacao_recebida6) return 'Aguardando P'
  if (item.maquete_enviada6) return 'Aguardando A6'
  if (item.aprovacao_recebida5) return 'Em M6'
  if (item.maquete_enviada5) return 'Aguardando A5'
  if (item.aprovacao_recebida4) return 'Em M5'
  if (item.maquete_enviada4) return 'Aguardando A4'
  if (item.aprovacao_recebida3) return 'Em M4'
  if (item.maquete_enviada3) return 'Aguardando A3'
  if (item.aprovacao_recebida2) return 'Em M3'
  if (item.maquete_enviada2) return 'Aguardando A2'
  if (item.aprovacao_recebida1) return 'Em M2'
  if (item.maquete_enviada1) return 'Aguardando A1'
  if (item.duvidas) return 'Em Dúvidas'

  return 'Iniciando'
}

const getStatusBadge = (stage: string) => {
  if (stage === 'Concluído' || stage === 'Paginação') {
    return { text: 'text-success-foreground', Icon: CheckCircle2 }
  }
  if (stage.includes('Aguardando')) {
    return { text: 'text-warning-foreground', Icon: Clock }
  }
  if (stage.includes('Recusada') || stage === 'Em Dúvidas') {
    return { text: 'text-destructive', Icon: AlertCircle }
  }
  return {
    text: 'text-foreground',
    Icon: Clock,
  }
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const hasTime = dateString.includes('T') || dateString.includes(' ')

  if (hasTime) {
    return date.toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const calculateDaysBetween = (
  startDate: string | null,
  endDate: string | null,
): string => {
  if (!startDate || !endDate) return ''

  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays === 1 ? '1 dia' : `${diffDays} dias`
}

const findLastApprovalDate = (item: Item): string | null => {
  if (item.aprovacao_recebida6 && item.data_aprovacao_recebida6) {
    return item.data_aprovacao_recebida6
  }
  if (item.aprovacao_recebida5 && item.data_aprovacao_recebida5) {
    return item.data_aprovacao_recebida5
  }
  if (item.aprovacao_recebida4 && item.data_aprovacao_recebida4) {
    return item.data_aprovacao_recebida4
  }
  if (item.aprovacao_recebida3 && item.data_aprovacao_recebida3) {
    return item.data_aprovacao_recebida3
  }
  if (item.aprovacao_recebida2 && item.data_aprovacao_recebida2) {
    return item.data_aprovacao_recebida2
  }
  if (item.aprovacao_recebida1 && item.data_aprovacao_recebida1) {
    return item.data_aprovacao_recebida1
  }

  return null
}

export default function DesignerItemCard({
  item,
  jobId,
  jobDataIn,
  index,
  onUpdate,
  onDescricaoChange,
  onCodigoChange,
  onOpenPathDialog,
  ComplexidadeCombobox,
  complexidades,
  isLoadingComplexidades,
  onComplexidadeChange,
  isOpen: controlledOpen = false,
  onToggle,
  planos = [],
  onPlanosChange,
}: DesignerItemCardProps) {
  // Use controlled state if provided, otherwise fall back to internal state
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = onToggle !== undefined ? controlledOpen : internalOpen

  const handleToggle = (open: boolean) => {
    if (onToggle) {
      onToggle(open)
    } else {
      setInternalOpen(open)
    }
  }

  const supabase = useMemo(() => createBrowserClient(), [])

  const currentStage = useMemo(() => getCurrentStage(item), [item])
  const statusBadge = useMemo(() => getStatusBadge(currentStage), [currentStage])
  const StatusIcon = statusBadge.Icon
  const paginacaoDotColor = item.paginacao ? 'bg-success' : 'bg-destructive'

  const showM2A2 = !!item.r1 || !!item.maquete_enviada2 || !!item.aprovacao_recebida2
  const showM3A3 = !!item.r2 || !!item.maquete_enviada3 || !!item.aprovacao_recebida3
  const showM4A4 = !!item.r3 || !!item.maquete_enviada4 || !!item.aprovacao_recebida4
  const showM5A5 = !!item.r4 || !!item.maquete_enviada5 || !!item.aprovacao_recebida5
  const showM6A6 = !!item.r5 || !!item.maquete_enviada6 || !!item.aprovacao_recebida6

  const showFinal =
    item.aprovacao_recebida1 ||
    item.aprovacao_recebida2 ||
    item.aprovacao_recebida3 ||
    item.aprovacao_recebida4 ||
    item.aprovacao_recebida5 ||
    item.aprovacao_recebida6

  const columnMap: Record<string, string> = {
    r1: 'R1',
    r2: 'R2',
    r3: 'R3',
    r4: 'R4',
    r5: 'R5',
    r6: 'R6',
  }

  const handleBooleanToggle = async (
    field: keyof Item,
    checked: CheckedState,
    timestampField?: keyof Item,
  ) => {
    if (!item.designer_item_id) return

    const value = checked === true
    const supabase = createBrowserClient()

    const fieldStr = field as string
    const versionMatch = fieldStr.match(/(\d)$/)
    const version = versionMatch ? versionMatch[1] : null

    const isAprov = fieldStr.startsWith('aprovacao_recebida')
    const isMaquete = fieldStr.startsWith('maquete_enviada')
    const isRecusa = /^r\d$/.test(fieldStr)

    const now = new Date().toISOString()

    const related = version
      ? {
          maqueteField: (`maquete_enviada${version}`) as keyof Item,
          aprovField: (`aprovacao_recebida${version}`) as keyof Item,
          recusaField: (`r${version}`) as keyof Item,
          dataMaqueteField: (`data_maquete_enviada${version}`) as keyof Item,
          dataAprovField: (`data_aprovacao_recebida${version}`) as keyof Item,
          dataRecusaField: (`R${version}_date`) as keyof Item,
        }
      : null

    // Gate A/R behind M: cannot set true if M not checked
    if ((isAprov || isRecusa) && related && value === true) {
      const maqueteDone = (item[related.maqueteField] as boolean | null) || false
      if (!maqueteDone) {
        return
      }
    }

    // Prepare updates
    const updates: UpdateItemParams['updates'] = {}
    const supabaseUpdates: Record<string, any> = {}

    const supabaseField = columnMap[fieldStr] ?? fieldStr

    ;(updates as any)[field] = value
    supabaseUpdates[supabaseField] = value

    if (timestampField) {
      const tsKey = timestampField as string
      ;(updates as any)[timestampField] = value ? now : null
      supabaseUpdates[tsKey] = value ? now : null
    }

    // Mutual exclusion between A* and R*
    if (related) {
      if (isAprov && value === true) {
        // When A* turns true, force R* false and clear R*_date
        ;(updates as any)[related.recusaField] = false
        ;(updates as any)[related.dataRecusaField] = null
        const recusaSupabaseField = columnMap[related.recusaField as string] ?? (related.recusaField as string)
        supabaseUpdates[recusaSupabaseField] = false
        supabaseUpdates[related.dataRecusaField as string] = null
      } else if (isRecusa && value === true) {
        // When R* turns true, force A* false and clear A* date
        ;(updates as any)[related.aprovField] = false
        ;(updates as any)[related.dataAprovField] = null
        supabaseUpdates[related.aprovField as string] = false
        supabaseUpdates[related.dataAprovField as string] = null
      }

      // If M* is unchecked, clear A* and R* and their dates
      if (isMaquete && value === false) {
        ;(updates as any)[related.aprovField] = false
        ;(updates as any)[related.recusaField] = false
        ;(updates as any)[related.dataAprovField] = null
        ;(updates as any)[related.dataRecusaField] = null

        supabaseUpdates[related.aprovField as string] = false
        const recusaSupabaseField = columnMap[related.recusaField as string] ?? (related.recusaField as string)
        supabaseUpdates[recusaSupabaseField] = false
        supabaseUpdates[related.dataAprovField as string] = null
        supabaseUpdates[related.dataRecusaField as string] = null
      }

      // Cascade reset later versions when A* or R* toggled true
      if ((isAprov || isRecusa) && value === true && version) {
        for (let v = Number(version) + 1; v <= 6; v++) {
          const mKey = (`maquete_enviada${v}`) as keyof Item
          const aKey = (`aprovacao_recebida${v}`) as keyof Item
          const rKey = (`r${v}`) as keyof Item
          const dmKey = (`data_maquete_enviada${v}`) as keyof Item
          const daKey = (`data_aprovacao_recebida${v}`) as keyof Item
          const drKey = (`R${v}_date`) as keyof Item

          ;(updates as any)[mKey] = false
          ;(updates as any)[aKey] = false
          ;(updates as any)[rKey] = false
          ;(updates as any)[dmKey] = null
          ;(updates as any)[daKey] = null
          ;(updates as any)[drKey] = null

          supabaseUpdates[mKey as string] = false
          supabaseUpdates[aKey as string] = false
          const rSupabaseField = columnMap[rKey as string] ?? (rKey as string)
          supabaseUpdates[rSupabaseField] = false
          supabaseUpdates[dmKey as string] = null
          supabaseUpdates[daKey as string] = null
          supabaseUpdates[drKey as string] = null
        }
      }
    }

    // Local state update first for responsiveness
    onUpdate({
      designerItemId: item.designer_item_id,
      updates,
    })

    try {
      await supabase
        .from('designer_items')
        .update(supabaseUpdates)
        .eq('id', item.designer_item_id)
    } catch (error) {
      console.error('Error updating item status:', error)
    }
  }

  const handleQuantidadeBlur = async (value: number | null) => {
    if (!item.id) return
    try {
      const supabase = createBrowserClient()
      await supabase
        .from('items_base')
        .update({ quantidade: value })
        .eq('id', item.id)
    } catch (error) {
      console.error('Error updating quantidade:', error)
    }
  }

  const handlePathBlur = async (value: string) => {
    if (!item.designer_item_id) return
    try {
      const supabase = createBrowserClient()
      const updates: Record<string, string | null> = {
        path_trabalho: value,
      }

      if (value.trim()) {
        const now = new Date().toISOString()
        updates.data_saida = now
        // If Paginação está ativa e ainda não temos data_paginacao, registre agora
        if (item.paginacao && !item.data_paginacao) {
          updates.data_paginacao = now
        }
      }

      await supabase
        .from('designer_items')
        .update(updates)
        .eq('id', item.designer_item_id)

      if (value.trim()) {
        const localUpdates: UpdateItemParams['updates'] = {
          data_saida: updates.data_saida || null,
        }
        if (updates.data_paginacao) {
          localUpdates.data_paginacao = updates.data_paginacao
        }
        onUpdate({
          designerItemId: item.designer_item_id,
          updates: localUpdates,
        })
      }
    } catch (error) {
      console.error('Error updating path:', error)
    }
  }

  const handleComplexidadeChange = async (value: string) => {
    try {
      // Save to designer_items table, not items_base
      if (item.designer_item_id) {
        const supabase = createBrowserClient()
        await supabase
          .from('designer_items')
          .update({ complexidade: value || null })
          .eq('id', item.designer_item_id)

        // Update local state
        onUpdate({
          designerItemId: item.designer_item_id,
          updates: { complexidade: value || null },
        })

        // If OFFSET, also set paginacao
        if (value === 'OFFSET') {
          const now = new Date().toISOString()
          await supabase
            .from('designer_items')
            .update({
              paginacao: true,
              path_trabalho: 'P:',
              data_saida: now,
            })
            .eq('id', item.designer_item_id)

          onUpdate({
            designerItemId: item.designer_item_id,
            updates: {
              paginacao: true,
              path_trabalho: 'P:',
              data_saida: now,
            },
          })
        }
      }
    } catch (error) {
      console.error('Error updating complexidade:', error)
    }
  }

  const handlePaginacaoToggle = async (checked: CheckedState) => {
    if (!item.designer_item_id) return
    const supabase = createBrowserClient()

    if (checked === true) {
      const now = new Date().toISOString()
      const updatesTrue: UpdateItemParams['updates'] = {
        paginacao: true,
        data_paginacao: now,
      }

      onUpdate({
        designerItemId: item.designer_item_id,
        updates: updatesTrue,
      })

      try {
        await supabase
          .from('designer_items')
          .update({
            paginacao: true,
            data_paginacao: now,
          })
          .eq('id', item.designer_item_id)
      } catch (error) {
        console.error('Error updating paginacao:', error)
      }

      onOpenPathDialog(jobId, item, index)
      return
    }

    const updatesFalse: UpdateItemParams['updates'] = {
      paginacao: false,
      data_paginacao: null,
      path_trabalho: null,
    }

    onUpdate({
      designerItemId: item.designer_item_id,
      updates: updatesFalse,
    })

    try {
      await supabase
        .from('designer_items')
        .update({
          paginacao: false,
          data_paginacao: null,
          path_trabalho: null,
        })
        .eq('id', item.designer_item_id)
    } catch (error) {
      console.error('Error updating paginacao:', error)
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle}>
      <div className="bg-card border border-border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={`group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
              isOpen
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-primary-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground" />
              )}
              <div className="overflow-hidden">
                <div
                  className={`text-sm font-medium truncate ${
                    isOpen
                      ? 'text-primary-foreground'
                      : 'text-foreground group-hover:text-accent-foreground'
                  }`}
                >
                  {item.descricao || 'Sem descrição'}
                </div>
                {item.complexidade && (
                  <div
                    className={`mt-1 flex items-center gap-2 text-xs ${
                      isOpen
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground group-hover:text-accent-foreground'
                    }`}
                  >
                    <Badge
                      variant="outline"
                      className={`text-xs rounded-none ${isOpen ? 'text-primary-foreground border-border/20' : ''}`}
                    >
                      {item.complexidade}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <div
              className={`inline-flex items-center gap-2 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusBadge.text}`}
            >
              <span className={`h-2.5 w-2.5 border border-border ${paginacaoDotColor}`} />
              {currentStage}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="!overflow-visible">
          <div className="space-y-4 px-4 pb-4 pt-4 overflow-visible">
            {/* Row - Código, Complexidade, Quantidade with inline label, Notas button */}
            <div className="grid gap-4 sm:grid-cols-[1fr_400px_200px_40px]">
              <div>
                <Input
                  value={item.codigo ?? ''}
                  onChange={(e) => {
                    const newValue = e.target.value
                    onUpdate({
                      designerItemId: item.designer_item_id,
                      updates: { codigo: newValue },
                    })
                    onCodigoChange(item.id, newValue)
                  }}
                  placeholder="Código"
                  className="text-sm h-[40px] border border-foreground/20"
                />
              </div>
              <div>
                <ComplexidadeCombobox
                  value={item.complexidade ?? ''}
                  onChange={handleComplexidadeChange}
                  options={complexidades}
                  disabled={isLoadingComplexidades}
                  loading={isLoadingComplexidades}
                  placeholder="Complexidade"
                  className="h-[40px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  QTD.
                </label>
                <Input
                  type="number"
                  value={item.quantidade ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    const nextValue = raw === '' ? null : Number(raw)
                    onUpdate({
                      designerItemId: item.designer_item_id,
                      updates: { quantidade: nextValue },
                    })
                  }}
                  onBlur={(e) => {
                    const raw = e.target.value
                    const nextValue = raw === '' ? null : Number(raw)
                    void handleQuantidadeBlur(nextValue)
                  }}
                  maxLength={6}
                  className="text-sm h-[40px] flex-1 border border-foreground/20"
                />
              </div>
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-[40px] w-[40px] items-center justify-center border border-foreground/20 bg-primary text-primary-foreground transition-colors hover:border-foreground/30 hover:bg-primary/90"
                      title="Notas"
                    >
                      <FileText size={18} className="text-primary-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 resize overflow-auto">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm uppercase tracking-wide">Notas</h4>
                      <Textarea
                        value={item.notas ?? ''}
                        onChange={(e) => {
                          const newValue = e.target.value
                          onUpdate({
                            designerItemId: item.designer_item_id,
                            updates: { notas: newValue },
                          })
                        }}
                        placeholder="Adicionar notas..."
                        rows={5}
                        className="text-sm resize-y min-h-[120px] border border-foreground/20"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Etapas (Versões) */}
            <StageBlock
              label="Versão 1"
              borderClass="border-l-warning"
              maqueteChecked={!!item.maquete_enviada1}
              aprovacaoChecked={!!item.aprovacao_recebida1}
              onMaqueteChange={(checked) =>
                handleBooleanToggle('maquete_enviada1', checked, 'data_maquete_enviada1')
              }
              onAprovacaoChange={(checked) =>
                handleBooleanToggle('aprovacao_recebida1', checked, 'data_aprovacao_recebida1')
              }
              recusaChecked={!!item.r1 || !!item.R1_date}
              recusaLabel="R1 recusada"
              onRecusaChange={(checked) => handleBooleanToggle('r1', checked, 'R1_date')}
              disableA={!item.maquete_enviada1}
              disableRecusa={!item.maquete_enviada1}
            />
            {showM2A2 && (
              <StageBlock
                label="Versão 2"
                borderClass="border-l-info"
                maqueteChecked={!!item.maquete_enviada2}
                aprovacaoChecked={!!item.aprovacao_recebida2}
                onMaqueteChange={(checked) =>
                  handleBooleanToggle('maquete_enviada2', checked, 'data_maquete_enviada2')
                }
                onAprovacaoChange={(checked) =>
                  handleBooleanToggle('aprovacao_recebida2', checked, 'data_aprovacao_recebida2')
                }
                recusaChecked={!!item.r2 || !!item.R2_date}
                recusaLabel="R2 recusada"
                onRecusaChange={(checked) => handleBooleanToggle('r2', checked, 'R2_date')}
                disableA={!item.maquete_enviada2}
                disableRecusa={!item.maquete_enviada2}
              />
            )}
            {showM3A3 && (
              <StageBlock
                label="Versão 3"
                borderClass="border-l-accent"
                maqueteChecked={!!item.maquete_enviada3}
                aprovacaoChecked={!!item.aprovacao_recebida3}
                onMaqueteChange={(checked) =>
                  handleBooleanToggle('maquete_enviada3', checked, 'data_maquete_enviada3')
                }
                onAprovacaoChange={(checked) =>
                  handleBooleanToggle('aprovacao_recebida3', checked, 'data_aprovacao_recebida3')
                }
                recusaChecked={!!item.r3 || !!item.R3_date}
                recusaLabel="R3 recusada"
                onRecusaChange={(checked) => handleBooleanToggle('r3', checked, 'R3_date')}
                disableA={!item.maquete_enviada3}
                disableRecusa={!item.maquete_enviada3}
              />
            )}
            {showM4A4 && (
              <StageBlock
                label="Versão 4"
                borderClass="border-l-primary"
                maqueteChecked={!!item.maquete_enviada4}
                aprovacaoChecked={!!item.aprovacao_recebida4}
                onMaqueteChange={(checked) =>
                  handleBooleanToggle('maquete_enviada4', checked, 'data_maquete_enviada4')
                }
                onAprovacaoChange={(checked) =>
                  handleBooleanToggle('aprovacao_recebida4', checked, 'data_aprovacao_recebida4')
                }
                recusaChecked={!!item.r4 || !!item.R4_date}
                recusaLabel="R4 recusada"
                onRecusaChange={(checked) => handleBooleanToggle('r4', checked, 'R4_date')}
                disableA={!item.maquete_enviada4}
                disableRecusa={!item.maquete_enviada4}
              />
            )}
            {showM5A5 && (
              <StageBlock
                label="Versão 5"
                borderClass="border-l-success"
                maqueteChecked={!!item.maquete_enviada5}
                aprovacaoChecked={!!item.aprovacao_recebida5}
                onMaqueteChange={(checked) =>
                  handleBooleanToggle('maquete_enviada5', checked, 'data_maquete_enviada5')
                }
                onAprovacaoChange={(checked) =>
                  handleBooleanToggle('aprovacao_recebida5', checked, 'data_aprovacao_recebida5')
                }
                recusaChecked={!!item.r5 || !!item.R5_date}
                recusaLabel="R5 recusada"
                onRecusaChange={(checked) => handleBooleanToggle('r5', checked, 'R5_date')}
                disableA={!item.maquete_enviada5}
                disableRecusa={!item.maquete_enviada5}
              />
            )}
            {showM6A6 && (
              <StageBlock
                label="Versão 6"
                borderClass="border-l-destructive"
                maqueteChecked={!!item.maquete_enviada6}
                aprovacaoChecked={!!item.aprovacao_recebida6}
                onMaqueteChange={(checked) =>
                  handleBooleanToggle('maquete_enviada6', checked, 'data_maquete_enviada6')
                }
                onAprovacaoChange={(checked) =>
                  handleBooleanToggle('aprovacao_recebida6', checked, 'data_aprovacao_recebida6')
                }
                recusaChecked={!!item.r6 || !!item.R6_date}
                recusaLabel="R6 recusada"
                onRecusaChange={(checked) => handleBooleanToggle('r6', checked, 'R6_date')}
                disableA={!item.maquete_enviada6}
                disableRecusa={!item.maquete_enviada6}
              />
            )}

            {showFinal && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Finalização
                </div>
                <div>
                  <div className="space-y-2 border-l-4 border-l-success p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Paginação
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={!!item.paginacao}
                          onCheckedChange={handlePaginacaoToggle}
                        />
                        <span className="whitespace-nowrap">Paginação</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(item.paginacao || item.path_trabalho) && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Path
                </label>
                <Input
                  value={item.path_trabalho ?? ''}
                  placeholder="Ex.: P:\\..."
                  disabled={!item.paginacao}
                  onChange={(e) => {
                    const newValue = e.target.value
                    onUpdate({
                      designerItemId: item.designer_item_id,
                      updates: { path_trabalho: newValue },
                    })
                  }}
                  onBlur={(e) => {
                    void handlePathBlur(e.target.value)
                  }}
                  className="text-sm font-mono"
                />
              </div>
            )}

            {/* Planos de Produção - Show only when paginação is active */}
            {item.paginacao && onPlanosChange && (
              <div className="space-y-3 border-t border-border pt-4">
                <PlanosTable
                  itemId={item.id}
                  planos={planos}
                  onPlanosChange={onPlanosChange}
                  supabase={supabase}
                />
              </div>
            )}

            <div className="flex flex-col items-start gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
              <Popover modal={false}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-warning text-warning-foreground transition-colors hover:bg-warning/90"
                  >
                    <ReceiptText className="mr-2 h-4 w-4 text-warning-foreground" />
                    Ver Timeline
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[90vw] max-w-[400px] space-y-3 bg-card">
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      Histórico
                    </div>
                    <div className="mt-2">
                      <Table className="w-full">
                        <TableBody>
                          {item.data_in && (
                            <TableRow className="border-b border-border hover:bg-accent">
                              <TableCell className="py-2 px-2 sm:px-3 text-xs font-medium text-left">
                                Entrada
                              </TableCell>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs text-right">
                                {formatDate(item.data_in)}
                              </TableCell>
                            </TableRow>
                          )}
                          {item.data_duvidas && (
                            <TableRow className="border-b border-border hover:bg-accent">
                              <TableCell className="py-2 px-2 sm:px-3 text-xs font-medium text-left">
                                Dúvidas
                              </TableCell>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs text-right">
                                {formatDate(item.data_duvidas)}
                              </TableCell>
                            </TableRow>
                          )}
                          {[
                            [
                              'M1 Enviada',
                              item.data_maquete_enviada1,
                              item.R1_date ?? item.data_aprovacao_recebida1,
                              item.R1_date ? 'R1 Recusada' : 'A1 Recebida',
                            ],
                            [
                              'M2 Enviada',
                              item.data_maquete_enviada2,
                              item.R2_date ?? item.data_aprovacao_recebida2,
                              item.R2_date ? 'R2 Recusada' : 'A2 Recebida',
                            ],
                            [
                              'M3 Enviada',
                              item.data_maquete_enviada3,
                              item.R3_date ?? item.data_aprovacao_recebida3,
                              item.R3_date ? 'R3 Recusada' : 'A3 Recebida',
                            ],
                            [
                              'M4 Enviada',
                              item.data_maquete_enviada4,
                              item.R4_date ?? item.data_aprovacao_recebida4,
                              item.R4_date ? 'R4 Recusada' : 'A4 Recebida',
                            ],
                            [
                              'M5 Enviada',
                              item.data_maquete_enviada5,
                              item.R5_date ?? item.data_aprovacao_recebida5,
                              item.R5_date ? 'R5 Recusada' : 'A5 Recebida',
                            ],
                            [
                              'M6 Enviada',
                              item.data_maquete_enviada6,
                              item.R6_date ?? item.data_aprovacao_recebida6,
                              item.R6_date ? 'R6 Recusada' : 'A6 Recebida',
                            ],
                          ].map(([maqueteLabel, maqueteDate, eventDate, eventLabel]) => {
                            if (!maqueteDate && !eventDate) return null
                            return (
                              <React.Fragment key={maqueteLabel as string}>
                                {maqueteDate && (
                                  <TableRow className="border-b border-border hover:bg-accent">
                                    <TableCell className="py-2 px-2 sm:px-3 text-xs font-medium text-left">
                                      {maqueteLabel as string}
                                    </TableCell>
                                    <TableCell className="py-2 px-2 sm:px-3 text-xs text-right">
                                      {formatDate(maqueteDate as string)}
                                    </TableCell>
                                  </TableRow>
                                )}
                                {eventDate && (
                                  <TableRow className="border-b border-border hover:bg-accent">
                                    <TableCell className="py-2 px-2 sm:px-3 text-xs font-medium text-left">
                                      {eventLabel as string}
                                    </TableCell>
                                    <TableCell className="py-2 px-2 sm:px-3 text-xs text-right">
                                      {formatDate(eventDate as string)}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            )
                          })}
                          {item.data_paginacao && (
                            <TableRow className="border-b border-border hover:bg-accent">
                              <TableCell className="py-2 px-2 sm:px-3 text-xs font-medium text-left">
                                Paginação
                              </TableCell>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs text-right">
                                {formatDate(item.data_paginacao)}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {jobDataIn && item.data_paginacao && (
                    <div className="pt-3">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Duração
                      </div>
                      <div className="mt-2">
                        <Table className="w-full">
                          <TableBody>
                            <TableRow className="border-b border-border hover:bg-accent">
                              <TableCell className="py-2 px-2 sm:px-3 text-xs font-medium text-left">
                                Duração Total
                              </TableCell>
                              <TableCell className="py-2 px-2 sm:px-3 text-xs text-primary text-right">
                                {calculateDaysBetween(jobDataIn, item.data_paginacao)}
                              </TableCell>
                            </TableRow>
                            {item.data_duvidas && (
                              <TableRow className="border-b border-border hover:bg-accent">
                                <TableCell className="py-2 px-2 sm:px-3 text-xs font-medium text-left">
                                  Dúvidas até Paginação
                                </TableCell>
                                <TableCell className="py-2 px-2 sm:px-3 text-xs text-warning-foreground text-right">
                                  {calculateDaysBetween(item.data_duvidas, item.data_paginacao)}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {item.data_paginacao && (
                    <div className="pt-3">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Lead Time Final
                      </div>
                      <div className="mt-2">
                        <Table className="w-full">
                          <TableBody>
                            {(() => {
                              const lastApprovalDate = findLastApprovalDate(item)
                              if (lastApprovalDate) {
                                return (
                                  <TableRow className="border-b border-border hover:bg-accent">
                                    <TableCell className="py-2 px-2 sm:px-3 text-xs font-medium text-left">
                                      Aprovação → Paginação
                                    </TableCell>
                                    <TableCell className="py-2 px-2 sm:px-3 text-xs text-emerald-600 dark:text-emerald-400 text-right">
                                      {calculateDaysBetween(lastApprovalDate, item.data_paginacao)}
                                    </TableCell>
                                  </TableRow>
                                )
                              }
                              return (
                                <TableRow className="hover:bg-accent">
                                  <TableCell colSpan={2} className="py-2 px-2 sm:px-3 text-xs text-muted-foreground text-center">
                                    Sem aprovações registadas.
                                  </TableCell>
                                </TableRow>
                              )
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

type StageBlockProps = {
  label: string
  borderClass: string
  maqueteChecked: boolean
  aprovacaoChecked: boolean
  onMaqueteChange: (checked: CheckedState) => void
  onAprovacaoChange: (checked: CheckedState) => void
  recusaChecked?: boolean
  recusaLabel?: string
  onRecusaChange?: (checked: CheckedState) => void
  disableA?: boolean
  disableRecusa?: boolean
}

const StageBlock = ({
  label,
  borderClass,
  maqueteChecked,
  aprovacaoChecked,
  onMaqueteChange,
  onAprovacaoChange,
  recusaChecked,
  recusaLabel,
  onRecusaChange,
  disableA,
  disableRecusa,
}: StageBlockProps) => (
  <div>
    <div className={`space-y-2 border-l-2 ${borderClass} p-3`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={maqueteChecked} onCheckedChange={onMaqueteChange} />
          <span className="whitespace-nowrap">M enviada</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={aprovacaoChecked}
            onCheckedChange={onAprovacaoChange}
            disabled={!!disableA}
          />
          <span className="whitespace-nowrap">A recebida</span>
        </label>
        {onRecusaChange && (
          <label className="flex items-center gap-2 text-sm text-destructive cursor-pointer">
            <Checkbox
              checked={!!recusaChecked}
              onCheckedChange={onRecusaChange}
              disabled={!!disableRecusa}
            />
            <span className="whitespace-nowrap">{recusaLabel ?? 'Recusada'}</span>
          </label>
        )}
      </div>
    </div>
  </div>
)


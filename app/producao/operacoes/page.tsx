'use client'

/**
 * Production Operations Page
 * -------------------------
 * FILTERING RULES:
 * - Only shows items from jobs that have both FO (numero_fo) and ORC (numero_orc) values
 * - Items must have paginação = true from designer_items
 * - Items must have incomplete logistica_entregas
 * - Items from jobs missing either FO or ORC are filtered out
 * - Both numero_fo and numero_orc cannot be null, 0, or "0000"
 * - Items must NOT be brindes
 * - Items must NOT have complexidade = 'OFFSET'
 * - Items must NOT have completed operations (Corte or Impressao_Flexiveis)
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import Combobox from '@/components/ui/Combobox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import { createBrowserClient } from '@/utils/supabase'
import DatePicker from '@/components/custom/DatePicker'
import SimpleNotasPopover from '@/components/custom/SimpleNotasPopover'
import { useTableData } from '@/hooks/useTableData'
import { useMaterialsCascading } from '@/hooks/useMaterialsCascading'
import {
  logOperationCreation,
  logFieldUpdate,
  logOperationDeletion,
} from '@/utils/auditLogging'
import {
  Plus,
  X,
  RotateCw,
  Search,
  Eye,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Settings,
  RefreshCcw,
  Trash2,
  Copy,
  XSquare,
} from 'lucide-react'

// Types
interface ProductionItem {
  id: string
  folha_obra_id: string
  descricao: string
  codigo?: string | null
  quantidade?: number | null
  concluido?: boolean
  concluido_maq?: boolean | null
  brindes?: boolean
  prioridade?: boolean | null
  complexidade?: string | null
  created_at?: string | null
  data_in?: string | null  // Date when work order was entered - for priority calculation
  folhas_obras?: {
    numero_fo?: string
    nome_campanha?: string
    numero_orc?: number
    prioridade?: boolean | null
  } | null
  designer_items?: {
    paginacao?: boolean
    path_trabalho?: string
  } | null
  logistica_entregas?:
    | {
        concluido?: boolean
      }[]
    | {
        concluido?: boolean
      }
    | null
}

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
}

type SortKey = 'numero_fo' | 'nome_campanha' | 'descricao' | 'quantidade' | 'prioridade'

export default function OperacoesPage() {
  const supabase = useMemo(() => createBrowserClient(), [])

  // State
  const [items, setItems] = useState<ProductionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  // Filters
  const [foFilter, setFoFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')

  // Sorting
  const [sortCol, setSortCol] = useState<SortKey>('numero_fo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = useCallback(
    (col: SortKey) => {
      if (sortCol === col) {
        setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
      } else {
        setSortCol(col)
        setSortDir('asc')
      }
    },
    [sortCol, sortDir],
  )

  // Priority color helper - MUST match main producao page logic exactly
  // Reads from folhas_obras.prioridade (set on main page)
  const getPColor = (item: ProductionItem): string => {
    // RED: Priority explicitly set on main page
    if (item.folhas_obras?.prioridade === true) return 'bg-destructive'
    
    // BLUE: Items older than 3 days (uses same field as main page)
    // NOTE: Main page uses data_in, but since that field doesn't exist yet,
    // we temporarily use created_at until migration is run
    if (item.created_at) {
      const days = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
      if (days > 3) return 'bg-info'
    }
    
    // GREEN: Normal items (no priority, < 3 days old)
    return 'bg-success'
  }

  // Fetch data with proper filtering
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('Starting to fetch production items...')

      // First, test basic access
      const { data: testData, error: testError } = await supabase
        .from('items_base')
        .select('id')
        .limit(1)

      if (testError) {
        console.error('Basic items_base access failed:', testError)
        throw new Error(`Database access error: ${testError.message}`)
      }

      if (!testData || testData.length === 0) {
        console.log('No items found in items_base table')
        setItems([])
        return
      }

      // Fetch items with relations
      const { data: itemsData, error: itemsError } = await supabase.from('items_base').select(`
          id,
          folha_obra_id,
          descricao,
          codigo,
          quantidade,
          concluido,
          concluido_maq,
          brindes,
          prioridade,
          complexidade,
          created_at,
          folhas_obras!inner (
            Numero_do_,
            numero_orc,
            Trabalho,
            prioridade
          ),
          designer_items (
            paginacao,
            path_trabalho
          ),
          logistica_entregas (
            concluido
          )
        `)

      if (itemsError) {
        console.error('Complex query failed:', itemsError)
        throw new Error(`Failed to fetch items with relations: ${itemsError.message}`)
      }

      console.log('Items query result:', itemsData?.length || 0, 'items')

      if (!itemsData) {
        console.log('Query returned null/undefined data')
        setItems([])
        return
      }

      // Transform the data
      const transformedItems = itemsData.map((item) => {
        const transformedItem = {
          ...item,
          folhas_obras: Array.isArray(item.folhas_obras) ? item.folhas_obras[0] : item.folhas_obras,
          designer_items: Array.isArray(item.designer_items) ? item.designer_items[0] : item.designer_items,
          logistica_entregas: Array.isArray(item.logistica_entregas) ? item.logistica_entregas : item.logistica_entregas,
        }

        // Map database columns to expected interface properties
        if (transformedItem.folhas_obras) {
          const foData: any = transformedItem.folhas_obras
          const mappedFo: any = {
            numero_orc: foData.numero_orc,
            prioridade: foData.prioridade, // ← ADD THIS! Keep priority from DB
          }
          if (foData.Numero_do_ !== undefined) {
            mappedFo.numero_fo = String(foData.Numero_do_)
          }
          if (foData.Trabalho !== undefined) {
            mappedFo.nome_campanha = foData.Trabalho
          }
          transformedItem.folhas_obras = mappedFo
        }

        return transformedItem
      })

      console.log('Transformed items:', transformedItems.length)

      // Filter items that meet all conditions
      const filteredItems = transformedItems.filter((item) => {
        let hasLogisticaEntregasNotConcluida = false

        if (item.logistica_entregas) {
          if (Array.isArray(item.logistica_entregas)) {
            hasLogisticaEntregasNotConcluida = (item.logistica_entregas as any[]).some(
              (entrega: any) => entrega.concluido === false,
            )
    } else {
            hasLogisticaEntregasNotConcluida = (item.logistica_entregas as any).concluido === false
          }
        }

        const hasPaginacaoTrue = item.designer_items?.paginacao === true
        const isNotBrinde = item.brindes !== true
        const isNotOffset = item.complexidade !== 'OFFSET'

        // Require both FO and ORC values
        const foData = item.folhas_obras as any
        const hasFoValue =
          foData?.numero_fo &&
          foData?.numero_fo !== '0' &&
          foData?.numero_fo !== '0000'
        const hasOrcValue = foData?.numero_orc && foData?.numero_orc !== 0

        const includeItem =
          hasLogisticaEntregasNotConcluida && hasPaginacaoTrue && isNotBrinde && isNotOffset && hasFoValue && hasOrcValue

        return includeItem
      })

      console.log('After filtering:', filteredItems.length)

      // Filter out items that have completed operations (Corte or Impressao_Flexiveis)
      const itemsWithoutCompleted = []
      for (const item of filteredItems) {
        const { data: operations, error: opError } = await supabase
          .from('producao_operacoes')
          .select('concluido')
          .eq('item_id', item.id)
          .in('Tipo_Op', ['Corte', 'Impressao_Flexiveis'])

        if (!opError && operations) {
          const hasCompletedOperation = operations.some((op: any) => op.concluido === true)
          if (!hasCompletedOperation) {
            itemsWithoutCompleted.push(item)
          }
    } else {
          // If no operations exist, include the item
          itemsWithoutCompleted.push(item)
        }
      }

      console.log('Items without completed operations:', itemsWithoutCompleted.length)
      setItems(itemsWithoutCompleted)
    } catch (error: any) {
      console.error('Error fetching data:', error)
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred'
      setError(`Failed to load production items: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Debug function
  const runDebugCheck = useCallback(async () => {
    console.log('Running debug check...')
    const debug: any = {}

    try {
      const tables = ['items_base', 'folhas_obras', 'designer_items', 'logistica_entregas']

      for (const table of tables) {
        try {
          const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })

          if (error) {
            debug[table] = { error: error.message, accessible: false }
      } else {
            debug[table] = { accessible: true, count: count || 0 }
      }
    } catch (err: any) {
          debug[table] = { error: err.message, accessible: false }
        }
      }

      // Check authentication
      const {
        data: { user },
      } = await supabase.auth.getUser()
      debug.authenticated = !!user
      debug.user_id = user?.id || 'Not authenticated'

      setDebugInfo(debug)
      setShowDebug(true)
    } catch (err: any) {
      console.error('Debug check failed:', err)
      setDebugInfo({ general_error: err.message })
      setShowDebug(true)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const foMatch = !foFilter || item.folhas_obras?.numero_fo?.toLowerCase().includes(foFilter.toLowerCase())
      const itemMatch = !itemFilter || item.descricao?.toLowerCase().includes(itemFilter.toLowerCase())

      return foMatch && itemMatch
    })
  }, [items, foFilter, itemFilter])

  // Sort items
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      let aVal: any, bVal: any

      switch (sortCol) {
        case 'numero_fo':
          aVal = a.folhas_obras?.numero_fo || ''
          bVal = b.folhas_obras?.numero_fo || ''
          break
        case 'nome_campanha':
          aVal = a.folhas_obras?.nome_campanha || ''
          bVal = b.folhas_obras?.nome_campanha || ''
          break
        case 'descricao':
          aVal = a.descricao || ''
          bVal = b.descricao || ''
          break
        case 'quantidade':
          aVal = a.quantidade || 0
          bVal = b.quantidade || 0
          break
        case 'prioridade':
          // Priority is set on Job level (folhas_obras), not item level
          aVal = a.folhas_obras?.prioridade || false
          bVal = b.folhas_obras?.prioridade || false
          break
        default:
          aVal = a.id
          bVal = b.id
      }

      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      } else {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
    })

    return sorted
  }, [filteredItems, sortCol, sortDir])

  if (loading && items.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">A carregar items de produção...</p>
        </div>
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="w-full space-y-6">
        <h1 className="text-2xl font-bold">Operações de Produção</h1>
        <div className="border border-destructive bg-destructive/10 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-destructive">Erro ao carregar dados</h3>
                <p className="mt-1 text-destructive">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData}>
            <RotateCw className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
            </div>
            <Button variant="outline" size="sm" onClick={runDebugCheck}>
              <Settings className="mr-2 h-4 w-4" />
              Diagnóstico
            </Button>
            {showDebug && debugInfo && (
              <div className="mt-4 border border-border bg-muted p-4">
                <h4 className="mb-2 font-semibold text-foreground">Informação de Diagnóstico:</h4>
                <pre className="max-h-60 overflow-auto text-xs text-muted-foreground">{JSON.stringify(debugInfo, null, 2)}</pre>
                <Button variant="ghost" size="sm" onClick={() => setShowDebug(false)} className="mt-2">
                  Fechar Diagnóstico
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!loading && items.length === 0 && !error) {
  return (
      <div className="w-full space-y-6">
        <h1 className="text-2xl font-bold">Operações de Produção</h1>
        <div className="flex gap-4 text-sm">
          <span>Total: 0</span>
        </div>
        <div className="border border-border bg-muted p-6">
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Nenhum item pronto para produção</h3>
              <p className="mt-2 text-muted-foreground">Não foram encontrados itens que atendam aos critérios necessários.</p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Para um item aparecer aqui, deve ter:</strong>
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <strong>FO e ORC preenchidos</strong> (numero_fo e numero_orc válidos)
                </li>
                <li>
                  <strong>Paginação concluída</strong> (designer_items.paginacao = true)
                </li>
                <li>
                  <strong>Entregas não concluídas</strong> (logistica_entregas.concluido = false)
                </li>
                <li>
                  <strong>Não ser brinde</strong> (brindes &ne; true)
                </li>
                <li>
                  <strong>Complexidade não ser OFFSET</strong> (complexidade &ne; &apos;OFFSET&apos;)
                </li>
              </ul>
        </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={fetchData}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Atualizar Lista
          </Button>
              <Button variant="outline" onClick={runDebugCheck}>
                <Settings className="mr-2 h-4 w-4" />
                Diagnóstico
          </Button>
        </div>
      </div>
              </div>
        {showDebug && debugInfo && (
          <div className="mt-4 border border-border bg-muted p-4">
            <h4 className="mb-2 font-semibold text-foreground">Informação de Diagnóstico:</h4>
            <pre className="max-h-60 overflow-auto text-xs text-muted-foreground">{JSON.stringify(debugInfo, null, 2)}</pre>
            <Button variant="ghost" size="sm" onClick={() => setShowDebug(false)} className="mt-2">
              Fechar Diagnóstico
                  </Button>
              </div>
                )}
              </div>
    )
  }

  return (
    <div className="w-full space-y-6 p-6">
      <h1 className="text-2xl font-bold">Operações de Produção</h1>

      {/* Statistics */}
      <div className="flex gap-4 text-sm">
        <span>Total: {items.length}</span>
              </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Input placeholder="Filtrar FO" className="w-40" value={foFilter} onChange={(e) => setFoFilter(e.target.value)} />
        <Input placeholder="Filtrar Item" className="flex-1" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          setFoFilter('')
                          setItemFilter('')
                        }}
                      >
          <X className="h-4 w-4" />
                      </Button>
        <Button size="icon" variant="outline" onClick={fetchData} title="Refresh data">
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
          </div>

      {/* Main table */}
      <div className="bg-background w-full">
        <div className="w-full overflow-x-auto">
          <Table className="w-full border-0 [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
            <TableHeader>
                <TableRow>
                <TableHead
                  onClick={() => toggleSort('numero_fo')}
                  className="sticky top-0 z-10 w-[120px] cursor-pointer border-b uppercase select-none"
                >
                  FO{' '}
                  {sortCol === 'numero_fo' &&
                    (sortDir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />)}
                  </TableHead>
                <TableHead
                  onClick={() => toggleSort('nome_campanha')}
                  className="sticky top-0 z-10 cursor-pointer border-b uppercase select-none"
                >
                  Campanha{' '}
                  {sortCol === 'nome_campanha' &&
                    (sortDir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />)}
                  </TableHead>
                <TableHead
                  onClick={() => toggleSort('descricao')}
                  className="sticky top-0 z-10 cursor-pointer border-b uppercase select-none"
                >
                  Item{' '}
                  {sortCol === 'descricao' &&
                    (sortDir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />)}
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('quantidade')}
                  className="sticky top-0 z-10 w-[100px] cursor-pointer border-b text-right uppercase select-none"
                >
                  Quantidade{' '}
                  {sortCol === 'quantidade' &&
                    (sortDir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />)}
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('prioridade')}
                  className="sticky top-0 z-10 w-[36px] min-w-[36px] cursor-pointer border-b uppercase select-none"
                >
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                        <span>
                          P{' '}
                          {sortCol === 'prioridade' &&
                            (sortDir === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />)}
                        </span>
                              </TooltipTrigger>
                      <TooltipContent>Prioridade</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                </TableHead>
                <TableHead className="w-[100px] border-b p-2 text-sm uppercase">
                  Ações
                </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {sortedItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-accent transition-colors">
                  <TableCell className="w-[120px]">{item.folhas_obras?.numero_fo}</TableCell>
                  <TableCell>{item.folhas_obras?.nome_campanha}</TableCell>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell className="w-[100px] text-right">{item.quantidade}</TableCell>
                  <TableCell className="w-[36px] min-w-[36px] text-center">
                    <div
                      className={`mx-auto flex h-3 w-3 items-center justify-center rounded-full ${getPColor(item)}`}
                      title={item.prioridade ? 'Prioritário' : 'Normal'}
                    />
                    </TableCell>
                  <TableCell className="w-[100px]">
                    <Button size="icon" variant="default" onClick={() => setOpenItemId(item.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                      </TableCell>
                    </TableRow>
              ))}
              {sortedItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    Nenhum item encontrado.
                  </TableCell>
                </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
      </div>

      {/* Drawer - Will add operations management here */}
      <Drawer open={!!openItemId} onOpenChange={(open) => !open && setOpenItemId(null)} shouldScaleBackground={false}>
        <DrawerContent className="!top-0 h-[98vh] max-h-[98vh] min-h-[98vh] !transform-none overflow-y-auto">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Operações de Produção</DrawerTitle>
            <DrawerDescription>Gestão de operações de impressão e corte</DrawerDescription>
          </DrawerHeader>
          {openItemId && (
            <ItemDrawerContent
              itemId={openItemId}
              items={items}
              onClose={() => setOpenItemId(null)}
              supabase={supabase}
              onMainRefresh={fetchData}
            />
          )}
        </DrawerContent>
      </Drawer>
              </div>
  )
}

// Drawer content component
interface ItemDrawerProps {
  itemId: string
  items: ProductionItem[]
  onClose: () => void
  supabase: any
  onMainRefresh: () => void
}

function ItemDrawerContent({ itemId, items, onClose, supabase, onMainRefresh }: ItemDrawerProps) {
  const item = items.find((i) => i.id === itemId)
  const [operations, setOperations] = useState<ProductionOperation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOperations = useCallback(async () => {
    if (!item) return

    setLoading(true)
    try {
      const { data: operationsData, error } = await supabase
        .from('producao_operacoes')
        .select('*')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false})

      if (error) {
        console.error('Error fetching operations:', error)
      } else {
        setOperations(operationsData || [])
      }
    } catch (error) {
      console.error('Error fetching operations:', error)
    } finally {
      setLoading(false)
    }
  }, [item, supabase])

  useEffect(() => {
    fetchOperations()
  }, [fetchOperations])

  if (!item) return null

  const impressaoOperations = operations.filter((op) => op.Tipo_Op === 'Impressao')
  const impressaoFlexiveisOperations = operations.filter((op) => op.Tipo_Op === 'Impressao_Flexiveis')
  const corteOperations = operations.filter((op) => op.Tipo_Op === 'Corte')

  return (
    <div className="relative space-y-6 p-6">
      {/* Close button and Quantity */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs font-bold uppercase">Quantidade</div>
          <div className="font-mono text-lg">{item.quantidade}</div>
              </div>
        <Button size="icon" variant="outline" onClick={onClose}>
          <X className="h-4 w-4" />
                  </Button>
              </div>

      {/* Item info */}
      <div className="mb-6 p-4 uppercase">
        <div className="mb-2 flex items-center gap-8">
          <div>
            <div className="text-xs font-bold">FO</div>
            <div className="font-mono">{item.folhas_obras?.numero_fo}</div>
              </div>
          <div className="flex-1">
            <div className="text-xs font-bold">Campanha</div>
            <div className="truncate font-mono">{item.folhas_obras?.nome_campanha}</div>
              </div>
            </div>
        <div>
          <div className="text-xs font-bold">Item</div>
          <div className="font-mono">{item.descricao}</div>
          </div>
                        </div>

      {/* Tabs for different operation types */}
      <Tabs defaultValue="impressao" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="impressao">Impressão ({impressaoOperations.length})</TabsTrigger>
          <TabsTrigger value="impressao_flexiveis">Impressão Flexíveis ({impressaoFlexiveisOperations.length})</TabsTrigger>
          <TabsTrigger value="corte">Corte ({corteOperations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="impressao">
          <OperationsTable
            operations={impressaoOperations}
            type="Impressao"
            itemId={item.id}
            folhaObraId={item.folha_obra_id}
            item={item}
            supabase={supabase}
            onRefresh={fetchOperations}
            onMainRefresh={onMainRefresh}
          />
        </TabsContent>

        <TabsContent value="impressao_flexiveis">
          <OperationsTable
            operations={impressaoFlexiveisOperations}
            type="Impressao_Flexiveis"
            itemId={item.id}
            folhaObraId={item.folha_obra_id}
            item={item}
            supabase={supabase}
            onRefresh={fetchOperations}
            onMainRefresh={onMainRefresh}
          />
        </TabsContent>

        <TabsContent value="corte">
          <OperationsTable
            operations={corteOperations}
            type="Corte"
            itemId={item.id}
            folhaObraId={item.folha_obra_id}
            item={item}
            supabase={supabase}
            onRefresh={fetchOperations}
            onMainRefresh={onMainRefresh}
          />
        </TabsContent>
      </Tabs>
              </div>
  )
}

// Operations Table Component
interface OperationsTableProps {
  operations: ProductionOperation[]
  type: 'Impressao' | 'Impressao_Flexiveis' | 'Corte'
  itemId: string
  folhaObraId: string
  item: ProductionItem
  supabase: any
  onRefresh: () => void
  onMainRefresh: () => void
}

function OperationsTable({
  operations,
  type,
  itemId,
  folhaObraId,
  item,
  supabase,
  onRefresh,
  onMainRefresh,
}: OperationsTableProps) {
  const { operators, machines } = useTableData()
  const { materialOptions, getCaracteristicaOptions, getCorOptions, getMaterialId, materialsData } = useMaterialsCascading()

  const [materialSelections, setMaterialSelections] = useState<{
    [operationId: string]: { material?: string; carateristica?: string; cor?: string }
  }>({})
  const [paletteSelections, setPaletteSelections] = useState<{
    [operationId: string]: string
  }>({})
  const [paletes, setPaletes] = useState<any[]>([])
  const [paletesLoading, setPaletesLoading] = useState(false)

  // Fetch paletes
  useEffect(() => {
    const fetchPaletes = async () => {
      setPaletesLoading(true)
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
      } finally {
        setPaletesLoading(false)
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

  const handleFieldChange = async (operationId: string, field: string, value: any) => {
                        try {
                          // Get old value first for audit
                          const operation = operations.find(op => op.id === operationId)
                          const oldValue = operation ? (operation as any)[field] : null
                          
                          const { error } = await supabase
        .from('producao_operacoes')
        .update({ [field]: value })
        .eq('id', operationId)
                          
                          if (error) throw error
                          
                          // LOG AUDIT: Field change
                          await logFieldUpdate(supabase, operationId, field, oldValue, value)
                          
      onRefresh()
    } catch (err) {
      console.error('Error updating operation:', err)
      alert('Erro ao atualizar operação')
    }
  }

  const handleAddOperation = async () => {
    try {
      // Generate no_interno auto-number
      const now = new Date()
      const dateStr = format(now, 'yyyyMMdd')
      const timeStr = format(now, 'HHmmss')
      const foShort = item.folhas_obras?.numero_fo?.substring(0, 6) || 'FO'
      const typePrefix = type === 'Impressao' ? 'IMP' : type === 'Impressao_Flexiveis' ? 'FLX' : 'CRT'
      const no_interno = `${foShort}-${dateStr}-${typePrefix}-${timeStr}`
      
      const operationData = {
        item_id: itemId,
        folha_obra_id: folhaObraId,
        Tipo_Op: type,
        data_operacao: new Date().toISOString().split('T')[0],
        no_interno,
        num_placas_print: 0,
        num_placas_corte: 0,
        concluido: false,
      }
      
      const { data: savedOperation, error } = await supabase
        .from('producao_operacoes')
        .insert([operationData])
        .select()
        .single()

      if (error) throw error

      // LOG AUDIT: Operation creation
      await logOperationCreation(supabase, savedOperation.id, operationData)

      onRefresh()
    } catch (err) {
      console.error('Error adding operation:', err)
      alert('Erro ao adicionar operação')
    }
  }

  const handleDeleteOperation = async (operationId: string) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta operação?')) return

    try {
      // Get operation details before deleting for audit log
      const operation = operations.find(op => op.id === operationId)
      
      const { error } = await supabase.from('producao_operacoes').delete().eq('id', operationId)

      if (error) throw error

      // LOG AUDIT: Operation deletion
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

  const handleComplete = async (operationId: string, currentValue: boolean) => {
                        try {
                          const newValue = !currentValue
                          
                          const { error } = await supabase
        .from('producao_operacoes')
        .update({
          concluido: newValue,
          data_conclusao: newValue ? new Date().toISOString() : null,
        })
        .eq('id', operationId)
                          
                          if (error) throw error
                          
                          // LOG AUDIT: Completion status change
                          await logFieldUpdate(supabase, operationId, 'concluido', currentValue, newValue)
                          
      onRefresh()
      onMainRefresh()
    } catch (err) {
      console.error('Error updating completion:', err)
      alert('Erro ao atualizar conclusão')
    }
  }

  const handlePaletteSelection = async (operationId: string, paletteId: string) => {
    // If empty value is selected, clear palette and enable material dropdowns
    if (!paletteId) {
      setPaletteSelections((prev) => ({
        ...prev,
        [operationId]: '',
      }))

      // Clear material selections to allow manual input
      setMaterialSelections((prev) => ({
        ...prev,
        [operationId]: {
          material: undefined,
          carateristica: undefined,
          cor: undefined,
        },
      }))

      // Clear palette and material from operation
      await handleFieldChange(operationId, 'N_Pal', '')
      await handleFieldChange(operationId, 'material_id', null)
      return
    }

    // Find the selected palette
    const selectedPalette = paletes.find((p) => p.id === paletteId)
    
    if (!selectedPalette) {
      return
    }

    // Update palette selection in local state immediately
    setPaletteSelections((prev) => ({
      ...prev,
      [operationId]: paletteId,
    }))

    // Save palette number to database
    await handleFieldChange(operationId, 'N_Pal', selectedPalette.no_palete)

    // If the palette has a reference, also update material
    if (selectedPalette.ref_cartao) {
      const matchingMaterial = materialsData.find(
        (m) => m.referencia === selectedPalette.ref_cartao
      )

      if (matchingMaterial) {
        // Update material_id in database
        await handleFieldChange(operationId, 'material_id', matchingMaterial.id)

        // Update material selections immediately for UI display (normalized to uppercase)
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
    setMaterialSelections((prev) => {
      const current = prev[operationId] || {}

      if (field === 'material') {
        const newSelection = { material: value, carateristica: undefined, cor: undefined }
        const materialId = getMaterialId(value)
        handleFieldChange(operationId, 'material_id', materialId)
        return { ...prev, [operationId]: newSelection }
      }

      if (field === 'carateristica') {
        const newSelection = { ...current, carateristica: value, cor: undefined }
        const materialId = getMaterialId(current.material, value)
        handleFieldChange(operationId, 'material_id', materialId)
        return { ...prev, [operationId]: newSelection }
      }

      if (field === 'cor') {
        const newSelection = { ...current, cor: value }
        const materialId = getMaterialId(current.material, current.carateristica, value)
        handleFieldChange(operationId, 'material_id', materialId)
        return { ...prev, [operationId]: newSelection }
      }

      return prev
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">Operações de {type.replace('_', ' ')}</h3>
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
              <TableHead className="w-[80px]">Print</TableHead>
              <TableHead className="w-[80px]">Corte</TableHead>
              <TableHead className="w-[50px]">Notas</TableHead>
              <TableHead className="w-[80px]">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">C</span>
                    </TooltipTrigger>
                    <TooltipContent>Concluído</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  Nenhuma operação. Clique em &quot;Adicionar&quot; para criar.
                </TableCell>
              </TableRow>
            ) : (
              operations.map((op) => {
                const selection = materialSelections[op.id] || {}
                return (
                  <TableRow key={op.id}>
                    <TableCell>
                      <DatePicker
                        selected={op.data_operacao ? new Date(op.data_operacao) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            handleFieldChange(op.id, 'data_operacao', format(date, 'yyyy-MM-dd'))
                          }
                        }}
                        placeholder="Data"
                        buttonClassName="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={op.operador_id || ''} onValueChange={(v) => handleFieldChange(op.id, 'operador_id', v)}>
                        <SelectTrigger className="w-full">
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
                      <Select value={op.maquina || ''} onValueChange={(v) => handleFieldChange(op.id, 'maquina', v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Máquina" />
                        </SelectTrigger>
                        <SelectContent>
                          {machines.map((opt) => (
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
                          ...paletes.map((palete) => ({
                            value: palete.id,
                            label: palete.no_palete,
                          })),
                        ]}
                        value={paletteSelections[op.id] || ''}
                        onChange={(value: string) => handlePaletteSelection(op.id, value)}
                        placeholder="Selecionar palete"
                        emptyMessage="Nenhum palete encontrado"
                        searchPlaceholder="Procurar palete..."
                        disabled={paletesLoading}
                        className="h-10 w-full"
                        buttonClassName="uppercase truncate"
                      />
                    </TableCell>
                    <TableCell>
                <Select
                        value={selection.material || ''}
                        onValueChange={(v) => handleMaterialChange(op.id, 'material', v)}
                        disabled={isMaterialFromPalette(op.id)}
                >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Material" />
                  </SelectTrigger>
                  <SelectContent>
                          {materialOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                    </TableCell>
                    <TableCell>
                <Select
                        value={selection.carateristica || ''}
                        onValueChange={(v) => handleMaterialChange(op.id, 'carateristica', v)}
                        disabled={!selection.material || isMaterialFromPalette(op.id)}
                >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Car." />
                  </SelectTrigger>
                  <SelectContent>
                          {getCaracteristicaOptions(selection.material).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                    </TableCell>
                    <TableCell>
                <Select
                        value={selection.cor || ''}
                        onValueChange={(v) => handleMaterialChange(op.id, 'cor', v)}
                        disabled={!selection.material || isMaterialFromPalette(op.id)}
                >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Cor" />
                  </SelectTrigger>
                  <SelectContent>
                          {getCorOptions(selection.material, selection.carateristica).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                    </TableCell>
                    <TableCell>
                  <Input
                    type="number"
                        value={op.num_placas_print || 0}
                        onChange={(e) => handleFieldChange(op.id, 'num_placas_print', parseInt(e.target.value) || 0)}
                        className="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                    </TableCell>
                    <TableCell>
                  <Input
                    type="number"
                        value={op.num_placas_corte || 0}
                        onChange={(e) => handleFieldChange(op.id, 'num_placas_corte', parseInt(e.target.value) || 0)}
                        className="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </TableCell>
                    <TableCell>
                      <SimpleNotasPopover
                        value={op.observacoes || ''}
                        onSave={(value) => handleFieldChange(op.id, 'observacoes', value)}
                        placeholder="Notas..."
                        label="Notas"
                        buttonSize="icon"
                      />
                    </TableCell>
                    <TableCell>
                  <Checkbox
                        checked={op.concluido || false}
                        onCheckedChange={() => handleComplete(op.id, op.concluido || false)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleDeleteOperation(op.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Eliminar</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
                </div>
              </div>
  )
}

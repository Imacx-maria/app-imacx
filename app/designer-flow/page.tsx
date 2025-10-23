'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
  Loader2,
  RotateCw,
  XSquare,
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate } from '@/utils/date'
import CreatableDesignerCombobox from '@/components/forms/CreatableDesignerCombobox'
import { ViewButton } from '@/components/ui/action-buttons'
import DesignerItemCard from '@/components/DesignerItemCard'
import { ComplexidadeCombobox } from '@/components/ui/ComplexidadeCombobox'
import { useComplexidades } from '@/hooks/useComplexidades'
import type { Job, Item, Designer, UpdateItemParams } from './types'

// Priority color mapping
const PRIORITY_COLORS = {
  red: 'bg-destructive',
  blue: 'bg-info',
  green: 'bg-success',
} as const

type PriorityColor = keyof typeof PRIORITY_COLORS

// Helper to determine priority color
const getPriorityColor = (job: Job): PriorityColor => {
  // Explicit priority field takes precedence
  if (job.prioridade === true) return 'red'
  if (job.prioridade === false) return 'blue'
  
  // Fallback to green
  return 'green'
}

// Helper to parse numeric fields for sorting
const parseNumericField = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  const strValue = String(value).trim()
  if (strValue === '') return 0
  const numValue = Number(strValue)
  return !isNaN(numValue) ? numValue : 999999 + strValue.charCodeAt(0)
}

// Fetch jobs based on filters and tab
const fetchJobs = async (
  supabase: any,
  foFilter: string,
  campaignFilter: string,
  itemFilter: string,
  codigoFilter: string,
  activeTab: 'aberto' | 'paginados',
): Promise<Job[]> => {
  try {
    let jobIds: string[] | null = null

    // STEP 1: Handle item/codigo filtering first
    const hasItemFilters = !!(itemFilter?.trim() || codigoFilter?.trim())

    if (hasItemFilters) {
      let itemQuery = supabase.from('items_base').select('folha_obra_id')

      if (itemFilter?.trim()) {
        itemQuery = itemQuery.ilike('descricao', `%${itemFilter.trim()}%`)
      }
      if (codigoFilter?.trim()) {
        itemQuery = itemQuery.ilike('codigo', `%${codigoFilter.trim()}%`)
      }

      const { data: itemData, error: itemError } = await itemQuery

      if (itemError) {
        console.error('Error searching items:', itemError)
        return []
      }

      if (itemData && itemData.length > 0) {
        jobIds = Array.from(new Set(itemData.map((item: any) => item.folha_obra_id)))
      } else {
        return []
      }
    }

    // STEP 2: Build main jobs query
    const columns = 'id, created_at, numero_fo, numero_orc, nome_campanha, data_saida, prioridade'

    let query = supabase
      .from('folhas_obras_with_dias')
      .select(columns)
      .not('numero_fo', 'is', null)
      .not('numero_orc', 'is', null)

    if (jobIds) {
      query = query.in('id', jobIds)
    }

    if (foFilter?.trim()) {
      query = query.ilike('numero_fo', `%${foFilter.trim()}%`)
    }

    if (campaignFilter?.trim()) {
      query = query.ilike('nome_campanha', `%${campaignFilter.trim()}%`)
    }

    let { data: jobsData, error: jobsError } = await query.order('created_at', { ascending: false })

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      return []
    }

    if (!Array.isArray(jobsData)) {
      return []
    }

    // STEP 3: Apply tab filter (Em Aberto vs Paginados)
    if (activeTab === 'paginados' || activeTab === 'aberto') {
      const jobIdsToCheck = jobsData.map((job) => job.id)

      const { data: designerItems, error: designerError } = await supabase
        .from('designer_items')
        .select(
          `
          id,
          item_id,
          paginacao,
          items_base!inner (id, folha_obra_id)
        `,
        )
        .in('items_base.folha_obra_id', jobIdsToCheck)

      if (!designerError && Array.isArray(designerItems)) {
        const itemsByJob: Record<string, any[]> = {}

        designerItems.forEach((item: any) => {
          const base = Array.isArray(item.items_base) ? item.items_base[0] : item.items_base
          const jobId = base?.folha_obra_id

          if (jobId && item.id && base?.id) {
            if (!itemsByJob[jobId]) itemsByJob[jobId] = []
            itemsByJob[jobId].push(item)
          }
        })

        jobsData = jobsData.filter((job: Job) => {
          const jobItems = itemsByJob[job.id] || []
          const itemCount = jobItems.length
          const completedItems = jobItems.filter((item) => !!item.paginacao).length
          const allCompleted = itemCount > 0 && completedItems === itemCount

          if (activeTab === 'paginados') {
            return itemCount > 0 && allCompleted
          } else {
            return itemCount === 0 || !allCompleted
          }
        })
      }
    }

    return jobsData
  } catch (error) {
    console.error('Error in fetchJobs:', error)
    return []
  }
}

// Fetch all items for selected jobs
const fetchItems = async (supabase: any, jobIds: string[]): Promise<Item[]> => {
  if (jobIds.length === 0) return []

  try {
    const { data, error } = await supabase
      .from('designer_items')
      .select(
        `
        id,
        item_id,
        em_curso,
        duvidas,
        maquete_enviada1,
        aprovacao_recebida1,
        maquete_enviada2,
        aprovacao_recebida2,
        maquete_enviada3,
        aprovacao_recebida3,
        maquete_enviada4,
        aprovacao_recebida4,
        maquete_enviada5,
        aprovacao_recebida5,
        maquete_enviada6,
        aprovacao_recebida6,
        paginacao,
        complexidade,
        notas,
        R1,
        R2,
        R3,
        R4,
        R5,
        R6,
        data_em_curso,
        data_duvidas,
        data_maquete_enviada1,
        data_aprovacao_recebida1,
        data_maquete_enviada2,
        data_aprovacao_recebida2,
        data_maquete_enviada3,
        data_aprovacao_recebida3,
        data_maquete_enviada4,
        data_aprovacao_recebida4,
        data_maquete_enviada5,
        data_aprovacao_recebida5,
        data_maquete_enviada6,
        data_aprovacao_recebida6,
        data_paginacao,
        data_saida,
        data_in,
        R1_date,
        R2_date,
        R3_date,
        R4_date,
        R5_date,
        R6_date,
        path_trabalho,
        updated_at,
        items_base!inner (
          id,
          folha_obra_id,
          descricao,
          codigo,
          quantidade
        )
      `,
      )
      .in('items_base.folha_obra_id', jobIds)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching items:', error)
      return []
    }

    if (!Array.isArray(data)) return []

    return data
      .map((d: any) => {
        const base = Array.isArray(d.items_base) ? d.items_base[0] : d.items_base

        if (!base || !base.id || !base.folha_obra_id) return null

        return {
          designer_item_id: d.id,
          id: base.id,
          folha_obra_id: base.folha_obra_id,
          descricao: base.descricao ?? '',
          codigo: base.codigo ?? null,
          quantidade: base.quantidade ?? null,
          em_curso: d.em_curso,
          duvidas: d.duvidas,
          maquete_enviada1: d.maquete_enviada1,
          aprovacao_recebida1: d.aprovacao_recebida1,
          maquete_enviada2: d.maquete_enviada2,
          aprovacao_recebida2: d.aprovacao_recebida2,
          maquete_enviada3: d.maquete_enviada3,
          aprovacao_recebida3: d.aprovacao_recebida3,
          maquete_enviada4: d.maquete_enviada4,
          aprovacao_recebida4: d.aprovacao_recebida4,
          maquete_enviada5: d.maquete_enviada5,
          aprovacao_recebida5: d.aprovacao_recebida5,
          maquete_enviada6: d.maquete_enviada6,
          aprovacao_recebida6: d.aprovacao_recebida6,
          paginacao: d.paginacao,
          complexidade: d.complexidade ?? null,
          notas: d.notas ?? null,
          r1: d.R1,
          r2: d.R2,
          r3: d.R3,
          r4: d.R4,
          r5: d.R5,
          r6: d.R6,
          data_em_curso: d.data_em_curso,
          data_duvidas: d.data_duvidas,
          data_maquete_enviada1: d.data_maquete_enviada1,
          data_aprovacao_recebida1: d.data_aprovacao_recebida1,
          data_maquete_enviada2: d.data_maquete_enviada2,
          data_aprovacao_recebida2: d.data_aprovacao_recebida2,
          data_maquete_enviada3: d.data_maquete_enviada3,
          data_aprovacao_recebida3: d.data_aprovacao_recebida3,
          data_maquete_enviada4: d.data_maquete_enviada4,
          data_aprovacao_recebida4: d.data_aprovacao_recebida4,
          data_maquete_enviada5: d.data_maquete_enviada5,
          data_aprovacao_recebida5: d.data_aprovacao_recebida5,
          data_maquete_enviada6: d.data_maquete_enviada6,
          data_aprovacao_recebida6: d.data_aprovacao_recebida6,
          data_paginacao: d.data_paginacao,
          data_saida: d.data_saida,
          data_in: d.data_in,
          R1_date: d.R1_date,
          R2_date: d.R2_date,
          R3_date: d.R3_date,
          R4_date: d.R4_date,
          R5_date: d.R5_date,
          R6_date: d.R6_date,
          path_trabalho: d.path_trabalho,
          updated_at: d.updated_at,
        } as Item
      })
      .filter(Boolean) as Item[]
  } catch (error) {
    console.error('Error in fetchItems:', error)
    return []
  }
}

// Priority Indicator Component - Read-only display (priority is set on Produção page)
interface PriorityIndicatorProps {
  currentPriority: PriorityColor
}

const PriorityIndicator = ({ currentPriority }: PriorityIndicatorProps) => {
  const getTitle = () => {
    if (currentPriority === 'red') return 'Prioritário'
    if (currentPriority === 'blue') return 'Atenção'
    return 'Normal'
  }

  return (
    <div
      className={`mx-auto flex h-3 w-3 items-center justify-center rounded-full ${PRIORITY_COLORS[currentPriority]}`}
      title={getTitle()}
    />
  )
}

// Designer Selector Component - Fetches and saves to designer_items table
interface DesignerSelectorProps {
  jobId: string
  supabase: any
}

const DesignerSelector = ({ jobId, supabase }: DesignerSelectorProps) => {
  const [designerId, setDesignerId] = useState('')
  const [loading, setLoading] = useState(true)

  // Fetch designer from designer_items on mount
  useEffect(() => {
    const fetchDesigner = async () => {
      try {
        // Get all designer_items for this job
        const { data, error } = await supabase
          .from('designer_items')
          .select('designer, items_base!inner(folha_obra_id)')
          .eq('items_base.folha_obra_id', jobId)
          .limit(1)
          .single()

        if (!error && data?.designer) {
          setDesignerId(data.designer)
        }
      } catch (error) {
        // No designer assigned yet, that's ok
      } finally {
        setLoading(false)
      }
    }

    fetchDesigner()
  }, [jobId, supabase])

  const handleChange = async (newDesignerId: string) => {
    setDesignerId(newDesignerId)
    
    try {
      // Update all designer_items for this job
      const { data: itemsData } = await supabase
        .from('designer_items')
        .select('id, items_base!inner(folha_obra_id)')
        .eq('items_base.folha_obra_id', jobId)

      if (itemsData && itemsData.length > 0) {
        const updates = itemsData.map((item: any) =>
          supabase
            .from('designer_items')
            .update({ designer: newDesignerId || null })
            .eq('id', item.id)
        )

        await Promise.all(updates)
      }
    } catch (error) {
      console.error('Error updating designer:', error)
    }
  }

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading...</div>
  }

  return (
    <CreatableDesignerCombobox
      value={designerId}
      onChange={handleChange}
      placeholder="Select designer..."
      className="min-w-[180px]"
      showLabel={false}
    />
  )
}

export default function DesignerFlow() {
  const supabase = createBrowserClient()
  const [activeTab, setActiveTab] = useState<'aberto' | 'paginados'>('aberto')
  const [foFilter, setFoFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [codigoFilter, setCodigoFilter] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [allItems, setAllItems] = useState<Item[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [sortColumn, setSortColumn] = useState<string>('prioridade')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [loading, setLoading] = useState(false)
  const [openItemId, setOpenItemId] = useState<string | null>(null)

  // Pagination state for main jobs table
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 40

  // Complexidade hook
  const { complexidades, isLoading: isLoadingComplexidades } = useComplexidades()

  // Debounce filters
  const debouncedFoFilter = useDebounce(foFilter, 300)
  const debouncedCampaignFilter = useDebounce(campaignFilter, 300)
  const debouncedItemFilter = useDebounce(itemFilter, 300)
  const debouncedCodigoFilter = useDebounce(codigoFilter, 300)

  // Load jobs on filter change
  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true)
      const jobsData = await fetchJobs(
        supabase,
        debouncedFoFilter,
        debouncedCampaignFilter,
        debouncedItemFilter,
        debouncedCodigoFilter,
        activeTab,
      )
      setJobs(jobsData)
      setSelectedJob(null)
      setLoading(false)
    }

    loadJobs()
  }, [debouncedFoFilter, debouncedCampaignFilter, debouncedItemFilter, debouncedCodigoFilter, activeTab, supabase])

  // Load items when job is selected
  useEffect(() => {
    const loadItems = async () => {
      if (selectedJob) {
        const itemsData = await fetchItems(supabase, [selectedJob.id])
        setAllItems(itemsData)
      }
    }

    loadItems()
  }, [selectedJob, supabase])

  // Get items for selected job
  const jobItems = useMemo(() => {
    if (!selectedJob) return []
    return allItems.filter((item) => item.folha_obra_id === selectedJob.id)
  }, [selectedJob, allItems])

  // Sort jobs
  const sortedJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      let aVal: any = a[sortColumn as keyof Job]
      let bVal: any = b[sortColumn as keyof Job]

      if (sortColumn === 'prioridade') {
        const aPriority = a.prioridade ? 1 : 0
        const bPriority = b.prioridade ? 1 : 0
        return sortDirection === 'desc' ? bPriority - aPriority : aPriority - bPriority
      }

      if (sortColumn === 'numero_fo' || sortColumn === 'numero_orc') {
        aVal = parseNumericField(aVal)
        bVal = parseNumericField(bVal)
      } else if (sortColumn === 'created_at') {
        aVal = new Date(aVal as string).getTime()
        bVal = new Date(bVal as string).getTime()
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    return sorted
  }, [jobs, sortColumn, sortDirection])

  // Pagination calculations for main jobs table
  const totalPages = Math.ceil(sortedJobs.length / ITEMS_PER_PAGE)
  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedJobs.slice(startIndex, endIndex)
  }, [sortedJobs, currentPage, ITEMS_PER_PAGE])

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sortedJobs.length])

  // Handle sort click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  // Update item workflow state
  const updateItemWorkflow = useCallback(
    async (itemId: string, field: string, value: boolean) => {
      try {
        const { error } = await supabase
          .from('designer_items')
          .update({
            [field]: value,
            [`data_${field}`]: value ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)

        if (error) throw error

        // Update local state
        setAllItems((prev) =>
          prev.map((item) =>
            item.designer_item_id === itemId
              ? {
                  ...item,
                  [field]: value,
                  [`data_${field}`]: value ? new Date().toISOString() : null,
                }
              : item,
          ),
        )
      } catch (error) {
        console.error('Error updating workflow:', error)
      }
    },
    [supabase],
  )

  // Update item path
  const updateItemPath = useCallback(
    async (itemId: string, path: string) => {
      try {
        const { error} = await supabase
          .from('designer_items')
          .update({ path_trabalho: path, updated_at: new Date().toISOString() })
          .eq('id', itemId)

        if (error) throw error

        setAllItems((prev) =>
          prev.map((item) =>
            item.designer_item_id === itemId ? { ...item, path_trabalho: path } : item,
          ),
        )
      } catch (error) {
        console.error('Error updating path:', error)
      }
    },
    [supabase],
  )

  // Update item - generic handler for DesignerItemCard
  const handleItemUpdate = useCallback(
    async (params: UpdateItemParams) => {
      // Update local state immediately (optimistic UI)
      setAllItems((prev) =>
        prev.map((item) =>
          item.designer_item_id === params.designerItemId
            ? { ...item, ...params.updates }
            : item
        )
      )

      // Save to database
      try {
        const { error } = await supabase
          .from('designer_items')
          .update({
            ...params.updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.designerItemId)

        if (error) throw error
      } catch (error) {
        console.error('Error updating item:', error)
      }
    },
    [supabase]
  )

  // Handle descricao change
  const handleDescricaoChange = useCallback(
    async (itemId: string, value: string) => {
      try {
        await supabase
          .from('items_base')
          .update({ descricao: value })
          .eq('id', itemId)
      } catch (error) {
        console.error('Error updating descricao:', error)
      }
    },
    [supabase]
  )

  // Handle codigo change
  const handleCodigoChange = useCallback(
    async (itemId: string, value: string) => {
      try {
        await supabase
          .from('items_base')
          .update({ codigo: value })
          .eq('id', itemId)
      } catch (error) {
        console.error('Error updating codigo:', error)
      }
    },
    [supabase]
  )

  // Handle complexidade change - now saves to designer_items
  const handleComplexidadeChange = useCallback(
    async (itemId: string, grau: string | null) => {
      // This is now handled directly in DesignerItemCard
      // Kept for compatibility but does nothing
    },
    []
  )

  // Handle path dialog (placeholder - not implemented in current version)
  const handleOpenPathDialog = useCallback(
    (jobId: string, item: Item, index: number) => {
      console.log('Open path dialog for item:', item)
      // You can implement a path dialog here if needed
    },
    []
  )

  const SortHeader = ({ column, label }: { column: string; label: string }) => (
    <TableHead
      className="cursor-pointer select-none hover:opacity-80 bg-primary text-primary-foreground font-bold uppercase"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center justify-between gap-2">
        {label}
        {sortColumn === column && (
          <span>{sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</span>
        )}
      </div>
    </TableHead>
  )

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Designer Flow</h1>
        <p className="text-muted-foreground">Manage design workflow and task assignments</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="aberto">Em Aberto</TabsTrigger>
          <TabsTrigger value="paginados">Paginados</TabsTrigger>
        </TabsList>

        {(['aberto', 'paginados'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-6">
            {/* Filters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4 flex-1">
                  <div>
                    <Label htmlFor="fo-filter">FO Filter</Label>
                    <div className="relative">
                    <Input
                      id="fo-filter"
                      placeholder="Search by FO..."
                      value={foFilter}
                      onChange={(e) => setFoFilter(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                    />
                    {foFilter && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                        onClick={() => setFoFilter('')}
                        disabled={loading}
                      >
                        <XSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="campaign-filter">Campaign</Label>
                  <div className="relative">
                    <Input
                      id="campaign-filter"
                      placeholder="Search by campaign..."
                      value={campaignFilter}
                      onChange={(e) => setCampaignFilter(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                    />
                    {campaignFilter && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                        onClick={() => setCampaignFilter('')}
                        disabled={loading}
                      >
                        <XSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="item-filter">Item Description</Label>
                  <div className="relative">
                    <Input
                      id="item-filter"
                      placeholder="Search by description..."
                      value={itemFilter}
                      onChange={(e) => setItemFilter(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                    />
                    {itemFilter && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                        onClick={() => setItemFilter('')}
                        disabled={loading}
                      >
                        <XSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="codigo-filter">Code</Label>
                  <div className="relative">
                    <Input
                      id="codigo-filter"
                      placeholder="Search by code..."
                      value={codigoFilter}
                      onChange={(e) => setCodigoFilter(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                    />
                    {codigoFilter && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                        onClick={() => setCodigoFilter('')}
                        disabled={loading}
                      >
                        <XSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          className="bg-yellow-400 hover:bg-yellow-500 border border-black ml-2"
                          onClick={() => {
                            setFoFilter('')
                            setCampaignFilter('')
                            setItemFilter('')
                            setCodigoFilter('')
                          }}
                          disabled={!foFilter && !campaignFilter && !itemFilter && !codigoFilter || loading}
                        >
                          <XSquare className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Limpar Filtros</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Jobs Table */}
              <div className="rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="bg-primary text-primary-foreground font-bold uppercase w-16 text-center">P</TableHead>
                      <SortHeader column="numero_fo" label="FO" />
                      <SortHeader column="numero_orc" label="ORC" />
                      <SortHeader column="nome_campanha" label="CAMPAIGN" />
                      <TableHead className="bg-primary text-primary-foreground font-bold uppercase min-w-[200px]">DESIGNER</TableHead>
                      <SortHeader column="created_at" label="CREATED" />
                      <TableHead className="bg-primary text-primary-foreground font-bold uppercase w-24 text-center">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin" size={16} />
                            Loading...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No jobs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedJobs.map((job) => (
                        <TableRow
                          key={job.id}
                          className={selectedJob?.id === job.id ? 'bg-primary/10' : 'hover:bg-accent hover:text-accent-foreground dark:hover:text-accent-foreground'}
                        >
                          <TableCell className="text-center">
                            <PriorityIndicator currentPriority={getPriorityColor(job)} />
                          </TableCell>
                          <TableCell className="font-medium">{job.numero_fo}</TableCell>
                          <TableCell>{job.numero_orc}</TableCell>
                          <TableCell>{job.nome_campanha}</TableCell>
                          <TableCell className="min-w-[200px]">
                            <DesignerSelector 
                              jobId={job.id}
                              supabase={supabase}
                            />
                          </TableCell>
                          <TableCell>{formatDate(job.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <ViewButton onClick={() => setSelectedJob(job)} />
                                  </TooltipTrigger>
                                  <TooltipContent>View Items</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <div className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages} ({sortedJobs.length} items)
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="border border-black"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="border border-black"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Items Drawer */}
        <Drawer open={selectedJob !== null} onOpenChange={(open) => !open && setSelectedJob(null)}>
          <DrawerContent className="flex flex-col max-h-[85vh]">
            <DrawerHeader className="flex-shrink-0">
              <DrawerTitle>
                Design Items - FO {selectedJob?.numero_fo} / ORC {selectedJob?.numero_orc}
              </DrawerTitle>
              <DrawerDescription>{selectedJob?.nome_campanha}</DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3" style={{ minHeight: 0 }}>
              {jobItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Carregando itens...</div>
              ) : (
                jobItems.map((item, index) => (
                  <DesignerItemCard
                    key={item.designer_item_id || `item-${index}`}
                    item={item}
                    jobId={selectedJob!.id}
                    jobDataIn={selectedJob!.data_in}
                    index={index}
                    onUpdate={handleItemUpdate}
                    onDescricaoChange={handleDescricaoChange}
                    onCodigoChange={handleCodigoChange}
                    onOpenPathDialog={handleOpenPathDialog}
                    ComplexidadeCombobox={ComplexidadeCombobox}
                    complexidades={complexidades}
                    isLoadingComplexidades={isLoadingComplexidades}
                    onComplexidadeChange={handleComplexidadeChange}
                    isOpen={openItemId === item.designer_item_id}
                    onToggle={(open) => setOpenItemId(open ? item.designer_item_id : null)}
                  />
                ))
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
  )
}

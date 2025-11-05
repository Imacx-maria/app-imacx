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
import { getAColor } from '@/utils/producao/statusColors'

// Priority color mapping
const PRIORITY_COLORS = {
  red: 'bg-destructive',
  blue: 'bg-info',
  green: 'bg-success',
} as const

type PriorityColor = keyof typeof PRIORITY_COLORS

// Helper to determine priority color - MUST match main producao page logic exactly
// Note: prioridade field is controlled on main producao page
const getPriorityColor = (job: Job): PriorityColor => {
  // RED: Priority explicitly set on main page
  if (job.prioridade === true) return 'red'
  
  // BLUE: Jobs older than 3 days (uses same field as main page)
  // NOTE: Main page uses data_in, but since that field doesn't exist yet,
  // we temporarily use created_at until migration is run
  if (job.created_at) {
    const days = (Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 3) return 'blue'
  }
  
  // GREEN: Normal jobs (no priority, < 3 days old)
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
  orcFilter: string,
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

    // STEP 2: Build main jobs query - use folhas_obras table directly to get all columns including Nome and customer_id
    let query = supabase
      .from('folhas_obras')
      .select('id, created_at, Numero_do_, numero_orc, Trabalho, Data_efeti, prioridade, Nome, customer_id')
      .not('Numero_do_', 'is', null)
      .not('numero_orc', 'is', null)

    // Check if any filters are active
    const hasActiveFilters = foFilter?.trim() || orcFilter?.trim() || campaignFilter?.trim() || hasItemFilters

    // If no filters are active, only show last 12 months (extended from 4 months)
    if (!hasActiveFilters) {
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const twelveMonthsAgoISO = twelveMonthsAgo.toISOString()
      query = query.gte('created_at', twelveMonthsAgoISO)
    }

    if (jobIds) {
      query = query.in('id', jobIds)
    }

    if (foFilter?.trim()) {
      query = query.ilike('Numero_do_', `%${foFilter.trim()}%`)
    }

    if (orcFilter?.trim()) {
      query = query.ilike('numero_orc', `%${orcFilter.trim()}%`)
    }

    if (campaignFilter?.trim()) {
      query = query.ilike('Trabalho', `%${campaignFilter.trim()}%`)
    }

    let { data: jobsData, error: jobsError } = await query.order('created_at', { ascending: false })

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      return []
    }

    if (!Array.isArray(jobsData)) {
      return []
    }

    // Map database columns to Job interface, including cliente data
    const mappedJobs = jobsData.map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      numero_fo: row.Numero_do_ ? String(row.Numero_do_) : '',
      numero_orc: row.numero_orc ?? null,
      nome_campanha: row.Trabalho || '',
      data_saida: row.Data_efeti ?? null,
      prioridade: row.prioridade ?? false,
      cliente: row.Nome || '',
      id_cliente: row.customer_id ? row.customer_id.toString() : null,
      customer_id: row.customer_id || null,
    }))

    // STEP 2.5: Auto-update paginacao for items with concluido=true in logistica_entregas
    try {
      const jobIdsToCheck = mappedJobs.map((job) => job.id)

      if (jobIdsToCheck.length > 0) {
        // Get all items for these jobs
        const { data: itemsData } = await supabase
          .from('items_base')
          .select('id')
          .in('folha_obra_id', jobIdsToCheck)

        if (itemsData && itemsData.length > 0) {
          const itemIds = itemsData.map((i: any) => i.id)

          // Check for items with concluido=true in logistica_entregas
          const { data: logisticaItems } = await supabase
            .from('logistica_entregas')
            .select('item_id')
            .eq('concluido', true)
            .in('item_id', itemIds)

          if (logisticaItems && logisticaItems.length > 0) {
            const itemIdsWithConcluido = logisticaItems.map((l: any) => l.item_id)

            // Update designer_items for these items if not already paginacao=true
            const { data: designerItemsToUpdate } = await supabase
              .from('designer_items')
              .select('id, item_id, paginacao, data_paginacao')
              .in('item_id', itemIdsWithConcluido)
              .eq('paginacao', false)

            if (designerItemsToUpdate && designerItemsToUpdate.length > 0) {
              const today = new Date().toISOString().split('T')[0]
              const updates = designerItemsToUpdate.map((item: any) =>
                supabase
                  .from('designer_items')
                  .update({
                    paginacao: true,
                    path_trabalho: 'Indefinido',
                    data_paginacao: item.data_paginacao || today,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', item.id)
              )
              await Promise.all(updates)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error auto-updating paginacao from logistica:', error)
    }

    // STEP 3: Apply tab filter (Em Aberto vs Paginados)
    if (activeTab === 'paginados' || activeTab === 'aberto') {
      const jobIdsToCheck = mappedJobs.map((job) => job.id)

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

        const filteredMappedJobs = mappedJobs.filter((job: Job) => {
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
        return filteredMappedJobs
      }
    }

    return mappedJobs
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

        if (!error && data && data.length > 0 && data[0]?.designer) {
          setDesignerId(data[0].designer)
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
  const [orcFilter, setOrcFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [codigoFilter, setCodigoFilter] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [allItems, setAllItems] = useState<Item[]>([])
  const [allDesignerItems, setAllDesignerItems] = useState<any[]>([])
  const [jobDesigners, setJobDesigners] = useState<Record<string, string>>({}) // jobId -> designerId mapping
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [itemPlanos, setItemPlanos] = useState<Record<string, any[]>>({}) // itemId -> planos mapping
  type SortColumn = 'prioridade' | 'artwork' | 'numero_fo' | 'numero_orc' | 'nome_campanha' | 'designer' | 'created_at' | 'cliente'
  const [sortColumn, setSortColumn] = useState<SortColumn>('prioridade')
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
  const debouncedOrcFilter = useDebounce(orcFilter, 300)
  const debouncedCampaignFilter = useDebounce(campaignFilter, 300)
  const debouncedItemFilter = useDebounce(itemFilter, 300)
  const debouncedCodigoFilter = useDebounce(codigoFilter, 300)

  // Apply 3-character minimum filter requirement
  const effectiveFoFilter = debouncedFoFilter.trim().length >= 3 ? debouncedFoFilter : ''
  const effectiveOrcFilter = debouncedOrcFilter.trim().length >= 3 ? debouncedOrcFilter : ''
  const effectiveCampaignFilter = debouncedCampaignFilter.trim().length >= 3 ? debouncedCampaignFilter : ''
  const effectiveItemFilter = debouncedItemFilter.trim().length >= 3 ? debouncedItemFilter : ''
  const effectiveCodigoFilter = debouncedCodigoFilter.trim().length >= 3 ? debouncedCodigoFilter : ''

  // Load jobs on filter change
  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true)
      const jobsData = await fetchJobs(
        supabase,
        effectiveFoFilter,
        effectiveOrcFilter,
        effectiveCampaignFilter,
        effectiveItemFilter,
        effectiveCodigoFilter,
        activeTab,
      )
      setJobs(jobsData)
      setSelectedJob(null)
      setLoading(false)
    }

    loadJobs()
  }, [effectiveFoFilter, effectiveOrcFilter, effectiveCampaignFilter, effectiveItemFilter, effectiveCodigoFilter, activeTab, supabase])

  // Load all items and designer items for A column calculation
  useEffect(() => {
    const loadAllData = async () => {
      if (jobs.length === 0) return

      const jobIds = jobs.map(job => job.id)

      // Fetch all items
      const itemsData = await fetchItems(supabase, jobIds)
      setAllItems(itemsData)

      // Fetch all designer items with designer info
      try {
        const { data: designerData, error } = await supabase
          .from('designer_items')
          .select('id, item_id, paginacao, designer, items_base!inner(folha_obra_id)')
          .in('item_id', itemsData.map(item => item.id))

        if (!error && designerData) {
          setAllDesignerItems(designerData)

          // Build jobDesigners mapping
          const designersMap: Record<string, string> = {}
          designerData.forEach((item: any) => {
            const base = Array.isArray(item.items_base) ? item.items_base[0] : item.items_base
            if (base?.folha_obra_id && item.designer) {
              designersMap[base.folha_obra_id] = item.designer
            }
          })
          setJobDesigners(designersMap)
        }
      } catch (error) {
        console.error('Error fetching designer items:', error)
      }
    }

    loadAllData()
  }, [jobs, supabase])

  // No longer needed - items are loaded in the main useEffect above
  // This is kept for reference but can be removed if desired

  // Get items for selected job
  const jobItems = useMemo(() => {
    if (!selectedJob) return []
    return allItems.filter((item) => item.folha_obra_id === selectedJob.id)
  }, [selectedJob, allItems])

  // Fetch planos for job items when job is selected
  useEffect(() => {
    const fetchPlanosForJob = async () => {
      if (!selectedJob || jobItems.length === 0) return

      try {
        const itemIds = jobItems.map(item => item.id)

        const { data, error } = await supabase
          .from('designer_planos')
          .select('*')
          .in('item_id', itemIds)
          .order('item_id', { ascending: true })
          .order('plano_ordem', { ascending: true })

        if (!error && data) {
          // Group planos by item_id
          const planosByItem: Record<string, any[]> = {}
          data.forEach(plano => {
            if (!planosByItem[plano.item_id]) {
              planosByItem[plano.item_id] = []
            }
            planosByItem[plano.item_id].push(plano)
          })
          setItemPlanos(planosByItem)
        }
      } catch (error) {
        console.error('Error fetching planos:', error)
      }
    }

    fetchPlanosForJob()
  }, [selectedJob, jobItems, supabase])

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

      if (sortColumn === 'artwork') {
        // Sort by artwork completion status
        // Get color which represents completion: destructive (0), warning (1), success (2)
        const getArtworkValue = (jobId: string) => {
          const color = getAColor(jobId, allItems, allDesignerItems)
          if (color.includes('success')) return 2
          if (color.includes('warning')) return 1
          return 0 // destructive
        }
        aVal = getArtworkValue(a.id)
        bVal = getArtworkValue(b.id)
        return sortDirection === 'desc' ? bVal - aVal : aVal - bVal
      }

      if (sortColumn === 'designer') {
        // Sort by designer name
        aVal = jobDesigners[a.id] || ''
        bVal = jobDesigners[b.id] || ''
      } else if (sortColumn === 'cliente') {
        // Sort by cliente name
        aVal = a.cliente || ''
        bVal = b.cliente || ''
      } else if (sortColumn === 'numero_fo' || sortColumn === 'numero_orc') {
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
  }, [jobs, sortColumn, sortDirection, allItems, allDesignerItems, jobDesigners])

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
  const handleSort = (column: SortColumn) => {
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

  // Handle planos change - update local state when planos are added/edited/deleted
  const handlePlanosChange = useCallback(
    (itemId: string) => {
      return async (planos: any[]) => {
        setItemPlanos(prev => ({
          ...prev,
          [itemId]: planos
        }))
      }
    },
    []
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

  return (
    <div className="w-full space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Designer Flow</h1>
      </div>

      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="aberto">Em Aberto</TabsTrigger>
          <TabsTrigger value="paginados">Paginados</TabsTrigger>
        </TabsList>

        {(['aberto', 'paginados'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-6">
            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  placeholder="FO"
                  value={foFilter}
                  onChange={(e) => setFoFilter(e.target.value)}
                  disabled={loading}
                  className="h-10 w-[110px] rounded-none"
                  maxLength={6}
                  title="Mínimo 3 caracteres para filtrar"
                />
                <Input
                  placeholder="ORC"
                  value={orcFilter}
                  onChange={(e) => setOrcFilter(e.target.value)}
                  disabled={loading}
                  className="h-10 w-[110px] rounded-none"
                  maxLength={6}
                  title="Mínimo 3 caracteres para filtrar"
                />
                <Input
                  placeholder="Campanha"
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                  disabled={loading}
                  className="h-10 flex-1 rounded-none"
                  title="Mínimo 3 caracteres para filtrar"
                />
                <Input
                  placeholder="Item"
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value)}
                  disabled={loading}
                  className="h-10 flex-1 rounded-none"
                  title="Mínimo 3 caracteres para filtrar"
                />
                <Input
                  placeholder="Código"
                  value={codigoFilter}
                  onChange={(e) => setCodigoFilter(e.target.value)}
                  disabled={loading}
                  className="h-10 flex-1 rounded-none"
                  title="Mínimo 3 caracteres para filtrar"
                />

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                        onClick={() => {
                          setFoFilter('')
                          setOrcFilter('')
                          setCampaignFilter('')
                          setItemFilter('')
                          setCodigoFilter('')
                        }}
                        disabled={!foFilter && !orcFilter && !campaignFilter && !itemFilter && !codigoFilter}
                      >
                        <XSquare className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Limpar Filtros</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => {
                          const loadJobs = async () => {
                            setLoading(true)
                            const jobsData = await fetchJobs(
                              supabase,
                              effectiveFoFilter,
                              effectiveOrcFilter,
                              effectiveCampaignFilter,
                              effectiveItemFilter,
                              effectiveCodigoFilter,
                              activeTab,
                            )
                            setJobs(jobsData)
                            setLoading(false)
                          }
                          loadJobs()
                        }}
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Atualizar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Jobs Table */}
            <div className="w-full">
              <div className="w-full">
                <Table className="w-full imx-table-compact">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="sticky top-0 z-10 w-16 border-b text-center cursor-pointer select-none"
                        onClick={() => handleSort('prioridade')}
                      >
                        P
                        {sortColumn === 'prioridade' && (
                          sortDirection === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
                        )}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-10 border-b text-center cursor-pointer select-none"
                        onClick={() => handleSort('artwork')}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block">
                                A
                                {sortColumn === 'artwork' && (
                                  sortDirection === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Artes Finais</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[90px] cursor-pointer border-b select-none" onClick={() => handleSort('numero_fo')}>
                        FO
                        {sortColumn === 'numero_fo' && (
                          sortDirection === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
                        )}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[90px] cursor-pointer border-b select-none" onClick={() => handleSort('numero_orc')}>
                        ORC
                        {sortColumn === 'numero_orc' && (
                          sortDirection === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
                        )}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[180px] cursor-pointer border-b select-none" onClick={() => handleSort('cliente')}>
                        Cliente
                        {sortColumn === 'cliente' && (
                          sortDirection === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
                        )}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 cursor-pointer border-b select-none" onClick={() => handleSort('nome_campanha')}>
                        Campanha
                        {sortColumn === 'nome_campanha' && (
                          sortDirection === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
                        )}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 min-w-[200px] border-b cursor-pointer select-none"
                        onClick={() => handleSort('designer')}
                      >
                        Designer
                        {sortColumn === 'designer' && (
                          sortDirection === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
                        )}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none" onClick={() => handleSort('created_at')}>
                        Criado
                        {sortColumn === 'created_at' && (
                          sortDirection === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
                        )}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[90px] border-b text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin" size={16} />
                            A carregar...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedJobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-gray-500">
                          Nenhum trabalho encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedJobs.map((job) => (
                        <TableRow
                          key={job.id}
                          className={`${selectedJob?.id === job.id ? 'bg-accent' : ''} imx-row-hover`}
                        >
                          <TableCell className="text-center p-0">
                            <div
                              className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getPriorityColor(job) === 'red' ? 'bg-destructive' : getPriorityColor(job) === 'blue' ? 'bg-info' : 'bg-success'}`}
                              title={
                                job.prioridade
                                  ? 'Prioritário'
                                  : job.created_at &&
                                      (Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24) > 3
                                    ? 'Aguardando há mais de 3 dias'
                                    : 'Normal'
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center p-0">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <span
                                      className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getAColor(job.id, allItems, allDesignerItems)}`}
                                      title="Artes Finais"
                                    />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Artes Finais</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="font-medium w-[90px]">
                            {String(job.numero_fo).slice(0, 6)}
                          </TableCell>
                          <TableCell className="w-[90px]">
                            {job.numero_orc ? String(job.numero_orc).slice(0, 6) : ''}
                          </TableCell>
                          <TableCell className="w-[180px]" title={job.cliente || ''}>
                            {job.cliente && job.cliente.length > 15
                              ? `${job.cliente.slice(0, 15)}...`
                              : job.cliente || ''}
                          </TableCell>
                          <TableCell>{job.nome_campanha}</TableCell>
                          <TableCell className="min-w-[200px]">
                            <DesignerSelector 
                              jobId={job.id}
                              supabase={supabase}
                            />
                          </TableCell>
                          <TableCell>{formatDate(job.created_at)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <ViewButton onClick={() => setSelectedJob(job)} />
                                  </TooltipTrigger>
                                  <TooltipContent>Ver Itens</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages} ({sortedJobs.length} trabalhos)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
                    jobDataIn={selectedJob!.data_in ?? null}
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
                    planos={itemPlanos[item.id] || []}
                    onPlanosChange={handlePlanosChange(item.id)}
                  />
                ))
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
  )
}

'use client'

/**
 * Producao – full refactor (single-drawer, production-parity UI)
 * --------------------------------------------------------------
 * Optimized version with improved queries and loading states
 * NO caching - preserves real-time data accuracy
 *
 * FILTERING RULES:
 * - Only shows jobs that have ORC (numero_orc) values
 * - Jobs missing ORC are filtered out on both tabs
 * - FO (numero_fo) values are optional and not required for display
 */

// Note: This is a client component - metadata should be added to layout.tsx or a parent server component

import { useState, useEffect, useMemo, useCallback, useRef, memo, lazy } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterInput } from '@/components/custom/FilterInput'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import DatePicker from '@/components/custom/DatePicker'
import { createBrowserClient } from '@/utils/supabase'
import { format } from 'date-fns'
import { FullYearCalendar } from '@/components/FullYearCalendar'
import {
  ArrowUp,
  ArrowDown,
  Eye,
  RotateCw,
  Plus,
  Clock,
  FileText,
  Trash2,
  Copy,
  X,
  ReceiptText,
  RefreshCcw,
  Check,
  Edit,
  Database,
  Server,
  Users,
  FolderSync,
  FileUser,
} from 'lucide-react'
import CreatableClienteCombobox, {
  ClienteOption,
} from '@/components/forms/CreatableClienteCombobox'
import SimpleNotasPopover from '@/components/custom/SimpleNotasPopover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  ArrowRight,
  Grid2x2Check,
  Loader2,
  SquareChartGantt,
  Download,
  XSquare,
} from 'lucide-react'
import LogisticaTableWithCreatable from '@/components/custom/LogisticaTableWithCreatable'
import { LogisticaRecord, Cliente } from '@/types/logistica'
import { useLogisticaData } from '@/utils/useLogisticaData'
import { exportProducaoToExcel } from '@/utils/exportProducaoToExcel'
import { Suspense } from 'react'
import type {
  Job,
  Item,
  LoadingState,
  Holiday,
  SortableJobKey,
  PhcFoHeader,
  ClienteOption,
  DuplicateDialogState,
  FOTotals,
  ProducaoTab,
  SortDirection,
} from '@/types/producao'
import { useDebounce } from '@/hooks/useDebounce'
import {
  parseDateFromYYYYMMDD,
  formatDatePortuguese,
} from '@/utils/producao/dateHelpers'
import { parseNumericField } from '@/utils/producao/sortHelpers'
import { PagePermissionGuard } from '@/components/PagePermissionGuard'
import {
  dotColor,
  getPColor,
  getAColor,
  getCColor,
} from '@/utils/producao/statusColors'
import { usePhcIntegration } from '@/app/producao/hooks/usePhcIntegration'
import { useDuplicateValidation } from '@/app/producao/hooks/useDuplicateValidation'

/* ---------- lazy loaded components ---------- */
const JobDrawerContent = lazy(() =>
  import('@/components/producao/JobDrawer/JobDrawer').then((module) => ({
    default: module.JobDrawerContent,
  })),
)

/* ---------- constants ---------- */
const JOBS_PER_PAGE = 50 // Pagination limit for better performance
const ITEMS_FETCH_LIMIT = 200 // Reasonable limit for items per request

/* ---------- Loading Components ---------- */
// Types and helpers now imported from centralized locations
const JobsTableSkeleton = () => (
  <div className="space-y-2">
    <div className="h-10 animate-pulse bg-muted opacity-80" /> {/* Header */}
    {[...Array(8)].map((_, i) => (
      <div key={i} className="h-12 animate-pulse bg-muted opacity-60" />
    ))}
  </div>
)

const ErrorMessage = ({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) => (
  <div className="border border-destructive/30 bg-destructive/10 p-4">
    <div className="flex items-center justify-between">
      <p className="text-destructive">{message}</p>
      <Button variant="outline" size="sm" className="border border-black" onClick={onRetry}>
        <RotateCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  </div>
)

/* ---------- Performance optimizations complete ---------- */

/* ---------- main page ---------- */
export default function ProducaoPage() {
  const supabase = useMemo(() => createBrowserClient(), [])

  /* state */
  const [jobs, setJobs] = useState<Job[]>([])
  const [allItems, setAllItems] = useState<Item[]>([])
  const [allOperacoes, setAllOperacoes] = useState<any[]>([])
  const [allDesignerItems, setAllDesignerItems] = useState<any[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  // Ref to access latest clientes in fetchJobs without creating dependency
  const clientesRef = useRef<ClienteOption[]>([])
  // Ref to track if initial load has happened
  const initialLoadDone = useRef(false)
  // Ref to track FO imports in progress to prevent duplicate imports from multiple tabs
  const foImportsInProgress = useRef<Set<string>>(new Set())
  const [jobsSaiuStatus, setJobsSaiuStatus] = useState<Record<string, boolean>>(
    {},
  )
  const [jobsCompletionStatus, setJobsCompletionStatus] = useState<
    Record<string, { completed: boolean; percentage: number }>
  >({})
  const [jobTotalValues, setJobTotalValues] = useState<Record<string, number>>(
    {},
  )

  /* duplicate validation state */
  const [duplicateDialog, setDuplicateDialog] = useState<DuplicateDialogState>({
    isOpen: false,
    type: 'orc',
    value: '',
    currentJobId: '',
  })

  /* loading states */
  const [loading, setLoading] = useState<LoadingState>({
    jobs: true,
    items: true,
    operacoes: true,
    clientes: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  /* pagination */
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMoreJobs, setHasMoreJobs] = useState(true)

  /* filters */
  const [foF, setFoF] = useState('')
  const [orcF, setOrcF] = useState('')
  const [campF, setCampF] = useState('')
  const [itemF, setItemF] = useState('')
  const [codeF, setCodeF] = useState('')
  const [clientF, setClientF] = useState('')

  const [effectiveFoF, setEffectiveFoF] = useState('')
  const [effectiveOrcF, setEffectiveOrcF] = useState('')
  const [effectiveCampF, setEffectiveCampF] = useState('')
  const [effectiveItemF, setEffectiveItemF] = useState('')
  const [effectiveCodeF, setEffectiveCodeF] = useState('')
  const [effectiveClientF, setEffectiveClientF] = useState('')
  // F (fatura) toggle: false = show F false, true = show F true
  const [showFatura, setShowFatura] = useState(false)

  /* tab state */
  const [activeTab, setActiveTab] = useState<ProducaoTab>('em_curso')

  /* FO totals state */
  const [foTotals, setFoTotals] = useState<FOTotals>({
    em_curso: 0,
    pendentes: 0,
  })
  const [showTotals, setShowTotals] = useState(false)



  // Cleanup effect: Force remove inert attributes when drawer closes
  useEffect(() => {
    if (!openId) {
      // Drawer is closed, ensure no residual inert attributes
      const cleanup = () => {
        // Remove inert from all elements
        const inertElements = document.querySelectorAll('[inert]')
        if (inertElements.length > 0) {
          inertElements.forEach(el => {
            el.removeAttribute('inert')
          })
        }

        // Ensure main content is clickable
        const mainContent = document.querySelector('.w-full.space-y-6')
        if (mainContent) {
          mainContent.removeAttribute('inert')
          // Force pointer events to be enabled
          ;(mainContent as HTMLElement).style.pointerEvents = ''
        }
      }

      // Run cleanup immediately
      cleanup()

      // Run again after a delay to catch any async inert applications
      const timer1 = setTimeout(cleanup, 50)
      const timer2 = setTimeout(cleanup, 200)

      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
      }
    }
  }, [openId])


  /* sorting */
  const [sortCol, setSortCol] = useState<SortableJobKey>('prioridade')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  const [hasUserSorted, setHasUserSorted] = useState(false) // Track if user has manually sorted
  const toggleSort = useCallback(
    (c: SortableJobKey) => {
      setHasUserSorted(true) // Mark that user has manually sorted
      if (sortCol === c) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
      else {
        setSortCol(c)
        setSortDir('asc')
      }
    },
    [sortCol, sortDir],
  )

  /* ---------- PHC Integration Hook ---------- */
  const {
    fetchPhcHeaderByFo,
    fetchPhcHeaderByOrc,
    resolveClienteName,
    importPhcLinesForFo,
    prefillAndInsertFromFo,
  } = usePhcIntegration(
    supabase,
    clientes,
    foImportsInProgress,
    setAllItems,
    setJobs,
    setOpenId,
  )

  /* ---------- Duplicate Validation Hook ---------- */
  const { checkOrcDuplicate, checkFoDuplicate } = useDuplicateValidation(supabase)

  /* ---------- Other Functions ---------- */

  const prefillAndInsertFromOrc = useCallback(
    async (orcNumber: string, tempJobId: string) => {
      // Prevent duplicate imports from multiple tabs
      const importKey = `orc-${orcNumber}-${tempJobId}`
      if (foImportsInProgress.current.has(importKey)) {
        console.log('⚠️ Import already in progress for ORC:', orcNumber, 'job:', tempJobId)
        return
      }
      foImportsInProgress.current.add(importKey)
      
      try {
        const header = await fetchPhcHeaderByOrc(orcNumber)
      console.log('🔍 PHC Header Response (ORC):', {
        orcNumber,
        header,
        nome_trabalho: header?.nome_trabalho,
        observacoes: header?.observacoes,
        customer_id: header?.customer_id,
      })
      let phcFolhaObraId: string | null = null
      // Use nome_trabalho if available, otherwise fall back to observacoes
      const campaignName = header?.nome_trabalho || header?.observacoes || 'Nova Campanha'
      let insertData: any = {
        Numero_do_: header?.folha_obra_number || '0000',
        Trabalho: campaignName,
        Nome: '',
        numero_orc: orcNumber,
        customer_id: null,
      }
      if (header) {
        phcFolhaObraId = header.folha_obra_id
        const { id_cliente, cliente } = await resolveClienteName(
          header.customer_id ?? null,
        )
        insertData.Nome = cliente
        // Store customer_id from PHC directly
        if (header.customer_id) {
          insertData.customer_id = header.customer_id
        }
      }

      const { data: newJob, error } = await supabase
        .from('folhas_obras')
        .insert(insertData)
        .select(
          'id, numero_fo:Numero_do_, numero_orc, nome_campanha:Trabalho, cliente:Nome',
        )
        .single()
      if (error) throw error
      if (newJob) {
        const mappedJob = {
          id: (newJob as any).id,
          numero_fo: (newJob as any).numero_fo || '',
          numero_orc: (newJob as any).numero_orc ?? orcNumber,
          nome_campanha: (newJob as any).nome_campanha || '',
          cliente: (newJob as any).cliente || '',
          data_saida: null,
          prioridade: null,
          notas: null,
          id_cliente: header
            ? (await resolveClienteName(header.customer_id ?? null)).id_cliente
            : null,
          data_in: header?.folha_obra_date ?? null,
        } as Job

        setJobs((prev) => prev.map((j) => (j.id === tempJobId ? mappedJob : j)))
        if (phcFolhaObraId) {
          await importPhcLinesForFo(
            phcFolhaObraId,
            (newJob as any).id,
            header?.folha_obra_number || null,
          )
          setOpenId((newJob as any).id)
        }
      }
      } finally {
        // Always remove the import key from the set
        foImportsInProgress.current.delete(importKey)
      }
    },
    [
      fetchPhcHeaderByOrc,
      resolveClienteName,
      importPhcLinesForFo,
      supabase,
      setJobs,
    ],
  )

  /* ---------- Optimized Data Fetching ---------- */

  // Fetch clientes (static data - can be cached client-side)
  const fetchClientes = useCallback(async () => {
    setLoading((prev) => ({ ...prev, clientes: true }))
    try {
      const { data: clientesData, error } = await supabase
        .schema('phc')
        .from('cl')
        .select('customer_id, customer_name')
        .order('customer_name', { ascending: true })

      if (error) throw error

      if (clientesData) {
        const clienteOptions = clientesData.map((c: any) => ({
          value: c.customer_id.toString(),
          label: c.customer_name,
        }))
        setClientes(clienteOptions)
      }
    } catch (error) {
      console.error('Error fetching clientes:', error)
      setError('Failed to load client data')
    } finally {
      setLoading((prev) => ({ ...prev, clientes: false }))
    }
  }, [supabase])

  const fetchHolidays = useCallback(async () => {
    try {
      const today = new Date()
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0)

      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('feriados')
        .select('id, holiday_date, description')
        .gte('holiday_date', startDateStr)
        .lte('holiday_date', endDateStr)
        .order('holiday_date', { ascending: true })

      if (error) {
        console.error('Error fetching holidays:', error)
        return
      }

      if (data) {
        setHolidays(data)
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
    }
  }, [supabase])

  // Keep clientesRef in sync with clientes state
  useEffect(() => {
    clientesRef.current = clientes
  }, [clientes])

  // Note: Backfill effect removed - customer_id is now stored in database,
  // so id_cliente is properly loaded from the database query in fetchJobs

  // Fetch jobs with database-level filtering
  // Note: Tab filtering (em_curso vs concluidos) is now based on logistics completion status
  // - em_curso: Shows jobs where NOT ALL logistics entries have concluido=true
  // - concluidos: Shows jobs where ALL logistics entries have concluido=true for ALL items
  const fetchJobs = useCallback(
    async (
      page = 0,
      reset = false,
      filters: {
        foF?: string
        orcF?: string
        campF?: string
        itemF?: string
        codeF?: string
        clientF?: string
        effectiveFoF?: string
        effectiveOrcF?: string
        effectiveCampF?: string
        effectiveItemF?: string
        effectiveCodeF?: string
        effectiveClientF?: string
        showFatura?: boolean
        activeTab?: 'em_curso' | 'concluidos' | 'pendentes'
      } = {},
    ) => {
      setLoading((prev) => ({ ...prev, jobs: true }))
      try {
        // Optimized query with specific columns and proper pagination
        const startRange = page * JOBS_PER_PAGE
        const endRange = startRange + JOBS_PER_PAGE - 1

        // Calculate 12 months ago date for completed jobs filter (extended from 2 months)
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
        const twelveMonthsAgoString = twelveMonthsAgo.toISOString()

        // STEP 1: Handle item/codigo filters FIRST (search globally)
        let jobIds: string[] | null = null
        const itemFiltersActive = !!(
          filters.itemF?.trim() || filters.codeF?.trim()
        )

        if (itemFiltersActive) {
          console.log(
            '🔍 Item/codigo filter detected - searching ALL items in database',
          )

          const itemFilter = filters.itemF?.trim()
          const codeFilter = filters.codeF?.trim()

          // Combine all search terms
          const searchTerms = []
          if (itemFilter) searchTerms.push(itemFilter)
          if (codeFilter) searchTerms.push(codeFilter)

          let allJobIds: string[] = []

          // Search for each term in both codigo and descricao fields
          for (const term of searchTerms) {
            console.log('🔍 Global search for term:', term)

            const { data: itemData, error: itemErr } = await supabase
              .from('items_base')
              .select('folha_obra_id')
              .or(`descricao.ilike.%${term}%,codigo.ilike.%${term}%`)

            console.log(
              '🔍 Items found for term',
              term,
              ':',
              itemData?.length || 0,
            )

            if (!itemErr && itemData) {
              const jobIdsForTerm = itemData.map(
                (item: any) => item.folha_obra_id,
              )
              allJobIds = [...allJobIds, ...jobIdsForTerm]
            }
          }

          if (allJobIds.length > 0) {
            // Keep ALL job IDs, including duplicates if same item appears multiple times
            const uniqueJobIds = Array.from(new Set(allJobIds))
            console.log(
              '🎯 Found',
              allJobIds.length,
              'item matches in',
              uniqueJobIds.length,
              'unique jobs',
            )
            console.log('🎯 Job IDs to retrieve:', uniqueJobIds)

            jobIds = uniqueJobIds
          } else {
            console.log('❌ No items found matching search criteria')
            setJobs((prev: Job[]) => (reset ? [] : prev))
            setHasMoreJobs(false)
            setCurrentPage(page)
            return
          }
        }

        // STEP 2: Pre-filter by logistics status BEFORE fetching jobs (for em_curso/concluidos tabs)
        // This prevents truncation: we get all matching job IDs first, then fetch only those jobs
        let logisticsFilteredJobIds: string[] | null = null
        const itemFiltersPresent = !!(
          filters.itemF?.trim() || filters.codeF?.trim()
        )
        
        if (
          !jobIds && // Only if we didn't already filter by items
          !itemFiltersPresent && // Only if item filters aren't active
          (filters.activeTab === 'em_curso' || filters.activeTab === 'concluidos')
        ) {
          console.log('🔄 Pre-filtering by logistics status at database level')
          
          // First, get all items that match the date criteria (if any)
          let itemsQuery = supabase
            .from('items_base')
            .select('id, folha_obra_id')
          
          // Apply date filter to items via their jobs if needed
          const hasActiveFilters = !!(
            filters.foF?.trim() ||
            filters.campF?.trim() ||
            filters.clientF?.trim()
          )
          
          if (!hasActiveFilters) {
            // Get jobs from last 12 months to limit scope
            const twelveMonthsAgo = new Date()
            twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
            const { data: recentJobs } = await supabase
              .from('folhas_obras')
              .select('id')
              .gte('created_at', twelveMonthsAgo.toISOString())
            
            if (recentJobs && recentJobs.length > 0) {
              const recentJobIds = recentJobs.map((j: any) => j.id)
              itemsQuery = itemsQuery.in('folha_obra_id', recentJobIds)
            }
          }
          
          const { data: allItems, error: itemsErr } = await itemsQuery
          
          if (!itemsErr && allItems && allItems.length > 0) {
            const itemIds = allItems.map((item: any) => item.id)
            
            // Get logistics entries for these items
            const { data: logisticsData, error: logisticsErr } = await supabase
              .from('logistica_entregas')
              .select('item_id, concluido')
              .in('item_id', itemIds)
            
            if (!logisticsErr && logisticsData) {
              // Group items by job
              const itemsByJob = new Map<string, any[]>()
              allItems.forEach((item: any) => {
                if (!itemsByJob.has(item.folha_obra_id)) {
                  itemsByJob.set(item.folha_obra_id, [])
                }
                itemsByJob.get(item.folha_obra_id)!.push(item)
              })
              
              // Filter job IDs based on logistics status
              const matchingJobIds: string[] = []
              
              // Get all job IDs that have items (from itemsByJob map)
              const jobsWithItems = Array.from(itemsByJob.keys())
              
              // For em_curso: also include jobs that have NO items (they're in progress)
              if (filters.activeTab === 'em_curso') {
                // Get all jobs from the date range to find jobs without items
                const hasActiveFilters = !!(
                  filters.foF?.trim() ||
                  filters.campF?.trim() ||
                  filters.clientF?.trim()
                )
                
                let jobsQuery = supabase.from('folhas_obras').select('id')
                if (!hasActiveFilters) {
                  const twelveMonthsAgo = new Date()
                  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
                  jobsQuery = jobsQuery.gte('created_at', twelveMonthsAgo.toISOString())
                }
                const { data: allJobsInRange } = await jobsQuery
                
                if (allJobsInRange) {
                  // Jobs without items should also be included in em_curso
                  const jobsWithoutItems = allJobsInRange
                    .map((j: any) => j.id)
                    .filter((jobId: string) => !itemsByJob.has(jobId))
                  
                  matchingJobIds.push(...jobsWithoutItems)
                }
              }
              
              itemsByJob.forEach((jobItems, jobId) => {
                if (filters.activeTab === 'em_curso') {
                  // em_curso: job has ANY item with concluido=false or no logistics entry
                  const hasIncomplete = jobItems.some((item) => {
                    const logEntries = logisticsData.filter((l: any) => l.item_id === item.id)
                    if (logEntries.length === 0) return true // No logistics entry = incomplete
                    return logEntries.some((e: any) => e.concluido !== true)
                  })
                  if (hasIncomplete) matchingJobIds.push(jobId)
                } else if (filters.activeTab === 'concluidos') {
                  // concluidos: ALL items have ALL logistics entries with concluido=true
                  const allCompleted = jobItems.every((item) => {
                    const logEntries = logisticsData.filter((l: any) => l.item_id === item.id)
                    if (logEntries.length === 0) return false // No entries = not completed
                    return logEntries.every((e: any) => e.concluido === true)
                  })
                  if (allCompleted && jobItems.length > 0) matchingJobIds.push(jobId)
                }
              })
              
              if (matchingJobIds.length > 0) {
                logisticsFilteredJobIds = matchingJobIds
                console.log(`✅ Found ${matchingJobIds.length} jobs matching logistics criteria`)
              } else {
                console.log('⚠️ No jobs match logistics criteria')
                setJobs((prev: Job[]) => (reset ? [] : prev))
                setHasMoreJobs(false)
                setCurrentPage(page)
                return
              }
            }
          }
        }

        // STEP 3: Build the base query - select only existing columns in schema
        let query = supabase.from('folhas_obras').select(
          `
          id,
          Numero_do_,
          numero_orc,
          Trabalho,
          Data_efeti,
          Observacoe,
          Nome,
          customer_id,
          prioridade,
          pendente,
          created_at,
          updated_at
        `,
          { count: 'exact' },
        )

        // Include both FO-only and ORC-linked jobs (no forced filter by numero_orc)

        // If we have job IDs from logistics pre-filter, use those
        if (logisticsFilteredJobIds) {
          console.log(
            '🎯 Logistics pre-filter active - filtering to',
            logisticsFilteredJobIds.length,
            'job IDs'
          )
          query = query.in('id', logisticsFilteredJobIds)
        } else if (jobIds) {
          // If we have job IDs from item search, filter by those ONLY
          console.log(
            '🎯 Item search active - filtering to specific job IDs:',
            jobIds,
          )
          query = query.in('id', jobIds)
          console.log('🎯 Bypassing all other filters due to item search')
        }

        // STEP 4: Apply other filters (only if no pre-filtering is active)
        if (!logisticsFilteredJobIds && !jobIds) {
          console.log('🔄 Applying standard filters (no pre-filtering active)')

          // Check if any filters are active
          const hasActiveFilters = !!(
            filters.foF?.trim() ||
            filters.campF?.trim() ||
            filters.clientF?.trim()
          )

          // Tab-based filtering (completion status)
          if (filters.activeTab === 'concluidos') {
            console.log(
              '🔄 Applying date filter for concluidos tab:',
              twelveMonthsAgoString,
            )
            // For completed jobs, filter by last 12 months (extended from 2 months)
            // Note: data_concluido is in logistica_entregas, not in folhas_obras
            query = query.or(
              `updated_at.gte.${twelveMonthsAgoString},created_at.gte.${twelveMonthsAgoString}`,
            )
          } else if (!hasActiveFilters) {
            // For other tabs (em_curso, pendentes) with no filters: show last 12 months (extended from 4 months)
            const twelveMonthsAgoEmCurso = new Date()
            twelveMonthsAgoEmCurso.setMonth(twelveMonthsAgoEmCurso.getMonth() - 12)
            const twelveMonthsAgoEmCursoString = twelveMonthsAgoEmCurso.toISOString()
            console.log(
              '🔄 No filters active - applying 12 month date filter:',
              twelveMonthsAgoEmCursoString,
            )
            query = query.gte('created_at', twelveMonthsAgoEmCursoString)
          }

          // Direct field filters using real column names
          const {
            effectiveFoF = '',
            effectiveOrcF = '',
            effectiveCampF = '',
            effectiveClientF = '',
          } = filters

          if (effectiveFoF) {
            query = query.ilike('Numero_do_', `%${effectiveFoF}%`)
          }

          if (effectiveOrcF) {
            query = query.ilike('numero_orc', `%${effectiveOrcF}%`)
          }

          if (effectiveCampF) {
            query = query.ilike('Trabalho', `%${effectiveCampF}%`)
          }

          if (effectiveClientF) {
            query = query.ilike('Nome', `%${effectiveClientF}%`)
          }

          // Note: 'fatura' column does not exist in schema; skipping fatura filter
        } else {
          // Apply text filters even when pre-filtering (FO, campaign, client)
          if (filters.foF && filters.foF.trim() !== '') {
            query = query.ilike('Numero_do_', `%${filters.foF.trim()}%`)
          }
          if (filters.orcF && filters.orcF.trim() !== '') {
            query = query.ilike('numero_orc', `%${filters.orcF.trim()}%`)
          }
          if (filters.campF && filters.campF.trim() !== '') {
            query = query.ilike('Trabalho', `%${filters.campF.trim()}%`)
          }
          if (filters.clientF && filters.clientF.trim() !== '') {
            query = query.ilike('Nome', `%${filters.clientF.trim()}%`)
          }
        }

        // Order and pagination (use existing column)
        query = query.order('created_at', { ascending: false })

        // Only apply pagination if we're not filtering by specific job IDs
        if (!logisticsFilteredJobIds && !jobIds) {
          query = query.range(startRange, endRange)
        } else {
          // When pre-filtered, we still need pagination but on the filtered set
          query = query.range(startRange, endRange)
        }

        // Debug: Log the full query conditions before execution
        if (jobIds) {
          console.log('🔍 DEBUGGING QUERY CONDITIONS:')
          console.log('- Job IDs to find:', jobIds)
          console.log('- Active tab:', filters.activeTab)
          console.log('- FO filter:', filters.foF)
          console.log('- Campaign filter:', filters.campF)
          console.log('- Client filter:', filters.clientF)
          console.log('- Show fatura:', filters.showFatura)
        }

        // Execute the main query
        const { data: jobsData, error, count } = await query

        if (error) {
          console.error('Supabase error details:', error)
          throw error
        }

        // Map database columns to Job interface
        console.log('📦 Raw jobsData length:', jobsData?.length ?? 0)
        console.log('📦 Clientes available in ref:', clientesRef.current.length)
        
        let filteredJobs: Job[] = (jobsData || []).map((row: any) => {
          const clienteName = row.Nome || ''
          const customerId = row.customer_id
          
          // Find the cliente name from the ID if not in Nome field
          let resolvedClienteName = clienteName
          let resolvedClienteId: string | null = null
          
          console.log(`📋 Processing FO ${row.Numero_do_}:`, {
            clienteName,
            customerId,
            clientesRefLength: clientesRef.current.length
          })
          
          if (customerId) {
            // Use customer_id to find the cliente name and ID
            const matchedCliente = clientesRef.current.find((c) => c.value === customerId.toString())
            console.log(`  🔍 Searching for customer_id ${customerId} in clientes:`, matchedCliente ? `✅ FOUND ${matchedCliente.label}` : '❌ NOT FOUND')
            if (matchedCliente) {
              resolvedClienteName = matchedCliente.label
              resolvedClienteId = matchedCliente.value
              if (customerId && !clienteName) {
                console.log(`✅ Cliente resolved from customer_id ${customerId}: "${matchedCliente.label}"`)
              }
            }
          } else if (clienteName) {
            // Fallback: if no customer_id, try to match by name
            const matchedCliente = clientesRef.current.find((c) => c.label === clienteName)
            if (matchedCliente) {
              resolvedClienteId = matchedCliente.value
              console.log(`✅ Cliente matched by name for FO ${row.Numero_do_}: "${clienteName}" -> ${matchedCliente.value}`)
            } else if (clientesRef.current.length > 0) {
              console.warn(`⚠️ Cliente not found for FO ${row.Numero_do_}: "${clienteName}"`)
              console.log(`  Available clientes: ${clientesRef.current.slice(0, 3).map(c => c.label).join(', ')}`)
            }
          }
          
          return {
            id: row.id,
            numero_fo: row.Numero_do_ ? String(row.Numero_do_) : '',
            numero_orc: row.numero_orc ?? null,
            nome_campanha: row.Trabalho || '',
            data_saida: row.Data_efeti ?? null,
            prioridade: row.prioridade ?? false,
            pendente: row.pendente ?? false,
            notas: row.Observacoe ?? null,
            concluido: null,
            saiu: null,
            fatura: null,
            created_at: row.created_at ?? null,
            data_in: row.Data_efeti ?? null,
            cliente: resolvedClienteName,
            id_cliente: resolvedClienteId,
            customer_id: customerId,
            data_concluido: null,
            updated_at: row.updated_at ?? null,
          }
        })
        console.log('📊 Query result: jobs found:', filteredJobs.length)

        // Enrich data_in with authoritative date from PHC view when available
        try {
          const foNumbers = Array.from(
            new Set(
              filteredJobs
                .map((j) => j.numero_fo)
                .filter((n): n is string => !!n && n.trim() !== ''),
            ),
          )
          if (foNumbers.length > 0) {
            // Query folha_obra_with_orcamento view for document dates
            const { data: phcDates, error: phcErr } = await supabase
              .schema('phc')
              .from('folha_obra_with_orcamento')
              .select('folha_obra_number, folha_obra_date')
              .in('folha_obra_number', foNumbers)
            if (!phcErr && phcDates) {
              const dateMap = new Map<string, string | null>()
              phcDates.forEach((r: any) => {
                if (r?.folha_obra_number) {
                  dateMap.set(String(r.folha_obra_number), r.folha_obra_date || null)
                }
              })
              filteredJobs = filteredJobs.map((j) => ({
                ...j,
                data_in: dateMap.get(j.numero_fo) ?? j.data_in ?? null,
              }))
            } else if (phcErr) {
              console.warn('PHC date fetch failed:', phcErr)
            }
          }
        } catch (e) {
          console.warn('PHC date enrichment error:', e)
        }

        // Apply pendente filtering for pendentes tab (this is a simple field filter, no logistics needed)
        if (filters.activeTab === 'pendentes') {
          filteredJobs = filteredJobs.filter((job) => job.pendente === true)
        } else if (filters.activeTab === 'em_curso') {
          // For em_curso tab, exclude pendente jobs (they're already filtered out by pre-filtering)
          filteredJobs = filteredJobs.filter((job) => job.pendente !== true)
        } else if (filters.activeTab === 'concluidos') {
          // For concluidos tab, exclude pendente jobs
          filteredJobs = filteredJobs.filter((job) => job.pendente !== true)
        }

        // Item/codigo filtering is now handled at the beginning of the function

        // Note: Do NOT filter by numero_orc; show FO-only and ORC-linked jobs

        if (filteredJobs) {
          console.log('📊 Final jobs to display:', filteredJobs.length, 'jobs')
          console.log(
            '📊 Sample job IDs:',
            filteredJobs.slice(0, 3).map((j) => j.numero_fo),
          )
          setJobs((prev) => (reset ? filteredJobs : [...prev, ...filteredJobs]))
          
          // Calculate hasMoreJobs - if we pre-filtered by logistics, count is already accurate
          // Otherwise use the normal count check
          if (logisticsFilteredJobIds) {
            // When pre-filtered, count is the total matching jobs, and we paginate those
            setHasMoreJobs((count || 0) > endRange + 1)
          } else {
            // Normal pagination check
            setHasMoreJobs((count || 0) > endRange + 1)
          }
          setCurrentPage(page)
        }
      } catch (error) {
        console.error('Error fetching jobs:', error)
        setError(
          `Failed to load production jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      } finally {
        setLoading((prev) => ({ ...prev, jobs: false }))
      }
    },
    [supabase],
  )

  // Fetch saiu status for jobs by checking if ALL items have saiu=true in logistica_entregas
  const fetchJobsSaiuStatus = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      try {
        // First get all items for these jobs
        const { data: itemsData, error: itemsError } = await supabase
          .from('items_base')
          .select('id, folha_obra_id')
          .in('folha_obra_id', jobIds)

        if (itemsError) throw itemsError

        if (itemsData && itemsData.length > 0) {
          const itemIds = itemsData.map((item) => item.id)

          // Get logistics entries for these items
          const { data: logisticsData, error: logisticsError } = await supabase
            .from('logistica_entregas')
            .select('item_id, saiu')
            .in('item_id', itemIds)

          if (logisticsError) throw logisticsError

          // Calculate saiu status for each job
          const jobSaiuStatus: Record<string, boolean> = {}

          jobIds.forEach((jobId) => {
            const jobItems = itemsData.filter(
              (item) => item.folha_obra_id === jobId,
            )

            if (jobItems.length === 0) {
              jobSaiuStatus[jobId] = false
              return
            }

            // Check if all items have logistics entries with saiu=true
            const allItemsSaiu = jobItems.every((item) => {
              const logisticsEntry = logisticsData?.find(
                (l) => l.item_id === item.id,
              )
              return logisticsEntry && logisticsEntry.saiu === true
            })

            jobSaiuStatus[jobId] = allItemsSaiu
          })

          setJobsSaiuStatus(jobSaiuStatus)
        }
      } catch (error) {
        console.error('Error fetching jobs saiu status:', error)
      }
    },
    [supabase],
  )

  // Fetch completion status for jobs by checking logistics entries
  const fetchJobsCompletionStatus = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      try {
        // First get all items for these jobs
        const { data: itemsData, error: itemsError } = await supabase
          .from('items_base')
          .select('id, folha_obra_id')
          .in('folha_obra_id', jobIds)

        if (itemsError) throw itemsError

        if (itemsData && itemsData.length > 0) {
          const itemIds = itemsData.map((item) => item.id)

          // Get logistics entries for these items
          const { data: logisticsData, error: logisticsError } = await supabase
            .from('logistica_entregas')
            .select('item_id, concluido')
            .in('item_id', itemIds)

          if (logisticsError) throw logisticsError

          // Calculate completion status for each job
          const jobCompletionStatus: Record<
            string,
            { completed: boolean; percentage: number }
          > = {}

          jobIds.forEach((jobId) => {
            const jobItems = itemsData.filter(
              (item) => item.folha_obra_id === jobId,
            )

            if (jobItems.length === 0) {
              jobCompletionStatus[jobId] = { completed: false, percentage: 0 }
              return
            }

            // Calculate completion percentage based on logistics entries with concluido=true
            const completedItems = jobItems.filter((item) => {
              const logisticsEntry = logisticsData?.find(
                (l) => l.item_id === item.id,
              )
              return logisticsEntry && logisticsEntry.concluido === true
            })

            const percentage = Math.round(
              (completedItems.length / jobItems.length) * 100,
            )
            const allCompleted = completedItems.length === jobItems.length

            jobCompletionStatus[jobId] = { completed: allCompleted, percentage }
          })

          setJobsCompletionStatus(jobCompletionStatus)
        }
      } catch (error) {
        console.error('Error fetching jobs completion status:', error)
      }
    },
    [supabase],
  )

  // Fetch items for loaded jobs only
  const fetchItems = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      setLoading((prev) => ({ ...prev, items: true }))
      try {
        // Optimized query: only fetch items for loaded jobs
        const { data: itemsData, error } = await supabase
          .from('items_base')
          .select(
            `
          id, folha_obra_id, descricao, codigo, 
          quantidade, brindes
        `,
          )
          .in('folha_obra_id', jobIds)
          .limit(ITEMS_FETCH_LIMIT)

        if (error) throw error

        // Fetch designer items data separately for better performance
        const { data: designerData, error: designerError } = await supabase
          .from('designer_items')
          .select('item_id, paginacao')
          .in('item_id', itemsData?.map((item) => item.id) || [])

        if (designerError) throw designerError

        // Fetch logistics data for completion status
        const { data: logisticsData, error: logisticsError } = await supabase
          .from('logistica_entregas')
          .select('item_id, concluido')
          .in('item_id', itemsData?.map((item) => item.id) || [])

        if (logisticsError) throw logisticsError

        if (itemsData) {
          // Merge designer data and logistics data with items data
          const itemsWithDesigner = itemsData.map((item: any) => {
            const designer = designerData?.find((d) => d.item_id === item.id)
            const logistics = logisticsData?.find((l) => l.item_id === item.id)
            return {
              id: item.id,
              folha_obra_id: item.folha_obra_id,
              descricao: item.descricao ?? '',
              codigo: item.codigo ?? '',
              quantidade: item.quantidade ?? null,
              paginacao: designer?.paginacao ?? false,
              brindes: item.brindes ?? false,
              concluido: logistics?.concluido ?? false,
            }
          })

          setAllItems((prev) => {
            // Replace items for these jobs to avoid duplicates
            const filtered = prev.filter(
              (item) => !jobIds.includes(item.folha_obra_id),
            )
            return [...filtered, ...itemsWithDesigner]
          })

          // Update designer items state for the color calculations
          if (designerData) {
            setAllDesignerItems((prev) => {
              // Replace designer items for these jobs to avoid duplicates
              const filtered = prev.filter(
                (designer) =>
                  !itemsData.some((item) => item.id === designer.item_id),
              )
              return [...filtered, ...designerData]
            })
          }
        }
      } catch (error) {
        console.error('Error fetching items:', error)
        setError('Failed to load production items')
      } finally {
        setLoading((prev) => ({ ...prev, items: false }))
      }
    },
    [supabase],
  )

  // Fetch operacoes for loaded jobs
  const fetchOperacoes = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      setLoading((prev) => ({ ...prev, operacoes: true }))
      try {
        const { data: operacoesData, error } = await supabase
          .from('producao_operacoes')
          .select('id, folha_obra_id, concluido')
          .in('folha_obra_id', jobIds)

        if (error) throw error

        if (operacoesData) {
          setAllOperacoes((prev) => {
            // Replace operacoes for these jobs to avoid duplicates
            const filtered = prev.filter(
              (op) => !jobIds.includes(op.folha_obra_id),
            )
            return [...filtered, ...operacoesData]
          })
        }
      } catch (error) {
        console.error('Error fetching operacoes:', error)
        setError('Failed to load production operations')
      } finally {
        setLoading((prev) => ({ ...prev, operacoes: false }))
      }
    },
    [supabase],
  )

  const fetchDesignerItems = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      // Get item IDs for these jobs first (exclude pending items)
      const jobItemIds = allItems
        .filter(
          (item) =>
            jobIds.includes(item.folha_obra_id) && !item.id.startsWith('temp-'),
        )
        .map((item) => item.id)

      // If no items are loaded yet, skip designer items fetch
      // This prevents the race condition on initial page load
      if (jobItemIds.length === 0) return

      setLoading((prev) => ({ ...prev, operacoes: true })) // Reuse loading state
      try {
        const { data: designerData, error } = await supabase
          .from('designer_items')
          .select('id, item_id, paginacao')
          .in('item_id', jobItemIds)

        if (error) throw error

        if (designerData) {
          setAllDesignerItems((prev) => {
            // Replace designer items for these jobs to avoid duplicates
            const filtered = prev.filter(
              (designer) => !jobItemIds.includes(designer.item_id),
            )
            return [...filtered, ...designerData]
          })
        }
      } catch (error) {
        console.error('Error fetching designer items:', error)
        setError('Failed to load designer items')
      } finally {
        setLoading((prev) => ({ ...prev, operacoes: false }))
      }
    },
    [supabase, allItems],
  )

  // Fetch FO totals for Em curso and Pendentes tabs
  const fetchFoTotals = useCallback(async () => {
    try {
      console.log('💰 Fetching FO totals...')

      // Fetch all jobs from folhas_obras table with their pendente status
      const { data: allJobs, error: allJobsError } = await supabase
        .from('folhas_obras')
        .select('Numero_do_, pendente')
        .not('Numero_do_', 'is', null)

      if (allJobsError) throw allJobsError

      console.log('📋 Raw jobs data:', {
        totalJobs: allJobs?.length,
        sample: allJobs?.slice(0, 5),
      })

      // Separate em_curso (not pendente) and pendentes based on pendente flag
      const emCursoJobs = allJobs?.filter((job) => job.pendente !== true) || []
      const pendentesJobs = allJobs?.filter((job) => job.pendente === true) || []

      // Get FO numbers for each category
      // Convert to strings since PHC document_number is TEXT type
      const emCursoFoNumbers = emCursoJobs
        ?.map((job) => String(job.Numero_do_))
        .filter((fo) => fo && fo !== 'null' && fo !== 'undefined') || []
      
      const pendentesFoNumbers = pendentesJobs
        ?.map((job) => String(job.Numero_do_))
        .filter((fo) => fo && fo !== 'null' && fo !== 'undefined') || []

      console.log('📊 FO numbers sample:', {
        em_curso_count: emCursoFoNumbers.length,
        em_curso_sample: emCursoFoNumbers.slice(0, 5),
        pendentes_count: pendentesFoNumbers.length,
        pendentes_sample: pendentesFoNumbers.slice(0, 5),
      })

      // Fetch values from PHC BO table
      let emCursoTotal = 0
      let pendentesTotal = 0

      if (emCursoFoNumbers.length > 0) {
        console.log('🔍 Querying PHC BO table for em curso FOs...')
        const { data: emCursoValues, error: emCursoValuesError } = await supabase
          .schema('phc')
          .from('bo')
          .select('document_number, total_value')
          .eq('document_type', 'Folha de Obra')
          .in('document_number', emCursoFoNumbers)

        console.log('📦 Em curso PHC BO results:', {
          count: emCursoValues?.length || 0,
          sample: emCursoValues?.slice(0, 5),
          error: emCursoValuesError,
        })

        if (emCursoValuesError) {
          console.error('Error fetching em curso values:', emCursoValuesError)
        } else if (emCursoValues) {
          emCursoTotal = emCursoValues.reduce(
            (sum, row) => sum + (Number(row.total_value) || 0),
            0,
          )
          console.log('💵 Em curso total calculated:', emCursoTotal)
        }
      }

      if (pendentesFoNumbers.length > 0) {
        console.log('🔍 Querying PHC BO table for pendentes FOs...')
        const { data: pendentesValues, error: pendentesValuesError } = await supabase
          .schema('phc')
          .from('bo')
          .select('document_number, total_value')
          .eq('document_type', 'Folha de Obra')
          .in('document_number', pendentesFoNumbers)

        console.log('📦 Pendentes PHC BO results:', {
          count: pendentesValues?.length || 0,
          sample: pendentesValues?.slice(0, 5),
          error: pendentesValuesError,
        })

        if (pendentesValuesError) {
          console.error('Error fetching pendentes values:', pendentesValuesError)
        } else if (pendentesValues) {
          pendentesTotal = pendentesValues.reduce(
            (sum, row) => sum + (Number(row.total_value) || 0),
            0,
          )
          console.log('💵 Pendentes total calculated:', pendentesTotal)
        }
      }

      console.log('💰 FO totals calculated:', {
        em_curso: emCursoTotal,
        pendentes: pendentesTotal,
      })

      setFoTotals({
        em_curso: emCursoTotal,
        pendentes: pendentesTotal,
      })
    } catch (error) {
      console.error('Error fetching FO totals:', error)
    }
  }, [supabase])

  // Fetch individual job total values from PHC BO table
  const fetchJobTotalValues = useCallback(
    async (jobIds: string[]) => {
      if (jobIds.length === 0) return

      try {
        // Get all jobs with their FO numbers
        const { data: jobsData, error: jobsError } = await supabase
          .from('folhas_obras')
          .select('id, Numero_do_')
          .in('id', jobIds)
          .not('Numero_do_', 'is', null)

        if (jobsError) throw jobsError

        // Extract FO numbers
        const foNumbers = jobsData
          ?.map((job) => String(job.Numero_do_))
          .filter((fo) => fo && fo !== 'null' && fo !== 'undefined') || []

        if (foNumbers.length === 0) {
          setJobTotalValues({})
          return
        }

        // Fetch values from PHC BO table
        const { data: boData, error: boError } = await supabase
          .schema('phc')
          .from('bo')
          .select('document_number, total_value')
          .eq('document_type', 'Folha de Obra')
          .in('document_number', foNumbers)

        if (boError) throw boError

        // Create a map of FO number -> total_value
        const foValueMap: Record<string, number> = {}
        boData?.forEach((row) => {
          foValueMap[String(row.document_number)] = Number(row.total_value) || 0
        })

        // Create a map of job ID -> total_value by matching FO numbers
        const jobValuesMap: Record<string, number> = {}
        jobsData?.forEach((job) => {
          const foValue = foValueMap[String(job.Numero_do_)] || 0
          jobValuesMap[job.id] = foValue
        })

        setJobTotalValues(jobValuesMap)
      } catch (error) {
        console.error('Error fetching job total values:', error)
      }
    },
    [supabase],
  )

  // Initial data load - only on mount
  useEffect(() => {
    if (initialLoadDone.current) return
    
    const loadInitialData = async () => {
      setError(null)

      console.log('🚀 Starting initial data load...')

      // Load clientes FIRST and wait for completion
      await fetchClientes()
      console.log('✅ Clientes loaded:', clientesRef.current.length)

      // Load holidays
      fetchHolidays()

      // Then load jobs - clientes will already be in the ref
      await fetchJobs(0, true, { activeTab })
      console.log('✅ Jobs loaded')
      
      initialLoadDone.current = true
    }

    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  // Refetch when activeTab changes (after initial load)
  useEffect(() => {
    if (!initialLoadDone.current) return
    
    setJobs([])
    setHasMoreJobs(true)
    setCurrentPage(0)
    fetchJobs(0, true, { activeTab })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Trigger search when filters change
  useEffect(() => {
    console.log('🔍 Filter change detected:', {
      effectiveCodeF,
      effectiveItemF,
      effectiveFoF,
      effectiveOrcF,
      effectiveCampF,
      effectiveClientF,
      showFatura,
      activeTab,
    })

    if (
      effectiveFoF ||
      effectiveOrcF ||
      effectiveCampF ||
      effectiveItemF ||
      effectiveCodeF ||
      effectiveClientF
    ) {
      // Run filtered search
      setHasMoreJobs(true)
      setCurrentPage(0)
      fetchJobs(0, true, {
        foF: effectiveFoF,
        orcF: effectiveOrcF,
        campF: effectiveCampF,
        itemF: effectiveItemF,
        codeF: effectiveCodeF,
        clientF: effectiveClientF,
        showFatura,
        activeTab,
      })
    } else {
      // If no filters, reset to load all jobs for current tab
      console.log('🔄 Resetting to default search')
      setHasMoreJobs(true)
      setCurrentPage(0)
      fetchJobs(0, true, { activeTab })
    }
  }, [
    effectiveFoF,
    effectiveOrcF,
    effectiveCampF,
    effectiveItemF,
    effectiveCodeF,
    effectiveClientF,
    showFatura,
    activeTab,
    fetchJobs,
  ])
  // Memoize job IDs to prevent unnecessary re-fetches
  const jobIdString = useMemo(() => {
    return jobs
      .map((job) => job.id)
      .filter((id) => !id.startsWith('temp-'))
      .join(',')
  }, [jobs])

  const jobIds = useMemo(() => {
    return jobIdString.split(',').filter(Boolean)
  }, [jobIdString])

  // Load items and operacoes when job IDs change
  useEffect(() => {
    if (jobIds.length > 0) {
      fetchItems(jobIds)
      fetchOperacoes(jobIds)
      fetchJobsSaiuStatus(jobIds)
      fetchJobsCompletionStatus(jobIds)
      fetchJobTotalValues(jobIds)
    }
  }, [
    jobIdString,
    fetchItems,
    fetchOperacoes,
    fetchJobsSaiuStatus,
    fetchJobsCompletionStatus,
    fetchJobTotalValues,
  ])

  // Auto-complete jobs when all logistics entries are completed
  useEffect(() => {
    const checkJobCompletion = async () => {
      const jobsToUpdate: string[] = []
      
      setJobs((prevJobs) => {
        const updatedJobs = prevJobs.map((job) => {
          if (job.id.startsWith('temp-') || job.concluido) return job // Skip temp jobs and already completed jobs

          const completionStatus = jobsCompletionStatus[job.id]

          // If job has logistics entries and all are completed, mark job as completed
          if (completionStatus && completionStatus.completed) {
            console.log(
              `🎯 Auto-completing job ${job.numero_fo} - all logistics entries completed`,
            )

            jobsToUpdate.push(job.id)

            return {
              ...job,
              concluido: true,
              data_concluido: new Date().toISOString(),
            }
          }

          return job
        })

        // Only return new array if there were actual changes
        return jobsToUpdate.length > 0 ? updatedJobs : prevJobs
      })

      // Update database for all completed jobs
      if (jobsToUpdate.length > 0) {
        for (const jobId of jobsToUpdate) {
          await supabase
            .from('folhas_obras')
            .update({
              concluido: true,
              data_concluido: new Date().toISOString(),
            })
            .eq('id', jobId)
        }
      }
    }

    if (Object.keys(jobsCompletionStatus).length > 0) {
      checkJobCompletion()
    }
  }, [jobsCompletionStatus, supabase])

  // Load more jobs function
  const loadMoreJobs = useCallback(() => {
    if (!loading.jobs && hasMoreJobs) {
      fetchJobs(currentPage + 1, false, {
        effectiveFoF,
        effectiveCampF,
        effectiveItemF,
        effectiveCodeF,
        effectiveClientF,
        showFatura,
        activeTab,
      })
    }
  }, [
    loading.jobs,
    hasMoreJobs,
    currentPage,
    fetchJobs,
    effectiveFoF,
    effectiveCampF,
    effectiveItemF,
    effectiveCodeF,
    effectiveClientF,
    showFatura,
    activeTab,
  ])

  // Retry function for error recovery
  const retryFetch = useCallback(() => {
    setError(null)
    fetchJobs(0, true, { activeTab })
    fetchClientes()
  }, [fetchJobs, fetchClientes, activeTab])

  /* State to track filtered job IDs by date */
  const [dateFilteredJobIds, setDateFilteredJobIds] = useState<string[] | null>(null)

  /* Apply date filter when selectedDate changes */
  useEffect(() => {
    if (!selectedDate) {
      setDateFilteredJobIds(null)
      return
    }

    const filterByDate = async () => {
      try {
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
        console.log('📅 Filtering by data_saida:', selectedDateStr)

        // Get all logistics entries matching the selected date
        const { data: logisticsData, error: logisticsError } = await supabase
          .from('logistica_entregas')
          .select('item_id')
          .eq('data_saida', selectedDateStr)

        if (logisticsError) {
          console.error('Error fetching logistics for date filter:', logisticsError)
          return
        }

        if (!logisticsData || logisticsData.length === 0) {
          console.log('📅 No logistics entries found for date:', selectedDateStr)
          setDateFilteredJobIds([]) // Empty array means no matches
          return
        }

        const itemIds = logisticsData.map((log: any) => log.item_id)
        console.log('📅 Found item IDs:', itemIds.length)

        // Get folha_obra_ids from these items
        const { data: itemsData, error: itemsError } = await supabase
          .from('items_base')
          .select('folha_obra_id')
          .in('id', itemIds)

        if (itemsError) {
          console.error('Error fetching items for date filter:', itemsError)
          return
        }

        const jobIds = Array.from(new Set(itemsData?.map((item: any) => item.folha_obra_id) || []))
        console.log('📅 Filtered to job IDs:', jobIds.length)
        setDateFilteredJobIds(jobIds as string[])
      } catch (error) {
        console.error('Error in date filter:', error)
      }
    }

    filterByDate()
  }, [selectedDate, supabase])

  /* jobs are now pre-filtered by database, apply date filter if selected */
  const filtered = useMemo(() => {
    // If date filter is active, only show matching jobs
    if (dateFilteredJobIds !== null) {
      if (dateFilteredJobIds.length === 0) {
        return [] // No matches
      }
      return jobs.filter((job) => dateFilteredJobIds.includes(job.id))
    }
    return jobs
  }, [jobs, dateFilteredJobIds])

  /* sort */
  const sorted = useMemo(() => {
    // Only apply sorting if user has manually sorted
    if (!hasUserSorted) {
      return [...filtered]
    }

    const arr = [...filtered]
    arr.sort((a, b) => {
      let A: any, B: any
      switch (sortCol) {
        case 'numero_orc':
          // Smart numeric sorting: numbers first, then letters
          A = parseNumericField(a.numero_orc)
          B = parseNumericField(b.numero_orc)
          break
        case 'numero_fo':
          // Smart numeric sorting: numbers first, then letters
          A = parseNumericField(a.numero_fo)
          B = parseNumericField(b.numero_fo)
          break
        case 'cliente':
          A = a.cliente ?? ''
          B = b.cliente ?? ''
          break
        case 'nome_campanha':
          A = a.nome_campanha ?? ''
          B = b.nome_campanha ?? ''
          break
        case 'notas':
          A = a.notas ?? ''
          B = b.notas ?? ''
          break
        case 'prioridade':
          A = a.prioridade ?? false
          B = b.prioridade ?? false
          break
        case 'data_concluido':
          // Date completion is now handled by logistics data
          A = 0
          B = 0
          break
        case 'concluido':
          A = a.concluido ?? false
          B = b.concluido ?? false
          break
        case 'saiu':
          A = a.saiu ?? false
          B = b.saiu ?? false
          break
        case 'fatura':
          A = a.fatura ?? false
          B = b.fatura ?? false
          break
        case 'artwork':
          // Sort by operacoes completion status
          const aOperacoes = allOperacoes.filter(
            (op) => op.folha_obra_id === a.id,
          )
          const bOperacoes = allOperacoes.filter(
            (op) => op.folha_obra_id === b.id,
          )
          const aHasCompleted = aOperacoes.some((op) => op.concluido)
          const bHasCompleted = bOperacoes.some((op) => op.concluido)
          A = aHasCompleted
          B = bHasCompleted
          break
        case 'corte':
          // Sort by operacoes completion status
          const aCorteOps = allOperacoes.filter(
            (op) => op.folha_obra_id === a.id,
          )
          const bCorteOps = allOperacoes.filter(
            (op) => op.folha_obra_id === b.id,
          )
          const aCorteCompleted = aCorteOps.some((op) => op.concluido)
          const bCorteCompleted = bCorteOps.some((op) => op.concluido)
          A = aCorteCompleted
          B = bCorteCompleted
          break
        case 'total_value':
          // Sort by job total value from PHC BO table
          A = jobTotalValues[a.id] ?? 0
          B = jobTotalValues[b.id] ?? 0
          break
        case 'created_at':
          // Use data_in (input date) instead of created_at for proper date sorting
          A = a.data_in ? new Date(a.data_in).getTime() : 0
          B = b.data_in ? new Date(b.data_in).getTime() : 0
          break
        default:
          A = a.id
          B = b.id
      }
      if (typeof A === 'string')
        return sortDir === 'asc' ? A.localeCompare(B) : B.localeCompare(A)
      if (typeof A === 'number') return sortDir === 'asc' ? A - B : B - A
      if (typeof A === 'boolean') return sortDir === 'asc' ? +A - +B : +B - +A
      return 0
    })
    return arr
  }, [filtered, sortCol, sortDir, allOperacoes, hasUserSorted, jobTotalValues])

  /* ---------- render ---------- */
  return (
    <PagePermissionGuard pageId="producao">
      <div className="w-full space-y-6">
        {/* filter bar */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Gestão de Produção</h1>
          <div className="flex items-center gap-2">
            <div className="relative w-28">
              <FilterInput
                placeholder="FO"
                className="h-10"
                value={foF}
                onChange={setFoF}
                onFilterChange={setEffectiveFoF}
              />
            </div>
            <div className="relative w-28">
              <FilterInput
                placeholder="ORC"
                className="h-10"
                value={orcF}
                onChange={setOrcF}
                onFilterChange={setEffectiveOrcF}
              />
            </div>
            <div className="relative flex-1">
              <FilterInput
                placeholder="Nome Campanha"
                className="h-10"
                value={campF}
                onChange={setCampF}
                onFilterChange={setEffectiveCampF}
              />
            </div>
            <div className="relative flex-1">
              <FilterInput
                placeholder="Item"
                className="h-10"
                value={itemF}
                onChange={setItemF}
                onFilterChange={setEffectiveItemF}
              />
            </div>
            <div className="relative w-40">
              <FilterInput
                placeholder="Código"
                className="h-10"
                value={codeF}
                onChange={setCodeF}
                onFilterChange={setEffectiveCodeF}
              />
            </div>
            <div className="relative flex-1">
              <FilterInput
                placeholder="Cliente"
                className="h-10"
                value={clientF}
                onChange={setClientF}
                onFilterChange={setEffectiveClientF}
              />
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                      className="bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => {
                      setFoF('')
                      setOrcF('')
                      setCampF('')
                      setItemF('')
                      setCodeF('')
                      setClientF('')
                      setEffectiveFoF('')
                      setEffectiveOrcF('')
                      setEffectiveCampF('')
                      setEffectiveItemF('')
                      setEffectiveCodeF('')
                      setEffectiveClientF('')
                      fetchJobs(0, true, { activeTab })
                    }}
                    disabled={
                      !foF &&
                      !orcF &&
                      !campF &&
                      !itemF &&
                      !codeF &&
                      !clientF &&
                      !effectiveFoF &&
                      !effectiveOrcF &&
                      !effectiveCampF &&
                      !effectiveItemF &&
                      !effectiveCodeF &&
                      !effectiveClientF
                    }
                  >
                    <XSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Limpar Filtros</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="border border-black"
                    disabled={isSyncing}
                    onClick={async () => {
                      setIsSyncing(true)
                      try {
                        const resp = await fetch('/api/etl/incremental', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'today_clients' }),
                        })
                        if (!resp.ok) {
                          const body = await resp
                            .json()
                            .catch(() => ({}) as any)
                          console.error('Clients ETL sync failed', body)
                          alert(
                            'Falhou a sincronização de contactos (ETL). Verifique logs do servidor.',
                          )
                          return
                        }

                        // Refresh UI data after successful sync
                        setError(null)
                        setJobs([])
                        setAllItems([])
                        setJobsSaiuStatus({})
                        setCurrentPage(0)
                        setHasMoreJobs(true)
                        await fetchJobs(0, true, {
                          effectiveFoF,
                          effectiveCampF,
                          effectiveItemF,
                          effectiveCodeF,
                          effectiveClientF,
                          showFatura,
                          activeTab,
                        })
                      } catch (e) {
                        console.error(
                          'Erro ao executar sincronização de contactos:',
                          e,
                        )
                        alert('Erro ao executar sincronização de contactos.')
                      } finally {
                        setIsSyncing(false)
                      }
                    }}
                  >
                    <FileUser className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sincronizar Contactos</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="border border-black"
                    disabled={isSyncing}
                    onClick={async () => {
                      setIsSyncing(true)
                      try {
                        const resp = await fetch('/api/etl/incremental', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'today_bo_bi' }),
                        })
                        if (!resp.ok) {
                          const body = await resp
                            .json()
                            .catch(() => ({}) as any)
                          console.error('ETL incremental sync failed', body)
                          alert(
                            'Falhou a sincronização incremental (ETL). Verifique logs do servidor.',
                          )
                          return
                        }

                        setError(null)
                        setJobs([])
                        setAllItems([])
                        setJobsSaiuStatus({})
                        setCurrentPage(0)
                        setHasMoreJobs(true)
                        await fetchJobs(0, true, {
                          effectiveFoF,
                          effectiveCampF,
                          effectiveItemF,
                          effectiveCodeF,
                          effectiveClientF,
                          showFatura,
                          activeTab,
                        })
                      } catch (e) {
                        console.error(
                          'Erro ao executar sincronização incremental:',
                          e,
                        )
                        alert('Erro ao executar sincronização incremental.')
                      } finally {
                        setIsSyncing(false)
                      }
                    }}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Atualizar Folhas de Obra</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="border border-black gap-2"
                    onClick={async () => {
                      setShowTotals(!showTotals)
                      if (!showTotals) {
                        await fetchFoTotals()
                      }
                    }}
                  >
                    {showTotals ? (
                      <>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-semibold">Em Curso: €{Math.round(foTotals.em_curso).toLocaleString('pt-PT', { useGrouping: true })}</span>
                          <span className="text-xs font-semibold">Pendentes: €{Math.round(foTotals.pendentes).toLocaleString('pt-PT', { useGrouping: true })}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <ReceiptText className="h-4 w-4" />
                        <span className="text-sm">Totais FO</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showTotals ? 'Ocultar Totais' : 'Ver Total de Valores das FOs'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="border border-black"
                    onClick={async () => {
                      if (sorted.length === 0) {
                        alert('Não há dados para exportar.')
                        return
                      }

                      try {
                        // Fetch detailed data for export including logistics information
                        const jobIds = sorted
                          .map((job) => job.id)
                          .filter((id) => !id.startsWith('temp-'))

                        if (jobIds.length === 0) {
                          alert('Não há trabalhos válidos para exportar.')
                          return
                        }

                        console.log(
                          `Exporting data for ${jobIds.length} jobs with incomplete logistics...`,
                        )

                        // First fetch transportadoras for name resolution
                        const {
                          data: transportadorasData,
                          error: transportadorasError,
                        } = await supabase
                          .from('transportadora')
                          .select('id, name')

                        if (transportadorasError) {
                          console.error(
                            'Error fetching transportadoras:',
                            transportadorasError,
                          )
                        }

                        const transportadorasMap = new Map(
                          (transportadorasData || []).map((t: any) => [
                            t.id,
                            t.name,
                          ]),
                        )

                        // Fetch clientes with address information for location lookups
                        const { data: clientesData, error: clientesError } =
                          await supabase
                            .schema('phc')
                            .from('cl')
                            .select(
                              'customer_id, customer_name, address, postal_code',
                            )

                        if (clientesError) {
                          console.error(
                            'Error fetching clientes:',
                            clientesError,
                          )
                        }

                        const clientesForExport = (clientesData || []).map(
                          (c: any) => ({
                            value: c.customer_id.toString(),
                            label: c.customer_name,
                            morada: c.address,
                            codigo_pos: c.postal_code,
                          }),
                        )

                        // STEP 1: Fetch items for these jobs
                        const { data: itemsData, error: itemsError } =
                          await supabase
                            .from('items_base')
                            .select('id, folha_obra_id, descricao, quantidade')
                            .in('folha_obra_id', jobIds)

                        if (itemsError) {
                          console.error('Error fetching items:', itemsError)
                          alert('Erro ao buscar itens.')
                          return
                        }

                        if (!itemsData || itemsData.length === 0) {
                          alert('Não há itens para exportar.')
                          return
                        }

                        const itemIds = itemsData.map((i: any) => i.id)

                        // STEP 2: Fetch logistica for these items (only incomplete)
                        const { data: logisticaData, error: logisticaError } =
                          await supabase
                            .from('logistica_entregas')
                            .select(
                              'item_id, data_concluido, data_saida, transportadora, local_entrega, local_recolha, id_local_entrega, id_local_recolha, concluido, notas, guia, contacto_entrega',
                            )
                            .in('item_id', itemIds)
                            .eq('concluido', false)

                        if (logisticaError) {
                          console.error(
                            'Error fetching logistics:',
                            logisticaError,
                          )
                          alert('Erro ao buscar dados de logística.')
                          return
                        }

                        if (!logisticaData || logisticaData.length === 0) {
                          alert(
                            'Não há itens com logística incompleta para exportar.',
                          )
                          return
                        }

                        // STEP 3: Fetch folhas_obras (including Nome which contains cliente name)
                        const { data: folhasData, error: folhasError } =
                          await supabase
                            .from('folhas_obras')
                            .select('id, numero_orc, Numero_do_, Trabalho, Data_do_do, Nome, data_in, created_at')
                            .in('id', jobIds)

                        if (folhasError) {
                          console.error('Error fetching folhas obras:', folhasError)
                          alert('Erro ao buscar folhas de obra.')
                          return
                        }

                        // Create lookup maps
                        const itemsMap = new Map(
                          itemsData.map((i: any) => [i.id, i]),
                        )
                        const folhasMap = new Map(
                          folhasData?.map((f: any) => [f.id, f]) || [],
                        )
                        const logisticaMap = new Map<string, any[]>()

                        // Group logistics by item_id
                        logisticaData.forEach((log: any) => {
                          if (!logisticaMap.has(log.item_id)) {
                            logisticaMap.set(log.item_id, [])
                          }
                          logisticaMap.get(log.item_id)!.push(log)
                        })

                        // Transform data for export
                        const exportRows: any[] = []
                        logisticaData.forEach((log: any) => {
                          const item = itemsMap.get(log.item_id)
                          if (!item) return

                          const folhaObra = folhasMap.get(item.folha_obra_id)
                          if (!folhaObra) return

                          // Resolve transportadora ID to name
                          const transportadoraName = log.transportadora
                            ? transportadorasMap.get(log.transportadora) ||
                              log.transportadora
                            : ''

                          exportRows.push({
                            numero_orc: folhaObra.numero_orc || null,
                            numero_fo: folhaObra.Numero_do_
                              ? String(folhaObra.Numero_do_)
                              : '',
                            cliente_nome: folhaObra.Nome || '', // Cliente name from folhas_obras.Nome
                            quantidade: item.quantidade || null,
                            nome_campanha: folhaObra.Trabalho || '',
                            descricao: item.descricao || '',
                            data_in: folhaObra.data_in || folhaObra.created_at || null,
                            data_saida: log.data_saida || null,
                            data_concluido: log.data_concluido || null,
                            transportadora: transportadoraName,
                            local_entrega: log.local_entrega || '',
                            local_recolha: log.local_recolha || '',
                            id_local_entrega: log.id_local_entrega || '',
                            id_local_recolha: log.id_local_recolha || '',
                            notas: log.notas || '',
                            guia: log.guia || '',
                            contacto_entrega: log.contacto_entrega || '',
                          })
                        })

                        // ALWAYS fetch both EM CURSO and PENDENTES data for export
                        // This ensures all 4 sheets can be created regardless of active tab

                        // Determine which dataset to use for EM CURSO sheet
                        let emCursoRows: any[] = []
                        let pendentesRows: any[] = []

                        if (activeTab === 'pendentes') {
                          // If on PENDENTES tab, current exportRows is PENDENTES data
                          // Need to fetch EM CURSO data
                          pendentesRows = exportRows

                          try {
                            // Fetch em_curso jobs (pendente = false, concluido = false)
                            const { data: emCursoJobsData, error: emCursoJobsError } =
                              await supabase
                                .from('folhas_obras')
                                .select('id, numero_orc, Numero_do_, Trabalho, Data_do_do, Nome, data_in, created_at')
                                .eq('pendente', false)
                                .eq('concluido', false)
                                .order('Numero_do_', { ascending: false })

                            if (!emCursoJobsError && emCursoJobsData && emCursoJobsData.length > 0) {
                              const emCursoJobIds = emCursoJobsData.map((j: any) => j.id)

                              // Fetch items for em_curso jobs
                              const { data: emCursoItemsData, error: emCursoItemsError } =
                                await supabase
                                  .from('items_base')
                                  .select('id, folha_obra_id, descricao, quantidade')
                                  .in('folha_obra_id', emCursoJobIds)

                              if (!emCursoItemsError && emCursoItemsData) {
                                const emCursoItemIds = emCursoItemsData.map((i: any) => i.id)

                                // Fetch logistica for em_curso items
                                const { data: emCursoLogisticaData, error: emCursoLogisticaError } =
                                  await supabase
                                    .from('logistica_entregas')
                                    .select(
                                      'item_id, data_saida, data_concluido, transportadora, local_entrega, local_recolha, id_local_entrega, id_local_recolha, notas, guia, contacto_entrega',
                                    )
                                    .in('item_id', emCursoItemIds)
                                    .eq('concluido', false)

                                if (!emCursoLogisticaError && emCursoLogisticaData && emCursoLogisticaData.length > 0) {
                                  const emCursoItemsMap = new Map(
                                    emCursoItemsData.map((i: any) => [i.id, i]),
                                  )
                                  const emCursoFolhasMap = new Map(
                                    emCursoJobsData.map((f: any) => [f.id, f]),
                                  )

                                  emCursoLogisticaData.forEach((log: any) => {
                                    const item = emCursoItemsMap.get(log.item_id)
                                    if (!item) return

                                    const folhaObra = emCursoFolhasMap.get(item.folha_obra_id)
                                    if (!folhaObra) return

                                    const transportadoraName = log.transportadora
                                      ? transportadorasMap.get(log.transportadora) || log.transportadora
                                      : ''

                                    emCursoRows.push({
                                      numero_orc: folhaObra.numero_orc || null,
                                      numero_fo: folhaObra.Numero_do_ ? String(folhaObra.Numero_do_) : '',
                                      cliente_nome: folhaObra.Nome || '',
                                      quantidade: item.quantidade || null,
                                      nome_campanha: folhaObra.Trabalho || '',
                                      descricao: item.descricao || '',
                                      data_in: folhaObra.data_in || folhaObra.created_at || null,
                                      data_saida: log.data_saida || null,
                                      data_concluido: log.data_concluido || null,
                                      transportadora: transportadoraName,
                                      local_entrega: log.local_entrega || '',
                                      local_recolha: log.local_recolha || '',
                                      id_local_entrega: log.id_local_entrega || '',
                                      id_local_recolha: log.id_local_recolha || '',
                                      notas: log.notas || '',
                                      guia: log.guia || '',
                                      contacto_entrega: log.contacto_entrega || '',
                                    })
                                  })
                                }
                              }
                            }
                          } catch (error) {
                            console.error('Error fetching em_curso data:', error)
                          }
                        } else {
                          // If on EM CURSO or CONCLUIDOS tab, current exportRows is EM CURSO data
                          // Need to fetch PENDENTES data
                          emCursoRows = exportRows

                          try {
                            // Fetch pendentes jobs
                            const { data: pendentesJobsData, error: pendentesJobsError } =
                              await supabase
                                .from('folhas_obras')
                                .select('id, numero_orc, Numero_do_, Trabalho, Data_do_do, Nome, data_in, created_at')
                                .eq('pendente', true)
                                .order('Numero_do_', { ascending: false })

                            if (!pendentesJobsError && pendentesJobsData && pendentesJobsData.length > 0) {
                              const pendentesJobIds = pendentesJobsData.map((j: any) => j.id)

                              // Fetch items for pendentes jobs
                              const { data: pendentesItemsData, error: pendentesItemsError } =
                                await supabase
                                  .from('items_base')
                                  .select('id, folha_obra_id, descricao, quantidade')
                                  .in('folha_obra_id', pendentesJobIds)

                              if (!pendentesItemsError && pendentesItemsData && pendentesItemsData.length > 0) {
                                const pendentesItemIds = pendentesItemsData.map((i: any) => i.id)

                                // Fetch logistica for pendentes items (from logistica_entregas table)
                                const { data: pendentesLogisticaData, error: pendentesLogisticaError } =
                                  await supabase
                                    .from('logistica_entregas')
                                    .select(
                                      'item_id, data_saida, data_concluido, transportadora, local_entrega, local_recolha, id_local_entrega, id_local_recolha, notas, guia, contacto_entrega',
                                    )
                                    .in('item_id', pendentesItemIds)

                                if (!pendentesLogisticaError && pendentesLogisticaData) {
                                  const pendentesItemsMap = new Map(
                                    pendentesItemsData.map((i: any) => [i.id, i]),
                                  )
                                  const pendentesFolhasMap = new Map(
                                    pendentesJobsData.map((f: any) => [f.id, f]),
                                  )

                                  pendentesLogisticaData.forEach((log: any) => {
                                    const item = pendentesItemsMap.get(log.item_id)
                                    if (!item) return

                                    const folhaObra = pendentesFolhasMap.get(item.folha_obra_id)
                                    if (!folhaObra) return

                                    const transportadoraName = log.transportadora
                                      ? transportadorasMap.get(log.transportadora) || log.transportadora
                                      : ''

                                    pendentesRows.push({
                                      numero_orc: folhaObra.numero_orc || null,
                                      numero_fo: folhaObra.Numero_do_ ? String(folhaObra.Numero_do_) : '',
                                      cliente_nome: folhaObra.Nome || '',
                                      quantidade: item.quantidade || null,
                                      nome_campanha: folhaObra.Trabalho || '',
                                      descricao: item.descricao || '',
                                      data_in: folhaObra.data_in || folhaObra.created_at || null,
                                      data_saida: log.data_saida || null,
                                      data_concluido: log.data_concluido || null,
                                      transportadora: transportadoraName,
                                      local_entrega: log.local_entrega || '',
                                      local_recolha: log.local_recolha || '',
                                      id_local_entrega: log.id_local_entrega || '',
                                      id_local_recolha: log.id_local_recolha || '',
                                      notas: log.notas || '',
                                      guia: log.guia || '',
                                      contacto_entrega: log.contacto_entrega || '',
                                    })
                                  })
                                }
                              }
                            }
                          } catch (error) {
                            console.error('Error fetching pendentes data:', error)
                          }
                        }

                        // Call the export function with both datasets
                        exportProducaoToExcel({
                          filteredRecords: emCursoRows,
                          pendentesRecords: pendentesRows,
                          activeTab,
                          clientes: clientesForExport,
                        })
                      } catch (error) {
                        console.error('Error during export:', error)
                        alert('Erro ao exportar dados.')
                      }
                    }}
                    title="Exportar para Excel"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar Excel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {activeTab === 'em_curso' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="bg-yellow-400 hover:bg-yellow-500 border border-black text-black"
                      onClick={() => {
                        // Add a new empty row to the table for inline editing
                        const tempId = `temp-${Date.now()}`
                        const newJob: Job = {
                          id: tempId,
                          numero_fo: '',
                          numero_orc: null,
                          nome_campanha: '',
                          data_saida: null,
                          prioridade: false,
                          notas: null,
                          concluido: false,
                          saiu: false,
                          fatura: false,
                          created_at: null,
                          data_in: null,
                          cliente: '',
                          id_cliente: null,
                          data_concluido: null,
                          updated_at: null,
                        }

                        // Add the new empty job to the beginning of the list
                        setJobs((prevJobs) => [newJob, ...prevJobs])
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Adicionar FO</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Error handling */}
        {error && <ErrorMessage message={error} onRetry={retryFetch} />}

        {/* Calendar Section */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Calendário - Filtrar por Data de Saída</h2>
            {selectedDate && (
              <Button
                variant="outline"
                size="sm"
                className="border border-black"
                onClick={() => setSelectedDate(undefined)}
              >
                <X className="mr-2 h-4 w-4" />
                Limpar Filtro ({format(selectedDate, 'dd/MM/yyyy')})
              </Button>
            )}
          </div>
          <FullYearCalendar
            holidays={holidays}
            year={new Date().getFullYear()}
            onSelect={(date) => setSelectedDate(date)}
          />
        </div>

        {/* Main Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as 'em_curso' | 'concluidos' | 'pendentes')
          }
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="em_curso">
              Em Curso ({activeTab === 'em_curso' ? jobs.length : '...'})
            </TabsTrigger>
            <TabsTrigger value="pendentes">
              Pendentes ({activeTab === 'pendentes' ? jobs.length : '...'})
            </TabsTrigger>
            <TabsTrigger value="concluidos">
              Produção Concluída (
              {activeTab === 'concluidos' ? jobs.length : '...'})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="em_curso">
            {/* Loading state */}
            {loading.jobs && jobs.length === 0 ? (
              <JobsTableSkeleton />
            ) : (
              <>
                {/* jobs table */}
                <div className="bg-background w-full">
                  <div className="w-full">
                    <Table className="w-full imx-table-compact">
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            onClick={() => toggleSort('created_at')}
                            className="border-border sticky top-0 z-10 w-[140px] cursor-pointer overflow-hidden border-b bg-primary text-center  text-ellipsis whitespace-nowrap text-primary-foreground uppercase select-none"
                          >
                            Data{' '}
                            {sortCol === 'created_at' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('numero_orc')}
                            className="border-border sticky top-0 z-10 w-[90px] max-w-[90px] cursor-pointer overflow-hidden border-b bg-primary text-center  text-ellipsis whitespace-nowrap text-primary-foreground uppercase select-none"
                          >
                            ORC{' '}
                            {sortCol === 'numero_orc' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('numero_fo')}
                            className="border-border sticky top-0 z-10 w-[90px] max-w-[90px] cursor-pointer overflow-hidden border-b bg-primary text-center  text-ellipsis whitespace-nowrap text-primary-foreground uppercase select-none"
                          >
                            FO{' '}
                            {sortCol === 'numero_fo' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('cliente')}
                            className="border-border sticky top-0 z-10 w-[200px] cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Cliente{' '}
                            {sortCol === 'cliente' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('nome_campanha')}
                            className="border-border sticky top-0 z-10 flex-1 cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Nome Campanha{' '}
                            {sortCol === 'nome_campanha' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('notas')}
                            className="border-border sticky top-0 z-10 w-[50px] cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Nota{' '}
                            {sortCol === 'notas' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('prioridade')}
                            className="border-border sticky top-0 z-10 w-[210px] cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Status{' '}
                            {sortCol === 'prioridade' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>

                          <TableHead
                            onClick={() => toggleSort('total_value')}
                            className="border-border sticky top-0 z-10 w-[120px] cursor-pointer border-b bg-primary text-right text-primary-foreground uppercase select-none"
                          >
                            Valor{' '}
                            {sortCol === 'total_value' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>

                          <TableHead
                            onClick={() => toggleSort('prioridade')}
                            className="border-border sticky top-0 z-10 w-[36px] cursor-pointer border-b bg-primary p-0 text-center  text-primary-foreground uppercase select-none"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    P{' '}
                                    {sortCol === 'prioridade' &&
                                      (sortDir === 'asc' ? (
                                        <ArrowUp className="ml-1 inline h-3 w-3" />
                                      ) : (
                                        <ArrowDown className="ml-1 inline h-3 w-3" />
                                      ))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Prioridade</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('artwork')}
                            className="border-border sticky top-0 z-10 w-[36px] cursor-pointer border-b bg-primary p-0 text-center  text-primary-foreground uppercase select-none"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    A{' '}
                                    {sortCol === 'artwork' &&
                                      (sortDir === 'asc' ? (
                                        <ArrowUp className="ml-1 inline h-3 w-3" />
                                      ) : (
                                        <ArrowDown className="ml-1 inline h-3 w-3" />
                                      ))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Artes Finais</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('corte')}
                            className="border-border sticky top-0 z-10 w-[36px] cursor-pointer border-b bg-primary p-0 text-center  text-primary-foreground uppercase select-none"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    C{' '}
                                    {sortCol === 'corte' &&
                                      (sortDir === 'asc' ? (
                                        <ArrowUp className="ml-1 inline h-3 w-3" />
                                      ) : (
                                        <ArrowDown className="ml-1 inline h-3 w-3" />
                                      ))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Corte</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>

                          <TableHead
                            onClick={() => toggleSort('pendente')}
                            className="border-border sticky top-0 z-10 w-[40px] cursor-pointer border-b bg-primary text-center  text-primary-foreground uppercase select-none"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    SB{' '}
                                    {sortCol === 'pendente' &&
                                      (sortDir === 'asc' ? (
                                        <ArrowUp className="ml-1 inline h-3 w-3" />
                                      ) : (
                                        <ArrowDown className="ml-1 inline h-3 w-3" />
                                      ))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Stand By</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                          <TableHead className="border-border sticky top-0 z-10 w-[100px] border-b bg-primary text-center  text-primary-foreground uppercase">
                            Ações
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map((job) => {
                          const its = allItems.filter(
                            (i) => i.folha_obra_id === job.id,
                          )
                          const pct =
                            jobsCompletionStatus[job.id]?.percentage || 0

                          return (
                            <TableRow
                              key={job.id}
                              className="imx-row-hover"
                            >
                              <TableCell className="w-[140px] text-center text-xs">
                                {formatDatePortuguese(job.data_in)}
                              </TableCell>
                              <TableCell className="w-[90px] max-w-[90px]">
                                <Input
                                  type="text"
                                  maxLength={6}
                                  value={job.numero_orc ?? ''}
                                  onChange={(e) => {
                                    const value =
                                      e.target.value === ''
                                        ? null
                                        : e.target.value
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, numero_orc: value }
                                          : j,
                                      ),
                                    )
                                  }}
                                  onBlur={async (e) => {
                                    const inputValue = e.target.value.trim()
                                    const value =
                                      inputValue === ''
                                        ? null
                                        : inputValue

                                    // Skip validation for empty values
                                    if (!inputValue) {
                                      if (!job.id.startsWith('temp-')) {
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ numero_orc: value })
                                          .eq('id', job.id)
                                      }
                                      return
                                    }

                                    // Check for duplicates
                                    const existingJob = await checkOrcDuplicate(
                                      inputValue,
                                      job.id,
                                    )

                                    if (existingJob) {
                                      // Show duplicate warning dialog
                                      setDuplicateDialog({
                                        isOpen: true,
                                        type: 'orc',
                                        value: inputValue,
                                        existingJob,
                                        currentJobId: job.id,
                                        originalValue: job.numero_orc,
                                        onConfirm: async () => {
                                          // User confirmed to proceed with duplicate
                                          if (job.id.startsWith('temp-')) {
                                            // Prefill from PHC by ORC and insert, then import lines
                                            try {
                                              await prefillAndInsertFromOrc(
                                                inputValue,
                                                job.id,
                                              )
                                            } catch (error) {
                                              console.error(
                                                'Error creating job from ORC:',
                                                error,
                                              )
                                            }
                                          } else {
                                            // For existing jobs, update
                                            await supabase
                                              .from('folhas_obras')
                                              .update({
                                                numero_orc: inputValue,
                                              })
                                              .eq('id', job.id)
                                          }
                                          setDuplicateDialog({
                                            isOpen: false,
                                            type: 'orc',
                                            value: '',
                                            currentJobId: '',
                                          })
                                        },
                                        onCancel: () => {
                                          // Revert the input value
                                          setJobs((prevJobs) =>
                                            prevJobs.map((j) =>
                                              j.id === job.id
                                                ? {
                                                    ...j,
                                                    numero_orc: job.numero_orc,
                                                  }
                                                : j,
                                            ),
                                          )
                                          setDuplicateDialog({
                                            isOpen: false,
                                            type: 'orc',
                                            value: '',
                                            currentJobId: '',
                                          })
                                        },
                                      })
                                    } else {
                                      // No duplicate found, proceed with update/insert
                                      if (job.id.startsWith('temp-')) {
                                        // Prefill from PHC by ORC and insert, then import lines
                                        try {
                                          await prefillAndInsertFromOrc(
                                            inputValue,
                                            job.id,
                                          )
                                        } catch (error) {
                                          console.error(
                                            'Error creating job from ORC:',
                                            error,
                                          )
                                        }
                                      } else {
                                        // For existing jobs, update
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ numero_orc: inputValue })
                                          .eq('id', job.id)
                                      }
                                    }
                                  }}
                                  className="h-10 text-right text-sm"
                                  placeholder="ORC"
                                />
                              </TableCell>
                              <TableCell className="w-[90px] max-w-[90px]">
                                <Input
                                  maxLength={6}
                                  value={job.numero_fo}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, numero_fo: value }
                                          : j,
                                      ),
                                    )
                                  }}
                                  onBlur={async (e) => {
                                    const value = e.target.value.trim()

                                    if (job.id.startsWith('temp-') && value) {
                                      // Check for duplicates before creating new job
                                      const existingJob =
                                        await checkFoDuplicate(value, '')

                                      if (existingJob) {
                                        // Show duplicate warning dialog
                                        setDuplicateDialog({
                                          isOpen: true,
                                          type: 'fo',
                                          value: value,
                                          existingJob,
                                          currentJobId: job.id,
                                          originalValue: '',
                                          onConfirm: async () => {
                                            // User confirmed to proceed with duplicate
                                            try {
                                              await prefillAndInsertFromFo(
                                                value,
                                                job.id,
                                              )
                                            } catch (error) {
                                              console.error(
                                                'Error creating job from FO:',
                                                error,
                                              )
                                            }
                                            setDuplicateDialog({
                                              isOpen: false,
                                              type: 'fo',
                                              value: '',
                                              currentJobId: '',
                                            })
                                          },
                                          onCancel: () => {
                                            // Clear the input value
                                            setJobs((prevJobs) =>
                                              prevJobs.map((j) =>
                                                j.id === job.id
                                                  ? { ...j, numero_fo: '' }
                                                  : j,
                                              ),
                                            )
                                            setDuplicateDialog({
                                              isOpen: false,
                                              type: 'fo',
                                              value: '',
                                              currentJobId: '',
                                            })
                                          },
                                        })
                                      } else {
                                        // No duplicate found, prefill from PHC and insert
                                        try {
                                          await prefillAndInsertFromFo(
                                            value,
                                            job.id,
                                          )
                                        } catch (error) {
                                          console.error(
                                            'Error creating job from FO:',
                                            error,
                                          )
                                        }
                                      }
                                    } else if (!job.id.startsWith('temp-')) {
                                      // Check for duplicates before updating existing job
                                      if (value) {
                                        const existingJob =
                                          await checkFoDuplicate(value, job.id)

                                        if (existingJob) {
                                          // Show duplicate warning dialog
                                          setDuplicateDialog({
                                            isOpen: true,
                                            type: 'fo',
                                            value: value,
                                            existingJob,
                                            currentJobId: job.id,
                                            originalValue: job.numero_fo,
                                            onConfirm: async () => {
                                              // User confirmed to proceed with duplicate
                                              await supabase
                                                .from('folhas_obras')
                                                .update({ Numero_do_: value })
                                                .eq('id', job.id)
                                              setDuplicateDialog({
                                                isOpen: false,
                                                type: 'fo',
                                                value: '',
                                                currentJobId: '',
                                              })
                                            },
                                            onCancel: () => {
                                              // Revert the input value to original
                                              setJobs((prevJobs) =>
                                                prevJobs.map((j) =>
                                                  j.id === job.id
                                                    ? {
                                                        ...j,
                                                        numero_fo:
                                                          job.numero_fo,
                                                      }
                                                    : j,
                                                ),
                                              )
                                              setDuplicateDialog({
                                                isOpen: false,
                                                type: 'fo',
                                                value: '',
                                                currentJobId: '',
                                              })
                                            },
                                          })
                                        } else {
                                          // No duplicate found, proceed with update
                                          await supabase
                                            .from('folhas_obras')
                                            .update({ Numero_do_: value })
                                            .eq('id', job.id)
                                        }
                                      } else {
                                        // Empty value, just update
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ Numero_do_: value })
                                          .eq('id', job.id)
                                      }
                                    }
                                  }}
                                  className="h-10 text-right text-sm"
                                  placeholder="FO"
                                />
                              </TableCell>
                              <TableCell className="w-[200px]">
                                <CreatableClienteCombobox
                                  value={job.id_cliente || ''}
                                  onChange={async (selectedId: string) => {
                                    const selected = clientes.find(
                                      (c) => c.value === selectedId,
                                    )
                                    // Debug logging
                                    console.log(
                                      `Job ${job.numero_fo} - selecting cliente: ${selectedId} -> ${selected?.label}`,
                                    )
                                    console.log(`Current job.id_cliente: ${job.id_cliente}, job.cliente: "${job.cliente}"`)
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? {
                                              ...j,
                                              id_cliente: selectedId,
                                              cliente: selected
                                                ? selected.label
                                                : '',
                                            }
                                          : j,
                                      ),
                                    )
                                    // Persist to Supabase if not a temp job
                                    if (!job.id.startsWith('temp-')) {
                                      const selectedCustomerId = selected ? parseInt(selected.value, 10) : null
                                      await supabase
                                        .from('folhas_obras')
                                        .update({
                                          Nome: selected?.label || '',
                                          customer_id: selectedCustomerId,
                                        })
                                        .eq('id', job.id)
                                    }
                                  }}
                                  options={clientes}
                                  onOptionsUpdate={(
                                    newClientes: ClienteOption[],
                                  ) => {
                                    setClientes(newClientes) // Update the clientes list when a new one is created
                                  }}
                                  placeholder="Cliente"
                                  disabled={loading.clientes}
                                  loading={loading.clientes}
                                  displayLabel={job.cliente || undefined}
                                />
                              </TableCell>
                              <TableCell className="flex-1">
                                <Input
                                  value={job.nome_campanha}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, nome_campanha: value }
                                          : j,
                                      ),
                                    )
                                  }}
                                  onBlur={async (e) => {
                                    const value = e.target.value
                                    // Update the job if it exists in database
                                    if (!job.id.startsWith('temp-')) {
                                      await supabase
                                        .from('folhas_obras')
                                        .update({ Trabalho: value })
                                        .eq('id', job.id)
                                    }
                                  }}
                                  className="h-10 w-full text-sm"
                                  placeholder="Nome da Campanha"
                                />
                              </TableCell>
                              <TableCell className="w-[50px] text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <SimpleNotasPopover
                                          value={job.notas ?? ''}
                                          onSave={async (newNotas) => {
                                            await supabase
                                              .from('folhas_obras')
                                              .update({ notas: newNotas })
                                              .eq('id', job.id)
                                            setJobs((prev: Job[]) =>
                                              prev.map((j: Job) =>
                                                j.id === job.id
                                                  ? { ...j, notas: newNotas }
                                                  : j,
                                              ),
                                            )
                                          }}
                                          placeholder="Adicionar notas..."
                                          label="Notas"
                                          buttonSize="icon"
                                          className="mx-auto aspect-square"
                                          disabled={false}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    {job.notas && job.notas.trim() !== '' && (
                                      <TooltipContent>
                                        {job.notas}
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="w-[210px]">
                                <div className="flex w-full items-center gap-2">
                                  <Progress value={pct} className="w-full" />
                                  <span className="w-10 text-right font-mono text-xs">
                                    {pct}%
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="w-[120px] text-right text-sm font-mono">
                                {jobTotalValues[job.id]
                                  ? new Intl.NumberFormat('pt-PT', {
                                      style: 'currency',
                                      currency: 'EUR',
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    }).format(jobTotalValues[job.id])
                                  : '—'}
                              </TableCell>

                              <TableCell className="w-[36px] p-0 text-center">
                                <button
                                  className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getPColor(job)}`}
                                  title={
                                    job.prioridade
                                      ? 'Prioritário'
                                      : job.data_in &&
                                          (Date.now() -
                                            new Date(job.data_in).getTime()) /
                                            (1000 * 60 * 60 * 24) >
                                            3
                                        ? 'Aguardando há mais de 3 dias'
                                        : 'Normal'
                                  }
                                  onClick={async () => {
                                    const newPrioridade = !job.prioridade
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, prioridade: newPrioridade }
                                          : j,
                                      ),
                                    )
                                    // Persist to Supabase
                                    await supabase
                                      .from('folhas_obras')
                                      .update({ prioridade: newPrioridade })
                                      .eq('id', job.id)
                                  }}
                                />
                              </TableCell>
                              <TableCell className="w-[36px] p-0 text-center">
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
                                    <TooltipContent>
                                      Artes Finais
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="w-[36px] p-0 text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <span
                                          className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getCColor(job.id, allOperacoes)}`}
                                          title="Corte"
                                        />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Corte</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>

                              <TableCell className="w-[40px] p-0 text-center">
                                <Checkbox
                                  checked={job.pendente ?? false}
                                  onCheckedChange={async (checked) => {
                                    const previousPendente =
                                      job.pendente ?? false
                                    const newPendente = checked === true

                                    // Immediately remove from current view
                                    setJobs((prevJobs) =>
                                      prevJobs.filter((j) => j.id !== job.id),
                                    )

                                    if (!job.id.startsWith('temp-')) {
                                      try {
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ pendente: newPendente })
                                          .eq('id', job.id)
                                      } catch (error) {
                                        console.error(
                                          'Error updating pendente status:',
                                          error,
                                        )
                                        // Restore job on error
                                        setJobs((prevJobs) => [
                                          ...prevJobs,
                                          {
                                            ...job,
                                            pendente: previousPendente,
                                          },
                                        ])
                                      }
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="w-[100px] p-0 pr-2">
                                <div className="flex justify-center gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="default"
                                          className="border border-black"
                                          onClick={() => {
                                            console.log('👆 [BUTTON CLICK] Eye button clicked')
                                            console.log('👆 [BUTTON CLICK] Job ID:', job.id)
                                            console.log('👆 [BUTTON CLICK] Current openId:', openId)
                                            console.log('👆 [BUTTON CLICK] Timestamp:', new Date().toISOString())
                                            setOpenId(job.id)
                                          }}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Items</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="destructive"
                                          className="border border-black"
                                          onClick={async () => {
                                            // Handle temp jobs differently (they don't exist in database yet)
                                            if (job.id.startsWith('temp-')) {
                                              console.log(`🗑️ Removing temp job ${job.numero_fo} from UI only`)
                                              setJobs((prevJobs) =>
                                                prevJobs.filter(
                                                  (j) => j.id !== job.id,
                                                ),
                                              )
                                              return
                                            }

                                            if (
                                              !confirm(
                                                `Tem certeza que deseja eliminar a Folha de Obra ${job.numero_fo}? Esta ação irá eliminar todos os itens e dados logísticos associados.`,
                                              )
                                            ) {
                                              return
                                            }

                                            try {
                                              console.log(`🗑️ Deleting job ${job.numero_fo} (ID: ${job.id})`)
                                              
                                              // Delete from folhas_obras - CASCADE will handle related tables:
                                              // - items_base (CASCADE)
                                              // - logistica_entregas (CASCADE via items_base)
                                              // - designer_items (CASCADE via items_base)
                                              // - producao_operacoes (CASCADE via items_base)
                                              const { error: deleteError } = await supabase
                                                .from('folhas_obras')
                                                .delete()
                                                .eq('id', job.id)

                                              if (deleteError) {
                                                console.error('Delete error details:', deleteError)
                                                throw deleteError
                                              }

                                              console.log(`✅ Folha de Obra ${job.numero_fo} eliminada com sucesso (CASCADE)`)

                                              // Update local state
                                              setJobs((prevJobs) =>
                                                prevJobs.filter(
                                                  (j) => j.id !== job.id,
                                                ),
                                              )
                                              setAllItems((prevItems) =>
                                                prevItems.filter(
                                                  (item) =>
                                                    item.folha_obra_id !==
                                                    job.id,
                                                ),
                                              )
                                            } catch (error) {
                                              console.error(
                                                'Error deleting job:',
                                                error,
                                              )
                                              alert(
                                                'Erro ao eliminar a Folha de Obra. Tente novamente.',
                                              )
                                            }
                                          }}
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
                        })}
                        {sorted.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={13}
                              className="py-8 text-center"
                            >
                              Nenhum trabalho encontrado.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Load More Button */}
                {hasMoreJobs && !loading.jobs && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" onClick={loadMoreJobs}>
                      <Loader2
                        className={`mr-2 h-4 w-4 ${loading.jobs ? 'animate-spin' : ''}`}
                      />
                      Load More Jobs ({JOBS_PER_PAGE} more)
                    </Button>
                  </div>
                )}

                {/* Loading indicator for additional pages */}
                {loading.jobs && jobs.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading more jobs...
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="concluidos">
            {/* Loading state */}
            {loading.jobs && jobs.length === 0 ? (
              <JobsTableSkeleton />
            ) : (
              <>
                {/* jobs table - simplified without P, A, C, and Ações columns */}
                <div className="bg-background w-full">
                  <div className="w-full">
                    <Table className="w-full imx-table-compact">
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            onClick={() => toggleSort('created_at')}
                            className="border-border sticky top-0 z-10 w-[140px] cursor-pointer overflow-hidden border-b bg-primary text-center  text-ellipsis whitespace-nowrap text-primary-foreground uppercase select-none"
                          >
                            Data{' '}
                            {sortCol === 'created_at' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('numero_orc')}
                            className="border-border sticky top-0 z-10 w-[90px] max-w-[90px] cursor-pointer overflow-hidden border-b bg-primary text-center  text-ellipsis whitespace-nowrap text-primary-foreground uppercase select-none"
                          >
                            ORC{' '}
                            {sortCol === 'numero_orc' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('numero_fo')}
                            className="border-border sticky top-0 z-10 w-[90px] max-w-[90px] cursor-pointer overflow-hidden border-b bg-primary text-center  text-ellipsis whitespace-nowrap text-primary-foreground uppercase select-none"
                          >
                            FO{' '}
                            {sortCol === 'numero_fo' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('cliente')}
                            className="border-border sticky top-0 z-10 w-[200px] cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Cliente{' '}
                            {sortCol === 'cliente' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('nome_campanha')}
                            className="border-border sticky top-0 z-10 flex-1 cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Nome Campanha{' '}
                            {sortCol === 'nome_campanha' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('notas')}
                            className="border-border sticky top-0 z-10 w-[50px] cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Nota{' '}
                            {sortCol === 'notas' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('prioridade')}
                            className="border-border sticky top-0 z-10 w-[210px] cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Status{' '}
                            {sortCol === 'prioridade' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            className="border-border sticky top-0 z-10 w-[36px] border-b bg-primary p-0 text-center text-primary-foreground uppercase select-none"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>C</span>
                                </TooltipTrigger>
                                <TooltipContent>Concluído</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map((job) => {
                          const its = allItems.filter(
                            (i) => i.folha_obra_id === job.id,
                          )
                          const pct =
                            jobsCompletionStatus[job.id]?.percentage || 0

                          return (
                            <TableRow
                              key={job.id}
                              className="imx-row-hover"
                            >
                              <TableCell className="w-[140px] text-center text-xs">
                                {formatDatePortuguese(job.data_in)}
                              </TableCell>
                              <TableCell className="w-[90px] max-w-[90px]">
                                <Input
                                  type="text"
                                  maxLength={6}
                                  value={job.numero_orc ?? ''}
                                  onChange={(e) => {
                                    const value =
                                      e.target.value === ''
                                        ? null
                                        : e.target.value
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, numero_orc: value }
                                          : j,
                                      ),
                                    )
                                  }}
                                  onBlur={async (e) => {
                                    const inputValue = e.target.value.trim()
                                    const value =
                                      inputValue === ''
                                        ? null
                                        : inputValue

                                    // Skip validation for empty values
                                    if (!inputValue) {
                                      if (!job.id.startsWith('temp-')) {
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ numero_orc: value })
                                          .eq('id', job.id)
                                      }
                                      return
                                    }

                                    // Check for duplicates
                                    const existingJob = await checkOrcDuplicate(
                                      inputValue,
                                      job.id,
                                    )

                                    if (existingJob) {
                                      // Show duplicate warning dialog
                                      setDuplicateDialog({
                                        isOpen: true,
                                        type: 'orc',
                                        value: inputValue,
                                        existingJob,
                                        currentJobId: job.id,
                                        originalValue: job.numero_orc,
                                        onConfirm: async () => {
                                          // User confirmed to proceed with duplicate
                                          if (job.id.startsWith('temp-')) {
                                            // Prefill from PHC by ORC and insert, then import lines
                                            try {
                                              await prefillAndInsertFromOrc(
                                                inputValue,
                                                job.id,
                                              )
                                            } catch (error) {
                                              console.error(
                                                'Error creating job from ORC:',
                                                error,
                                              )
                                            }
                                          } else {
                                            // For existing jobs, update
                                            await supabase
                                              .from('folhas_obras')
                                              .update({
                                                numero_orc: inputValue,
                                              })
                                              .eq('id', job.id)
                                          }
                                          setDuplicateDialog({
                                            isOpen: false,
                                            type: 'orc',
                                            value: '',
                                            currentJobId: '',
                                          })
                                        },
                                        onCancel: () => {
                                          // Revert the input value
                                          setJobs((prevJobs) =>
                                            prevJobs.map((j) =>
                                              j.id === job.id
                                                ? {
                                                    ...j,
                                                    numero_orc: job.numero_orc,
                                                  }
                                                : j,
                                            ),
                                          )
                                          setDuplicateDialog({
                                            isOpen: false,
                                            type: 'orc',
                                            value: '',
                                            currentJobId: '',
                                          })
                                        },
                                      })
                                    } else {
                                      // No duplicate found, proceed with update/insert
                                      if (job.id.startsWith('temp-')) {
                                        // Prefill from PHC by ORC and insert, then import lines
                                        try {
                                          await prefillAndInsertFromOrc(
                                            inputValue,
                                            job.id,
                                          )
                                        } catch (error) {
                                          console.error(
                                            'Error creating job from ORC:',
                                            error,
                                          )
                                        }
                                      } else {
                                        // For existing jobs, update
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ numero_orc: inputValue })
                                          .eq('id', job.id)
                                      }
                                    }
                                  }}
                                  className="h-10 text-right text-sm"
                                  placeholder="ORC"
                                />
                              </TableCell>
                              <TableCell className="w-[90px] max-w-[90px]">
                                <Input
                                  maxLength={6}
                                  value={job.numero_fo}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, numero_fo: value }
                                          : j,
                                      ),
                                    )
                                  }}
                                  onBlur={async (e) => {
                                    const value = e.target.value.trim()

                                    if (job.id.startsWith('temp-') && value) {
                                      // Check for duplicates before creating new job
                                      const existingJob =
                                        await checkFoDuplicate(value, '')

                                      if (existingJob) {
                                        // Show duplicate warning dialog
                                        setDuplicateDialog({
                                          isOpen: true,
                                          type: 'fo',
                                          value: value,
                                          existingJob,
                                          currentJobId: job.id,
                                          originalValue: '',
                                          onConfirm: async () => {
                                            // User confirmed to proceed with duplicate
                                            try {
                                              await prefillAndInsertFromFo(
                                                value,
                                                job.id,
                                              )
                                            } catch (error) {
                                              console.error(
                                                'Error creating job from FO:',
                                                error,
                                              )
                                            }
                                            setDuplicateDialog({
                                              isOpen: false,
                                              type: 'fo',
                                              value: '',
                                              currentJobId: '',
                                            })
                                          },
                                          onCancel: () => {
                                            // Clear the input value
                                            setJobs((prevJobs) =>
                                              prevJobs.map((j) =>
                                                j.id === job.id
                                                  ? { ...j, numero_fo: '' }
                                                  : j,
                                              ),
                                            )
                                            setDuplicateDialog({
                                              isOpen: false,
                                              type: 'fo',
                                              value: '',
                                              currentJobId: '',
                                            })
                                          },
                                        })
                                      } else {
                                        // No duplicate found, prefill from PHC and insert
                                        try {
                                          await prefillAndInsertFromFo(
                                            value,
                                            job.id,
                                          )
                                        } catch (error) {
                                          console.error(
                                            'Error creating job from FO:',
                                            error,
                                          )
                                        }
                                      }
                                    } else if (!job.id.startsWith('temp-')) {
                                      // Check for duplicates before updating existing job
                                      if (value) {
                                        const existingJob =
                                          await checkFoDuplicate(value, job.id)

                                        if (existingJob) {
                                          // Show duplicate warning dialog
                                          setDuplicateDialog({
                                            isOpen: true,
                                            type: 'fo',
                                            value: value,
                                            existingJob,
                                            currentJobId: job.id,
                                            originalValue: job.numero_fo,
                                            onConfirm: async () => {
                                              // User confirmed to proceed with duplicate
                                              await supabase
                                                .from('folhas_obras')
                                                .update({ Numero_do_: value })
                                                .eq('id', job.id)
                                              setDuplicateDialog({
                                                isOpen: false,
                                                type: 'fo',
                                                value: '',
                                                currentJobId: '',
                                              })
                                            },
                                            onCancel: () => {
                                              // Revert the input value to original
                                              setJobs((prevJobs) =>
                                                prevJobs.map((j) =>
                                                  j.id === job.id
                                                    ? {
                                                        ...j,
                                                        numero_fo:
                                                          job.numero_fo,
                                                      }
                                                    : j,
                                                ),
                                              )
                                              setDuplicateDialog({
                                                isOpen: false,
                                                type: 'fo',
                                                value: '',
                                                currentJobId: '',
                                              })
                                            },
                                          })
                                        } else {
                                          // No duplicate found, proceed with update
                                          await supabase
                                            .from('folhas_obras')
                                            .update({ Numero_do_: value })
                                            .eq('id', job.id)
                                        }
                                      } else {
                                        // Empty value, just update
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ Numero_do_: value })
                                          .eq('id', job.id)
                                      }
                                    }
                                  }}
                                  className="h-10 text-right text-sm"
                                  placeholder="FO"
                                />
                              </TableCell>
                              <TableCell className="w-[200px]">
                                <CreatableClienteCombobox
                                  value={job.id_cliente || ''}
                                  onChange={async (selectedId: string) => {
                                    const selected = clientes.find(
                                      (c) => c.value === selectedId,
                                    )
                                    // Debug logging
                                    console.log(
                                      `Job ${job.numero_fo} - selecting cliente: ${selectedId} -> ${selected?.label}`,
                                    )
                                    console.log(`Current job.id_cliente: ${job.id_cliente}, job.cliente: "${job.cliente}"`)
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? {
                                              ...j,
                                              id_cliente: selectedId,
                                              cliente: selected
                                                ? selected.label
                                                : '',
                                            }
                                          : j,
                                      ),
                                    )
                                    // Persist to Supabase if not a temp job
                                    if (!job.id.startsWith('temp-')) {
                                      const selectedCustomerId = selected ? parseInt(selected.value, 10) : null
                                      await supabase
                                        .from('folhas_obras')
                                        .update({
                                          Nome: selected?.label || '',
                                          customer_id: selectedCustomerId,
                                        })
                                        .eq('id', job.id)
                                    }
                                  }}
                                  options={clientes}
                                  onOptionsUpdate={(
                                    newClientes: ClienteOption[],
                                  ) => {
                                    setClientes(newClientes) // Update the clientes list when a new one is created
                                  }}
                                  placeholder="Cliente"
                                  disabled={loading.clientes}
                                  loading={loading.clientes}
                                  displayLabel={job.cliente || undefined}
                                />
                              </TableCell>
                              <TableCell className="flex-1">
                                <Input
                                  value={job.nome_campanha}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, nome_campanha: value }
                                          : j,
                                      ),
                                    )
                                  }}
                                  onBlur={async (e) => {
                                    const value = e.target.value
                                    // Update the job if it exists in database
                                    if (!job.id.startsWith('temp-')) {
                                      await supabase
                                        .from('folhas_obras')
                                        .update({ Trabalho: value })
                                        .eq('id', job.id)
                                    }
                                  }}
                                  className="h-10 w-full text-sm"
                                  placeholder="Nome da Campanha"
                                />
                              </TableCell>
                              <TableCell className="w-[50px] text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <SimpleNotasPopover
                                          value={job.notas ?? ''}
                                          onSave={async (newNotas) => {
                                            await supabase
                                              .from('folhas_obras')
                                              .update({ notas: newNotas })
                                              .eq('id', job.id)
                                            setJobs((prev: Job[]) =>
                                              prev.map((j: Job) =>
                                                j.id === job.id
                                                  ? { ...j, notas: newNotas }
                                                  : j,
                                              ),
                                            )
                                          }}
                                          placeholder="Adicionar notas..."
                                          label="Notas"
                                          buttonSize="icon"
                                          className="mx-auto aspect-square"
                                          disabled={false}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    {job.notas && job.notas.trim() !== '' && (
                                      <TooltipContent>
                                        {job.notas}
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="w-[210px]">
                                <div className="flex w-full items-center gap-2">
                                  <Progress value={pct} className="w-full" />
                                  <span className="w-10 text-right font-mono text-xs">
                                    {pct}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="w-[36px] p-0 text-center">
                                {(() => {
                                  const jobItems = allItems.filter(
                                    (item) => item.folha_obra_id === job.id,
                                  )
                                  const allItemsCompleted =
                                    jobItems.length > 0 &&
                                    jobItems.every((item) => item.concluido === true)
                                  
                                  return (
                                    <Checkbox
                                      checked={allItemsCompleted}
                                      onCheckedChange={async (checked) => {
                                        if (jobItems.length === 0) {
                                          return
                                        }
                                        
                                        if (!job.id.startsWith('temp-')) {
                                          try {
                                            const today = new Date().toISOString().split('T')[0]
                                            const newStatus = !allItemsCompleted
                                            
                                            for (const item of jobItems) {
                                              await supabase
                                                .from('logistica_entregas')
                                                .update({ 
                                                  concluido: newStatus,
                                                  data_concluido: newStatus ? today : null,
                                                  data_saida: newStatus ? today : null,
                                                })
                                                .eq('item_id', item.id)
                                            }
                                            
                                            setAllItems((prevItems) =>
                                              prevItems.map((item) =>
                                                jobItems.some((ji) => ji.id === item.id)
                                                  ? { ...item, concluido: newStatus }
                                                  : item,
                                              ),
                                            )
                                          } catch (error) {
                                            console.error(
                                              'Error updating items:',
                                              error,
                                            )
                                          }
                                        }
                                      }}
                                    />
                                  )
                                })()}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {sorted.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="py-8 text-center"
                            >
                              Nenhum trabalho com logística concluída
                              encontrado.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Load More Button */}
                {hasMoreJobs && !loading.jobs && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" onClick={loadMoreJobs}>
                      <Loader2
                        className={`mr-2 h-4 w-4 ${loading.jobs ? 'animate-spin' : ''}`}
                      />
                      Load More Jobs ({JOBS_PER_PAGE} more)
                    </Button>
                  </div>
                )}

                {/* Loading indicator for additional pages */}
                {loading.jobs && jobs.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading more jobs...
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="pendentes">
            {/* Loading state */}
            {loading.jobs && jobs.length === 0 ? (
              <JobsTableSkeleton />
            ) : (
              <>
                {/* jobs table - same structure as em_curso but for pendentes */}
                <div className="bg-background w-full">
                  <div className="w-full">
                    <Table className="w-full imx-table-compact">
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            onClick={() => toggleSort('created_at')}
                            className="border-border sticky top-0 z-10 w-[140px] cursor-pointer overflow-hidden border-b bg-primary text-center  text-ellipsis whitespace-nowrap text-primary-foreground uppercase select-none"
                          >
                            Data{' '}
                            {sortCol === 'created_at' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('numero_orc')}
                            className="border-border sticky top-0 z-10 w-[90px] max-w-[90px] cursor-pointer overflow-hidden border-b bg-primary text-center  text-ellipsis whitespace-nowrap text-primary-foreground uppercase select-none"
                          >
                            ORC{' '}
                            {sortCol === 'numero_orc' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('numero_fo')}
                            className="border-border sticky top-0 z-10 w-[90px] max-w-[90px] cursor-pointer overflow-hidden border-b bg-primary text-center  text-ellipsis whitespace-nowrap text-primary-foreground uppercase select-none"
                          >
                            FO{' '}
                            {sortCol === 'numero_fo' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('cliente')}
                            className="border-border sticky top-0 z-10 w-[200px] cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Cliente{' '}
                            {sortCol === 'cliente' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('nome_campanha')}
                            className="border-border sticky top-0 z-10 flex-1 cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Nome Campanha{' '}
                            {sortCol === 'nome_campanha' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('notas')}
                            className="border-border sticky top-0 z-10 w-[50px] cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Nota{' '}
                            {sortCol === 'notas' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('prioridade')}
                            className="border-border sticky top-0 z-10 w-[210px] cursor-pointer border-b bg-primary  text-primary-foreground uppercase select-none"
                          >
                            Status{' '}
                            {sortCol === 'prioridade' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>

                          <TableHead
                            onClick={() => toggleSort('total_value')}
                            className="border-border sticky top-0 z-10 w-[120px] cursor-pointer border-b bg-primary text-right text-primary-foreground uppercase select-none"
                          >
                            Valor{' '}
                            {sortCol === 'total_value' &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="ml-1 inline h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 inline h-3 w-3" />
                              ))}
                          </TableHead>

                          <TableHead
                            onClick={() => toggleSort('prioridade')}
                            className="border-border sticky top-0 z-10 w-[36px] cursor-pointer border-b bg-primary p-0 text-center  text-primary-foreground uppercase select-none"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    P{' '}
                                    {sortCol === 'prioridade' &&
                                      (sortDir === 'asc' ? (
                                        <ArrowUp className="ml-1 inline h-3 w-3" />
                                      ) : (
                                        <ArrowDown className="ml-1 inline h-3 w-3" />
                                      ))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Prioridade</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('artwork')}
                            className="border-border sticky top-0 z-10 w-[36px] cursor-pointer border-b bg-primary p-0 text-center  text-primary-foreground uppercase select-none"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    A{' '}
                                    {sortCol === 'artwork' &&
                                      (sortDir === 'asc' ? (
                                        <ArrowUp className="ml-1 inline h-3 w-3" />
                                      ) : (
                                        <ArrowDown className="ml-1 inline h-3 w-3" />
                                      ))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Artes Finais</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                          <TableHead
                            onClick={() => toggleSort('corte')}
                            className="border-border sticky top-0 z-10 w-[36px] cursor-pointer border-b bg-primary p-0 text-center  text-primary-foreground uppercase select-none"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    C{' '}
                                    {sortCol === 'corte' &&
                                      (sortDir === 'asc' ? (
                                        <ArrowUp className="ml-1 inline h-3 w-3" />
                                      ) : (
                                        <ArrowDown className="ml-1 inline h-3 w-3" />
                                      ))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Corte</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>

                          <TableHead
                            onClick={() => toggleSort('pendente')}
                            className="border-border sticky top-0 z-10 w-[40px] cursor-pointer border-b bg-primary text-center  text-primary-foreground uppercase select-none"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    SB{' '}
                                    {sortCol === 'pendente' &&
                                      (sortDir === 'asc' ? (
                                        <ArrowUp className="ml-1 inline h-3 w-3" />
                                      ) : (
                                        <ArrowDown className="ml-1 inline h-3 w-3" />
                                      ))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Stand By</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                          <TableHead className="border-border sticky top-0 z-10 w-[100px] border-b bg-primary text-center  text-primary-foreground uppercase">
                            Ações
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map((job) => {
                          const its = allItems.filter(
                            (i) => i.folha_obra_id === job.id,
                          )
                          const pct =
                            jobsCompletionStatus[job.id]?.percentage || 0

                          return (
                            <TableRow
                              key={job.id}
                              className="imx-row-hover"
                            >
                              <TableCell className="w-[140px] text-center text-xs">
                                {formatDatePortuguese(job.data_in)}
                              </TableCell>
                              <TableCell className="w-[90px] max-w-[90px]">
                                <Input
                                  type="text"
                                  maxLength={6}
                                  value={job.numero_orc ?? ''}
                                  onChange={(e) => {
                                    const value =
                                      e.target.value === ''
                                        ? null
                                        : e.target.value
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, numero_orc: value }
                                          : j,
                                      ),
                                    )
                                  }}
                                  onBlur={async (e) => {
                                    const inputValue = e.target.value.trim()
                                    const value =
                                      inputValue === ''
                                        ? null
                                        : inputValue

                                    // Skip validation for empty values
                                    if (!inputValue) {
                                      if (!job.id.startsWith('temp-')) {
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ numero_orc: value })
                                          .eq('id', job.id)
                                      }
                                      return
                                    }

                                    // Check for duplicates
                                    const existingJob = await checkOrcDuplicate(
                                      inputValue,
                                      job.id,
                                    )

                                    if (existingJob) {
                                      // Show duplicate warning dialog
                                      setDuplicateDialog({
                                        isOpen: true,
                                        type: 'orc',
                                        value: inputValue,
                                        existingJob,
                                        currentJobId: job.id,
                                        originalValue: job.numero_orc,
                                        onConfirm: async () => {
                                          // User confirmed to proceed with duplicate
                                          if (job.id.startsWith('temp-')) {
                                            // Prefill from PHC by ORC and insert, then import lines
                                            try {
                                              await prefillAndInsertFromOrc(
                                                inputValue,
                                                job.id,
                                              )
                                            } catch (error) {
                                              console.error(
                                                'Error creating job from ORC:',
                                                error,
                                              )
                                            }
                                          } else {
                                            // For existing jobs, update
                                            await supabase
                                              .from('folhas_obras')
                                              .update({
                                                numero_orc: inputValue,
                                              })
                                              .eq('id', job.id)
                                          }
                                          setDuplicateDialog({
                                            isOpen: false,
                                            type: 'orc',
                                            value: '',
                                            currentJobId: '',
                                          })
                                        },
                                        onCancel: () => {
                                          // Revert the input value
                                          setJobs((prevJobs) =>
                                            prevJobs.map((j) =>
                                              j.id === job.id
                                                ? {
                                                    ...j,
                                                    numero_orc: job.numero_orc,
                                                  }
                                                : j,
                                            ),
                                          )
                                          setDuplicateDialog({
                                            isOpen: false,
                                            type: 'orc',
                                            value: '',
                                            currentJobId: '',
                                          })
                                        },
                                      })
                                    } else {
                                      // No duplicate found, proceed with update/insert
                                      if (job.id.startsWith('temp-')) {
                                        // Prefill from PHC by ORC and insert, then import lines
                                        try {
                                          await prefillAndInsertFromOrc(
                                            inputValue,
                                            job.id,
                                          )
                                        } catch (error) {
                                          console.error(
                                            'Error creating job from ORC:',
                                            error,
                                          )
                                        }
                                      } else {
                                        // For existing jobs, update
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ numero_orc: inputValue })
                                          .eq('id', job.id)
                                      }
                                    }
                                  }}
                                  className="h-10 text-right text-sm"
                                  placeholder="ORC"
                                />
                              </TableCell>
                              <TableCell className="w-[90px] max-w-[90px]">
                                <Input
                                  maxLength={6}
                                  value={job.numero_fo}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, numero_fo: value }
                                          : j,
                                      ),
                                    )
                                  }}
                                  onBlur={async (e) => {
                                    const value = e.target.value.trim()

                                    if (job.id.startsWith('temp-') && value) {
                                      // Check for duplicates before creating new job
                                      const existingJob =
                                        await checkFoDuplicate(value, '')

                                      if (existingJob) {
                                        // Show duplicate warning dialog
                                        setDuplicateDialog({
                                          isOpen: true,
                                          type: 'fo',
                                          value: value,
                                          existingJob,
                                          currentJobId: job.id,
                                          originalValue: '',
                                          onConfirm: async () => {
                                            // User confirmed to proceed with duplicate
                                            try {
                                              await prefillAndInsertFromFo(
                                                value,
                                                job.id,
                                              )
                                            } catch (error) {
                                              console.error(
                                                'Error creating job from FO:',
                                                error,
                                              )
                                            }
                                            setDuplicateDialog({
                                              isOpen: false,
                                              type: 'fo',
                                              value: '',
                                              currentJobId: '',
                                            })
                                          },
                                          onCancel: () => {
                                            // Clear the input value
                                            setJobs((prevJobs) =>
                                              prevJobs.map((j) =>
                                                j.id === job.id
                                                  ? { ...j, numero_fo: '' }
                                                  : j,
                                              ),
                                            )
                                            setDuplicateDialog({
                                              isOpen: false,
                                              type: 'fo',
                                              value: '',
                                              currentJobId: '',
                                            })
                                          },
                                        })
                                      } else {
                                        // No duplicate found, prefill from PHC and insert
                                        try {
                                          await prefillAndInsertFromFo(
                                            value,
                                            job.id,
                                          )
                                        } catch (error) {
                                          console.error(
                                            'Error creating job from FO:',
                                            error,
                                          )
                                        }
                                      }
                                    } else if (!job.id.startsWith('temp-')) {
                                      // Check for duplicates before updating existing job
                                      if (value) {
                                        const existingJob =
                                          await checkFoDuplicate(value, job.id)

                                        if (existingJob) {
                                          // Show duplicate warning dialog
                                          setDuplicateDialog({
                                            isOpen: true,
                                            type: 'fo',
                                            value: value,
                                            existingJob,
                                            currentJobId: job.id,
                                            originalValue: job.numero_fo,
                                            onConfirm: async () => {
                                              // User confirmed to proceed with duplicate
                                              await supabase
                                                .from('folhas_obras')
                                                .update({ Numero_do_: value })
                                                .eq('id', job.id)
                                              setDuplicateDialog({
                                                isOpen: false,
                                                type: 'fo',
                                                value: '',
                                                currentJobId: '',
                                              })
                                            },
                                            onCancel: () => {
                                              // Revert the input value to original
                                              setJobs((prevJobs) =>
                                                prevJobs.map((j) =>
                                                  j.id === job.id
                                                    ? {
                                                        ...j,
                                                        numero_fo:
                                                          job.numero_fo,
                                                      }
                                                    : j,
                                                ),
                                              )
                                              setDuplicateDialog({
                                                isOpen: false,
                                                type: 'fo',
                                                value: '',
                                                currentJobId: '',
                                              })
                                            },
                                          })
                                        } else {
                                          // No duplicate found, proceed with update
                                          await supabase
                                            .from('folhas_obras')
                                            .update({ Numero_do_: value })
                                            .eq('id', job.id)
                                        }
                                      } else {
                                        // Empty value, just update
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ Numero_do_: value })
                                          .eq('id', job.id)
                                      }
                                    }
                                  }}
                                  className="h-10 text-right text-sm"
                                  placeholder="FO"
                                />
                              </TableCell>
                              <TableCell className="w-[200px]">
                                <CreatableClienteCombobox
                                  value={job.id_cliente || ''}
                                  onChange={async (selectedId: string) => {
                                    const selected = clientes.find(
                                      (c) => c.value === selectedId,
                                    )
                                    // Debug logging
                                    console.log(
                                      `Job ${job.numero_fo} - selecting cliente: ${selectedId} -> ${selected?.label}`,
                                    )
                                    console.log(`Current job.id_cliente: ${job.id_cliente}, job.cliente: "${job.cliente}"`)
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? {
                                              ...j,
                                              id_cliente: selectedId,
                                              cliente: selected
                                                ? selected.label
                                                : '',
                                            }
                                          : j,
                                      ),
                                    )
                                    // Persist to Supabase if not a temp job
                                    if (!job.id.startsWith('temp-')) {
                                      const selectedCustomerId = selected ? parseInt(selected.value, 10) : null
                                      await supabase
                                        .from('folhas_obras')
                                        .update({
                                          Nome: selected?.label || '',
                                          customer_id: selectedCustomerId,
                                        })
                                        .eq('id', job.id)
                                    }
                                  }}
                                  options={clientes}
                                  onOptionsUpdate={(
                                    newClientes: ClienteOption[],
                                  ) => {
                                    setClientes(newClientes) // Update the clientes list when a new one is created
                                  }}
                                  placeholder="Cliente"
                                  disabled={loading.clientes}
                                  loading={loading.clientes}
                                  displayLabel={job.cliente || undefined}
                                />
                              </TableCell>
                              <TableCell className="flex-1">
                                <Input
                                  value={job.nome_campanha}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, nome_campanha: value }
                                          : j,
                                      ),
                                    )
                                  }}
                                  onBlur={async (e) => {
                                    const value = e.target.value
                                    // Update the job if it exists in database
                                    if (!job.id.startsWith('temp-')) {
                                      await supabase
                                        .from('folhas_obras')
                                        .update({ Trabalho: value })
                                        .eq('id', job.id)
                                    }
                                  }}
                                  className="h-10 w-full text-sm"
                                  placeholder="Nome da Campanha"
                                />
                              </TableCell>
                              <TableCell className="w-[50px] text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <SimpleNotasPopover
                                          value={job.notas ?? ''}
                                          onSave={async (newNotas) => {
                                            await supabase
                                              .from('folhas_obras')
                                              .update({ notas: newNotas })
                                              .eq('id', job.id)
                                            setJobs((prev: Job[]) =>
                                              prev.map((j: Job) =>
                                                j.id === job.id
                                                  ? { ...j, notas: newNotas }
                                                  : j,
                                              ),
                                            )
                                          }}
                                          placeholder="Adicionar notas..."
                                          label="Notas"
                                          buttonSize="icon"
                                          className="mx-auto aspect-square"
                                          disabled={false}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    {job.notas && job.notas.trim() !== '' && (
                                      <TooltipContent>
                                        {job.notas}
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="w-[210px]">
                                <div className="flex w-full items-center gap-2">
                                  <Progress value={pct} className="w-full" />
                                  <span className="w-10 text-right font-mono text-xs">
                                    {pct}%
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="w-[120px] text-right text-sm font-mono">
                                {jobTotalValues[job.id]
                                  ? new Intl.NumberFormat('pt-PT', {
                                      style: 'currency',
                                      currency: 'EUR',
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    }).format(jobTotalValues[job.id])
                                  : '—'}
                              </TableCell>

                              <TableCell className="w-[36px] p-0 text-center">
                                <button
                                  className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getPColor(job)}`}
                                  title={
                                    job.prioridade
                                      ? 'Prioritário'
                                      : job.data_in &&
                                          (Date.now() -
                                            new Date(job.data_in).getTime()) /
                                            (1000 * 60 * 60 * 24) >
                                            3
                                        ? 'Aguardando há mais de 3 dias'
                                        : 'Normal'
                                  }
                                  onClick={async () => {
                                    const newPrioridade = !job.prioridade
                                    setJobs((prevJobs) =>
                                      prevJobs.map((j) =>
                                        j.id === job.id
                                          ? { ...j, prioridade: newPrioridade }
                                          : j,
                                      ),
                                    )
                                    // Persist to Supabase
                                    await supabase
                                      .from('folhas_obras')
                                      .update({ prioridade: newPrioridade })
                                      .eq('id', job.id)
                                  }}
                                />
                              </TableCell>
                              <TableCell className="w-[36px] p-0 text-center">
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
                                    <TooltipContent>
                                      Artes Finais
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="w-[36px] p-0 text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <span
                                          className={`mx-auto flex h-3 w-3 items-center justify-center transition-colors ${getCColor(job.id, allOperacoes)}`}
                                          title="Corte"
                                        />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Corte</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>

                              {/* Pendente Column */}
                              <TableCell className="w-[40px] p-0 text-center">
                                <Checkbox
                                  checked={job.pendente ?? false}
                                  onCheckedChange={async (checked) => {
                                    const previousPendente =
                                      job.pendente ?? false
                                    const newPendente = checked === true

                                    // Immediately remove from current view
                                    setJobs((prevJobs) =>
                                      prevJobs.filter((j) => j.id !== job.id),
                                    )

                                    if (!job.id.startsWith('temp-')) {
                                      try {
                                        await supabase
                                          .from('folhas_obras')
                                          .update({ pendente: newPendente })
                                          .eq('id', job.id)
                                      } catch (error) {
                                        console.error(
                                          'Error updating pendente status:',
                                          error,
                                        )
                                        // Restore job on error
                                        setJobs((prevJobs) => [
                                          ...prevJobs,
                                          {
                                            ...job,
                                            pendente: previousPendente,
                                          },
                                        ])
                                      }
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="w-[100px] p-0 pr-2">
                                <div className="flex justify-center gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="default"
                                          className="border border-black"
                                          onClick={() => {
                                            console.log('👆 [BUTTON CLICK] Eye button clicked')
                                            console.log('👆 [BUTTON CLICK] Job ID:', job.id)
                                            console.log('👆 [BUTTON CLICK] Current openId:', openId)
                                            console.log('👆 [BUTTON CLICK] Timestamp:', new Date().toISOString())
                                            setOpenId(job.id)
                                          }}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Items</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="destructive"
                                          onClick={async () => {
                                            if (
                                              !confirm(
                                                `Tem certeza que deseja eliminar a Folha de Obra ${job.numero_fo}? Esta ação irá eliminar todos os itens e dados logísticos associados.`,
                                              )
                                            ) {
                                              return
                                            }

                                            try {
                                              // Delete from folhas_obras - CASCADE will handle related tables:
                                              // - items_base (CASCADE)
                                              // - logistica_entregas (CASCADE via items_base)
                                              // - designer_items (CASCADE via items_base)
                                              // - producao_operacoes (CASCADE via items_base)
                                              const { error: deleteError } = await supabase
                                                .from('folhas_obras')
                                                .delete()
                                                .eq('id', job.id)

                                              if (deleteError) {
                                                throw deleteError
                                              }

                                              console.log(`✅ Folha de Obra ${job.numero_fo} eliminada com sucesso (CASCADE)`)

                                              // Update local state
                                              setJobs((prevJobs) =>
                                                prevJobs.filter(
                                                  (j) => j.id !== job.id,
                                                ),
                                              )
                                              setAllItems((prevItems) =>
                                                prevItems.filter(
                                                  (item) =>
                                                    item.folha_obra_id !==
                                                    job.id,
                                                ),
                                              )
                                            } catch (error) {
                                              console.error(
                                                'Error deleting job:',
                                                error,
                                              )
                                              alert(
                                                'Erro ao eliminar a Folha de Obra. Tente novamente.',
                                              )
                                            }
                                          }}
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
                        })}
                        {sorted.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={13}
                              className="py-8 text-center"
                            >
                              Nenhum trabalho pendente encontrado.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* drawer (single level) */}
        {openId && (
          <Drawer
            open={!!openId}
            onOpenChange={(o) => {
              console.log('🚪 [DRAWER CHANGE] onOpenChange called:', o)
              console.log('🚪 [DRAWER CHANGE] Current openId:', openId)
              console.log('🚪 [DRAWER CHANGE] Timestamp:', new Date().toISOString())

              if (!o) {
                console.log('🚪 [DRAWER CHANGE] Closing drawer...')
                setOpenId(null)

                // Force check after state update
                setTimeout(() => {
                  const inertElements = document.querySelectorAll('[inert]')
                  console.log('🚪 [DRAWER CHANGE] Post-close inert check:', inertElements.length)
                  if (inertElements.length > 0) {
                    console.error('❌ [DRAWER CHANGE] Inert still present after close!', inertElements)
                  }
                }, 100)
              }
            }}
            shouldScaleBackground={false}
          >
            <DrawerContent
              className="!top-20 !mt-0 max-h-[calc(100vh-80px)] !outline-none !border-none !transform-none !filter-none !backdrop-filter-none will-change-auto"
              style={{
                transform: 'none',
                filter: 'none',
                backfaceVisibility: 'hidden',
                perspective: '1000px',
              }}
            >
              <DrawerHeader className="sr-only">
                <DrawerTitle>
                  {jobs.find((j) => j.id === openId)
                    ? `${jobs.find((j) => j.id === openId)?.concluido ? 'Trabalho' : 'Novo Trabalho'} (FO: ${jobs.find((j) => j.id === openId)?.numero_fo})`
                    : 'Detalhes do Trabalho'}
                </DrawerTitle>
                <DrawerDescription>
                  Detalhes Produção Folha de Obra
                </DrawerDescription>
              </DrawerHeader>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading...</span>
                  </div>
                }
              >
                <JobDrawerContent
                  jobId={openId}
                  jobs={jobs}
                  items={allItems}
                  onClose={() => setOpenId(null)}
                  supabase={supabase}
                  setJobs={setJobs}
                  setAllItems={setAllItems}
                  fetchJobsSaiuStatus={fetchJobsSaiuStatus}
                  fetchJobsCompletionStatus={fetchJobsCompletionStatus}
                />
              </Suspense>
            </DrawerContent>
          </Drawer>
        )}

        {/* Duplicate Warning Dialog */}
        <Dialog
          open={duplicateDialog.isOpen}
          onOpenChange={(open) => {
            if (!open) {
              if (duplicateDialog.onCancel) {
                duplicateDialog.onCancel()
              } else {
                setDuplicateDialog({
                  isOpen: false,
                  type: 'orc',
                  value: '',
                  currentJobId: '',
                })
              }
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {duplicateDialog.type === 'orc'
                  ? 'ORC Duplicado'
                  : 'FO Duplicada'}
              </DialogTitle>
              <DialogDescription>
                {duplicateDialog.type === 'orc'
                  ? `O número de ORC "${duplicateDialog.value}" já existe numa folha de obra.`
                  : `O número de FO "${duplicateDialog.value}" já existe.`}
              </DialogDescription>
            </DialogHeader>

            {duplicateDialog.existingJob && (
              <div className="my-4 rounded-md border border-accent/30 bg-accent/10 p-4">
                <h4 className="mb-2 font-semibold text-warning">
                  Trabalho Existente:
                </h4>
                <div className="space-y-1 text-sm text-warning-foreground">
                  <div>
                    <strong>FO:</strong> {duplicateDialog.existingJob.numero_fo}
                  </div>
                  <div>
                    <strong>ORC:</strong>{' '}
                    {duplicateDialog.existingJob.numero_orc || 'N/A'}
                  </div>
                  <div>
                    <strong>Campanha:</strong>{' '}
                    {duplicateDialog.existingJob.nome_campanha}
                  </div>
                  <div>
                    <strong>Cliente:</strong>{' '}
                    {duplicateDialog.existingJob.cliente || 'N/A'}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={duplicateDialog.onCancel}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={duplicateDialog.onConfirm}>
                Continuar Mesmo Assim
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PagePermissionGuard>
  )
}

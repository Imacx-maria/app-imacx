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

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
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

/* ---------- constants ---------- */
const JOBS_PER_PAGE = 50 // Pagination limit for better performance
const ITEMS_FETCH_LIMIT = 200 // Reasonable limit for items per request

/* ---------- types ---------- */
interface Job {
  id: string
  numero_fo: string
  numero_orc?: string | null
  nome_campanha: string
  data_saida: string | null
  prioridade: boolean | null
  notas: string | null
  concluido?: boolean | null // C
  saiu?: boolean | null // S
  fatura?: boolean | null // F
  pendente?: boolean | null // SB - Pending status
  created_at?: string | null
  data_in?: string | null // Input/creation date
  cliente?: string | null
  id_cliente?: string | null // Now persisted to database as customer_id
  customer_id?: number | null // The actual customer ID from phc.cl
  data_concluido?: string | null
  updated_at?: string | null
}

interface Item {
  id: string
  folha_obra_id: string
  descricao: string
  codigo?: string | null
  quantidade?: number | null
  brindes?: boolean | null
  concluido?: boolean | null
  paginacao?: boolean | null
}

interface LoadingState {
  jobs: boolean
  items: boolean
  operacoes: boolean
  clientes: boolean
}

/* ---------- helpers ---------- */
const dotColor = (v?: boolean | null, warn = false) =>
  v ? 'bg-success' : warn ? 'bg-warning' : 'bg-destructive'

// Utility function to parse a date string as a local date
function parseDateFromYYYYMMDD(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format date to Portuguese short format (DD/MM/YY)
 */
function formatDatePortuguese(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    return format(date, 'dd/MM/yy')
  } catch {
    return ''
  }
}

// Helper to get the latest completion date for a job - now moved to logistica_entregas
// This will be handled by the logistics data fetching

/* ---------- Performance optimizations ---------- */
// Debounce hook for filter inputs
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Helper function for smart numeric sorting (handles mixed text/number fields)
const parseNumericField = (
  value: string | number | null | undefined,
): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value

  const strValue = String(value).trim()
  if (strValue === '') return 0

  // Try to parse as number
  const numValue = Number(strValue)
  if (!isNaN(numValue)) return numValue

  // For non-numeric values (letters), sort them after all numbers
  // Use a high number + character code for consistent ordering
  return 999999 + strValue.charCodeAt(0)
}

// Simple helper functions for performance (moved out of component to avoid SSR issues)
const getPColor = (job: Job): string => {
  if (job.prioridade) return 'bg-destructive'
  if (job.data_in) {
    const days =
      (Date.now() - new Date(job.data_in).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 3) return 'bg-info'
  }
  return 'bg-success'
}

const getAColor = (
  jobId: string,
  items: Item[],
  designerItems: any[],
): string => {
  // Get all items for this job
  const jobItems = items.filter((item) => item.folha_obra_id === jobId)
  if (jobItems.length === 0) return 'bg-destructive' // No items = red

  // Get designer items for these job items
  const jobItemIds = jobItems.map((item) => item.id)
  const jobDesignerItems = designerItems.filter((designer) =>
    jobItemIds.includes(designer.item_id),
  )

  if (jobDesignerItems.length === 0) return 'bg-destructive' // No designer items = red

  // Check paginacao status
  const completedCount = jobDesignerItems.filter(
    (designer) => designer.paginacao === true,
  ).length
  const totalCount = jobDesignerItems.length

  if (completedCount === 0) return 'bg-destructive' // None completed = red
  if (completedCount === totalCount) return 'bg-success' // All completed = green
  return 'bg-warning' // Some completed = orange
}

const getCColor = (jobId: string, operacoes: any[]): string => {
  const jobOperacoes = operacoes.filter((op) => op.folha_obra_id === jobId)
  if (jobOperacoes.length === 0) return 'bg-destructive'
  return jobOperacoes.some((op) => op.concluido)
    ? 'bg-success'
    : 'bg-destructive'
}

/* ---------- Loading Components ---------- */
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
  const [clientes, setClientes] = useState<{ value: string; label: string }[]>(
    [],
  )
  // Ref to access latest clientes in fetchJobs without creating dependency
  const clientesRef = useRef<{ value: string; label: string }[]>([])
  // Ref to track if initial load has happened
  const initialLoadDone = useRef(false)
  const [jobsSaiuStatus, setJobsSaiuStatus] = useState<Record<string, boolean>>(
    {},
  )
  const [jobsCompletionStatus, setJobsCompletionStatus] = useState<
    Record<string, { completed: boolean; percentage: number }>
  >({})

  /* duplicate validation state */
  const [duplicateDialog, setDuplicateDialog] = useState<{
    isOpen: boolean
    type: 'orc' | 'fo'
    value: string | number
    existingJob?: Job
    currentJobId: string
    originalValue?: string | number | null
    onConfirm?: () => void
    onCancel?: () => void
  }>({
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
  const [campF, setCampF] = useState('')
  const [itemF, setItemF] = useState('')
  const [codeF, setCodeF] = useState('')
  const [clientF, setClientF] = useState('')
  // F (fatura) toggle: false = show F false, true = show F true
  const [showFatura, setShowFatura] = useState(false)

  /* tab state */
  const [activeTab, setActiveTab] = useState<
    'em_curso' | 'concluidos' | 'pendentes'
  >('em_curso')

  /* FO totals state */
  const [foTotals, setFoTotals] = useState<{
    em_curso: number
    pendentes: number
  }>({
    em_curso: 0,
    pendentes: 0,
  })
  const [showTotals, setShowTotals] = useState(false)

  // Debounced filter values for performance
  const debouncedFoF = useDebounce(foF, 300)
  const debouncedCampF = useDebounce(campF, 300)
  const debouncedItemF = useDebounce(itemF, 300)
  const debouncedCodeF = useDebounce(codeF, 300)

  // Debug: Track when codeF and debounced value changes
  useEffect(() => {
    console.log(
      '🔤 codeF state changed to:',
      `"${codeF}"`,
      'length:',
      codeF.length,
    )
    // Log stack trace to see what's causing the change
    if (codeF === '' && debouncedCodeF !== '') {
      console.warn(
        '⚠️ CodeF was unexpectedly cleared! Previous value was:',
        debouncedCodeF,
      )
      console.trace('Stack trace for codeF clear:')
    }
  }, [codeF, debouncedCodeF])

  useEffect(() => {
    console.log(
      '⏱️ debouncedCodeF changed to:',
      `"${debouncedCodeF}"`,
      'length:',
      debouncedCodeF.length,
    )
  }, [debouncedCodeF])
  const debouncedClientF = useDebounce(clientF, 300)

  /* sorting */
  type SortableJobKey =
    | 'created_at'
    | 'numero_orc'
    | 'numero_fo'
    | 'cliente'
    | 'nome_campanha'
    | 'notas'
    | 'prioridade'
    | 'data_concluido'
    | 'concluido'
    | 'saiu'
    | 'fatura'
    | 'pendente'
    | 'artwork'
    | 'corte'
  const [sortCol, setSortCol] = useState<SortableJobKey>('prioridade')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

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

  /* ---------- Duplicate Validation Functions ---------- */

  // Check if ORC number already exists
  const checkOrcDuplicate = useCallback(
    async (orcNumber: string, currentJobId: string) => {
      if (!orcNumber || orcNumber === '') {
        return null
      }

      try {
        let query = supabase
          .from('folhas_obras')
          .select('id, numero_orc, Numero_do_, Trabalho, Nome')
          .eq('numero_orc', orcNumber)

        // Only add the neq filter if currentJobId is not a temp job (temp jobs have string IDs like "temp-xxx")
        if (
          currentJobId &&
          currentJobId.trim() !== '' &&
          !currentJobId.startsWith('temp-')
        ) {
          query = query.neq('id', currentJobId)
        }

        const { data, error } = await query.limit(1)

        if (error) throw error

        return data && data.length > 0
          ? ({
              id: (data as any)[0].id,
              numero_orc: (data as any)[0].numero_orc ?? null,
              numero_fo: (data as any)[0].Numero_do_
                ? String((data as any)[0].Numero_do_)
                : '',
              nome_campanha: (data as any)[0].Trabalho || '',
              cliente: (data as any)[0].Nome || null,
              data_saida: null,
              prioridade: null,
              notas: null,
            } as Job)
          : null
      } catch (error) {
        console.error('Error checking ORC duplicate:', error)
        return null
      }
    },
    [supabase],
  )

  // Check if FO number already exists
  const checkFoDuplicate = useCallback(
    async (foNumber: string, currentJobId: string) => {
      if (!foNumber || foNumber.trim() === '') {
        return null
      }

      try {
        let query = supabase
          .from('folhas_obras')
          .select('id, Numero_do_, numero_orc, Trabalho, Nome')
          .eq('Numero_do_', foNumber.trim())

        // Only add the neq filter if currentJobId is not a temp job (temp jobs have string IDs like "temp-xxx")
        if (
          currentJobId &&
          currentJobId.trim() !== '' &&
          !currentJobId.startsWith('temp-')
        ) {
          query = query.neq('id', currentJobId)
        }

        const { data, error } = await query.limit(1)

        if (error) throw error

        return data && data.length > 0
          ? ({
              id: (data as any)[0].id,
              numero_orc: (data as any)[0].numero_orc ?? null,
              numero_fo: (data as any)[0].Numero_do_
                ? String((data as any)[0].Numero_do_)
                : '',
              nome_campanha: (data as any)[0].Trabalho || '',
              cliente: (data as any)[0].Nome || null,
              data_saida: null,
              prioridade: null,
              notas: null,
            } as Job)
          : null
      } catch (error) {
        console.error('Error checking FO duplicate:', error)
        return null
      }
    },
    [supabase],
  )

  // PHC header and BI lines prefill helpers
  type PhcFoHeader = {
    folha_obra_id: string
    folha_obra_number?: string | null
    orcamento_number?: string | null
    nome_trabalho?: string | null
    observacoes?: string | null
    customer_id?: number | null
    folha_obra_date?: string | null
  }

  const fetchPhcHeaderByFo = useCallback(
    async (foNumber: string): Promise<PhcFoHeader | null> => {
      try {
        const { data, error } = await supabase
          .schema('phc')
          .from('folha_obra_with_orcamento')
          .select(
            'folha_obra_id, folha_obra_number, orcamento_number, nome_trabalho, observacoes, customer_id, folha_obra_date',
          )
          .eq('folha_obra_number', foNumber.trim())
          .order('folha_obra_date', { ascending: false })
          .limit(1)
        console.log('📊 PHC Query Result:', { 
          foNumber: foNumber.trim(), 
          data, 
          error,
          dataLength: data?.length,
          firstRow: data?.[0]
        })
        if (error) throw error
        if (!data || data.length === 0) {
          console.warn('⚠️ No PHC data found for FO:', foNumber.trim())
          return null
        }
        console.log('✅ PHC Header found:', data[0])
        return data[0] as PhcFoHeader
      } catch (e) {
        console.error('Error fetching PHC header by FO:', e)
        return null
      }
    },
    [supabase],
  )

  const fetchPhcHeaderByOrc = useCallback(
    async (orcNumber: string): Promise<PhcFoHeader | null> => {
      try {
        const { data, error } = await supabase
          .schema('phc')
          .from('folha_obra_with_orcamento')
          .select(
            'folha_obra_id, folha_obra_number, orcamento_number, nome_trabalho, observacoes, customer_id, folha_obra_date',
          )
          .eq('orcamento_number', orcNumber)
          .order('folha_obra_date', { ascending: false })
          .limit(1)
        console.log('📊 PHC Query Result (ORC):', { 
          orcNumber, 
          data, 
          error,
          dataLength: data?.length,
          firstRow: data?.[0]
        })
        if (error) throw error
        if (!data || data.length === 0) {
          console.warn('⚠️ No PHC data found for ORC:', orcNumber)
          return null
        }
        console.log('✅ PHC Header found (ORC):', data[0])
        return data[0] as PhcFoHeader
      } catch (e) {
        console.error('Error fetching PHC header by ORC:', e)
        return null
      }
    },
    [supabase],
  )

  const resolveClienteName = useCallback(
    async (
      customerId: number | null | undefined,
    ): Promise<{ id_cliente: string | null; cliente: string }> => {
      console.log('👤 Resolving client:', { customerId, clientes_loaded: clientes.length })
      if (customerId === null || customerId === undefined) {
        return { id_cliente: null, cliente: '' }
      }
      const idStr = customerId.toString()
      const found = clientes.find((c) => c.value === idStr)
      if (found) {
        const result = { id_cliente: idStr, cliente: found.label }
        console.log('✅ Client resolved from cache:', result)
        return result
      }
      try {
        const { data, error } = await supabase
          .schema('phc')
          .from('cl')
          .select('customer_name')
          .eq('customer_id', customerId)
          .limit(1)
        if (!error && data && data.length > 0) {
          const result = { id_cliente: idStr, cliente: data[0].customer_name }
          console.log('✅ Client resolved from PHC:', result)
          return result
        }
      } catch (e) {
        console.warn('Could not resolve customer name from PHC:', e)
      }
      console.log('⚠️ Client not found, returning empty:', { customerId })
      return { id_cliente: idStr, cliente: '' }
    },
    [clientes, supabase],
  )

  const importPhcLinesForFo = useCallback(
    async (
      phcFolhaObraId: string,
      newJobId: string,
      folhaObraNumber?: string | null,
    ) => {
      try {
        // Trim the document_id to remove trailing spaces (common issue in PHC data)
        const trimmedDocumentId = phcFolhaObraId?.trim() || phcFolhaObraId
        console.log('🔍 Querying PHC BI with document_id:', { original: phcFolhaObraId, trimmed: trimmedDocumentId })
        
        const { data: lines, error } = await supabase
          .schema('phc')
          .from('bi')
          .select('line_id, document_id, description, quantity, item_reference')
          .eq('document_id', trimmedDocumentId)
          .gt('quantity', 0)
        if (error) throw error
        
        console.log('✅ PHC BI query returned:', lines?.length || 0, 'lines')
        if (!lines || lines.length === 0) {
          console.warn('⚠️ No items found in PHC BI for document_id:', trimmedDocumentId)
          return
        }

        const rows = lines.map((l: any) => ({
          folha_obra_id: newJobId,
          descricao: l.description || '',
          codigo: l.item_reference || null,
          quantidade:
            l.quantity !== null && l.quantity !== undefined
              ? Math.round(Number(l.quantity))
              : null,
          brindes: false,
        }))

        console.log('📥 Inserting', rows.length, 'items from PHC bi lines')
        const { data: inserted, error: insErr } = await supabase
          .from('items_base')
          .insert(rows)
          .select('id, folha_obra_id, descricao, codigo, quantidade, brindes')
        if (insErr) {
          console.error('❌ Error inserting items_base:', insErr)
          throw insErr
        }
        console.log(
          '✅ Inserted',
          inserted?.length || 0,
          'items into items_base',
        )

        // Create designer_items and logistica_entregas for each inserted item
        if (inserted && inserted.length > 0) {
          console.log(
            '🎨 Creating designer_items entries for',
            inserted.length,
            'items',
          )
          const designerRows = inserted.map((item: any) => ({
            item_id: item.id,
            em_curso: true,
            duvidas: false,
            maquete_enviada1: false,
            paginacao: false,
          }))

          const { data: designerInserted, error: designerErr } = await supabase
            .from('designer_items')
            .insert(designerRows)
            .select('*')

          if (designerErr) {
            console.error('❌ Error inserting designer_items:', designerErr)
          } else {
            console.log(
              '✅ Created',
              designerInserted?.length || 0,
              'designer_items entries',
            )
          }

          console.log(
            '🚚 Creating logistica_entregas entries for',
            inserted.length,
            'items',
          )
          const logisticaRows = inserted.map((item: any) => ({
            item_id: item.id,
            descricao: item.descricao || '',
            quantidade: item.quantidade || null,
            data: new Date().toISOString().split('T')[0],
            is_entrega: true,
          }))

          const { data: logisticaInserted, error: logisticaErr } =
            await supabase
              .from('logistica_entregas')
              .insert(logisticaRows)
              .select('*')

          if (logisticaErr) {
            console.error(
              '❌ Error inserting logistica_entregas:',
              logisticaErr,
            )
          } else {
            console.log(
              '✅ Created',
              logisticaInserted?.length || 0,
              'logistica_entregas entries',
            )
          }
        }
        // Regardless of returned rows, fetch authoritative list for this job and replace in state
        const { data: fetchedItems, error: fetchErr } = await supabase
          .from('items_base')
          .select('id, folha_obra_id, descricao, codigo, quantidade, brindes')
          .eq('folha_obra_id', newJobId)
        if (!fetchErr && fetchedItems) {
          setAllItems((prev) => {
            const withoutJob = prev.filter((i) => i.folha_obra_id !== newJobId)
            const mapped = fetchedItems.map((it: any) => ({
              id: it.id,
              folha_obra_id: it.folha_obra_id,
              descricao: it.descricao ?? '',
              codigo: it.codigo ?? '',
              quantidade: it.quantidade ?? null,
              paginacao: false,
              brindes: it.brindes ?? false,
              concluido: false,
            }))
            return [...withoutJob, ...mapped]
          })
        }

        // Also mirror minimal data into public.folhas_obras_linhas for FO reporting
        // supabase_docs.json shows columns: Numero_do_ (integer), Quant_ (integer)
        if (folhaObraNumber) {
          const foInt = parseInt(String(folhaObraNumber), 10)
          if (!Number.isNaN(foInt)) {
            // Avoid duplicates if this import is triggered multiple times
            try {
              const { error: delErr } = await supabase
                .schema('public')
                .from('folhas_obras_linhas')
                .delete()
                .eq('Numero_do_', foInt)
              if (delErr) {
                console.warn(
                  'Warning deleting existing linhas for FO:',
                  foInt,
                  delErr,
                )
              }
            } catch (delEx) {
              console.warn(
                'Delete exception folhas_obras_linhas for FO:',
                foInt,
                delEx,
              )
            }

            const linhasRows = lines.map((l: any) => ({
              Numero_do_: foInt,
              Quant_:
                l.quantity !== null && l.quantity !== undefined
                  ? Math.round(Number(l.quantity))
                  : null,
            }))

            try {
              const { data: linhasInserted, error: linhasErr } = await supabase
                .schema('public')
                .from('folhas_obras_linhas')
                .insert(linhasRows)
                .select('Numero_do_, Quant_')
              if (linhasErr) {
                console.warn(
                  'Warning inserting folhas_obras_linhas:',
                  linhasErr,
                )
              } else {
                console.log(
                  'Mirrored folhas_obras_linhas rows:',
                  linhasInserted?.length || 0,
                )
              }
            } catch (insEx) {
              console.warn('Insert exception folhas_obras_linhas:', insEx)
            }
          }
        }
      } catch (e) {
        console.error('Error importing PHC BI lines:', e)
      }
    },
    [supabase],
  )

  const prefillAndInsertFromFo = useCallback(
    async (foNumber: string, tempJobId: string) => {
      const header = await fetchPhcHeaderByFo(foNumber)
      console.log('🔍 PHC Header Response:', {
        foNumber,
        header,
        nome_trabalho: header?.nome_trabalho,
        observacoes: header?.observacoes,
        orcamento_number: header?.orcamento_number,
        customer_id: header?.customer_id,
      })
      let phcFolhaObraId: string | null = null
      let insertData: any = {
        Numero_do_: foNumber,
        Trabalho: '',
        Nome: '',
        numero_orc: null,
        customer_id: null,
      }
      if (header) {
        phcFolhaObraId = header.folha_obra_id
        // Use nome_trabalho if available, otherwise fall back to observacoes
        const campaignName = header.nome_trabalho || header.observacoes
        if (campaignName) insertData.Trabalho = campaignName
        if (header.orcamento_number) {
          // numero_orc is now TEXT - store as string
          insertData.numero_orc = String(header.orcamento_number)
        }
        const { id_cliente, cliente } = await resolveClienteName(
          header.customer_id ?? null,
        )
        insertData.Nome = cliente
        // Store customer_id from PHC directly
        if (header.customer_id) {
          insertData.customer_id = header.customer_id
        }
      }
      console.log('💾 Insert Data:', insertData)
      const { data: newJob, error } = await supabase
        .from('folhas_obras')
        .insert(insertData)
        .select(
          'id, numero_fo:Numero_do_, numero_orc, nome_campanha:Trabalho, cliente:Nome',
        )
        .single()
      console.log('📥 Returned from INSERT+SELECT:', { newJob, error })
      if (error) throw error
      if (newJob) {
        const mappedJob = {
          id: (newJob as any).id,
          numero_fo: (newJob as any).numero_fo || foNumber,
          numero_orc: (newJob as any).numero_orc ?? null,
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
        console.log('🎯 Mapped Job for UI:', mappedJob)
        setJobs((prev) => prev.map((j) => (j.id === tempJobId ? mappedJob : j)))
        if (phcFolhaObraId) {
          await importPhcLinesForFo(
            phcFolhaObraId,
            (newJob as any).id,
            foNumber,
          )
          setOpenId((newJob as any).id)
        }
      }
    },
    [
      fetchPhcHeaderByFo,
      resolveClienteName,
      importPhcLinesForFo,
      supabase,
      setJobs,
    ],
  )

  const prefillAndInsertFromOrc = useCallback(
    async (orcNumber: string, tempJobId: string) => {
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
      console.log('💾 Insert Data (ORC):', insertData)
      const { data: newJob, error } = await supabase
        .from('folhas_obras')
        .insert(insertData)
        .select(
          'id, numero_fo:Numero_do_, numero_orc, nome_campanha:Trabalho, cliente:Nome',
        )
        .single()
      console.log('📥 Returned from INSERT+SELECT (ORC):', { newJob, error })
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
        console.log('🎯 Mapped Job for UI (ORC):', mappedJob)
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
        campF?: string
        itemF?: string
        codeF?: string
        clientF?: string
        showFatura?: boolean
        activeTab?: 'em_curso' | 'concluidos' | 'pendentes'
      } = {},
    ) => {
      setLoading((prev) => ({ ...prev, jobs: true }))
      try {
        // Optimized query with specific columns and proper pagination
        const startRange = page * JOBS_PER_PAGE
        const endRange = startRange + JOBS_PER_PAGE - 1

        // Calculate 2 months ago date for completed jobs filter
        const twoMonthsAgo = new Date()
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
        const twoMonthsAgoString = twoMonthsAgo.toISOString()

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

        // STEP 2: Build the base query - select only existing columns in schema
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

        // If we have job IDs from item search, filter by those ONLY
        if (jobIds) {
          console.log(
            '🎯 Item search active - filtering to specific job IDs:',
            jobIds,
          )
          query = query.in('id', jobIds)
          console.log('🎯 Bypassing all other filters due to item search')
        }

        // STEP 3: Apply other filters (only if no item search is active)
        if (!jobIds) {
          console.log('🔄 Applying standard filters (no item search active)')

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
              twoMonthsAgoString,
            )
            // For completed jobs, filter by last 2 months
            // Note: data_concluido is in logistica_entregas, not in folhas_obras
            query = query.or(
              `updated_at.gte.${twoMonthsAgoString},created_at.gte.${twoMonthsAgoString}`,
            )
          } else if (!hasActiveFilters) {
            // For other tabs (em_curso, pendentes) with no filters: show last 4 months
            const fourMonthsAgo = new Date()
            fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)
            const fourMonthsAgoString = fourMonthsAgo.toISOString()
            console.log(
              '🔄 No filters active - applying 4 month date filter:',
              fourMonthsAgoString,
            )
            query = query.gte('created_at', fourMonthsAgoString)
          }

          // Direct field filters using real column names
          if (filters.foF && filters.foF.trim() !== '') {
            query = query.ilike('Numero_do_', `%${filters.foF.trim()}%`)
          }

          if (filters.campF && filters.campF.trim() !== '') {
            query = query.ilike('Trabalho', `%${filters.campF.trim()}%`)
          }

          if (filters.clientF && filters.clientF.trim() !== '') {
            query = query.ilike('Nome', `%${filters.clientF.trim()}%`)
          }

          // Note: 'fatura' column does not exist in schema; skipping fatura filter
        } else {
          console.log('🔄 Skipping all standard filters due to item search')
        }

        // Order and pagination (use existing column)
        query = query.order('created_at', { ascending: false })

        // Only apply pagination if we're not filtering by specific job IDs
        if (!jobIds) {
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

        // Apply logistics-based filtering for tabs (only if no item filter was used)
        // Skip this entirely when item/codigo filters are active
        const itemFiltersPresent = !!(
          filters.itemF?.trim() || filters.codeF?.trim()
        )
        console.log('🔄 Logistics filtering check:', {
          hasJobIds: !!jobIds,
          hasItemFilters: itemFiltersPresent,
          activeTab: filters.activeTab,
          shouldSkipLogisticsFilter: !!jobIds || itemFiltersPresent,
        })

        if (
          !jobIds && // Only apply tab filtering if we didn't already filter by items
          !filters.itemF?.trim() && // Skip if item description filter is active
          !filters.codeF?.trim() && // Skip if codigo filter is active
          filteredJobs.length > 0 &&
          (filters.activeTab === 'em_curso' ||
            filters.activeTab === 'concluidos' ||
            filters.activeTab === 'pendentes')
        ) {
          console.log('🔄 Applying logistics-based tab filtering')
          const currentJobIds = filteredJobs.map((job) => job.id)

          // Get all items for these jobs
          const { data: itemsData, error: itemsError } = await supabase
            .from('items_base')
            .select('id, folha_obra_id, concluido')
            .in('folha_obra_id', currentJobIds)

          if (!itemsError && itemsData && itemsData.length > 0) {
            const itemIds = itemsData.map((item) => item.id)

            // Get logistics entries for these items
            const { data: logisticsData, error: logisticsError } =
              await supabase
                .from('logistica_entregas')
                .select('item_id, concluido')
                .in('item_id', itemIds)

            if (!logisticsError && logisticsData) {
              // Calculate completion status for each job
              const jobCompletionMap = new Map<string, boolean>()

              currentJobIds.forEach((jobId: string) => {
                const jobItems = itemsData.filter(
                  (item) => item.folha_obra_id === jobId,
                )

                if (jobItems.length === 0) {
                  // Jobs with no items are considered incomplete
                  jobCompletionMap.set(jobId, false)
                  return
                }

                // Check if ALL items have logistics entries with concluido=true
                const allItemsCompleted = jobItems.every((item) => {
                  const logisticsEntries = logisticsData.filter(
                    (l) => l.item_id === item.id,
                  )

                  // If no logistics entries exist for this item, it's not completed
                  if (logisticsEntries.length === 0) {
                    return false
                  }

                  // ALL logistics entries for this item must have concluido=true
                  return logisticsEntries.every(
                    (entry) => entry.concluido === true,
                  )
                })

                jobCompletionMap.set(jobId, allItemsCompleted)

                // Debug logging
                if (process.env.NODE_ENV === 'development') {
                  const job = filteredJobs.find((j) => j.id === jobId)
                  console.log(
                    `🔍 Job ${job?.numero_fo}: ${jobItems.length} items, all completed: ${allItemsCompleted}`,
                  )
                }
              })

              // Filter jobs based on logistica_entregas concluido status (source of truth)
              if (filters.activeTab === 'em_curso') {
                // Show jobs where ANY item has logistica concluido=false and not pendente
                filteredJobs = filteredJobs.filter((job) => {
                  if (job.pendente === true) return false
                  const jobItems = itemsData.filter(
                    (item) => item.folha_obra_id === job.id,
                  )
                  if (jobItems.length === 0) return true // Show if no items yet
                  return jobItems.some((item) => {
                    const logEntry = logisticsData.find((l) => l.item_id === item.id)
                    return !logEntry || logEntry.concluido !== true
                  })
                })
              } else if (filters.activeTab === 'concluidos') {
                // Show jobs where ALL items have logistica concluido=true and not pendente
                filteredJobs = filteredJobs.filter((job) => {
                  if (job.pendente === true) return false
                  const jobItems = itemsData.filter(
                    (item) => item.folha_obra_id === job.id,
                  )
                  if (jobItems.length === 0) return false // Don't show if no items
                  return jobItems.every((item) => {
                    const logEntry = logisticsData.find((l) => l.item_id === item.id)
                    return logEntry && logEntry.concluido === true
                  })
                })
              } else if (filters.activeTab === 'pendentes') {
                // Show jobs that are marked as pendente = true
                filteredJobs = filteredJobs.filter(
                  (job) => job.pendente === true,
                )
              }
            }
          }
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
          setHasMoreJobs((count || 0) > endRange + 1)
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

  // Initial data load - only on mount
  useEffect(() => {
    if (initialLoadDone.current) return
    
    const loadInitialData = async () => {
      setError(null)

      console.log('🚀 Starting initial data load...')
      
      // Load clientes FIRST and wait for completion
      await fetchClientes()
      console.log('✅ Clientes loaded:', clientesRef.current.length)

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
      debouncedCodeF,
      debouncedItemF,
      debouncedFoF,
      debouncedCampF,
      debouncedClientF,
      showFatura,
      activeTab,
    })

    if (
      debouncedFoF ||
      debouncedCampF ||
      debouncedItemF ||
      debouncedCodeF ||
      debouncedClientF
    ) {
      // Run filtered search
      setHasMoreJobs(true)
      setCurrentPage(0)
      fetchJobs(0, true, {
        foF: debouncedFoF,
        campF: debouncedCampF,
        itemF: debouncedItemF,
        codeF: debouncedCodeF,
        clientF: debouncedClientF,
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
    debouncedFoF,
    debouncedCampF,
    debouncedItemF,
    debouncedCodeF,
    debouncedClientF,
    showFatura,
    activeTab,
    fetchJobs,
  ])
  // Memoize job IDs to prevent unnecessary re-fetches
  const jobIds = useMemo(() => {
    return jobs
      .map((job) => job.id)
      .filter((id) => !id.startsWith('temp-'))
  }, [jobs.map(j => j.id).join(',')])

  // Load items and operacoes when job IDs change
  useEffect(() => {
    if (jobIds.length > 0) {
      fetchItems(jobIds)
      fetchOperacoes(jobIds)
      fetchJobsSaiuStatus(jobIds)
      fetchJobsCompletionStatus(jobIds)
    }
  }, [
    jobIds.join(','), // Use stringified IDs to avoid re-fetching when order changes
    fetchItems,
    fetchOperacoes,
    fetchJobsSaiuStatus,
    fetchJobsCompletionStatus,
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
        foF: debouncedFoF,
        campF: debouncedCampF,
        itemF: debouncedItemF,
        codeF: debouncedCodeF,
        clientF: debouncedClientF,
        showFatura,
        activeTab,
      })
    }
  }, [
    loading.jobs,
    hasMoreJobs,
    currentPage,
    fetchJobs,
    debouncedFoF,
    debouncedCampF,
    debouncedItemF,
    debouncedCodeF,
    debouncedClientF,
    showFatura,
    activeTab,
  ])

  // Retry function for error recovery
  const retryFetch = useCallback(() => {
    setError(null)
    fetchJobs(0, true, { activeTab })
    fetchClientes()
  }, [fetchJobs, fetchClientes, activeTab])

  /* jobs are now pre-filtered by database, so we just use them directly */
  const filtered = jobs

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
  }, [filtered, sortCol, sortDir, allOperacoes, hasUserSorted])

  /* ---------- render ---------- */
  return (
      <div className="w-full space-y-6">
        {/* filter bar */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Gestão de Produção</h1>
          <div className="flex items-center gap-2">
            <div className="relative w-28">
              <Input
                placeholder="Filtra FO"
                className="h-10 pr-10"
                value={foF}
                onChange={(e) => setFoF(e.target.value)}
              />
              {foF && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                  onClick={() => setFoF('')}
                >
                  <XSquare className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="relative flex-1">
              <Input
                placeholder="Filtra Nome Campanha"
                className="h-10 pr-10"
                value={campF}
                onChange={(e) => setCampF(e.target.value)}
              />
              {campF && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                  onClick={() => setCampF('')}
                >
                  <XSquare className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="relative flex-1">
              <Input
                placeholder="Filtra Item"
                className="h-10 pr-10"
                value={itemF}
                onChange={(e) => setItemF(e.target.value)}
              />
              {itemF && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                  onClick={() => setItemF('')}
                >
                  <XSquare className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="relative w-40">
              <Input
                placeholder="Filtra Código"
                className="h-10 pr-10"
                value={codeF}
                onChange={(e) => {
                  console.log('🔤 Code input changed:', e.target.value)
                  setCodeF(e.target.value)
                }}
                onBlur={(e) => {
                  // Prevent accidental clearing on blur
                  console.log(
                    '🔤 Code field blur, keeping value:',
                    e.target.value,
                  )
                }}
              />
              {codeF && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                  onClick={() => setCodeF('')}
                >
                  <XSquare className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="relative flex-1">
              <Input
                placeholder="Filtra Cliente"
                className="h-10 pr-10"
                value={clientF}
                onChange={(e) => setClientF(e.target.value)}
              />
              {clientF && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                  onClick={() => setClientF('')}
                >
                  <XSquare className="h-4 w-4" />
                </Button>
              )}
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
                      setCampF('')
                      setItemF('')
                      setCodeF('')
                      setClientF('')
                    }}
                    disabled={!foF && !campF && !itemF && !codeF && !clientF}
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
                          foF: debouncedFoF,
                          campF: debouncedCampF,
                          itemF: debouncedItemF,
                          codeF: debouncedCodeF,
                          clientF: debouncedClientF,
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
                          foF: debouncedFoF,
                          campF: debouncedCampF,
                          itemF: debouncedItemF,
                          codeF: debouncedCodeF,
                          clientF: debouncedClientF,
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
                            .select('id, numero_orc, Numero_do_, Trabalho, Data_do_do, Nome')
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
                            data_in: folhaObra.Data_do_do || null,
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

                        // Call the export function
                        exportProducaoToExcel({
                          filteredRecords: exportRows,
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

                          <TableHead className="border-border sticky top-0 z-10 w-[40px] cursor-pointer border-b bg-primary text-center  text-primary-foreground uppercase select-none">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>SB</span>
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
                                          onClick={() => setOpenId(job.id)}
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
                              colSpan={12}
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
                              colSpan={8}
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

                          <TableHead className="border-border sticky top-0 z-10 w-[40px] cursor-pointer border-b bg-primary text-center  text-primary-foreground uppercase select-none">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>SB</span>
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
                                          onClick={() => setOpenId(job.id)}
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
                              colSpan={12}
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
        <Drawer
          open={!!openId}
          onOpenChange={(o) => !o && setOpenId(null)}
          shouldScaleBackground={false}
        >
          <DrawerContent
            className="!top-0 max-h-[98vh] overflow-y-auto !transform-none !filter-none !backdrop-filter-none will-change-auto"
            style={{
              transform: 'none',
              filter: 'none',
              backfaceVisibility: 'hidden',
              perspective: '1000px',
            }}
          >
            <DrawerHeader className="sr-only">
              <DrawerTitle>
                {openId && jobs.find((j) => j.id === openId)
                  ? `${jobs.find((j) => j.id === openId)?.concluido ? 'Trabalho' : 'Novo Trabalho'} (FO: ${jobs.find((j) => j.id === openId)?.numero_fo})`
                  : 'Detalhes do Trabalho'}
              </DrawerTitle>
              <DrawerDescription>
                Detalhes Produção Folha de Obra
              </DrawerDescription>
            </DrawerHeader>
            {openId && (
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
            )}
          </DrawerContent>
        </Drawer>

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
  )
}

/* ---------- Drawer component ---------- */
interface JobDrawerProps {
  jobId: string
  jobs: Job[]
  items: Item[]
  onClose(): void
  supabase: any
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>
  setAllItems: React.Dispatch<React.SetStateAction<Item[]>>
  fetchJobsSaiuStatus: (jobIds: string[]) => Promise<void>
  fetchJobsCompletionStatus: (jobIds: string[]) => Promise<void>
}

function JobDrawerContent({
  jobId,
  jobs,
  items,
  onClose,
  supabase,
  setJobs,
  setAllItems,
  fetchJobsSaiuStatus,
  fetchJobsCompletionStatus,
}: JobDrawerProps) {
  // Sorting state for drawer table - MUST be called before any early returns
  type SortKey = 'bulk' | 'descricao' | 'codigo' | 'quantidade' | 'acoes'
  const [sortCol, setSortCol] = useState<SortKey | ''>('') // Start with no sorting
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Logistica Tab State/Logic - MUST be called before any early returns
  const [logisticaRows, setLogisticaRows] = useState<any[]>([])
  const [logisticaLoading, setLogisticaLoading] = useState(false)
  const [extraClientes, setExtraClientes] = useState<Cliente[]>([])

  // Removed direct PHC test query (was forcing FO 1422 logs)
  const [sourceRowId, setSourceRowId] = useState<string | null>(null)
  const logisticaFetchedRef = useRef(false)
  const {
    clientes: logisticaClientes,
    transportadoras: logisticaTransportadoras,
    armazens: logisticaArmazens,
    fetchReferenceData,
    updateLogisticaField,
    updateFolhaObraField,
    updateItemBaseField,
    deleteLogisticaRow,
  } = useLogisticaData()

  // Inline editing state management
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set())
  const [tempValues, setTempValues] = useState<{
    [itemId: string]: Partial<Item>
  }>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  const [pendingItems, setPendingItems] = useState<{ [itemId: string]: Item }>(
    {},
  )
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 40

  // Helper functions for inline editing
  const isEditing = (itemId: string) => editingItems.has(itemId)
  const isSaving = (itemId: string) => savingItems.has(itemId)
  const isNewItem = (itemId: string) => itemId.startsWith('temp-')
  const isPending = (itemId: string) => !!pendingItems[itemId]

  const getDisplayValue = (item: Item, field: keyof Item) => {
    if (isEditing(item.id) && tempValues[item.id]?.[field] !== undefined) {
      return tempValues[item.id][field]
    }
    return item[field]
  }

  const updateTempValue = (itemId: string, field: keyof Item, value: any) => {
    setTempValues((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }))
  }

  // Accept pending item (save to database)
  const acceptItem = async (pendingItem: Item) => {
    const itemId = pendingItem.id
    setSavingItems((prev) => new Set([...Array.from(prev), itemId]))

    try {
      // Get current values from tempValues or use pending item values
      const tempData = tempValues[itemId] || {}
      const finalData = {
        folha_obra_id: pendingItem.folha_obra_id,
        descricao: tempData.descricao ?? pendingItem.descricao ?? '',
        codigo: tempData.codigo ?? pendingItem.codigo ?? '',
        quantidade: tempData.quantidade ?? pendingItem.quantidade ?? 1,
        brindes: tempData.brindes ?? pendingItem.brindes ?? false,
        concluido: false,
      }

      // 1. Save the item to database
      console.log('🔄 Inserting item with data:', finalData)
      const { data: baseData, error: baseError } = await supabase
        .from('items_base')
        .insert(finalData)
        .select('*')
        .single()

      if (baseError) {
        console.error('❌ Database error details:', baseError)
        throw new Error(
          `Database error: ${baseError.message} (Code: ${baseError.code})`,
        )
      }

      if (!baseData) {
        throw new Error('Failed to create item - no data returned')
      }

      // 2. Create designer_items row
      console.log('🎨 Creating designer_items entry for item:', baseData.id)
      const { data: designerData, error: designerError } = await supabase
        .from('designer_items')
        .insert({
          item_id: baseData.id,
          em_curso: true,
          duvidas: false,
          maquete_enviada1: false,
          paginacao: false,
        })
        .select('*')
        .single()

      if (designerError) {
        console.error('❌ Designer items insert error:', designerError)
        throw new Error(`Designer items error: ${designerError.message}`)
      }

      if (!designerData) {
        console.error('❌ Designer items insert returned no data')
        throw new Error('Failed to create designer_items entry')
      }

      console.log('✅ Designer items entry created:', designerData)

      // 3. Create logistics entry
      console.log('🚚 Creating logistica_entregas entry for item:', baseData.id)
      const { data: logisticaData, error: logisticaError } = await supabase
        .from('logistica_entregas')
        .insert({
          item_id: baseData.id,
          descricao: baseData.descricao || '',
          quantidade: baseData.quantidade || null,
          data: new Date().toISOString().split('T')[0],
          is_entrega: true,
        })
        .select('*')
        .single()

      if (logisticaError) {
        console.error('❌ Logistica insert error:', logisticaError)
        throw new Error(`Logistica error: ${logisticaError.message}`)
      }

      if (!logisticaData) {
        console.error('❌ Logistica insert returned no data')
        throw new Error('Failed to create logistica_entregas entry')
      }

      console.log('✅ Logistica entry created:', logisticaData)

      // 4. Update local state - add real item and remove from pending
      setAllItems((prev) => [
        ...prev,
        {
          id: baseData.id,
          folha_obra_id: baseData.folha_obra_id,
          descricao: baseData.descricao ?? '',
          codigo: baseData.codigo ?? null,
          quantidade: baseData.quantidade ?? null,
          brindes: baseData.brindes ?? false,
          concluido: false,
        },
      ])

      // Remove from pending items
      setPendingItems((prev) => {
        const newPending = { ...prev }
        delete newPending[itemId]
        return newPending
      })

      // Clear editing state
      setEditingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
      setTempValues((prev) => {
        const newValues = { ...prev }
        delete newValues[itemId]
        return newValues
      })

      // 5. Refresh logistics data to show the new entry
      logisticaFetchedRef.current = false // Reset ref to force re-fetch
      await fetchLogisticaRows()
    } catch (error: any) {
      console.error('Error accepting item:', error)
      alert(`Erro ao aceitar item: ${error.message}`)
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  // Cancel pending item (remove from local state)
  const cancelItem = (itemId: string) => {
    // Remove from pending items
    setPendingItems((prev) => {
      const newPending = { ...prev }
      delete newPending[itemId]
      return newPending
    })

    // Clear editing state
    setEditingItems((prev) => {
      const newSet = new Set(prev)
      newSet.delete(itemId)
      return newSet
    })
    setTempValues((prev) => {
      const newValues = { ...prev }
      delete newValues[itemId]
      return newValues
    })
  }

  // Save changes to existing item
  const saveItem = async (item: Item) => {
    const itemId = item.id
    setSavingItems((prev) => new Set([...Array.from(prev), itemId]))

    try {
      const tempData = tempValues[itemId] || {}

      // Helper function to handle empty strings as null
      const handleEmptyString = (value: any) => {
        if (typeof value === 'string' && value.trim() === '') {
          return null
        }
        return value
      }

      // Helper function to handle quantity values
      const handleQuantity = (value: any) => {
        if (value === null || value === undefined) return null
        const num = Number(value)
        return !isNaN(num) && num > 0 ? num : null
      }

      const finalData = {
        descricao: tempData.descricao ?? item.descricao ?? '',
        codigo: handleEmptyString(tempData.codigo ?? item.codigo),
        quantidade: handleQuantity(tempData.quantidade ?? item.quantidade),
        brindes: tempData.brindes ?? item.brindes ?? false,
      }

      // Debug log the data being sent
      console.log('🔧 Updating item with data:', finalData)

      // Update existing item in database
      const { error } = await supabase
        .from('items_base')
        .update(finalData)
        .eq('id', itemId)

      if (error) {
        console.error('🚨 Database error details:', error)
        throw new Error(
          `Database error: ${error.message} (Code: ${error.code})`,
        )
      }

      // Update designer_items for paginacao field; clear path_trabalho when paginacao is false
      const pagValue = tempData.paginacao ?? item.paginacao ?? false
      const designerData: any = { paginacao: pagValue }
      if (pagValue === false) {
        designerData.path_trabalho = null
      }

      const { error: designerError } = await supabase
        .from('designer_items')
        .update(designerData)
        .eq('item_id', itemId)

      if (designerError) {
        console.error('🚨 Designer items error:', designerError)
        throw new Error(`Designer error: ${designerError.message}`)
      }

      // Sync all fields to logistics (not just description)
      const logisticsUpdate = {
        descricao: finalData.descricao,
        quantidade: finalData.quantidade,
      }
      
      // Try to update existing logistics entry
      const { data: updateResult, error: logisticsError } = await supabase
        .from('logistica_entregas')
        .update(logisticsUpdate)
        .eq('item_id', itemId)
        .select()
      
      if (logisticsError) {
        console.warn('⚠️ Could not update logistics entry:', logisticsError)
      } else if (!updateResult || updateResult.length === 0) {
        // No logistics entry exists - create one for older items
        console.log('📦 No logistics entry found, creating one...')
        const { error: createError } = await supabase
          .from('logistica_entregas')
          .insert({
            item_id: itemId,
            descricao: finalData.descricao,
            quantidade: finalData.quantidade,
            data: new Date().toISOString().split('T')[0],
            is_entrega: true,
          })
        
        if (createError) {
          console.warn('⚠️ Could not create logistics entry:', createError)
        } else {
          console.log('✅ Logistics entry created')
        }
      } else {
        console.log('✅ Logistics entry updated:', logisticsUpdate)
      }

      // Update local state (combine items_base and designer_items data)
      const combinedData = { ...finalData, ...designerData }
      setAllItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, ...combinedData } : i)),
      )

      // Clear editing state
      setEditingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
      setTempValues((prev) => {
        const newValues = { ...prev }
        delete newValues[itemId]
        return newValues
      })

      // Refresh logistics data to show updated values in Logística tab
      logisticaFetchedRef.current = false // Reset ref to force re-fetch
      await fetchLogisticaRows()
    } catch (error: any) {
      console.error('Error saving item:', error)
      alert(`Erro ao salvar item: ${error.message}`)
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  const cancelEdit = (itemId: string) => {
    if (isPending(itemId)) {
      // For pending items, call cancelItem to remove from pending state
      cancelItem(itemId)
    } else {
      // For existing items, just clear editing state
      setEditingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
      setTempValues((prev) => {
        const newValues = { ...prev }
        delete newValues[itemId]
        return newValues
      })
    }
  }

  // Duplicate item (create pending copy)
  const duplicateItem = (sourceItem: Item) => {
    if (!job) return

    // Generate a new temporary ID for the duplicated item
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create a copy of the source item as a pending item
    const duplicatedItem: Item = {
      id: tempId,
      folha_obra_id: job.id,
      descricao: sourceItem.descricao || '',
      codigo: sourceItem.codigo || '',
      quantidade: sourceItem.quantidade || 1,
      brindes: sourceItem.brindes || false,
      concluido: false,
    }

    // Add to pending items
    setPendingItems((prev) => ({
      ...prev,
      [tempId]: duplicatedItem,
    }))

    // Mark as editing and initialize temp values
    setEditingItems((prev) => new Set([...Array.from(prev), tempId]))
    setTempValues((prev) => ({
      ...prev,
      [tempId]: {
        descricao: sourceItem.descricao || '',
        codigo: sourceItem.codigo || '',
        quantidade: sourceItem.quantidade || 1,
      },
    }))
  }

  // Find job and items AFTER all hooks are declared
  const job = jobs.find((j) => j.id === jobId)
  const jobItems = useMemo(() => {
    const realItems = job ? items.filter((i) => i.folha_obra_id === jobId) : []
    const pendingItemsArray = Object.values(pendingItems).filter(
      (item) => item.folha_obra_id === jobId,
    )
    return [...realItems, ...pendingItemsArray]
  }, [job, items, jobId, pendingItems])

  const toggleSort = (col: SortKey) => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortCol(col)
      setSortDir('asc')
    }
  }
  const sortedItems = useMemo(() => {
    // Only sort if a sort column is explicitly set, otherwise return items in original order
    if (!sortCol) return jobItems

    const arr = [...jobItems]
    arr.sort((a, b) => {
      let A: any, B: any
      switch (sortCol) {
        case 'bulk':
          A = a.id
          B = b.id
          break
        case 'descricao':
          A = a.descricao
          B = b.descricao
          break
        case 'codigo':
          A = a.codigo || ''
          B = b.codigo || ''
          break
        case 'quantidade':
          A = a.quantidade ?? 0
          B = b.quantidade ?? 0
          break
        case 'acoes':
          A = a.id
          B = b.id
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
  }, [jobItems, sortCol, sortDir])

  // Pagination calculations
  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE)
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedItems.slice(startIndex, endIndex)
  }, [sortedItems, currentPage])

  // Reset to page 1 when jobItems changes
  useEffect(() => {
    setCurrentPage(1)
  }, [jobItems.length])

  // Safety fetch: ensure drawer always shows up-to-date items for this job
  useEffect(() => {
    const syncJobItems = async () => {
      if (!jobId) return
      const { data, error } = await supabase
        .from('items_base')
        .select('id, folha_obra_id, descricao, codigo, quantidade, brindes')
        .eq('folha_obra_id', jobId)
      if (!error && data) {
        setAllItems((prev) => {
          const withoutJob = prev.filter((i) => i.folha_obra_id !== jobId)
          const mapped = data.map((it: any) => ({
            id: it.id,
            folha_obra_id: it.folha_obra_id,
            descricao: it.descricao ?? '',
            codigo: it.codigo ?? '',
            quantidade: it.quantidade ?? null,
            paginacao: false,
            brindes: it.brindes ?? false,
            concluido: false,
          }))
          return [...withoutJob, ...mapped]
        })
      }
    }
    syncJobItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  // Realtime subscription: keep drawer items in sync without manual fetches
  useEffect(() => {
    if (!jobId) return
    // Create a channel scoped to this job's items
    const channel = supabase
      .channel(`items-base-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'items_base',
          filter: `folha_obra_id=eq.${jobId}`,
        },
        (payload: any) => {
          const it = payload.new
          if (!it || it.folha_obra_id !== jobId) return
          setAllItems((prev) => {
            const without = prev.filter((i) => i.id !== it.id)
            return [
              ...without,
              {
                id: it.id,
                folha_obra_id: it.folha_obra_id,
                descricao: it.descricao ?? '',
                codigo: it.codigo ?? '',
                quantidade: it.quantidade ?? null,
                paginacao: false,
                brindes: it.brindes ?? false,
                concluido: false,
              },
            ]
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'items_base',
          filter: `folha_obra_id=eq.${jobId}`,
        },
        (payload: any) => {
          const it = payload.new
          if (!it || it.folha_obra_id !== jobId) return
          setAllItems((prev) =>
            prev.map((i) =>
              i.id === it.id
                ? {
                    ...i,
                    descricao: it.descricao ?? '',
                    codigo: it.codigo ?? '',
                    quantidade: it.quantidade ?? null,
                    brindes: it.brindes ?? false,
                  }
                : i,
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'items_base',
          filter: `folha_obra_id=eq.${jobId}`,
        },
        (payload: any) => {
          const oldIt = payload.old
          if (!oldIt) return
          setAllItems((prev) => prev.filter((i) => i.id !== oldIt.id))
        },
      )

    channel.subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        console.warn('Failed to remove realtime channel:', e)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  // Fetch logistics records for job items
  const fetchLogisticaRows = async () => {
    if (logisticaFetchedRef.current) {
      console.log('⏭️ Skipping logistics fetch - already fetched for this job')
      return
    }
    setLogisticaLoading(true)
    console.log('🔍 Fetching logistics for job items:', jobItems)

    if (jobItems.length === 0) {
      console.log('📦 No job items, clearing logistics table')
      setLogisticaRows([])
      setLogisticaLoading(false)
      return
    }

    // Filter out pending items (they don't exist in database yet)
    const realItems = jobItems.filter((item) => !isPending(item.id))
    const pendingItemsArray = jobItems.filter((item) => isPending(item.id))
    const itemIds = realItems.map((item) => item.id)

    // Preserve multiple logistics rows per item_id to support split deliveries

    console.log('🔍 jobItems breakdown:', {
      total: jobItems.length,
      real: realItems.length,
      pending: pendingItemsArray.length,
      pendingIds: pendingItemsArray.map((i) => i.id),
    })
    // 2. Fetch all logistics records for those items with folhas_obras join
    let logisticsData: any[] = []
    if (itemIds.length > 0) {
      const { data: logistics, error: logisticsError } = await supabase
        .from('logistica_entregas')
        .select(
          `
          *,
          items_base (
            id,
            descricao,
            codigo,
            quantidade,
            brindes,
            folha_obra_id,
            folhas_obras (
              id,
              numero_orc,
              Numero_do_,
              Nome
            )
          )
        `,
        )
        .in('item_id', itemIds)
      if (!logisticsError && logistics) {
        console.log('✅ Fetched logistics data:', logistics.length, 'rows')
        // Map Numero_do_ to numero_fo for consistency
        logisticsData = logistics.map((l: any) => ({
          ...l,
          items_base: l.items_base
            ? {
                ...l.items_base,
                folhas_obras: l.items_base.folhas_obras
                  ? {
                      ...l.items_base.folhas_obras,
                      numero_fo: l.items_base.folhas_obras.Numero_do_,
                      cliente: l.items_base.folhas_obras.Nome,
                    }
                  : null,
              }
            : null,
        }))
      } else if (logisticsError) {
        console.error('❌ Error fetching logistics:', logisticsError)
      }
    }
    // 3. Create rows: show all logistics records + items without logistics records
    const mergedRows: any[] = [...logisticsData]

    // Create logistics entries for real job items that don't have them yet (exclude temp items)
    const itemsWithoutLogistics = realItems.filter(
      (item) => !logisticsData.some((l) => l.item_id === item.id),
    )

    if (itemsWithoutLogistics.length > 0) {
      console.log(
        '📦 Creating logistics entries for items without them:',
        itemsWithoutLogistics.length,
      )
      // Create logistics entries for all items without them
      const newLogisticsEntries = itemsWithoutLogistics.map((item) => {
        const description = item.descricao || 'Novo Item'
        const quantidade = item.quantidade || null
        console.log('📦 Creating logistics entry for item:', {
          itemId: item.id,
          description,
          quantidade,
        })
        return {
          item_id: item.id,
          descricao: description, // Store item description directly
          quantidade: quantidade, // Copy quantity from item
          data: new Date().toISOString().split('T')[0],
          is_entrega: true,
        }
      })

      const { data: newLogisticsData, error: logisticsInsertError } =
        await supabase.from('logistica_entregas').insert(newLogisticsEntries)
          .select(`
            *,
            items_base (
              id,
              descricao,
              codigo,
              quantidade,
              brindes,
              folha_obra_id,
              folhas_obras (
                id,
                numero_orc,
                Numero_do_,
                Nome
              )
            )
          `)

      if (logisticsInsertError) {
        console.error(
          '❌ Error creating logistics entries:',
          logisticsInsertError,
        )
        console.error('❌ Error details:', {
          message: logisticsInsertError.message,
          code: logisticsInsertError.code,
          details: logisticsInsertError.details,
          hint: logisticsInsertError.hint,
        })
        alert(
          `Erro ao criar entradas de logística: ${logisticsInsertError.message}`,
        )
      } else if (newLogisticsData) {
        console.log('Created logistics entries:', newLogisticsData)
        // Map Numero_do_ to numero_fo for consistency
        const mappedData = newLogisticsData.map((l: any) => ({
          ...l,
          items_base: l.items_base
            ? {
                ...l.items_base,
                folhas_obras: l.items_base.folhas_obras
                  ? {
                      ...l.items_base.folhas_obras,
                      numero_fo: l.items_base.folhas_obras.Numero_do_,
                      cliente: l.items_base.folhas_obras.Nome,
                    }
                  : null,
              }
            : null,
        }))
        // Add the newly created logistics entries to merged rows
        mergedRows.push(...mappedData)
      }
    }

    console.log('📊 Final merged rows:', mergedRows.length)
    console.log(
      '📊 Breakdown: fetched=' +
        logisticsData.length +
        ', created=' +
        (mergedRows.length - logisticsData.length),
    )

    // Backfill data_saida from PHC delivery date for rows that don't have it
    try {
      const normalizeFo = (value: unknown): string => {
        if (value === null || value === undefined) return ''
        return String(value).trim()
      }

      const rowsNeedingDate = mergedRows.filter(
        (r) => !r.data_saida && r.items_base?.folhas_obras?.Numero_do_,
      )
      console.log('📊 Rows needing data_saida:', rowsNeedingDate.length)
      console.log(
        '📊 All rows data_saida status:',
        mergedRows.map((r) => ({
          id: r.id,
          data_saida: r.data_saida,
          fo: r.items_base?.folhas_obras?.Numero_do_,
        })),
      )

      if (rowsNeedingDate.length > 0) {
        const foNumbers = Array.from(
          new Set(
            rowsNeedingDate
              .map((r) => normalizeFo(r.items_base.folhas_obras.Numero_do_))
              .filter((fo) => fo !== ''),
          ),
        )
        console.log(
          '🔄 Backfilling data_saida for',
          rowsNeedingDate.length,
          'rows, FO numbers:',
          foNumbers,
        )

        let phcDates: any[] | null = null
        let phcErr: any = null
        if (foNumbers.length > 0) {
          const phcResult = await supabase
            .schema('phc')
            .from('folha_obra_with_orcamento')
            .select('folha_obra_number, folha_obra_delivery_date')
            .in('folha_obra_number', foNumbers)
          phcDates = phcResult.data
          phcErr = phcResult.error
        }

        console.log('📅 PHC delivery dates fetched:', phcDates)
        if (phcErr) console.error('❌ PHC fetch error:', phcErr)

        if (!phcErr && phcDates) {
          const dateMap = new Map<string, string>()
          phcDates.forEach((r: any) => {
            const normalizedFo = normalizeFo(r.folha_obra_number)
            if (normalizedFo && r.folha_obra_delivery_date) {
              const dateStr = String(r.folha_obra_delivery_date).slice(0, 10)
              dateMap.set(normalizedFo, dateStr)
              console.log('🗃️ Mapped FO', normalizedFo, 'to date', dateStr)
            }
          })

          console.log('🗃️ Date map size:', dateMap.size)
          console.log('🗺️ Date map entries:', Array.from(dateMap.entries()))

          // Update rows in database and local state
          for (const row of rowsNeedingDate) {
            const foRaw = row.items_base.folhas_obras.Numero_do_
            const fo = normalizeFo(foRaw)
            const deliveryDate = dateMap.get(fo)
            console.log(
              '🔍 Checking row',
              row.id,
              'FO:',
              foRaw,
              'Normalized FO:',
              fo,
              'Date map has FO:',
              dateMap.has(fo),
              'Found date:',
              deliveryDate,
            )

            // Skip invalid dates (1900-01-01 is a PHC placeholder)
            const isValidDate = deliveryDate && deliveryDate !== '1900-01-01'
            if (isValidDate && row.id) {
              await supabase
                .from('logistica_entregas')
                .update({ data_saida: deliveryDate })
                .eq('id', row.id)
              row.data_saida = deliveryDate
              console.log(
                '✅ Set data_saida for row',
                row.id,
                'to',
                deliveryDate,
              )
            } else if (!deliveryDate) {
              console.warn('⚠️ No delivery date found in PHC for FO:', fo)
            } else if (deliveryDate === '1900-01-01') {
              console.warn('⚠️ Skipping invalid date (1900-01-01) for FO:', fo)
            }
          }
        }
      } else {
        console.log('✅ All rows already have data_saida')
      }
    } catch (e) {
      console.error('❌ Error backfilling data_saida from PHC:', e)
    }

    setLogisticaRows(mergedRows)
    logisticaFetchedRef.current = true

    // Auto-select the first row with complete delivery data as source
    if (!sourceRowId && mergedRows.length > 0) {
      const firstCompleteRow = mergedRows.find(
        (row) => row.local_recolha && row.local_entrega && row.transportadora,
      )
      if (firstCompleteRow?.id) {
        setSourceRowId(firstCompleteRow.id)
      }
    }

    setLogisticaLoading(false)
  }

  useEffect(() => {
    logisticaFetchedRef.current = false // Reset when job changes
    fetchReferenceData()
    fetchLogisticaRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]) // Run when job ID changes, not jobItems.length

  // Guard clause AFTER all hooks are called
  if (!job) {
    return (
      <div className="flex items-center justify-center p-6">
        <p>Job not found</p>
      </div>
    )
  }

  // --- Job Info Header ---
  return (
    <div className="relative space-y-6 p-6">
      {/* Close button - top right */}
      <Button
        size="icon"
        variant="outline"
        onClick={onClose}
        className="absolute top-6 right-6 z-10"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Job Info Header */}
      <div className="mb-6 p-4 uppercase">
        <div className="mb-2 flex items-center gap-8">
          <div>
            <div className="text-xs ">ORC</div>
            <div className="font-mono">{job.numero_orc ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs ">FO</div>
            <div className="font-mono">{job.numero_fo}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs ">Nome Campanha</div>
            <div className="truncate font-mono">{job.nome_campanha}</div>
          </div>
        </div>
      </div>
      {/* Tabs below job info */}
      <Tabs
        defaultValue="producao"
        className="w-full pl-4"
        onValueChange={async (value) => {
          if (value === 'logistica') {
            // Refresh logistics data when switching to logistics tab
            await fetchLogisticaRows()
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="producao">Produção</TabsTrigger>
          <TabsTrigger value="logistica">Logística</TabsTrigger>
        </TabsList>
        <TabsContent value="producao">
          {/* --- Existing Produção Drawer Content --- */}
          <div className="mt-6">
            {/* header & toolbar */}
            <div className="mb-6">
              <div className="p-0">
                <h2 className="text-lg font-semibold">
                  {job.concluido ? 'Trabalho' : 'Novo Trabalho'} (FO:{' '}
                  {job.numero_fo})
                </h2>
                <p className="text-muted-foreground text-sm">
                  Detalhes Produção Folha de Obra
                </p>
              </div>
            </div>

            {/* Add Item Button */}
            <div className="mb-4 flex justify-end">
              <Button
                size="sm"
                className="bg-yellow-400 hover:bg-yellow-500 border border-black text-black"
                onClick={() => {
                  if (!job) return
                  
                  // Generate a new temporary ID
                  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                  
                  // Create a new pending item
                  const newItem: Item = {
                    id: tempId,
                    folha_obra_id: job.id,
                    descricao: '',
                    codigo: '',
                    quantidade: 1,
                    brindes: false,
                    concluido: false,
                  }
                  
                  // Add to pending items
                  setPendingItems((prev) => ({
                    ...prev,
                    [tempId]: newItem,
                  }))
                  
                  // Mark as editing
                  setEditingItems((prev) => new Set([...Array.from(prev), tempId]))
                  setTempValues((prev) => ({
                    ...prev,
                    [tempId]: {
                      descricao: '',
                      codigo: '',
                      quantidade: 1,
                    },
                  }))
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Item
              </Button>
            </div>

            {/* Production Items table */}
            <Table className="w-full imx-table-compact">
                  <TableHeader>
                    <TableRow className="border-border border-b bg-transparent">
                      <TableHead
                        className="border-border w-10 cursor-pointer border-b bg-primary text-center text-primary-foreground uppercase select-none"
                        onClick={() => toggleSort('bulk')}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                B{' '}
                                {sortCol === 'bulk' &&
                                  (sortDir === 'asc' ? (
                                    <ArrowUp className="ml-1 inline h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="ml-1 inline h-3 w-3" />
                                  ))}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Brindes</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead
                        className="border-border cursor-pointer border-b bg-primary text-primary-foreground uppercase select-none"
                        onClick={() => toggleSort('descricao')}
                      >
                        Item{' '}
                        {sortCol === 'descricao' &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="border-border w-72 cursor-pointer border-b bg-primary text-primary-foreground uppercase select-none"
                        onClick={() => toggleSort('codigo')}
                      >
                        Código{' '}
                        {sortCol === 'codigo' &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="border-border w-24 cursor-pointer border-b bg-primary text-primary-foreground uppercase select-none"
                        onClick={() => toggleSort('quantidade')}
                      >
                        Quantidade{' '}
                        {sortCol === 'quantidade' &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>

                      <TableHead
                        className="border-border w-[120px] cursor-pointer border-b bg-primary text-center text-primary-foreground uppercase select-none"
                        onClick={() => toggleSort('acoes')}
                      >
                        Ações{' '}
                        {sortCol === 'acoes' &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center">
                          Nenhum item encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedItems.map((it, index) => (
                        <TableRow
                          key={it.id || `item-${index}`}
                          className={`hover:bg-accent transition-colors ${isEditing(it.id) ? 'bg-accent/10' : ''}`}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={!!getDisplayValue(it, 'brindes')}
                              disabled={isEditing(it.id)}
                              onCheckedChange={async (checked) => {
                                if (isEditing(it.id)) return

                                const value =
                                  checked === 'indeterminate' ? false : checked

                                if (isNewItem(it.id)) {
                                  updateTempValue(it.id, 'brindes', value)
                                } else {
                                  // Update global state
                                  setAllItems((prevItems) =>
                                    prevItems.map((item) =>
                                      item.id === it.id
                                        ? { ...item, brindes: value }
                                        : item,
                                    ),
                                  )
                                  // Persist to Supabase
                                  await supabase
                                    .from('items_base')
                                    .update({ brindes: value })
                                    .eq('id', it.id)
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={String(
                                getDisplayValue(it, 'descricao') || '',
                              )}
                              onChange={(e) => {
                                const newValue = e.target.value
                                if (isEditing(it.id)) {
                                  updateTempValue(it.id, 'descricao', newValue)
                                }
                              }}
                              onDoubleClick={() => {
                                if (!isEditing(it.id) && !isNewItem(it.id)) {
                                  setEditingItems(
                                    (prev) =>
                                      new Set([...Array.from(prev), it.id]),
                                  )
                                  setTempValues((prev) => ({
                                    ...prev,
                                    [it.id]: {
                                      descricao: it.descricao,
                                      codigo: it.codigo,
                                      quantidade: it.quantidade,
                                    },
                                  }))
                                }
                              }}
                              disabled={!isEditing(it.id) && !isNewItem(it.id)}
                              className="disabled:text-foreground h-10 text-sm disabled:cursor-pointer disabled:opacity-100"
                              placeholder="Descrição do item"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={String(
                                getDisplayValue(it, 'codigo') || '',
                              )}
                              onChange={(e) => {
                                const newValue = e.target.value
                                if (isEditing(it.id)) {
                                  updateTempValue(it.id, 'codigo', newValue)
                                }
                              }}
                              onDoubleClick={() => {
                                if (!isEditing(it.id) && !isNewItem(it.id)) {
                                  setEditingItems(
                                    (prev) =>
                                      new Set([...Array.from(prev), it.id]),
                                  )
                                  setTempValues((prev) => ({
                                    ...prev,
                                    [it.id]: {
                                      descricao: it.descricao,
                                      codigo: it.codigo,
                                      quantidade: it.quantidade,
                                    },
                                  }))
                                }
                              }}
                              disabled={!isEditing(it.id) && !isNewItem(it.id)}
                              className="disabled:text-foreground h-10 text-sm disabled:cursor-pointer disabled:opacity-100"
                              placeholder="Código do item"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="text"
                              value={String(
                                getDisplayValue(it, 'quantidade') ?? '',
                              )}
                              onChange={(e) => {
                                const value = e.target.value.trim()
                                const numValue =
                                  value === '' ? null : Number(value)
                                if (isEditing(it.id)) {
                                  updateTempValue(it.id, 'quantidade', numValue)
                                }
                              }}
                              onDoubleClick={() => {
                                if (!isEditing(it.id) && !isNewItem(it.id)) {
                                  setEditingItems(
                                    (prev) =>
                                      new Set([...Array.from(prev), it.id]),
                                  )
                                  setTempValues((prev) => ({
                                    ...prev,
                                    [it.id]: {
                                      descricao: it.descricao,
                                      codigo: it.codigo,
                                      quantidade: it.quantidade,
                                    },
                                  }))
                                }
                              }}
                              disabled={!isEditing(it.id) && !isNewItem(it.id)}
                              className="disabled:text-foreground h-10 w-20 text-right text-sm disabled:cursor-pointer disabled:opacity-100"
                              placeholder="Qtd"
                            />
                          </TableCell>

                          <TableCell className="w-[130px] min-w-[130px] p-2 text-sm">
                            {isEditing(it.id) ? (
                              // Save/Cancel buttons for editing mode
                              <div className="flex justify-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="default"
                                        className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 border border-black"
                                        onClick={() =>
                                          isPending(it.id)
                                            ? acceptItem(it)
                                            : saveItem(it)
                                        }
                                        disabled={isSaving(it.id)}
                                      >
                                        {isSaving(it.id) ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Check className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {isPending(it.id) ? 'Aceitar' : 'Salvar'}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="destructive"
                                        className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 border border-black"
                                        onClick={() => cancelEdit(it.id)}
                                        disabled={isSaving(it.id)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Cancelar</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            ) : (
                              // Normal edit/duplicate/delete buttons
                              <div className="flex justify-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 border border-black"
                                        onClick={() => {
                                          if (!isNewItem(it.id)) {
                                            setEditingItems(
                                              (prev) =>
                                                new Set([
                                                  ...Array.from(prev),
                                                  it.id,
                                                ]),
                                            )
                                            setTempValues((prev) => ({
                                              ...prev,
                                              [it.id]: {
                                                descricao: it.descricao,
                                                codigo: it.codigo,
                                                quantidade: it.quantidade,
                                              },
                                            }))
                                          }
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Editar</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 border border-black"
                                        onClick={() => duplicateItem(it)}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Duplicar</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="destructive"
                                        className="aspect-square !h-10 !w-10 !max-w-10 !min-w-10 !rounded-none !p-0 border border-black"
                                        onClick={async () => {
                                          if (isNewItem(it.id)) {
                                            // Just remove from state for temp items
                                            setAllItems((prev) =>
                                              prev.filter(
                                                (item) => item.id !== it.id,
                                              ),
                                            )
                                          } else {
                                            try {
                                              // Delete from items_base - CASCADE will handle related tables:
                                              // - logistica_entregas (CASCADE)
                                              // - designer_items (CASCADE)
                                              // - producao_operacoes (CASCADE)
                                              const { error: deleteError } = await supabase
                                                .from('items_base')
                                                .delete()
                                                .eq('id', it.id)

                                              if (deleteError) {
                                                throw deleteError
                                              }

                                              console.log(`✅ Item ${it.descricao} eliminado com sucesso (CASCADE)`)

                                              setAllItems((prev) =>
                                                prev.filter(
                                                  (item) => item.id !== it.id,
                                                ),
                                              )
                                            } catch (error) {
                                              console.error('Error deleting item:', error)
                                              alert('Erro ao eliminar o item. Tente novamente.')
                                            }
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
                            )}
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
                  Página {currentPage} de {totalPages} ({sortedItems.length} items)
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
        <TabsContent value="logistica">
          <div className="mt-6">
            <div className="mb-6 flex items-start justify-between">
              <div className="p-0">
                <h2 className="text-xl ">
                  Listagem Recolhas Entregas
                </h2>
                <p className="text-muted-foreground text-sm">
                  Listagem de recolhas e entregas para esta folha de obra.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={async () => {
                    // Copy delivery information from source row to all other rows
                    if (!sourceRowId) {
                      alert(
                        'Selecione uma linha como fonte (usando o botão de opção) antes de copiar informações de entrega.',
                      )
                      return
                    }

                    const sourceRow = logisticaRows.find(
                      (row) => row.id === sourceRowId,
                    )
                    if (!sourceRow) {
                      alert('Linha fonte não encontrada.')
                      return
                    }

                    const confirmed = confirm(
                      `Copiar informações de entrega da linha "${sourceRow.items_base?.descricao || sourceRow.descricao}" para todas as outras linhas?`,
                    )
                    if (!confirmed) return

                    const deliveryInfo = {
                      local_recolha: sourceRow.local_recolha,
                      local_entrega: sourceRow.local_entrega,
                      transportadora: sourceRow.transportadora,
                      id_local_recolha: sourceRow.id_local_recolha,
                      id_local_entrega: sourceRow.id_local_entrega,
                      data_saida: sourceRow.data_saida, // Add data_saida field
                    }

                    // Update all other rows (excluding the source row)
                    const updatePromises = logisticaRows
                      .filter((row) => row.id && row.id !== sourceRowId)
                      .map((record) => {
                        if (record.id) {
                          return supabase
                            .from('logistica_entregas')
                            .update(deliveryInfo)
                            .eq('id', record.id)
                        }
                      })

                    try {
                      await Promise.all(updatePromises.filter(Boolean))
                      // Refresh logistica data to show the updates
                      await fetchLogisticaRows()

                      // Update local state to reflect the changes in comboboxes
                      setLogisticaRows((prevRows) =>
                        prevRows.map((record) => {
                          if (record.id !== sourceRowId) {
                            return { ...record, ...deliveryInfo }
                          }
                          return record
                        }),
                      )

                    alert('Informações de entrega copiadas com sucesso!')
                  } catch (error) {
                    console.error(
                      'Error copying delivery information:',
                      error,
                    )
                    alert(
                      'Erro ao copiar informações de entrega. Tente novamente.',
                    )
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar Entrega
                {sourceRowId && (
                  <span className="bg-primary/20 ml-2 rounded px-2 py-1 text-xs">
                    Fonte:{' '}
                    {logisticaRows.find((r) => r.id === sourceRowId)
                      ?.items_base?.descricao || 'Selecionada'}
                  </span>
                )}
              </Button>
              {/* Add new logistics row */}
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    if (!sourceRowId) {
                      alert(
                        'Selecione uma linha como fonte para criar uma nova entrada ligada ao mesmo item.',
                      )
                      return
                    }
                    const sourceRow = logisticaRows.find(
                      (row) => row.id === sourceRowId,
                    )
                    if (!sourceRow) {
                      alert('Linha fonte não encontrada.')
                      return
                    }
                    const today = new Date().toISOString().split('T')[0]
                    const { data, error } = await supabase
                      .from('logistica_entregas')
                      .insert({
                        item_id: sourceRow.item_id,
                        data: today,
                        is_entrega: true,
                        // defaults
                        saiu: false,
                        brindes: false,
                        concluido: false,
                      })
                      .select(
                        `
                          *,
                          items_base!inner (
                            id,
                            descricao,
                            codigo,
                            quantidade,
                            brindes,
                            folha_obra_id,
                            folhas_obras!inner (
                              id,
                              numero_orc,
                              Numero_do_,
                              cliente:Nome
                            )
                          )
                        `,
                      )
                      .single()
                    if (error) throw error
                    if (data) {
                      // Normalize FO mapping for immediate UI consistency
                      const mapped = {
                        ...data,
                        items_base: data.items_base
                          ? {
                              ...data.items_base,
                              folhas_obras: data.items_base.folhas_obras
                                ? {
                                    ...data.items_base.folhas_obras,
                                    numero_fo:
                                      data.items_base.folhas_obras
                                        .Numero_do_,
                                  }
                                : null,
                            }
                          : null,
                      }
                      setLogisticaRows((prev) => [...prev, mapped])
                    }
                  } catch (err) {
                    console.error('Erro ao adicionar linha:', err)
                    alert('Erro ao adicionar nova linha de logística')
                  }
                }}
                className="ml-2"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Linha
              </Button>
              </div>
            </div>
            {logisticaLoading ? (
              <div className="mt-6 flex h-40 items-center justify-center">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              </div>
            ) : (
              <LogisticaTableWithCreatable
                    records={logisticaRows}
                    clientes={[...(logisticaClientes || []), ...extraClientes]}
                    transportadoras={logisticaTransportadoras || []}
                    armazens={logisticaArmazens || []}
                    hideColumns={['saiu', 'cliente', 'guia']}
                    hideActions={false}
                    showSourceSelection={true}
                    sourceRowId={sourceRowId}
                    onSourceRowChange={setSourceRowId}
                    onFoSave={async (row: any, foValue: string) => {
                      try {
                        if (!row?.id || !foValue) return
                        console.log(
                          '🔍 FO SAVE TRIGGERED - Searching for FO:',
                          foValue.trim(),
                        )
                        // Inline PHC fetch
                        const { data: phcData, error: phcErr } = await supabase
                          .schema('phc')
                          .from('folha_obra_with_orcamento')
                          .select(
                            'orcamento_number, customer_id, nome_trabalho, folha_obra_delivery_date',
                          )
                          .eq('folha_obra_number', foValue.trim())
                          .limit(1)
                          .maybeSingle()
                        if (phcErr) {
                          console.warn('⚠️ PHC fetch error:', phcErr)
                        }
                        const phcRow = phcData || null
                        if (!phcRow) {
                          console.warn('⚠️ No PHC data for FO:', foValue)
                          // still persist FO
                          const updatedItemsBase = {
                            ...row.items_base,
                            folhas_obras: {
                              ...row.items_base?.folhas_obras,
                              numero_fo: foValue.trim(),
                            },
                          }
                          await supabase
                            .from('logistica')
                            .update({ items_base: updatedItemsBase })
                            .eq('id', row.id)
                          setLogisticaRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, items_base: updatedItemsBase }
                                : r,
                            ),
                          )
                          return
                        }
                        console.log('✅ PHC data found!', phcRow)
                        // Prepare updates
                        let deliveryDate = phcRow.folha_obra_delivery_date
                          ? String(phcRow.folha_obra_delivery_date).slice(0, 10)
                          : null
                        // Skip invalid placeholder dates
                        if (deliveryDate === '1900-01-01') {
                          console.warn(
                            '⚠️ Skipping invalid delivery date (1900-01-01) for FO:',
                            foValue,
                          )
                          deliveryDate = null
                        }

                        const updatedItemsBase = {
                          ...row.items_base,
                          folhas_obras: {
                            ...row.items_base?.folhas_obras,
                            numero_fo: foValue.trim(),
                            // Persist numero_orc and keep Nome if present
                            numero_orc:
                              phcRow.orcamento_number ??
                              (row.items_base?.folhas_obras as any)?.numero_orc,
                            id_cliente:
                              phcRow.customer_id?.toString?.() ??
                              String(phcRow.customer_id ?? ''),
                          },
                        }
                        const updatedFolhaObraWithOrc = {
                          numero_orc: phcRow.orcamento_number,
                        }
                        // Persist
                        const { error } = await supabase
                          .from('logistica')
                          .update({
                            items_base: updatedItemsBase,
                            folha_obra_with_orcamento: updatedFolhaObraWithOrc,
                          })
                          .eq('id', row.id)
                        if (error) {
                          console.error('❌ Update failed:', error)
                        }
                        if (deliveryDate) {
                          try {
                            await supabase
                              .from('logistica_entregas')
                              .update({ data_saida: deliveryDate })
                              .eq('id', row.id)
                            const { data: updatedLogistica, error: logErr } =
                              await supabase
                                .from('logistica_entregas')
                                .select('id, data_saida')
                                .eq('id', row.id)
                                .maybeSingle()
                            if (logErr) {
                              console.warn(
                                '⚠️ Failed fetching updated data_saida after FO sync:',
                                logErr,
                              )
                            } else {
                              console.log('🧾 data_saida after FO sync:', {
                                id: updatedLogistica?.id,
                                data_saida: updatedLogistica?.data_saida,
                                deliveryDate,
                              })
                            }
                          } catch (e) {
                            console.warn(
                              '⚠️ Failed to persist delivery date to data_saida:',
                              e,
                            )
                          }
                        }
                        // Also persist numero_orc into public.folhas_obras by folha_obra_id (most reliable)
                        try {
                          const folhasObrasId =
                            row.items_base?.folha_obra_id ||
                            (row.items_base?.folhas_obras as any)?.id
                          const numeroOrc = Number(phcRow.orcamento_number)
                          const foNum = String(foValue).trim()
                          console.log(
                            '🧾 Persist numero_orc to folhas_obras:',
                            {
                              folhasObrasId,
                              numeroOrc,
                              foNum,
                            },
                          )
                          let persisted = false
                          if (folhasObrasId && numeroOrc) {
                            const { data, error } = await supabase
                              .from('folhas_obras')
                              .update({ numero_orc: numeroOrc })
                              .eq('id', folhasObrasId)
                              .select('id')
                              .maybeSingle()
                            if (error)
                              console.error('❌ Update by id failed:', error)
                            if (data) persisted = true
                            console.log('✅ Update by id result:', {
                              data,
                              persisted,
                            })
                          }
                          if (!persisted && numeroOrc && foNum) {
                            // Try by numero_fo
                            const { data, error } = await supabase
                              .from('folhas_obras')
                              .update({ numero_orc: numeroOrc })
                              .eq('numero_fo', foNum)
                              .select('id')
                            if (error)
                              console.warn(
                                '⚠️ Update by numero_fo failed:',
                                error,
                              )
                            if (data && data.length > 0) persisted = true
                            console.log('Result by numero_fo:', {
                              count: data?.length || 0,
                            })
                          }
                          if (!persisted && numeroOrc && foNum) {
                            // Try by alternative FO column name (as seen in UI)
                            const { data, error } = await supabase
                              .from('folhas_obras')
                              .update({ numero_orc: numeroOrc })
                              .eq('Numero_do_', foNum)
                              .select('id')
                            if (error)
                              console.warn(
                                '⚠️ Update by Numero_do_ failed:',
                                error,
                              )
                            console.log('Result by Numero_do_:', {
                              count: data?.length || 0,
                            })
                          }
                        } catch (e) {
                          console.warn(
                            'Could not persist numero_orc to folhas_obras:',
                            e,
                          )
                        }
                        // Update UI immediately
                        setLogisticaRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  items_base: {
                                    ...updatedItemsBase,
                                    folhas_obras: {
                                      ...(updatedItemsBase.folhas_obras || {}),
                                      // Echo Nome from DB if it already exists; otherwise leave as-is
                                      Nome:
                                        (r.items_base as any)?.folhas_obras
                                          ?.Nome ||
                                        (row.items_base as any)?.folhas_obras
                                          ?.Nome ||
                                        undefined,
                                    },
                                  },
                                  folha_obra_with_orcamento:
                                    updatedFolhaObraWithOrc,
                                  data_saida: deliveryDate ?? r.data_saida,
                                }
                              : r,
                          ),
                        )
                        // Ensure CLIENTE option exists so combobox renders label
                        const cid = updatedItemsBase.folhas_obras?.id_cliente
                        if (cid) {
                          const exists =
                            (logisticaClientes || []).some(
                              (c) => c.value === cid,
                            ) || extraClientes.some((c) => c.value === cid)
                          if (!exists) {
                            setExtraClientes((prev) => [
                              ...prev,
                              { value: String(cid), label: `Cliente ${cid}` },
                            ])
                          }
                        }
                      } catch (e) {
                        console.error('❌ ERROR in onFoSave:', e)
                      }
                    }}
                    onClienteChange={async (row: any, value: string) => {
                      try {
                        if (!row?.id) return
                        const updatedItemsBase = {
                          ...row.items_base,
                          folhas_obras: {
                            ...row.items_base?.folhas_obras,
                            id_cliente: value || null,
                          },
                        }
                        const { error } = await supabase
                          .from('logistica')
                          .update({ items_base: updatedItemsBase })
                          .eq('id', row.id)
                        if (error) {
                          console.error('❌ Failed to update cliente:', error)
                        }
                        setLogisticaRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? { ...r, items_base: updatedItemsBase }
                              : r,
                          ),
                        )
                      } catch (e) {
                        console.error('❌ ERROR in onClienteChange:', e)
                      }
                    }}
                    onItemSave={async (row: any, value) => {
                      console.log('📝 Updating item description:', {
                        rowId: row.id,
                        itemId: row.item_id,
                        value,
                      })
                      // Update ONLY the logistics entry description, NOT the original item description
                      if (row.id) {
                        // Update existing logistics record
                        try {
                          const success = await updateLogisticaField(
                            row.id,
                            'descricao',
                            value,
                            null,
                          )
                          if (success) {
                            console.log(
                              '✅ Successfully updated item description',
                            )
                            setLogisticaRows((prevRows) =>
                              prevRows.map((r) =>
                                r.id === row.id
                                  ? { ...r, descricao: value }
                                  : r,
                              ),
                            )
                          } else {
                            console.error(
                              '❌ Failed to update item description',
                            )
                            alert('Erro ao atualizar descrição do item')
                          }
                        } catch (error) {
                          console.error(
                            '❌ Error updating item description:',
                            error,
                          )
                          alert(`Erro ao atualizar descrição: ${error}`)
                        }
                      } else if (row.item_id) {
                        // Create new logistics record with description
                        console.log(
                          '🆕 Creating new logistics record with description:',
                          value,
                        )
                        try {
                          const { data, error } = await supabase
                            .from('logistica_entregas')
                            .insert({
                              item_id: row.item_id,
                              descricao: value,
                              data: new Date().toISOString().split('T')[0],
                              is_entrega: true,
                            })
                            .select(
                              `
                                *,
                                items_base!inner (
                                  id,
                                  descricao,
                                  codigo,
                                  quantidade,
                                  brindes,
                                  folha_obra_id,
                                  folhas_obras!inner (
                                    id,
                                    numero_orc,
                                    Numero_do_,
                                    cliente:Nome
                                  )
                                )
                              `,
                            )
                            .single()
                          if (!error && data) {
                            // If DATA SAÍDA missing, try to backfill from PHC delivery date
                            try {
                              const fo = (data as any)?.items_base?.folhas_obras
                                ?.numero_fo
                              const hasDate = (data as any)?.data_saida
                              if (fo && !hasDate) {
                                const { data: phcRow, error: phcErr } =
                                  await supabase
                                    .schema('phc')
                                    .from('folha_obra_with_orcamento')
                                    .select('folha_obra_delivery_date')
                                    .eq('folha_obra_number', fo)
                                    .limit(1)
                                    .single()
                                if (
                                  !phcErr &&
                                  phcRow?.folha_obra_delivery_date
                                ) {
                                  const d = String(
                                    phcRow.folha_obra_delivery_date,
                                  ).slice(0, 10)
                                  await supabase
                                    .from('logistica_entregas')
                                    .update({ data_saida: d })
                                    .eq('id', (data as any).id)
                                  ;(data as any).data_saida = d
                                }
                              }
                            } catch (e) {
                              console.warn(
                                'Could not backfill DATA SAÍDA from PHC:',
                                e,
                              )
                            }
                            setLogisticaRows((prevRows) =>
                              prevRows.map((r) =>
                                r.item_id === row.item_id && !r.id ? data : r,
                              ),
                            )
                          } else {
                            console.error(
                              '❌ Error creating new logistics record:',
                              error,
                            )
                            alert(
                              `Erro ao criar novo registo de logística: ${error?.message}`,
                            )
                          }
                        } catch (error) {
                          console.error(
                            '❌ Exception creating new logistics record:',
                            error,
                          )
                          alert(`Erro ao criar registo: ${error}`)
                        }
                      }
                    }}
                    onConcluidoSave={async (row: any, value) => {
                      const today = new Date().toISOString().split('T')[0]

                      if (!row.id && row.item_id) {
                        // When creating a new entry
                        const { data, error } = await supabase
                          .from('logistica_entregas')
                          .insert({
                            item_id: row.item_id,
                            concluido: value,
                            data_concluido: value ? today : null,
                            data_saida: value ? today : null,
                            data: today,
                            is_entrega: true,
                          })
                          .select(
                            `
                              *,
                              items_base!inner (
                                id,
                                descricao,
                                codigo,
                                quantidade,
                                brindes,
                                folha_obra_id,
                                folhas_obras!inner (
                                  id,
                                  numero_orc,
                                  Numero_do_,
                                  cliente:Nome
                                )
                              )
                            `,
                          )
                          .single()
                        if (!error && data) {
                          // If DATA SAÍDA missing, try to backfill from PHC delivery date
                          try {
                            const fo = (data as any)?.items_base?.folhas_obras
                              ?.numero_fo
                            const hasDate = (data as any)?.data_saida
                            if (fo && !hasDate) {
                              const { data: phcRow, error: phcErr } =
                                await supabase
                                  .schema('phc')
                                  .from('folha_obra_with_orcamento')
                                  .select('folha_obra_delivery_date')
                                  .eq('folha_obra_number', fo)
                                  .limit(1)
                                  .single()
                              if (!phcErr && phcRow?.folha_obra_delivery_date) {
                                const d = String(
                                  phcRow.folha_obra_delivery_date,
                                ).slice(0, 10)
                                await supabase
                                  .from('logistica_entregas')
                                  .update({ data_saida: d })
                                  .eq('id', (data as any).id)
                                ;(data as any).data_saida = d
                              }
                            }
                          } catch (e) {
                            console.warn(
                              'Could not backfill DATA SAÍDA from PHC:',
                              e,
                            )
                          }
                          // Update local state instead of refetching
                          setLogisticaRows((prevRows) =>
                            prevRows.map((r) =>
                              r.item_id === row.item_id && !r.id ? data : r,
                            ),
                          )
                        }
                      } else if (row.id) {
                        if (value) {
                          // When checking concluido, always set both dates to today
                          await Promise.all([
                            updateLogisticaField(
                              row.id,
                              'concluido',
                              value,
                              null,
                            ),
                            updateLogisticaField(
                              row.id,
                              'data_concluido',
                              today,
                              null,
                            ),
                            updateLogisticaField(
                              row.id,
                              'data_saida',
                              today,
                              null,
                            ),
                          ])

                          // Update local state
                          setLogisticaRows((prevRows) =>
                            prevRows.map((r) =>
                              r.id === row.id
                                ? {
                                    ...r,
                                    concluido: value,
                                    data_concluido: today,
                                    data_saida: today,
                                  }
                                : r,
                            ),
                          )
                        } else {
                          // When unchecking concluido, clear both dates
                          await Promise.all([
                            updateLogisticaField(
                              row.id,
                              'concluido',
                              value,
                              null,
                            ),
                            updateLogisticaField(
                              row.id,
                              'data_concluido',
                              null,
                              null,
                            ),
                            updateLogisticaField(
                              row.id,
                              'data_saida',
                              null,
                              null,
                            ),
                          ])

                          // Update local state
                          setLogisticaRows((prevRows) =>
                            prevRows.map((r) =>
                              r.id === row.id
                                ? {
                                    ...r,
                                    concluido: value,
                                    data_concluido: null,
                                    data_saida: null,
                                  }
                                : r,
                            ),
                          )
                        }
                      }
                    }}
                    onDataConcluidoSave={async (row: any, value: string) => {
                      if (row.id) {
                        // Update only data_saida since this is now the DATA SAÍDA column
                        await updateLogisticaField(
                          row.id,
                          'data_saida',
                          value,
                          null,
                        )
                        setLogisticaRows((prevRows) =>
                          prevRows.map((r) =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  data_saida: value,
                                }
                              : r,
                          ),
                        )
                      }
                    }}
                    onSaiuSave={async (row: any, value: boolean) => {
                      if (row.id) {
                        await updateLogisticaField(row.id, 'saiu', value, null)
                        setLogisticaRows((prevRows) =>
                          prevRows.map((r) =>
                            r.id === row.id ? { ...r, saiu: value } : r,
                          ),
                        )
                      }
                    }}
                    onGuiaSave={async (row: any, value: string) => {
                      console.log('📋 Updating guia:', {
                        rowId: row.id,
                        value,
                        valueType: typeof value,
                      })
                      if (row.id) {
                        try {
                          // Additional logging for guia field debugging
                          console.log('📋 Guia field details:', {
                            original: value,
                            trimmed: value?.trim(),
                            isEmpty:
                              value === '' ||
                              value === null ||
                              value === undefined,
                            isNumeric: !isNaN(parseInt(value?.trim() || '')),
                          })

                          const success = await updateLogisticaField(
                            row.id,
                            'guia',
                            value,
                            null,
                          )
                          if (success) {
                            console.log('✅ Successfully updated guia')
                            setLogisticaRows((prevRows) =>
                              prevRows.map((r) =>
                                r.id === row.id ? { ...r, guia: value } : r,
                              ),
                            )
                          } else {
                            console.error(
                              '❌ Failed to update guia - updateLogisticaField returned false',
                            )
                            alert('Erro ao atualizar guia - operação falhou')
                          }
                        } catch (error: any) {
                          console.error('❌ Error updating guia:', error)
                          console.error('❌ Error details:', {
                            message: error?.message,
                            code: error?.code,
                            details: error?.details,
                          })
                          alert(
                            `Erro ao atualizar guia: ${error?.message || error}`,
                          )
                        }
                      } else {
                        console.error('❌ Missing row.id for guia update')
                        alert('Erro: ID da linha não encontrado')
                      }
                    }}
                    onBrindesSave={async (row: any, value: boolean) => {
                      if (row.id) {
                        await updateLogisticaField(
                          row.id,
                          'brindes',
                          value,
                          null,
                        )
                        setLogisticaRows((prevRows) =>
                          prevRows.map((r) =>
                            r.id === row.id ? { ...r, brindes: value } : r,
                          ),
                        )
                      }
                    }}
                    onRecolhaChange={async (rowId: string, value: string) => {
                      console.log('🏠 Updating local_recolha:', {
                        rowId,
                        value,
                      })
                      try {
                        // Find the selected armazem to get the text label
                        const selectedArmazem = logisticaArmazens.find(
                          (a) => a.value === value,
                        )
                        const textValue = selectedArmazem
                          ? selectedArmazem.label
                          : ''

                        console.log('🏠 Armazem details:', {
                          id: value,
                          text: textValue,
                        })

                        // Update both ID and text fields
                        const success = await Promise.all([
                          updateLogisticaField(
                            rowId,
                            'id_local_recolha',
                            value,
                            null,
                          ),
                          updateLogisticaField(
                            rowId,
                            'local_recolha',
                            textValue,
                            null,
                          ),
                        ])

                        if (success.every((s) => s)) {
                          console.log(
                            '✅ Successfully updated both id_local_recolha and local_recolha',
                          )
                          setLogisticaRows((prevRows) =>
                            prevRows.map((r) =>
                              r.id === rowId
                                ? {
                                    ...r,
                                    id_local_recolha: value,
                                    local_recolha: textValue,
                                  }
                                : r,
                            ),
                          )
                        } else {
                          console.error(
                            '❌ Failed to update local_recolha fields',
                          )
                          alert('Erro ao atualizar local de recolha')
                        }
                      } catch (error) {
                        console.error('❌ Error updating local_recolha:', error)
                        alert(`Erro ao atualizar local de recolha: ${error}`)
                      }
                    }}
                    onEntregaChange={async (rowId: string, value: string) => {
                      console.log('🚚 Updating local_entrega:', {
                        rowId,
                        value,
                      })
                      try {
                        // Find the selected armazem to get the text label
                        const selectedArmazem = logisticaArmazens.find(
                          (a) => a.value === value,
                        )
                        const textValue = selectedArmazem
                          ? selectedArmazem.label
                          : ''

                        console.log('🚚 Armazem details:', {
                          id: value,
                          text: textValue,
                        })

                        // Update both ID and text fields
                        const success = await Promise.all([
                          updateLogisticaField(
                            rowId,
                            'id_local_entrega',
                            value,
                            null,
                          ),
                          updateLogisticaField(
                            rowId,
                            'local_entrega',
                            textValue,
                            null,
                          ),
                        ])

                        if (success.every((s) => s)) {
                          console.log(
                            '✅ Successfully updated both id_local_entrega and local_entrega',
                          )
                          setLogisticaRows((prevRows) =>
                            prevRows.map((r) =>
                              r.id === rowId
                                ? {
                                    ...r,
                                    id_local_entrega: value,
                                    local_entrega: textValue,
                                  }
                                : r,
                            ),
                          )
                        } else {
                          console.error(
                            '❌ Failed to update local_entrega fields',
                          )
                          alert('Erro ao atualizar local de entrega')
                        }
                      } catch (error) {
                        console.error('❌ Error updating local_entrega:', error)
                        alert(`Erro ao atualizar local de entrega: ${error}`)
                      }
                    }}
                    onTransportadoraChange={async (row: any, value: string) => {
                      console.log('🚛 Updating transportadora:', {
                        rowId: row.id,
                        value,
                      })
                      if (row.id) {
                        try {
                          // For transportadora, the field stores the ID directly (not separate ID/text fields)
                          // But let's log what transportadora name this ID represents
                          const selectedTransportadora =
                            logisticaTransportadoras.find(
                              (t) => t.value === value,
                            )
                          const textValue = selectedTransportadora
                            ? selectedTransportadora.label
                            : ''

                          console.log('🚛 Transportadora details:', {
                            id: value,
                            text: textValue,
                          })

                          const success = await updateLogisticaField(
                            row.id,
                            'transportadora',
                            value, // Store the ID in the transportadora field
                            null,
                          )
                          if (success) {
                            console.log(
                              '✅ Successfully updated transportadora',
                            )
                            setLogisticaRows((prevRows) =>
                              prevRows.map((r) =>
                                r.id === row.id
                                  ? { ...r, transportadora: value }
                                  : r,
                              ),
                            )
                          } else {
                            console.error('❌ Failed to update transportadora')
                            alert('Erro ao atualizar transportadora')
                          }
                        } catch (error) {
                          console.error(
                            '❌ Error updating transportadora:',
                            error,
                          )
                          alert(`Erro ao atualizar transportadora: ${error}`)
                        }
                      } else {
                        console.error(
                          '❌ Missing row.id for transportadora update',
                        )
                        alert('Erro: ID da linha não encontrado')
                      }
                    }}
                    onQuantidadeSave={async (
                      row: any,
                      value: number | null,
                    ) => {
                      console.log('🔢 Updating quantidade:', {
                        rowId: row.id,
                        value,
                        valueType: typeof value,
                      })
                      if (row.id) {
                        try {
                          const success = await updateLogisticaField(
                            row.id,
                            'quantidade',
                            value,
                            null,
                          )
                          if (success) {
                            console.log('✅ Successfully updated quantidade')
                            setLogisticaRows((prevRows) =>
                              prevRows.map((r) =>
                                r.id === row.id
                                  ? { ...r, quantidade: value }
                                  : r,
                              ),
                            )
                          } else {
                            console.error('❌ Failed to update quantidade')
                            alert('Erro ao atualizar quantidade')
                          }
                        } catch (error: any) {
                          console.error('❌ Error updating quantidade:', error)
                          alert(
                            `Erro ao atualizar quantidade: ${error?.message || error}`,
                          )
                        }
                      } else {
                        console.error('❌ Missing row.id for quantidade update')
                        alert('Erro: ID da linha não encontrado')
                      }
                    }}
                    onDuplicateRow={async (row: any) => {
                      if (row.id) {
                        // Create a duplicate logistics entry
                        const { data, error } = await supabase
                          .from('logistica_entregas')
                          .insert({
                            item_id: row.item_id,
                            descricao: row.descricao,
                            quantidade: row.quantidade,
                            local_recolha: row.local_recolha,
                            local_entrega: row.local_entrega,
                            transportadora: row.transportadora,
                            id_local_recolha: row.id_local_recolha,
                            id_local_entrega: row.id_local_entrega,
                            data: new Date().toISOString().split('T')[0],
                            is_entrega: row.is_entrega,
                          })
                          .select(
                            `
                              *,
                              items_base!inner (
                                id,
                                descricao,
                                codigo,
                                quantidade,
                                brindes,
                                folha_obra_id,
                                  folhas_obras!inner (
                                  id,
                                  numero_orc,
                                  Numero_do_,
                                  cliente:Nome
                                )
                              )
                            `,
                          )
                          .single()

                        if (!error && data) {
                          setLogisticaRows((prevRows) => [...prevRows, data])
                        }
                      }
                    }}
                    onNotasSave={async (
                      row: any,
                      outras: string,
                      contacto?: string, // This will be undefined from updated components
                      telefone?: string, // This will be undefined from updated components
                      contacto_entrega?: string,
                      telefone_entrega?: string,
                      data?: string | null,
                    ) => {
                      if (row.id) {
                        const updateData: any = {
                          notas: outras,
                          contacto_entrega: contacto_entrega || null,
                          telefone_entrega: telefone_entrega || null,
                          data: data || null,
                        }

                        // Only include pickup contact fields if they are provided (for backward compatibility)
                        if (contacto !== undefined) {
                          updateData.contacto = contacto || null
                        }
                        if (telefone !== undefined) {
                          updateData.telefone = telefone || null
                        }

                        await Promise.all(
                          Object.entries(updateData).map(([field, value]) =>
                            updateLogisticaField(row.id, field, value, null),
                          ),
                        )

                        setLogisticaRows((prevRows) =>
                          prevRows.map((r) =>
                            r.id === row.id ? { ...r, ...updateData } : r,
                          ),
                        )
                      }
                    }}
                    onDeleteRow={async (rowId: string) => {
                      if (rowId) {
                        await deleteLogisticaRow(rowId, new Date())
                        setLogisticaRows((prevRows) =>
                          prevRows.filter((r) => r.id !== rowId),
                        )
                      }
                    }}
                    tableDate={new Date().toISOString().split('T')[0]}
                    onArmazensUpdate={() => {
                      // Refresh reference data
                      fetchReferenceData()
                    }}
                    onTransportadorasUpdate={() => {
                      // Refresh reference data
                      fetchReferenceData()
                    }}
                    onClientesUpdate={() => {
                      // Refresh reference data
                      fetchReferenceData()
                    }}
                  />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

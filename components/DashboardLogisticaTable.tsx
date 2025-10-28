'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowUp,
  ArrowDown,
  RefreshCcw,
  X,
  FileText,
} from 'lucide-react'
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import DatePicker from '@/components/ui/DatePicker'
import { createBrowserClient } from '@/utils/supabase'
import CreatableArmazemCombobox, {
  ArmazemOption,
} from '@/components/forms/CreatableArmazemCombobox'
import CreatableTransportadoraCombobox, {
  TransportadoraOption,
} from '@/components/forms/CreatableTransportadoraCombobox'
import NotasPopover from '@/components/custom/NotasPopover'
import TransportePopover from '@/components/custom/TransportePopover'

// Debug logging helper
const debugLog = (label: string, data: any) => console.log(label, data)

// Value-based debounce hook for filters
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

interface DashboardLogisticaRecord {
  // From folhas_obras
  folha_obra_id: string
  numero_fo: string
  numero_orc?: number
  nome_campanha: string
  fo_data_saida?: string
  fo_saiu?: boolean
  cliente?: string
  id_cliente?: string

  // From items_base
  item_id: string
  item_descricao: string
  codigo?: string
  quantidade?: number
  brindes?: boolean
  data_conc?: string

  // From logistica_entregas (these fields moved here)
  logistica_id?: string
  guia?: string | null
  notas?: string
  transportadora?: string
  local_entrega?: string
  local_recolha?: string
  contacto?: string
  telefone?: string
  contacto_entrega?: string
  telefone_entrega?: string
  logistica_quantidade?: number
  data?: string | null
  id_local_entrega?: string
  id_local_recolha?: string
  // New/moved fields in logistica_entregas
  concluido?: boolean
  data_concluido?: string
  saiu?: boolean
  data_saida?: string | null // Added field for departure date
}

interface Cliente {
  value: string
  label: string
}

interface Transportadora {
  value: string
  label: string
}

interface DashboardLogisticaTableProps {
  onRefresh?: () => void
}

// Define sortable columns type following the same pattern as main production table
type SortableLogisticaKey =
  | 'numero_fo'
  | 'numero_orc'
  | 'guia'
  | 'cliente'
  | 'nome_campanha'
  | 'item'
  | 'quantidade'
  | 'data_saida'
  | 'concluido'
  | 'saiu'

export const DashboardLogisticaTable: React.FC<
  DashboardLogisticaTableProps
> = ({ onRefresh }) => {
  const [records, setRecords] = useState<DashboardLogisticaRecord[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [armazens, setArmazens] = useState<ArmazemOption[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [filters, setFilters] = useState({
    cliente: '',
    nomeCampanha: '',
    item: '',
    numeroFo: '',
    guia: '',
    codigo: '',
  })

  // Add date filter state for today/tomorrow
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow'>(
    'all',
  )

  // Debounced filter values for performance
  const debouncedFilters = useDebounce(filters, 300)

  // Updated sorting state to match main production table pattern
  const [sortCol, setSortCol] = useState<SortableLogisticaKey>('numero_fo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [hasUserSorted, setHasUserSorted] = useState(false) // Track if user has manually sorted

  // Editing state management
  const [editValues, setEditValues] = useState<Record<string, any>>({})

  // Toggle sort function following the same pattern as main production table
  const toggleSort = useCallback(
    (c: SortableLogisticaKey) => {
      setHasUserSorted(true) // Mark that user has manually sorted
      if (sortCol === c) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
      else {
        setSortCol(c)
        setSortDir('asc')
      }
    },
    [sortCol, sortDir],
  )

  const supabase = useMemo(() => createBrowserClient(), [])

  // Utility function to parse a date string as a local date (to avoid timezone issues)
  const parseDateFromYYYYMMDD = useCallback((dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [])

  // Format date for database storage (YYYY-MM-DD)
  const formatDateForDB = useCallback((date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  // Helper function to get cliente IDs for filtering
  const getClienteIds = useCallback(
    async (searchTerm: string): Promise<string> => {
      const { data: matchingClientes } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nome_cl', `%${searchTerm}%`)

      return matchingClientes?.map((c) => c.id).join(',') || ''
    },
    [supabase],
  )

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayString = useCallback((): string => {
    const today = new Date()
    return formatDateForDB(today)
  }, [formatDateForDB])

  // Helper function to get tomorrow's date in YYYY-MM-DD format
  const getTomorrowString = useCallback((): string => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return formatDateForDB(tomorrow)
  }, [formatDateForDB])

  // Fetch data with database-level filtering
  const fetchData = useCallback(
    async (filterParams: Partial<typeof filters> = {}) => {
      setLoading(true)
      try {
        // Fetch all logistics records (both em curso and despachados)
        let logisticsQuery = supabase.from('logistica_entregas').select(`
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

        // Apply database-level filters
        if (filterParams.guia?.trim()) {
          logisticsQuery = logisticsQuery.ilike(
            'guia',
            `%${filterParams.guia.trim()}%`,
          )
        }

        // Note: FO number and cliente filters require joins through items_base->folhas_obras
        // These will be applied client-side after fetching, but with reduced dataset
        // For optimal performance, consider creating a database view or materialized view

        const { data: logisticsData, error: logisticsError } =
          await logisticsQuery.order('created_at', { ascending: false }).limit(200)

        if (logisticsError) {
          console.error('Error fetching logistics:', logisticsError)
        }

        debugLog('Fetched logistics:', logisticsData?.length || 0)



        // Fetch clientes
        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nome_cl')
          .order('nome_cl')

        if (clientesError) {
          console.error('Error fetching clientes:', clientesError)
        }

        // Fetch transportadoras
        const { data: transportadorasData, error: transportadorasError } =
          await supabase.from('transportadora').select('id, name').order('name')

        if (transportadorasError) {
          console.error('Error fetching transportadoras:', transportadorasError)
        }

        // Fetch armazens
        const { data: armazensData, error: armazensError } = await supabase
          .from('armazens')
          .select('id, nome_arm, morada, codigo_pos')
          .order('nome_arm')

        if (armazensError) {
          console.error('Error fetching armazens:', armazensError)
        }

        // Transform the nested data into flat records (same pattern as producao drawer)
        const flatRecords: DashboardLogisticaRecord[] = (logisticsData || []).map((logistica: any) => {
          const item = logistica.items_base || {}
          const folhaObra = item.folhas_obras || {}

          return {
            // From folhas_obras
            folha_obra_id: folhaObra.id || '',
            numero_fo: folhaObra.Numero_do_ || '',
            numero_orc: folhaObra.numero_orc,
            nome_campanha: '',
            fo_data_saida: undefined,
            fo_saiu: undefined,
            cliente: folhaObra.Nome,
            id_cliente: '',
            // From items_base
            item_id: item.id || '',
            item_descricao: item.descricao || '',
            codigo: item.codigo,
            quantidade: item.quantidade,
            brindes: item.brindes,
            data_conc: undefined,
            // From logistica_entregas
            logistica_id: logistica.id,
            guia: logistica.guia,
            notas: logistica.notas,
            transportadora: logistica.transportadora,
            local_entrega: logistica.local_entrega,
            local_recolha: logistica.local_recolha,
            contacto: logistica.contacto,
            telefone: logistica.telefone,
            contacto_entrega: logistica.contacto_entrega,
            telefone_entrega: logistica.telefone_entrega,
            logistica_quantidade: logistica.quantidade,
            data: logistica.data,
            id_local_entrega: logistica.id_local_entrega,
            id_local_recolha: logistica.id_local_recolha,
            concluido: logistica.concluido,
            data_concluido: logistica.data_concluido,
            saiu: logistica.saiu,
            data_saida: logistica.data_saida,
          }
        })

        debugLog('Processed flat records:', flatRecords.length)

        setRecords(flatRecords)
        setClientes(
          clientesData?.map((c: any) => ({ value: c.id, label: c.nome_cl })) ||
            [],
        )
        setTransportadoras(
          transportadorasData?.map((t: any) => ({
            value: t.id,
            label: t.name,
          })) || [],
        )
        setArmazens(
          armazensData?.map((a: any) => ({
            value: a.id,
            label: a.nome_arm,
            morada: a.morada,
            codigo_pos: a.codigo_pos,
          })) || [],
        )
      } catch (error) {
        console.error('Error in fetchData:', error)
      } finally {
        setLoading(false)
      }
    },
    [supabase],
  )

  // On mount and when debounced guia filter changes, refetch data
  useEffect(() => {
    fetchData({ guia: debouncedFilters.guia })
  }, [fetchData, debouncedFilters.guia])

  // Removed auto-refresh on focus/visibility change to prevent unwanted refreshes during editing
  // Table will only refresh when the refresh button is explicitly clicked

  // Create lookup dictionaries
  const clienteLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    clientes.forEach((cliente) => {
      lookup[cliente.value] = cliente.label
    })
    return lookup
  }, [clientes])

  const transportadoraLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    transportadoras.forEach((t) => {
      lookup[t.value] = t.label
    })
    return lookup
  }, [transportadoras])

  // Client-side filtering logic
  const filterRecords = (recordsList: DashboardLogisticaRecord[]) => {
    return recordsList.filter((record) => {
      // Cliente filter - null-safe
      const clienteMatch =
        !filters.cliente ||
        (record.cliente && String(record.cliente).toLowerCase().includes(filters.cliente.toLowerCase()))

      // Nome Campanha filter - null-safe
      const campanhaMatch =
        !filters.nomeCampanha ||
        (record.nome_campanha && String(record.nome_campanha).toLowerCase().includes(filters.nomeCampanha.toLowerCase()))

      // Item filter - null-safe
      const itemMatch =
        !filters.item ||
        (record.item_descricao && String(record.item_descricao).toLowerCase().includes(filters.item.toLowerCase()))

      // FO filter - null-safe
      const foMatch =
        !filters.numeroFo ||
        (record.numero_fo && String(record.numero_fo).toLowerCase().includes(filters.numeroFo.toLowerCase()))

      // Guia filter - null-safe
      const guiaMatch =
        !filters.guia ||
        (record.guia && String(record.guia).toLowerCase().includes(filters.guia.toLowerCase()))

      // Date filter for data_saida
      let dateMatch = true
      if (dateFilter !== 'all' && record.data_saida) {
        const recordDate = record.data_saida.split('T')[0]
        if (dateFilter === 'today') {
          dateMatch = recordDate === getTodayString()
        } else if (dateFilter === 'tomorrow') {
          dateMatch = recordDate === getTomorrowString()
        }
      } else if (dateFilter !== 'all' && !record.data_saida) {
        dateMatch = false
      }

      return (
        clienteMatch &&
        campanhaMatch &&
        itemMatch &&
        foMatch &&
        guiaMatch &&
        dateMatch
      )
    })
  }

  // Separate records by saiu status and filter
  const filteredEmCurso = useMemo(
    () => filterRecords(records.filter((r) => !r.saiu)),
    [records, filters, dateFilter, getTodayString, getTomorrowString],
  )

  const filteredDespachados = useMemo(
    () => filterRecords(records.filter((r) => r.saiu)),
    [records, filters, dateFilter, getTodayString, getTomorrowString],
  )

  // Updated sorting logic following the same pattern as main production table
  const createSorted = (filtered: DashboardLogisticaRecord[]) => {
    if (!hasUserSorted) {
      return [...filtered]
    }

    const arr = [...filtered]
    arr.sort((a, b) => {
      let A: any, B: any
      switch (sortCol) {
        case 'numero_fo':
          // Smart numeric sorting: numbers first, then letters
          A = parseNumericField(a.numero_fo)
          B = parseNumericField(b.numero_fo)
          break
        case 'numero_orc':
          A = parseNumericField(a.numero_orc)
          B = parseNumericField(b.numero_orc)
          break
        case 'guia':
          A = a.guia ?? ''
          B = b.guia ?? ''
          break
        case 'cliente': {
          const clientIdA = a.id_cliente
          const clientIdB = b.id_cliente
          A = (clientIdA ? clienteLookup[clientIdA] : '') || a.cliente || ''
          B = (clientIdB ? clienteLookup[clientIdB] : '') || b.cliente || ''
          break
        }
        case 'nome_campanha':
          A = a.nome_campanha ?? ''
          B = b.nome_campanha ?? ''
          break
        case 'item':
          A = a.item_descricao ?? ''
          B = b.item_descricao ?? ''
          break
        case 'quantidade':
          A = a.logistica_quantidade ?? 0
          B = b.logistica_quantidade ?? 0
          break
        case 'concluido':
          A = a.concluido ?? false
          B = b.concluido ?? false
          break
        case 'data_saida':
          A = a.data_saida ? new Date(a.data_saida).getTime() : 0
          B = b.data_saida ? new Date(b.data_saida).getTime() : 0
          break
        case 'saiu':
          A = a.saiu ?? false
          B = b.saiu ?? false
          break
        default:
          A = a.numero_fo
          B = b.numero_fo
      }
      if (typeof A === 'string')
        return sortDir === 'asc' ? A.localeCompare(B) : B.localeCompare(A)
      if (typeof A === 'number') return sortDir === 'asc' ? A - B : B - A
      if (typeof A === 'boolean') return sortDir === 'asc' ? +A - +B : +B - +A
      return 0
    })
    return arr
  }

  const sortedEmCurso = useMemo(
    () => createSorted(filteredEmCurso),
    [
      filteredEmCurso,
      sortCol,
      sortDir,
      clienteLookup,
      transportadoraLookup,
      hasUserSorted,
    ],
  )

  const sortedDespachados = useMemo(
    () => createSorted(filteredDespachados),
    [
      filteredDespachados,
      sortCol,
      sortDir,
      clienteLookup,
      transportadoraLookup,
      hasUserSorted,
    ],
  )

  // Clear filters function
  const clearFilters = useCallback(() => {
    setFilters({
      cliente: '',
      nomeCampanha: '',
      item: '',
      numeroFo: '',
      guia: '',
      codigo: '',
    })
    setDateFilter('all')
  }, [])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchData()
    onRefresh?.()
  }, [fetchData, onRefresh])

  // Editing helper functions
  const updateEditValue = useCallback(
    (recordId: string, field: string, value: unknown) => {
      setEditValues((prev) => ({
        ...prev,
        [recordId]: { ...prev[recordId], [field]: value },
      }))
    },
    [],
  )

  const saveEditing = useCallback(
    async (record: DashboardLogisticaRecord) => {
      if (!record.logistica_id) {
        console.error('Cannot save: missing logistica_id', record)
        return
      }

      const recordId = `${record.item_id}-${record.logistica_id || 'no-logistics'}`
      const editedValues = editValues[recordId]

      if (!editedValues) return

      try {
        // Update the logistica_entregas record
        const { error } = await supabase
          .from('logistica_entregas')
          .update({
            guia: editedValues.guia || null,
            local_entrega: editedValues.local_entrega || null,
            notas: editedValues.notas || null,
            quantidade: editedValues.quantidade || null,
            saiu: editedValues.saiu ?? false,
          })
          .eq('id', record.logistica_id)

        if (error) throw error

        // Update local state optimistically
        const updatedRecord: DashboardLogisticaRecord = {
          ...record,
          guia: editedValues.guia,
          local_entrega: editedValues.local_entrega,
          notas: editedValues.notas,
          logistica_quantidade: editedValues.quantidade,
          saiu: editedValues.saiu,
        }

        // Update local state optimistically
        setRecords((prevRecords) =>
          prevRecords.map((r) =>
            r.logistica_id === record.logistica_id ? updatedRecord : r,
          ),
        )

        // Clear the edit values for this record
        setEditValues((prev) => {
          const { [recordId]: _, ...rest } = prev
          return rest
        })
      } catch (error) {
        console.error('Error saving edits:', error)
        alert('Erro ao guardar alterações. Tente novamente.')
      }
    },
    [editValues, supabase],
  )

  // Handler functions for creatable comboboxes
  const handleRecolhaChange = useCallback(
    async (record: DashboardLogisticaRecord, value: string) => {
      if (!record.logistica_id) return

      try {
        // Find the selected armazem to get the text label
        const selectedArmazem = armazens.find((a) => a.value === value)
        const textValue = selectedArmazem ? selectedArmazem.label : ''

        // Update both ID and text fields
        await supabase
          .from('logistica_entregas')
          .update({
            id_local_recolha: value || null,
            local_recolha: textValue || null,
          })
          .eq('id', record.logistica_id)

        // Update local state
        setRecords((prevRecords) =>
          prevRecords.map((r) =>
            r.logistica_id === record.logistica_id
              ? { ...r, id_local_recolha: value, local_recolha: textValue }
              : r,
          ),
        )
      } catch (error) {
        console.error('Error updating local recolha:', error)
      }
    },
    [supabase, armazens, setRecords],
  )

  const handleEntregaChange = useCallback(
    async (record: DashboardLogisticaRecord, value: string) => {
      if (!record.logistica_id) return

      try {
        // Find the selected armazem to get the text label
        const selectedArmazem = armazens.find((a) => a.value === value)
        const textValue = selectedArmazem ? selectedArmazem.label : ''

        // Update both ID and text fields
        await supabase
          .from('logistica_entregas')
          .update({
            id_local_entrega: value || null,
            local_entrega: textValue || null,
          })
          .eq('id', record.logistica_id)

        // Update local state
        setRecords((prevRecords) =>
          prevRecords.map((r) =>
            r.logistica_id === record.logistica_id
              ? { ...r, id_local_entrega: value, local_entrega: textValue }
              : r,
          ),
        )
      } catch (error) {
        console.error('Error updating local entrega:', error)
      }
    },
    [supabase, armazens, setRecords],
  )

  const handleTransportadoraChange = useCallback(
    async (record: DashboardLogisticaRecord, value: string) => {
      if (!record.logistica_id) return

      try {
        await supabase
          .from('logistica_entregas')
          .update({ transportadora: value || null })
          .eq('id', record.logistica_id)

        // Update local state
        setRecords((prevRecords) =>
          prevRecords.map((r) =>
            r.logistica_id === record.logistica_id
              ? { ...r, transportadora: value }
              : r,
          ),
        )
      } catch (error) {
        console.error('Error updating transportadora:', error)
      }
    },
    [supabase, setRecords],
  )

  const handleNotasSave = useCallback(
    async (record: DashboardLogisticaRecord, fields: any) => {
      if (!record.logistica_id) return

      try {
        // Update the logistica_entregas record with all fields
        await supabase
          .from('logistica_entregas')
          .update({
            notas: fields.outras || null,
            contacto_entrega: fields.contacto_entrega || null,
            telefone_entrega: fields.telefone_entrega || null,
            data: fields.data || null,
          })
          .eq('id', record.logistica_id)

        // Update local state
        setRecords((prevRecords) =>
          prevRecords.map((r) =>
            r.logistica_id === record.logistica_id
              ? {
                  ...r,
                  notas: fields.outras,
                  contacto_entrega: fields.contacto_entrega,
                  telefone_entrega: fields.telefone_entrega,
                  data: fields.data,
                }
              : r,
          ),
        )
      } catch (error) {
        console.error('Error updating notas and delivery contacts:', error)
      }
    },
    [supabase, setRecords],
  )

  const handleArmazensUpdate = useCallback(async () => {
    // Refresh armazens data when a new one is created
    try {
      const { data: armazensData } = await supabase
        .from('armazens')
        .select('id, nome_arm, morada, codigo_pos')
        .order('nome_arm')

      if (armazensData) {
        setArmazens(
          armazensData.map((a: any) => ({
            value: a.id,
            label: a.nome_arm,
            morada: a.morada,
            codigo_pos: a.codigo_pos,
          })),
        )
      }
    } catch (error) {
      console.error('Error refreshing armazens:', error)
    }
  }, [supabase])

  const handleTransportadorasUpdate = useCallback(async () => {
    // Refresh transportadoras data when a new one is created
    try {
      const { data: transportadorasData } = await supabase
        .from('transportadora')
        .select('id, name')
        .order('name')

      if (transportadorasData) {
        setTransportadoras(
          transportadorasData.map((t: any) => ({
            value: t.id,
            label: t.name,
          })),
        )
      }
    } catch (error) {
      console.error('Error refreshing transportadoras:', error)
    }
  }, [supabase])

  // Update saiu status - now updates logistica_entregas instead of items_base
  const handleSaiuUpdate = useCallback(
    async (record: DashboardLogisticaRecord, value: boolean) => {
      try {
        if (!record.logistica_id) {
          console.error('Cannot update saiu: missing logistica_id', record)
          return
        }

        // Update logistica_entregas saiu field
        await supabase
          .from('logistica_entregas')
          .update({ saiu: value })
          .eq('id', record.logistica_id)

        // Update local state instead of full refresh
        setRecords((prevRecords) =>
          prevRecords.map((r) =>
            r.logistica_id === record.logistica_id ? { ...r, saiu: value } : r,
          ),
        )
      } catch (error) {
        console.error('Error updating saiu status:', error)
      }
    },
    [supabase, setRecords],
  )

  // Update data_saida status - now updates logistica_entregas.data_saida field
  const handleDataSaidaUpdate = useCallback(
    async (record: DashboardLogisticaRecord, date: Date | null) => {
      try {
        if (!record.logistica_id) {
          console.error(
            'Cannot update data_saida: missing logistica_id',
            record,
          )
          return
        }

        const dateString = date ? formatDateForDB(date) : null
        await supabase
          .from('logistica_entregas')
          .update({ data_saida: dateString })
          .eq('id', record.logistica_id)

        // Update local state instead of full refresh
        setRecords((prevRecords) =>
          prevRecords.map((r) =>
            r.logistica_id === record.logistica_id
              ? { ...r, data_saida: dateString }
              : r,
          ),
        )
      } catch (error) {
        console.error('Error updating data_saida:', error)
      }
    },
    [supabase, formatDateForDB, setRecords],
  )

  // Update concluido status - updates logistica_entregas.concluido field
  const handleConcluidoUpdate = useCallback(
    async (record: DashboardLogisticaRecord, value: boolean) => {
      try {
        if (!record.logistica_id) {
          console.error('Cannot update concluido: missing logistica_id', record)
          return
        }

        await supabase
          .from('logistica_entregas')
          .update({ concluido: value })
          .eq('id', record.logistica_id)

        // Update local state instead of full refresh
        setRecords((prevRecords) =>
          prevRecords.map((r) =>
            r.logistica_id === record.logistica_id
              ? { ...r, concluido: value }
              : r,
          ),
        )
      } catch (error) {
        console.error('Error updating concluido status:', error)
      }
    },
    [supabase, setRecords],
  )

  if (loading) {
    return (
      <div className="w-full">
        <h2 className="mb-4 text-2xl font-bold">Trabalhos em Curso</h2>
        <div className="flex h-40 items-center justify-center">
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Logística</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder="FO"
          className="w-[140px]"
          value={filters.numeroFo}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, numeroFo: e.target.value }))
          }
        />
        <Input
          placeholder="Guia"
          className="w-[140px]"
          value={filters.guia}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, guia: e.target.value }))
          }
        />
        <Input
          placeholder="Cliente"
          className="w-[200px]"
          value={filters.cliente}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, cliente: e.target.value }))
          }
        />
        <Input
          placeholder="Nome Campanha"
          className="flex-1"
          value={filters.nomeCampanha}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, nomeCampanha: e.target.value }))
          }
        />
        <Input
          placeholder="Item"
          className="flex-1"
          value={filters.item}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, item: e.target.value }))
          }
        />

        {/* Date filter buttons */}
        <div className="flex items-center gap-1 border-l pl-2">
          <Button
            variant={dateFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('all')}
            className="h-10 px-3 text-xs"
          >
            Todos
          </Button>
          <Button
            variant={dateFilter === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('today')}
            className="h-10 px-3 text-xs"
          >
            Hoje
          </Button>
          <Button
            variant={dateFilter === 'tomorrow' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('tomorrow')}
            className="h-10 px-3 text-xs"
          >
            Amanhã
          </Button>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={clearFilters}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Limpar Filtros</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Tabs for Em Curso and Despachados */}
      <Tabs defaultValue="em_curso" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="em_curso">Em Curso ({sortedEmCurso.length})</TabsTrigger>
          <TabsTrigger value="despachados">Despachados ({sortedDespachados.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="em_curso" className="w-full">
          <div className="w-full">
            <Table className="w-full table-fixed uppercase [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
            <TableHeader>
              <TableRow>
                <TableHead
                  onClick={() => toggleSort('numero_fo')}
                  className="sticky top-0 z-10 w-[70px] cursor-pointer border-b text-center font-bold uppercase select-none"
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
                  onClick={() => toggleSort('numero_orc')}
                  className="sticky top-0 z-10 w-[70px] cursor-pointer border-b text-center font-bold uppercase select-none"
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
                  onClick={() => toggleSort('guia')}
                  className="sticky top-0 z-10 w-[70px] cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Guia{' '}
                  {sortCol === 'guia' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="ml-1 inline h-3 w-3" />
                    ) : (
                      <ArrowDown className="ml-1 inline h-3 w-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('cliente')}
                  className="sticky top-0 z-10 cursor-pointer border-b text-center font-bold uppercase select-none"
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
                  className="sticky top-0 z-10 cursor-pointer border-b text-center font-bold uppercase select-none"
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
                  onClick={() => toggleSort('item')}
                  className="sticky top-0 z-10 cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Item{' '}
                  {sortCol === 'item' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="ml-1 inline h-3 w-3" />
                    ) : (
                      <ArrowDown className="ml-1 inline h-3 w-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('quantidade')}
                  className="sticky top-0 z-10 w-[60px] cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Qt{' '}
                  {sortCol === 'quantidade' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="ml-1 inline h-3 w-3" />
                    ) : (
                      <ArrowDown className="ml-1 inline h-3 w-3" />
                    ))}
                </TableHead>
                <TableHead className="sticky top-0 z-10 w-[100px] border-b text-center font-bold uppercase">
                  Transporte
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('data_saida')}
                  className="sticky top-0 z-10 w-[160px] cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Data Saída{' '}
                  {sortCol === 'data_saida' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="ml-1 inline h-3 w-3" />
                    ) : (
                      <ArrowDown className="ml-1 inline h-3 w-3" />
                    ))}
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('concluido')}
                  className="sticky top-0 z-10 w-12 cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          C{' '}
                          {sortCol === 'concluido' &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="ml-1 inline h-3 w-3" />
                            ) : (
                              <ArrowDown className="ml-1 inline h-3 w-3" />
                            ))}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Concluído</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('saiu')}
                  className="sticky top-0 z-10 w-12 cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          S{' '}
                          {sortCol === 'saiu' &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="ml-1 inline h-3 w-3" />
                            ) : (
                              <ArrowDown className="ml-1 inline h-3 w-3" />
                            ))}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Saiu</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEmCurso.map((record) => {
                const recordId = `${record.item_id}-${record.logistica_id || 'no-logistics'}`
                const currentEditValues = editValues[recordId] || {}

                return (
                  <TableRow key={recordId}>
                    {/* FO - Not editable */}
                    <TableCell>{record.numero_fo || '-'}</TableCell>

                    {/* ORC - Not editable */}
                    <TableCell className="text-center">{record.numero_orc || '-'}</TableCell>

                    {/* Guia - Always Editable */}
                    <TableCell className="text-center">
                      <Input
                        className="h-8 text-sm text-center"
                        value={currentEditValues.guia ?? record.guia ?? ''}
                        onChange={(e) =>
                          updateEditValue(recordId, 'guia', e.target.value)
                        }
                        onBlur={() => {
                          const values = editValues[recordId] || {}
                          if (values.guia !== undefined && values.guia !== record.guia) {
                            saveEditing(record)
                          }
                        }}
                        placeholder="-"
                      />
                    </TableCell>

                    {/* Cliente - Not editable */}
                    <TableCell>
                      {(() => {
                        const clientId = record.id_cliente
                        const clientName =
                          (clientId ? clienteLookup[clientId] : '') ||
                          record.cliente ||
                          '-'

                        // Truncate at 28 characters and add "..." if longer
                        return clientName.length > 28
                          ? `${clientName.substring(0, 28)}...`
                          : clientName
                      })()}
                    </TableCell>

                    {/* Nome Campanha - Not editable */}
                    <TableCell>{record.nome_campanha || '-'}</TableCell>

                    {/* Item - Not editable */}
                    <TableCell>{record.item_descricao || '-'}</TableCell>

                    {/* Quantidade - Always Editable */}
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        className="h-8 w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={
                          currentEditValues.quantidade ??
                          record.logistica_quantidade ??
                          ''
                        }
                        onChange={(e) =>
                          updateEditValue(
                            recordId,
                            'quantidade',
                            Number(e.target.value) || null,
                          )
                        }
                        onBlur={() => {
                          const values = editValues[recordId] || {}
                          if (values.quantidade !== undefined && values.quantidade !== record.logistica_quantidade) {
                            saveEditing(record)
                          }
                        }}
                        placeholder="-"
                      />
                    </TableCell>

                    {/* Transporte - Popover with Local Recolha, Local Entrega, Transportadora, Notas, etc */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <TransportePopover
                          localRecolha={record.local_recolha || ''}
                          localEntrega={record.local_entrega || ''}
                          transportadora={record.transportadora || ''}
                          idLocalRecolha={record.id_local_recolha || ''}
                          idLocalEntrega={record.id_local_entrega || ''}
                          notas={record.notas || ''}
                          contactoEntrega={record.contacto_entrega || ''}
                          telefoneEntrega={record.telefone_entrega || ''}
                          armazens={armazens}
                          transportadoras={transportadoras}
                          onSave={async (fields) => {
                            await handleRecolhaChange(record, fields.id_local_recolha)
                            await handleEntregaChange(record, fields.id_local_entrega)
                            await handleTransportadoraChange(record, fields.transportadora)
                            await handleNotasSave(record, {
                              outras: fields.notas,
                              contacto_entrega: fields.contacto_entrega,
                              telefone_entrega: fields.telefone_entrega,
                              data: record.data || null,
                            })
                          }}
                          onArmazensUpdate={handleArmazensUpdate}
                          onTransportadorasUpdate={handleTransportadorasUpdate}
                        />
                      </div>
                    </TableCell>

                    {/* Data Saída - DatePicker (always interactive) */}
                    <TableCell>
                      <DatePicker
                        value={
                          record.data_saida
                            ? parseDateFromYYYYMMDD(
                                record.data_saida.split('T')[0],
                              )
                            : undefined
                        }
                        onChange={(date) =>
                          handleDataSaidaUpdate(record, date || null)
                        }
                      />
                    </TableCell>

                    {/* Concluído - Checkbox (always interactive) */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={!!record.concluido}
                          onCheckedChange={(checked) => {
                            const value =
                              checked === 'indeterminate' ? false : checked
                            handleConcluidoUpdate(record, value)
                          }}
                        />
                      </div>
                    </TableCell>

                    {/* Saiu - Always interactive */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={!!record.saiu}
                          onCheckedChange={(checked) => {
                            const value =
                              checked === 'indeterminate' ? false : checked
                            handleSaiuUpdate(record, value)
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {sortedEmCurso.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center">
                    Nenhum trabalho em curso encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
            </div>
        </TabsContent>

        <TabsContent value="despachados" className="w-full">
          <div className="w-full">
            <Table className="w-full table-fixed uppercase [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
            <TableHeader>
              <TableRow>
                <TableHead
                  onClick={() => toggleSort('numero_fo')}
                  className="sticky top-0 z-10 w-[70px] cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  FO
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('numero_orc')}
                  className="sticky top-0 z-10 w-[70px] cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  ORC
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('guia')}
                  className="sticky top-0 z-10 w-[70px] cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Guia
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('cliente')}
                  className="sticky top-0 z-10 cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Cliente
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('nome_campanha')}
                  className="sticky top-0 z-10 cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Nome Campanha
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('item')}
                  className="sticky top-0 z-10 cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Item
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('quantidade')}
                  className="sticky top-0 z-10 w-[60px] cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Qt
                </TableHead>
                <TableHead className="sticky top-0 z-10 w-[100px] border-b text-center font-bold uppercase">
                  Transporte
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('data_saida')}
                  className="sticky top-0 z-10 w-[160px] cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  Data Saída
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('concluido')}
                  className="sticky top-0 z-10 w-12 cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  C
                </TableHead>
                <TableHead
                  onClick={() => toggleSort('saiu')}
                  className="sticky top-0 z-10 w-12 cursor-pointer border-b text-center font-bold uppercase select-none"
                >
                  S
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDespachados.map((record) => {
                const recordId = `${record.item_id}-${record.logistica_id || 'no-logistics'}`
                const currentEditValues = editValues[recordId] || {}

                return (
                  <TableRow key={recordId}>
                    <TableCell>{record.numero_fo || '-'}</TableCell>
                    <TableCell className="text-center">{record.numero_orc || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        className="h-8 text-sm text-center"
                        value={currentEditValues.guia ?? record.guia ?? ''}
                        onChange={(e) =>
                          updateEditValue(recordId, 'guia', e.target.value)
                        }
                        onBlur={() => {
                          const values = editValues[recordId] || {}
                          if (values.guia !== undefined && values.guia !== record.guia) {
                            saveEditing(record)
                          }
                        }}
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const clientId = record.id_cliente
                        const clientName =
                          (clientId ? clienteLookup[clientId] : '') ||
                          record.cliente ||
                          '-'
                        return clientName.length > 28
                          ? `${clientName.substring(0, 28)}...`
                          : clientName
                      })()}
                    </TableCell>
                    <TableCell>{record.nome_campanha || '-'}</TableCell>
                    <TableCell>{record.item_descricao || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        className="h-8 w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={
                          currentEditValues.quantidade ??
                          record.logistica_quantidade ??
                          ''
                        }
                        onChange={(e) =>
                          updateEditValue(
                            recordId,
                            'quantidade',
                            Number(e.target.value) || null,
                          )
                        }
                        onBlur={() => {
                          const values = editValues[recordId] || {}
                          if (values.quantidade !== undefined && values.quantidade !== record.logistica_quantidade) {
                            saveEditing(record)
                          }
                        }}
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <TransportePopover
                          localRecolha={record.local_recolha || ''}
                          localEntrega={record.local_entrega || ''}
                          transportadora={record.transportadora || ''}
                          idLocalRecolha={record.id_local_recolha || ''}
                          idLocalEntrega={record.id_local_entrega || ''}
                          notas={record.notas || ''}
                          contactoEntrega={record.contacto_entrega || ''}
                          telefoneEntrega={record.telefone_entrega || ''}
                          armazens={armazens}
                          transportadoras={transportadoras}
                          onSave={async (fields) => {
                            await handleRecolhaChange(record, fields.id_local_recolha)
                            await handleEntregaChange(record, fields.id_local_entrega)
                            await handleTransportadoraChange(record, fields.transportadora)
                            await handleNotasSave(record, {
                              outras: fields.notas,
                              contacto_entrega: fields.contacto_entrega,
                              telefone_entrega: fields.telefone_entrega,
                              data: record.data || null,
                            })
                          }}
                          onArmazensUpdate={handleArmazensUpdate}
                          onTransportadorasUpdate={handleTransportadorasUpdate}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <DatePicker
                        value={
                          record.data_saida
                            ? parseDateFromYYYYMMDD(
                                record.data_saida.split('T')[0],
                              )
                            : undefined
                        }
                        onChange={(date) =>
                          handleDataSaidaUpdate(record, date || null)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={!!record.concluido}
                          onCheckedChange={(checked) => {
                            const value =
                              checked === 'indeterminate' ? false : checked
                            handleConcluidoUpdate(record, value)
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={!!record.saiu}
                          onCheckedChange={(checked) => {
                            const value =
                              checked === 'indeterminate' ? false : checked
                            handleSaiuUpdate(record, value)
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {sortedDespachados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center">
                    Nenhum trabalho despachado encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default DashboardLogisticaTable

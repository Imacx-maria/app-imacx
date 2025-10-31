'use client'

/**
 * Job Drawer Component
 * Extracted from app/producao/page.tsx
 * Handles the production and logistics details for a single job
 */

import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Copy,
  X,
  Check,
  Edit,
  Loader2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import LogisticaTableWithCreatable from '@/components/custom/LogisticaTableWithCreatable'
import { Cliente } from '@/types/logistica'
import { useLogisticaData } from '@/utils/useLogisticaData'
import type { Job, Item, JobDrawerProps } from './types'

/**
 * JobDrawerContent Component (Internal)
 * Handles the production and logistics details for a single job
 */
function JobDrawerContentComponent({
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
          id_local_recolha: null,  // Explicitly null to avoid FK constraint violation
          id_local_entrega: null,  // Explicitly null to avoid FK constraint violation
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
            id_local_recolha: null,  // Explicitly null to avoid FK constraint violation
            id_local_entrega: null,  // Explicitly null to avoid FK constraint violation
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

    // Note: Logistics entries are now created by importPhcLinesForFo (for PHC imports) 
    // and acceptItem (for manual additions), so we don't need to auto-create them here.
    // This prevents duplication issues.

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
                {/* Refresh logistics data button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    logisticaFetchedRef.current = false // Force re-fetch
                    await fetchLogisticaRows()
                  }}
                  disabled={logisticaLoading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${logisticaLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
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
                        id_local_recolha: null,  // Explicitly null to avoid FK constraint violation
                        id_local_entrega: null,  // Explicitly null to avoid FK constraint violation
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

/**
 * Memoized JobDrawer Component
 * Only re-renders when jobId, items, or jobs change, preventing unnecessary re-renders
 * from parent component state updates
 */
export const JobDrawerContent = memo(
  JobDrawerContentComponent,
  (prevProps, nextProps) => {
    // Re-render if jobId changes OR if items/jobs arrays change
    if (prevProps.jobId !== nextProps.jobId) return false
    if (prevProps.items !== nextProps.items) return false
    if (prevProps.jobs !== nextProps.jobs) return false
    // Skip re-render if nothing changed
    return true
  },
)

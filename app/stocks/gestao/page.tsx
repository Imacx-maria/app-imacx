'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UppercaseSelectValue,
  UppercaseSelectItem,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Plus,
  Eye,
  Trash2,
  X,
  Edit,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Download,
  XSquare,
  ChevronsUpDown,
  Check,
  Loader2,
} from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import {
  StockEntryWithRelations,
  CurrentStock,
  Material,
  Fornecedor,
  PaleteWithRelations,
  Profile,
  PaletesFilters,
} from '@/types/producao'
import Combobox from '@/components/ui/Combobox'
// PERFORMANCE: Recharts is lazy loaded (300KB) - only loads when analytics tab is viewed
import dynamic from 'next/dynamic'
const StockAnalyticsCharts = dynamic(() => import('@/components/StockAnalyticsCharts'), {
  loading: () => <div className="p-8 text-center text-muted-foreground">Loading analytics...</div>,
  ssr: false
})
import { FilterWithClear } from '@/components/stocks/FilterWithClear'
import { StockInputField } from '@/components/stocks/StockInputField'
import { InlineEditField } from '@/components/stocks/InlineEditField'

interface Palete {
  id: string
  no_palete: string
  fornecedor_id: string | null
  no_guia_forn: string | null
  ref_cartao: string | null
  qt_palete: number | null
  data: string
  author_id: string | null
  created_at: string
  updated_at: string
}

export default function StocksPage() {
  const formatMaterialName = (material: any) => {
    if (!material) return '-'
    if (typeof material === 'object') {
      return [
        material.material,
        material.cor,
        material.tipo,
        material.carateristica,
      ]
        .filter(Boolean)
        .join(' - ')
    }
    return [material].filter(Boolean).join(' - ')
  }

  const [stocks, setStocks] = useState<StockEntryWithRelations[]>([])
  const [currentStocks, setCurrentStocks] = useState<CurrentStock[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [currentStocksLoading, setCurrentStocksLoading] = useState(true)
  const [editingStock, setEditingStock] =
    useState<StockEntryWithRelations | null>(null)
  const [activeTab, setActiveTab] = useState('entries')

  const [paletes, setPaletes] = useState<PaleteWithRelations[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [paletesLoading, setPaletesLoading] = useState(true)
  const [editingPaleteId, setEditingPaleteId] = useState<string | null>(null)
  const [paletesFilter, setPaletesFilter] = useState('')
  const [paletesReferenciaFilter, setPaletesReferenciaFilter] = useState('')

  const [paletesDateFrom, setPaletesDateFrom] = useState('')
  const [paletesDateTo, setPaletesDateTo] = useState('')
  const [paletesFornecedorFilter, setPaletesFornecedorFilter] =
    useState('__all__')
  const [paletesAuthorFilter, setPaletesAuthorFilter] = useState('__all__')

  const [sortColumnPaletes, setSortColumnPaletes] =
    useState<string>('no_palete')
  const [sortDirectionPaletes, setSortDirectionPaletes] = useState<
    'asc' | 'desc'
  >('asc')

  const [showNewPaleteRow, setShowNewPaleteRow] = useState(false)
  const [newPaleteData, setNewPaleteData] = useState({
    no_palete: '',
    fornecedor_id: '',
    no_guia_forn: '',
    ref_cartao: '',
    qt_palete: '',
    data: new Date().toISOString().split('T')[0],
    author_id: '',
  })
  const [editingPaleteData, setEditingPaleteData] = useState<{
    [key: string]: any
  }>({})
  const [submittingPalete, setSubmittingPalete] = useState(false)

  const [formData, setFormData] = useState({
    material_id: '',
    material_referencia: '',
    fornecedor_id: '',
    no_guia_forn: '',
    quantidade: '',
    quantidade_disponivel: '',
    vl_m2: '',
    preco_unitario: '',
    valor_total: '',
    notas: '',
    n_palet: '',
    quantidade_palete: '',
    num_palettes: '',
  })
  const [materialFilter, setMaterialFilter] = useState('')
  const [referenciaFilter, setReferenciaFilter] = useState('')
  const [currentStockFilter, setCurrentStockFilter] = useState('')
  const [currentStockReferenciaFilter, setCurrentStockReferenciaFilter] =
    useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<string | null>(null)

  const [sortColumnEntries, setSortColumnEntries] = useState<string>('data')
  const [sortDirectionEntries, setSortDirectionEntries] = useState<
    'asc' | 'desc'
  >('desc')

  const [sortColumnCurrent, setSortColumnCurrent] = useState<string>('material')
  const [sortDirectionCurrent, setSortDirectionCurrent] = useState<
    'asc' | 'desc'
  >('asc')

  const [editingStockCorrectId, setEditingStockCorrectId] = useState<
    string | null
  >(null)
  const [stockCorrectValue, setStockCorrectValue] = useState<string>('')

  const [stockCorrectValueMap, setStockCorrectValueMap] = useState<{
    [id: string]: string
  }>({})

  const [stockMinimoValueMap, setStockMinimoValueMap] = useState<{
    [id: string]: string
  }>({})
  const [stockCriticoValueMap, setStockCriticoValueMap] = useState<{
    [id: string]: string
  }>({})

  // Inline input state management
  const [showInlineInput, setShowInlineInput] = useState(false)
  const [inlineEntries, setInlineEntries] = useState<
    Array<{
      id: string
      material_id: string
      material_name: string
      referencia: string
      fornecedor_id: string
      fornecedor_name: string
      quantidade: number
      no_guia_forn: string
      no_palete: string
      num_paletes: number
      size_x: number
      size_y: number
      preco_unitario: number
      valor_total: number
      isSaving: boolean
    }>
  >([])
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [lastSavesSummary, setLastSavesSummary] = useState<{
    count: number
    paletes: string[]
    total: number
  } | null>(null)

  // NE (Encomenda a Fornecedor) lookup state
  const [neNumber, setNeNumber] = useState('')
  const [neFetching, setNeFetching] = useState(false)
  const [neError, setNeError] = useState<string | null>(null)
  const neInputRef = useRef<HTMLInputElement>(null)
  const shouldRefocusNE = useRef(false)

  // ETL refresh state
  const [etlSyncing, setEtlSyncing] = useState<'bo_bi' | 'fl' | null>(null)
  const [etlMessage, setEtlMessage] = useState<string | null>(null)
  const [etlError, setEtlError] = useState<string | null>(null)

  const supabase = createBrowserClient()

  // Trigger ETL sync
  const triggerEtlSync = useCallback(
    async (syncType: 'today_bo_bi' | 'today_fl') => {
      setEtlSyncing(syncType === 'today_bo_bi' ? 'bo_bi' : 'fl')
      setEtlMessage(null)
      setEtlError(null)

      try {
        const response = await fetch('/api/etl/incremental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: syncType }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          setEtlError(data.message || 'Erro ao sincronizar')
          return
        }

        setEtlMessage(
          syncType === 'today_bo_bi'
            ? '✅ Sincronização de NE/BO completada!'
            : '✅ Sincronização de Fornecedores completada!'
        )

        // Refresh the page data after a short delay
        setTimeout(() => {
          setEtlMessage(null)
          // Optionally reload materials/stocks data here
        }, 2000)
      } catch (error) {
        setEtlError(`Erro ao sincronizar: ${error instanceof Error ? error.message : 'erro desconhecido'}`)
      } finally {
        setEtlSyncing(null)
      }
    },
    [],
  )

  useEffect(() => {
    const handleAriaHiddenFix = () => {
      const mainWrapper = document.getElementById('main-content-wrapper')
      if (mainWrapper) {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (
              mutation.type === 'attributes' &&
              mutation.attributeName === 'aria-hidden'
            ) {
              const element = mutation.target as HTMLElement
              if (
                element === mainWrapper &&
                element.getAttribute('aria-hidden') === 'true'
              ) {
                const focusableElements = element.querySelectorAll(
                  'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
                )
                const hasFocusedElement = Array.from(focusableElements).some(
                  (el) => el === document.activeElement,
                )

                if (hasFocusedElement) {
                  element.removeAttribute('aria-hidden')
                }
              }
            }
          })
        })

        observer.observe(mainWrapper, {
          attributes: true,
          attributeFilter: ['aria-hidden'],
        })

        return () => observer.disconnect()
      }
    }

    const cleanup = handleAriaHiddenFix()
    return cleanup
  }, [])

  // Refocus NE input after adding entries
  useEffect(() => {
    if (shouldRefocusNE.current && neInputRef.current) {
      shouldRefocusNE.current = false
      // Use double requestAnimationFrame to ensure it happens after all renders
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (neInputRef.current) {
            neInputRef.current.focus()
            neInputRef.current.select()
          }
        })
      })
    }
  }, [inlineEntries])

  const fetchStocks = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select(
          `
          *,
          materiais(material, cor, tipo, carateristica, referencia),
          fornecedores(nome_forn)
        `,
        )
        .order('created_at', { ascending: false })

      if (!error && data) {
        setStocks(data)
      }
    } catch (error) {
      console.error('Error fetching stocks:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const fetchMaterials = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('materiais')
        .select(
          'id, material, cor, tipo, carateristica, fornecedor_id, qt_palete, valor_m2_custo, valor_placa, stock_minimo, stock_critico, referencia',
        )
        .order('material', { ascending: true })

      if (!error && data) {
        setMaterials(data)
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    }
  }, [supabase])

  const fetchFornecedores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('id, nome_forn')
        .order('nome_forn', { ascending: true })

      if (!error && data) {
        setFornecedores(data)
      }
    } catch (error) {
      console.error('Error fetching fornecedores:', error)
    }
  }, [supabase])

  // Fetch NE (Encomenda a Fornecedor) data from PHC BO and BI tables
  const fetchNEData = useCallback(
    async (ne: string) => {
      if (!ne.trim()) {
        return // Silent return if empty
      }

      setNeFetching(true)
      setNeError(null)
      try {
        // Step 1: Get the BO header for this NE
        const { data: boData, error: boError } = await supabase
          .schema('phc')
          .from('bo')
          .select('document_id, document_number, observacoes')
          .eq('document_type', 'Encomenda a Fornecedor')
          .eq('document_number', ne.trim())
          .limit(1)

        if (boError) throw boError
        if (!boData || boData.length === 0) {
          setNeError(`NE ${ne} não encontrada`)
          return
        }

        const boHeader = boData[0]
        console.log('✅ NE encontrada:', boHeader)

        // Step 2: Get the BI lines for this document
        const { data: biData, error: biError } = await supabase
          .schema('phc')
          .from('bi')
          .select('description, quantity, unit_price, line_total, item_reference')
          .eq('document_id', boHeader.document_id)
          .gt('quantity', 0) // Only include lines with quantity > 0

        if (biError) throw biError
        if (!biData || biData.length === 0) {
          setNeError(`Nenhuma linha encontrada para NE ${ne}`)
          return
        }

        console.log(`✅ ${biData.length} linhas encontradas para NE ${ne}:`, biData)

        // Step 3: Convert BI lines to inline entries format
        const newEntries = biData.map((line, index) => ({
          id: `ne_${boHeader.document_number}_${index}`,
          material_id: '',
          material_name: line.description || '',
          referencia: line.item_reference || line.description || '',
          fornecedor_id: '',
          fornecedor_name: '',
          quantidade: Number(line.quantity) || 0,
          no_guia_forn: ne.trim(),
          no_palete: '',
          num_paletes: 0,
          size_x: 0,
          size_y: 0,
          preco_unitario: Number(line.unit_price) || 0,
          valor_total: Number(line.line_total) || 0,
          isSaving: false,
        }))

        // Step 4: Add new entries to existing ones (instead of replacing)
        shouldRefocusNE.current = true
        setInlineEntries((prev) => [...prev, ...newEntries])
        console.log(`✅ ${newEntries.length} linhas importadas da NE ${ne}`)

        // Show success message briefly
        setEtlMessage(`✅ ${newEntries.length} linhas importadas da NE ${ne}`)
        setTimeout(() => setEtlMessage(null), 2000)
      } catch (error) {
        console.error('Erro ao buscar dados da NE:', error)
        setNeError(`NE ${ne}: ${error instanceof Error ? error.message : 'erro desconhecido'}`)
        // Clear error message after 3 seconds
        setTimeout(() => setNeError(null), 3000)
      } finally {
        setNeFetching(false)
      }
    },
    [supabase],
  )

  const fetchCurrentStocksManual = useCallback(async () => {
    try {
      const { data: materialsData, error: materialsError } = await supabase
        .from('materiais')
        .select(
          'id, material, cor, tipo, carateristica, stock_minimo, stock_critico, referencia, stock_correct, stock_correct_updated_at',
        )
      if (materialsError) throw materialsError
      const currentStocksData: CurrentStock[] = []
      for (const material of materialsData || []) {
        const { data: stocksData } = await supabase
          .from('stocks')
          .select('quantidade')
          .eq('material_id', material.id)

        const totalRecebido =
          stocksData?.reduce(
            (sum, stock) => sum + (stock.quantidade || 0),
            0,
          ) || 0

        const { data: operacoesData } = await supabase
          .from('producao_operacoes')
          .select('num_placas_corte')
          .eq('material_id', material.id)

        const totalConsumido =
          operacoesData?.reduce(
            (sum, op) => sum + (op.num_placas_corte || 0),
            0,
          ) || 0

        const stockAtual = totalRecebido - totalConsumido

        const { data: stocksDisponivelData } = await supabase
          .from('stocks')
          .select('quantidade_disponivel')
          .eq('material_id', material.id)

        const quantidadeDisponivel =
          stocksDisponivelData?.reduce(
            (sum, stock) => sum + (stock.quantidade_disponivel || 0),
            0,
          ) || 0

        currentStocksData.push({
          id: material.id,
          material: material.material,
          cor: material.cor,
          tipo: material.tipo,
          carateristica: material.carateristica,
          total_recebido: totalRecebido || 0,
          total_consumido: totalConsumido || 0,
          stock_atual: stockAtual || 0,
          quantidade_disponivel: quantidadeDisponivel || 0,
          stock_minimo: material.stock_minimo,
          stock_critico: material.stock_critico,
          referencia: material.referencia,
          stock_correct: material.stock_correct ?? null,
          stock_correct_updated_at: material.stock_correct_updated_at ?? null,
        })
      }
      currentStocksData.sort((a, b) => a.stock_atual - b.stock_atual)
      setCurrentStocks(currentStocksData)
    } catch (error) {
      console.error('Error in manual current stocks calculation:', error)
    }
  }, [supabase])

  const fetchCurrentStocks = useCallback(async () => {
    setCurrentStocksLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_current_stocks')
      if (error || !data) {
        await fetchCurrentStocksManual()
      } else {
        const { data: materiaisData } = await supabase
          .from('materiais')
          .select('id, stock_correct, stock_correct_updated_at')
        const materiaisMap = new Map(
          (materiaisData || []).map((m) => [m.id, m]),
        )
        setCurrentStocks(
          data.map((row: any) => ({
            ...row,
            stock_correct: materiaisMap.get(row.id)?.stock_correct ?? null,
            stock_correct_updated_at:
              materiaisMap.get(row.id)?.stock_correct_updated_at ?? null,
          })),
        )
      }
    } catch (error) {
      await fetchCurrentStocksManual()
    } finally {
      setCurrentStocksLoading(false)
    }
  }, [supabase, fetchCurrentStocksManual])

  const fetchPaletes = useCallback(
    async (filters: PaletesFilters = {}) => {
      setPaletesLoading(true)
      try {
        let query = supabase.from('paletes').select(`
          *,
          fornecedores(id, nome_forn),
          profiles(id, first_name, last_name)
        `)

        if (filters.search?.trim()) {
          const searchTerm = filters.search.trim()
          query = query.or(
            `no_palete.ilike.%${searchTerm}%,no_guia_forn.ilike.%${searchTerm}%,ref_cartao.ilike.%${searchTerm}%`,
          )
        }

        if (filters.referencia?.trim()) {
          query = query.ilike('ref_cartao', `%${filters.referencia.trim()}%`)
        }

        if (filters.fornecedor && filters.fornecedor !== '__all__') {
          const { data: fornecedorData } = await supabase
            .from('fornecedores')
            .select('id')
            .ilike('nome_forn', `%${filters.fornecedor}%`)

          if (fornecedorData && fornecedorData.length > 0) {
            const fornecedorIds = fornecedorData.map((f) => f.id)
            query = query.in('fornecedor_id', fornecedorIds)
          } else {
            setPaletes([])
            setPaletesLoading(false)
            return
          }
        }

        if (filters.author && filters.author !== '__all__') {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .or(
              `first_name.ilike.%${filters.author}%,last_name.ilike.%${filters.author}%`,
            )

          if (profileData && profileData.length > 0) {
            const profileIds = profileData.map((p) => p.id)
            query = query.in('author_id', profileIds)
          } else {
            setPaletes([])
            setPaletesLoading(false)
            return
          }
        }

        if (filters.dateFrom) {
          query = query.gte('data', filters.dateFrom)
        }

        if (filters.dateTo) {
          query = query.lte('data', filters.dateTo)
        }

        const { data, error } = await query.order('created_at', {
          ascending: false,
        })

        if (!error && data) {
          setPaletes(data)
        }
      } catch (error) {
        console.error('Error fetching paletes:', error)
      } finally {
        setPaletesLoading(false)
      }
    },
    [supabase],
  )

  const refreshPaletes = () => {
    const currentFilters = {
      search: paletesFilter,
      referencia: paletesReferenciaFilter,
      fornecedor: paletesFornecedorFilter,
      author: paletesAuthorFilter,
      dateFrom: paletesDateFrom,
      dateTo: paletesDateTo,
    }
    fetchPaletes(currentFilters)
  }

  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_id')
        .order('first_name', { ascending: true })

      if (!error && data) {
        setProfiles(data)
      }
    } catch (error) {
      console.error('Error fetching profiles:', error)
    }
  }, [supabase])

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchStocks(),
          fetchMaterials(),
          fetchFornecedores(),
          fetchCurrentStocks(),
          fetchPaletes(),
          fetchProfiles(),
        ])
      } catch (error) {
        console.error('Error loading initial data:', error)
      }
    }

    loadData()
  }, [
    fetchStocks,
    fetchMaterials,
    fetchFornecedores,
    fetchCurrentStocks,
    fetchPaletes,
    fetchProfiles,
  ])

  useEffect(() => {
    const filters = {
      search: paletesFilter,
      referencia: paletesReferenciaFilter,
      fornecedor: paletesFornecedorFilter,
      author: paletesAuthorFilter,
      dateFrom: paletesDateFrom,
      dateTo: paletesDateTo,
    }
    fetchPaletes(filters)
  }, [
    paletesFilter,
    paletesReferenciaFilter,
    paletesFornecedorFilter,
    paletesAuthorFilter,
    paletesDateFrom,
    paletesDateTo,
    fetchPaletes,
  ])

  useEffect(() => {
    const handleFocus = () => {
      fetchMaterials()
    }
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchMaterials])

  const getReferenciaByMaterialId = (materialId: string) => {
    const found = materials.find((m) => m.id === materialId)
    return found?.referencia || '-'
  }

  const filteredStocks = stocks.filter((stock) => {
    const materialName = stock.materiais?.material || ''
    const materialCor = stock.materiais?.cor || ''
    const referencia = stock.materiais?.referencia || ''
    const materialSearchText = `${materialName} ${materialCor}`.toLowerCase()
    const referenciaSearchText = referencia.toLowerCase()

    const matchesMaterial = materialSearchText.includes(
      materialFilter.toLowerCase(),
    )
    const matchesReferencia = referenciaSearchText.includes(
      referenciaFilter.toLowerCase(),
    )

    return matchesMaterial && matchesReferencia
  })

  const filteredCurrentStocks = currentStocks.filter((stock) => {
    const materialName = stock.material || ''
    const materialCor = stock.cor || ''
    const referencia = getReferenciaByMaterialId(stock.id)
    const materialSearchText = `${materialName} ${materialCor}`.toLowerCase()
    const referenciaSearchText = referencia.toLowerCase()

    const matchesMaterial = materialSearchText.includes(
      currentStockFilter.toLowerCase(),
    )
    const matchesReferencia = referenciaSearchText.includes(
      currentStockReferenciaFilter.toLowerCase(),
    )

    return matchesMaterial && matchesReferencia
  })

  const filteredPaletes = paletes

  const handleSortEntries = (column: string) => {
    if (sortColumnEntries === column) {
      setSortDirectionEntries((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumnEntries(column)
      setSortDirectionEntries('asc')
    }
  }

  const handleSortCurrent = (column: string) => {
    if (sortColumnCurrent === column) {
      setSortDirectionCurrent((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumnCurrent(column)
      setSortDirectionCurrent('asc')
    }
  }

  const handleSortPaletes = (column: string) => {
    if (sortColumnPaletes === column) {
      setSortDirectionPaletes((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumnPaletes(column)
      setSortDirectionPaletes('asc')
    }
  }

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    const getValue = (stock: any, col: string) => {
      switch (col) {
        case 'data':
          return new Date(stock.data).getTime()
        case 'referencia':
          return stock.materiais?.referencia || ''
        case 'material':
          return formatMaterialName(stock.materiais)
        case 'fornecedor':
          return stock.fornecedores?.nome_forn || ''
        case 'quantidade':
          return stock.quantidade
        case 'vl_m2':
          return (stock as any).vl_m2 || 0
        case 'preco_unitario':
          return stock.preco_unitario || 0
        case 'valor_total':
          return stock.valor_total || 0
        case 'n_palet':
          return stock.n_palet || ''
        default:
          return ''
      }
    }
    const aValue = getValue(a, sortColumnEntries)
    const bValue = getValue(b, sortColumnEntries)
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirectionEntries === 'asc' ? aValue - bValue : bValue - aValue
    }
    return sortDirectionEntries === 'asc'
      ? String(aValue).localeCompare(String(bValue))
      : String(bValue).localeCompare(String(aValue))
  })

  const materialOptions = useMemo(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: formatMaterialName(material),
      })),
    [materials],
  )

  const referenciaOptions = useMemo(() => {
    const uniqueReferences = Array.from(
      new Set(
        materials.map((material) => material.referencia).filter(Boolean),
      ),
    ) as string[]

    return uniqueReferences.map((ref) => ({
      value: ref,
      label: ref,
    }))
  }, [materials])

  const formatCurrentStockMaterialName = (stock: CurrentStock) => {
    return [stock.material, stock.cor, stock.tipo, stock.carateristica]
      .filter(Boolean)
      .join(' - ')
  }

  const sortedCurrentStocks = [...filteredCurrentStocks].sort((a, b) => {
    const getValue = (stock: any, col: string) => {
      switch (col) {
        case 'referencia':
          return getReferenciaByMaterialId(stock.id)
        case 'material':
          return formatCurrentStockMaterialName(stock)
        case 'total_recebido':
          return stock.total_recebido
        case 'total_consumido':
          return stock.total_consumido
        case 'stock_atual':
          return stock.stock_atual
        case 'stock_minimo':
          return stock.stock_minimo ?? 0
        case 'stock_critico':
          return stock.stock_critico ?? 0
        default:
          return ''
      }
    }
    const aValue = getValue(a, sortColumnCurrent)
    const bValue = getValue(b, sortColumnCurrent)
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirectionCurrent === 'asc' ? aValue - bValue : bValue - aValue
    }
    return sortDirectionCurrent === 'asc'
      ? String(aValue).localeCompare(String(bValue))
      : String(bValue).localeCompare(String(aValue))
  })

  const sortedPaletes = [...filteredPaletes].sort((a, b) => {
    const getValue = (palete: any, col: string) => {
      switch (col) {
        case 'no_palete':
          return palete.no_palete || ''
        case 'fornecedor':
          return palete.fornecedores?.nome_forn || ''
        case 'no_guia_forn':
          return palete.no_guia_forn || ''
        case 'ref_cartao':
          return palete.ref_cartao || ''
        case 'qt_palete':
          return palete.qt_palete ?? 0
        case 'data':
          return new Date(palete.data).getTime()
        case 'author':
          return palete.profiles
            ? `${palete.profiles.first_name} ${palete.profiles.last_name}`
            : ''
        default:
          return ''
      }
    }
    const aValue = getValue(a, sortColumnPaletes)
    const bValue = getValue(b, sortColumnPaletes)
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirectionPaletes === 'asc' ? aValue - bValue : bValue - aValue
    }
    return sortDirectionPaletes === 'asc'
      ? String(aValue).localeCompare(String(bValue))
      : String(bValue).localeCompare(String(aValue))
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.material_id) {
      alert('Por favor selecione um material')
      return
    }

    if (!formData.quantidade) {
      alert('Por favor insira uma quantidade')
      return
    }

    setSubmitting(true)
    try {
      const stockData = {
        material_id: formData.material_id,
        fornecedor_id: formData.fornecedor_id || null,
        no_guia_forn: formData.no_guia_forn || null,
        quantidade: parseFloat(formData.quantidade),
        quantidade_disponivel: parseFloat(
          formData.quantidade_disponivel || formData.quantidade,
        ),
        vl_m2: formData.vl_m2 || null,
        preco_unitario: formData.preco_unitario
          ? parseFloat(formData.preco_unitario)
          : null,
        valor_total: parseFloat(calculateTotalValue()),
        notas: formData.notas || null,
        n_palet: formData.num_palettes || null,
        data: new Date().toISOString().split('T')[0],
      }

      if (editingStock) {
        const { data, error } = await supabase
          .from('stocks')
          .update({
            ...stockData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingStock.id).select(`
            *,
            materiais(material, cor, tipo, carateristica),
            fornecedores(nome_forn)
          `)

        if (error) {
          console.error('Error updating stock:', error)
          alert(`Erro ao atualizar stock: ${error.message}`)
          return
        }

        if (data && data[0]) {
          setStocks((prev) =>
            prev.map((s) => (s.id === editingStock.id ? data[0] : s)),
          )
          await Promise.all([
            fetchStocks(),
            fetchMaterials(),
            fetchCurrentStocks(),
          ])
          resetForm()
        }
      } else {
        const { data, error } = await supabase.from('stocks').insert(stockData)
          .select(`
            *,
            materiais(material, cor, tipo, carateristica),
            fornecedores(nome_forn)
          `)

        if (error) {
          console.error('Error creating stock:', error)
          alert(`Erro ao criar entrada de stock: ${error.message}`)
          return
        }

        if (data && data[0]) {
          setStocks((prev) => [data[0], ...prev])
          await Promise.all([
            fetchStocks(),
            fetchMaterials(),
            fetchCurrentStocks(),
          ])
          resetForm()
        }
      }
    } catch (error) {
      console.error('Error saving stock:', error)
      alert(`Erro inesperado: ${error}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (stock: StockEntryWithRelations) => {
    // Toggle inline editing
    if (editingStock?.id === stock.id) {
      // Cancel editing
      setEditingStock(null)
    } else {
      // Start editing this stock
      setEditingStock(stock)
    }
  }

  const handleSaveInlineEdit = async (stockId: string) => {
    if (!editingStock) return

    try {
      const { error } = await supabase
        .from('stocks')
        .update({
          quantidade: editingStock.quantidade,
          size_x: (editingStock as any).size_x,
          size_y: (editingStock as any).size_y,
          preco_unitario: editingStock.preco_unitario,
          valor_total: editingStock.valor_total,
          n_palet: editingStock.n_palet,
          no_guia_forn: editingStock.no_guia_forn,
        })
        .eq('id', stockId)

      if (error) throw error

      alert('Stock atualizado com sucesso!')
      setEditingStock(null)
      await fetchStocks()
    } catch (error) {
      console.error('Error updating stock:', error)
      alert('Erro ao atualizar stock')
    }
  }

  const handleCancelInlineEdit = () => {
    setEditingStock(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza que quer eliminar esta entrada de stock?'))
      return

    try {
      const { error } = await supabase.from('stocks').delete().eq('id', id)

      if (!error) {
        setStocks((prev) => prev.filter((s) => s.id !== id))
      }
    } catch (error) {
      console.error('Error deleting stock:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      material_id: '',
      material_referencia: '',
      fornecedor_id: '',
      no_guia_forn: '',
      quantidade: '',
      quantidade_disponivel: '',
      vl_m2: '',
      preco_unitario: '',
      valor_total: '',
      notas: '',
      n_palet: '',
      quantidade_palete: '',
      num_palettes: '',
    })
    setEditingStock(null)
  }

  const handleMaterialChange = (materialId: string) => {
    const selectedMaterial = materials.find((m) => m.id === materialId)

    setFormData((prev) => ({
      ...prev,
      material_id: materialId,
      material_referencia: selectedMaterial?.referencia || '',
      fornecedor_id: selectedMaterial?.fornecedor_id || '',
      vl_m2: selectedMaterial?.valor_m2_custo?.toString() || '',
      preco_unitario: selectedMaterial?.valor_placa?.toString() || '0',
      quantidade_palete: selectedMaterial?.qt_palete?.toString() || '',
      quantidade: '',
      num_palettes: '',
    }))
  }

  const handleReferenciaChange = (referencia: string) => {
    const selectedMaterial = materials.find((m) => m.referencia === referencia)

    if (selectedMaterial) {
      setFormData((prev) => ({
        ...prev,
        material_id: selectedMaterial.id,
        material_referencia: referencia,
        fornecedor_id: selectedMaterial.fornecedor_id || '',
        vl_m2: selectedMaterial.valor_m2_custo?.toString() || '',
        preco_unitario: selectedMaterial.valor_placa?.toString() || '0',
        quantidade_palete: selectedMaterial.qt_palete?.toString() || '',
        quantidade: '',
        num_palettes: '',
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        material_referencia: referencia,
      }))
    }
  }

  const openNewForm = () => {
    resetForm()

    setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && !activeElement.closest('[data-vaul-drawer]')) {
        activeElement.blur()
      }

      const drawerContent = document.querySelector(
        '[data-vaul-drawer] input, [data-vaul-drawer] button, [data-vaul-drawer] select',
      )
      if (drawerContent) {
        ;(drawerContent as HTMLElement).focus()
      }
    }, 100)
  }

  // Inline input handlers
  const handleShowInlineInput = () => {
    setShowInlineInput(true)
    setInlineEntries([
      {
        id: crypto.randomUUID(),
        material_id: '',
        material_name: '',
        referencia: '',
        fornecedor_id: '',
        fornecedor_name: '',
        quantidade: 0,
        no_guia_forn: '',
        no_palete: '',
        num_paletes: 1,
        size_x: 0,
        size_y: 0,
        preco_unitario: 0,
        valor_total: 0,
        isSaving: false,
      },
    ])
  }

  const handleReferenciaSelect = (
    index: number,
    referencia: string,
    material: any,
  ) => {
    const updatedEntries = [...inlineEntries]
    if (material) {
      updatedEntries[index] = {
        ...updatedEntries[index],
        referencia: referencia,
        material_id: material.id,
        material_name: formatMaterialName(material),
        fornecedor_id: material.fornecedor_id || '',
        fornecedor_name:
          fornecedores.find((f) => f.id === material.fornecedor_id)
            ?.nome_forn || '',
      }
    } else {
      updatedEntries[index] = {
        ...updatedEntries[index],
        referencia: referencia,
      }
    }
    setInlineEntries(updatedEntries)
  }

  const handleMaterialSelect = (index: number, material: any) => {
    const updatedEntries = [...inlineEntries]
    const fornecedor = fornecedores.find((f) => f.id === material.fornecedor_id)
    const preco = material.valor_placa || 0
    const quantidade = updatedEntries[index].quantidade || 0
    updatedEntries[index] = {
      ...updatedEntries[index],
      material_id: material.id,
      material_name: formatMaterialName(material),
      referencia: material.referencia || '',
      fornecedor_id: material.fornecedor_id || '',
      fornecedor_name: fornecedor?.nome_forn || '',
      preco_unitario: preco,
      valor_total: quantidade * preco,
    }
    setInlineEntries(updatedEntries)
  }

  const updateEntry = (index: number, field: string, value: any) => {
    const updatedEntries = [...inlineEntries]
    updatedEntries[index] = {
      ...updatedEntries[index],
      [field]: value,
    }

    // Recalculate valor_total when quantidade changes
    if (field === 'quantidade') {
      const preco = updatedEntries[index].preco_unitario || 0
      updatedEntries[index].valor_total = value * preco
    }

    setInlineEntries(updatedEntries)
  }

  const addNewRow = useCallback(() => {
    setInlineEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        material_id: '',
        material_name: '',
        referencia: '',
        fornecedor_id: '',
        fornecedor_name: '',
        quantidade: 0,
        no_guia_forn: '',
        no_palete: '',
        num_paletes: 1,
        size_x: 0,
        size_y: 0,
        preco_unitario: 0,
        valor_total: 0,
        isSaving: false,
      },
    ])
  }, [])

  const removeEntry = (index: number) => {
    setInlineEntries(inlineEntries.filter((_, i) => i !== index))
    if (inlineEntries.length === 1) {
      setShowInlineInput(false)
    }
  }

  // Keyboard shortcuts for inline input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n' && showInlineInput) {
        e.preventDefault()
        addNewRow()
      }
      // Escape: Close inline input
      if (e.key === 'Escape' && showInlineInput) {
        setShowInlineInput(false)
        setLastSavesSummary(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showInlineInput, addNewRow])

  const handleSaveEntry = async (
    index: number,
    skipNotifications = false,
  ): Promise<{ paleteNumber: string; quantidade: number } | null> => {
    const entry = inlineEntries[index]

    // Mark as saving
    updateEntry(index, 'isSaving', true)

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!skipNotifications) alert('Utilizador não autenticado')
        updateEntry(index, 'isSaving', false)
        return null
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      // Get material details
      const material = materials.find((m) => m.id === entry.material_id)

      // Step 1: Parse palete numbers - OPTIONAL (only if REF PAL is provided)
      let paleteNumbers: string[] = []
      let allPaletesString = ''

      if (entry.no_palete && entry.no_palete.trim()) {
        const basePaleteNumber = entry.no_palete.trim()
        const numPaletes = entry.num_paletes

        // Check if user entered comma-separated paletes
        if (basePaleteNumber.includes(',')) {
          // Manual comma-separated list (e.g., "P100, P101, P102")
          paleteNumbers = basePaleteNumber
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)

          // Validate each palete format
          const invalidPaletes = paleteNumbers.filter(
            (p) => !p.match(/^P\d+$/i),
          )
          if (invalidPaletes.length > 0) {
            if (!skipNotifications)
              alert(
                `Formato de palete inválido: ${invalidPaletes.join(', ')}. Use formato: P100`,
              )
            updateEntry(index, 'isSaving', false)
            return null
          }
        } else {
          // Single palete - generate sequential numbers
          const paleteMatch = basePaleteNumber.match(/^P(\d+)$/i)
          if (!paleteMatch) {
            if (!skipNotifications)
              alert('Formato de palete inválido. Use formato: P100')
            updateEntry(index, 'isSaving', false)
            return null
          }

          const baseNumber = parseInt(paleteMatch[1])

          // Generate sequential palete numbers
          for (let i = 0; i < numPaletes; i++) {
            paleteNumbers.push(`P${baseNumber + i}`)
          }
        }

        // Step 2: Create multiple palete entries (only if REF PAL provided)
        const paletesToInsert = paleteNumbers.map((paleteNum) => ({
          no_palete: paleteNum,
          fornecedor_id: entry.fornecedor_id || null,
          no_guia_forn: entry.no_guia_forn || null,
          ref_cartao: entry.referencia || null,
          qt_palete: material?.qt_palete || null,
          data: new Date().toISOString(),
          author_id: profile?.id,
        }))

        const { data: newPaletes, error: paleteError } = await supabase
          .from('paletes')
          .insert(paletesToInsert)
          .select()

        if (paleteError) throw paleteError

        allPaletesString = paleteNumbers.join(', ')
      }

      // Step 3: Create stock entry (with or without paletes)

      // Calculate vl_m2 if size_x and size_y are provided
      let calculatedVlM2 = null
      if (entry.size_x && entry.size_y && entry.preco_unitario) {
        // Convert mm² to m² by dividing by 1,000,000
        const areaM2 = (entry.size_x * entry.size_y) / 1000000
        // Calculate price per m²
        calculatedVlM2 = (entry.preco_unitario / areaM2).toFixed(2)
      }

      const { data: newStock, error: stockError } = await supabase
        .from('stocks')
        .insert({
          material_id: entry.material_id,
          fornecedor_id: entry.fornecedor_id || null,
          no_guia_forn: entry.no_guia_forn || null,
          quantidade: entry.quantidade,
          quantidade_disponivel: entry.quantidade,
          size_x: entry.size_x || null,
          size_y: entry.size_y || null,
          vl_m2: calculatedVlM2 || material?.valor_m2_custo || null,
          preco_unitario: entry.preco_unitario || material?.valor_placa || null,
          valor_total: entry.valor_total || (entry.quantidade * (material?.valor_placa || 0)) || null,
          n_palet: allPaletesString || null,
          data: new Date().toISOString(),
        })
        .select()
        .single()

      if (stockError) throw stockError

      // Success
      if (!skipNotifications) {
        if (paleteNumbers.length > 0) {
          alert(
            `Stock adicionado com sucesso! ${paleteNumbers.length} palete(s) criada(s): ${allPaletesString}`,
          )
        } else {
          alert('Stock adicionado com sucesso!')
        }
      }

      return {
        paleteNumber: allPaletesString,
        quantidade: entry.quantidade,
      }
    } catch (error) {
      console.error('Erro ao guardar:', error)
      if (!skipNotifications) alert('Erro ao guardar entrada de stock')
      updateEntry(index, 'isSaving', false)
      return null
    }
  }

  const handleSaveAll = async () => {
    const validEntries = inlineEntries
      .map((entry, index) => ({ entry, index }))
      .filter(
        ({ entry }) =>
          entry.material_id &&
          entry.quantidade > 0,
      )

    if (validEntries.length === 0) {
      alert('Nenhuma entrada válida para guardar')
      return
    }

    setIsSavingBatch(true)
    const savedPaletes: string[] = []
    let totalQuantidade = 0

    for (const { entry, index } of validEntries) {
      const result = await handleSaveEntry(index, true)
      if (result) {
        // Split comma-separated paletes and add to array
        const paletesArray = result.paleteNumber
          .split(', ')
          .map((p) => p.trim())
        savedPaletes.push(...paletesArray)
        totalQuantidade += result.quantidade
      }
    }

    // Refresh the tables
    await Promise.all([fetchStocks(), fetchPaletes()])

    // Set summary
    setLastSavesSummary({
      count: validEntries.length, // Number of stock entries
      paletes: savedPaletes, // All paletes created
      total: totalQuantidade,
    })

    // Clear entries and show summary
    setInlineEntries([])
    setIsSavingBatch(false)
    setShowInlineInput(false)

    // Auto-hide summary after 10 seconds
    setTimeout(() => {
      setLastSavesSummary(null)
    }, 10000)
  }

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '-'
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price)
  }

  const calculateTotalValue = () => {
    const quantidade = parseFloat(formData.quantidade) || 0
    const preco = parseFloat(formData.preco_unitario) || 0
    return (quantidade * preco).toFixed(2)
  }

  const handleQuantidadeChange = (newQuantidade: string) => {
    setFormData((prev) => ({
      ...prev,
      quantidade: newQuantidade,
      quantidade_disponivel: prev.quantidade_disponivel || newQuantidade,
      num_palettes: '',
    }))
  }

  const handleNumPalettesChange = (newNumPalettes: string) => {
    const qtPalete = parseFloat(formData.quantidade_palete) || 0
    const numPalettes = parseFloat(newNumPalettes) || 0

    if (qtPalete > 0 && numPalettes > 0) {
      const calculatedQuantidade = (qtPalete * numPalettes).toString()
      setFormData((prev) => ({
        ...prev,
        num_palettes: newNumPalettes,
        quantidade: calculatedQuantidade,
        quantidade_disponivel:
          prev.quantidade_disponivel || calculatedQuantidade,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        num_palettes: newNumPalettes,
      }))
    }
  }

  const getStockStatusColor = (
    stockAtual: number,
    stockCritico: number | null = 0,
    stockMinimo: number | null = 10,
  ) => {
    const stock = stockAtual ?? 0
    const critico = stockCritico ?? 0
    const minimo = stockMinimo ?? 10

    if (stock <= critico) return 'text-red-600'
    if (stock <= minimo) return 'text-orange-500'
    return 'text-green-600'
  }

  const getStockStatusText = (
    stockAtual: number,
    stockCritico: number | null = 0,
    stockMinimo: number | null = 10,
  ) => {
    const stock = stockAtual ?? 0
    const critico = stockCritico ?? 0
    const minimo = stockMinimo ?? 10

    if (stock <= critico) return 'CRÍTICO'
    if (stock <= minimo) return 'BAIXO'
    return 'OK'
  }

  const refreshCurrentStocks = () => {
    fetchCurrentStocks()
  }

  const handleSaveStockCorrect = async (materialId: string) => {
    const value = stockCorrectValueMap[materialId]
    const newValue = value && value.trim() !== '' ? parseFloat(value) : null
    if (value && value.trim() !== '' && isNaN(newValue as number)) {
      alert('Valor inválido')
      return
    }
    try {
      await supabase
        .from('materiais')
        .update({
          stock_correct: newValue,
          stock_correct_updated_at: new Date().toISOString(),
        })
        .eq('id', materialId)
      setStockCorrectValueMap((prev) => ({
        ...prev,
        [materialId]: value ?? '',
      }))
      fetchCurrentStocks()
    } catch (error) {
      alert('Erro ao guardar correção manual')
    }
  }

  const handleSaveStockMinimo = async (materialId: string) => {
    const value = stockMinimoValueMap[materialId]
    const newValue = value && value.trim() !== '' ? parseFloat(value) : null
    if (value && value.trim() !== '' && isNaN(newValue as number)) {
      alert('Valor inválido')
      return
    }
    try {
      await supabase
        .from('materiais')
        .update({ stock_minimo: newValue })
        .eq('id', materialId)
      setStockMinimoValueMap((prev) => ({ ...prev, [materialId]: value ?? '' }))
      fetchCurrentStocks()
    } catch (error) {
      alert('Erro ao guardar stock mínimo')
    }
  }

  const handleSaveStockCritico = async (materialId: string) => {
    const value = stockCriticoValueMap[materialId]
    const newValue = value && value.trim() !== '' ? parseFloat(value) : null
    if (value && value.trim() !== '' && isNaN(newValue as number)) {
      alert('Valor inválido')
      return
    }
    try {
      await supabase
        .from('materiais')
        .update({ stock_critico: newValue })
        .eq('id', materialId)
      setStockCriticoValueMap((prev) => ({
        ...prev,
        [materialId]: value ?? '',
      }))
      fetchCurrentStocks()
    } catch (error) {
      alert('Erro ao guardar stock crítico')
    }
  }

  const handleApplyCorrection = async (materialId: string) => {
    const correctionValue = stockCorrectValueMap[materialId] || '0'
    const correction = parseFloat(correctionValue)

    if (isNaN(correction) || correction === 0) {
      alert('Nenhuma correção para aplicar')
      return
    }

    if (
      !confirm(
        `Aplicar correção de ${correction} e reset? Esta ação criará um ajuste de stock.`,
      )
    ) {
      return
    }

    try {
      const { error: stockError } = await supabase.from('stocks').insert({
        material_id: materialId,
        quantidade: correction,
        quantidade_disponivel: correction > 0 ? correction : 0,
        data: new Date().toISOString().split('T')[0],
        notas: `AJUSTE MANUAL - Correção aplicada em ${new Date().toLocaleDateString('pt-PT')}`,
        fornecedor_id: null,
        preco_unitario: 0,
        valor_total: 0,
      })

      if (stockError) {
        console.error('Error creating stock adjustment:', stockError)
        alert('Erro ao criar ajuste de stock')
        return
      }

      const { error: resetError } = await supabase
        .from('materiais')
        .update({
          stock_correct: 0,
          stock_correct_updated_at: new Date().toISOString(),
        })
        .eq('id', materialId)

      if (resetError) {
        console.error('Error resetting stock_correct:', resetError)
        alert('Erro ao reset stock_correct')
        return
      }

      setStockCorrectValueMap((prev) => ({ ...prev, [materialId]: '0' }))

      await Promise.all([fetchStocks(), fetchCurrentStocks()])

      alert('Correção aplicada com sucesso!')
    } catch (error) {
      console.error('Error applying correction:', error)
      alert('Erro inesperado ao aplicar correção')
    }
  }

  const exportEntriesToExcel = () => {
    try {
      const exportData = sortedStocks.map((stock) => ({
        Data: stock.data
          ? new Date(stock.data).toLocaleDateString('pt-PT')
          : '',
        Referência: stock.materiais?.referencia || '',
        Material: formatMaterialName(stock.materiais),
        Fornecedor: stock.fornecedores?.nome_forn || '',
        Quantidade: stock.quantidade || 0,
        VL_m2: (stock as any).vl_m2 || '',
        'Preço Unitário': stock.preco_unitario || 0,
        'Valor Total': stock.valor_total || 0,
        'Nº Palete': stock.n_palet || '',
        'Nº Guia Fornecedor': stock.no_guia_forn || '',
        Notas: stock.notas || '',
        'Criado em': stock.created_at
          ? new Date(stock.created_at).toLocaleDateString('pt-PT')
          : '',
      }))

      const headers = Object.keys(exportData[0] || {})
      const csvContent = [
        headers.join(';'),
        ...exportData.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row]
              const stringValue = String(value)
              return stringValue.includes(';') ||
                stringValue.includes(',') ||
                stringValue.includes('\n')
                ? `"${stringValue.replace(/"/g, '""')}"`
                : stringValue
            })
            .join(';'),
        ),
      ].join('\n')

      const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)

      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      link.setAttribute('download', `entradas_stock_${dateStr}.csv`)

      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      alert(`Exportadas ${exportData.length} entradas de stock para Excel`)
    } catch (error) {
      console.error('Error exporting entries:', error)
      alert('Erro ao exportar entradas de stock')
    }
  }

  const exportCurrentStocksToExcel = () => {
    try {
      const exportData = sortedCurrentStocks.map((stock) => ({
        Referência: getReferenciaByMaterialId(stock.id),
        Material: formatCurrentStockMaterialName(stock),
        'Total Recebido': Math.round(stock.total_recebido),
        'Total Consumido': Math.round(stock.total_consumido),
        'Stock Atual': Math.round(stock.stock_atual),
        'Stock Mínimo': stock.stock_minimo ?? '',
        'Stock Crítico': stock.stock_critico ?? '',
        'Correção Manual': stock.stock_correct ?? '',
        'Stock Final':
          stock.stock_correct !== null && stock.stock_correct !== undefined
            ? stock.stock_correct
            : stock.stock_atual,
        Status: getStockStatusText(
          stock.stock_correct !== null && stock.stock_correct !== undefined
            ? stock.stock_correct
            : stock.stock_atual,
          stock.stock_critico,
          stock.stock_minimo,
        ),
        'Última Correção': stock.stock_correct_updated_at
          ? new Date(stock.stock_correct_updated_at).toLocaleDateString('pt-PT')
          : '',
      }))

      const headers = Object.keys(exportData[0] || {})
      const csvContent = [
        headers.join(';'),
        ...exportData.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row]
              const stringValue = String(value)
              return stringValue.includes(';') ||
                stringValue.includes(',') ||
                stringValue.includes('\n')
                ? `"${stringValue.replace(/"/g, '""')}"`
                : stringValue
            })
            .join(';'),
        ),
      ].join('\n')

      const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)

      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      link.setAttribute('download', `stock_atual_${dateStr}.csv`)

      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      alert(
        `Exportados ${exportData.length} materiais de stock atual para Excel`,
      )
    } catch (error) {
      console.error('Error exporting current stocks:', error)
      alert('Erro ao exportar stock atual')
    }
  }

  const exportPaletesToExcel = () => {
    try {
      const exportData = sortedPaletes.map((palete) => ({
        'Nº Palete': palete.no_palete || '',
        Fornecedor: palete.fornecedores?.nome_forn || '',
        'Nº Guia': palete.no_guia_forn || '',
        'Ref. Cartão': palete.ref_cartao || '',
        'Qt. Palete': palete.qt_palete || 0,
        Data: palete.data
          ? new Date(palete.data).toLocaleDateString('pt-PT')
          : '',
        Autor: palete.profiles
          ? `${palete.profiles.first_name} ${palete.profiles.last_name}`
          : '',
        'Criado em': palete.created_at
          ? new Date(palete.created_at).toLocaleDateString('pt-PT')
          : '',
      }))

      const headers = Object.keys(exportData[0] || {})
      const csvContent = [
        headers.join(';'),
        ...exportData.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row]
              const stringValue = String(value)
              return stringValue.includes(';') ||
                stringValue.includes(',') ||
                stringValue.includes('\n')
                ? `"${stringValue.replace(/"/g, '""')}"`
                : stringValue
            })
            .join(';'),
        ),
      ].join('\n')

      const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)

      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      link.setAttribute('download', `paletes_${dateStr}.csv`)

      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      alert(`Exportadas ${exportData.length} paletes para Excel`)
    } catch (error) {
      console.error('Error exporting palettes:', error)
      alert('Erro ao exportar paletes')
    }
  }

  const getReferenciaOptions = () => {
    const cartaoMaterials = materials.filter(
      (material) =>
        material.material && material.material.toLowerCase() === 'cartão',
    )

    const uniqueReferences = Array.from(
      new Set(
        cartaoMaterials.map((material) => material.referencia).filter(Boolean),
      ),
    ) as string[]
    return uniqueReferences.map((ref) => ({ value: ref, label: ref }))
  }

  const isPaleteNumberDuplicate = (
    paleteNumber: string,
    excludeId?: string,
  ) => {
    if (!paleteNumber.trim()) return false
    return paletes.some(
      (p) =>
        (!excludeId || p.id !== excludeId) &&
        p.no_palete.toLowerCase() === paleteNumber.toLowerCase(),
    )
  }

  const getProfileOptions = () => {
    return profiles.map((profile) => ({
      value: profile.id,
      label: `${profile.first_name} ${profile.last_name}`,
    }))
  }

  const getNextPaleteNumber = () => {
    if (paletes.length === 0) return 'P1'

    const numbers = paletes
      .map((p) => p.no_palete)
      .filter((num) => num.startsWith('P'))
      .map((num) => parseInt(num.substring(1)))
      .filter((num) => !isNaN(num))

    if (numbers.length === 0) return 'P1'

    const maxNumber = Math.max(...numbers)
    return `P${maxNumber + 1}`
  }

  const handleSaveNewPalete = async () => {
    if (!newPaleteData.fornecedor_id || !newPaleteData.author_id) {
      alert('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    const paleteNumber = newPaleteData.no_palete || getNextPaleteNumber()
    const isDuplicate = paletes.some(
      (p) => p.no_palete.toLowerCase() === paleteNumber.toLowerCase(),
    )
    if (isDuplicate) {
      alert(
        `Número de palete "${paleteNumber}" já existe. Por favor, escolha outro número.`,
      )
      return
    }

    if (newPaleteData.qt_palete && parseInt(newPaleteData.qt_palete) <= 0) {
      alert('Quantidade da palete deve ser maior que zero.')
      return
    }

    setSubmittingPalete(true)
    try {
      const paleteData = {
        no_palete: newPaleteData.no_palete || getNextPaleteNumber(),
        fornecedor_id: newPaleteData.fornecedor_id,
        no_guia_forn: newPaleteData.no_guia_forn || null,
        ref_cartao: newPaleteData.ref_cartao || null,
        qt_palete: newPaleteData.qt_palete
          ? parseInt(newPaleteData.qt_palete)
          : null,
        data: newPaleteData.data,
        author_id: newPaleteData.author_id,
      }

      const { data, error } = await supabase.from('paletes').insert(paleteData)
        .select(`
          *,
          fornecedores(id, nome_forn),
          profiles(id, first_name, last_name)
        `)

      if (error) {
        console.error('Error creating palete:', error)
        alert(`Erro ao criar palete: ${error.message}`)
        return
      }

      if (data && data[0]) {
        setPaletes((prev) => [data[0], ...prev])
        handleCancelNewPalete()
      }
    } catch (error) {
      console.error('Error saving palete:', error)
      alert(`Erro inesperado: ${error}`)
    } finally {
      setSubmittingPalete(false)
    }
  }

  const handleCancelNewPalete = () => {
    setShowNewPaleteRow(false)
    setNewPaleteData({
      no_palete: '',
      fornecedor_id: '',
      no_guia_forn: '',
      ref_cartao: '',
      qt_palete: '',
      data: new Date().toISOString().split('T')[0],
      author_id: '',
    })
  }

  const handleEditPalete = (palete: PaleteWithRelations) => {
    setEditingPaleteId(palete.id)
    setEditingPaleteData({
      [palete.id]: {
        no_palete: palete.no_palete,
        fornecedor_id: palete.fornecedor_id || '',
        no_guia_forn: palete.no_guia_forn || '',
        ref_cartao: palete.ref_cartao || '',
        qt_palete: palete.qt_palete?.toString() || '',
        data: palete.data,
        author_id: palete.author_id || '',
      },
    })
  }

  const handleSaveEditPalete = async (paleteId: string) => {
    const editData = editingPaleteData[paleteId]
    if (!editData) return

    const paleteNumber = editData.no_palete
    const isDuplicate = paletes.some(
      (p) =>
        p.id !== paleteId &&
        p.no_palete.toLowerCase() === paleteNumber.toLowerCase(),
    )
    if (isDuplicate) {
      alert(
        `Número de palete "${paleteNumber}" já existe. Por favor, escolha outro número.`,
      )
      return
    }

    if (!editData.fornecedor_id || !editData.author_id) {
      alert('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    if (editData.qt_palete && parseInt(editData.qt_palete) <= 0) {
      alert('Quantidade da palete deve ser maior que zero.')
      return
    }

    setSubmittingPalete(true)
    try {
      const updateData = {
        no_palete: editData.no_palete,
        fornecedor_id: editData.fornecedor_id || null,
        no_guia_forn: editData.no_guia_forn || null,
        ref_cartao: editData.ref_cartao || null,
        qt_palete: editData.qt_palete ? parseInt(editData.qt_palete) : null,
        data: editData.data,
        author_id: editData.author_id || null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('paletes')
        .update(updateData)
        .eq('id', paleteId).select(`
          *,
          fornecedores(id, nome_forn),
          profiles(id, first_name, last_name)
        `)

      if (error) {
        console.error('Error updating palete:', error)
        alert(`Erro ao atualizar palete: ${error.message}`)
        return
      }

      if (data && data[0]) {
        setPaletes((prev) => prev.map((p) => (p.id === paleteId ? data[0] : p)))
        handleCancelEditPalete()
      }
    } catch (error) {
      console.error('Error updating palete:', error)
      alert(`Erro inesperado: ${error}`)
    } finally {
      setSubmittingPalete(false)
    }
  }

  const handleCancelEditPalete = () => {
    setEditingPaleteId(null)
    setEditingPaleteData({})
  }

  const handleDeletePalete = async (paleteId: string) => {
    if (!confirm('Tem a certeza que quer eliminar esta palete?')) return

    try {
      const { error } = await supabase
        .from('paletes')
        .delete()
        .eq('id', paleteId)

      if (!error) {
        setPaletes((prev) => prev.filter((p) => p.id !== paleteId))
      } else {
        alert(`Erro ao eliminar palete: ${error.message}`)
      }
    } catch (error) {
      console.error('Error deleting palete:', error)
      alert(`Erro inesperado: ${error}`)
    }
  }

  // Reference Combobox Component
  const ReferenceCombobox = ({
    value,
    onSelect,
  }: {
    value: string
    onSelect: (referencia: string, material: any) => void
  }) => {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')

    // Get unique referencias
    const uniqueReferencias = Array.from(
      new Set(materials.map((m) => m.referencia).filter(Boolean)),
    ).sort()

    const filteredReferencias = uniqueReferencias.filter((ref) =>
      ref?.toLowerCase().includes(search.toLowerCase()),
    )

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between"
          >
            <span className="truncate max-w-[90px]" title={value}>
              {value || 'Selecionar referência...'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput
              placeholder="Referência..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>Referência não encontrada.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto">
              {filteredReferencias.slice(0, 50).map((ref) => {
                const material = materials.find((m) => m.referencia === ref)
                return (
                  <CommandItem
                    key={ref}
                    onSelect={() => {
                      onSelect(ref || '', material)
                      setOpen(false)
                    }}
                  >
                    {ref}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  // Material Combobox Component
  const MaterialCombobox = ({
    value,
    onSelect,
  }: {
    value: string
    onSelect: (material: any) => void
  }) => {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')

    const filteredMaterials = materials.filter(
      (m) =>
        formatMaterialName(m).toLowerCase().includes(search.toLowerCase()) ||
        m.referencia?.toLowerCase().includes(search.toLowerCase()),
    )

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between"
          >
            {value
              ? formatMaterialName(materials.find((m) => m.id === value))
              : 'Selecionar material...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput
              placeholder="Nome ou referência..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>Material não encontrado.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto">
              {filteredMaterials.slice(0, 50).map((material) => {
                const fornecedor = fornecedores.find(
                  (f) => f.id === material.fornecedor_id,
                )
                return (
                  <CommandItem
                    key={material.id}
                    onSelect={() => {
                      onSelect(material)
                      setOpen(false)
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {formatMaterialName(material)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Ref: {material.referencia} | Forn:{' '}
                        {fornecedor?.nome_forn || 'N/A'}
                      </span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <PermissionGuard>
      <div className="w-full space-y-6">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Gestão de Stocks</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            {activeTab === 'palettes' ? (
              <Combobox
                value={paletesFilter}
                onChange={setPaletesFilter}
                options={Array.from(
                  new Set(paletes.map((p) => p.no_palete).filter(Boolean)),
                ).map((palete) => ({
                  value: palete,
                  label: palete.toUpperCase(),
                }))}
                placeholder="Paletes"
                searchPlaceholder="Pesquisar paletes..."
                emptyMessage="Nenhuma palete encontrada."
                className="h-10 flex-1"
              />
            ) : (
              <FilterWithClear
                placeholder="Material"
                value={activeTab === 'entries' ? materialFilter : currentStockFilter}
                onChange={(value) => {
                  if (activeTab === 'entries') {
                    setMaterialFilter(value)
                  } else {
                    setCurrentStockFilter(value)
                  }
                }}
              />
            )}
            <FilterWithClear
              placeholder="Referência"
              value={
                activeTab === 'entries'
                  ? referenciaFilter
                  : activeTab === 'current'
                    ? currentStockReferenciaFilter
                    : paletesReferenciaFilter
              }
              onChange={(value) => {
                if (activeTab === 'entries') {
                  setReferenciaFilter(value)
                } else if (activeTab === 'current') {
                  setCurrentStockReferenciaFilter(value)
                } else {
                  setPaletesReferenciaFilter(value)
                }
              }}
            />

            {activeTab === 'palettes' && (
              <>
                <div className="w-[130px]">
                  <FilterWithClear
                    type="date"
                    placeholder="DATA INÍCIO"
                    value={paletesDateFrom}
                    onChange={setPaletesDateFrom}
                    className="h-10 pr-10 rounded-none"
                  />
                </div>
                <div className="w-[130px]">
                  <FilterWithClear
                    type="date"
                    placeholder="DATA FIM"
                    value={paletesDateTo}
                    onChange={setPaletesDateTo}
                    className="h-10 pr-10 rounded-none"
                  />
                </div>
                <Select
                  value={paletesFornecedorFilter}
                  onValueChange={setPaletesFornecedorFilter}
                >
                  <SelectTrigger className="h-10 w-[160px] rounded-none">
                    <UppercaseSelectValue placeholder="FORNECEDORES" />
                  </SelectTrigger>
                  <SelectContent>
                    <UppercaseSelectItem value="__all__">
                      FORNECEDORES
                    </UppercaseSelectItem>
                    {fornecedores.map((fornecedor) => (
                      <UppercaseSelectItem
                        key={fornecedor.id}
                        value={fornecedor.nome_forn}
                      >
                        {fornecedor.nome_forn}
                      </UppercaseSelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={paletesAuthorFilter}
                  onValueChange={setPaletesAuthorFilter}
                >
                  <SelectTrigger className="h-10 w-[140px] rounded-none">
                    <UppercaseSelectValue placeholder="AUTORES" />
                  </SelectTrigger>
                  <SelectContent>
                    <UppercaseSelectItem value="__all__">
                      AUTORES
                    </UppercaseSelectItem>
                    {profiles.map((profile) => (
                      <UppercaseSelectItem
                        key={profile.id}
                        value={`${profile.first_name} ${profile.last_name}`}
                      >
                        {`${profile.first_name} ${profile.last_name}`}
                      </UppercaseSelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => {
                      if (activeTab === 'entries') {
                        setMaterialFilter('')
                        setReferenciaFilter('')
                      } else if (activeTab === 'current') {
                        setCurrentStockFilter('')
                        setCurrentStockReferenciaFilter('')
                      } else {
                        setPaletesFilter('')
                        setPaletesReferenciaFilter('')
                        setPaletesDateFrom('')
                        setPaletesDateTo('')
                        setPaletesFornecedorFilter('__all__')
                        setPaletesAuthorFilter('__all__')
                      }
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Limpar filtros</TooltipContent>
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
                    onClick={
                      activeTab === 'entries'
                        ? fetchStocks
                        : activeTab === 'current'
                          ? refreshCurrentStocks
                          : refreshPaletes
                    }
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Atualizar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {activeTab === 'entries' && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10"
                        onClick={exportEntriesToExcel}
                        disabled={sortedStocks.length === 0}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Exportar para Excel</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className="h-10 w-10"
                        onClick={openNewForm}
                        data-trigger="new-stock"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Nova Entrada</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            {activeTab === 'current' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={exportCurrentStocksToExcel}
                      disabled={sortedCurrentStocks.length === 0}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar para Excel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {activeTab === 'palettes' && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10"
                        onClick={exportPaletesToExcel}
                        disabled={sortedPaletes.length === 0}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Exportar para Excel</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => {
                          setShowNewPaleteRow(true)
                          setNewPaleteData({
                            no_palete: '',
                            fornecedor_id: '',
                            no_guia_forn: '',
                            ref_cartao: '',
                            qt_palete: '',
                            data: new Date().toISOString().split('T')[0],
                            author_id: '',
                          })
                        }}
                        disabled={showNewPaleteRow || editingPaleteId !== null}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Nova Palete</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="entries">Entradas de Stock</TabsTrigger>
            <TabsTrigger value="current">Stock Atual</TabsTrigger>
            <TabsTrigger value="palettes">Gestão de Palettes</TabsTrigger>
            <TabsTrigger value="analytics">Análise & Gráficos</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="space-y-4">
            {/* Success Summary */}
            {lastSavesSummary && (
              <Card className="mb-4 border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-green-900 mb-2">
                        ✅ Entradas Criadas com Sucesso!
                      </h3>
                      <div className="text-sm text-green-800 space-y-1">
                        <p>
                          • {lastSavesSummary.count} entradas de stock
                        </p>
                        <p>
                          • Paletes: {lastSavesSummary.paletes.join(', ')}
                        </p>
                        <p>• Total: {lastSavesSummary.total} unidades</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLastSavesSummary(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Inline Stock Input */}
            <div className="mb-4">
              {!showInlineInput ? (
                <Button
                  onClick={handleShowInlineInput}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Stock (Modo Rápido)
                </Button>
              ) : (
                <Card className="mb-4">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">
                        Entrada Rápida de Stock
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => triggerEtlSync('today_bo_bi')}
                          disabled={etlSyncing !== null}
                          className="text-xs"
                        >
                          {etlSyncing === 'bo_bi' ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Sincronizando...
                            </>
                          ) : (
                            <>
                              <RotateCw className="h-3 w-3 mr-1" />
                              Atualizar NE
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => triggerEtlSync('today_fl')}
                          disabled={etlSyncing !== null}
                          className="text-xs"
                        >
                          {etlSyncing === 'fl' ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Sincronizando...
                            </>
                          ) : (
                            <>
                              <RotateCw className="h-3 w-3 mr-1" />
                              LSO
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowInlineInput(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {etlMessage && (
                      <p className="text-xs text-green-600 mt-2">{etlMessage}</p>
                    )}
                    {etlError && (
                      <p className="text-xs text-red-600 mt-2">{etlError}</p>
                    )}
                  </CardHeader>
                  <CardContent className="p-3 border-b">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs font-medium mb-1 block">
                          NE (Encomenda a Fornecedor)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            ref={neInputRef}
                            placeholder="Digite o número da NE"
                            value={neNumber}
                            onChange={(e) => setNeNumber(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                              }
                            }}
                            disabled={neFetching}
                            className="flex-1"
                          />
                          <Button
                            onClick={() => fetchNEData(neNumber)}
                            disabled={neFetching || !neNumber.trim()}
                            size="sm"
                          >
                            {neFetching ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Carregando...
                              </>
                            ) : (
                              'Importar'
                            )}
                          </Button>
                        </div>
                        {neError && (
                          <p className="text-xs text-red-500 mt-1">{neError}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {inlineEntries.map((entry, index) => (
                          <React.Fragment key={entry.id}>
                            <TableRow className="border-b-0">
                              <TableCell className="w-[140px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  Referência
                                </div>
                                <ReferenceCombobox
                                  value={entry.referencia}
                                  onSelect={(ref, material) =>
                                    handleReferenciaSelect(index, ref, material)
                                  }
                                />
                              </TableCell>
                              <TableCell className="min-w-[400px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  Material
                                </div>
                                <MaterialCombobox
                                  value={entry.material_id}
                                  onSelect={(material) =>
                                    handleMaterialSelect(index, material)
                                  }
                                />
                              </TableCell>
                              <TableCell className="w-[120px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  QTD UNIT.
                                </div>
                                <InlineEditField
                                  id={`${entry.id}-quantidade`}
                                  type="numeric"
                                  defaultValue={entry.quantidade || ''}
                                  onChange={(value) =>
                                    updateEntry(index, 'quantidade', value)
                                  }
                                  maxLength={6}
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell className="w-[120px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  SIZE X
                                </div>
                                <InlineEditField
                                  id={`${entry.id}-size_x`}
                                  type="numeric"
                                  defaultValue={entry.size_x || ''}
                                  onChange={(value) =>
                                    updateEntry(index, 'size_x', value)
                                  }
                                  maxLength={5}
                                  placeholder="3000"
                                />
                              </TableCell>
                              <TableCell className="w-[120px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  SIZE Y
                                </div>
                                <InlineEditField
                                  id={`${entry.id}-size_y`}
                                  type="numeric"
                                  defaultValue={entry.size_y || ''}
                                  onChange={(value) =>
                                    updateEntry(index, 'size_y', value)
                                  }
                                  maxLength={5}
                                  placeholder="2000"
                                />
                              </TableCell>
                              <TableCell className="w-[120px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  PREÇO UNIT.
                                </div>
                                <input
                                  key={`${entry.id}-preco_unitario`}
                                  type="text"
                                  inputMode="decimal"
                                  defaultValue={
                                    entry.preco_unitario
                                      ? entry.preco_unitario.toFixed(2)
                                      : ''
                                  }
                                  onFocus={(e) => {
                                    if (!entry.quantidade || entry.quantidade <= 0) {
                                      e.preventDefault()
                                      e.target.blur()
                                      alert('Tem que introduzir a quantidade primeiro')
                                    }
                                  }}
                                  onChange={(e) => {
                                    if (entry.quantidade > 0) {
                                      const val = parseFloat(e.target.value) || 0
                                      const valorTotal = val * entry.quantidade
                                      setInlineEntries((prev) =>
                                        prev.map((ent, i) =>
                                          i === index
                                            ? {
                                                ...ent,
                                                preco_unitario: val,
                                                valor_total: valorTotal,
                                              }
                                            : ent,
                                        ),
                                      )
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      e.currentTarget.blur()
                                    }
                                  }}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="w-[150px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  VL TOT.
                                </div>
                                <input
                                  key={`${entry.id}-valor_total`}
                                  type="text"
                                  inputMode="decimal"
                                  defaultValue={
                                    entry.valor_total
                                      ? entry.valor_total.toFixed(2)
                                      : ''
                                  }
                                  onFocus={(e) => {
                                    if (!entry.quantidade || entry.quantidade <= 0) {
                                      e.preventDefault()
                                      e.target.blur()
                                      alert('Tem que introduzir a quantidade primeiro')
                                    }
                                  }}
                                  onChange={(e) => {
                                    if (entry.quantidade > 0) {
                                      const val = parseFloat(e.target.value) || 0
                                      const precoUnit = val / entry.quantidade
                                      setInlineEntries((prev) =>
                                        prev.map((ent, i) =>
                                          i === index
                                            ? {
                                                ...ent,
                                                valor_total: val,
                                                preco_unitario: precoUnit,
                                              }
                                            : ent,
                                        ),
                                      )
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      e.currentTarget.blur()
                                    }
                                  }}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="w-[100px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  Ações
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      const result = await handleSaveEntry(index)
                                      if (result) {
                                        removeEntry(index)
                                        fetchStocks()
                                        fetchPaletes()
                                        if (inlineEntries.length === 1) {
                                          addNewRow()
                                        }
                                      }
                                    }}
                                    disabled={
                                      !entry.material_id ||
                                      entry.quantidade <= 0 ||
                                      entry.isSaving
                                    }
                                  >
                                    {entry.isSaving ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeEntry(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            <TableRow className="border-t-0">
                              <TableCell className="pt-0 min-w-[400px]" colSpan={2}>
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  REF PAL (OPCIONAL)
                                </div>
                                <InlineEditField
                                  id={`${entry.id}-no_palete-row2`}
                                  defaultValue={entry.no_palete || ''}
                                  onChange={(value) =>
                                    updateEntry(index, 'no_palete', value)
                                  }
                                  maxLength={50}
                                  placeholder="P100 ou P100,P101,P102 (Opcional)"
                                />
                              </TableCell>
                              <TableCell className="pt-0 w-[120px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  NºPAL
                                </div>
                                <InlineEditField
                                  id={`${entry.id}-num_paletes-row2`}
                                  type="numeric"
                                  defaultValue={entry.num_paletes || 1}
                                  onChange={(value) =>
                                    updateEntry(index, 'num_paletes', value)
                                  }
                                  maxLength={3}
                                />
                              </TableCell>
                              <TableCell className="pt-0 w-[150px]">
                                <div className="text-xs text-muted-foreground font-medium mb-1">
                                  Nº Guia
                                </div>
                                <InlineEditField
                                  id={`${entry.id}-no_guia_forn-row2`}
                                  defaultValue={entry.no_guia_forn || ''}
                                  onChange={(value) =>
                                    updateEntry(index, 'no_guia_forn', value)
                                  }
                                  maxLength={20}
                                  placeholder="Opcional"
                                />
                              </TableCell>
                              <TableCell className="pt-0" colSpan={4}></TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="p-2 border-t space-y-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={addNewRow}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Linha (Ctrl+N)
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveAll}
                          disabled={
                            isSavingBatch ||
                            inlineEntries.filter(
                              (e) => e.material_id && e.quantidade > 0,
                            ).length === 0
                          }
                          className="flex-1"
                        >
                          {isSavingBatch ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              A guardar...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Guardar Tudo (
                              {
                                inlineEntries.filter(
                                  (e) => e.material_id && e.quantidade > 0,
                                ).length
                              }{' '}
                              entradas)
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="w-full">
              <div className="w-full">
                <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortEntries('data')}
                      >
                        Data
                        {sortColumnEntries === 'data' &&
                          (sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortEntries('referencia')}
                      >
                        Referência
                        {sortColumnEntries === 'referencia' &&
                          (sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 cursor-pointer border-b select-none"
                        onClick={() => handleSortEntries('material')}
                      >
                        Material
                        {sortColumnEntries === 'material' &&
                          (sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[150px] cursor-pointer border-b select-none"
                        onClick={() => handleSortEntries('fornecedor')}
                      >
                        Fornecedor
                        {sortColumnEntries === 'fornecedor' &&
                          (sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortEntries('quantidade')}
                      >
                        Quantidade
                        {sortColumnEntries === 'quantidade' &&
                          (sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[100px] cursor-pointer border-b select-none"
                        onClick={() => handleSortEntries('vl_m2')}
                      >
                        VL_m2
                        {sortColumnEntries === 'vl_m2' &&
                          (sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortEntries('preco_unitario')}
                      >
                        Preço/Unidade
                        {sortColumnEntries === 'preco_unitario' &&
                          (sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortEntries('valor_total')}
                      >
                        Valor Total
                        {sortColumnEntries === 'valor_total' &&
                          (sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[100px] cursor-pointer border-b select-none"
                        onClick={() => handleSortEntries('n_palet')}
                      >
                        Palete
                        {sortColumnEntries === 'n_palet' &&
                          (sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[90px] border-b text-center">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedStocks.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="text-center text-gray-500"
                        >
                          Nenhuma entrada de stock encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedStocks.map((stock) => {
                        const isEditing = editingStock?.id === stock.id

                        if (isEditing) {
                          // Inline edit mode - similar to quick entry form
                          return (
                            <React.Fragment key={stock.id}>
                              <TableRow className="border-b-0" style={{ backgroundColor: '#fdfbf2' }}>
                                <TableCell className="text-xs text-muted-foreground font-medium">Data</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium">Referência</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium">Material</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium">QTD UNIT.</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium">SIZE X</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium">SIZE Y</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium">PREÇO UNIT.</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium">VL TOT.</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium" colSpan={2}>Ações</TableCell>
                              </TableRow>
                              <TableRow className="border-b-0" style={{ backgroundColor: '#fdfbf2' }}>
                                <TableCell>
                                  {new Date(stock.data).toLocaleDateString('pt-PT')}
                                </TableCell>
                                <TableCell>
                                  {stock.materiais?.referencia || '-'}
                                </TableCell>
                                <TableCell>
                                  {formatMaterialName(stock.materiais)}
                                </TableCell>
                                <TableCell>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={editingStock?.quantidade || ''}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9]/g, '')
                                      setEditingStock(prev => prev ? { ...prev, quantidade: parseInt(val) || 0 } : null)
                                    }}
                                    className="w-full h-8 px-2 text-sm border rounded"
                                  />
                                </TableCell>
                                <TableCell>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={(editingStock as any)?.size_x || ''}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9]/g, '')
                                      setEditingStock(prev => prev ? { ...prev, size_x: parseInt(val) || 0 } as any : null)
                                    }}
                                    className="w-full h-8 px-2 text-sm border rounded"
                                  />
                                </TableCell>
                                <TableCell>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={(editingStock as any)?.size_y || ''}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9]/g, '')
                                      setEditingStock(prev => prev ? { ...prev, size_y: parseInt(val) || 0 } as any : null)
                                    }}
                                    className="w-full h-8 px-2 text-sm border rounded"
                                  />
                                </TableCell>
                                <TableCell>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={editingStock?.preco_unitario?.toFixed(2) || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0
                                      const valorTotal = val * (editingStock?.quantidade || 0)
                                      setEditingStock(prev => prev ? { ...prev, preco_unitario: val, valor_total: valorTotal } : null)
                                    }}
                                    className="w-full h-8 px-2 text-sm border rounded"
                                  />
                                </TableCell>
                                <TableCell>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={editingStock?.valor_total?.toFixed(2) || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0
                                      const precoUnit = val / (editingStock?.quantidade || 1)
                                      setEditingStock(prev => prev ? { ...prev, valor_total: val, preco_unitario: precoUnit } : null)
                                    }}
                                    className="w-full h-8 px-2 text-sm border rounded"
                                  />
                                </TableCell>
                                <TableCell colSpan={2}>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveInlineEdit(stock.id)}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelInlineEdit}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow style={{ backgroundColor: '#fdfbf2' }}>
                                <TableCell className="text-xs text-muted-foreground font-medium pt-0" colSpan={3}>REF PAL (OPCIONAL)</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium pt-0">NºPAL</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-medium pt-0" colSpan={6}>Nº GUIA</TableCell>
                              </TableRow>
                              <TableRow style={{ backgroundColor: '#fdfbf2' }}>
                                <TableCell className="pt-0" colSpan={3}>
                                  <input
                                    type="text"
                                    value={editingStock?.n_palet || ''}
                                    onChange={(e) => {
                                      setEditingStock(prev => prev ? { ...prev, n_palet: e.target.value } : null)
                                    }}
                                    className="w-full h-8 px-2 text-sm border rounded"
                                    placeholder="P100 ou P100,P101,P102 (Opcional)"
                                  />
                                </TableCell>
                                <TableCell className="pt-0">
                                  <div className="text-sm">{editingStock?.n_palet?.split(',').length || 0}</div>
                                </TableCell>
                                <TableCell className="pt-0" colSpan={6}>
                                  <input
                                    type="text"
                                    value={editingStock?.no_guia_forn || ''}
                                    onChange={(e) => {
                                      setEditingStock(prev => prev ? { ...prev, no_guia_forn: e.target.value } : null)
                                    }}
                                    className="w-full h-8 px-2 text-sm border rounded"
                                    placeholder="Opcional"
                                  />
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          )
                        }

                        // Normal view mode
                        return (
                          <TableRow key={stock.id} className="hover:bg-accent">
                            <TableCell>
                              {new Date(stock.data).toLocaleDateString('pt-PT')}
                            </TableCell>
                            <TableCell>
                              {stock.materiais?.referencia || '-'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatMaterialName(stock.materiais)}
                            </TableCell>
                            <TableCell>
                              {stock.fornecedores?.nome_forn || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {stock.quantidade}
                            </TableCell>
                            <TableCell className="text-right">
                              {(stock as any).vl_m2 || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPrice(stock.preco_unitario)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPrice(stock.valor_total)}
                            </TableCell>
                            <TableCell className="text-right">
                              {stock.n_palet || '-'}
                            </TableCell>
                            <TableCell className="flex justify-center gap-2">
                              <Button
                                variant="default"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => handleEdit(stock)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => handleDelete(stock.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="current" className="space-y-4">
            <div className="w-full">
              <div className="w-full">
                <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortCurrent('referencia')}
                      >
                        Referência
                        {sortColumnCurrent === 'referencia' &&
                          (sortDirectionCurrent === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 cursor-pointer border-b select-none"
                        onClick={() => handleSortCurrent('material')}
                      >
                        Material
                        {sortColumnCurrent === 'material' &&
                          (sortDirectionCurrent === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[150px] cursor-pointer border-b select-none"
                        onClick={() => handleSortCurrent('total_recebido')}
                      >
                        Total Recebido
                        {sortColumnCurrent === 'total_recebido' &&
                          (sortDirectionCurrent === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[150px] cursor-pointer border-b select-none"
                        onClick={() => handleSortCurrent('total_consumido')}
                      >
                        Total Consumido
                        {sortColumnCurrent === 'total_consumido' &&
                          (sortDirectionCurrent === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortCurrent('stock_minimo')}
                      >
                        Mín (Amarelo)
                        {sortColumnCurrent === 'stock_minimo' &&
                          (sortDirectionCurrent === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortCurrent('stock_critico')}
                      >
                        Crítico (Vermelho)
                        {sortColumnCurrent === 'stock_critico' &&
                          (sortDirectionCurrent === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortCurrent('stock_correct')}
                      >
                        CORREÇÃO MENSAL
                        {sortColumnCurrent === 'stock_correct' &&
                          (sortDirectionCurrent === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortCurrent('stock_atual')}
                      >
                        STOCK FINAL
                        {sortColumnCurrent === 'stock_atual' &&
                          (sortDirectionCurrent === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[60px] border-b text-center">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCurrentStocks.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center text-gray-500"
                        >
                          Nenhum material encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedCurrentStocks.map((stock) => (
                        <TableRow
                          key={stock.id}
                          className="hover:bg-accent"
                        >
                          <TableCell>
                            {getReferenciaByMaterialId(stock.id)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrentStockMaterialName(stock)}
                          </TableCell>
                          <TableCell className="text-right">
                            {Math.round(stock.total_recebido)}
                          </TableCell>
                          <TableCell className="text-right">
                            {Math.round(stock.total_consumido)}
                          </TableCell>
                          <TableCell>
                            <StockInputField
                              value={
                                stockMinimoValueMap[stock.id] ??
                                (stock.stock_minimo !== null &&
                                stock.stock_minimo !== undefined
                                  ? stock.stock_minimo.toString()
                                  : '')
                              }
                              onChange={(value) =>
                                setStockMinimoValueMap((prev) => ({
                                  ...prev,
                                  [stock.id]: value,
                                }))
                              }
                              onBlur={() =>
                                handleSaveStockMinimo(stock.id)
                              }
                              type="number"
                              placeholder="0"
                              className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </TableCell>
                          <TableCell>
                            <StockInputField
                              value={
                                stockCriticoValueMap[stock.id] ??
                                (stock.stock_critico !== null &&
                                stock.stock_critico !== undefined
                                  ? stock.stock_critico.toString()
                                  : '')
                              }
                              onChange={(value) =>
                                setStockCriticoValueMap((prev) => ({
                                  ...prev,
                                  [stock.id]: value,
                                }))
                              }
                              onBlur={() =>
                                handleSaveStockCritico(stock.id)
                              }
                              type="number"
                              placeholder="0"
                              className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </TableCell>
                          <TableCell>
                            <StockInputField
                              value={
                                stockCorrectValueMap[stock.id] ??
                                (stock.stock_correct !== null &&
                                stock.stock_correct !== undefined
                                  ? stock.stock_correct.toString()
                                  : '')
                              }
                              onChange={(value) =>
                                setStockCorrectValueMap((prev) => ({
                                  ...prev,
                                  [stock.id]: value,
                                }))
                              }
                              onBlur={() =>
                                handleSaveStockCorrect(stock.id)
                              }
                              type="number"
                              placeholder="0"
                              className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {Math.round(
                              stock.stock_correct !== null &&
                              stock.stock_correct !== undefined
                                ? stock.stock_correct
                                : stock.stock_atual,
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={getStockStatusColor(
                                stock.stock_correct !== null &&
                                stock.stock_correct !== undefined
                                  ? stock.stock_correct
                                  : stock.stock_atual,
                                stock.stock_critico,
                                stock.stock_minimo,
                              )}
                            >
                              {getStockStatusText(
                                stock.stock_correct !== null &&
                                stock.stock_correct !== undefined
                                  ? stock.stock_correct
                                  : stock.stock_atual,
                                stock.stock_critico,
                                stock.stock_minimo,
                              )}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="palettes" className="space-y-4">
            <div className="w-full">
              {showNewPaleteRow && (
                <div className="mb-4 border p-4">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                    <StockInputField
                      placeholder="Nº Palete"
                      value={newPaleteData.no_palete}
                      onChange={(value) =>
                        setNewPaleteData((prev) => ({
                          ...prev,
                          no_palete: value,
                        }))
                      }
                      defaultValue={getNextPaleteNumber()}
                    />
                    <Select
                      value={newPaleteData.fornecedor_id}
                      onValueChange={(value) =>
                        setNewPaleteData((prev) => ({
                          ...prev,
                          fornecedor_id: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {fornecedores.map((forn) => (
                          <SelectItem key={forn.id} value={forn.id}>
                            {forn.nome_forn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <StockInputField
                      placeholder="Nº Guia"
                      value={newPaleteData.no_guia_forn}
                      onChange={(value) =>
                        setNewPaleteData((prev) => ({
                          ...prev,
                          no_guia_forn: value,
                        }))
                      }
                      maxLength={20}
                    />
                    <StockInputField
                      placeholder="Ref. Cartão"
                      value={newPaleteData.ref_cartao}
                      onChange={(value) =>
                        setNewPaleteData((prev) => ({
                          ...prev,
                          ref_cartao: value,
                        }))
                      }
                      maxLength={30}
                    />
                    <StockInputField
                      placeholder="Qt. Palete"
                      type="number"
                      value={newPaleteData.qt_palete}
                      onChange={(value) =>
                        setNewPaleteData((prev) => ({
                          ...prev,
                          qt_palete: value,
                        }))
                      }
                      maxLength={6}
                      max={999999}
                    />
                    <StockInputField
                      type="date"
                      value={newPaleteData.data}
                      onChange={(value) =>
                        setNewPaleteData((prev) => ({
                          ...prev,
                          data: value,
                        }))
                      }
                    />
                    <Select
                      value={newPaleteData.author_id}
                      onValueChange={(value) =>
                        setNewPaleteData((prev) => ({
                          ...prev,
                          author_id: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Autor" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.first_name} {profile.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleSaveNewPalete}
                      disabled={submittingPalete}
                      className="h-10"
                    >
                      Guardar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelNewPalete}
                      className="h-10"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              <div className="w-full">
                <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="sticky top-0 z-10 cursor-pointer border-b select-none"
                        onClick={() => handleSortPaletes('no_palete')}
                      >
                        Nº Palete
                        {sortColumnPaletes === 'no_palete' &&
                          (sortDirectionPaletes === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 cursor-pointer border-b select-none"
                        onClick={() => handleSortPaletes('fornecedor')}
                      >
                        Fornecedor
                        {sortColumnPaletes === 'fornecedor' &&
                          (sortDirectionPaletes === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 cursor-pointer border-b select-none"
                        onClick={() => handleSortPaletes('no_guia_forn')}
                      >
                        Nº Guia
                        {sortColumnPaletes === 'no_guia_forn' &&
                          (sortDirectionPaletes === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 cursor-pointer border-b select-none"
                        onClick={() => handleSortPaletes('ref_cartao')}
                      >
                        Ref. Cartão
                        {sortColumnPaletes === 'ref_cartao' &&
                          (sortDirectionPaletes === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[100px] cursor-pointer border-b select-none"
                        onClick={() => handleSortPaletes('qt_palete')}
                      >
                        Qt. Palete
                        {sortColumnPaletes === 'qt_palete' &&
                          (sortDirectionPaletes === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 w-[120px] cursor-pointer border-b select-none"
                        onClick={() => handleSortPaletes('data')}
                      >
                        Data
                        {sortColumnPaletes === 'data' &&
                          (sortDirectionPaletes === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead
                        className="sticky top-0 z-10 cursor-pointer border-b select-none"
                        onClick={() => handleSortPaletes('author')}
                      >
                        Autor
                        {sortColumnPaletes === 'author' &&
                          (sortDirectionPaletes === 'asc' ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          ))}
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 w-[100px] border-b text-center">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPaletes.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-gray-500"
                        >
                          Nenhuma palete encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedPaletes.map((palete) => (
                        <TableRow
                          key={palete.id}
                          className="hover:bg-accent"
                        >
                          <TableCell>
                            {editingPaleteId === palete.id ? (
                              <Input
                                value={
                                  editingPaleteData[palete.id]?.no_palete || ''
                                }
                                onChange={(e) =>
                                  setEditingPaleteData((prev) => ({
                                    ...prev,
                                    [palete.id]: {
                                      ...prev[palete.id],
                                      no_palete: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8"
                              />
                            ) : (
                              palete.no_palete
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPaleteId === palete.id ? (
                              <Select
                                value={
                                  editingPaleteData[palete.id]
                                    ?.fornecedor_id || ''
                                }
                                onValueChange={(value) =>
                                  setEditingPaleteData((prev) => ({
                                    ...prev,
                                    [palete.id]: {
                                      ...prev[palete.id],
                                      fornecedor_id: value,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {fornecedores.map((forn) => (
                                    <SelectItem
                                      key={forn.id}
                                      value={forn.id}
                                    >
                                      {forn.nome_forn}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              palete.fornecedores?.nome_forn
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPaleteId === palete.id ? (
                              <Input
                                value={
                                  editingPaleteData[palete.id]
                                    ?.no_guia_forn || ''
                                }
                                onChange={(e) =>
                                  setEditingPaleteData((prev) => ({
                                    ...prev,
                                    [palete.id]: {
                                      ...prev[palete.id],
                                      no_guia_forn: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8"
                              />
                            ) : (
                              palete.no_guia_forn
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPaleteId === palete.id ? (
                              <Input
                                value={
                                  editingPaleteData[palete.id]?.ref_cartao ||
                                  ''
                                }
                                onChange={(e) =>
                                  setEditingPaleteData((prev) => ({
                                    ...prev,
                                    [palete.id]: {
                                      ...prev[palete.id],
                                      ref_cartao: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8"
                              />
                            ) : (
                              palete.ref_cartao
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPaleteId === palete.id ? (
                              <StockInputField
                                type="number"
                                value={
                                  editingPaleteData[palete.id]?.qt_palete || ''
                                }
                                onChange={(value) =>
                                  setEditingPaleteData((prev) => ({
                                    ...prev,
                                    [palete.id]: {
                                      ...prev[palete.id],
                                      qt_palete: value,
                                    },
                                  }))
                                }
                                className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            ) : (
                              palete.qt_palete
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPaleteId === palete.id ? (
                              <StockInputField
                                type="date"
                                value={
                                  editingPaleteData[palete.id]?.data || ''
                                }
                                onChange={(value) =>
                                  setEditingPaleteData((prev) => ({
                                    ...prev,
                                    [palete.id]: {
                                      ...prev[palete.id],
                                      data: value,
                                    },
                                  }))
                                }
                                className="h-8"
                              />
                            ) : (
                              new Date(palete.data).toLocaleDateString(
                                'pt-PT',
                              )
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPaleteId === palete.id ? (
                              <Select
                                value={
                                  editingPaleteData[palete.id]?.author_id || ''
                                }
                                onValueChange={(value) =>
                                  setEditingPaleteData((prev) => ({
                                    ...prev,
                                    [palete.id]: {
                                      ...prev[palete.id],
                                      author_id: value,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {profiles.map((profile) => (
                                    <SelectItem
                                      key={profile.id}
                                      value={profile.id}
                                    >
                                      {profile.first_name}{' '}
                                      {profile.last_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              palete.profiles
                                ? `${palete.profiles.first_name} ${palete.profiles.last_name}`
                                : '-'
                            )}
                          </TableCell>
                          <TableCell className="flex justify-center gap-2">
                            {editingPaleteId === palete.id ? (
                              <>
                                <Button
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    handleSaveEditPalete(palete.id)
                                  }
                                  disabled={submittingPalete}
                                >
                                  OK
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={handleCancelEditPalete}
                                >
                                  X
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="default"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    handleEditPalete(palete)
                                  }
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    handleDeletePalete(palete.id)
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <StockAnalyticsCharts
              currentStocks={currentStocks}
              onRefresh={refreshCurrentStocks}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}

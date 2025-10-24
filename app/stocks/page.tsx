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
  DrawerClose,
  DrawerDescription,
} from '@/components/ui/drawer'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Plus,
  Eye,
  Trash2,
  X,
  Loader2,
  Edit,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Download,
  XSquare,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { useDebounce } from '@/hooks/useDebounce'

// Types
interface Material {
  id: string
  material: string | null
  cor: string | null
  tipo: string | null
  carateristica: string | null
  fornecedor_id: string | null
  stock_minimo: number | null
  stock_critico: number | null
  referencia: string | null
}

interface Fornecedor {
  id: string
  nome_forn: string
}

interface StockEntry {
  id: string
  material_id: string
  quantidade: number
  vl_m2?: number | null
  preco_unitario?: number | null
  valor_total?: number | null
  n_palet?: string | null
  no_guia_forn?: string | null
  notas?: string | null
  data: string
  fornecedor_id?: string | null
  created_at: string
  updated_at: string
  materiais?: Material
  fornecedores?: Fornecedor
}

interface CurrentStock {
  id: string
  material: string | null
  cor: string | null
  tipo: string | null
  carateristica: string | null
  total_recebido: number
  total_consumido: number
  stock_atual: number
  stock_minimo: number | null
  stock_critico: number | null
  referencia?: string | null
}

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
  fornecedores?: Fornecedor | null
  profiles?: { id: string; first_name: string; last_name: string } | null
}

export default function StocksPage() {
  const supabase = createBrowserClient()

  // State management
  const [activeTab, setActiveTab] = useState('entries')
  const [stocks, setStocks] = useState<StockEntry[]>([])
  const [currentStocks, setCurrentStocks] = useState<CurrentStock[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [paletes, setPaletes] = useState<Palete[]>([])
  
  const [loading, setLoading] = useState(true)
  const [currentStocksLoading, setCurrentStocksLoading] = useState(true)
  const [paletesLoading, setPaletesLoading] = useState(true)
  
  const [openDrawer, setOpenDrawer] = useState(false)
  const [editingStock, setEditingStock] = useState<StockEntry | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Filter states
  const [materialFilter, setMaterialFilter] = useState('')
  const [referenciaFilter, setReferenciaFilter] = useState('')
  const [currentStockFilter, setCurrentStockFilter] = useState('')
  const [paletesFilter, setPaletesFilter] = useState('')

  // Debounced filter values
  const debouncedMaterialFilter = useDebounce(materialFilter, 300)
  const debouncedReferenciaFilter = useDebounce(referenciaFilter, 300)
  const debouncedCurrentStockFilter = useDebounce(currentStockFilter, 300)
  const debouncedPaletesFilter = useDebounce(paletesFilter, 300)

  // Sorting states
  const [sortColumnEntries, setSortColumnEntries] = useState('data')
  const [sortDirectionEntries, setSortDirectionEntries] = useState<'asc' | 'desc'>('desc')
  const [sortColumnCurrent, setSortColumnCurrent] = useState('material')
  const [sortDirectionCurrent, setSortDirectionCurrent] = useState<'asc' | 'desc'>('asc')

  // Pagination states
  const [currentEntriesPage, setCurrentEntriesPage] = useState(1)
  const [currentStocksPage, setCurrentStocksPage] = useState(1)
  const [currentPaletesPage, setCurrentPaletesPage] = useState(1)
  const ITEMS_PER_PAGE = 40

  // Form state
  const [formData, setFormData] = useState({
    material_id: '',
    fornecedor_id: '',
    quantidade: '',
    vl_m2: '',
    preco_unitario: '',
    valor_total: '',
    n_palet: '',
    no_guia_forn: '',
    notas: '',
    data: new Date().toISOString().split('T')[0],
  })

  // Data fetching
  const fetchStocks = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select(`
          *,
          materiais(id, material, cor, tipo, carateristica, referencia),
          fornecedores(id, nome_forn)
        `)
        .order('data', { ascending: false })

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
        .select('id, material, cor, tipo, carateristica, fornecedor_id, stock_minimo, stock_critico, referencia')
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

  const fetchCurrentStocks = useCallback(async () => {
    setCurrentStocksLoading(true)
    try {
      const { data: materialsData, error } = await supabase
        .from('materiais')
        .select('id, material, cor, tipo, carateristica, stock_minimo, stock_critico, referencia')

      if (error) throw error

      const currentStocksData: CurrentStock[] = []
      
      for (const material of materialsData || []) {
        const { data: stocksData } = await supabase
          .from('stocks')
          .select('quantidade')
          .eq('material_id', material.id)

        const totalRecebido =
          stocksData?.reduce((sum, stock) => sum + (stock.quantidade || 0), 0) || 0

        currentStocksData.push({
          id: material.id,
          material: material.material,
          cor: material.cor,
          tipo: material.tipo,
          carateristica: material.carateristica,
          total_recebido: totalRecebido,
          total_consumido: 0,
          stock_atual: totalRecebido,
          stock_minimo: material.stock_minimo,
          stock_critico: material.stock_critico,
          referencia: material.referencia,
        })
      }

      setCurrentStocks(currentStocksData)
    } catch (error) {
      console.error('Error fetching current stocks:', error)
    } finally {
      setCurrentStocksLoading(false)
    }
  }, [supabase])

  const fetchPaletes = useCallback(async () => {
    setPaletesLoading(true)
    try {
      const { data, error } = await supabase
        .from('paletes')
        .select(`
          *,
          fornecedores(id, nome_forn),
          profiles(id, first_name, last_name)
        `)
        .order('no_palete', { ascending: false })

      if (!error && data) {
        setPaletes(data)
      }
    } catch (error) {
      console.error('Error fetching paletes:', error)
    } finally {
      setPaletesLoading(false)
    }
  }, [supabase])

  // Initial load
  useEffect(() => {
    fetchStocks()
    fetchMaterials()
    fetchFornecedores()
    fetchCurrentStocks()
    fetchPaletes()
  }, [fetchStocks, fetchMaterials, fetchFornecedores, fetchCurrentStocks, fetchPaletes])

  // Handle save stock entry
  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.material_id || !formData.data) {
      alert('Por favor, preencha os campos obrigatórios')
      return
    }

    setSubmitting(true)
    try {
      if (editingStock) {
        // Update
        const { error } = await supabase
          .from('stocks')
          .update({
            material_id: formData.material_id,
            quantidade: parseInt(formData.quantidade),
            vl_m2: formData.vl_m2 ? parseFloat(formData.vl_m2) : null,
            preco_unitario: formData.preco_unitario ? parseFloat(formData.preco_unitario) : null,
            valor_total: formData.valor_total ? parseFloat(formData.valor_total) : null,
            n_palet: formData.n_palet || null,
            no_guia_forn: formData.no_guia_forn || null,
            notas: formData.notas || null,
            data: formData.data,
          })
          .eq('id', editingStock.id)

        if (error) throw error

        await fetchStocks()
      } else {
        // Create
        const { error } = await supabase
          .from('stocks')
          .insert({
            material_id: formData.material_id,
            quantidade: parseInt(formData.quantidade),
            vl_m2: formData.vl_m2 ? parseFloat(formData.vl_m2) : null,
            preco_unitario: formData.preco_unitario ? parseFloat(formData.preco_unitario) : null,
            valor_total: formData.valor_total ? parseFloat(formData.valor_total) : null,
            n_palet: formData.n_palet || null,
            no_guia_forn: formData.no_guia_forn || null,
            notas: formData.notas || null,
            data: formData.data,
          })

        if (error) throw error

        await fetchStocks()
      }

      setOpenDrawer(false)
      resetForm()
    } catch (error) {
      console.error('Error saving stock:', error)
      alert(`Erro ao guardar: ${error}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle delete stock entry
  const handleDeleteStock = async (id: string) => {
    if (!confirm('Tem certeza que quer eliminar?')) return

    try {
      const { error } = await supabase.from('stocks').delete().eq('id', id)

      if (error) throw error

      await fetchStocks()
    } catch (error) {
      console.error('Error deleting stock:', error)
      alert(`Erro ao eliminar: ${error}`)
    }
  }

  // Handle edit stock entry
  const handleEdit = (stock: StockEntry) => {
    setEditingStock(stock)
    setFormData({
      material_id: stock.material_id,
      fornecedor_id: stock.fornecedor_id || '',
      quantidade: stock.quantidade.toString(),
      vl_m2: stock.vl_m2?.toString() || '',
      preco_unitario: stock.preco_unitario?.toString() || '',
      valor_total: stock.valor_total?.toString() || '',
      n_palet: stock.n_palet || '',
      no_guia_forn: stock.no_guia_forn || '',
      notas: stock.notas || '',
      data: stock.data,
    })
    setOpenDrawer(true)
  }

  // Reset form
  const resetForm = () => {
    setEditingStock(null)
    setFormData({
      material_id: '',
      fornecedor_id: '',
      quantidade: '',
      vl_m2: '',
      preco_unitario: '',
      valor_total: '',
      n_palet: '',
      no_guia_forn: '',
      notas: '',
      data: new Date().toISOString().split('T')[0],
    })
  }

  // Format material name
  const formatMaterialName = (material: Material | undefined) => {
    if (!material) return '-'
    return [material.material, material.cor, material.tipo, material.carateristica]
      .filter(Boolean)
      .join(' - ')
  }

  // Filtered and sorted data
  const filteredStocks = useMemo(() => {
    let filtered = stocks

    if (debouncedMaterialFilter) {
      filtered = filtered.filter((s) =>
        formatMaterialName(s.materiais).toLowerCase().includes(debouncedMaterialFilter.toLowerCase())
      )
    }

    if (debouncedReferenciaFilter) {
      filtered = filtered.filter((s) =>
        s.materiais?.referencia?.toLowerCase().includes(debouncedReferenciaFilter.toLowerCase())
      )
    }

    return filtered
  }, [stocks, debouncedMaterialFilter, debouncedReferenciaFilter])

  const sortedStocks = useMemo(() => {
    let sorted = [...filteredStocks]

    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any

      if (sortColumnEntries === 'data') {
        aValue = new Date(a.data).getTime()
        bValue = new Date(b.data).getTime()
      } else if (sortColumnEntries === 'material') {
        aValue = formatMaterialName(a.materiais)
        bValue = formatMaterialName(b.materiais)
      } else if (sortColumnEntries === 'quantidade') {
        aValue = a.quantidade
        bValue = b.quantidade
      }

      if (aValue < bValue) return sortDirectionEntries === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirectionEntries === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [filteredStocks, sortColumnEntries, sortDirectionEntries])

  const filteredCurrentStocks = useMemo(() => {
    let filtered = currentStocks

    if (debouncedCurrentStockFilter) {
      filtered = filtered.filter((s) => {
        const name = [s.material, s.cor, s.tipo, s.carateristica]
          .filter(Boolean)
          .join(' - ')
          .toLowerCase()
        return name.includes(debouncedCurrentStockFilter.toLowerCase())
      })
    }

    return filtered
  }, [currentStocks, debouncedCurrentStockFilter])

  const sortedCurrentStocks = useMemo(() => {
    let sorted = [...filteredCurrentStocks]

    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any

      if (sortColumnCurrent === 'material') {
        aValue = [a.material, a.cor, a.tipo, a.carateristica].filter(Boolean).join(' - ')
        bValue = [b.material, b.cor, b.tipo, b.carateristica].filter(Boolean).join(' - ')
      } else if (sortColumnCurrent === 'stock_atual') {
        aValue = a.stock_atual
        bValue = b.stock_atual
      }

      if (aValue < bValue) return sortDirectionCurrent === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirectionCurrent === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [filteredCurrentStocks, sortColumnCurrent, sortDirectionCurrent])

  const filteredPaletes = useMemo(() => {
    if (!debouncedPaletesFilter) return paletes

    return paletes.filter((p) => {
      const searchStr = [
        p.no_palete,
        p.fornecedores?.nome_forn,
        p.no_guia_forn,
        p.ref_cartao,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchStr.includes(debouncedPaletesFilter.toLowerCase())
    })
  }, [paletes, debouncedPaletesFilter])

  // Pagination calculations for Entradas tab
  const totalEntriesPages = Math.ceil(sortedStocks.length / ITEMS_PER_PAGE)
  const paginatedStocks = useMemo(() => {
    const startIndex = (currentEntriesPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedStocks.slice(startIndex, endIndex)
  }, [sortedStocks, currentEntriesPage, ITEMS_PER_PAGE])

  // Pagination calculations for Stock Atual tab
  const totalCurrentStocksPages = Math.ceil(sortedCurrentStocks.length / ITEMS_PER_PAGE)
  const paginatedCurrentStocks = useMemo(() => {
    const startIndex = (currentStocksPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedCurrentStocks.slice(startIndex, endIndex)
  }, [sortedCurrentStocks, currentStocksPage, ITEMS_PER_PAGE])

  // Pagination calculations for Paletes tab
  const totalPaletesPages = Math.ceil(filteredPaletes.length / ITEMS_PER_PAGE)
  const paginatedPaletes = useMemo(() => {
    const startIndex = (currentPaletesPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredPaletes.slice(startIndex, endIndex)
  }, [filteredPaletes, currentPaletesPage, ITEMS_PER_PAGE])

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentEntriesPage(1)
  }, [sortedStocks.length])

  useEffect(() => {
    setCurrentStocksPage(1)
  }, [sortedCurrentStocks.length])

  useEffect(() => {
    setCurrentPaletesPage(1)
  }, [filteredPaletes.length])

  return (
    <PermissionGuard>
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Gestão de Stocks</h1>
          <p className="text-muted-foreground">Gerenciar materiais, stocks atuais e paletes</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="entries">Entradas</TabsTrigger>
            <TabsTrigger value="current">Stock Atual</TabsTrigger>
            <TabsTrigger value="palettes">Paletes</TabsTrigger>
            <TabsTrigger value="analytics">Análise</TabsTrigger>
          </TabsList>

          {/* Entradas Tab */}
          <TabsContent value="entries" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por material..."
                    value={materialFilter}
                    onChange={(e) => setMaterialFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {materialFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setMaterialFilter('')}
                    >
                      <XSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por referência..."
                    value={referenciaFilter}
                    onChange={(e) => setReferenciaFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {referenciaFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setReferenciaFilter('')}
                    >
                      <XSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="bg-yellow-400 hover:bg-yellow-500 border border-black"
                        onClick={() => {
                          setMaterialFilter('')
                          setReferenciaFilter('')
                        }}
                        disabled={!materialFilter && !referenciaFilter}
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
                        variant="outline"
                        size="icon"
                        className="border border-black"
                        onClick={fetchStocks}
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Atualizar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button className="border border-black" onClick={() => { resetForm(); setOpenDrawer(true) }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Entrada
                </Button>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden">
              <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer font-bold uppercase hover:opacity-80"
                      onClick={() => {
                        if (sortColumnEntries === 'data') {
                          setSortDirectionEntries(sortDirectionEntries === 'asc' ? 'desc' : 'asc')
                        } else {
                          setSortColumnEntries('data')
                          setSortDirectionEntries('asc')
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        Data
                        {sortColumnEntries === 'data' && (
                          sortDirectionEntries === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold uppercase">Referência</TableHead>
                    <TableHead className="font-bold uppercase">Material</TableHead>
                    <TableHead className="font-bold uppercase">Fornecedor</TableHead>
                    <TableHead className="font-bold uppercase text-right">Quantidade</TableHead>
                    <TableHead className="font-bold uppercase text-right">Preço/Unit</TableHead>
                    <TableHead className="font-bold uppercase text-right">Valor Total</TableHead>
                    <TableHead className="font-bold uppercase w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-40 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedStocks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhuma entrada encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedStocks.map((stock) => (
                      <TableRow key={stock.id} className="hover:bg-muted">
                        <TableCell className="font-medium">
                          {new Date(stock.data).toLocaleDateString('pt-PT')}
                        </TableCell>
                        <TableCell>{stock.materiais?.referencia || '-'}</TableCell>
                        <TableCell>{formatMaterialName(stock.materiais)}</TableCell>
                        <TableCell>{stock.fornecedores?.nome_forn || '-'}</TableCell>
                        <TableCell className="text-right">{stock.quantidade}</TableCell>
                        <TableCell className="text-right">{stock.preco_unitario?.toFixed(2) || '-'}</TableCell>
                        <TableCell className="text-right">{stock.valor_total?.toFixed(2) || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="border border-black"
                              onClick={() => handleEdit(stock)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="border border-black"
                              onClick={() => handleDeleteStock(stock.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalEntriesPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {currentEntriesPage} de {totalEntriesPages} ({sortedStocks.length} items)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentEntriesPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentEntriesPage === 1}
                      className="border border-black"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentEntriesPage((prev) => Math.min(totalEntriesPages, prev + 1))}
                      disabled={currentEntriesPage === totalEntriesPages}
                      className="border border-black"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Stock Atual Tab */}
          <TabsContent value="current" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Filtrar por material..."
                  value={currentStockFilter}
                  onChange={(e) => setCurrentStockFilter(e.target.value)}
                  className="h-10 pr-10"
                />
                {currentStockFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => setCurrentStockFilter('')}
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
                      onClick={() => setCurrentStockFilter('')}
                      disabled={!currentStockFilter}
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
                    <Button variant="outline" size="icon" className="border border-black" onClick={fetchCurrentStocks}>
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Atualizar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="rounded-lg overflow-hidden">
              <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold uppercase">Referência</TableHead>
                    <TableHead
                      className="cursor-pointer font-bold uppercase hover:opacity-80"
                      onClick={() => {
                        if (sortColumnCurrent === 'material') {
                          setSortDirectionCurrent(sortDirectionCurrent === 'asc' ? 'desc' : 'asc')
                        } else {
                          setSortColumnCurrent('material')
                          setSortDirectionCurrent('asc')
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        Material
                        {sortColumnCurrent === 'material' && (
                          sortDirectionCurrent === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold uppercase text-right">Total Recebido</TableHead>
                    <TableHead className="font-bold uppercase text-right">Stock Atual</TableHead>
                    <TableHead className="font-bold uppercase text-right">Stock Mínimo</TableHead>
                    <TableHead className="font-bold uppercase text-right">Stock Crítico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentStocksLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedCurrentStocks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum stock encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCurrentStocks.map((stock) => (
                      <TableRow key={stock.id} className="hover:bg-muted">
                        <TableCell className="font-medium">{stock.referencia || '-'}</TableCell>
                        <TableCell>
                          {[stock.material, stock.cor, stock.tipo, stock.carateristica]
                            .filter(Boolean)
                            .join(' - ')}
                        </TableCell>
                        <TableCell className="text-right">{stock.total_recebido}</TableCell>
                        <TableCell className="text-right font-semibold">{stock.stock_atual}</TableCell>
                        <TableCell className="text-right">{stock.stock_minimo || '-'}</TableCell>
                        <TableCell className="text-right">{stock.stock_critico || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalCurrentStocksPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {currentStocksPage} de {totalCurrentStocksPages} ({sortedCurrentStocks.length} items)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStocksPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentStocksPage === 1}
                      className="border border-black"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStocksPage((prev) => Math.min(totalCurrentStocksPages, prev + 1))}
                      disabled={currentStocksPage === totalCurrentStocksPages}
                      className="border border-black"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Palettes Tab */}
          <TabsContent value="palettes" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Filtrar paletes..."
                  value={paletesFilter}
                  onChange={(e) => setPaletesFilter(e.target.value)}
                  className="h-10 pr-10"
                />
                {paletesFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => setPaletesFilter('')}
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
                      onClick={() => setPaletesFilter('')}
                      disabled={!paletesFilter}
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
                    <Button variant="outline" size="icon" className="border border-black" onClick={fetchPaletes}>
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Atualizar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="rounded-lg overflow-hidden">
              <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold uppercase">Nº Palete</TableHead>
                    <TableHead className="font-bold uppercase">Fornecedor</TableHead>
                    <TableHead className="font-bold uppercase">Nº Guia</TableHead>
                    <TableHead className="font-bold uppercase">Ref. Cartão</TableHead>
                    <TableHead className="font-bold uppercase text-right">Quantidade</TableHead>
                    <TableHead className="font-bold uppercase">Data</TableHead>
                    <TableHead className="font-bold uppercase w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paletesLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedPaletes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma palete encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPaletes.map((palete) => (
                      <TableRow key={palete.id} className="hover:bg-muted">
                        <TableCell className="font-medium font-mono">{palete.no_palete}</TableCell>
                        <TableCell>{palete.fornecedores?.nome_forn || '-'}</TableCell>
                        <TableCell>{palete.no_guia_forn || '-'}</TableCell>
                        <TableCell>{palete.ref_cartao || '-'}</TableCell>
                        <TableCell className="text-right">{palete.qt_palete || '-'}</TableCell>
                        <TableCell>{new Date(palete.data).toLocaleDateString('pt-PT')}</TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="border border-black"
                            onClick={() => {
                              if (confirm('Tem certeza que quer eliminar?')) {
                                supabase.from('paletes').delete().eq('id', palete.id).then(() => fetchPaletes())
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPaletesPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {currentPaletesPage} de {totalPaletesPages} ({filteredPaletes.length} items)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPaletesPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPaletesPage === 1}
                      className="border border-black"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPaletesPage((prev) => Math.min(totalPaletesPages, prev + 1))}
                      disabled={currentPaletesPage === totalPaletesPages}
                      className="border border-black"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase mb-2">Total Entradas</h3>
                <p className="text-3xl font-bold">{stocks.length}</p>
              </div>
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase mb-2">Materiais Únicos</h3>
                <p className="text-3xl font-bold">{materials.length}</p>
              </div>
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase mb-2">Paletes</h3>
                <p className="text-3xl font-bold">{paletes.length}</p>
              </div>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Stocks em Alerta</h3>
              <div className="space-y-2">
                {currentStocks.filter((s) => (s.stock_minimo && s.stock_atual < s.stock_minimo) || false).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todos os stocks estão adequados</p>
                ) : (
                  currentStocks
                    .filter((s) => (s.stock_minimo && s.stock_atual < s.stock_minimo) || false)
                    .map((stock) => (
                      <div key={stock.id} className="flex items-center justify-between rounded border p-2 bg-accent">
                        <span className="text-sm font-medium">{[stock.material, stock.cor].filter(Boolean).join(' - ')}</span>
                        <span className="text-sm">Stock: {stock.stock_atual} (Mín: {stock.stock_minimo})</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Stock Entry Drawer */}
        <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
          <DrawerContent className="flex flex-col max-h-[85vh]">
            <DrawerHeader className="flex-shrink-0">
              <DrawerTitle>{editingStock ? 'Editar Entrada' : 'Nova Entrada de Stock'}</DrawerTitle>
              <DrawerDescription>
                {editingStock ? 'Atualize os dados da entrada' : 'Crie uma nova entrada de stock'}
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4" style={{ minHeight: 0 }}>
              <form onSubmit={handleSaveStock} className="space-y-4">
                {/* Material Selection */}
                <div>
                  <Label htmlFor="material" className="text-sm font-semibold uppercase">Material *</Label>
                  <Select value={formData.material_id} onValueChange={(value) => setFormData({ ...formData, material_id: value })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecionar material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {formatMaterialName(material)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantidade */}
                <div>
                  <Label htmlFor="quantidade" className="text-sm font-semibold uppercase">Quantidade *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    step="1"
                    value={formData.quantidade}
                    onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                    placeholder="0"
                    className="mt-2"
                  />
                </div>

                {/* Preços */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vl_m2" className="text-sm font-semibold uppercase">VL M² €</Label>
                    <Input
                      id="vl_m2"
                      type="number"
                      step="0.01"
                      value={formData.vl_m2}
                      onChange={(e) => setFormData({ ...formData, vl_m2: e.target.value })}
                      placeholder="0.00"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preco_unitario" className="text-sm font-semibold uppercase">Preço/Unit €</Label>
                    <Input
                      id="preco_unitario"
                      type="number"
                      step="0.01"
                      value={formData.preco_unitario}
                      onChange={(e) => setFormData({ ...formData, preco_unitario: e.target.value })}
                      placeholder="0.00"
                      className="mt-2"
                    />
                  </div>
                </div>

                {/* Valor Total */}
                <div>
                  <Label htmlFor="valor_total" className="text-sm font-semibold uppercase">Valor Total €</Label>
                  <Input
                    id="valor_total"
                    type="number"
                    step="0.01"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                    placeholder="0.00"
                    className="mt-2 bg-muted"
                    readOnly
                  />
                </div>

                {/* Palete Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="n_palet" className="text-sm font-semibold uppercase">Nº Palete</Label>
                    <Input
                      id="n_palet"
                      value={formData.n_palet}
                      onChange={(e) => setFormData({ ...formData, n_palet: e.target.value })}
                      placeholder="Número da palete"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="no_guia_forn" className="text-sm font-semibold uppercase">Nº Guia Fornecedor</Label>
                    <Input
                      id="no_guia_forn"
                      value={formData.no_guia_forn}
                      onChange={(e) => setFormData({ ...formData, no_guia_forn: e.target.value })}
                      placeholder="Número da guia"
                      className="mt-2"
                    />
                  </div>
                </div>

                {/* Data */}
                <div>
                  <Label htmlFor="data" className="text-sm font-semibold uppercase">Data *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    className="mt-2"
                  />
                </div>

                {/* Notas */}
                <div>
                  <Label htmlFor="notas" className="text-sm font-semibold uppercase">Notas</Label>
                  <Textarea
                    id="notas"
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    placeholder="Notas adicionais..."
                    className="mt-2"
                    rows={3}
                  />
                </div>

                {/* Form Actions */}
                <div className="flex gap-4 pt-6">
                  <Button type="submit" disabled={submitting} className="flex-1 border border-black">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        A guardar...
                      </>
                    ) : editingStock ? (
                      'Atualizar'
                    ) : (
                      'Criar'
                    )}
                  </Button>
                  <DrawerClose asChild>
                    <Button type="button" variant="outline" className="border border-black">
                      <X className="h-4 w-4" />
                    </Button>
                  </DrawerClose>
                </div>
              </form>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </PermissionGuard>
  )
}


'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Loader2,
  RotateCw,
  ArrowUp,
  ArrowDown,
  XSquare,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { useDebounce } from '@/hooks/useDebounce'

// Types
interface ItemRow {
  id: string
  descricao: string
  codigo?: string | null
  quantidade?: number | null
  facturado?: boolean | null
  // Job info
  folha_obra_id: string
  numero_fo: string
  numero_orc?: number | null
  nome_campanha: string
  cliente?: string | null
  created_at?: string | null
  pendente?: boolean | null
  // Logistics info
  data_saida?: string | null
  concluido?: boolean | null
  // Calculated
  dias_trabalho?: number | null
  dias_em_progresso?: boolean // True if dias_trabalho is calculated to today (no data_saida)
}

export default function FaturacaoPage() {
  const supabase = createBrowserClient()

  // State management
  const [jobsTab, setJobsTab] = useState<'por_facturar' | 'facturados'>('por_facturar')
  const [subTab, setSubTab] = useState<'em_curso' | 'pendentes'>('em_curso') // Sub-tab for por_facturar
  const [items, setItems] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(true)
  
  // Pagination state for main items table
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 50

  // Filter states
  const [foFilter, setFoFilter] = useState('')
  const [orcFilter, setOrcFilter] = useState('')
  const [campanhaFilter, setCampanhaFilter] = useState('')
  const [clienteFilter, setClienteFilter] = useState('')

  // Debounced filter values
  const debouncedFoFilter = useDebounce(foFilter, 300)
  const debouncedOrcFilter = useDebounce(orcFilter, 300)
  const debouncedCampanhaFilter = useDebounce(campanhaFilter, 300)
  const debouncedClienteFilter = useDebounce(clienteFilter, 300)

  // Sorting states - supports multi-column sorting
  interface SortConfig {
    column: string
    direction: 'asc' | 'desc'
  }
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([
    { column: 'numero_fo', direction: 'desc' }
  ])

  // Helper to render sort indicator
  const renderSortIndicator = (column: string) => {
    const sortConfig = sortConfigs.find(config => config.column === column)
    if (!sortConfig) return null
    
    const sortIndex = sortConfigs.findIndex(config => config.column === column)
    const showOrder = sortConfigs.length > 1
    
    return (
      <div className="flex items-center gap-0.5">
        {sortConfig.direction === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )}
        {showOrder && (
          <span className="text-[10px] font-bold">{sortIndex + 1}</span>
        )}
      </div>
    )
  }

  // Toggle sort handler - supports Shift+Click for multi-column sorting
  const toggleSort = (column: string, isShiftKey: boolean) => {
    if (isShiftKey) {
      // Shift+Click: Add/modify secondary sort
      const existingIndex = sortConfigs.findIndex(config => config.column === column)
      if (existingIndex >= 0) {
        // Column already in sort list - toggle its direction
        const newConfigs = [...sortConfigs]
        newConfigs[existingIndex].direction = newConfigs[existingIndex].direction === 'asc' ? 'desc' : 'asc'
        setSortConfigs(newConfigs)
      } else {
        // Add new sort column
        setSortConfigs([...sortConfigs, { column, direction: 'asc' }])
      }
    } else {
      // Regular click: Single column sort
      const existingConfig = sortConfigs.find(config => config.column === column)
      if (sortConfigs.length === 1 && existingConfig) {
        // Same column - just toggle direction
        setSortConfigs([{ column, direction: existingConfig.direction === 'asc' ? 'desc' : 'asc' }])
      } else {
        // New column - reset to single sort
        setSortConfigs([{ column, direction: 'asc' }])
      }
    }
  }

  // Helper function to calculate days difference
  const calculateDays = (createdAt: string | null, dataSaida: string | null): number => {
    if (!createdAt) return 0
    
    const startDate = new Date(createdAt)
    const endDate = dataSaida ? new Date(dataSaida) : new Date()
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  // Helper function to truncate text
  const truncateText = (text: string | null | undefined, maxLength: number): string => {
    if (!text) return '-'
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // No need for job-level fatura status anymore since we show items directly

  // Data fetching - fetch items with job info
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      // Get items with their job information and logistics data
      let query = supabase
        .from('items_base')
        .select(`
          id,
          descricao,
          codigo,
          quantidade,
          facturado,
          folha_obra_id,
          folhas_obras!inner (
            numero_fo:Numero_do_,
            numero_orc,
            nome_campanha:Trabalho,
            cliente:Nome,
            created_at,
            pendente
          ),
          logistica_entregas (
            data_saida,
            concluido
          )
        `)

      const { data: itemsData, error: itemsError } = await query

      if (itemsError) throw itemsError

      // Transform data to flat structure
      const transformedItems: ItemRow[] = (itemsData || []).map((item: any) => {
        const job = item.folhas_obras
        const logistics = item.logistica_entregas?.[0] // Get first logistics entry
        
        let dias_trabalho: number | null = null
        let dias_em_progresso = false
        
        if (job.created_at) {
          if (logistics?.data_saida) {
            // Has data_saida: calculate from created_at to data_saida
            dias_trabalho = Math.ceil((new Date(logistics.data_saida).getTime() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24))
          } else {
            // No data_saida: calculate from created_at to today (in orange)
            const today = new Date()
            dias_trabalho = Math.ceil((today.getTime() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24))
            dias_em_progresso = true
          }
        }
        
        return {
          id: item.id,
          descricao: item.descricao,
          codigo: item.codigo,
          quantidade: item.quantidade,
          facturado: item.facturado,
          folha_obra_id: item.folha_obra_id,
          numero_fo: job.numero_fo,
          numero_orc: job.numero_orc,
          nome_campanha: job.nome_campanha,
          cliente: job.cliente,
          created_at: job.created_at,
          pendente: job.pendente,
          // Logistics data
          data_saida: logistics?.data_saida || null,
          concluido: logistics?.concluido || false,
          // Days calculation
          dias_trabalho,
          dias_em_progresso
        }
      })

      // Apply filters
      let filteredItems = transformedItems

      // Filter by text filters
      if (debouncedFoFilter) {
        filteredItems = filteredItems.filter(item => 
          item.numero_fo && item.numero_fo.toString().toLowerCase().includes(debouncedFoFilter.toLowerCase())
        )
      }
      if (debouncedOrcFilter) {
        filteredItems = filteredItems.filter(item => 
          item.numero_orc && item.numero_orc.toString().includes(debouncedOrcFilter)
        )
      }
      if (debouncedCampanhaFilter) {
        filteredItems = filteredItems.filter(item => 
          item.nome_campanha && item.nome_campanha.toLowerCase().includes(debouncedCampanhaFilter.toLowerCase())
        )
      }
      if (debouncedClienteFilter) {
        filteredItems = filteredItems.filter(item => 
          item.cliente && item.cliente.toLowerCase().includes(debouncedClienteFilter.toLowerCase())
        )
      }

      // Filter by tab
      if (jobsTab === 'por_facturar') {
        // Por Facturar: ALL items with facturado = FALSE
        filteredItems = filteredItems.filter(item => item.facturado !== true)
        
        if (subTab === 'pendentes') {
          // Pendentes: facturado = FALSE AND job is pendente
          filteredItems = filteredItems.filter(item => item.pendente === true)
        } else {
          // Em Curso: facturado = FALSE AND job is NOT pendente
          filteredItems = filteredItems.filter(item => item.pendente !== true)
        }
      } else {
        // Facturados: items with facturado = TRUE (last 3 months only)
        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        
        filteredItems = filteredItems.filter(item => {
          if (item.facturado !== true) return false
          
          // Only show items from last 3 months
          if (item.created_at) {
            const itemDate = new Date(item.created_at)
            return itemDate >= threeMonthsAgo
          }
          
          return true
        })
      }

      console.log('🔍 Faturacao - Items fetched:', {
        total: transformedItems.length,
        filtered: filteredItems.length,
        tab: jobsTab,
        subTab
      })

      setItems(filteredItems)
      } catch (error) {
        console.error('Error fetching items:', error)
      } finally {
      setLoading(false)
      }
  }, [supabase, jobsTab, subTab, debouncedFoFilter, debouncedOrcFilter, debouncedCampanhaFilter, debouncedClienteFilter])

  // Initial load
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Handle individual item facturado toggle
  const handleItemFacturadoToggle = useCallback(async (itemId: string, newValue: boolean) => {
    try {
      const { error } = await supabase
        .from('items_base')
        .update({ facturado: newValue })
        .eq('id', itemId)

      if (error) throw error

      // Refresh items to update table
      await fetchItems()
    } catch (error) {
      console.error('Error updating item facturado:', error)
      alert(`Erro ao atualizar: ${error}`)
    }
  }, [supabase, fetchItems])

  // Sort and filter items
  // Helper to get sort value for a column
  const getSortValue = useCallback((item: ItemRow, column: string): any => {
    switch (column) {
      case 'numero_fo':
        return item.numero_fo
      case 'numero_orc':
        return item.numero_orc || 0
      case 'nome_campanha':
        return item.nome_campanha
      case 'cliente':
        return item.cliente || ''
      case 'descricao':
        return item.descricao || ''
      case 'created_at':
        return new Date(item.created_at || '').getTime()
      case 'data_saida':
        return item.data_saida ? new Date(item.data_saida).getTime() : 0
      case 'dias':
        return item.dias_trabalho || 0
      case 'concluido':
        return item.concluido ? 1 : 0
      default:
        return ''
    }
  }, [])

  const getSortedItems = useCallback(() => {
    let sorted = [...items]

    // Multi-column sort
    sorted.sort((a, b) => {
      // Apply each sort config in order
      for (const config of sortConfigs) {
        const aValue = getSortValue(a, config.column)
        const bValue = getSortValue(b, config.column)
        
        if (aValue < bValue) return config.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return config.direction === 'asc' ? 1 : -1
        // If equal, continue to next sort config
      }
      return 0
    })

    return sorted
  }, [items, sortConfigs, getSortValue])

  const sortedItems = getSortedItems()

  // Pagination calculations
  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE)
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedItems.slice(startIndex, endIndex)
  }, [sortedItems, currentPage, ITEMS_PER_PAGE])

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sortedItems.length])

  return (
    <PermissionGuard>
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Gestão de Faturação</h1>
          <p className="text-muted-foreground">Gerenciar faturação de trabalhos</p>
        </div>

        <Tabs value={jobsTab} onValueChange={(value: any) => setJobsTab(value)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="por_facturar">Por Facturar</TabsTrigger>
            <TabsTrigger value="facturados">Facturados</TabsTrigger>
          </TabsList>

          <TabsContent value="por_facturar" className="space-y-4">
            {/* Sub-tabs for Em Curso and Pendentes */}
            <Tabs value={subTab} onValueChange={(value: any) => setSubTab(value)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="em_curso">Em Curso ({subTab === 'em_curso' ? items.length : '...'})</TabsTrigger>
                <TabsTrigger value="pendentes">Pendentes ({subTab === 'pendentes' ? items.length : '...'})</TabsTrigger>
              </TabsList>

              {(['em_curso', 'pendentes'] as const).map((subTabValue) => (
                <TabsContent key={subTabValue} value={subTabValue} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por FO..."
                    value={foFilter}
                    onChange={(e) => setFoFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {foFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setFoFilter('')}
                    >
                      <XSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por ORC..."
                    value={orcFilter}
                    onChange={(e) => setOrcFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {orcFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setOrcFilter('')}
                    >
                      <XSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por campanha..."
                    value={campanhaFilter}
                    onChange={(e) => setCampanhaFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {campanhaFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setCampanhaFilter('')}
                    >
                      <XSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por cliente..."
                    value={clienteFilter}
                    onChange={(e) => setClienteFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {clienteFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setClienteFilter('')}
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
                          setFoFilter('')
                          setOrcFilter('')
                          setCampanhaFilter('')
                          setClienteFilter('')
                        }}
                        disabled={!foFilter && !orcFilter && !campanhaFilter && !clienteFilter}
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
                        onClick={fetchItems}
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Atualizar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden">
              <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
                <TableHeader>
                  <TableRow className="border-b border-border">
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('numero_fo', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        FO
                        {renderSortIndicator('numero_fo')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('numero_orc', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        ORC
                        {renderSortIndicator('numero_orc')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('cliente', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Cliente
                        {renderSortIndicator('cliente')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('nome_campanha', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Campanha
                        {renderSortIndicator('nome_campanha')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('descricao', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Item
                        {renderSortIndicator('descricao')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('created_at', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Data Criação
                        {renderSortIndicator('created_at')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('data_saida', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Data Saída
                        {renderSortIndicator('data_saida')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase text-center hover:opacity-80"
                      onClick={(e) => toggleSort('dias', e.shiftKey)}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Dias
                        {renderSortIndicator('dias')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase text-center hover:opacity-80"
                      onClick={(e) => toggleSort('concluido', e.shiftKey)}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-center gap-1">
                              C
                        {renderSortIndicator('concluido')}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Logística Concluída</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase text-center">F</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-40 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Nenhum item encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted">
                        <TableCell className="font-mono font-bold">{item.numero_fo}</TableCell>
                        <TableCell className="font-mono">{item.numero_orc || '-'}</TableCell>
                        <TableCell>{truncateText(item.cliente, 20)}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.nome_campanha}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.descricao}</TableCell>
                        <TableCell>{item.created_at ? new Date(item.created_at).toLocaleDateString('pt-PT') : '-'}</TableCell>
                        <TableCell>{item.data_saida ? new Date(item.data_saida).toLocaleDateString('pt-PT') : '-'}</TableCell>
                        <TableCell className={`text-center font-semibold ${
                          item.data_saida 
                            ? 'text-green-600 dark:text-green-400' 
                            : item.dias_em_progresso 
                            ? 'text-orange-600 dark:text-orange-400' 
                            : ''
                        }`}>
                          {item.dias_trabalho || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <div
                              className={`h-4 w-4 border border-black rounded-sm flex items-center justify-center ${
                                item.concluido ? 'bg-black' : 'bg-transparent'
                              }`}
                            >
                              {item.concluido && (
                                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <div
                              className={`h-4 w-4 border border-black rounded-sm cursor-pointer flex items-center justify-center ${
                                item.facturado ? 'bg-black' : 'bg-transparent'
                              }`}
                              onClick={() => handleItemFacturadoToggle(item.id, !item.facturado)}
                            >
                              {item.facturado && (
                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
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
          ))}
        </Tabs>
          </TabsContent>

          <TabsContent value="facturados" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por FO..."
                    value={foFilter}
                    onChange={(e) => setFoFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {foFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setFoFilter('')}
                    >
                      <XSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por ORC..."
                    value={orcFilter}
                    onChange={(e) => setOrcFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {orcFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setOrcFilter('')}
                    >
                      <XSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por campanha..."
                    value={campanhaFilter}
                    onChange={(e) => setCampanhaFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {campanhaFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setCampanhaFilter('')}
                    >
                      <XSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="relative flex-1">
                  <Input
                    placeholder="Filtrar por cliente..."
                    value={clienteFilter}
                    onChange={(e) => setClienteFilter(e.target.value)}
                    className="h-10 pr-10"
                  />
                  {clienteFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                      onClick={() => setClienteFilter('')}
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
                          setFoFilter('')
                          setOrcFilter('')
                          setCampanhaFilter('')
                          setClienteFilter('')
                        }}
                        disabled={!foFilter && !orcFilter && !campanhaFilter && !clienteFilter}
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
                        onClick={fetchItems}
                          >
                        <RotateCw className="h-4 w-4" />
                          </Button>
                    </TooltipTrigger>
                    <TooltipContent>Atualizar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden">
              <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
                <TableHeader>
                  <TableRow className="border-b border-border">
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('numero_fo', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        FO
                        {renderSortIndicator('numero_fo')}
                  </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('numero_orc', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        ORC
                        {renderSortIndicator('numero_orc')}
                  </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('cliente', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Cliente
                        {renderSortIndicator('cliente')}
                  </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('nome_campanha', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Campanha
                        {renderSortIndicator('nome_campanha')}
                </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('descricao', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Item
                        {renderSortIndicator('descricao')}
              </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('created_at', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Data Criação
                        {renderSortIndicator('created_at')}
                  </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase hover:opacity-80"
                      onClick={(e) => toggleSort('data_saida', e.shiftKey)}
                    >
                      <div className="flex items-center gap-1">
                        Data Saída
                        {renderSortIndicator('data_saida')}
                    </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase text-center hover:opacity-80"
                      onClick={(e) => toggleSort('dias', e.shiftKey)}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Dias
                        {renderSortIndicator('dias')}
                            </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase text-center hover:opacity-80"
                      onClick={(e) => toggleSort('valor', e.shiftKey)}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-center gap-1">
                              Valor
                              {renderSortIndicator('valor')}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Valor da Folha de Obra</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer bg-primary text-primary-foreground font-bold uppercase text-center hover:opacity-80"
                      onClick={(e) => toggleSort('concluido', e.shiftKey)}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-center gap-1">
                              C
                        {renderSortIndicator('concluido')}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Logística Concluída</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase text-center">F</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-40 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Nenhum item encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted">
                        <TableCell className="font-mono font-bold">{item.numero_fo}</TableCell>
                        <TableCell className="font-mono">{item.numero_orc || '-'}</TableCell>
                        <TableCell>{truncateText(item.cliente, 20)}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.nome_campanha}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.descricao}</TableCell>
                        <TableCell>{item.created_at ? new Date(item.created_at).toLocaleDateString('pt-PT') : '-'}</TableCell>
                        <TableCell>{item.data_saida ? new Date(item.data_saida).toLocaleDateString('pt-PT') : '-'}</TableCell>
                        <TableCell className={`text-center font-semibold ${
                          item.data_saida 
                            ? 'text-green-600 dark:text-green-400' 
                            : item.dias_em_progresso 
                            ? 'text-orange-600 dark:text-orange-400' 
                            : ''
                        }`}>
                          {item.dias_trabalho || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <div
                              className={`h-4 w-4 border border-black rounded-sm flex items-center justify-center ${
                                item.concluido ? 'bg-black' : 'bg-transparent'
                              }`}
                            >
                              {item.concluido && (
                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <div
                              className={`h-4 w-4 border border-black rounded-sm cursor-pointer flex items-center justify-center ${
                                item.facturado ? 'bg-black' : 'bg-transparent'
                              }`}
                              onClick={() => handleItemFacturadoToggle(item.id, !item.facturado)}
                            >
                              {item.facturado && (
                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                      </div>
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
        </Tabs>

      </div>
    </PermissionGuard>
  )
}

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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  X,
  Loader2,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Eye,
  XSquare,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { useDebounce } from '@/hooks/useDebounce'

// Types
interface Job {
  id: string
  numero_fo: string
  numero_orc?: number | null
  nome_campanha: string
  data_saida: string | null
  prioridade: boolean | null
  notas: string | null
  concluido?: boolean | null
  saiu?: boolean | null
  fatura?: boolean | null
  cliente?: string | null
  id_cliente?: string | null
  data_concluido?: string | null
  created_at?: string | null
  dias_trabalho?: number | null
}

interface Item {
  id: string
  folha_obra_id: string
  descricao: string
  codigo?: string | null
  quantidade?: number | null
  data_concluido?: string | null
  dias_conclusao?: number | null
  facturado?: boolean | null
}

export default function FaturacaoPage() {
  const supabase = createBrowserClient()

  // State management
  const [jobsTab, setJobsTab] = useState<'por_facturar' | 'facturados'>('por_facturar')
  const [jobs, setJobs] = useState<Job[]>([])
  const [allItems, setAllItems] = useState<Item[]>([]) // All items for filtering
  
  const [loading, setLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)
  
  const [openDrawer, setOpenDrawer] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedJobItems, setSelectedJobItems] = useState<Item[]>([])

  // Pagination state for drawer items
  const [currentItemsPage, setCurrentItemsPage] = useState(1)
  const ITEMS_PER_PAGE_DRAWER = 5
  
  // Pagination state for main jobs table
  const [currentJobsPage, setCurrentJobsPage] = useState(1)
  const ITEMS_PER_PAGE_MAIN = 40

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

  // Sorting states
  const [sortColumn, setSortColumn] = useState('numero_fo')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

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

  // Helper function to get fatura status for a job based on its items
  const getJobFaturaStatus = useCallback((jobId: string, items: Item[]): 'none' | 'partial' | 'all' => {
    const jobItems = items.filter(item => item.folha_obra_id === jobId)
    if (jobItems.length === 0) return 'none'
    
    const facturadoCount = jobItems.filter(item => item.facturado === true).length
    
    if (facturadoCount === 0) return 'none'
    if (facturadoCount === jobItems.length) return 'all'
    return 'partial'
  }, [])

  // Data fetching
  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('folhas_obras_with_dias')
        .select('*')
        .order('created_at', { ascending: false })

      // Check if any filters are active
      const hasActiveFilters = debouncedFoFilter || debouncedOrcFilter || debouncedCampanhaFilter || debouncedClienteFilter

      // If no filters are active, only show last 2 months
      if (!hasActiveFilters) {
        const twoMonthsAgo = new Date()
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
        const twoMonthsAgoISO = twoMonthsAgo.toISOString()
        query = query.gte('created_at', twoMonthsAgoISO)
      }

      // Apply database-level filters
      if (debouncedFoFilter) {
        query = query.ilike('numero_fo', `%${debouncedFoFilter}%`)
      }

      // Note: ORC filter applied client-side below (numeric field)

      if (debouncedCampanhaFilter) {
        query = query.ilike('nome_campanha', `%${debouncedCampanhaFilter}%`)
      }

      if (debouncedClienteFilter) {
        query = query.ilike('cliente', `%${debouncedClienteFilter}%`)
      }

      // Filter by ORC (required for invoicing)
      query = query.not('numero_orc', 'is', null)

      const { data: jobsData, error: jobsError } = await query

      if (jobsError) throw jobsError

      // Fetch all items for these jobs
      if (jobsData && jobsData.length > 0) {
        const jobIds = jobsData.map(job => job.id)
        const { data: itemsData, error: itemsError } = await supabase
          .from('items_base')
          .select('id, folha_obra_id, descricao, codigo, quantidade, facturado')
          .in('folha_obra_id', jobIds)

        if (!itemsError && itemsData) {
          setAllItems(itemsData)

          // Filter jobs based on tab and item facturado status
          const filteredJobs = jobsData.filter(job => {
            const jobItems = itemsData.filter(item => item.folha_obra_id === job.id)
            if (jobItems.length === 0) return jobsTab === 'por_facturar' // No items = por facturar
            
            const allFacturado = jobItems.every(item => item.facturado === true)
            
            if (jobsTab === 'facturados') {
              return allFacturado
            } else {
              return !allFacturado
            }
          })

          setJobs(filteredJobs)
        } else {
          setJobs(jobsData)
          setAllItems([])
        }
      } else {
        setJobs([])
        setAllItems([])
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, jobsTab, debouncedFoFilter, debouncedOrcFilter, debouncedCampanhaFilter, debouncedClienteFilter])

  const fetchItemsForJob = useCallback(
    async (jobId: string) => {
      setItemsLoading(true)
      try {
        const { data, error } = await supabase
          .from('items_base')
          .select(`
            id,
            folha_obra_id,
            descricao,
            codigo,
            quantidade,
            facturado,
            created_at,
            logistica_entregas (
              data_concluido,
              data_saida
            )
          `)
          .eq('folha_obra_id', jobId)

        if (!error && data) {
          const processedItems = data.map((item: any) => ({
            id: item.id,
            folha_obra_id: item.folha_obra_id,
            descricao: item.descricao,
            codigo: item.codigo,
            quantidade: item.quantidade,
            facturado: item.facturado,
            data_concluido: item.logistica_entregas?.[0]?.data_concluido,
          }))
          setSelectedJobItems(processedItems)
        }
      } catch (error) {
        console.error('Error fetching items:', error)
      } finally {
        setItemsLoading(false)
      }
    },
    [supabase]
  )

  // Initial load
  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Handle individual item facturado toggle
  const handleItemFacturadoToggle = useCallback(async (itemId: string, newValue: boolean) => {
    try {
      const { error } = await supabase
        .from('items_base')
        .update({ facturado: newValue })
        .eq('id', itemId)

      if (error) throw error

      // Update local state
      setSelectedJobItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, facturado: newValue } : item
      ))

      // Refresh jobs to update main table
      await fetchJobs()
    } catch (error) {
      console.error('Error updating item facturado:', error)
      alert(`Erro ao atualizar: ${error}`)
    }
  }, [supabase, fetchJobs])

  // Handle job-level facturado toggle (marks all items)
  const handleJobFacturadoToggle = useCallback(async (job: Job, items: Item[]) => {
    const jobItems = items.filter(item => item.folha_obra_id === job.id)
    const currentStatus = getJobFaturaStatus(job.id, items)
    
    // If all are facturado, uncheck all. Otherwise, check all.
    const newValue = currentStatus !== 'all'

    try {
      // Update all items for this job
      const updates = jobItems.map(item =>
        supabase
          .from('items_base')
          .update({ facturado: newValue })
          .eq('id', item.id)
      )

      await Promise.all(updates)

      // Refresh jobs and items
      await fetchJobs()
      if (selectedJob?.id === job.id) {
        await fetchItemsForJob(job.id)
      }
    } catch (error) {
      console.error('Error updating job facturado:', error)
      alert(`Erro ao atualizar: ${error}`)
    }
  }, [supabase, getJobFaturaStatus, fetchJobs, fetchItemsForJob, selectedJob])

  // Handle job selection
  const handleSelectJob = async (job: Job) => {
    setSelectedJob(job)
    await fetchItemsForJob(job.id)
    setOpenDrawer(true)
    setCurrentItemsPage(1)
  }
  
  // Handle drawer close
  const handleCloseDrawer = () => {
    setOpenDrawer(false)
    setSelectedJob(null)
    setSelectedJobItems([])
  }

  // Sort and filter jobs
  const getFilteredJobs = useCallback(() => {
    let filtered = [...jobs]

    // Apply client-side ORC filter (numeric field - not suitable for database .ilike())
    if (debouncedOrcFilter) {
      filtered = filtered.filter((j) =>
        j.numero_orc && String(j.numero_orc).includes(debouncedOrcFilter)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      if (sortColumn === 'numero_fo') {
        aValue = a.numero_fo
        bValue = b.numero_fo
      } else if (sortColumn === 'numero_orc') {
        aValue = a.numero_orc || 0
        bValue = b.numero_orc || 0
      } else if (sortColumn === 'nome_campanha') {
        aValue = a.nome_campanha
        bValue = b.nome_campanha
      } else if (sortColumn === 'created_at') {
        aValue = new Date(a.created_at || '').getTime()
        bValue = new Date(b.created_at || '').getTime()
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [jobs, debouncedFoFilter, debouncedOrcFilter, debouncedCampanhaFilter, debouncedClienteFilter, sortColumn, sortDirection])

  const sortedJobs = getFilteredJobs()

  // Pagination calculations for main jobs table
  const totalJobsPages = Math.ceil(sortedJobs.length / ITEMS_PER_PAGE_MAIN)
  const paginatedJobs = useMemo(() => {
    const startIndex = (currentJobsPage - 1) * ITEMS_PER_PAGE_MAIN
    const endIndex = startIndex + ITEMS_PER_PAGE_MAIN
    return sortedJobs.slice(startIndex, endIndex)
  }, [sortedJobs, currentJobsPage, ITEMS_PER_PAGE_MAIN])

  // Pagination calculations for drawer items
  const totalItemsPages = Math.ceil(selectedJobItems.length / ITEMS_PER_PAGE_DRAWER)
  const paginatedItems = useMemo(() => {
    const startIndex = (currentItemsPage - 1) * ITEMS_PER_PAGE_DRAWER
    const endIndex = startIndex + ITEMS_PER_PAGE_DRAWER
    return selectedJobItems.slice(startIndex, endIndex)
  }, [selectedJobItems, currentItemsPage, ITEMS_PER_PAGE_DRAWER])

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentJobsPage(1)
  }, [sortedJobs.length])

  useEffect(() => {
    setCurrentItemsPage(1)
  }, [selectedJobItems.length])

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

          {(['por_facturar', 'facturados'] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4">
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
                        onClick={fetchJobs}
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
                      onClick={() => {
                        if (sortColumn === 'numero_fo') {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                        } else {
                          setSortColumn('numero_fo')
                          setSortDirection('asc')
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        FO
                        {sortColumn === 'numero_fo' && (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase">ORC</TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase">Campanha</TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase">Cliente</TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase">Data Criação</TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase">Data Saída</TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase text-center">Dias</TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase text-center">Fact.</TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-40 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhum trabalho encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedJobs.map((job) => (
                      <TableRow key={job.id} className="hover:bg-muted">
                        <TableCell className="font-mono font-bold">{job.numero_fo}</TableCell>
                        <TableCell className="font-mono">{job.numero_orc || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{job.nome_campanha}</TableCell>
                        <TableCell>{truncateText(job.cliente, 20)}</TableCell>
                        <TableCell>{job.created_at ? new Date(job.created_at).toLocaleDateString('pt-PT') : '-'}</TableCell>
                        <TableCell>{job.data_saida ? new Date(job.data_saida).toLocaleDateString('pt-PT') : '-'}</TableCell>
                        <TableCell className={`text-center font-semibold ${job.data_saida ? 'text-green-600 dark:text-green-400' : ''}`}>
                          {calculateDays(job.created_at ?? null, job.data_saida ?? null)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            {(() => {
                              const status = getJobFaturaStatus(job.id, allItems)
                              return (
                                <div
                                  className={`h-4 w-4 border border-black rounded-sm cursor-pointer flex items-center justify-center ${
                                    status === 'all' ? 'bg-black' : 
                                    status === 'partial' ? 'bg-yellow-400' : 
                                    'bg-transparent'
                                  }`}
                                  onClick={() => handleJobFacturadoToggle(job, allItems)}
                                >
                                  {status === 'all' && (
                                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                  {status === 'partial' && (
                                    <div className="w-2 h-2 bg-black rounded-sm"></div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="icon"
                            className="border border-black"
                            onClick={() => handleSelectJob(job)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalJobsPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {currentJobsPage} de {totalJobsPages} ({sortedJobs.length} items)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentJobsPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentJobsPage === 1}
                      className="border border-black"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentJobsPage((prev) => Math.min(totalJobsPages, prev + 1))}
                      disabled={currentJobsPage === totalJobsPages}
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

        {/* Job Details Drawer */}
        <Drawer open={openDrawer} onOpenChange={setOpenDrawer} modal={false}>
          <DrawerContent className="flex flex-col max-h-[85vh]">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Detalhes da Faturação</DrawerTitle>
              <DrawerDescription>
                {selectedJob?.numero_fo} - {selectedJob?.nome_campanha}
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 relative" style={{ minHeight: 0 }}>
              {/* Close button - top right */}
              <Button
                size="icon"
                variant="outline"
                onClick={handleCloseDrawer}
                className="absolute top-6 right-6 z-10 border border-black"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Job Info Header */}
              <div className="mb-6 p-4 uppercase">
                <div className="mb-2 flex items-center gap-8">
                  <div>
                    <div className="text-xs">ORC</div>
                    <div className="font-mono">{selectedJob?.numero_orc ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs">FO</div>
                    <div className="font-mono">{selectedJob?.numero_fo}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs">Nome Campanha</div>
                    <div className="truncate font-mono">{selectedJob?.nome_campanha}</div>
                  </div>
                </div>
              </div>

              {/* Items section */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm uppercase">Itens do Trabalho</h3>
                    <span className="text-xs text-muted-foreground italic">Marcar como facturado</span>
                  </div>
                  {itemsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : selectedJobItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum item encontrado</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {paginatedItems.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted">
                            <div className="flex items-center pt-1">
                              <Checkbox
                                checked={item.facturado || false}
                                onCheckedChange={(checked) => handleItemFacturadoToggle(item.id, checked as boolean)}
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.descricao}</p>
                              <p className="text-xs text-muted-foreground">
                                Código: {item.codigo || '-'} | Qtd: {item.quantidade || '-'}
                              </p>
                              {item.data_concluido && (
                                <p className="text-xs text-success-foreground">
                                  Concluído: {new Date(item.data_concluido).toLocaleDateString('pt-PT')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination Controls */}
                      {totalItemsPages > 1 && (
                        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                          <div className="text-sm text-muted-foreground">
                            Página {currentItemsPage} de {totalItemsPages} ({selectedJobItems.length} items)
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentItemsPage((prev) => Math.max(1, prev - 1))}
                              disabled={currentItemsPage === 1}
                              className="border border-black"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentItemsPage((prev) => Math.min(totalItemsPages, prev + 1))}
                              disabled={currentItemsPage === totalItemsPages}
                              className="border border-black"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </PermissionGuard>
  )
}

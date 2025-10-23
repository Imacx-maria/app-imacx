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
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Plus,
  Trash2,
  X,
  Loader2,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Eye,
  FolderSync,
  Copy,
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
}

export default function FaturacaoPage() {
  const supabase = createBrowserClient()

  // State management
  const [activeTab, setActiveTab] = useState('jobs')
  const [jobs, setJobs] = useState<Job[]>([])
  const [items, setItems] = useState<Item[]>([])
  
  const [loading, setLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  
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
  const [showInvoiced, setShowInvoiced] = useState(false)

  // Debounced filter values
  const debouncedFoFilter = useDebounce(foFilter, 300)
  const debouncedOrcFilter = useDebounce(orcFilter, 300)
  const debouncedCampanhaFilter = useDebounce(campanhaFilter, 300)
  const debouncedClienteFilter = useDebounce(clienteFilter, 300)

  // Sorting states
  const [sortColumn, setSortColumn] = useState('numero_fo')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Form state
  const [editFormData, setEditFormData] = useState({
    numero_fo: '',
    numero_orc: '',
    nome_campanha: '',
    cliente: '',
    data_saida: '',
    fatura: false,
    notas: '',
  })

  // Data fetching
  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('folhas_obras')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      // Filter by invoice status
      if (!showInvoiced) {
        query = query.or('fatura.is.null,fatura.eq.false')
      }

      // Filter by ORC (required for invoicing)
      query = query.not('numero_orc', 'is', null)

      const { data, error } = await query

      if (!error && data) {
        setJobs(data)
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, showInvoiced])

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

  // Handle job selection
  const handleSelectJob = async (job: Job) => {
    setSelectedJob(job)
    setEditFormData({
      numero_fo: job.numero_fo,
      numero_orc: job.numero_orc?.toString() || '',
      nome_campanha: job.nome_campanha,
      cliente: job.cliente || '',
      data_saida: job.data_saida || '',
      fatura: job.fatura || false,
      notas: job.notas || '',
    })
    await fetchItemsForJob(job.id)
    setOpenDrawer(true)
  }

  // Handle save job
  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedJob || !editFormData.numero_orc) {
      alert('ORC é obrigatório para faturação')
      return
    }

    try {
      const { error } = await supabase
        .from('folhas_obras')
        .update({
          fatura: editFormData.fatura,
          notas: editFormData.notas || null,
        })
        .eq('id', selectedJob.id)

      if (error) throw error

      await fetchJobs()
      setOpenDrawer(false)
    } catch (error) {
      console.error('Error saving job:', error)
      alert(`Erro ao guardar: ${error}`)
    }
  }

  // Handle ETL Sync
  const handleETLSync = async (type: 'incremental' | 'full') => {
    setSyncing(true)
    try {
      const response = await fetch(`/api/etl/${type}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`ETL ${type} failed`)
      }

      alert(`ETL ${type} completado com sucesso!`)
      await fetchJobs()
    } catch (error) {
      console.error(`Error syncing ETL ${type}:`, error)
      alert(`Erro ao sincronizar: ${error}`)
    } finally {
      setSyncing(false)
    }
  }

  // Filter and sort jobs
  const getFilteredJobs = useCallback(() => {
    let filtered = jobs

    // Apply text filters
    if (debouncedFoFilter) {
      filtered = filtered.filter((j) =>
        j.numero_fo.toLowerCase().includes(debouncedFoFilter.toLowerCase())
      )
    }

    if (debouncedOrcFilter) {
      filtered = filtered.filter((j) =>
        j.numero_orc?.toString().includes(debouncedOrcFilter)
      )
    }

    if (debouncedCampanhaFilter) {
      filtered = filtered.filter((j) =>
        j.nome_campanha.toLowerCase().includes(debouncedCampanhaFilter.toLowerCase())
      )
    }

    if (debouncedClienteFilter) {
      filtered = filtered.filter((j) =>
        j.cliente?.toLowerCase().includes(debouncedClienteFilter.toLowerCase())
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="jobs">Trabalhos</TabsTrigger>
            <TabsTrigger value="etl">Sincronização</TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
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
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={showInvoiced}
                    onCheckedChange={(checked) => setShowInvoiced(checked as boolean)}
                  />
                  Mostrar Faturados
                </label>
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
              <Table>
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
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase text-center">Faturado</TableHead>
                    <TableHead className="bg-primary text-primary-foreground font-bold uppercase text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum trabalho encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedJobs.map((job) => (
                      <TableRow key={job.id} className="hover:bg-muted">
                        <TableCell className="font-mono font-bold">{job.numero_fo}</TableCell>
                        <TableCell className="font-mono">{job.numero_orc || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{job.nome_campanha}</TableCell>
                        <TableCell className="max-w-xs truncate">{job.cliente || '-'}</TableCell>
                        <TableCell>{job.created_at ? new Date(job.created_at).toLocaleDateString('pt-PT') : '-'}</TableCell>
                        <TableCell className="text-center">
                          <Checkbox checked={job.fatura || false} disabled />
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

          {/* ETL Sync Tab */}
          <TabsContent value="etl" className="space-y-4">
            <div className="space-y-4">
              <div className="border rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4">Sincronização de Dados ETL</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Sincronize dados com a base de dados usando os scripts ETL disponíveis.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => handleETLSync('incremental')}
                    disabled={syncing}
                    className="flex items-center gap-2"
                  >
                    {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
                    <FolderSync className="h-4 w-4" />
                    Sincronização Incremental
                  </Button>
                  
                  <Button
                    onClick={() => handleETLSync('full')}
                    disabled={syncing}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
                    <FolderSync className="h-4 w-4" />
                    Sincronização Completa
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4">Informações</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Trabalhos carregados:</strong> {jobs.length}</p>
                  <p><strong>Trabalhos para faturar:</strong> {jobs.filter((j) => !j.fatura).length}</p>
                  <p><strong>Trabalhos faturados:</strong> {jobs.filter((j) => j.fatura).length}</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Job Details Drawer */}
        <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
          <DrawerContent className="flex flex-col max-h-[85vh]">
            <DrawerHeader className="flex-shrink-0">
              <DrawerTitle>Detalhes da Faturação</DrawerTitle>
              <DrawerDescription>
                {selectedJob?.numero_fo} - {selectedJob?.nome_campanha}
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4" style={{ minHeight: 0 }}>
              <form onSubmit={handleSaveJob} className="space-y-4">
                {/* FO & ORC */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="numero_fo" className="text-sm font-semibold uppercase">FO</Label>
                    <Input
                      id="numero_fo"
                      value={editFormData.numero_fo}
                      disabled
                      className="mt-2 bg-muted"
                    />
                  </div>
                  <div>
                    <Label htmlFor="numero_orc" className="text-sm font-semibold uppercase">ORC *</Label>
                    <Input
                      id="numero_orc"
                      value={editFormData.numero_orc}
                      disabled
                      className="mt-2 bg-muted"
                    />
                  </div>
                </div>

                {/* Campanha & Cliente */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome_campanha" className="text-sm font-semibold uppercase">Campanha</Label>
                    <Input
                      id="nome_campanha"
                      value={editFormData.nome_campanha}
                      disabled
                      className="mt-2 bg-muted"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cliente" className="text-sm font-semibold uppercase">Cliente</Label>
                    <Input
                      id="cliente"
                      value={editFormData.cliente}
                      disabled
                      className="mt-2 bg-muted"
                    />
                  </div>
                </div>

                {/* Invoice Status */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editFormData.fatura}
                      onCheckedChange={(checked) =>
                        setEditFormData({ ...editFormData, fatura: checked as boolean })
                      }
                    />
                    <span className="text-sm font-semibold uppercase">Marcado como Faturado</span>
                  </label>
                </div>

                {/* Items section */}
                <div>
                  <h3 className="font-semibold text-sm uppercase mb-3">Itens do Trabalho</h3>
                  {itemsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : selectedJobItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum item encontrado</p>
                  ) : (
                    <>
                      <div className="space-y-2 border rounded-lg p-3">
                        {paginatedItems.map((item) => (
                          <div key={item.id} className="flex items-start gap-2 p-2 border-b">
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

                {/* Form Actions */}
                <div className="flex gap-4 pt-6">
                  <Button type="submit" className="flex-1 border border-black">
                    Guardar
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

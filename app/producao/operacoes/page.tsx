'use client'

/**
 * Produção - Operações Page
 * --------------------------------------------------------------
 * Standalone operations management page for production workflow
 * Tracks operations, operators, machines, materials, and completion status
 * 
 * FILTERING RULES:
 * - Real-time search across FO, operators, machines, items
 * - Tab-based organization (Em Curso, Concluídas)
 * - Debounced filters for optimal performance
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
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
  Trash2,
  X,
  Check,
  Edit,
  Loader2,
  Factory,
  User,
  Package,
  Settings,
  Calendar,
  CheckCircle2,
  XSquare,
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/* ---------- TypeScript Interfaces ---------- */

interface Operacao {
  id: string
  data_operacao: string
  operador_id: string | null
  folha_obra_id: string | null
  item_id: string | null
  no_interno: string
  maquina: string | null
  material_id: string | null
  stock_consumido_id: string | null
  num_placas_print: number
  num_placas_corte: number
  observacoes: string | null
  status: string
  concluido: boolean
  data_conclusao: string | null
  created_at: string
  updated_at: string
  Tipo_Op: string | null
  N_Pal: string | null
  notas: string | null
  notas_imp: string | null
  QT_print: number | null
  tem_corte: boolean | null
}

interface Profile {
  id: string
  email: string
  nome: string | null
}

interface FolhaObra {
  id: string
  numero_fo: string | null
  numero_orc: string | null
  campanha: string | null
}

interface Item {
  id: string
  folha_obra_id: string
  item_description: string | null
  codigo_artigo: string | null
}

interface Maquina {
  id: string
  nome: string
  tipo: string | null
}

interface Material {
  id: string
  material: string
  referencia: string | null
}

type SortField = 'data_operacao' | 'no_interno' | 'concluido'
type SortDirection = 'asc' | 'desc'

/* ---------- Main Component ---------- */

export default function OperacoesPage() {
  const supabase = useMemo(() => createBrowserClient(), [])

  /* State */
  const [operacoes, setOperacoes] = useState<Operacao[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [folhasObras, setFolhasObras] = useState<FolhaObra[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  /* Filters */
  const [foFilter, setFoFilter] = useState('')
  const [operadorFilter, setOperadorFilter] = useState('')
  const [maquinaFilter, setMaquinaFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')

  /* Debounced Filters */
  const debouncedFoFilter = useDebounce(foFilter, 300)
  const debouncedOperadorFilter = useDebounce(operadorFilter, 300)
  const debouncedMaquinaFilter = useDebounce(maquinaFilter, 300)
  const debouncedItemFilter = useDebounce(itemFilter, 300)

  /* Sorting */
  const [sortField, setSortField] = useState<SortField>('data_operacao')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  /* Tab State */
  const [activeTab, setActiveTab] = useState<'em_curso' | 'concluidas'>('em_curso')

  /* Form State */
  const [formData, setFormData] = useState<Partial<Operacao>>({
    data_operacao: new Date().toISOString().split('T')[0],
    no_interno: '',
    num_placas_print: 0,
    num_placas_corte: 0,
    concluido: false,
    status: 'Em_Curso',
  })

  /* ---------- Data Fetching ---------- */

  const fetchOperacoes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('producao_operacoes')
        .select('*')
        .order('data_operacao', { ascending: false })

      if (error) throw error
      console.log('✅ Fetched operations:', data?.length || 0, 'total records')
      console.log('Sample data:', data?.[0])
      setOperacoes(data || [])
    } catch (err: any) {
      console.error('❌ Error fetching operations:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nome')
        .order('nome')

      if (error) throw error
      setProfiles(data || [])
    } catch (err) {
      console.error('Error fetching profiles:', err)
    }
  }, [supabase])

  const fetchFolhasObras = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('folhas_obras')
        .select('id, numero_fo, numero_orc, campanha')
        .order('numero_fo')

      if (error) throw error
      setFolhasObras(data || [])
    } catch (err) {
      console.error('Error fetching folhas obras:', err)
    }
  }, [supabase])

  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('items_base')
        .select('id, folha_obra_id, item_description, codigo_artigo')

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Error fetching items:', err)
    }
  }, [supabase])

  const fetchMaquinas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('maquinas_operacao')
        .select('id, nome, tipo')
        .order('nome')

      if (error) throw error
      setMaquinas(data || [])
    } catch (err) {
      console.error('Error fetching machines:', err)
    }
  }, [supabase])

  const fetchMateriais = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('materiais')
        .select('id, material, referencia')
        .order('material')

      if (error) throw error
      setMateriais(data || [])
    } catch (err) {
      console.error('Error fetching materials:', err)
    }
  }, [supabase])

  useEffect(() => {
    fetchOperacoes()
    fetchProfiles()
    fetchFolhasObras()
    fetchItems()
    fetchMaquinas()
    fetchMateriais()
  }, [fetchOperacoes, fetchProfiles, fetchFolhasObras, fetchItems, fetchMaquinas, fetchMateriais])

  /* ---------- Filtering & Sorting ---------- */

  const filteredOperacoes = useMemo(() => {
    let filtered = operacoes
    console.log('🔍 Total operations before filtering:', operacoes.length)

    // Tab filtering
    if (activeTab === 'em_curso') {
      filtered = filtered.filter((op) => !op.concluido)
      console.log('📋 Em Curso (concluido=false):', filtered.length)
    } else {
      filtered = filtered.filter((op) => op.concluido)
      console.log('✅ Concluídas (concluido=true):', filtered.length)
    }

    // Search filters
    if (debouncedFoFilter) {
      filtered = filtered.filter((op) => {
        const fo = folhasObras.find((f) => f.id === op.folha_obra_id)
        const foNum = fo?.numero_fo || ''
        return foNum.toLowerCase().includes(debouncedFoFilter.toLowerCase())
      })
    }

    if (debouncedOperadorFilter) {
      filtered = filtered.filter((op) => {
        const profile = profiles.find((p) => p.id === op.operador_id)
        const name = profile?.nome || profile?.email || ''
        return name.toLowerCase().includes(debouncedOperadorFilter.toLowerCase())
      })
    }

    if (debouncedMaquinaFilter) {
      filtered = filtered.filter((op) => {
        const maquina = maquinas.find((m) => m.id === op.maquina)
        const name = maquina?.nome || ''
        return name.toLowerCase().includes(debouncedMaquinaFilter.toLowerCase())
      })
    }

    if (debouncedItemFilter) {
      filtered = filtered.filter((op) => {
        const item = items.find((i) => i.id === op.item_id)
        const desc = item?.item_description || ''
        const code = item?.codigo_artigo || ''
        return (
          desc.toLowerCase().includes(debouncedItemFilter.toLowerCase()) ||
          code.toLowerCase().includes(debouncedItemFilter.toLowerCase())
        )
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      if (sortField === 'concluido') {
        aVal = a.concluido ? 1 : 0
        bVal = b.concluido ? 1 : 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [
    operacoes,
    activeTab,
    debouncedFoFilter,
    debouncedOperadorFilter,
    debouncedMaquinaFilter,
    debouncedItemFilter,
    sortField,
    sortDirection,
    folhasObras,
    profiles,
    maquinas,
    items,
  ])

  /* ---------- Handlers ---------- */

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleCreate = () => {
    setFormData({
      data_operacao: new Date().toISOString().split('T')[0],
      no_interno: '',
      num_placas_print: 0,
      num_placas_corte: 0,
      concluido: false,
      status: 'Em_Curso',
    })
    setIsCreating(true)
  }

  const handleEdit = (operacao: Operacao) => {
    setFormData(operacao)
    setOpenId(operacao.id)
  }

  const handleSave = async () => {
    try {
      if (isCreating) {
        const { error } = await supabase.from('producao_operacoes').insert([formData])
        if (error) throw error
      } else if (openId) {
        const { error } = await supabase
          .from('producao_operacoes')
          .update(formData)
          .eq('id', openId)
        if (error) throw error
      }

      await fetchOperacoes()
      setIsCreating(false)
      setOpenId(null)
    } catch (err: any) {
      console.error('Error saving operation:', err)
      alert('Erro ao guardar operação: ' + err.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      const { error } = await supabase.from('producao_operacoes').delete().eq('id', deleteId)
      if (error) throw error

      await fetchOperacoes()
      setDeleteId(null)
    } catch (err: any) {
      console.error('Error deleting operation:', err)
      alert('Erro ao eliminar operação: ' + err.message)
    }
  }

  const toggleConcluido = async (id: string, current: boolean) => {
    try {
      const updates: any = { concluido: !current }
      if (!current) {
        updates.data_conclusao = new Date().toISOString()
        updates.status = 'Concluído'
      } else {
        updates.data_conclusao = null
        updates.status = 'Em_Curso'
      }

      const { error } = await supabase.from('producao_operacoes').update(updates).eq('id', id)
      if (error) throw error

      await fetchOperacoes()
    } catch (err: any) {
      console.error('Error toggling completion:', err)
    }
  }

  /* ---------- Helper Functions ---------- */

  const getOperadorName = (operadorId: string | null) => {
    if (!operadorId) return '-'
    const profile = profiles.find((p) => p.id === operadorId)
    return profile?.nome || profile?.email || '-'
  }

  const getFolhaObraNumber = (foId: string | null) => {
    if (!foId) return '-'
    const fo = folhasObras.find((f) => f.id === foId)
    return fo?.numero_fo || '-'
  }

  const getMaquinaName = (maquinaId: string | null) => {
    if (!maquinaId) return '-'
    const maquina = maquinas.find((m) => m.id === maquinaId)
    return maquina?.nome || '-'
  }

  const getItemDescription = (itemId: string | null) => {
    if (!itemId) return '-'
    const item = items.find((i) => i.id === itemId)
    return item?.item_description || '-'
  }

  const getMaterialName = (materialId: string | null) => {
    if (!materialId) return '-'
    const material = materiais.find((m) => m.id === materialId)
    return material?.material || '-'
  }

  /* ---------- Render Helpers ---------- */

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUp className="h-3 w-3 opacity-30" />
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    )
  }

  /* ---------- Render ---------- */

  if (loading && operacoes.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">A carregar operações...</p>
        </div>
      </div>
    )
  }

  if (error && operacoes.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <X className="h-12 w-12 text-destructive" />
          <p className="text-lg font-semibold">Erro ao carregar operações</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={fetchOperacoes}>
            <RotateCw className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 p-6 h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Produção - Operações</h1>
          <p className="text-muted-foreground">
            Gestão de operações de produção
            {operacoes.length > 0 && (
              <span className="ml-2">
                • {operacoes.length} {operacoes.length === 1 ? 'operação' : 'operações'} total
                {activeTab === 'em_curso' && ` • ${filteredOperacoes.length} em curso`}
                {activeTab === 'concluidas' && ` • ${filteredOperacoes.length} concluídas`}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchOperacoes} variant="outline" size="icon" className="border border-black">
            <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreate} className="bg-yellow-400 hover:bg-yellow-500 border border-black text-black">
            <Plus className="mr-2 h-4 w-4" />
            Nova Operação
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="em_curso">Em Curso</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
        </TabsList>

        <TabsContent value="em_curso" className="flex-1 overflow-hidden flex flex-col space-y-6 mt-0 pt-6">
          {/* Filters */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="relative">
                <Input
                  placeholder="Filtrar por FO..."
                  value={foFilter}
                  onChange={(e) => setFoFilter(e.target.value)}
                  className="pr-10"
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
              <div className="relative">
                <Input
                  placeholder="Filtrar por Operador..."
                  value={operadorFilter}
                  onChange={(e) => setOperadorFilter(e.target.value)}
                  className="pr-10"
                />
                {operadorFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => setOperadorFilter('')}
                  >
                    <XSquare className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <Input
                  placeholder="Filtrar por Máquina..."
                  value={maquinaFilter}
                  onChange={(e) => setMaquinaFilter(e.target.value)}
                  className="pr-10"
                />
                {maquinaFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => setMaquinaFilter('')}
                  >
                    <XSquare className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <Input
                  placeholder="Filtrar por Item..."
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value)}
                  className="pr-10"
                />
                {itemFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => setItemFilter('')}
                  >
                    <XSquare className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="bg-yellow-400 hover:bg-yellow-500 border border-black"
                        onClick={() => {
                          setFoFilter('')
                          setOperadorFilter('')
                          setMaquinaFilter('')
                          setItemFilter('')
                        }}
                        disabled={!foFilter && !operadorFilter && !maquinaFilter && !itemFilter}
                      >
                        <XSquare className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Limpar Filtros</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead className="w-[100px]">
                    <button
                      onClick={() => handleSort('data_operacao')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Data
                      <SortIcon field="data_operacao" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('no_interno')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Nº Interno
                      <SortIcon field="no_interno" />
                    </button>
                  </TableHead>
                  <TableHead>FO</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo Op</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOperacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nenhuma operação em curso encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOperacoes.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>{format(new Date(op.data_operacao), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{op.no_interno}</TableCell>
                      <TableCell>{getFolhaObraNumber(op.folha_obra_id)}</TableCell>
                      <TableCell>{getOperadorName(op.operador_id)}</TableCell>
                      <TableCell>{getMaquinaName(op.maquina)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{getItemDescription(op.item_id)}</TableCell>
                      <TableCell>{op.Tipo_Op || '-'}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {op.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="border border-black"
                                  onClick={() => handleEdit(op)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver Detalhes</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="border border-black"
                                  onClick={() => toggleConcluido(op.id, op.concluido)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Marcar como Concluída</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="border border-black"
                                  onClick={() => setDeleteId(op.id)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="concluidas" className="flex-1 overflow-hidden flex flex-col space-y-6 mt-0 pt-6">
          {/* Filters */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="relative">
                <Input
                  placeholder="Filtrar por FO..."
                  value={foFilter}
                  onChange={(e) => setFoFilter(e.target.value)}
                  className="pr-10"
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
              <div className="relative">
                <Input
                  placeholder="Filtrar por Operador..."
                  value={operadorFilter}
                  onChange={(e) => setOperadorFilter(e.target.value)}
                  className="pr-10"
                />
                {operadorFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => setOperadorFilter('')}
                  >
                    <XSquare className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <Input
                  placeholder="Filtrar por Máquina..."
                  value={maquinaFilter}
                  onChange={(e) => setMaquinaFilter(e.target.value)}
                  className="pr-10"
                />
                {maquinaFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => setMaquinaFilter('')}
                  >
                    <XSquare className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <Input
                  placeholder="Filtrar por Item..."
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value)}
                  className="pr-10"
                />
                {itemFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                    onClick={() => setItemFilter('')}
                  >
                    <XSquare className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="bg-yellow-400 hover:bg-yellow-500 border border-black"
                        onClick={() => {
                          setFoFilter('')
                          setOperadorFilter('')
                          setMaquinaFilter('')
                          setItemFilter('')
                        }}
                        disabled={!foFilter && !operadorFilter && !maquinaFilter && !itemFilter}
                      >
                        <XSquare className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Limpar Filtros</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead className="w-[100px]">
                    <button
                      onClick={() => handleSort('data_operacao')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Data
                      <SortIcon field="data_operacao" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('no_interno')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Nº Interno
                      <SortIcon field="no_interno" />
                    </button>
                  </TableHead>
                  <TableHead>FO</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Data Conclusão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOperacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhuma operação concluída encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOperacoes.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>{format(new Date(op.data_operacao), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{op.no_interno}</TableCell>
                      <TableCell>{getFolhaObraNumber(op.folha_obra_id)}</TableCell>
                      <TableCell>{getOperadorName(op.operador_id)}</TableCell>
                      <TableCell>{getMaquinaName(op.maquina)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{getItemDescription(op.item_id)}</TableCell>
                      <TableCell>
                        {op.data_conclusao ? format(new Date(op.data_conclusao), 'dd/MM/yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="border border-black"
                                  onClick={() => handleEdit(op)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver Detalhes</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="border border-black"
                                  onClick={() => setDeleteId(op.id)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit/Create Drawer */}
      <Drawer open={openId !== null || isCreating} onOpenChange={(open) => { if (!open) { setOpenId(null); setIsCreating(false) } }}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{isCreating ? 'Nova Operação' : 'Editar Operação'}</DrawerTitle>
            <DrawerDescription>
              {isCreating ? 'Criar uma nova operação de produção' : 'Editar informações da operação'}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto p-4">
            <div className="grid gap-4">
              {/* Data Operação */}
              <div className="grid gap-2">
                <Label>Data da Operação *</Label>
                <Input
                  type="date"
                  value={formData.data_operacao || ''}
                  onChange={(e) => setFormData({ ...formData, data_operacao: e.target.value })}
                />
              </div>

              {/* Nº Interno */}
              <div className="grid gap-2">
                <Label>Nº Interno *</Label>
                <Input
                  value={formData.no_interno || ''}
                  onChange={(e) => setFormData({ ...formData, no_interno: e.target.value })}
                  placeholder="Número interno da operação"
                />
              </div>

              {/* Folha de Obra */}
              <div className="grid gap-2">
                <Label>Folha de Obra</Label>
                <Select
                  value={formData.folha_obra_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, folha_obra_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar FO..." />
                  </SelectTrigger>
                  <SelectContent>
                    {folhasObras.map((fo) => (
                      <SelectItem key={fo.id} value={fo.id}>
                        {fo.numero_fo || 'Sem número'} {fo.campanha ? `- ${fo.campanha}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Item */}
              <div className="grid gap-2">
                <Label>Item</Label>
                <Select
                  value={formData.item_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, item_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {items
                      .filter((item) => !formData.folha_obra_id || item.folha_obra_id === formData.folha_obra_id)
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.item_description || item.codigo_artigo || 'Sem descrição'}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operador */}
              <div className="grid gap-2">
                <Label>Operador</Label>
                <Select
                  value={formData.operador_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, operador_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar operador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.nome || profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Máquina */}
              <div className="grid gap-2">
                <Label>Máquina</Label>
                <Select
                  value={formData.maquina || ''}
                  onValueChange={(value) => setFormData({ ...formData, maquina: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar máquina..." />
                  </SelectTrigger>
                  <SelectContent>
                    {maquinas.map((maq) => (
                      <SelectItem key={maq.id} value={maq.id}>
                        {maq.nome} {maq.tipo ? `(${maq.tipo})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Material */}
              <div className="grid gap-2">
                <Label>Material</Label>
                <Select
                  value={formData.material_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, material_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar material..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materiais.map((mat) => (
                      <SelectItem key={mat.id} value={mat.id}>
                        {mat.material} {mat.referencia ? `- ${mat.referencia}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo Operação */}
              <div className="grid gap-2">
                <Label>Tipo de Operação</Label>
                <Input
                  value={formData.Tipo_Op || ''}
                  onChange={(e) => setFormData({ ...formData, Tipo_Op: e.target.value })}
                  placeholder="Ex: Impressão, Corte, Acabamento..."
                />
              </div>

              {/* Números */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Nº Placas Print</Label>
                  <Input
                    type="number"
                    value={formData.num_placas_print || 0}
                    onChange={(e) => setFormData({ ...formData, num_placas_print: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Nº Placas Corte</Label>
                  <Input
                    type="number"
                    value={formData.num_placas_corte || 0}
                    onChange={(e) => setFormData({ ...formData, num_placas_corte: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* QT Print */}
              <div className="grid gap-2">
                <Label>Quantidade Print</Label>
                <Input
                  type="number"
                  value={formData.QT_print || 0}
                  onChange={(e) => setFormData({ ...formData, QT_print: parseInt(e.target.value) || 0 })}
                />
              </div>

              {/* Nº Palete */}
              <div className="grid gap-2">
                <Label>Nº Palete</Label>
                <Input
                  value={formData.N_Pal || ''}
                  onChange={(e) => setFormData({ ...formData, N_Pal: e.target.value })}
                  placeholder="Número do palete"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.tem_corte || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, tem_corte: checked as boolean })}
                  />
                  <Label>Tem Corte</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.concluido || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, concluido: checked as boolean })}
                  />
                  <Label>Concluído</Label>
                </div>
              </div>

              {/* Observações */}
              <div className="grid gap-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes || ''}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações gerais..."
                  rows={3}
                />
              </div>

              {/* Notas */}
              <div className="grid gap-2">
                <Label>Notas</Label>
                <Textarea
                  value={formData.notas || ''}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  placeholder="Notas internas..."
                  rows={2}
                />
              </div>

              {/* Notas Importantes */}
              <div className="grid gap-2">
                <Label>Notas Importantes</Label>
                <Textarea
                  value={formData.notas_imp || ''}
                  onChange={(e) => setFormData({ ...formData, notas_imp: e.target.value })}
                  placeholder="Notas importantes..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border p-4">
            <Button variant="outline" className="border border-black" onClick={() => { setOpenId(null); setIsCreating(false) }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-yellow-400 hover:bg-yellow-500 border border-black text-black">
              <Check className="mr-2 h-4 w-4" />
              Guardar
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminação</DialogTitle>
            <DialogDescription>
              Tem a certeza que deseja eliminar esta operação? Esta ação não pode ser revertida.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="border border-black" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="border border-black" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, Eye, Trash2, X, Loader2, Edit, RotateCw } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { useDebounce } from '@/hooks/useDebounce'

interface Armazem {
  id: string
  numero_phc: string | null
  nome_arm: string
  morada: string | null
  codigo_pos: string | null
  created_at: string
  updated_at: string
}

export default function ArmazensPage() {
  const [armazens, setArmazens] = useState<Armazem[]>([])
  const [loading, setLoading] = useState(true)
  const [openDrawer, setOpenDrawer] = useState(false)
  const [editingArmazem, setEditingArmazem] = useState<Armazem | null>(null)
  const [formData, setFormData] = useState({
    numero_phc: '',
    nome_arm: '',
    morada: '',
    codigo_pos: '',
  })
  const [nameFilter, setNameFilter] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Debounced filter values for performance
  const debouncedNameFilter = useDebounce(nameFilter, 300)

  // Effective filter - only activate with 3+ characters
  const effectiveNameFilter = debouncedNameFilter.trim().length >= 3 ? debouncedNameFilter : ''

  const supabase = createBrowserClient()

  // Convert to database-level filtering
  const fetchArmazens = useCallback(
    async (filters: { nameFilter?: string } = {}) => {
      setLoading(true)
      try {
        let query = supabase.from('armazens').select('*')

        // Apply filters at database level
        if (filters.nameFilter?.trim?.()) {
          const searchTerm = filters.nameFilter.trim()
          // Search in both nome_arm and numero_phc fields
          query = query.or(
            `nome_arm.ilike.%${searchTerm}%,numero_phc.ilike.%${searchTerm}%`,
          )
        }

        const { data, error } = await query.order('nome_arm', {
          ascending: true,
        })

        if (!error && data) {
          setArmazens(data)
        }
      } catch (error) {
        console.error('Error fetching armazens:', error)
      } finally {
        setLoading(false)
      }
    },
    [supabase],
  )

  // Initial load
  useEffect(() => {
    fetchArmazens()
  }, [fetchArmazens])

  // Trigger search when filter changes
  useEffect(() => {
    fetchArmazens({ nameFilter: effectiveNameFilter })
  }, [effectiveNameFilter, fetchArmazens])

  // Remove client-side filtering - now using database-level filtering
  const filteredArmazens = armazens

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nome_arm.trim()) return

    setSubmitting(true)
    try {
      if (editingArmazem) {
        // Update existing armazem
        const { data, error } = await supabase
          .from('armazens')
          .update({
            numero_phc: formData.numero_phc || null,
            nome_arm: formData.nome_arm,
            morada: formData.morada || null,
            codigo_pos: formData.codigo_pos || null,
            updated_at: new Date().toISOString().split('T')[0],
          })
          .eq('id', editingArmazem.id)
          .select('*')

        if (!error && data && data[0]) {
          setArmazens((prev) =>
            prev.map((a) => (a.id === editingArmazem.id ? data[0] : a)),
          )
        }
      } else {
        // Create new armazem
        const { data, error } = await supabase
          .from('armazens')
          .insert({
            numero_phc: formData.numero_phc || null,
            nome_arm: formData.nome_arm,
            morada: formData.morada || null,
            codigo_pos: formData.codigo_pos || null,
          })
          .select('*')

        if (!error && data && data[0]) {
          setArmazens((prev) => [...prev, data[0]])
        }
      }

      resetForm()
    } catch (error) {
      console.error('Error saving armazem:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (armazem: Armazem) => {
    setEditingArmazem(armazem)
    setFormData({
      numero_phc: armazem.numero_phc || '',
      nome_arm: armazem.nome_arm,
      morada: armazem.morada || '',
      codigo_pos: armazem.codigo_pos || '',
    })
    setOpenDrawer(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este armazém?')) return

    try {
      const { error } = await supabase.from('armazens').delete().eq('id', id)

      if (!error) {
        setArmazens((prev) => prev.filter((a) => a.id !== id))
      }
    } catch (error) {
      console.error('Error deleting armazem:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      numero_phc: '',
      nome_arm: '',
      morada: '',
      codigo_pos: '',
    })
    setEditingArmazem(null)
    setOpenDrawer(false)
  }

  const openNewForm = () => {
    resetForm()
    setOpenDrawer(true)
  }

  return (
    <PermissionGuard>
      <div className="w-full space-y-6 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Gestão de Armazéns</h1>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fetchArmazens()}
                    aria-label="Atualizar lista"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Atualizar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={openNewForm}
                    variant="default"
                    size="icon"
                    aria-label="Adicionar"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adicionar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Filter bar - standardized */}
        <div className="mb-6 flex items-center gap-2">
          <Input
            placeholder="Nome ou Número PHC"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="h-10 flex-1"
            title="Mínimo 3 caracteres para filtrar"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
                  onClick={() => setNameFilter('')}
                  aria-label="Limpar filtro"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Limpar filtro</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    fetchArmazens({ nameFilter: effectiveNameFilter })
                  }
                  aria-label="Atualizar"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Table */}
        <div className="bg-background w-full">
          <div className="w-full">
            <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-10 w-[120px] border-b text-center uppercase">
                    Número PHC
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 min-w-[200px] border-b text-center uppercase">
                    Nome do Armazém
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 min-w-[250px] border-b text-center uppercase">
                    Morada
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 w-[120px] border-b text-center uppercase">
                    Código Postal
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 w-[90px] border-b text-center uppercase">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-40 text-center uppercase"
                    >
                      <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filteredArmazens.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground uppercase"
                    >
                      Nenhum armazém encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredArmazens.map((armazem) => (
                    <TableRow
                      key={armazem.id}
                      className="hover:bg-accent transition-colors"
                    >
                      <TableCell className="uppercase">
                        {armazem.numero_phc || '-'}
                      </TableCell>
                      <TableCell className="font-medium uppercase">
                        {armazem.nome_arm}
                      </TableCell>
                      <TableCell className="uppercase">
                        {armazem.morada || '-'}
                      </TableCell>
                      <TableCell className="uppercase">
                        {armazem.codigo_pos || '-'}
                      </TableCell>
                      <TableCell className="flex justify-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="default"
                                size="icon"
                                onClick={() => handleEdit(armazem)}
                                aria-label="Ver detalhes do armazém"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDelete(armazem.id)}
                                aria-label="Eliminar armazém"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Eliminar</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Drawer for add/edit form */}
        <Drawer open={openDrawer} onOpenChange={(open) => !open && resetForm()}>
          <DrawerContent className="!top-0 !mt-0 h-screen min-h-screen">
            <div className="flex h-full w-full flex-col px-4 md:px-8">
              <DrawerHeader className="flex-none">
                <div className="mb-2 flex items-center justify-end gap-2">
                  <DrawerClose asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Fechar"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </DrawerClose>
                </div>
                <DrawerTitle>
                  {editingArmazem ? 'Editar Armazém' : 'Novo Armazém'}
                </DrawerTitle>
                <DrawerDescription>
                  {editingArmazem
                    ? 'Edite as informações do armazém abaixo.'
                    : 'Preencha as informações para criar um novo armazém.'}
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex-grow overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="numero_phc" className="text-sm">
                      Número PHC
                    </Label>
                      <Input
                        id="numero_phc"
                        value={formData.numero_phc}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            numero_phc: e.target.value,
                          }))
                        }
                      placeholder="Número do sistema PHC"
                      className="h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="nome_arm" className="text-sm">
                      Nome do Armazém *
                    </Label>
                    <Input
                      id="nome_arm"
                      value={formData.nome_arm}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          nome_arm: e.target.value,
                        }))
                      }
                      placeholder="Nome do armazém"
                      required
                      className="h-10"
                    />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="morada" className="text-sm">
                      Morada
                    </Label>
                    <Textarea
                      id="morada"
                      value={formData.morada}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          morada: e.target.value,
                        }))
                      }
                      placeholder="Morada completa do armazém"
                      className="h-24 min-h-[80px] w-full resize-none"
                    />
                  </div>

                  <div>
                    <Label htmlFor="codigo_pos" className="text-sm">
                      Código Postal
                    </Label>
                    <Input
                      id="codigo_pos"
                      value={formData.codigo_pos}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          codigo_pos: e.target.value,
                        }))
                      }
                      placeholder="Ex: 1000-001"
                      className="h-10"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={submitting || !formData.nome_arm.trim()}
                      variant="default"
                      className="h-10"
                    >
                      {submitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {editingArmazem ? 'Guardar' : 'Criar Armazém'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      aria-label="Cancelar"
                      className="h-10"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </PermissionGuard>
  )
}

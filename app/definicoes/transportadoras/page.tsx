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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, Trash2, X, Loader2, Pencil, Check, RotateCw, XSquare, ArrowLeft, ArrowRight } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { useDebounce } from '@/hooks/useDebounce'
import { useMemo } from 'react'

interface Transportadora {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export default function TransportadorasPage() {
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [loading, setLoading] = useState(true)
  // Remove drawer logic and related state
  const [formData, setFormData] = useState({ name: '' })
  const [nameFilter, setNameFilter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Debounced filter values for performance
  const [debouncedNameFilter, setDebouncedNameFilter] = useState(nameFilter)

  // Pagination state
  const ITEMS_PER_PAGE = 40
  const [currentPage, setCurrentPage] = useState(1)

  // Update debounced value with delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNameFilter(nameFilter)
    }, 300)
    return () => clearTimeout(timer)
  }, [nameFilter])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedNameFilter, transportadoras.length])

  // Memoize the supabase client to prevent infinite re-renders
  const supabase = useMemo(() => createBrowserClient(), [])

  // Convert to database-level filtering
  const fetchTransportadoras = useCallback(
    async (filters: { nameFilter?: string } = {}) => {
      setLoading(true)
      try {
        let query = supabase.from('transportadora').select('*')

        // Apply filters at database level
        if (filters.nameFilter?.trim?.()) {
          query = query.ilike('name', `%${filters.nameFilter.trim()}%`)
        }

        const { data, error } = await query.order('name', { ascending: true })

        if (!error && data) {
          setTransportadoras(data)
        }
      } catch (error) {
        console.error('Error fetching transportadoras:', error)
      } finally {
        setLoading(false)
      }
    },
    [supabase],
  )

  // Initial load
  useEffect(() => {
    fetchTransportadoras()
  }, [fetchTransportadoras])

  // Trigger search when filter changes
  useEffect(() => {
    fetchTransportadoras({ nameFilter: debouncedNameFilter })
  }, [debouncedNameFilter, fetchTransportadoras])

  // Remove client-side filtering - now using database-level filtering
  const filteredTransportadoras = transportadoras

  // Paginated data
  const totalPages = Math.ceil(filteredTransportadoras.length / ITEMS_PER_PAGE)
  const paginatedTransportadoras = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredTransportadoras.slice(startIndex, endIndex)
  }, [filteredTransportadoras, currentPage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    setSubmitting(true)
    try {
      // Create new transportadora only
      const { data, error } = await supabase
        .from('transportadora')
        .insert({ name: formData.name })
        .select('*')
      if (!error && data && data[0]) {
        setTransportadoras((prev) => [...prev, data[0]])
      }
      resetForm()
    } catch (error) {
      console.error('Error saving transportadora:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Add handler for inline add
  const handleAddNew = () => {
    if (editingId !== null) return
    setEditingId('new')
    setEditName('')
  }

  // Save handler for new row
  const handleAddSave = async () => {
    if (!editName.trim()) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('transportadora')
        .insert({ name: editName.trim() })
        .select('*')
      if (!error && data && data[0]) {
        setTransportadoras((prev) => [data[0], ...prev])
      }
      setEditingId(null)
      setEditName('')
    } catch (error) {
      console.error('Error creating transportadora:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Inline edit handlers
  const handleEdit = (transportadora: Transportadora) => {
    setEditingId(transportadora.id)
    setEditName(transportadora.name)
  }

  // Update handleEditSave to skip if editingId === 'new'
  const handleEditSave = async (id: string) => {
    if (id === 'new') {
      await handleAddSave()
      return
    }
    if (!editName.trim()) return
    setSubmitting(true)
    try {
      const updates = {
        name: editName.trim(),
        updated_at: new Date().toISOString().split('T')[0],
      }
      const { error } = await supabase
        .from('transportadora')
        .update(updates)
        .eq('id', id)
      if (!error) {
        setTransportadoras((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        )
      }
      setEditingId(null)
      setEditName('')
    } catch (error) {
      console.error('Error updating transportadora:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Update handleEditCancel to remove temp row if editingId === 'new'
  const handleEditCancel = () => {
    if (editingId === 'new') {
      // Just clear editing state, don't add row
      setEditingId(null)
      setEditName('')
      return
    }
    setEditingId(null)
    setEditName('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transportadora?')) return

    try {
      const { error } = await supabase
        .from('transportadora')
        .delete()
        .eq('id', id)

      if (!error) {
        setTransportadoras((prev) => prev.filter((t) => t.id !== id))
      }
    } catch (error) {
      console.error('Error deleting transportadora:', error)
    }
  }

  const resetForm = () => {
    setFormData({ name: '' })
    setEditingId(null)
    setEditName('')
  }

  return (
    <PermissionGuard>
      <div className="w-full space-y-6 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Gestão de Transportadoras</h1>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => fetchTransportadoras()}
                    variant="outline"
                    size="icon"
                    aria-label="Atualizar"
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
                    onClick={handleAddNew}
                    variant="default"
                    size="icon"
                    aria-label="Adicionar"
                    disabled={editingId !== null}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adicionar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-6 flex items-center gap-2">
          <div className="relative w-[300px]">
            <Input
              placeholder="Filtrar por nome..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="h-10 pr-10"
            />
            {nameFilter && (
              <Button
                variant="default"
                size="icon"
                className="absolute right-0 top-0 h-10 w-10"
                onClick={() => setNameFilter('')}
              >
                <XSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    fetchTransportadoras({ nameFilter: debouncedNameFilter })
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
        <div className="bg-background w-full space-y-4">
          <div className="w-full">
            <Table className="w-full table-fixed imx-table-compact">
              <TableHeader>
                <TableRow>
                  <TableHead className="imx-border-b text-center uppercase">
                    Nome da Transportadora
                  </TableHead>
                  <TableHead className="w-[90px] imx-border-b text-center uppercase">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="h-40 text-center uppercase"
                    >
                      <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : paginatedTransportadoras.length === 0 &&
                  editingId !== 'new' ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center text-muted-foreground uppercase"
                    >
                      Nenhuma transportadora encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {/* Inline add row at the top if editingId === 'new' */}
                    {editingId === 'new' && (
                      <TableRow>
                        <TableCell className="font-medium uppercase">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                            disabled={submitting}
                          />
                        </TableCell>
                        <TableCell className="w-[90px] flex justify-center gap-2">
                          {/* Save button */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="default"
                                  size="icon"
                                  onClick={handleAddSave}
                                  disabled={submitting || !editName.trim()}
                                  aria-label="Guardar"
                                >
                                  <span className="text-xs">✓</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Guardar</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {/* Cancel button */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={handleEditCancel}
                                  disabled={submitting}
                                  aria-label="Cancelar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Cancelar</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    )}
                    {paginatedTransportadoras.map((transportadora) => (
                      <TableRow key={transportadora.id}>
                        <TableCell className="font-medium uppercase">
                          {editingId === transportadora.id ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                              disabled={submitting}
                            />
                          ) : (
                            transportadora.name
                          )}
                        </TableCell>
                        <TableCell className="w-[90px] flex justify-center gap-2">
                          {editingId === transportadora.id ? (
                            <>
                              {/* Save button */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="default"
                                      size="icon"
                                      onClick={() =>
                                        handleEditSave(transportadora.id)
                                      }
                                      disabled={submitting || !editName.trim()}
                                      aria-label="Guardar"
                                    >
                                      <span className="text-xs">✓</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Guardar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {/* Cancel button */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={handleEditCancel}
                                      disabled={submitting}
                                      aria-label="Cancelar"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Cancelar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          ) : (
                            <>
                              {/* Edit button */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="default"
                                      size="icon"
                                      onClick={() => handleEdit(transportadora)}
                                      aria-label="Editar"
                                      disabled={editingId !== null}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {/* Delete button */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      onClick={() =>
                                        handleDelete(transportadora.id)
                                      }
                                      aria-label="Eliminar transportadora"
                                      disabled={editingId !== null}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Eliminar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
              <div className="text-muted-foreground">
                Página {currentPage} de {totalPages} ({filteredTransportadoras.length} transportadoras)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  )
}

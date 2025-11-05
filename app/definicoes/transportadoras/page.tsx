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
import { Plus, Trash2, X, Loader2, Pencil, Check, RotateCw, XSquare } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { useDebounce } from '@/hooks/useDebounce'

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

  // Update debounced value with delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNameFilter(nameFilter)
    }, 300)
    return () => clearTimeout(timer)
  }, [nameFilter])

  const supabase = createBrowserClient()

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
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-10 w-10 bg-yellow-400 hover:bg-yellow-500 border border-black"
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
        <div className="bg-background w-full">
          <div className="w-full">
            <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-10 border-b text-center uppercase">
                    Nome da Transportadora
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
                      colSpan={2}
                      className="h-40 text-center uppercase"
                    >
                      <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filteredTransportadoras.length === 0 &&
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
                        <TableCell className="flex justify-center gap-2">
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
                    {filteredTransportadoras.map((transportadora) => (
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
                        <TableCell className="flex justify-center gap-2">
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
        </div>
      </div>
    </PermissionGuard>
  )
}

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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, Trash2, X, Loader2, Edit, RotateCw } from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import { useDebounce } from '@/hooks/useDebounce'

interface Complexidade {
  id: string
  grau: string
  created_at: string
  updated_at: string
}

export default function ComplexidadePage() {
  const [complexidades, setComplexidades] = useState<Complexidade[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [grauFilter, setGrauFilter] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Debounced filter values for performance
  const [debouncedGrauFilter, setDebouncedGrauFilter] = useState(grauFilter)

  // Update debounced value with delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGrauFilter(grauFilter)
    }, 300)
    return () => clearTimeout(timer)
  }, [grauFilter])

  const supabase = createBrowserClient()

  // Convert to database-level filtering
  const fetchComplexidades = useCallback(
    async (filters: { grauFilter?: string } = {}) => {
      setLoading(true)
      try {
        let query = supabase.from('complexidade').select('*')

        // Apply filters at database level
        if (filters.grauFilter?.trim?.()) {
          query = query.ilike('grau', `%${filters.grauFilter.trim()}%`)
        }

        const { data, error } = await query.order('grau', { ascending: true })

        if (!error && data) {
          setComplexidades(data)
        }
      } catch (error) {
        console.error('Error fetching complexidades:', error)
      } finally {
        setLoading(false)
      }
    },
    [supabase],
  )

  // Initial load
  useEffect(() => {
    fetchComplexidades()
  }, [fetchComplexidades])

  // Trigger search when filter changes
  useEffect(() => {
    fetchComplexidades({ grauFilter: debouncedGrauFilter })
  }, [debouncedGrauFilter, fetchComplexidades])

  // Remove client-side filtering - now using database-level filtering
  const filteredComplexidades = complexidades

  const handleAddNew = async () => {
    const newGrau = prompt('Digite o novo grau de complexidade:')
    if (!newGrau?.trim()) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('complexidade')
        .insert({
          grau: newGrau.trim(),
        })
        .select('*')

      if (!error && data && data[0]) {
        setComplexidades((prev) => [...prev, data[0]])
      }
    } catch (error) {
      console.error('Error creating complexidade:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este nível de complexidade?'))
      return

    try {
      const { error } = await supabase
        .from('complexidade')
        .delete()
        .eq('id', id)

      if (!error) {
        setComplexidades((prev) => prev.filter((c) => c.id !== id))
      }
    } catch (error) {
      console.error('Error deleting complexidade:', error)
    }
  }

  const handleSave = async () => {
    if (!editValue.trim() || !editingId) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('complexidade')
        .update({ grau: editValue.trim() })
        .eq('id', editingId)

      if (!error) {
        setComplexidades((prev) =>
          prev.map((c) =>
            c.id === editingId ? { ...c, grau: editValue.trim() } : c,
          ),
        )
      }
    } catch (error) {
      console.error('Error updating:', error)
    } finally {
      setSubmitting(false)
      setEditingId(null)
      setEditValue('')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditValue('')
  }

  return (
    <PermissionGuard>
      <div className="w-full space-y-6 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Gestão de Complexidade</h1>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fetchComplexidades()}
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
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filtrar por grau..."
            value={grauFilter}
            onChange={(e) => setGrauFilter(e.target.value)}
            className="h-10 w-[300px]"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setGrauFilter('')}
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
                    fetchComplexidades({ grauFilter: debouncedGrauFilter })
                  }
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
                  <TableHead className="sticky top-0 z-10 imx-border-b text-center uppercase">
                    Grau de Complexidade
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 w-[140px] imx-border-b text-center uppercase">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="h-40 text-center">
                      <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filteredComplexidades.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center text-muted-foreground"
                    >
                      Nenhum nível de complexidade encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredComplexidades.map((complexidade) => (
                    <TableRow key={complexidade.id}>
                      <TableCell className="font-medium">
                        {editingId === complexidade.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && editValue.trim()) {
                                  handleSave()
                                } else if (e.key === 'Escape') {
                                  handleCancel()
                                }
                              }}
                              className="h-10 flex-1 border-0 text-sm outline-0 focus:border-0 focus:ring-0"
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="default"
                                      size="icon"
                                      onClick={handleSave}
                                      disabled={!editValue.trim() || submitting}
                                    >
                                      <span className="text-xs">✓</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Guardar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={handleCancel}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Cancelar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        ) : (
                          complexidade.grau
                        )}
                      </TableCell>
                      <TableCell className="flex justify-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="default"
                                size="icon"
                                onClick={() => {
                                  setEditingId(complexidade.id)
                                  setEditValue(complexidade.grau)
                                }}
                                disabled={editingId !== null}
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
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDelete(complexidade.id)}
                                disabled={editingId !== null}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
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
      </div>
    </PermissionGuard>
  )
}

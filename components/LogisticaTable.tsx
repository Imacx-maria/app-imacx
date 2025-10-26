'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowUp,
  ArrowDown,
  RefreshCcw,
  Eye,
  EyeOff,
  X,
} from 'lucide-react'
import { createBrowserClient } from '@/utils/supabase'

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

const parseNumericField = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value

  const strValue = String(value).trim()
  if (strValue === '') return 0

  const numValue = Number(strValue)
  if (!isNaN(numValue)) return numValue

  return 999999 + strValue.charCodeAt(0)
}

interface LogisticaRecord {
  logistica_id?: string
  item_id: string
  numero_fo: string
  cliente: string
  id_cliente?: string
  nome_campanha: string
  item_descricao: string
  quantidade?: number
  guia?: string
  local_recolha?: string
  local_entrega?: string
  transportadora?: string
  notas?: string
  concluido?: boolean
  data_saida?: string
  saiu?: boolean
  data?: string
  id_local_entrega?: string
  id_local_recolha?: string
}

interface LogisticaTableProps {
  records: LogisticaRecord[]
  loading?: boolean
  onRefresh?: () => void
}

type SortableKey =
  | 'numero_fo'
  | 'cliente'
  | 'nome_campanha'
  | 'item_descricao'
  | 'guia'
  | 'local_recolha'
  | 'local_entrega'
  | 'transportadora'
  | 'quantidade'
  | 'concluido'
  | 'data_saida'
  | 'saiu'

export const LogisticaTable: React.FC<LogisticaTableProps> = ({
  records,
  loading = false,
  onRefresh,
}) => {
  const [filters, setFilters] = useState({
    numeroFo: '',
    cliente: '',
    nomeCampanha: '',
    item: '',
    guia: '',
    codigo: '',
  })

  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow'>('all')
  const [sortCol, setSortCol] = useState<SortableKey>('numero_fo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [hasUserSorted, setHasUserSorted] = useState(false)
  const [showDispatched, setShowDispatched] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const debouncedFilters = useDebounce(filters, 300)

  const toggleSort = useCallback(
    (c: SortableKey) => {
      setHasUserSorted(true)
      if (sortCol === c) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
      else {
        setSortCol(c)
        setSortDir('asc')
      }
    },
    [sortCol, sortDir]
  )

  const getTodayString = useCallback((): string => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const getTomorrowString = useCallback((): string => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const year = tomorrow.getFullYear()
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      numeroFo: '',
      cliente: '',
      nomeCampanha: '',
      item: '',
      guia: '',
      codigo: '',
    })
    setDateFilter('all')
    setSortCol('numero_fo')
    setSortDir('asc')
    setHasUserSorted(false)
    setCurrentPage(1)
  }, [])

  const filtered = useMemo(() => {
    let result = records || []

    result = result.filter((record) => {
      if (debouncedFilters.numeroFo && !String(record.numero_fo || '').toLowerCase().includes(debouncedFilters.numeroFo.toLowerCase())) {
        return false
      }
      if (debouncedFilters.cliente && !String(record.cliente || '').toLowerCase().includes(debouncedFilters.cliente.toLowerCase())) {
        return false
      }
      if (debouncedFilters.nomeCampanha && !String(record.nome_campanha || '').toLowerCase().includes(debouncedFilters.nomeCampanha.toLowerCase())) {
        return false
      }
      if (debouncedFilters.item && !String(record.item_descricao || '').toLowerCase().includes(debouncedFilters.item.toLowerCase())) {
        return false
      }
      if (debouncedFilters.guia && !String(record.guia || '').toLowerCase().includes(debouncedFilters.guia.toLowerCase())) {
        return false
      }

      if (dateFilter !== 'all') {
        const recordDate = record.data_saida || record.data
        if (!recordDate) return dateFilter === 'all'

        if (dateFilter === 'today' && recordDate !== getTodayString()) {
          return false
        }
        if (dateFilter === 'tomorrow' && recordDate !== getTomorrowString()) {
          return false
        }
      }

      if (!showDispatched && record.saiu) {
        return false
      }

      return true
    })

    return result
  }, [records, debouncedFilters, dateFilter, showDispatched, getTodayString, getTomorrowString])

  const sorted = useMemo(() => {
    const result = [...filtered]

    result.sort((a, b) => {
      let aVal: any = a[sortCol]
      let bVal: any = b[sortCol]

      if (sortCol === 'quantidade') {
        aVal = parseNumericField(aVal)
        bVal = parseNumericField(bVal)
      } else {
        aVal = String(aVal || '').toLowerCase()
        bVal = String(bVal || '').toLowerCase()
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? comparison : -comparison
    })

    return result
  }, [filtered, sortCol, sortDir])

  const itemsPerPage = 20
  const totalPages = Math.ceil(sorted.length / itemsPerPage)
  const paginatedRecords = sorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  if (loading) {
    return (
      <div className="w-full">
        <h2 className="text-2xl">Trabalhos em Curso</h2>
        <div className="flex h-40 items-center justify-center">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl">Trabalhos em Curso</h2>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={showDispatched ? 'default' : 'outline'}
                  onClick={() => setShowDispatched((v) => !v)}
                  aria-label={
                    showDispatched
                      ? 'Mostrar Não Despachados'
                      : 'Mostrar Despachados'
                  }
                >
                  {showDispatched ? (
                    <Eye className="h-5 w-5" />
                  ) : (
                    <EyeOff className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showDispatched
                  ? 'Mostrar Não Despachados'
                  : 'Mostrar Despachados'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onRefresh}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="FO"
          value={filters.numeroFo}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, numeroFo: e.target.value }))
          }
        />
        <Input
          placeholder="Guia"
          value={filters.guia}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, guia: e.target.value }))
          }
        />
        <Input
          placeholder="Cliente"
          value={filters.cliente}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, cliente: e.target.value }))
          }
        />
        <Input
          placeholder="Nome Campanha"
          className="flex-1"
          value={filters.nomeCampanha}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, nomeCampanha: e.target.value }))
          }
        />
        <Input
          placeholder="Item"
          className="flex-1"
          value={filters.item}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, item: e.target.value }))
          }
        />

        {/* Date filter buttons */}
        <div className="flex items-center gap-1 border-l border-border pl-2">
          <Button
            variant={dateFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('all')}
          >
            Todos
          </Button>
          <Button
            variant={dateFilter === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('today')}
          >
            Hoje
          </Button>
          <Button
            variant={dateFilter === 'tomorrow' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('tomorrow')}
          >
            Amanhã
          </Button>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Limpar Filtros</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Table */}
      <div className="w-full overflow-auto rounded-none border border-border">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead
                onClick={() => toggleSort('numero_fo')}
                className="cursor-pointer sticky top-0 z-10 w-[100px] whitespace-nowrap"
              >
                <div className="flex items-center gap-2">
                  FO
                  {sortCol === 'numero_fo' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('cliente')}
                className="cursor-pointer sticky top-0 z-10 whitespace-nowrap"
              >
                <div className="flex items-center gap-2">
                  Cliente
                  {sortCol === 'cliente' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('nome_campanha')}
                className="cursor-pointer sticky top-0 z-10 whitespace-nowrap"
              >
                <div className="flex items-center gap-2">
                  Campanha
                  {sortCol === 'nome_campanha' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('item_descricao')}
                className="cursor-pointer sticky top-0 z-10 whitespace-nowrap"
              >
                <div className="flex items-center gap-2">
                  Item
                  {sortCol === 'item_descricao' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('quantidade')}
                className="cursor-pointer sticky top-0 z-10 text-center w-[80px]"
              >
                <div className="flex items-center justify-center gap-2">
                  Qt
                  {sortCol === 'quantidade' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('guia')}
                className="cursor-pointer sticky top-0 z-10 w-[100px]"
              >
                <div className="flex items-center gap-2">
                  Guia
                  {sortCol === 'guia' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('local_recolha')}
                className="cursor-pointer sticky top-0 z-10 w-[150px]"
              >
                <div className="flex items-center gap-2">
                  Recolha
                  {sortCol === 'local_recolha' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('local_entrega')}
                className="cursor-pointer sticky top-0 z-10 w-[150px]"
              >
                <div className="flex items-center gap-2">
                  Entrega
                  {sortCol === 'local_entrega' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('transportadora')}
                className="cursor-pointer sticky top-0 z-10 w-[150px]"
              >
                <div className="flex items-center gap-2">
                  Transportadora
                  {sortCol === 'transportadora' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('concluido')}
                className="cursor-pointer sticky top-0 z-10 text-center w-[60px]"
              >
                <div className="flex items-center justify-center gap-2">
                  C
                  {sortCol === 'concluido' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('data_saida')}
                className="cursor-pointer sticky top-0 z-10 w-[120px]"
              >
                <div className="flex items-center gap-2">
                  Data Saída
                  {sortCol === 'data_saida' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                onClick={() => toggleSort('saiu')}
                className="cursor-pointer sticky top-0 z-10 text-center w-[60px]"
              >
                <div className="flex items-center justify-center gap-2">
                  S
                  {sortCol === 'saiu' &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  Nenhum trabalho encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginatedRecords.map((record) => {
                const recordId = `${record.item_id}-${record.logistica_id || 'no-logistics'}`

                return (
                  <TableRow key={recordId}>
                    <TableCell>{record.numero_fo || '-'}</TableCell>
                    <TableCell>{record.cliente || '-'}</TableCell>
                    <TableCell>{record.nome_campanha || '-'}</TableCell>
                    <TableCell>{record.item_descricao || '-'}</TableCell>
                    <TableCell className="text-center">
                      {record.quantidade || '-'}
                    </TableCell>
                    <TableCell>{record.guia || '-'}</TableCell>
                    <TableCell>{record.local_recolha || '-'}</TableCell>
                    <TableCell>{record.local_entrega || '-'}</TableCell>
                    <TableCell>{record.transportadora || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Checkbox checked={record.concluido || false} disabled />
                    </TableCell>
                    <TableCell className="text-center">
                      {record.data_saida || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox checked={record.saiu || false} disabled />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} ({sorted.length} resultados)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

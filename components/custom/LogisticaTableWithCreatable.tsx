import React, { useState, useMemo, useCallback } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ArrowUp, ArrowDown, Trash2, Copy, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react'
import NotasPopover from '@/components/custom/NotasPopover'
import CreatableClienteCombobox, {
  type ClienteOption,
} from '@/components/forms/CreatableClienteCombobox'
import CreatableArmazemCombobox, {
  ArmazemOption,
} from '@/components/forms/CreatableArmazemCombobox'
import CreatableTransportadoraCombobox, {
  TransportadoraOption,
} from '@/components/forms/CreatableTransportadoraCombobox'
import DatePicker from '@/components/custom/DatePicker'
import { parseDateFromYYYYMMDD, formatDateToYYYYMMDD } from '@/utils/date'
import type {
  LogisticaRecord,
  Cliente,
  Transportadora,
  Armazem,
} from '@/types/logistica'

// Helper function for smart numeric sorting (handles mixed text/number fields)
const parseNumericField = (
  value: string | number | null | undefined,
): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value

  const strValue = String(value).trim()
  if (strValue === '') return 0

  // Try to parse as number
  const numValue = Number(strValue)
  if (!isNaN(numValue)) return numValue

  // For non-numeric values (letters), sort them after all numbers
  // Use a high number + character code for consistent ordering
  return 999999 + strValue.charCodeAt(0)
}

interface TableColumn {
  label: string
  width: string
  field: string
  tooltip?: string
}

interface LogisticaTableWithCreatableProps {
  records: LogisticaRecord[]
  clientes: Cliente[]
  transportadoras: Transportadora[]
  armazens: Armazem[]
  onOrcSave?: (row: LogisticaRecord, value: string) => Promise<void>
  onFoSave?: (row: LogisticaRecord, value: string) => Promise<void>
  onItemSave?: (row: LogisticaRecord, value: string) => Promise<void>
  onSaiuSave: (row: LogisticaRecord, value: boolean) => Promise<void>
  onGuiaSave: (row: LogisticaRecord, value: string) => Promise<void>
  onBrindesSave: (row: LogisticaRecord, value: boolean) => Promise<void>
  onClienteChange: (row: LogisticaRecord, value: string) => Promise<void>
  onRecolhaChange: (rowId: string, value: string) => Promise<void>
  onEntregaChange: (rowId: string, value: string) => Promise<void>
  onTransportadoraChange: (row: LogisticaRecord, value: string) => Promise<void>
  onQuantidadeSave: (
    row: LogisticaRecord,
    value: number | null,
  ) => Promise<void>
  onConcluidoSave?: (row: LogisticaRecord, value: boolean) => Promise<void>
  onDataConcluidoSave?: (row: LogisticaRecord, value: string) => Promise<void>
  onDuplicateRow: (row: LogisticaRecord) => Promise<void>
  onNotasSave: (
    row: LogisticaRecord,
    outras: string,
    contacto?: string,
    telefone?: string,
    contacto_entrega?: string,
    telefone_entrega?: string,
    data?: string | null,
  ) => Promise<void>
  onDeleteRow: (rowId: string) => Promise<void>
  tableDate: string
  hideColumns?: string[] // Array of column fields to hide
  hideActions?: boolean // Hide the actions column (clone/delete buttons)
  showSourceSelection?: boolean // Show radio buttons for source selection
  sourceRowId?: string | null // Currently selected source row ID
  onSourceRowChange?: (rowId: string | null) => void // Callback when source row changes
  // New callbacks for updating options lists
  onArmazensUpdate?: (newArmazens: ArmazemOption[]) => void
  onTransportadorasUpdate?: (newTransportadoras: TransportadoraOption[]) => void
  onClientesUpdate?: (newClientes: ClienteOption[]) => void
}

export const LogisticaTableWithCreatable: React.FC<
  LogisticaTableWithCreatableProps
> = ({
  records,
  clientes,
  transportadoras,
  armazens,
  onOrcSave,
  onFoSave,
  onItemSave,
  onSaiuSave,
  hideActions = false,
  onGuiaSave,
  onBrindesSave,
  onClienteChange,
  onRecolhaChange,
  onEntregaChange,
  onTransportadoraChange,
  onQuantidadeSave,
  onConcluidoSave,
  onDataConcluidoSave,
  onDuplicateRow,
  onNotasSave,
  onDeleteRow,
  tableDate,
  hideColumns,
  showSourceSelection,
  sourceRowId,
  onSourceRowChange,
  onArmazensUpdate,
  onTransportadorasUpdate,
  onClientesUpdate,
}) => {
  console.log(
    '🔧 LogisticaTableWithCreatable rendered, onFoSave exists:',
    !!onFoSave,
  )
  // Keep legacy callbacks referenced even when column is hidden
  void onOrcSave
  void onFoSave
  void onSaiuSave
  void onClienteChange
  void onClientesUpdate

  // State for table functionality
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [hasUserSorted, setHasUserSorted] = useState(false) // Track if user has manually sorted
  const [editRows, setEditRows] = useState<Record<string, any>>({})
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 5

  // Pre-compute soma das quantidades por item (em todas as linhas, não só página)
  const totalQuantidadePorItemId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of records) {
      const itemId = r.items_base?.id
      if (!itemId) continue
      const q = r.quantidade ?? 0
      map[itemId] = (map[itemId] ?? 0) + (typeof q === 'number' ? q : 0)
    }
    return map
  }, [records])

  // Helper functions for stable data access
  const getItemValue = useCallback(
    (row: LogisticaRecord, editRows: Record<string, any>) => {
      // Priority: edit state -> direct description -> nested description
      return (
        editRows[row.id]?.item ||
        row.descricao ||
        row.items_base?.descricao ||
        ''
      )
    },
    [],
  )

  const getQuantityValue = useCallback(
    (row: LogisticaRecord, editRows: Record<string, any>) => {
      // Priority: edit state -> row quantity
      const editValue = editRows[row.id]?.quantidade
      if (editValue !== undefined) return editValue
      return row.quantidade ?? ''
    },
    [],
  )

  const getFoValue = useCallback(
    (row: LogisticaRecord, editRows: Record<string, any>) => {
      return (
        editRows[row.id]?.numero_fo ||
        row.items_base?.folhas_obras?.numero_fo ||
        ''
      )
    },
    [],
  )

  const getGuiaValue = useCallback(
    (row: LogisticaRecord, editRows: Record<string, any>) => {
      return editRows[row.id]?.guia || row.guia || ''
    },
    [],
  )

  // Data Integrity Checker for development
  const DataIntegrityChecker: React.FC<{
    records: LogisticaRecord[]
    editRows: Record<string, any>
  }> = React.memo(({ records, editRows }) => {
    React.useEffect(() => {
      const missingData = records.filter((record) => {
        const hasItem = !!(record.descricao || record.items_base?.descricao)
        const hasQuantity =
          record.quantidade !== null && record.quantidade !== undefined
        return !hasItem || !hasQuantity
      })

      if (missingData.length > 0) {
        console.group('🚨 Data Integrity Issues Detected:')
        missingData.forEach((record, index) => {
          console.log(`Record ${index}:`, {
            id: record.id,
            hasDirectDescricao: !!record.descricao,
            hasNestedDescricao: !!record.items_base?.descricao,
            quantidade: record.quantidade,
            editState: editRows[record.id] || 'none',
            itemValue: getItemValue(record, editRows),
            quantityValue: getQuantityValue(record, editRows),
          })
        })
        console.groupEnd()
      }
    }, [records, editRows])

    return null
  })

  DataIntegrityChecker.displayName = 'DataIntegrityChecker'

  // Convert data to the format expected by creatable components
  const armazemOptions: ArmazemOption[] = useMemo(
    () =>
      armazens.map((arm) => ({
        value: arm.value,
        label: arm.label,
        morada: null,
        codigo_pos: null,
      })),
    [armazens],
  )

  const transportadoraOptions: TransportadoraOption[] = useMemo(
    () =>
      transportadoras.map((transp) => ({
        value: transp.value,
        label: transp.label,
      })),
    [transportadoras],
  )

  const baseFieldClass = 'h-10 px-3 text-sm uppercase'
  const quantityFieldClass = `${baseFieldClass} text-right`
  const staticCellClass =
    'flex h-10 items-center justify-center px-2 text-sm font-mono'
  const comboButtonClass =
    'border border-border h-10 text-sm uppercase'
  const checkboxClass =
    'h-5 w-5 shadow-none'
  const actionButtonClass =
    'flex items-center justify-center !h-10 !w-10 !min-w-10 !max-w-10 !p-0 border border-border'
  const actionButtonHoverClass = 'hover:bg-accent'
  const cloneButtonClass = `${actionButtonClass} ${actionButtonHoverClass}`
  const deleteButtonClass = `${actionButtonClass} bg-destructive text-destructive-foreground hover:bg-destructive/90`
  const notesButtonClass = `${actionButtonClass} ${actionButtonHoverClass} aspect-square bg-primary text-primary-foreground`
  const dateButtonClass =
    'border border-border bg-primary text-primary-foreground uppercase hover:bg-primary/90'

  // Table columns configuration
  const columns = useMemo<TableColumn[]>(() => {
    const allColumns = [
      ...(showSourceSelection
        ? [
            {
              label: 'FONTE',
              width: 'w-[60px] max-w-[60px]',
              field: 'source_selection',
              tooltip: 'Selecionar como fonte para copiar',
            },
          ]
        : []),
      { label: 'ORC', width: 'w-[80px] max-w-[80px]', field: 'numero_orc' },
      { label: 'FO', width: 'w-[80px] max-w-[80px]', field: 'numero_fo' },
      { label: 'CLIENTE', width: 'w-[220px] max-w-[220px]', field: 'cliente' },
      { label: 'GUIA', width: 'w-[90px] max-w-[90px]', field: 'guia' },
      { label: 'B', width: 'w-[74px] max-w-[44px]', field: 'tipo' },
      { label: 'ITEM', width: 'flex-1 min-w-[260px]', field: 'item' },
      { label: 'QTD', width: 'w-[90px] max-w-[90px]', field: 'quantidade' },
      { label: 'LOC. RECOLHA', width: 'w-[180px]', field: 'local_recolha' },
      { label: 'LOC. ENTREGA', width: 'w-[180px]', field: 'local_entrega' },
      { label: 'TRANSPORTADORA', width: 'w-[180px]', field: 'transportadora' },
      { label: 'OUTRAS', width: 'w-[90px] max-w-[90px]', field: 'notas' },
      {
        label: 'C',
        width: 'w-[60px] max-w-[60px]',
        field: 'concluido',
        tooltip: 'Concluido',
      },
      { label: 'DATA SAIDA', width: 'w-[190px]', field: 'data_saida' },
      ...(!hideActions ? [{
        label: 'ACOES',
        width: 'w-[120px] max-w-[120px]',
        field: 'acoes',
        tooltip: 'Acoes',
      }] : []),
    ]
    // Filter out hidden columns
    return allColumns.filter((col) => !hideColumns?.includes(col.field))
  }, [hideColumns, showSourceSelection, hideActions])

  // Handle sorting - memoized to prevent recreation on renders
  const handleSort = useCallback(
    (field: string) => {
      setHasUserSorted(true) // Mark that user has manually sorted
      if (sortColumn === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortColumn(field)
        setSortDirection('asc')
      }
    },
    [sortColumn],
  )

  // Create lookup dictionaries for faster access
  const clienteLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    clientes.forEach((cliente) => {
      lookup[cliente.value] = cliente.label
    })
    return lookup
  }, [clientes])

  const transportadoraLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    transportadoras.forEach((t) => {
      lookup[t.value] = t.label
    })
    return lookup
  }, [transportadoras])

  // Sorting logic with optimized comparisons
  const sortedRecords = useMemo(() => {
    // Only sort if user has manually sorted
    if (!hasUserSorted) {
      return records // Return unsorted data
    }

    // Get comparison function based on column type
    const getComparisonValue = (
      record: LogisticaRecord,
      field: string,
    ): string | boolean | number => {
      switch (field) {
        case 'numero_orc':
          // Prefer numero_orc stored in folhas_obras, then fallback to phc mirror
          return parseNumericField(
            record.items_base?.folhas_obras?.numero_orc ||
              record.folha_obra_with_orcamento?.numero_orc,
          )
        case 'numero_fo':
          // Smart numeric sorting: numbers first, then letters
          return parseNumericField(record.items_base?.folhas_obras?.numero_fo)
        case 'tipo':
          return record.items_base?.brindes ? 'Brindes' : 'Print'
        case 'cliente': {
          // Prefer Nome from folhas_obras
          const nome = (record.items_base as any)?.folhas_obras?.Nome
          if (nome) return nome
          const clientId = record.items_base?.folhas_obras?.id_cliente
          return (
            (clientId ? clienteLookup[clientId] : '') ||
            (record.items_base as any)?.folhas_obras?.cliente ||
            ''
          )
        }
        case 'item':
          return record.items_base?.descricao || ''
        case 'local_recolha': {
          const recolhaId = record.id_local_recolha
          return (
            (recolhaId ? clienteLookup[recolhaId] : '') ||
            record.local_recolha ||
            ''
          )
        }
        case 'local_entrega': {
          const entregaId = record.id_local_entrega
          return (
            (entregaId ? clienteLookup[entregaId] : '') ||
            record.local_entrega ||
            ''
          )
        }
        case 'transportadora': {
          const transId = record.transportadora
          return (transId ? transportadoraLookup[transId] : '') || ''
        }
        case 'guia':
          return record.guia || ''
        case 'quantidade':
          return record.quantidade ?? 0
        case 'notas':
          return record.notas || ''
        case 'concluido':
          return record.concluido || false
        case 'data_saida':
          return record.data_saida || ''
        default:
          return ''
      }
    }

    // Sort comparison function
    const compare = (a: LogisticaRecord, b: LogisticaRecord): number => {
      const aValue = getComparisonValue(a, sortColumn)
      const bValue = getComparisonValue(b, sortColumn)

      // For string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      // For boolean comparison
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return sortDirection === 'asc'
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue)
      }

      // For number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    }

    return [...records].sort(compare)
  }, [
    records,
    sortColumn,
    sortDirection,
    clienteLookup,
    transportadoraLookup,
    hasUserSorted,
  ])

  // Pagination calculations
  const totalPages = Math.ceil(sortedRecords.length / ITEMS_PER_PAGE)
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedRecords.slice(startIndex, endIndex)
  }, [sortedRecords, currentPage, ITEMS_PER_PAGE])

  // Reset to page 1 when sorted records change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [sortedRecords.length])

  // Handle edit state updates - enhanced for data stability
  const handleEdit = useCallback((rowId: string, field: string, value: any) => {
    if (!rowId) {
      console.warn('handleEdit called with missing rowId')
      return
    }

    setEditRows((prev) => {
      const currentRowEdit = prev[rowId] || {}

      // Preserve critical fields when updating others
      const preservedData = {
        item: currentRowEdit.item,
        quantidade: currentRowEdit.quantidade,
        guia: currentRowEdit.guia,
      }

      return {
        ...prev,
        [rowId]: {
          ...preservedData,
          ...currentRowEdit,
          [field]: value,
        },
      }
    })
  }, [])

  // Handle row deletion
  const handleDelete = useCallback(
    async (rowId: string) => {
      if (!rowId) return

      const confirmed = confirm(
        'Tem a certeza que pretende eliminar esta linha?',
      )
      if (confirmed) {
        await onDeleteRow(rowId)
      }
    },
    [onDeleteRow],
  )

  // Debug function to log row data (can be removed in production)
  const debugRow = (row: LogisticaRecord) => {
    console.log('Row data:', {
      id: row.id,
      item_id: row.items_base?.id,
      descricao: row.descricao,
      items_base: row.items_base,
      guia: row.guia,
      quantidade: row.quantidade,
    })
  }

  // Memoize table headers to prevent unnecessary re-renders
  const tableHeader = useMemo(
    () => (
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
          <TableHead
            key={col.field}
            className={`cursor-pointer select-none ${col.width} border-border border-b bg-primary text-primary-foreground uppercase ${
                col.field === 'source_selection' ||
                col.field === 'tipo' ||
                col.field === 'notas' ||
                col.field === 'concluido' ||
                col.field === 'acoes'
                  ? 'text-center'
                  : ''
              }`}
            onClick={() => handleSort(col.field)}
          >
              <div
                className={`flex items-center ${
                  col.field === 'source_selection' ||
                  col.field === 'tipo' ||
                  col.field === 'notas' ||
                  col.field === 'concluido' ||
                  col.field === 'acoes'
                    ? 'justify-center'
                    : 'justify-between'
                }`}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{col.label}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span>{col.tooltip || col.label}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {sortColumn === col.field && col.field !== 'acoes' && (
                  <span
                    className={
                      col.field === 'source_selection' ||
                      col.field === 'tipo' ||
                      col.field === 'notas'
                        ? 'ml-1'
                        : ''
                    }
                  >
                    {sortDirection === 'asc' ? (
                      <ArrowUp size={14} />
                    ) : (
                      <ArrowDown size={14} />
                    )}
                  </span>
                )}
              </div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
    ),
    [columns, sortColumn, sortDirection, handleSort],
  )

  return (
    <div className="bg-background rounded-none">
      {process.env.NODE_ENV === 'development' && (
        <DataIntegrityChecker records={paginatedRecords} editRows={editRows} />
      )}
      <Table className="w-full table-fixed uppercase imx-table-compact">
          {tableHeader}
          <TableBody>
            {paginatedRecords.length === 0 ? (
              <TableRow className="imx-row-hover">
                <TableCell colSpan={columns.length} className="p-4 text-center">
                  Nenhum registo encontrado para esta data.
                </TableCell>
              </TableRow>
            ) : (
              paginatedRecords.map((row, index) => (
                <TableRow
                  key={row.id || row.items_base?.id || Math.random()}
                  className={`imx-row-hover ${sourceRowId === row.id ? 'bg-primary/10' : ''}`}
                >
                  {/* Source Selection Checkbox */}
                  {showSourceSelection && (
                    <TableCell className="text-sm">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={sourceRowId === row.id}
                          onCheckedChange={(checked) => {
                            if (onSourceRowChange) {
                              onSourceRowChange(checked ? row.id : null)
                            }
                          }}
                          className={checkboxClass}
                        />
                      </div>
                    </TableCell>
                  )}

                  {/* ORC */}
                  {!hideColumns?.includes('numero_orc') && (
                    <TableCell className="w-[80px] max-w-[80px] text-sm">
                      <div
                        className={`${staticCellClass} w-full justify-center`}
                      >
                        {row.items_base?.folhas_obras?.numero_orc ||
                          row.folha_obra_with_orcamento?.numero_orc ||
                          ''}
                      </div>
                    </TableCell>
                  )}

                  {/* FO */}
                  {!hideColumns?.includes('numero_fo') && (
                    <TableCell className="w-[80px] max-w-[80px] text-sm">
                      <Input
                        className={`${baseFieldClass} w-full`}
                        value={getFoValue(row, editRows)}
                        onChange={(e) =>
                          handleEdit(row.id, 'numero_fo', e.target.value)
                        }
                        onBlur={() => {
                          const foValue = getFoValue(row, editRows)
                          if (foValue && onFoSave) {
                            console.log(
                              '🔵 FO BLUR - calling onFoSave with:',
                              foValue,
                            )
                            onFoSave(row, foValue).catch((error) => {
                              console.error(
                                '❌ onFoSave on blur failed:',
                                error,
                              )
                            })
                          }
                        }}
                        onKeyDown={(e) => {
                          console.log(
                            '🔘 FO KEY DOWN TRIGGERED:',
                            e.key,
                            'onFoSave exists:',
                            !!onFoSave,
                          )
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const foValue = getFoValue(row, editRows)
                            console.log('🎯 FO ENTER PRESSED, value:', foValue)
                            if (foValue && onFoSave) {
                              console.log('🚀 Calling onFoSave with:', foValue)
                              onFoSave(row, foValue).catch((error) => {
                                console.error('❌ onFoSave failed:', error)
                              })
                            } else {
                              console.log(
                                '❌ Not calling onFoSave - foValue:',
                                foValue,
                                'onFoSave:',
                                !!onFoSave,
                              )
                            }
                            const inputs = e.currentTarget
                              .closest('tr')
                              ?.querySelectorAll('input[type="text"]')
                            const currentIndex = Array.from(
                              inputs || [],
                            ).indexOf(e.currentTarget as HTMLInputElement)
                            if (
                              inputs &&
                              currentIndex >= 0 &&
                              currentIndex < inputs.length - 1
                            ) {
                              ;(
                                inputs[currentIndex + 1] as HTMLInputElement
                              )?.focus()
                            }
                          }
                        }}
                      />
                    </TableCell>
                  )}

                  {/* CLIENTE */}
                  {!hideColumns?.includes('cliente') && (
                    <TableCell className="w-[220px] max-w-[220px] text-sm">
                      {((row.items_base as any)?.folhas_obras?.Nome && (
                        <div
                          className={`${staticCellClass} w-full justify-start`}
                        >
                          {(row.items_base as any)?.folhas_obras?.Nome}
                        </div>
                      )) || (
                        <CreatableClienteCombobox
                          options={clientes.map((c) => ({
                            value: c.value,
                            label: c.label,
                          }))}
                          value={row.items_base?.folhas_obras?.id_cliente ? String(row.items_base?.folhas_obras?.id_cliente) : ''}
                          onChange={(value) => onClienteChange(row, value)}
                          placeholder="Cliente"
                          onOptionsUpdate={onClientesUpdate}
                          className="max-w-[200px]"
                        />
                      )}
                    </TableCell>
                  )}

                  {/* Guia */}
                  {!hideColumns?.includes('guia') && (
                    <TableCell className="w-[90px] max-w-[90px] text-sm">
                      <Input
                        className={`${baseFieldClass} w-full`}
                        value={getGuiaValue(row, editRows)}
                        onChange={(e) =>
                          handleEdit(row.id, 'guia', e.target.value)
                        }
                        onBlur={() => {
                          const guiaValue = getGuiaValue(row, editRows)
                          if (guiaValue !== (row.guia || '')) {
                            onGuiaSave(row, guiaValue)
                          }
                        }}
                      />
                    </TableCell>
                  )}

                  {/* Tipo */}
                  <TableCell className="w-[74px] max-w-[74px] text-sm">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={
                          editRows[row.id]?.brindes ??
                          row.items_base?.brindes ??
                          false
                        }
                        className={checkboxClass}
                        onCheckedChange={(value) => {
                          handleEdit(row.id, 'brindes', !!value)
                          onBrindesSave(row, !!value)
                        }}
                      />
                    </div>
                  </TableCell>

                  {/* Item */}
                  <TableCell className="flex-1 text-sm">
                    <Input
                      className={`${baseFieldClass} w-full`}
                      value={getItemValue(row, editRows)}
                      onChange={(e) =>
                        handleEdit(row.id, 'item', e.target.value)
                      }
                      onBlur={() => {
                        const itemValue = getItemValue(row, editRows)
                        if (
                          onItemSave &&
                          itemValue !==
                            (row.descricao || row.items_base?.descricao || '')
                        ) {
                          onItemSave(row, itemValue)
                        }
                      }}
                    />
                  </TableCell>

                  {/* Quantidade */}
                  <TableCell className="w-[90px] max-w-[90px] text-sm">
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        className={`${quantityFieldClass} w-full`}
                        value={getQuantityValue(row, editRows)}
                        onChange={(e) => {
                          const value =
                            e.target.value === '' ? null : Number(e.target.value)
                          handleEdit(row.id, 'quantidade', value)
                        }}
                        onBlur={() => {
                          const currentValue = getQuantityValue(row, editRows)
                          const numericValue =
                            currentValue === '' ? null : Number(currentValue)
                          if (numericValue !== row.quantidade) {
                            onQuantidadeSave(row, numericValue)
                          }
                        }}
                      />
                      {(() => {
                        const itemId = row.items_base?.id
                        const baseQty = row.items_base?.quantidade
                        const sumQty = itemId ? totalQuantidadePorItemId[itemId] : undefined
                        const hasMismatch =
                          typeof baseQty === 'number' && typeof sumQty === 'number' && baseQty !== sumQty
                        if (!hasMismatch) return null
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-amber-600" aria-label="Aviso quantidade divergente">
                                  <AlertTriangle size={16} />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>
                                  Soma das quantidades (Logística): {sumQty} ≠ Quantidade do item: {baseQty}
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      })()}
                    </div>
                  </TableCell>

                  {/* Local Recolha - NOW CREATABLE */}
                  <TableCell className="w-[180px] max-w-[180px] text-sm">
                    <CreatableArmazemCombobox
                      options={armazemOptions}
                      value={row.id_local_recolha ? String(row.id_local_recolha) : ''}
                      displayLabel={row.local_recolha || ''}
                      onChange={(value) =>
                        onRecolhaChange(
                          row.id || row.items_base?.id || '',
                          value,
                        )
                      }
                      placeholder="RECOLHA"
                      onOptionsUpdate={onArmazensUpdate}
                      className="max-w-[200px]"
                      buttonClassName={comboButtonClass}
                      /* Show textual label even if value is not in options */
                      aria-label="Local de Recolha"
                    />
                  </TableCell>

                  {/* Local Entrega - NOW CREATABLE */}
                  <TableCell className="w-[180px] max-w-[180px] text-sm">
                    <CreatableArmazemCombobox
                      options={armazemOptions}
                      value={row.id_local_entrega ? String(row.id_local_entrega) : ''}
                      displayLabel={row.local_entrega || ''}
                      onChange={(value) =>
                        onEntregaChange(
                          row.id || row.items_base?.id || '',
                          value,
                        )
                      }
                      placeholder="ENTREGA"
                      onOptionsUpdate={onArmazensUpdate}
                      className="max-w-[200px]"
                      buttonClassName={comboButtonClass}
                      aria-label="Local de Entrega"
                    />
                  </TableCell>

                  {/* Transportadora - NOW CREATABLE */}
                  <TableCell className="w-[180px] max-w-[180px] text-sm">
                    <CreatableTransportadoraCombobox
                      options={transportadoraOptions}
                      value={row.transportadora ? String(row.transportadora) : ''}
                      onChange={(value) => onTransportadoraChange(row, value)}
                      placeholder="Empresa"
                      onOptionsUpdate={onTransportadorasUpdate}
                      className="max-w-[180px]"
                      buttonClassName={comboButtonClass}
                    />
                  </TableCell>

                  {/* Outras */}
                  <TableCell className="text-sm">
                    <div className="flex items-center justify-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <NotasPopover
                                value={row.notas || ''}
                                contacto_entrega={row.contacto_entrega || ''}
                                telefone_entrega={row.telefone_entrega || ''}
                                data={row.data || tableDate}
                                onChange={(value) =>
                                  handleEdit(row.id, 'notas', value)
                                }
                                onSave={async (fields) => {
                                  // Save all fields - now only delivery fields
                                  await onNotasSave(
                                    {
                                      ...row,
                                      ...fields,
                                      data: fields.data || tableDate,
                                    },
                                    fields.outras,
                                    undefined, // No more pickup contact
                                    undefined, // No more pickup phone
                                    fields.contacto_entrega,
                                    fields.telefone_entrega,
                                    fields.data || tableDate,
                                  )
                                }}
                                iconType="file"
                                buttonSize="icon"
                                className={notesButtonClass}
                                centered={true}
                              />
                            </div>
                          </TooltipTrigger>
                          {row.notas && row.notas.trim() !== '' && (
                            <TooltipContent>{row.notas}</TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>

                  {/* Concluido */}
                  <TableCell className="text-sm">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={
                          editRows[row.id]?.concluido ?? row.concluido ?? false
                        }
                        className={checkboxClass}
                        onCheckedChange={(value) => {
                          handleEdit(row.id, 'concluido', !!value)
                          onConcluidoSave && onConcluidoSave(row, !!value)
                        }}
                      />
                    </div>
                  </TableCell>

                  {/* DATA SAIDA */}
                  <TableCell className="w-[190px] max-w-[190px] text-sm">
                    <DatePicker
                      selected={(() => {
                        const dateString =
                          editRows[row.id]?.data_saida || row.data_saida
                        if (!dateString) return undefined
                        const date = parseDateFromYYYYMMDD(dateString)
                        return date || undefined
                      })()}
                      onSelect={(date) => {
                        const dateString = formatDateToYYYYMMDD(date)
                        handleEdit(row.id, 'data_saida', dateString)
                        if (onDataConcluidoSave) {
                          onDataConcluidoSave(row, dateString || '')
                        }
                      }}
                      placeholder="Data"
                      buttonClassName={`${dateButtonClass} w-full h-10`}
                    />
                  </TableCell>

                  {/* Actions */}
                  {!hideActions && (
                    <TableCell className="flex w-[120px] justify-center gap-2 pr-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className={cloneButtonClass}
                              onClick={() => onDuplicateRow(row)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="destructive"
                              className={deleteButtonClass}
                              onClick={() =>
                                handleDelete(row.id || row.items_base?.id || '')
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <div className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages} ({sortedRecords.length} items)
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
  )
}

export default React.memo(LogisticaTableWithCreatable)

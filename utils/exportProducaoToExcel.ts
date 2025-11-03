import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// Types for the data structure
interface ExportProducaoRow {
  numero_orc?: number | null
  numero_fo?: string
  id_cliente?: string
  quantidade?: number | null
  nome_campanha?: string
  descricao?: string
  data_in?: string | null
  data_saida?: string | null
  data_concluido?: string | null
  transportadora?: string
  local_entrega?: string
  local_recolha?: string // Added field for pickup location
  id_local_entrega?: string // UUID for delivery location lookup
  id_local_recolha?: string // UUID for pickup location lookup
  cliente_nome?: string // For display purposes
  notas?: string | null
  guia?: string | null
  contacto_entrega?: string | null
}

interface ExportProducaoOptions {
  filteredRecords: ExportProducaoRow[]
  pendentesRecords?: ExportProducaoRow[]  // Optional pendentes data for second sheet
  activeTab: 'em_curso' | 'concluidos' | 'pendentes'
  clientes?: {
    value: string
    label: string
    morada?: string
    codigo_pos?: string
  }[]
}

// Helper function to create a worksheet with data
const createWorksheet = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  sheetTitle: string,
  records: ExportProducaoRow[],
  clientes: { value: string; label: string; morada?: string; codigo_pos?: string }[],
  useBandedRows: boolean = false, // New parameter for client-friendly version
) => {
  const worksheet = workbook.addWorksheet(sheetName)

  // Column definitions (as requested by user)
  const columns = [
    { header: 'CLIENTE', key: 'cliente' },
    { header: 'ORC', key: 'numero_orc' },
    { header: 'FO', key: 'numero_fo' },
    { header: 'QTD', key: 'quantidade' },
    { header: 'ITEM', key: 'descricao' },
    { header: 'DATA ENTRADA', key: 'data_in' },
    { header: 'DATA SAÍDA', key: 'data_saida' },
    { header: 'GT', key: 'guia' },
    { header: 'LOGÍSTICA', key: 'logistica' },
  ]

  // 1. Title row
  worksheet.mergeCells(1, 1, 1, columns.length)
  const titleCell = worksheet.getCell(1, 1)
  titleCell.value = `RELATÓRIO DE PRODUÇÃO - ${sheetTitle}`
  titleCell.font = { size: 18, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // 2. Date row
  worksheet.mergeCells(2, 1, 2, columns.length)
  const dateCell = worksheet.getCell(2, 1)
  dateCell.value = new Date().toLocaleDateString('pt-PT')
  dateCell.font = { size: 12 }
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // 3. Blank line (row 3)
  worksheet.mergeCells(3, 1, 3, columns.length)

  // 4. Header row (row 4)
  const headerRow = worksheet.addRow(columns.map((col) => col.header))
  headerRow.height = 70 // Set header row height to 70 pixels
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F4F4F' }, // Dark gray background
    }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { 
      vertical: 'middle', 
      horizontal: 'center',
      wrapText: true // Enable text wrapping
    }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })

  // Helper function to get client name from ID
  const getClienteName = (clienteId: string | undefined) => {
    if (!clienteId || !clientes.length) return ''
    const cliente = clientes.find((c) => c.value === clienteId)
    return cliente ? cliente.label : ''
  }

  // Helper function to get location name from UUID with address
  const getLocationName = (locationId: string | undefined, fallbackText: string = '') => {
    if (!locationId || !clientes.length) return fallbackText
    const location = clientes.find((c) => c.value === locationId)
    if (location) {
      // Include address information if available
      const addressParts = []
      if (location.morada) addressParts.push(location.morada)
      if (location.codigo_pos) addressParts.push(location.codigo_pos)
      const addressLine = addressParts.join(' ')
      return location.label + (addressLine ? ` - ${addressLine}` : '')
    }
    return fallbackText
  }

  // Sort records by cliente name, then by FO number
  const sortedRecords = [...records].sort((a, b) => {
    const clienteA = (a.cliente_nome || getClienteName(a.id_cliente) || '').toUpperCase()
    const clienteB = (b.cliente_nome || getClienteName(b.id_cliente) || '').toUpperCase()

    // First sort by cliente
    const clienteCompare = clienteA.localeCompare(clienteB)
    if (clienteCompare !== 0) return clienteCompare

    // Then sort by FO within same cliente
    const foA = a.numero_fo || ''
    const foB = b.numero_fo || ''
    return foA.localeCompare(foB)
  })

  // Group records by cliente
  const clienteGroups = new Map<string, ExportProducaoRow[]>()
  sortedRecords.forEach((record) => {
    const clienteName = (record.cliente_nome || getClienteName(record.id_cliente) || 'SEM CLIENTE').toUpperCase()
    if (!clienteGroups.has(clienteName)) {
      clienteGroups.set(clienteName, [])
    }
    clienteGroups.get(clienteName)!.push(record)
  })

  // Helper function to truncate client name to 20 characters
  const truncateClientName = (name: string): string => {
    if (name.length <= 20) return name
    return name.substring(0, 20) + '(...)'
  }

  // 5. Data rows (start at row 5) - grouped by cliente
  let currentRow = 5 // Track current Excel row number
  let previousCliente: string | null = null
  let isFirstClientGroup = true

  clienteGroups.forEach((clienteRecords, clienteName) => {
    // Add blank row before each client group (except the first one)
    if (!isFirstClientGroup) {
      worksheet.addRow([]) // Add blank row
      currentRow++
    }
    isFirstClientGroup = false

    // Track FO for banded rows
    let previousFO: string | null = null
    let useLightGrey = false

    // Add data rows for this cliente
    clienteRecords.forEach((row, index) => {
      // For banded rows: toggle color when FO changes
      if (useBandedRows && row.numero_fo !== previousFO) {
        if (previousFO !== null) {
          useLightGrey = !useLightGrey
        }
        previousFO = row.numero_fo || null
      }
      const values = columns.map((col) => {
        let value: any
        switch (col.key) {
          case 'cliente':
            value = truncateClientName(clienteName)
            break
          case 'numero_orc':
            value = row.numero_orc || ''
            break
          case 'numero_fo':
            value = row.numero_fo || ''
            break
          case 'data_in':
            value = row.data_in
              ? new Date(row.data_in).toLocaleDateString('pt-PT')
              : ''
            break
          case 'quantidade':
            value = row.quantidade || ''
            break
          case 'descricao':
            value = row.descricao || ''
            break
          case 'data_saida':
            value = row.data_saida
              ? new Date(row.data_saida).toLocaleDateString('pt-PT')
              : ''
            break
          case 'guia':
            value = row.guia || ''
            break
          case 'logistica':
            // Concatenate logistics information
            const logisticaParts: string[] = []

            // LOC.RECOLHA - check ID first, then fallback to text field
            const localRecolhaValue = getLocationName(row.id_local_recolha, row.local_recolha || '')
            if (localRecolhaValue) {
              logisticaParts.push(`LOC.RECOLHA: ${localRecolhaValue}`)
            }

            // LOC.ENTREGA - check ID first, then fallback to text field
            const localEntregaValue = getLocationName(row.id_local_entrega, row.local_entrega || '')
            if (localEntregaValue) {
              logisticaParts.push(`LOC.ENTREGA: ${localEntregaValue}`)
            }

            // TRANSPORTADORA
            if (row.transportadora) {
              logisticaParts.push(`TRANSPORTADORA: ${row.transportadora}`)
            }

            // NOTAS - add at the end
            if (row.notas) {
              logisticaParts.push(`NOTAS: ${row.notas}`)
            }

            value = logisticaParts.join('. ')
            break
          default:
            value = ''
        }

        // Convert all text values to uppercase
        return typeof value === 'string' ? value.toUpperCase() : value
      })

      const excelRow = worksheet.addRow(values)

      // Add thicker top border for first row of new cliente group (separator line)
      const isFirstRowOfClient = previousCliente !== null && previousCliente !== clienteName && index === 0

      excelRow.eachCell((cell, colNumber) => {
        // Apply banded row fill color if enabled and useLightGrey is true
        if (useBandedRows && useLightGrey) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }, // Very light grey
          }
        }

        // Border styling
        cell.border = {
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' },
          // Add thick top border for client separator
          top: isFirstRowOfClient ? { style: 'medium' } : undefined,
        }
        // Align all cells to top
        cell.alignment = { vertical: 'top' }

        // Center-align specific columns
        if (['numero_orc', 'numero_fo', 'data_in', 'data_saida', 'guia', 'quantidade'].includes(columns[colNumber - 1]?.key)) {
          cell.alignment = { ...cell.alignment, horizontal: 'center' }
        }
      })

      // Wrap text for longer text columns
      const itemColIdx = columns.findIndex((col) => col.key === 'descricao') + 1
      const logisticaColIdx = columns.findIndex((col) => col.key === 'logistica') + 1

      if (itemColIdx > 0) {
        excelRow.getCell(itemColIdx).alignment = {
          ...excelRow.getCell(itemColIdx).alignment,
          wrapText: true,
        }
      }
      if (logisticaColIdx > 0) {
        excelRow.getCell(logisticaColIdx).alignment = {
          ...excelRow.getCell(logisticaColIdx).alignment,
          wrapText: true,
        }
      }

      currentRow++
    })

    // Update previous cliente for next iteration
    previousCliente = clienteName
  })

  // 6. Add border around the entire table (header row gets borders)
  const dataStartRow = 4 // Header row

  // Add borders to header row
  for (let col = 1; col <= columns.length; col++) {
    const headerCell = worksheet.getCell(dataStartRow, col)
    headerCell.border = {
      ...headerCell.border,
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
  }

  // 7. Set column widths (pixels converted to Excel units: ~7 pixels per unit)
  worksheet.columns = columns.map((col, i) => {
    switch (col.key) {
      case 'cliente':
        return { key: String(i), width: 30 } // Client name column
      case 'numero_orc':
      case 'numero_fo':
      case 'guia':
        return { key: String(i), width: 8 } // 55px ≈ 8 units
      case 'quantidade':
        return { key: String(i), width: 10 } // 70px ≈ 10 units
      case 'descricao':
        return { key: String(i), width: 40 }
      case 'data_in':
      case 'data_saida':
        return { key: String(i), width: 15 }
      case 'logistica':
        return { key: String(i), width: 55 }
      default:
        return { key: String(i), width: 15 }
    }
  })

  // 8. Configure print settings
  worksheet.pageSetup = {
    paperSize: 9, // A4 paper size (9 = A4)
    orientation: 'landscape', // Landscape orientation
    fitToPage: true, // Enable fit to page
    fitToWidth: 1, // Fit all columns to 1 page width
    fitToHeight: 0, // Don't limit height (allow multiple pages vertically)
    horizontalCentered: true, // Center horizontally on page
    printTitlesRow: '4:4', // Repeat row 4 (header row) on each page
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    },
  }

  // Set print area to include all data
  worksheet.pageSetup.printArea = `A1:${String.fromCharCode(64 + columns.length)}${currentRow}`

  return worksheet
}

export const exportProducaoToExcel = ({
  filteredRecords,
  pendentesRecords,
  activeTab,
  clientes = [],
}: ExportProducaoOptions): void => {
  // Debug: Log received arguments
  console.log('exportProducaoToExcel called with:', {
    filteredRecords,
    pendentesRecords,
    activeTab,
    clientes,
  })

  const workbook = new ExcelJS.Workbook()

  // Determine main sheet title based on active tab
  // Note: activeTab can be 'em_curso', 'concluidos', or 'pendentes'
  // But the main filtered data is always "EM CURSO" (non-completed, non-pendentes jobs)
  const mainSheetTitle = 'EM CURSO' // Main data is always in-progress jobs (pendente = false, concluido = false)

  // ALWAYS create all 4 sheets (even if data is empty)

  // Sheet 1: EM CURSO data (internal version)
  createWorksheet(workbook, 'EM CURSO', 'EM CURSO', filteredRecords, clientes, false)

  // Sheet 2: PENDENTES data (internal version)
  createWorksheet(workbook, 'PENDENTES', 'PENDENTES', pendentesRecords || [], clientes, false)

  // Sheet 3: EM CURSO CLIENT version (with banded rows per FO)
  createWorksheet(workbook, 'Cliente - EM CURSO', 'EM CURSO', filteredRecords, clientes, true)

  // Sheet 4: PENDENTES CLIENT version (with banded rows per FO)
  createWorksheet(workbook, 'Cliente - PENDENTES', 'PENDENTES', pendentesRecords || [], clientes, true)

  // Download the file
  workbook.xlsx.writeBuffer().then((buffer) => {
    const fileName = `PRODUCAO_${activeTab.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`
    saveAs(new Blob([buffer]), fileName)
  })
}

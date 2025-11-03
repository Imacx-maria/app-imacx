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
  activeTab: 'em_curso' | 'concluidos' | 'pendentes'
  clientes?: {
    value: string
    label: string
    morada?: string
    codigo_pos?: string
  }[]
}

export const exportProducaoToExcel = ({
  filteredRecords,
  activeTab,
  clientes = [],
}: ExportProducaoOptions): void => {
  // Debug: Log received arguments
  console.log('exportProducaoToExcel called with:', {
    filteredRecords,
    activeTab,
    clientes,
  })

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Producao')

  // Column definitions (as requested by user)
  const columns = [
    { header: 'ORC', key: 'numero_orc' },
    { header: 'FO', key: 'numero_fo' },
    { header: 'CLIENTE', key: 'cliente_nome' },
    { header: 'QTD', key: 'quantidade' },
    { header: 'ITEM', key: 'descricao' },
    { header: 'DATA ENTRADA', key: 'data_in' },
    { header: 'DATA SAÍDA', key: 'data_saida' },
    { header: 'NOTAS', key: 'notas' },
    { header: 'GT', key: 'guia' },
    { header: 'LOGÍSTICA', key: 'logistica' },
  ]

  // 1. Title row
  worksheet.mergeCells(1, 1, 1, columns.length)
  const titleCell = worksheet.getCell(1, 1)
  const tabTitle = activeTab === 'em_curso' ? 'EM CURSO' : activeTab === 'pendentes' ? 'PENDENTES' : 'CONCLUÍDOS'
  titleCell.value = `RELATÓRIO DE PRODUÇÃO - ${tabTitle}`
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
  const getLocationName = (locationId: string | undefined) => {
    if (!locationId || !clientes.length) return ''
    const location = clientes.find((c) => c.value === locationId)
    if (location) {
      // Include address information if available
      const addressParts = []
      if (location.morada) addressParts.push(location.morada)
      if (location.codigo_pos) addressParts.push(location.codigo_pos)
      const addressLine = addressParts.join(' ')
      return location.label + (addressLine ? ` - ${addressLine}` : '')
    }
    return ''
  }

  // Sort records by FO number
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const foA = a.numero_fo || ''
    const foB = b.numero_fo || ''
    return foA.localeCompare(foB)
  })

  // Generate a light random color for FO grouping
  function generateLightColor(index: number): string {
    const colors = [
      'FFFCE7F3', // light pink
      'FFE0E7FF', // light blue
      'FFDBEAFE', // light purple
      'FFFCE8D5', // light orange
      'FFFEF9C3', // light yellow
      'FFD1FAE5', // light green
      'FFE0F2FE', // light sky
      'FFFECDD3', // light rose
      'FFE9D5FF', // light lavender
      'FFFECACA', // light red
      'FFDDD6FE', // light violet
      'FFE0F2F1', // light teal
      'FFFEF3C7', // light amber
      'FFCCFBF1', // light cyan
      'FFF5D0FE', // light magenta
    ]
    return colors[index % colors.length]
  }

  // Group records by FO to assign colors
  const foGroups = new Map<string, number>()
  let colorIndex = 0
  sortedRecords.forEach((record) => {
    const fo = record.numero_fo || 'N/A'
    if (!foGroups.has(fo)) {
      foGroups.set(fo, colorIndex++)
    }
  })

  // 5. Data rows (start at row 5)
  sortedRecords.forEach((row) => {
    const clienteNome = row.cliente_nome || getClienteName(row.id_cliente)

    const values = columns.map((col) => {
      let value: any
      switch (col.key) {
        case 'numero_orc':
          value = row.numero_orc || ''
          break
        case 'numero_fo':
          value = row.numero_fo || ''
          break
        case 'cliente_nome':
          // Truncate to 15 characters and add (...)
          const fullName = clienteNome
          value = fullName.length > 15 ? fullName.substring(0, 15) + '...' : fullName
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
        case 'notas':
          value = row.notas || ''
          break
        case 'guia':
          value = row.guia || ''
          break
        case 'logistica':
          // Concatenate logistics information
          const logisticaParts: string[] = []

          // LOC.RECOLHA
          const localRecolha = row.id_local_recolha
            ? getLocationName(row.id_local_recolha)
            : row.local_recolha || ''
          if (localRecolha) {
            logisticaParts.push(`LOC.RECOLHA: ${localRecolha}`)
          }

          // LOC.ENTREGA
          const localEntrega = row.id_local_entrega
            ? getLocationName(row.id_local_entrega)
            : row.local_entrega || ''
          if (localEntrega) {
            logisticaParts.push(`LOC.ENTREGA: ${localEntrega}`)
          }

          // TRANSPORTADORA
          if (row.transportadora) {
            logisticaParts.push(`TRANSPORTADORA: ${row.transportadora}`)
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
    
    // Get color for this FO group
    const fo = row.numero_fo || 'N/A'
    const foColorIndex = foGroups.get(fo) || 0
    const fillColor = generateLightColor(foColorIndex)

    excelRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor },
      }
      // Only vertical borders
      cell.border = {
        left: { style: 'thin' },
        right: { style: 'thin' },
      }
      // Align all cells to top
      cell.alignment = { ...cell.alignment, vertical: 'top' }

      // Right-align numeric columns
      if (['numero_orc', 'quantidade'].includes(columns[colNumber - 1]?.key)) {
        cell.alignment = { ...cell.alignment, horizontal: 'right' }
      }
    })

    // Wrap text for longer text columns
    const itemColIdx = columns.findIndex((col) => col.key === 'descricao') + 1
    const logisticaColIdx =
      columns.findIndex((col) => col.key === 'logistica') + 1
    const notasColIdx =
      columns.findIndex((col) => col.key === 'notas') + 1

    if (itemColIdx > 0)
      excelRow.getCell(itemColIdx).alignment = {
        ...excelRow.getCell(itemColIdx).alignment,
        wrapText: true,
        vertical: 'top',
      }
    if (logisticaColIdx > 0)
      excelRow.getCell(logisticaColIdx).alignment = {
        ...excelRow.getCell(logisticaColIdx).alignment,
        wrapText: true,
        vertical: 'top',
      }
    if (notasColIdx > 0)
      excelRow.getCell(notasColIdx).alignment = {
        ...excelRow.getCell(notasColIdx).alignment,
        wrapText: true,
        vertical: 'top',
      }
  })

  // 6. Add border around the entire table
  const dataStartRow = 4
  const dataEndRow = 4 + sortedRecords.length

  if (sortedRecords.length > 0) {
    for (let col = 1; col <= columns.length; col++) {
      // Top border
      worksheet.getCell(dataStartRow, col).border = {
        ...worksheet.getCell(dataStartRow, col).border,
        top: { style: 'thin' },
      }
      // Bottom border
      worksheet.getCell(dataEndRow, col).border = {
        ...worksheet.getCell(dataEndRow, col).border,
        bottom: { style: 'thin' },
      }
    }

    // Left and right borders for the whole table
    for (let row = dataStartRow; row <= dataEndRow; row++) {
      worksheet.getCell(row, 1).border = {
        ...worksheet.getCell(row, 1).border,
        left: { style: 'thin' },
      }
      worksheet.getCell(row, columns.length).border = {
        ...worksheet.getCell(row, columns.length).border,
        right: { style: 'thin' },
      }
    }
  }

  // 7. Set column widths
  worksheet.columns = columns.map((col, i) => {
    switch (col.key) {
      case 'numero_orc':
      case 'numero_fo':
        return { key: String(i), width: 12 }
      case 'quantidade':
        return { key: String(i), width: 10 }
      case 'cliente_nome':
        return { key: String(i), width: 18 }
      case 'descricao':
        return { key: String(i), width: 40 }
      case 'data_in':
      case 'data_saida':
        return { key: String(i), width: 15 }
      case 'notas':
        return { key: String(i), width: 25 }
      case 'guia':
        return { key: String(i), width: 12 }
      case 'logistica':
        return { key: String(i), width: 50 }
      default:
        return { key: String(i), width: 15 }
    }
  })

  // 8. Download the file
  workbook.xlsx.writeBuffer().then((buffer) => {
    const fileName = `PRODUCAO_${activeTab.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`
    saveAs(new Blob([buffer]), fileName)
  })
}

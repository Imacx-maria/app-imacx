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
  data_concluido?: string | null
  transportadora?: string
  local_entrega?: string
  local_recolha?: string // Added field for pickup location
  id_local_entrega?: string // UUID for delivery location lookup
  id_local_recolha?: string // UUID for pickup location lookup
  cliente_nome?: string // For display purposes
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

  // Column definitions
  const columns = [
    { header: 'ORC', key: 'numero_orc' },
    { header: 'FO', key: 'numero_fo' },
    { header: 'CLIENTE', key: 'cliente_nome' },
    { header: 'QUANT.', key: 'quantidade' },
    { header: 'CAMPANHA', key: 'nome_campanha' },
    { header: 'ITEM', key: 'descricao' },
    { header: 'DATA ENTRADA', key: 'data_in' },
    { header: 'DATA CONCLUÍDO', key: 'data_concluido' },
    { header: 'TRANSPORTADORA', key: 'transportadora' },
    { header: 'LOCAL RECOLHA', key: 'local_recolha' },
    { header: 'LOCAL ENTREGA', key: 'local_entrega' },
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
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F4F4F' }, // Dark gray background
    }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
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

  // 5. Data rows (start at row 5)
  sortedRecords.forEach((row, idx) => {
    const clienteNome = getClienteName(row.id_cliente)

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
          value = clienteNome
          break
        case 'quantidade':
          value = row.quantidade || ''
          break
        case 'nome_campanha':
          value = row.nome_campanha || ''
          break
        case 'descricao':
          value = row.descricao || ''
          break
        case 'data_in':
          value = row.data_in
            ? new Date(row.data_in).toLocaleDateString('pt-PT')
            : ''
          break
        case 'data_concluido':
          value = row.data_concluido
            ? new Date(row.data_concluido).toLocaleDateString('pt-PT')
            : ''
          break
        case 'transportadora':
          value = row.transportadora || ''
          break
        case 'local_recolha':
          // Try UUID lookup first, fallback to text field
          value = row.id_local_recolha
            ? getLocationName(row.id_local_recolha)
            : row.local_recolha || ''
          break
        case 'local_entrega':
          // Try UUID lookup first, fallback to text field
          value = row.id_local_entrega
            ? getLocationName(row.id_local_entrega)
            : row.local_entrega || ''
          break
        default:
          value = ''
      }

      // Convert all text values to uppercase
      return typeof value === 'string' ? value.toUpperCase() : value
    })

    const excelRow = worksheet.addRow(values)
    const fillColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF3F4F6' // Alternating row colors

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
    const campaignColIdx =
      columns.findIndex((col) => col.key === 'nome_campanha') + 1
    const itemColIdx = columns.findIndex((col) => col.key === 'descricao') + 1
    const clienteColIdx =
      columns.findIndex((col) => col.key === 'cliente_nome') + 1
    const recolhaColIdx =
      columns.findIndex((col) => col.key === 'local_recolha') + 1
    const entregaColIdx =
      columns.findIndex((col) => col.key === 'local_entrega') + 1

    if (campaignColIdx > 0)
      excelRow.getCell(campaignColIdx).alignment = {
        ...excelRow.getCell(campaignColIdx).alignment,
        wrapText: true,
        vertical: 'top',
      }
    if (itemColIdx > 0)
      excelRow.getCell(itemColIdx).alignment = {
        ...excelRow.getCell(itemColIdx).alignment,
        wrapText: true,
        vertical: 'top',
      }
    if (clienteColIdx > 0)
      excelRow.getCell(clienteColIdx).alignment = {
        ...excelRow.getCell(clienteColIdx).alignment,
        wrapText: true,
        vertical: 'top',
      }
    if (recolhaColIdx > 0)
      excelRow.getCell(recolhaColIdx).alignment = {
        ...excelRow.getCell(recolhaColIdx).alignment,
        wrapText: true,
        vertical: 'top',
      }
    if (entregaColIdx > 0)
      excelRow.getCell(entregaColIdx).alignment = {
        ...excelRow.getCell(entregaColIdx).alignment,
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
        return { key: String(i), width: 25 }
      case 'nome_campanha':
        return { key: String(i), width: 35 }
      case 'descricao':
        return { key: String(i), width: 40 }
      case 'data_in':
      case 'data_concluido':
        return { key: String(i), width: 15 }
      case 'transportadora':
        return { key: String(i), width: 20 }
      case 'local_recolha':
      case 'local_entrega':
        return { key: String(i), width: 30 }
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

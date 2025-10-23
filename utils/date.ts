// Utility to format a date as DD/MM/YYYY
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

// Utility to parse a date string as a local date (YYYY-MM-DD)
export const parseDateFromYYYYMMDD = (
  dateString: string | null | undefined,
): Date | null => {
  if (!dateString) return null
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

// Utility to format a Date as 'YYYY-MM-DD' in local time
export const formatDateToYYYYMMDD = (
  date: Date | null | undefined,
): string | null => {
  if (!date) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get standardized year range for financial data
 * Returns current year, previous year, and 2 years ago
 * Example: If current year is 2025, returns [2025, 2024, 2023]
 */
export const getFinancialYearRange = (): number[] => {
  const currentYear = new Date().getFullYear()
  return [currentYear, currentYear - 1, currentYear - 2]
}

/**
 * Simplified utilities for working with MM/YYYY format data
 * Since data is already aggregated by month, no complex aggregation needed
 */

export interface MonthYearData {
  data_documento: string // Date in format MM/YYYY (e.g., "07/2025")
  [key: string]: any // Any other properties
}

export interface SimpleGroupedData {
  period: string // YYYY-MM format for consistency with charts
  displayPeriod: string // MM/YYYY format for display
  data: any[] // Array of original data items for this period
  [key: string]: any // Aggregated values
}

/**
 * Converts MM/YYYY format to YYYY-MM format for chart compatibility
 */
export function convertToStandardPeriod(mmyyyyDate: string): string {
  const [month, year] = mmyyyyDate.split('/')
  return `${year}-${month.padStart(2, '0')}`
}

/**
 * Converts YYYY-MM format back to MM/YYYY format for display
 */
export function convertToDisplayPeriod(yyyymmDate: string): string {
  const [year, month] = yyyymmDate.split('-')
  return `${month}/${year}`
}

/**
 * Groups MM/YYYY format data by month (converts to YYYY-MM internally for sorting)
 * No complex aggregation needed since data is already monthly
 */
export function groupMonthYearData(
  data: MonthYearData[],
  aggregationFields: string[] = [],
): SimpleGroupedData[] {
  const grouped = data.reduce(
    (acc, item) => {
      const standardPeriod = convertToStandardPeriod(item.data_documento)

      if (!acc[standardPeriod]) {
        acc[standardPeriod] = {
          period: standardPeriod,
          displayPeriod: item.data_documento,
          data: [],
          ...aggregationFields.reduce(
            (fieldAcc, field) => {
              fieldAcc[field] = 0
              return fieldAcc
            },
            {} as Record<string, number>,
          ),
        }
      }

      acc[standardPeriod].data.push(item)

      // Aggregate numeric fields
      aggregationFields.forEach((field) => {
        const value = Number(item[field]) || 0
        acc[standardPeriod][field] += value
      })

      return acc
    },
    {} as Record<string, SimpleGroupedData>,
  )

  const result = Object.values(grouped).sort((a, b) =>
    a.period.localeCompare(b.period),
  )

  return result
}

/**
 * Groups MM/YYYY format data by year
 */
export function groupMonthYearDataByYear(
  data: MonthYearData[],
  aggregationFields: string[] = [],
): SimpleGroupedData[] {
  const grouped = data.reduce(
    (acc, item) => {
      const [month, year] = item.data_documento.split('/')
      const yearKey = year

      if (!acc[yearKey]) {
        acc[yearKey] = {
          period: yearKey,
          displayPeriod: yearKey,
          data: [],
          ...aggregationFields.reduce(
            (fieldAcc, field) => {
              fieldAcc[field] = 0
              return fieldAcc
            },
            {} as Record<string, number>,
          ),
        }
      }

      acc[yearKey].data.push(item)

      // Aggregate numeric fields
      aggregationFields.forEach((field) => {
        const value = Number(item[field]) || 0
        acc[yearKey][field] += value
      })

      return acc
    },
    {} as Record<string, SimpleGroupedData>,
  )

  const result = Object.values(grouped).sort((a, b) =>
    a.period.localeCompare(b.period),
  )

  return result
}

/**
 * Format period for display - simplified for MM/YYYY data
 */
export function formatSimplePeriodDisplay(
  period: string,
  groupBy: 'month' | 'year',
): string {
  if (groupBy === 'year') {
    return period
  }

  // For month format YYYY-MM, convert to Portuguese month name
  const [year, month] = period.split('-')
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]

  return `${monthNames[parseInt(month) - 1]} ${year}`
}

/**
 * Get available periods from MM/YYYY data for filtering
 */
export function getAvailablePeriodsFromMonthYear(
  data: MonthYearData[],
  groupBy: 'month' | 'year',
): string[] {
  const periods = new Set<string>()

  data.forEach((item) => {
    const [month, year] = item.data_documento.split('/')
    if (groupBy === 'year') {
      periods.add(year)
    } else {
      periods.add(`${year}-${month.padStart(2, '0')}`)
    }
  })

  return Array.from(periods).sort()
}

// Legacy functions kept for backward compatibility during transition
/**
 * Groups financial data by month or year
 * Used for aggregating daily data from tables like faturas_vendedor, vendas_vendedor, etc.
 * DEPRECATED: Use groupMonthYearData for MM/YYYY format data
 */

export interface DateGroupableData {
  data: string // Date in format YYYY-MM-DD
  [key: string]: any // Any other properties
}

export interface GroupedData {
  period: string // YYYY-MM for month, YYYY for year
  data: any[] // Array of original data items for this period
  [key: string]: any // Aggregated values
}

/**
 * Groups data by month (YYYY-MM format)
 * DEPRECATED: Use groupMonthYearData for MM/YYYY format data
 */
export function groupDataByMonth(
  data: DateGroupableData[],
  aggregationFields: string[] = [],
): GroupedData[] {
  const grouped = data.reduce(
    (acc, item) => {
      const date = new Date(item.data)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!acc[monthKey]) {
        acc[monthKey] = {
          period: monthKey,
          data: [],
          ...aggregationFields.reduce(
            (fieldAcc, field) => {
              fieldAcc[field] = 0
              return fieldAcc
            },
            {} as Record<string, number>,
          ),
        }
      }

      acc[monthKey].data.push(item)

      // Aggregate numeric fields
      aggregationFields.forEach((field) => {
        const value = Number(item[field]) || 0
        acc[monthKey][field] += value
      })

      return acc
    },
    {} as Record<string, GroupedData>,
  )

  const result = Object.values(grouped).sort((a, b) =>
    a.period.localeCompare(b.period),
  )

  return result
}

/**
 * Groups data by year (YYYY format)
 * DEPRECATED: Use groupMonthYearDataByYear for MM/YYYY format data
 */
export function groupDataByYear(
  data: DateGroupableData[],
  aggregationFields: string[] = [],
): GroupedData[] {
  const grouped = data.reduce(
    (acc, item) => {
      const date = new Date(item.data)
      const yearKey = String(date.getFullYear())

      if (!acc[yearKey]) {
        acc[yearKey] = {
          period: yearKey,
          data: [],
          ...aggregationFields.reduce(
            (fieldAcc, field) => {
              fieldAcc[field] = 0
              return fieldAcc
            },
            {} as Record<string, number>,
          ),
        }
      }

      acc[yearKey].data.push(item)

      // Aggregate numeric fields
      aggregationFields.forEach((field) => {
        const value = Number(item[field]) || 0
        acc[yearKey][field] += value
      })

      return acc
    },
    {} as Record<string, GroupedData>,
  )

  const result = Object.values(grouped).sort((a, b) =>
    a.period.localeCompare(b.period),
  )

  return result
}

/**
 * Format period for display
 * DEPRECATED: Use formatSimplePeriodDisplay for MM/YYYY format data
 */
export function formatPeriodDisplay(
  period: string,
  groupBy: 'month' | 'year',
): string {
  if (groupBy === 'year') {
    return period
  }

  // For month format YYYY-MM
  const [year, month] = period.split('-')
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]

  return `${monthNames[parseInt(month) - 1]} ${year}`
}

/**
 * Get available periods from data for filtering
 * DEPRECATED: Use getAvailablePeriodsFromMonthYear for MM/YYYY format data
 */
export function getAvailablePeriods(
  data: DateGroupableData[],
  groupBy: 'month' | 'year',
): string[] {
  const periods = new Set<string>()

  data.forEach((item) => {
    const date = new Date(item.data)
    if (groupBy === 'year') {
      periods.add(String(date.getFullYear()))
    } else {
      periods.add(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      )
    }
  })

  return Array.from(periods).sort()
}

/**
 * Helper function to aggregate multiple numeric fields at once
 */
export function aggregateFields(
  data: any[],
  fields: string[],
): Record<string, number> {
  return fields.reduce(
    (acc, field) => {
      acc[field] = data.reduce(
        (sum, item) => sum + (Number(item[field]) || 0),
        0,
      )
      return acc
    },
    {} as Record<string, number>,
  )
}

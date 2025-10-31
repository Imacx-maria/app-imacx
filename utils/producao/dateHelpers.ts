/**
 * Date Helper Functions for Producao Module
 * Extracted from app/producao/page.tsx for better organization
 */

import { format } from 'date-fns'

/**
 * Parse a date string in YYYY-MM-DD format to a local Date object
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object in local timezone
 */
export function parseDateFromYYYYMMDD(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format date to Portuguese short format (DD/MM/YY)
 * @param dateString - ISO date string or null/undefined
 * @returns Formatted date string or empty string if invalid
 */
export function formatDatePortuguese(
  dateString: string | null | undefined,
): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    return format(date, 'dd/MM/yy')
  } catch {
    return ''
  }
}

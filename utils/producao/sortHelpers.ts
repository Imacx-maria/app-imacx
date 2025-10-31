/**
 * Sort Helper Functions for Producao Module
 * Extracted from app/producao/page.tsx for better organization
 */

/**
 * Smart numeric sorting helper that handles mixed text/number fields
 * - Numbers are sorted numerically
 * - Text values are sorted after all numbers using character codes
 * - Null/undefined values are treated as 0
 *
 * @param value - Value to parse (string, number, null, or undefined)
 * @returns Numeric value for sorting
 */
export const parseNumericField = (
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

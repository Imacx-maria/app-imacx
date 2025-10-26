/**
 * Chart Color System
 * 
 * Uses CSS variables from globals.css to ensure consistent theming
 * across light and dark modes. All chart colors are defined as CSS 
 * variables following the IMACX Design System v3.0 principle:
 * "CSS VARIABLES ONLY - Never hardcode colors"
 */

/**
 * Gets a CSS variable value from the document root
 * Returns the computed color value (e.g., "oklch(0.87 0.1 95)")
 */
const getCSSVar = (varName: string): string => {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback - return variable reference
    return `var(${varName})`
  }
  
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
  
  return value || `var(${varName})`
}

/**
 * Material-specific chart colors
 * Maps to material types used in stock management
 */
export const MATERIAL_COLORS = {
  CARTAO: () => getCSSVar('--chart-cartao'),       // Soft pastel yellow
  RIGIDOS: () => getCSSVar('--chart-rigidos'),     // Muted teal blue
  FLEXIVEIS: () => getCSSVar('--chart-flexiveis'), // Earthy green
  CRITICAL: () => getCSSVar('--chart-critical'),   // Dark charcoal brown
  WARNING: () => getCSSVar('--chart-neutral'),     // Warm beige
  GOOD: () => getCSSVar('--chart-good'),           // Earthy green
}

/**
 * General-purpose chart color palette
 * Use for charts with multiple data series
 */
export const CHART_PALETTE = Array.from({ length: 12 }, (_, i) => 
  () => getCSSVar(`--chart-${i + 1}`)
)

/**
 * Get a chart color by index from the palette
 * Useful for dynamically generated series
 */
export const getChartColor = (index: number): string => {
  const paletteIndex = index % CHART_PALETTE.length
  return CHART_PALETTE[paletteIndex]()
}

/**
 * Generate an array of colors for a given count
 * Cycles through the palette if count > 12
 */
export const generateChartColors = (count: number): string[] => {
  return Array.from({ length: count }, (_, i) => getChartColor(i))
}

/**
 * Legacy compatibility object - use for existing chart components
 * TODO: Migrate all hardcoded colors to use CSS variables
 */
export const COLORS = {
  CARTAO: MATERIAL_COLORS.CARTAO(),
  RIGIDOS: MATERIAL_COLORS.RIGIDOS(),
  FLEXIVEIS: MATERIAL_COLORS.FLEXIVEIS(),
  CRITICAL: MATERIAL_COLORS.CRITICAL(),
  WARNING: MATERIAL_COLORS.WARNING(),
  GOOD: MATERIAL_COLORS.GOOD(),
}

/**
 * Legacy compatibility array for caracteristica colors
 * TODO: Migrate to use generateChartColors()
 */
export const CARACTERISTICA_COLORS = generateChartColors(12)


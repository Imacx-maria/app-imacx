/**
 * Page Permission Utility
 * Maps URL paths to pageIds and provides permission checking logic
 */

/**
 * Maps a URL path to its corresponding pageId for permission checking
 * @param path - The URL path (e.g., '/definicoes/utilizadores')
 * @returns The pageId to check against permissions (e.g., 'definicoes/utilizadores')
 */
export function getPageIdFromPath(path: string): string {
  // Remove leading slash and query parameters
  const cleanPath = path.replace(/^\//, '').split('?')[0]

  // Return empty string for root
  if (!cleanPath) return ''

  return cleanPath
}

/**
 * Checks if a user's permissions allow access to a specific path
 * @param path - The URL path to check (e.g., '/definicoes/utilizadores')
 * @param userPermissions - Array of permission strings from user's role
 * @returns true if user has permission, false otherwise
 */
export function canAccessPath(path: string, userPermissions: string[]): boolean {
  // Admin wildcard grants access to everything
  if (userPermissions.includes('*')) return true

  const pageId = getPageIdFromPath(path)

  // Empty path (root) requires no permissions
  if (!pageId) return true

  // Direct match
  if (userPermissions.includes(pageId)) return true

  // Check parent paths (e.g., 'definicoes' allows 'definicoes/utilizadores')
  return userPermissions.some(perm => {
    // Parent permission grants access to child paths
    return pageId.startsWith(perm + '/')
  })
}

/**
 * Gets the parent permission for a path
 * @param path - The URL path (e.g., '/definicoes/utilizadores')
 * @returns The parent pageId (e.g., 'definicoes') or null if no parent
 */
export function getParentPageId(path: string): string | null {
  const pageId = getPageIdFromPath(path)
  const parts = pageId.split('/')

  if (parts.length <= 1) return null

  return parts.slice(0, -1).join('/')
}

/**
 * Common page paths used in the application
 */
export const PAGE_PATHS = {
  DASHBOARD: '/dashboard',
  DESIGNER_FLOW: '/designer-flow',
  PRODUCAO: '/producao',
  PRODUCAO_OPERACOES: '/producao/operacoes',
  STOCKS: '/stocks',
  GESTAO: '/gestao',
  GESTAO_FATURACAO: '/gestao/faturacao',
  GESTAO_ANALYTICS: '/gestao/analytics',
  DEFINICOES: '/definicoes',
  DEFINICOES_UTILIZADORES: '/definicoes/utilizadores',
  DEFINICOES_FUNCOES: '/definicoes/funcoes',
  DEFINICOES_FERIADOS: '/definicoes/feriados',
  DEFINICOES_ARMAZENS: '/definicoes/armazens',
  DEFINICOES_COMPLEXIDADE: '/definicoes/complexidade',
  DEFINICOES_TRANSPORTADORAS: '/definicoes/transportadoras',
  DEFINICOES_USER_MAPPING: '/definicoes/user-name-mapping',
  DEFINICOES_MATERIAIS: '/definicoes/materiais',
  DEFINICOES_MAQUINAS: '/definicoes/maquinas',
} as const

/**
 * Common pageIds used in permissions
 */
export const PAGE_IDS = {
  DASHBOARD: 'dashboard',
  DESIGNER_FLOW: 'designer-flow',
  PRODUCAO: 'producao',
  PRODUCAO_OPERACOES: 'producao/operacoes',
  STOCKS: 'stocks',
  GESTAO: 'gestao',
  GESTAO_FATURACAO: 'gestao/faturacao',
  GESTAO_ANALYTICS: 'gestao/analytics',
  DEFINICOES: 'definicoes',
  DEFINICOES_UTILIZADORES: 'definicoes/utilizadores',
  DEFINICOES_FUNCOES: 'definicoes/funcoes',
  DEFINICOES_FERIADOS: 'definicoes/feriados',
  DEFINICOES_ARMAZENS: 'definicoes/armazens',
  DEFINICOES_COMPLEXIDADE: 'definicoes/complexidade',
  DEFINICOES_TRANSPORTADORAS: 'definicoes/transportadoras',
  DEFINICOES_USER_MAPPING: 'definicoes/user-name-mapping',
  DEFINICOES_MATERIAIS: 'definicoes/materiais',
  DEFINICOES_MAQUINAS: 'definicoes/maquinas',
} as const

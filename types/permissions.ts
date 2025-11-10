export const ROLES = {
  ADMIN: 'admin',
  DESIGNER: 'designer',
  OP_STOCKS: 'op_stocks',
  OP_PRODUCAO: 'op_producao',
} as const

export type RoleId = (typeof ROLES)[keyof typeof ROLES]

export const PERMISSIONS = {
  PAGE_ALL: 'page:*',
  PAGE_DASHBOARD: 'page:dashboard',
  PAGE_STOCKS: 'page:stocks',
  PAGE_STOCKS_GESTAO: 'page:stocks/gestao',
  STOCKS_READ: 'stocks:read',
  STOCKS_WRITE: 'stocks:write',
  MATERIAIS_READ: 'materiais:read',
  MATERIAIS_WRITE: 'materiais:write',
  USERS_MANAGE: 'users:manage',
} as const

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

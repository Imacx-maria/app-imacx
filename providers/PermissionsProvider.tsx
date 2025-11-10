"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { ROLES, type RoleId, type PermissionId } from '@/types/permissions'

interface PermissionsContextType {
  roles: RoleId[]
  pagePermissions: PermissionId[]
  actionPermissions: PermissionId[]
  loading: boolean
  hasRole: (role: RoleId) => boolean
  hasAnyRole: (roles: RoleId[]) => boolean
  hasPermission: (perm: PermissionId) => boolean
  hasAllPermissions: (perms: PermissionId[]) => boolean
  canAccessPage: (page: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
  roles: [],
  pagePermissions: [],
  actionPermissions: [],
  loading: true,
  hasRole: () => false,
  hasAnyRole: () => false,
  hasPermission: () => false,
  hasAllPermissions: () => false,
  canAccessPage: () => false,
})

export const usePermissions = () => useContext(PermissionsContext)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [roles, setRoles] = useState<RoleId[]>([])
  const [pagePermissions, setPagePermissions] = useState<PermissionId[]>([])
  const [actionPermissions, setActionPermissions] = useState<PermissionId[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient()

    const fetchPermissions = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/permissions/me', { cache: 'no-store' })

        if (res.status === 401) {
          setRoles([])
          setPagePermissions([])
          setActionPermissions([])
          setLoading(false)
          return
        }

        if (!res.ok) {
          console.error('[PermissionsProvider] permissions error', res.status)
          setRoles([])
          setPagePermissions([])
          setActionPermissions([])
          setLoading(false)
          return
        }

        const data = await res.json() as {
          roles?: RoleId[]
          pagePermissions?: PermissionId[]
          actionPermissions?: PermissionId[]
        }

        const nextRoles = Array.isArray(data.roles) ? data.roles : []
        const nextPagePerms = Array.isArray(data.pagePermissions)
          ? data.pagePermissions
          : []
        const nextActionPerms = Array.isArray(data.actionPermissions)
          ? data.actionPermissions
          : []

        // Map role names from API to our ROLES enum
        const roleName = (nextRoles as string[])[0] // API returns single role
        let mappedRole: RoleId | null = null
        
        if (roleName === 'admin') {
          mappedRole = ROLES.ADMIN
        } else if (roleName === 'designer') {
          mappedRole = ROLES.DESIGNER
        } else if (roleName === 'op_stocks') {
          mappedRole = ROLES.OP_STOCKS
        } else if (roleName === 'op_producao') {
          mappedRole = ROLES.OP_PRODUCAO
        }
        
        const mappedRoles: RoleId[] = mappedRole ? [mappedRole] : []

        setRoles(mappedRoles)
        setPagePermissions(nextPagePerms)
        setActionPermissions(nextActionPerms)
      } catch (e) {
        console.error('[PermissionsProvider] fetch failed', e)
        setRoles([])
        setPagePermissions([])
        setActionPermissions([])
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchPermissions()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const hasRole = (role: RoleId) => roles.includes(role)
  const hasAnyRole = (rs: RoleId[]) => rs.some(r => roles.includes(r))
  const hasPermission = (perm: PermissionId) => hasRole(ROLES.ADMIN) || actionPermissions.includes(perm)
  const hasAllPermissions = (perms: PermissionId[]) => perms.every(p => hasPermission(p))

  const canAccessPage = (path: string) => {
    if (hasRole(ROLES.ADMIN)) return true
    const normalized = path.toLowerCase()
    return pagePermissions.some(p => {
      if (p === 'page:*') return true
      if (!p.startsWith('page:')) return false
      const base = p.replace('page:', '').toLowerCase()
      return normalized === base || normalized.startsWith(base + '/')
    })
  }

  const value: PermissionsContextType = {
    roles,
    pagePermissions,
    actionPermissions,
    loading,
    hasRole,
    hasAnyRole,
    hasPermission,
    hasAllPermissions,
    canAccessPage,
  }

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

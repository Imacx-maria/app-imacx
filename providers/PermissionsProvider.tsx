"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'

interface PermissionsContextType {
  permissions: string[]
  role: string | null
  loading: boolean
  isAdmin: boolean
  isDesigner: boolean
  hasPermission: (permission: string) => boolean
  hasRole: (roleId: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
  role: null,
  loading: true,
  isAdmin: false,
  isDesigner: false,
  hasPermission: () => false,
  hasRole: () => false,
})

export const usePermissions = () => useContext(PermissionsContext)

const DESIGNER_ROLE_ID = '3132fced-ae83-4f56-9d15-c92c3ef6b6ae'

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [permissions, setPermissions] = useState<string[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const supabase = createBrowserClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          setLoading(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role_id')
          .eq('user_id', session.user.id)
          .single()

        if (profile?.role_id) {
          setRole(profile.role_id)

          const { data: rolePerms } = await supabase
            .from('role_permissions')
            .select('permission')
            .eq('role_id', profile.role_id)

          if (rolePerms) {
            setPermissions(rolePerms.map((p) => p.permission))
          }
        }
      } catch (error) {
        console.error('Error fetching permissions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [])

  const hasPermission = (permission: string) => permissions.includes(permission)
  const hasRole = (roleId: string) => role === roleId

  const value: PermissionsContextType = {
    permissions,
    role,
    loading,
    isAdmin: permissions.includes('admin'),
    isDesigner: role === DESIGNER_ROLE_ID,
    hasPermission,
    hasRole,
  }

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}


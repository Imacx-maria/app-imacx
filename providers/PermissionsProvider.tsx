"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'

interface PermissionsContextType {
  permissions: string[]
  pagePermissions: string[]
  role: string | null
  loading: boolean
  isAdmin: boolean
  isDesigner: boolean
  hasPermission: (permission: string) => boolean
  hasRole: (roleId: string) => boolean
  canAccessPage: (page: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
  pagePermissions: [],
  role: null,
  loading: true,
  isAdmin: false,
  isDesigner: false,
  hasPermission: () => false,
  hasRole: () => false,
  canAccessPage: () => false,
})

export const usePermissions = () => useContext(PermissionsContext)

const DESIGNER_ROLE_ID = '3132fced-ae83-4f56-9d15-c92c3ef6b6ae'
const ADMIN_ROLE_ID = '7c53a7a2-ab07-4ba3-8c1a-7e8e215cadf0'

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [permissions, setPermissions] = useState<string[]>([])
  const [pagePermissions, setPagePermissions] = useState<string[]>([])
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
          console.log('No session found')
          setLoading(false)
          return
        }

        // Try to get profile - if RLS blocks it, we can still show dashboard
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role_id')
          .eq('user_id', session.user.id)
          .single()

        if (profileError) {
          console.warn('Profile fetch error (likely RLS policy):', profileError)
          // If we can't get profile, give dashboard access only
          setPagePermissions(['dashboard'])
          setLoading(false)
          return
        }

        if (profile?.role_id) {
          setRole(profile.role_id)
          console.log('User role_id:', profile.role_id)

          // Fetch role with page_permissions AND role name for fallback
          const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('id, name, page_permissions')
            .eq('id', profile.role_id)
            .single()

          console.log('Role data:', roleData)
          console.log('Role error:', roleError)

          if (roleError) {
            console.warn('Error fetching role:', roleError.message)
            // When there's an error, just give dashboard access
            setPagePermissions(['dashboard'])
          } else if (roleData?.page_permissions && Array.isArray(roleData.page_permissions) && roleData.page_permissions.length > 0) {
            console.log(`Loaded page_permissions for ${roleData.name}:`, roleData.page_permissions)
            setPagePermissions(roleData.page_permissions as string[])
          } else {
            // No permissions set in database - respect empty array (empty = no access except dashboard)
            console.warn(`Role ${roleData?.name} has no page_permissions set. User will only have dashboard access.`)
            setPagePermissions(['dashboard'])
          }
        } else {
          // User has no role assigned
          console.warn('User has no role_id')
          setPagePermissions(['dashboard']) // Default limited access
        }
      } catch (error) {
        console.error('Error fetching permissions:', error)
        // Fallback: limited access on error
        setPagePermissions(['dashboard'])
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [])

  const hasPermission = (permission: string) => permissions.includes(permission)
  const hasRole = (roleId: string) => role === roleId
  
  // Check if user can access a page based on page_permissions
  const canAccessPage = (page: string): boolean => {
    if (pagePermissions.includes('*')) return true // Admin has access to all
    if (pagePermissions.includes(page)) return true
    
    // Check parent paths (e.g., 'definicoes' allows 'definicoes/utilizadores')
    return pagePermissions.some(perm => page.startsWith(perm + '/'))
  }

  const value: PermissionsContextType = {
    permissions,
    pagePermissions,
    role,
    loading,
    isAdmin: role === ADMIN_ROLE_ID,
    isDesigner: role === DESIGNER_ROLE_ID,
    hasPermission,
    hasRole,
    canAccessPage,
  }

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}


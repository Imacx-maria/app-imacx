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
          console.error('❌ [PERMISSIONS PROVIDER] Profile fetch error:', profileError)
          console.error('❌ [PERMISSIONS PROVIDER] Error details:', JSON.stringify(profileError, null, 2))
          console.error('❌ [PERMISSIONS PROVIDER] User ID:', session.user.id)
          console.error('❌ [PERMISSIONS PROVIDER] This is likely an RLS policy issue')
          // If we can't get profile, give dashboard access only
          setPagePermissions(['dashboard'])
          setLoading(false)
          return
        }

        if (profile?.role_id) {
          setRole(profile.role_id)

          // Fetch role with page_permissions AND role name for fallback
          const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('id, name, page_permissions')
            .eq('id', profile.role_id)
            .single()

          if (roleError) {
            console.error('❌ [PERMISSIONS PROVIDER] Role fetch error:', roleError)
            console.error('❌ [PERMISSIONS PROVIDER] Role ID:', profile.role_id)
            console.error('❌ [PERMISSIONS PROVIDER] Error details:', JSON.stringify(roleError, null, 2))
            // When there's an error, just give dashboard access
            setPagePermissions(['dashboard'])
          } else if (roleData?.page_permissions && Array.isArray(roleData.page_permissions) && roleData.page_permissions.length > 0) {
            // Normalize permissions to lowercase for case-insensitive matching
            const normalizedPermissions = roleData.page_permissions.map((p: string) => p.toLowerCase())
            setPagePermissions(normalizedPermissions)
          } else {
            // No permissions set in database - respect empty array (empty = no access except dashboard)
            console.error('❌ [PERMISSIONS PROVIDER] Role has no page_permissions')
            console.error('❌ [PERMISSIONS PROVIDER] Role name:', roleData?.name)
            console.error('❌ [PERMISSIONS PROVIDER] Role data:', JSON.stringify(roleData, null, 2))
            setPagePermissions(['dashboard'])
          }
        } else {
          // User has no role assigned - give dashboard access only
          console.error('❌ [PERMISSIONS PROVIDER] User has no role_id')
          console.error('❌ [PERMISSIONS PROVIDER] Profile data:', JSON.stringify(profile, null, 2))
          setPagePermissions(['dashboard'])
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
    // Normalize for case-insensitive comparison
    const normalizedPage = page.toLowerCase()

    if (pagePermissions.includes('*')) return true // Admin has access to all

    const directMatch = pagePermissions.includes(normalizedPage)
    const parentMatch = pagePermissions.some(perm => normalizedPage.startsWith(perm + '/'))

    return directMatch || parentMatch
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


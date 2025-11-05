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
    const supabase = createBrowserClient()
    let isMounted = true
    let retryTimeout: NodeJS.Timeout | null = null
    let activeController: AbortController | null = null

    const MAX_RETRIES = 5
    const RETRY_DELAY_MS = 800

    const clearRetry = () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout)
        retryTimeout = null
      }
    }

    const cancelActiveRequest = () => {
      if (activeController) {
        activeController.abort()
        activeController = null
      }
    }

    const fallbackToDashboard = () => {
      cancelActiveRequest()
      clearRetry()
      if (!isMounted) return
      setPermissions([])
      setPagePermissions(['dashboard'])
      setRole(null)
      setLoading(false)
    }

    const scheduleRetry = (nextAttempt: number, reason?: string) => {
      if (!isMounted) return
      clearRetry()
      retryTimeout = setTimeout(() => {
        fetchPermissions(nextAttempt).catch((error) => {
          console.error('[PermissionsProvider] Retry attempt failed', error)
        })
      }, RETRY_DELAY_MS)
      if (reason) {
        console.warn(
          '[PermissionsProvider] Scheduling retry due to:',
          reason,
          'attempt',
          nextAttempt,
        )
      }
    }

    const fetchPermissions = async (attempt = 0): Promise<void> => {
      console.log('[PermissionsProvider] Fetch attempt', attempt)

      try {
        if (!isMounted) {
          console.log('[PermissionsProvider] Unmounted before fetch started')
          return
        }

        if (attempt === 0) {
          setLoading(true)
        }

        cancelActiveRequest()
        const controller = new AbortController()
        activeController = controller

        const response = await fetch('/api/permissions/me', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!isMounted || controller.signal.aborted) {
          console.log(
            '[PermissionsProvider] Ignoring response - unmounted or aborted',
          )
          return
        }

        if (response.status === 401) {
          console.log('[PermissionsProvider] No session from API response')
          fallbackToDashboard()
          return
        }

        if (!response.ok) {
          throw new Error(
            `Permissions API responded with status ${response.status}`,
          )
        }

        const payload = (await response.json()) as {
          roleId: string | null
          permissions: string[]
          shouldRetry?: boolean
          reason?: string
        }

        const normalizedPermissions = Array.isArray(payload.permissions)
          ? payload.permissions.map((p) => p.toLowerCase())
          : []

        if (
          (payload.shouldRetry ||
            !payload.roleId ||
            normalizedPermissions.length === 0) &&
          attempt < MAX_RETRIES
        ) {
          scheduleRetry(attempt + 1, payload.reason)
          return
        }

        if (!payload.roleId || normalizedPermissions.length === 0) {
          console.warn(
            '[PermissionsProvider] Permissions unavailable after retries, falling back to dashboard',
            payload.reason,
          )
          fallbackToDashboard()
          return
        }

        clearRetry()
        activeController = null
        setRole(payload.roleId)
        setPermissions(normalizedPermissions)
        setPagePermissions(normalizedPermissions)
        setLoading(false)
        console.log(
          '[PermissionsProvider] Permissions loaded',
          normalizedPermissions,
        )
      } catch (error) {
        if (!isMounted) {
          console.log('[PermissionsProvider] Error after unmount ignored')
          return
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('[PermissionsProvider] Fetch aborted')
          return
        }

        console.error('[PermissionsProvider] Exception in fetchPermissions', error)

        if (attempt < MAX_RETRIES) {
          scheduleRetry(attempt + 1)
        } else {
          fallbackToDashboard()
        }
      }
    }

    fetchPermissions().catch((error) => {
      console.error('[PermissionsProvider] Initial fetch failed', error)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      console.log('[PermissionsProvider] Auth state changed', event)

      if (event === 'INITIAL_SESSION') {
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        clearRetry()
        await fetchPermissions().catch((error) => {
          console.error('[PermissionsProvider] Fetch after auth change failed', error)
        })
      } else if (event === 'SIGNED_OUT') {
        clearRetry()
        cancelActiveRequest()
        if (!isMounted) return
        setPermissions([])
        setPagePermissions([])
        setRole(null)
        setLoading(false)
      }
    })

    return () => {
      console.log('[PermissionsProvider] Cleaning up')
      isMounted = false
      clearRetry()
      cancelActiveRequest()
      subscription.unsubscribe()
    }
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

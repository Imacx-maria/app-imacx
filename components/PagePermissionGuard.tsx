'use client'

import { useEffect, memo } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/providers/PermissionsProvider'
import { Loader2 } from 'lucide-react'

interface PagePermissionGuardProps {
  pageId: string
  children: React.ReactNode
  fallbackPath?: string
}

/**
 * PagePermissionGuard - Client-side protection for pages
 * Checks if user has permission to access a page, redirects if not
 *
 * Usage:
 * ```tsx
 * <PagePermissionGuard pageId="definicoes/utilizadores">
 *   <YourPageContent />
 * </PagePermissionGuard>
 * ```
 */
const PagePermissionGuardInternal = ({
  pageId,
  children,
  fallbackPath = '/dashboard',
}: PagePermissionGuardProps) => {
  const { canAccessPage, loading } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    // Wait for permissions to load
    if (loading) return

    // Check if user has access
    const hasAccess = canAccessPage(pageId)

    if (!hasAccess) {
      console.warn(`[PagePermissionGuard] Access denied to page: ${pageId}`)
      router.replace(fallbackPath)
    }
  }, [loading, canAccessPage, pageId, router, fallbackPath])

  // Show loading state while checking permissions
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">A verificar permissões...</p>
        </div>
      </div>
    )
  }

  // Check permission
  const hasAccess = canAccessPage(pageId)

  // Don't render children if no access (will redirect via useEffect)
  if (!hasAccess) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">A redirecionar...</p>
        </div>
      </div>
    )
  }

  // Render page content if user has access
  return <>{children}</>
}

export const PagePermissionGuard = memo(PagePermissionGuardInternal)

'use client'

import { ReactNode } from 'react'
import { usePermissions } from '@/providers/PermissionsProvider'

interface PermissionGuardProps {
  children: ReactNode
  requiredPermission?: string
  requiredRole?: string
  fallback?: ReactNode
}

export default function PermissionGuard({ 
  children, 
  requiredPermission, 
  requiredRole,
  fallback
}: PermissionGuardProps) {
  const { hasPermission, hasRole, loading } = usePermissions()

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // If no requirements specified, allow access
  if (!requiredPermission && !requiredRole) {
    return <>{children}</>
  }

  // Check permissions
  if (requiredPermission && !hasPermission(requiredPermission)) {
    if (fallback) return <>{fallback}</>
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="mt-2 text-muted-foreground">
          You don&apos;t have permission to access this resource.
        </p>
      </div>
    )
  }

  // Check roles
  if (requiredRole && !hasRole(requiredRole)) {
    if (fallback) return <>{fallback}</>
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="mt-2 text-muted-foreground">
          You don&apos;t have the required role to access this resource.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

'use client'

import { ReactNode } from 'react'
import { usePermissions } from '@/providers/PermissionsProvider'
import { type PermissionId, type RoleId } from '@/types/permissions'

interface PermissionGuardProps {
  children: ReactNode
  requiredPermission?: PermissionId
  requiredPermissionsAll?: PermissionId[]
  requiredRole?: RoleId
  requiredAnyRole?: RoleId[]
  fallback?: ReactNode
}

export default function PermissionGuard({
  children,
  requiredPermission,
  requiredPermissionsAll,
  requiredRole,
  requiredAnyRole,
  fallback,
}: PermissionGuardProps) {
  const {
    hasPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    loading,
  } = usePermissions()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (
    !requiredPermission &&
    !requiredPermissionsAll &&
    !requiredRole &&
    !requiredAnyRole
  ) {
    return <>{children}</>
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <>{fallback ?? <DefaultDenied />}</>
  }

  if (
    requiredPermissionsAll &&
    !hasAllPermissions(requiredPermissionsAll)
  ) {
    return <>{fallback ?? <DefaultDenied />}</>
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <>{fallback ?? <DefaultDenied />}</>
  }

  if (requiredAnyRole && !hasAnyRole(requiredAnyRole)) {
    return <>{fallback ?? <DefaultDenied />}</>
  }

  return <>{children}</>
}

function DefaultDenied() {
  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
      <p className="mt-2 text-muted-foreground">
        You don&apos;t have permission to access this resource.
      </p>
    </div>
  )
}

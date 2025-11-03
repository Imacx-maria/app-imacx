import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/utils/supabase'

/**
 * Maps a URL path to its corresponding pageId for permission checking
 */
function getPageIdFromPath(path: string): string {
  const cleanPath = path.replace(/^\//, '').split('?')[0]
  if (!cleanPath) return ''
  return cleanPath
}

/**
 * Checks if a user's permissions allow access to a specific path
 */
function canAccessPath(path: string, userPermissions: string[]): boolean {
  // Admin wildcard grants access to everything
  if (userPermissions.includes('*')) return true

  // Normalize for case-insensitive comparison
  const pageId = getPageIdFromPath(path).toLowerCase()
  const normalizedPerms = userPermissions.map(p => p.toLowerCase())

  // Empty path (root) or public paths require no permissions
  if (!pageId) return true

  // Dashboard is always accessible
  if (pageId === 'dashboard') return true

  // Direct match
  if (normalizedPerms.includes(pageId)) return true

  // Check parent paths (e.g., 'definicoes' allows 'definicoes/utilizadores')
  return normalizedPerms.some(perm => pageId.startsWith(perm + '/'))
}

export async function middleware(request: NextRequest) {
  try {
    const { supabase, response } = await createMiddlewareClient(request)

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    const url = request.nextUrl.clone()
    const pathname = url.pathname

    const publicRoutes = ['/login', '/reset-password', '/update-password']
    const isPublicRoute = publicRoutes.includes(pathname)

    const protectedRoutes = [
      '/dashboard',
      '/producao',
      '/gestao',
      '/definicoes',
      '/designer-flow',
      '/stocks',
    ]
    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route),
    )

    if (error) {
      console.error('[Middleware] Session error:', error)
      if (isProtectedRoute) {
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    }

    if (!session) {
      if (isProtectedRoute) {
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    } else {
      if (pathname === '/login') {
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }

      // Check page permissions for protected routes (skip dashboard)
      if (isProtectedRoute && pathname !== '/dashboard') {
        // Fetch user permissions from cache header or database
        let userPermissions: string[] = []

        // Try to get from cache header first
        const cachedPermissions = request.headers.get('x-user-permissions')
        const cacheTimestamp = request.headers.get('x-permissions-timestamp')
        const now = Date.now()
        const cacheValid = cacheTimestamp && (now - parseInt(cacheTimestamp)) < 5 * 60 * 1000 // 5 minutes

        if (cachedPermissions && cacheValid) {
          userPermissions = JSON.parse(cachedPermissions)
        } else {
          // Fetch from database
          const { data: profile } = await supabase
            .from('profiles')
            .select('role_id')
            .eq('user_id', session.user.id)
            .single()

          if (profile?.role_id) {
            const { data: roleData } = await supabase
              .from('roles')
              .select('page_permissions')
              .eq('id', profile.role_id)
              .single()

            if (roleData?.page_permissions && Array.isArray(roleData.page_permissions)) {
              userPermissions = roleData.page_permissions as string[]
            } else {
              // No permissions set = only dashboard access
              userPermissions = ['dashboard']
            }
          } else {
            // No role = only dashboard access
            userPermissions = ['dashboard']
          }

          // Cache permissions in response header
          response.headers.set('x-user-permissions', JSON.stringify(userPermissions))
          response.headers.set('x-permissions-timestamp', now.toString())
        }

        // Check if user has access to this path
        const hasAccess = canAccessPath(pathname, userPermissions)

        if (!hasAccess) {
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }
      }
    }

    return response
  } catch (e) {
    console.error('[Middleware] Exception:', e)
    const url = request.nextUrl.clone()
    const pathname = url.pathname
    const protectedRoutes = [
      '/dashboard',
      '/producao',
      '/gestao',
      '/definicoes',
      '/designer-flow',
    ]
    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route),
    )

    if (isProtectedRoute) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    return NextResponse.next({
      request: { headers: request.headers },
    })
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}


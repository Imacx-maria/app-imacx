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

    // SECURITY: Use getUser() instead of getSession() for server-side validation
    // getSession() reads from cookies without server verification (insecure)
    // getUser() validates the session with Supabase Auth server (secure)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

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
      console.error('[Middleware] Auth error:', error.message)
      if (isProtectedRoute) {
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    }

    if (!user) {
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
        // SECURITY NOTE: Removed header-based permission caching
        // Always fetch fresh permissions to prevent cache poisoning
        // TODO: Consider server-side Redis cache with proper invalidation
        
        let userPermissions: string[] = []

        // Fetch from database (always fresh)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role_id')
          .eq('user_id', user.id)
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


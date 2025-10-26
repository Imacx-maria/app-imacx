import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/utils/supabase'

export async function middleware(request: NextRequest) {
  try {
    const { supabase, response } = await createMiddlewareClient(request)

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    const url = request.nextUrl.clone()
    const pathname = url.pathname

    console.log(`[Middleware] Path: ${pathname}, Session: ${session ? 'YES' : 'NO'}, Error: ${error ? error.message : 'NONE'}`)

    const publicRoutes = ['/login', '/reset-password', '/update-password']
    const isPublicRoute = publicRoutes.includes(pathname)

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

    if (error) {
      console.error('[Middleware] Session error:', error)
      if (isProtectedRoute) {
        console.log('[Middleware] Redirecting to login (protected route, session error)')
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    }

    if (!session) {
      console.log(`[Middleware] No session, isProtectedRoute: ${isProtectedRoute}`)
      if (isProtectedRoute) {
        console.log('[Middleware] Redirecting to login (no session)')
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    } else {
      console.log('[Middleware] Session found')
      if (pathname === '/login') {
        console.log('[Middleware] Redirecting to dashboard (on login page with session)')
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
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
      console.log('[Middleware] Exception - redirecting to login')
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


import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/utils/supabase'

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
  matcher: [
    '/dashboard/:path*',
    '/producao/:path*',
    '/gestao/:path*',
    '/definicoes/:path*',
    '/designer-flow/:path*',
    '/stocks/:path*',
  ],
}


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
      console.error('Session error in middleware:', error)
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
    }

    return response
  } catch (e) {
    console.error('Middleware error:', e)
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


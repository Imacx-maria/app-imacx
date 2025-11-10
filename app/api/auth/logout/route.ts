import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/utils/supabase'

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = await createServerClient(cookieStore)

    // Sign out - this will trigger cookie removal via the createServerClient cookie handlers
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[API /auth/logout] Sign out error:', error)
    }

    // Manually clear all Supabase auth cookies as extra safety
    const allCookies = await cookieStore
    const cookieArray = await allCookies.getAll()
    
    for (const cookie of cookieArray) {
      if (cookie.name.includes('supabase') || cookie.name.includes('sb-')) {
        await cookieStore.delete(cookie.name)
      }
    }

    const response = NextResponse.json(
      { message: 'logged-out' },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )

    // Ensure all Supabase cookies are expired in response
    for (const cookie of cookieArray) {
      if (cookie.name.includes('supabase') || cookie.name.includes('sb-')) {
        response.cookies.set(cookie.name, '', {
          maxAge: 0,
          expires: new Date(0),
          path: '/',
          sameSite: 'lax',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
        })
      }
    }

    return response
  } catch (error) {
    console.error('[API /auth/logout] Unexpected exception:', error)
    return NextResponse.json(
      { message: 'unexpected-error' },
      { status: 500 }
    )
  }
}

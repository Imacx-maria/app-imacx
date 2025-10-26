import {
  createBrowserClient as browserClient,
  createServerClient as serverClient,
  type CookieOptions,
} from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

// SECURITY: Define expected project to prevent credential mixing
const EXPECTED_PROJECT_ID = 'bnfixjkjrbfalgcqhzof'
const EXPECTED_PROJECT_URL = `https://${EXPECTED_PROJECT_ID}.supabase.co`

export const createBrowserClient = () => {
  // SECURITY: Force correct project URL
  const supabaseUrl = EXPECTED_PROJECT_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env.local file.')
  }

  // SECURITY: Verify JWT matches expected project
  try {
    const payload = JSON.parse(atob(supabaseAnonKey.split('.')[1]))
    if (payload.ref !== EXPECTED_PROJECT_ID) {
      console.error('🚨 SECURITY ALERT: Supabase project mismatch!')
      console.error('Expected project:', EXPECTED_PROJECT_ID)
      console.error('JWT contains:', payload.ref)
      throw new Error(`SECURITY: Supabase key is for wrong project! Expected ${EXPECTED_PROJECT_ID} but got ${payload.ref}`)
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('SECURITY')) throw e
    console.warn('Could not verify JWT:', e)
  }

  console.log('✅ Supabase client verified for project:', EXPECTED_PROJECT_ID)

  return browserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })
}

export const createServerClient = async (
  cookieStore: ReturnType<typeof cookies>,
) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase URL and anonymous key are required. Please check your .env file.',
    )
  }

  const cookieStoreAsync =
    cookieStore instanceof Promise ? await cookieStore : cookieStore

  return serverClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async get(name: string) {
        const cookie = await cookieStoreAsync.get(name)
        return cookie?.value
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          await cookieStoreAsync.set({ name, value, ...options })
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      async remove(name: string, options: CookieOptions) {
        try {
          await cookieStoreAsync.set({ name, value: '', ...options })
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

export const createMiddlewareClient = async (request: NextRequest) => {
  const { NextResponse } = await import('next/server')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase URL and anonymous key are required. Please check your .env file.',
    )
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = serverClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options })
        response = NextResponse.next({
          request: { headers: request.headers },
        })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options })
        response = NextResponse.next({
          request: { headers: request.headers },
        })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  return { supabase, response }
}


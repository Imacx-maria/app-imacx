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

/**
 * Decode base64url-encoded string (JWT standard)
 * JWTs use base64url: - instead of +, _ instead of /, no padding
 */
function decodeBase64Url(segment: string): string {
  // Convert base64url to standard base64
  let base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  
  // Add padding if needed (JWT segments omit = padding)
  const pad = base64.length % 4
  if (pad) {
    base64 += '='.repeat(4 - pad)
  }
  
  // Decode based on environment
  if (typeof window !== 'undefined') {
    return atob(base64)
  }
  return Buffer.from(base64, 'base64').toString('utf-8')
}

export const createBrowserClient = () => {
  // SECURITY: Force correct project URL
  const supabaseUrl = EXPECTED_PROJECT_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env.local file.')
  }

  // SECURITY: Verify JWT matches expected project
  try {
    const payload = JSON.parse(decodeBase64Url(supabaseAnonKey.split('.')[1]))
    if (payload.ref !== EXPECTED_PROJECT_ID) {
      console.error('🚨 SECURITY ALERT: Supabase project mismatch!')
      console.error('Expected project:', EXPECTED_PROJECT_ID)
      console.error('JWT contains:', payload.ref)
      
      // Clear localStorage to prevent cross-project contamination
      if (typeof window !== 'undefined') {
        try {
          for (const key of Object.keys(window.localStorage)) {
            if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
              window.localStorage.removeItem(key)
            }
          }
        } catch (e) {
          // Ignore localStorage access errors
        }
      }
      
      throw new Error(`SECURITY: Supabase key is for wrong project! Expected ${EXPECTED_PROJECT_ID} but got ${payload.ref}`)
    }
    
    console.log('✅ Supabase client verified for project:', EXPECTED_PROJECT_ID)
  } catch (e) {
    if (e instanceof Error && e.message.includes('SECURITY')) throw e
    console.warn('Could not verify JWT:', e)
  }

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
  // SECURITY: Force correct project URL
  const supabaseUrl = EXPECTED_PROJECT_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env file.',
    )
  }

  // SECURITY: Verify JWT matches expected project
  try {
    const payload = JSON.parse(decodeBase64Url(supabaseAnonKey.split('.')[1]))
    if (payload.ref !== EXPECTED_PROJECT_ID) {
      console.error('🚨 SECURITY ALERT: Supabase project mismatch (server)!')
      console.error('Expected project:', EXPECTED_PROJECT_ID)
      console.error('JWT contains:', payload.ref)
      throw new Error(`SECURITY: Supabase key is for wrong project! Expected ${EXPECTED_PROJECT_ID} but got ${payload.ref}`)
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('SECURITY')) throw e
    console.warn('Could not verify JWT (server):', e)
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

  // SECURITY: Force correct project URL
  const supabaseUrl = EXPECTED_PROJECT_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env file.',
    )
  }

  // SECURITY: Verify JWT matches expected project
  try {
    const payload = JSON.parse(decodeBase64Url(supabaseAnonKey.split('.')[1]))
    if (payload.ref !== EXPECTED_PROJECT_ID) {
      console.error('🚨 SECURITY ALERT: Supabase project mismatch (middleware)!')
      console.error('Expected project:', EXPECTED_PROJECT_ID)
      console.error('JWT contains:', payload.ref)
      throw new Error(`SECURITY: Supabase key is for wrong project! Expected ${EXPECTED_PROJECT_ID} but got ${payload.ref}`)
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('SECURITY')) throw e
    console.warn('Could not verify JWT (middleware):', e)
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


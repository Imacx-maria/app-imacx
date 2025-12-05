import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: { message: 'Supabase config missing' } },
      { status: 500 },
    )
  }

  let payload: { email?: string; password?: string }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { error: { message: 'Invalid JSON payload' } },
      { status: 400 },
    )
  }

  const { email, password } = payload

  if (!email || !password) {
    return NextResponse.json(
      { error: { message: 'Email and password are required' } },
      { status: 400 },
    )
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // server side; we will return the session to the client
      autoRefreshToken: false,
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          status: error.status ?? 400,
          code: error.code,
        },
      },
      { status: error.status ?? 400 },
    )
  }

  return NextResponse.json({
    user: data.user,
    session: data.session,
  })
}

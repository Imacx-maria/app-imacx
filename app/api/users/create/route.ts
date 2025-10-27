import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Verify the requesting user is authenticated
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get request body
    const body = await request.json()
    const { email, password, first_name, last_name, role_id, phone, notes } = body

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !role_id) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, first_name, last_name, role_id' },
        { status: 400 }
      )
    }

    // Create admin client
    const adminClient = createAdminClient()

    // Create user in Supabase Auth (without email confirmation)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        first_name,
        last_name,
      },
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create user profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        email,
        first_name,
        last_name,
        role_id,
        phone: phone || null,
        notes: notes || null,
        active: true,
      })

    if (profileError) {
      console.error('Profile error:', profileError)
      // If profile creation fails, we should delete the auth user
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

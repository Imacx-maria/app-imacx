import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'

/**
 * POST /api/users/repair-profile
 *
 * Creates a missing profile for an auth user
 * Used when a user exists in auth.users but not in profiles table
 *
 * Body: {
 *   auth_user_id: string (UUID)
 *   email: string
 *   first_name: string
 *   last_name: string
 *   role_id: string (UUID)
 *   departamento_id?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the requesting user is authenticated
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { auth_user_id, email, first_name, last_name, role_id, departamento_id } = body

    // Validate required fields
    if (!auth_user_id || !email || !first_name || !last_name || !role_id) {
      return NextResponse.json(
        { error: 'Missing required fields: auth_user_id, email, first_name, last_name, role_id' },
        { status: 400 }
      )
    }

    // Create admin client for privileged operations
    const adminClient = createAdminClient()

    // Verify auth user exists
    const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(
      auth_user_id
    )

    if (authError || !authUser) {
      return NextResponse.json(
        { error: `Auth user not found: ${authError?.message}` },
        { status: 404 }
      )
    }

    // Check if profile already exists
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, user_id')
      .eq('user_id', auth_user_id)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        {
          error: 'Profile already exists for this user',
          profile_id: existingProfile.id,
        },
        { status: 409 }
      )
    }

    // Verify role exists
    const { data: role, error: roleError } = await adminClient
      .from('roles')
      .select('id, name')
      .eq('id', role_id)
      .single()

    if (roleError || !role) {
      return NextResponse.json(
        { error: `Role not found: ${roleError?.message}` },
        { status: 404 }
      )
    }

    // Create the profile
    const { data: newProfile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        user_id: auth_user_id,
        email: email.toLowerCase().trim(),
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        role_id: role_id,
        departamento_id: departamento_id || null,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (profileError) {
      console.error('Error creating profile:', profileError)
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Profile created successfully',
      profile: newProfile,
      role: role.name,
    })
  } catch (error: any) {
    console.error('Repair profile error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

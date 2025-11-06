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
    const { email, password, first_name, last_name, role_id, phone, notes, departamento_id, siglas } = body

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !role_id) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, first_name, last_name, role_id' },
        { status: 400 }
      )
    }

    // Create admin client
    const adminClient = createAdminClient()

    // Check if user already exists with this email
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email, user_id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: `Já existe um utilizador com o email ${email}` },
        { status: 409 }
      )
    }

    // Create user in Supabase Auth (without email confirmation)
    console.log('🔐 [CREATE USER] Creating auth user for:', email)
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
      console.error('❌ [CREATE USER] Auth error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      console.error('❌ [CREATE USER] No user returned from auth')
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    console.log('✅ [CREATE USER] Auth user created:', authData.user.id)

    // Create profile explicitly (don't rely on trigger)
    // This is more robust and ensures profile exists immediately
    console.log('📝 [CREATE USER] Creating profile for user_id:', authData.user.id)
    const { data: profile, error: profileCreateError } = await adminClient
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        email: email.toLowerCase().trim(),
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        role_id: role_id,
        phone: phone || null,
        notes: notes || null,
        departamento_id: departamento_id || null,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (profileCreateError || !profile) {
      console.error('❌ [CREATE USER] Profile create error:', profileCreateError)
      // Clean up auth user since profile creation failed
      console.log('🧹 [CREATE USER] Cleaning up auth user:', authData.user.id)
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        {
          error: `Failed to create profile: ${profileCreateError?.message || 'Unknown error'}`,
          details: profileCreateError,
        },
        { status: 500 }
      )
    }

    console.log('✅ [CREATE USER] Profile created:', profile.id)

    // Insert siglas if provided
    if (siglas && Array.isArray(siglas) && siglas.length > 0) {
      const siglasData = siglas.map((sigla: string) => ({
        profile_id: profile.id,
        sigla: sigla.toUpperCase()
      }))

      const { error: siglasError } = await adminClient
        .from('user_siglas')
        .insert(siglasData)

      if (siglasError) {
        console.error('Siglas insert error:', siglasError)
        // Don't fail the whole operation, just log the error
      }
    }

    console.log('✅ [CREATE USER] User creation complete:', {
      auth_user_id: authData.user.id,
      profile_id: profile.id,
      email: authData.user.email,
    })

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

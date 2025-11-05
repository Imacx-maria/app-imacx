import { NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { cookies } from 'next/headers'

const ADMIN_ROLE_ID = '7c53a7a2-ab07-4ba3-8c1a-7e8e215cadf0'

export async function GET(request: Request) {
  try {
    console.log('📋 [API /users/list] Request received')

    // Verify the requesting user is an admin
    const cookieStore = cookies()
    const supabase = await createServerClient(cookieStore)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      console.error('❌ [API /users/list] No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔐 [API /users/list] Session found for:', session.user.email)

    // Use admin client to check user role (bypass RLS)
    const adminClient = createAdminClient()

    // Check if user is admin using admin client
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role_id')
      .eq('user_id', session.user.id)
      .single()

    if (profileError) {
      console.error('❌ [API /users/list] Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'User not allowed - Could not verify user role' },
        { status: 403 }
      )
    }

    console.log('👤 [API /users/list] User role_id:', profile?.role_id)
    console.log('🔑 [API /users/list] Expected admin role_id:', ADMIN_ROLE_ID)

    if (!profile || profile.role_id !== ADMIN_ROLE_ID) {
      console.error('❌ [API /users/list] User is not admin:', {
        userId: session.user.id,
        roleId: profile?.role_id,
        expected: ADMIN_ROLE_ID,
      })
      return NextResponse.json(
        { error: 'User not allowed - Admin access required' },
        { status: 403 }
      )
    }

    console.log('✅ [API /users/list] Admin verified, fetching users...')

    // Fetch all auth users using admin client
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers()

    if (authError) {
      console.error('❌ [API /users/list] Error fetching auth users:', authError)
      throw authError
    }

    console.log('✅ [API /users/list] Fetched auth users:', authData.users.length)

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('*')

    if (profilesError) {
      console.error('❌ [API /users/list] Error fetching profiles:', profilesError)
      throw profilesError
    }

    console.log('✅ [API /users/list] Fetched profiles:', profiles?.length || 0)

    // Match auth users with profiles and fetch siglas
    const combinedUsers = await Promise.all(
      authData.users.map(async (authUser) => {
        const profile = profiles?.find((p) => p.user_id === authUser.id)

        if (profile) {
          // Fetch siglas for this profile
          const { data: siglasData } = await adminClient
            .from('user_siglas')
            .select('sigla')
            .eq('profile_id', profile.id)

          return {
            ...profile,
            siglas: siglasData?.map((s) => s.sigla) || [],
            auth_user_id: authUser.id,
            email: authUser.email,
            has_profile: true,
          }
        } else {
          // User missing profile
          return {
            id: null,
            user_id: authUser.id,
            auth_user_id: authUser.id,
            email: authUser.email,
            first_name: authUser.user_metadata?.first_name || authUser.email?.split('@')[0] || '',
            last_name: authUser.user_metadata?.last_name || '',
            phone: null,
            notes: null,
            role_id: null,
            departamento_id: null,
            active: null,
            created_at: authUser.created_at,
            updated_at: null,
            siglas: [],
            has_profile: false,
          }
        }
      })
    )

    console.log('✅ [API /users/list] Combined users prepared:', combinedUsers.length)

    return NextResponse.json({
      users: combinedUsers,
      count: combinedUsers.length,
    })
  } catch (error: any) {
    console.error('💥 [API /users/list] Exception:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

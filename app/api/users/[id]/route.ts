import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'

// Update user (profile and optionally auth)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: userId } = await params
    const body = await request.json()
    const { email, password, first_name, last_name, role_id, phone, notes, active, departamento_id, siglas } = body

    // Create admin client
    const adminClient = createAdminClient()

    // Update password if provided
    if (password) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(
        userId,
        { password }
      )

      if (authError) {
        console.error('Auth update error:', authError)
        return NextResponse.json(
          { error: `Failed to update password: ${authError.message}` },
          { status: 400 }
        )
      }
    }

    // Get profile_id for siglas update
    const { data: profileData } = await adminClient
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!profileData) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Update profile
    const updateProfile: any = {
      updated_at: new Date().toISOString(),
    }

    if (email !== undefined) updateProfile.email = email
    if (first_name !== undefined) updateProfile.first_name = first_name
    if (last_name !== undefined) updateProfile.last_name = last_name
    if (role_id !== undefined) updateProfile.role_id = role_id
    if (phone !== undefined) updateProfile.phone = phone
    if (notes !== undefined) updateProfile.notes = notes
    if (active !== undefined) updateProfile.active = active
    if (departamento_id !== undefined) updateProfile.departamento_id = departamento_id

    const { error: profileError } = await adminClient
      .from('profiles')
      .update(updateProfile)
      .eq('user_id', userId)

    if (profileError) {
      console.error('Profile update error:', profileError)
      return NextResponse.json(
        { error: `Failed to update profile: ${profileError.message}` },
        { status: 500 }
      )
    }

    // Update siglas if provided
    if (siglas !== undefined && Array.isArray(siglas)) {
      // Delete existing siglas
      await adminClient
        .from('user_siglas')
        .delete()
        .eq('profile_id', profileData.id)

      // Insert new siglas
      if (siglas.length > 0) {
        const siglasData = siglas.map((sigla: string) => ({
          profile_id: profileData.id,
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
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete user (both auth and profile)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: userId } = await params

    // Prevent self-deletion
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Create admin client
    const adminClient = createAdminClient()

    // Delete profile first (will cascade due to FK)
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('user_id', userId)

    if (profileError) {
      console.error('Profile delete error:', profileError)
      return NextResponse.json(
        { error: `Failed to delete profile: ${profileError.message}` },
        { status: 500 }
      )
    }

    // Delete auth user
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Auth delete error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

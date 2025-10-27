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
    const { email, password, first_name, last_name, role_id, phone, notes, active } = body

    // Create admin client
    const adminClient = createAdminClient()

    // Update auth user if email or password changed
    if (email || password) {
      const updateData: any = {}
      if (email) updateData.email = email
      if (password) updateData.password = password

      const { error: authError } = await adminClient.auth.admin.updateUserById(
        userId,
        updateData
      )

      if (authError) {
        console.error('Auth update error:', authError)
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        )
      }
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

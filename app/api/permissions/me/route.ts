import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'

type PermissionsResponse = {
  roleId: string | null
  permissions: string[]
  shouldRetry?: boolean
  reason?: string
}

const json = (body: PermissionsResponse, init?: ResponseInit) =>
  NextResponse.json(body, init)

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = await createServerClient(cookieStore)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      console.error(
        '[API /permissions/me] Failed to read session:',
        sessionError,
      )
      return json(
        {
          roleId: null,
          permissions: ['dashboard'],
          reason: 'session-error',
        },
        { status: 500 },
      )
    }

    if (!session) {
      return json(
        {
          roleId: null,
          permissions: ['dashboard'],
          reason: 'no-session',
        },
        { status: 401 },
      )
    }

    const adminClient = createAdminClient()

    const {
      data: profile,
      error: profileError,
    } = await adminClient
      .from('profiles')
      .select('role_id')
      .eq('user_id', session.user.id)
      .single()

    if (profileError) {
      console.warn(
        '[API /permissions/me] Profile lookup failed:',
        profileError,
      )
      return json({
        roleId: null,
        permissions: ['dashboard'],
        shouldRetry: true,
        reason: 'missing-profile',
      })
    }

    const roleId = profile?.role_id ?? null

    if (!roleId) {
      console.warn(
        '[API /permissions/me] Profile found but role_id missing for user',
        session.user.id,
      )
      return json({
        roleId: null,
        permissions: ['dashboard'],
        shouldRetry: true,
        reason: 'missing-role',
      })
    }

    const {
      data: roleData,
      error: roleError,
    } = await adminClient
      .from('roles')
      .select('page_permissions')
      .eq('id', roleId)
      .single()

    if (roleError) {
      console.warn(
        '[API /permissions/me] Role lookup failed:',
        roleError,
      )
      return json({
        roleId,
        permissions: ['dashboard'],
        shouldRetry: true,
        reason: 'missing-role-permissions',
      })
    }

    const pagePermissions = Array.isArray(roleData?.page_permissions)
      ? (roleData.page_permissions as string[])
      : []

    if (pagePermissions.length === 0) {
      console.warn(
        '[API /permissions/me] Role has no page permissions configured',
        roleId,
      )
      return json({
        roleId,
        permissions: ['dashboard'],
        shouldRetry: true,
        reason: 'empty-permissions',
      })
    }

    return json({
      roleId,
      permissions: pagePermissions,
    })
  } catch (error) {
    console.error('[API /permissions/me] Unexpected exception:', error)
    return json(
      {
        roleId: null,
        permissions: ['dashboard'],
        reason: 'unexpected-error',
      },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'

type PermissionsResponse = {
  roles?: string[]
  pagePermissions?: string[]
  actionPermissions?: string[]
  roleId?: string | null
  permissions?: string[]
  shouldRetry?: boolean
  reason?: string
}

const json = (body: PermissionsResponse, init?: ResponseInit) =>
  NextResponse.json(body, init)

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = await createServerClient(cookieStore)

    // SECURITY: Use getUser() instead of getSession() for server-side validation
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error(
        '[API /permissions/me] Auth error:',
        authError.message,
      )
      return NextResponse.json({ message: 'auth-error' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ message: 'no-session' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const {
      data: profile,
      error: profileError,
    } = await adminClient
      .from('profiles')
      .select('role_id')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.warn('[API /permissions/me] Profile lookup failed:', profileError)
      return NextResponse.json({ message: 'missing-profile' }, { status: 403 })
    }

    const roleId = profile?.role_id ?? null

    if (!roleId) {
      console.warn(
        '[API /permissions/me] Profile found but role_id missing for user',
        user.id,
      )
      return json({
        roles: [],
        pagePermissions: ['page:dashboard'],
        actionPermissions: [],
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
      console.warn('[API /permissions/me] Role lookup failed:', roleError)
      return json({
        roles: [roleId],
        pagePermissions: ['page:dashboard'],
        actionPermissions: [],
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
        roles: [roleId],
        pagePermissions: ['page:dashboard'],
        actionPermissions: [],
        reason: 'empty-permissions',
      })
    }

    return json({
      roles: [roleId],
      pagePermissions: pagePermissions.map((p) => `page:${p}`),
      actionPermissions: [],
    })
  } catch (error) {
    console.error('[API /permissions/me] Unexpected exception:', error)
    return NextResponse.json({ message: 'unexpected-error' }, { status: 500 })
  }
}

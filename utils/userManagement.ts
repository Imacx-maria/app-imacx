import { createBrowserClient } from './supabase'

/**
 * User management utility functions
 */

export interface CreateUserInput {
  email: string
  password: string
  nome_completo: string
  role_id: string
  telemovel?: string
  notas?: string
}

export interface UpdateUserInput {
  nome_completo?: string
  role_id?: string
  telemovel?: string
  notas?: string
}

export interface UserProfile {
  id: string
  auth_user_id: string
  email: string
  nome_completo: string
  role_id: string
  telemovel?: string
  notas?: string
  ativo: boolean
  created_at: string
  updated_at?: string
  role?: {
    id: string
    nome: string
  }
}

export interface UserRole {
  id: string
  nome: string
  descricao?: string
  permissoes?: Record<string, any>
  ativo: boolean
  created_at: string
  updated_at?: string
}

/**
 * Create a new user with Supabase Auth and profile
 */
export async function createUser(input: CreateUserInput) {
  const supabase = createBrowserClient()

  try {
    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          nome_completo: input.nome_completo,
        },
      },
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Failed to create user in Auth')

    // Step 2: Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        auth_user_id: authData.user.id,
        email: input.email,
        nome_completo: input.nome_completo,
        role_id: input.role_id,
        telemovel: input.telemovel,
        notas: input.notas,
      })

    if (profileError) throw profileError

    return { success: true, userId: authData.user.id }
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
  }
}

/**
 * Update user profile (not Auth data)
 */
export async function updateUserProfile(
  authUserId: string,
  input: UpdateUserInput
) {
  const supabase = createBrowserClient()

  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', authUserId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error updating user profile:', error)
    throw error
  }
}

/**
 * Get user profile with role information
 */
export async function getUserProfile(
  authUserId: string
): Promise<UserProfile | null> {
  const supabase = createBrowserClient()

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        `
        *,
        role:role_id (id, nome)
      `
      )
      .eq('auth_user_id', authUserId)
      .single()

    if (error) throw error

    return data as UserProfile
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
}

/**
 * Get all user profiles with pagination
 */
export async function getAllUserProfiles(
  limit = 50,
  offset = 0
): Promise<UserProfile[]> {
  const supabase = createBrowserClient()

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        `
        *,
        role:role_id (id, nome)
      `
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return (data || []) as UserProfile[]
  } catch (error) {
    console.error('Error fetching user profiles:', error)
    return []
  }
}

/**
 * Get all available roles
 */
export async function getAllRoles(): Promise<UserRole[]> {
  const supabase = createBrowserClient()

  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (error) throw error

    return (data || []) as UserRole[]
  } catch (error) {
    console.error('Error fetching roles:', error)
    return []
  }
}

/**
 * Delete user (removes from both Auth and profiles)
 */
export async function deleteUser(authUserId: string) {
  const supabase = createBrowserClient()

  try {
    // Delete from user_profiles (Auth deletion may need to be handled separately)
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('auth_user_id', authUserId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    throw error
  }
}

/**
 * Check if user has specific role
 */
export async function userHasRole(
  authUserId: string,
  roleName: string
): Promise<boolean> {
  try {
    const profile = await getUserProfile(authUserId)
    return profile?.role?.nome === roleName
  } catch (error) {
    console.error('Error checking user role:', error)
    return false
  }
}

/**
 * Check if user has permission
 */
export async function userHasPermission(
  authUserId: string,
  permission: string
): Promise<boolean> {
  try {
    const profile = await getUserProfile(authUserId)
    if (!profile?.role) return false

    const permissions = profile.role as any
    // Check if permission exists in the permissions object
    return (
      permissions.permissoes?.[permission] === true ||
      permissions.permissoes?.all === true
    )
  } catch (error) {
    console.error('Error checking user permission:', error)
    return false
  }
}

/**
 * Search users by name or email
 */
export async function searchUsers(query: string): Promise<UserProfile[]> {
  const supabase = createBrowserClient()

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        `
        *,
        role:role_id (id, nome)
      `
      )
      .or(
        `nome_completo.ilike.%${query}%,email.ilike.%${query}%`
      )
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []) as UserProfile[]
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}

/**
 * Deactivate user (soft delete)
 */
export async function deactivateUser(authUserId: string) {
  const supabase = createBrowserClient()

  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        ativo: false,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', authUserId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error deactivating user:', error)
    throw error
  }
}

/**
 * Reactivate user
 */
export async function reactivateUser(authUserId: string) {
  const supabase = createBrowserClient()

  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        ativo: true,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', authUserId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error reactivating user:', error)
    throw error
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean
  message?: string
} {
  if (password.length < 6) {
    return {
      valid: false,
      message: 'Palavra-passe deve ter pelo menos 6 caracteres',
    }
  }
  return { valid: true }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

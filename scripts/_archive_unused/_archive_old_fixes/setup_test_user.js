const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function setupTestUser() {
  try {
    console.log('🔧 Configurando utilizador de teste...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL ou Service Role Key não encontrados em .env.local')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Test credentials
    const testEmail = 'test@imacx.pt'
    const testPassword = 'Test123!@#'

    // Try to get existing user first
    console.log(`📧 Procurando utilizador ${testEmail}...`)
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === testEmail)

    if (existingUser) {
      console.log(`✅ Utilizador já existe com ID: ${existingUser.id}\n`)

      // Update password
      console.log('🔄 Atualizando palavra-passe...')
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password: testPassword,
          email_confirm: true,
        },
      )

      if (updateError) {
        throw updateError
      }

      console.log('✅ Palavra-passe atualizada com sucesso\n')
      console.log('📝 Credenciais de teste:')
      console.log(`   Email: ${testEmail}`)
      console.log(`   Palavra-passe: ${testPassword}`)
      return
    }

    // Create new user
    console.log(`✅ Criando novo utilizador ${testEmail}...\n`)

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    })

    if (createError) {
      throw createError
    }

    console.log(`✅ Utilizador criado com sucesso`)
    console.log(`   ID: ${newUser.user.id}`)
    console.log(`   Email: ${newUser.user.email}\n`)

    // Create profile for test user using profiles table
    console.log('📋 Criando profile...')

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: newUser.user.id,
      first_name: 'Utilizador',
      last_name: 'Teste',
      email: testEmail,
      active: true,
    })

    if (profileError && !profileError.message.includes('already exists')) {
      throw profileError
    }

    console.log('✅ Profile criado com sucesso\n')

    console.log('✅ Configuração completa!')
    console.log('\n📝 Credenciais de teste:')
    console.log(`   Email: ${testEmail}`)
    console.log(`   Palavra-passe: ${testPassword}`)
    console.log('\nPode agora fazer login com estas credenciais.')

  } catch (error) {
    console.error('❌ Erro:', error.message)
    if (error.details) {
      console.error('Detalhes:', error.details)
    }
  }
}

setupTestUser()

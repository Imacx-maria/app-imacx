const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function setUserPassword() {
  try {
    console.log('🔐 Definindo palavra-passe para utilizador...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL ou Service Role Key não encontrados em .env.local')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Try to update test@imacx.pt
    const testEmail = 'test@imacx.pt'
    const testPassword = 'Test123!@#'

    console.log(`📧 Procurando utilizador ${testEmail}...`)
    const { data: users } = await supabase.auth.admin.listUsers()
    const testUser = users?.users?.find((u) => u.email === testEmail)

    if (!testUser) {
      throw new Error(`Utilizador ${testEmail} não encontrado`)
    }

    console.log(`✅ Utilizador encontrado: ${testUser.id}\n`)

    console.log('🔄 Definindo palavra-passe...')
    const { error } = await supabase.auth.admin.updateUserById(testUser.id, {
      password: testPassword,
      email_confirm: true,
    })

    if (error) {
      throw error
    }

    console.log('✅ Palavra-passe definida com sucesso!\n')

    console.log('📝 Credenciais de teste:')
    console.log(`   Email: ${testEmail}`)
    console.log(`   Palavra-passe: ${testPassword}`)
    console.log('\n💡 Pode agora fazer login com estas credenciais.')

  } catch (error) {
    console.error('❌ Erro:', error.message)
    if (error.details) {
      console.error('Detalhes:', error.details)
    }
  }
}

setUserPassword()

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function setMariaPassword() {
  try {
    console.log('🔐 Definindo palavra-passe para Maria Martins...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL ou Service Role Key não encontrados em .env.local')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const email = 'maria.martins@imacx.pt'
    const newPassword = process.env.MARIA_PASSWORD || 'password_123456789'

    console.log(`📧 Procurando utilizador ${email}...`)
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError

    const mariaUser = users?.users?.find((u) => u.email === email)
    if (!mariaUser) {
      throw new Error(`Utilizador ${email} não encontrado na Auth`)
    }

    console.log(`✅ Utilizador encontrado: ${mariaUser.id}`)
    console.log('🔄 Atualizando palavra-passe...')

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      mariaUser.id,
      {
        password: newPassword,
        email_confirm: true,
      },
    )

    if (updateError) throw updateError

    console.log('✅ Palavra-passe atualizada com sucesso!\n')
    console.log('📝 Novas credenciais:')
    console.log(`   Email: ${email}`)
    console.log(`   Palavra-passe: ${newPassword}`)
    console.log('\n💡 Pode agora fazer login com estas credenciais.')
  } catch (error) {
    console.error('❌ Erro:', error.message)
    if (error.details) {
      console.error('Detalhes:', error.details)
    }
  }
}

setMariaPassword()
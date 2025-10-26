const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkAuthUsers() {
  try {
    console.log('🔍 A verificar utilizadores de autenticação...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL ou Service Role Key não encontrados em .env.local')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get all auth users
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
      throw error
    }

    console.log(`✅ Total de utilizadores: ${data.users.length}\n`)

    if (data.users.length === 0) {
      console.log('⚠️  Nenhum utilizador encontrado no Supabase Auth!')
      return
    }

    console.log('Utilizadores registados:')
    console.log('─'.repeat(80))

    data.users.forEach((user) => {
      console.log(`Email: ${user.email}`)
      console.log(`ID: ${user.id}`)
      console.log(`Criado: ${new Date(user.created_at).toLocaleString('pt-PT')}`)
      console.log(`Confirmado: ${user.email_confirmed_at ? 'Sim' : 'Não'}`)
      console.log('─'.repeat(80))
    })

    // Check if any have passwords set
    const usersWithPassword = data.users.filter((u) => u.user_metadata?.password_set)
    console.log(`\n✅ Utilizadores com palavra-passe definida: ${usersWithPassword.length}`)

  } catch (error) {
    console.error('❌ Erro ao verificar utilizadores:', error.message)
    if (error.code) {
      console.error('Código de erro:', error.code)
    }
  }
}

checkAuthUsers()

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function restoreAuth() {
  try {
    console.log('🔍 Analisando situação de autenticação...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: users } = await supabase.auth.admin.listUsers()

    console.log('📊 Situação Atual:\n')

    const authUsers = users?.users || []
    const withPassword = authUsers.filter((u) => u.user_metadata?.password_set).length
    const withoutAuth = authUsers.filter((u) => !u.identities || u.identities.length === 0).length

    console.log(`Total de utilizadores: ${authUsers.length}`)
    console.log(`Com palavra-passe: ${withPassword}`)
    console.log(`Sem métodos de autenticação: ${withoutAuth}`)

    console.log('\n📧 Utilizadores sem autenticação (necessitam setup):')
    authUsers
      .filter((u) => !u.identities || u.identities.length === 0)
      .forEach((u) => {
        console.log(`  - ${u.email}`)
      })

    console.log('\n💡 Opções para restaurar acesso:')
    console.log('\n1️⃣  Se você tem os dados originais de autenticação:')
    console.log('   - Restaure o .env.local com o projeto Supabase original')
    console.log('   - Verifique se esse projeto tem os utilizadores com passwords')

    console.log('\n2️⃣  Se quer usar este projeto:')
    console.log('   - Configure métodos de autenticação (OAuth, email links, passwords)')
    console.log('   - Execute scripts de setup para cada utilizador')

    console.log('\n3️⃣  Quick setup com passwords:')
    console.log('   - Run: node scripts/setup_password_for_all_users.js')
    console.log('   - Isto vai definir passwords temporárias para todos os utilizadores')

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

restoreAuth()

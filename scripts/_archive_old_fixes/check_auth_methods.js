const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkAuthMethods() {
  try {
    console.log('🔍 Verificando métodos de autenticação...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: users } = await supabase.auth.admin.listUsers()

    console.log(`Total de utilizadores: ${users?.users?.length}\n`)

    users?.users?.forEach((user) => {
      console.log(`📧 ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Criado: ${new Date(user.created_at).toLocaleString('pt-PT')}`)
      console.log(`   Email confirmado: ${user.email_confirmed_at ? 'Sim' : 'Não'}`)
      
      // Check for password
      console.log(`   Métodos de autenticação:`)
      if (user.user_metadata?.password_set) {
        console.log(`      - ✅ Palavra-passe (Password)`)
      }
      
      // Check identities
      if (user.identities && user.identities.length > 0) {
        user.identities.forEach((identity) => {
          console.log(`      - ✅ ${identity.provider} (${identity.identity_data?.email || 'sem email'})`)
        })
      } else {
        console.log(`      - ⚠️  Sem identidades configuradas`)
      }
      
      console.log('')
    })

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

checkAuthMethods()

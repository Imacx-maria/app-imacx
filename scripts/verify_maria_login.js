const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function verifyMaria() {
  try {
    console.log('🔍 Verificando login de Maria Martins...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const supabase = createClient(supabaseUrl, anonKey)

    const email = 'maria.martins@imacx.pt'
    const password = process.env.MARIA_PASSWORD || 'Maria123!@#'

    console.log(`📧 Email: ${email}`)
    console.log(`🔐 Palavra-passe: ${password}\n`)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.log(`❌ ERRO: ${error.message}`)
      return
    }

    console.log(`✅ LOGIN BEM-SUCEDIDO!\n`)
    console.log(`📊 Informações da sessão:`)
    console.log(`   User ID: ${data.user?.id}`)
    console.log(`   Email: ${data.user?.email}`)
    console.log(`   Email confirmado: ${data.user?.email_confirmed_at ? 'Sim' : 'Não'}`)
    if (data.session) {
      console.log(`   Token: ${data.session.access_token.substring(0, 20)}...`)
      console.log(`   Expira: ${new Date(data.session.expires_at * 1000).toLocaleString('pt-PT')}`)
    }

    console.log(`\n💡 Maria pode agora fazer login na aplicação!`)

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message)
  }
}

verifyMaria()

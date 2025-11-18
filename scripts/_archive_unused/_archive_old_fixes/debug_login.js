const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function debugLogin() {
  try {
    console.log('🔐 Testando fluxo de login detalhado...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      throw new Error('Supabase URL ou Anon Key não encontrados')
    }

    console.log('📋 Configuração:')
    console.log(`   URL: ${supabaseUrl}`)
    console.log(`   Anon Key: ${anonKey.substring(0, 20)}...`)

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })

    const email = 'test@imacx.pt'
    const password = 'Test123!@#'

    console.log(`\n🔍 Tentando fazer login com ${email}...`)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log('\n📊 Resposta da autenticação:')
    if (error) {
      console.log('❌ ERRO:')
      console.log(`   Mensagem: ${error.message}`)
      console.log(`   Status: ${error.status}`)
      console.log(`   Código: ${error.code}`)
      if (error.details) {
        console.log(`   Detalhes: ${JSON.stringify(error.details)}`)
      }
    } else {
      console.log('✅ SUCESSO:')
      console.log(`   User ID: ${data.user?.id}`)
      console.log(`   Email: ${data.user?.email}`)
      console.log(`   Email confirmado: ${data.user?.email_confirmed_at ? 'Sim' : 'Não'}`)
      if (data.session) {
        console.log(`   Session Token: ${data.session.access_token.substring(0, 20)}...`)
        console.log(`   Token Expira em: ${new Date(data.session.expires_at * 1000).toLocaleString('pt-PT')}`)
      }
    }

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message)
    console.error(error)
  }
}

debugLogin()

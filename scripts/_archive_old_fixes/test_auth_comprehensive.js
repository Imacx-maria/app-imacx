const { createClient } = require('@supabase/supabase-js')
const { createClient: createSsrClient } = require('@supabase/ssr')
require('dotenv').config({ path: '.env.local' })

async function testAuth() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const email = 'test@imacx.pt'
    const password = 'Test123!@#'

    console.log('🧪 Teste Abrangente de Autenticação\n')
    console.log('═'.repeat(60))

    // Test 1: Verify credentials are set
    console.log('\n✅ Test 1: Configuração')
    console.log(`   URL configurada: ${url}`)
    console.log(`   Anon Key: ${anonKey ? 'Presente' : 'FALTA!'}`)
    console.log(`   Email de teste: ${email}`)

    // Test 2: Create basic client and test login
    console.log('\n✅ Test 2: Cliente básico')
    const basicClient = createClient(url, anonKey)
    const { data: data1, error: error1 } = await basicClient.auth.signInWithPassword({
      email,
      password,
    })

    if (error1) {
      console.log(`   ❌ ERRO: ${error1.message}`)
      return
    }

    console.log(`   ✅ Login bem-sucedido`)
    console.log(`   User ID: ${data1.user?.id}`)
    console.log(`   Session válida: ${!!data1.session}`)

    // Test 3: Try with SSR client config (como a app usa)
    console.log('\n✅ Test 3: Cliente SSR (como a app usa)')
    const ssrClient = createSsrClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })

    const { data: data2, error: error2 } = await ssrClient.auth.signInWithPassword({
      email,
      password,
    })

    if (error2) {
      console.log(`   ❌ ERRO: ${error2.message}`)
      return
    }

    console.log(`   ✅ Login bem-sucedido`)
    console.log(`   User ID: ${data2.user?.id}`)
    console.log(`   Session válida: ${!!data2.session}`)

    // Test 4: Check user metadata
    console.log('\n✅ Test 4: Dados do utilizador')
    const { data: userData, error: userError } = await basicClient.auth.admin.listUsers()
    const testUser = userData?.users?.find((u) => u.email === email)

    if (!testUser) {
      console.log('   ❌ Utilizador não encontrado na lista')
      return
    }

    console.log(`   User encontrado:`)
    console.log(`     - ID: ${testUser.id}`)
    console.log(`     - Email: ${testUser.email}`)
    console.log(`     - Email confirmado: ${testUser.email_confirmed_at ? 'Sim' : 'Não'}`)
    console.log(`     - Tem password: ${testUser.user_metadata?.password_set ? 'Sim' : 'Desconhecido'}`)
    console.log(`     - Last sign in: ${testUser.last_sign_in_at || 'Nunca'}`)

    console.log('\n' + '═'.repeat(60))
    console.log('✅ TUDO OK - Credenciais estão corretas!\n')

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message)
  }
}

testAuth()

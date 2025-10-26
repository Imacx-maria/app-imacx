const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkAccess() {
  try {
    console.log('🔍 Testando acesso à tabela profiles...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const testEmail = 'test@imacx.pt'
    const testPassword = 'Test123!@#'

    // Create client with anon key (like the browser would)
    const supabase = createClient(supabaseUrl, anonKey)

    console.log('1️⃣  Tentando ler profiles sem autenticação...')
    let { data: dataNoAuth, error: errorNoAuth } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (errorNoAuth) {
      console.log(`   ❌ Erro: ${errorNoAuth.message}`)
    } else {
      console.log(`   ✅ Conseguido ler ${dataNoAuth.length} profiles`)
    }

    // Try to login
    console.log(`\n2️⃣  Tentando fazer login com ${testEmail}...`)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })

    if (authError) {
      console.log(`   ❌ Erro: ${authError.message}`)
      return
    }

    if (!authData.session) {
      console.log('   ❌ Sem sessão após login')
      return
    }

    console.log(`   ✅ Login bem-sucedido!`)
    console.log(`   ID do utilizador: ${authData.user.id}`)
    console.log(`   Email: ${authData.user.email}`)

    // Try to read profiles with auth
    console.log(`\n3️⃣  Tentando ler profiles com autenticação...`)
    const { data: dataWithAuth, error: errorWithAuth } = await supabase
      .from('profiles')
      .select('*')

    if (errorWithAuth) {
      console.log(`   ❌ Erro: ${errorWithAuth.message}`)
    } else {
      console.log(`   ✅ Conseguido ler ${dataWithAuth.length} profiles`)
      if (dataWithAuth.length > 0) {
        console.log(`   Primeiro profile:`)
        const p = dataWithAuth[0]
        console.log(`     - Nome: ${p.first_name} ${p.last_name}`)
        console.log(`     - Email: ${p.email}`)
        console.log(`     - user_id: ${p.user_id}`)
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

checkAccess()

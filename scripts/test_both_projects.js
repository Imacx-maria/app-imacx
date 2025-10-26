const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testBothProjects() {
  const email = 'test@imacx.pt'
  const password = 'Test123!@#'

  // Get from env
  const urlFromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL
  const keyFromEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('🔍 Testando Supabase URL e credenciais\n')
  console.log('URL do .env: ' + urlFromEnv)
  console.log('Key do .env: ' + (keyFromEnv ? keyFromEnv.substring(0, 20) + '...' : 'MISSING') + '\n')

  // Test with env values
  console.log('1️⃣  Testando com valores do .env...')
  try {
    const client = createClient(urlFromEnv, keyFromEnv)
    const { data, error } = await client.auth.signInWithPassword({ email, password })

    if (error) {
      console.log(`   ❌ ERRO: ${error.message}`)
    } else {
      console.log(`   ✅ LOGIN SUCESSO`)
      console.log(`      User: ${data.user?.email}`)
      console.log(`      ID: ${data.user?.id}`)
    }
  } catch (e) {
    console.log(`   ❌ Exception: ${e.message}`)
  }

  // Test with hardcoded value from .env.local file
  console.log('\n2️⃣  Testando com URL hardcoded do arquivo...')
  try {
    const client = createClient('https://bnfixjkjrbfalgcqhzof.supabase.co', keyFromEnv)
    const { data, error } = await client.auth.signInWithPassword({ email, password })

    if (error) {
      console.log(`   ❌ ERRO: ${error.message}`)
    } else {
      console.log(`   ✅ LOGIN SUCESSO`)
      console.log(`      User: ${data.user?.email}`)
      console.log(`      ID: ${data.user?.id}`)
    }
  } catch (e) {
    console.log(`   ❌ Exception: ${e.message}`)
  }

  // List users from the env project
  console.log('\n3️⃣  Procurando utilizador test@imacx.pt em ambos...')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.log('   ⚠️  SERVICE_ROLE_KEY não encontrada')
    return
  }

  // Check project 1
  try {
    const client1 = createClient(urlFromEnv, serviceKey)
    const { data: users1 } = await client1.auth.admin.listUsers()
    const found1 = users1?.users?.find((u) => u.email === email)
    console.log(`   Project 1 (${urlFromEnv.substring(8, 20)}...): ${found1 ? '✅ Encontrado' : '❌ Não encontrado'}`)
  } catch (e) {
    console.log(`   Project 1: Erro - ${e.message}`)
  }

  // Check project 2  
  try {
    const client2 = createClient('https://ocajcjdlrmbmfiirxndn.supabase.co', keyFromEnv)
    const { data: users2 } = await client2.auth.admin.listUsers()
    const found2 = users2?.users?.find((u) => u.email === email)
    console.log(`   Project 2 (ocajcjdlrmbmfiirxndn...): ${found2 ? '✅ Encontrado' : '❌ Não encontrado'}`)
  } catch (e) {
    console.log(`   Project 2: Erro - ${e.message}`)
  }
}

testBothProjects()

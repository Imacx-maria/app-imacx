const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey)

  // Create a unique test email
  const stamp = Date.now()
  const email = `debug.user.${stamp}@imacx.pt`
  const password = 'Temp123!@#'
  const first_name = 'DEBUG'
  const last_name = `USER_${stamp}`

  console.log('👤 Criando utilizador de teste via Admin API...')
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name, last_name },
  })

  if (createError) {
    console.error('❌ Erro ao criar utilizador:', createError.message)
    process.exit(1)
  }
  const userId = created.user.id
  console.log('✅ Utilizador criado:', userId, email)

  console.log('⏳ Aguardando trigger criar perfil...')
  let profile = null
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200))
    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (data) { profile = data; break }
    if (error && error.code !== 'PGRST116') {
      console.warn('⚠️ Erro ao verificar perfil:', error.message)
    }
  }

  if (!profile) {
    console.error('❌ Perfil não foi criado pelo trigger')
    console.log('🧹 Limpando utilizador de teste...')
    await admin.auth.admin.deleteUser(userId)
    process.exit(1)
  }
  console.log('✅ Perfil criado pelo trigger:', profile)

  console.log('🛠️ Atualizando perfil com dados adicionais...')
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      email,
      first_name,
      last_name,
      active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error('❌ Erro ao atualizar perfil:', updateError.message)
    await admin.auth.admin.deleteUser(userId)
    process.exit(1)
  }

  console.log('🎉 Teste concluído com sucesso.')
  console.log('🔑 Credenciais do utilizador de teste:')
  console.log(`   Email: ${email}`)
  console.log(`   Password: ${password}`)
  console.log('\n💡 Pode usar estas credenciais para verificar na UI.')
}

run()
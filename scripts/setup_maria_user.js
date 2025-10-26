const { createClient } = require('@supabase/supabase-js')
const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function setupMaria() {
  let pgClient = null
  let supabaseClient = null

  try {
    console.log('🔧 Configurando utilizador Maria Martins...\n')

    const mariaEmail = 'maria.martins@imacx.pt'
    const mariaPassword = 'Maria123!@#' // You should change this
    const mariaUserId = 'e813594a-8712-4343-83a7-42582718fced'

    // Connect to Supabase
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    // Connect to PostgreSQL
    pgClient = new Client({
      host: process.env.PG_HOST,
      port: process.env.PG_PORT,
      database: process.env.PG_DB,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    })
    await pgClient.connect()

    console.log(`📧 Procurando utilizador ${mariaEmail} em Supabase Auth...`)

    // Check if Maria already exists in Auth
    const { data: users } = await supabaseClient.auth.admin.listUsers()
    let mariaAuth = users?.users?.find((u) => u.email === mariaEmail)

    if (mariaAuth) {
      console.log(`✅ Utilizador já existe na Auth`)
      console.log(`   ID: ${mariaAuth.id}`)
    } else {
      // Create auth user for Maria using her existing user_id as reference
      console.log(`📝 Criando utilizador na Auth...`)

      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: mariaEmail,
        password: mariaPassword,
        email_confirm: true,
      })

      if (createError) {
        throw createError
      }

      mariaAuth = newUser.user
      console.log(`✅ Utilizador criado com sucesso`)
      console.log(`   ID: ${mariaAuth.id}`)
    }

    // Update profile with email
    console.log(`\n📋 Atualizando profile no PostgreSQL...`)
    const updateResult = await pgClient.query(
      'UPDATE profiles SET email = $1, updated_at = NOW() WHERE user_id = $2 RETURNING id, first_name, last_name, email',
      [mariaEmail, mariaUserId],
    )

    if (updateResult.rows.length > 0) {
      const profile = updateResult.rows[0]
      console.log(`✅ Profile atualizado:`)
      console.log(`   Nome: ${profile.first_name} ${profile.last_name}`)
      console.log(`   Email: ${profile.email}`)
    } else {
      console.log(`❌ Profile não encontrado`)
    }

    // Set password if needed
    if (mariaAuth.id !== mariaUserId) {
      console.log(`\n🔐 Nota: O ID do utilizador na Auth é diferente do profile.`)
      console.log(`   Auth ID: ${mariaAuth.id}`)
      console.log(`   Profile user_id: ${mariaUserId}`)
      console.log(`   Isto pode causar problemas de autenticação.`)
    }

    console.log(`\n✅ Configuração completa!`)
    console.log(`\n📝 Credenciais de Maria Martins:`)
    console.log(`   Email: ${mariaEmail}`)
    console.log(`   Palavra-passe: ${mariaPassword}`)
    console.log(`\n💡 Você pode agora fazer login com estas credenciais.`)

  } catch (error) {
    console.error('❌ Erro:', error.message)
    if (error.details) {
      console.error('Detalhes:', error.details)
    }
  } finally {
    if (pgClient) await pgClient.end()
  }
}

setupMaria()

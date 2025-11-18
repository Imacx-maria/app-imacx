const { createClient } = require('@supabase/supabase-js')
const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function createAuthUsers() {
  let pgClient = null
  let supabaseClient = null

  try {
    console.log('🔍 Preparando criar utilizadores de autenticação...\n')

    // Connect to PostgreSQL to get profiles
    pgClient = new Client({
      host: process.env.PG_HOST,
      port: process.env.PG_PORT,
      database: process.env.PG_DB,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    })

    await pgClient.connect()
    console.log('✅ Conectado a PostgreSQL\n')

    // Get profiles without email
    const profilesResult = await pgClient.query(`
      SELECT id, first_name, last_name, user_id FROM profiles 
      WHERE email IS NULL
      LIMIT 5
    `)

    console.log(`📊 Encontrados ${profilesResult.rows.length} profiles sem email\n`)

    if (profilesResult.rows.length === 0) {
      console.log('✅ Todos os profiles têm email definido')
      return
    }

    // Create Supabase client with service role
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    console.log('Nota: Para este demo, vamos mostrar como criar utilizadores.')
    console.log('Em produção, você precisaria de gerar emails e senhas aleatórias.\n')

    profilesResult.rows.forEach((profile) => {
      const email = `${profile.first_name.toLowerCase()}.${profile.last_name.toLowerCase()}@imacx.pt`
      console.log(`
Profile ID: ${profile.id}
Nome: ${profile.first_name} ${profile.last_name}
Email proposto: ${email}
user_id: ${profile.user_id}
      `)
    })

    console.log('\n❌ Este script é apenas para referência.')
    console.log('Para criar utilizadores com sucesso, você precisa:')
    console.log('1. Gerar emails e senhas aleatórias seguras')
    console.log('2. Usar a API de Admin do Supabase para criar Auth users')
    console.log('3. Atualizar a tabela profiles com os emails')
    console.log('4. Enviar credenciais de forma segura aos utilizadores')

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    if (pgClient) await pgClient.end()
  }
}

createAuthUsers()

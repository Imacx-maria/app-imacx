const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function checkTables() {
  const client = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  })

  try {
    console.log('🔍 Verificando tabelas no PostgreSQL...\n')
    await client.connect()

    // Check for user_roles table
    const checkUserRoles = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_roles'
      )
    `)

    // Check for user_profiles table
    const checkUserProfiles = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_profiles'
      )
    `)

    // Check for profiles table
    const checkProfiles = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'profiles'
      )
    `)

    // Check for roles table
    const checkRoles = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'roles'
      )
    `)

    console.log(`✅ user_roles: ${checkUserRoles.rows[0].exists ? 'Encontrada' : 'Não encontrada'}`)
    console.log(`✅ user_profiles: ${checkUserProfiles.rows[0].exists ? 'Encontrada' : 'Não encontrada'}`)
    console.log(`✅ profiles: ${checkProfiles.rows[0].exists ? 'Encontrada' : 'Não encontrada'}`)
    console.log(`✅ roles: ${checkRoles.rows[0].exists ? 'Encontrada' : 'Não encontrada'}`)

    // If user_roles exists, check content
    if (checkUserRoles.rows[0].exists) {
      const rolesCount = await client.query('SELECT COUNT(*) FROM user_roles')
      console.log(`\n📊 Registos em user_roles: ${rolesCount.rows[0].count}`)
    }

    // If user_profiles exists, check content
    if (checkUserProfiles.rows[0].exists) {
      const profilesCount = await client.query('SELECT COUNT(*) FROM user_profiles')
      console.log(`📊 Registos em user_profiles: ${profilesCount.rows[0].count}`)
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await client.end()
  }
}

checkTables()

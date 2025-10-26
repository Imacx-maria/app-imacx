const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function checkSchema() {
  const client = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  })

  try {
    console.log('🔍 Verificando schema original...\n')
    await client.connect()

    // Check profiles columns
    const profilesColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'profiles'
      ORDER BY ordinal_position
    `)

    console.log('📋 Colunas de profiles:')
    profilesColumns.rows.forEach((col) => {
      console.log(`   - ${col.column_name}: ${col.data_type}`)
    })

    // Check profiles count
    const profilesCount = await client.query('SELECT COUNT(*) FROM profiles')
    console.log(`\n📊 Registos em profiles: ${profilesCount.rows[0].count}`)

    if (profilesCount.rows[0].count > 0) {
      const profilesSample = await client.query('SELECT * FROM profiles LIMIT 2')
      console.log('\n📝 Exemplo de profile:')
      console.log(JSON.stringify(profilesSample.rows[0], null, 2))
    }

    // Check roles
    const rolesCount = await client.query('SELECT COUNT(*) FROM roles')
    console.log(`\n📊 Registos em roles: ${rolesCount.rows[0].count}`)

    if (rolesCount.rows[0].count > 0) {
      const rolesSample = await client.query('SELECT * FROM roles LIMIT 2')
      console.log('\n📝 Exemplo de role:')
      console.log(JSON.stringify(rolesSample.rows[0], null, 2))
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await client.end()
  }
}

checkSchema()

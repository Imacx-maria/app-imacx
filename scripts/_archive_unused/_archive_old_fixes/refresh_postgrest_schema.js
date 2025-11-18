const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function refreshSchema() {
  const client = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  })

  try {
    console.log('🔄 Refrescando schema do PostgREST...\n')
    await client.connect()

    // Check if tables exist and show info
    const tables = ['profiles', 'roles', 'role_permissions', 'user_roles', 'user_profiles']
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = '${table}'
        )
      `)
      
      if (result.rows[0].exists) {
        console.log(`✅ ${table} - Encontrada`)
        
        // Get column info
        const colResult = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = '${table}'
        `)
        
        console.log(`   Colunas: ${colResult.rows.map(r => r.column_name).join(', ')}`)
      } else {
        console.log(`❌ ${table} - Não encontrada`)
      }
    }

    // Try to force PostgREST to refresh
    console.log('\n🔧 Tentando recarregar schema do PostgREST...')
    
    // This might help PostgREST detect the tables
    await client.query('NOTIFY pgrst, "reload schema"')
    console.log('✅ Notificação enviada')

    // Also try the old command
    await client.query('SELECT pg_notify(\'postgrest\', \'reload schema\')')
    console.log('✅ Comando alternativo enviado')

    console.log('\n💡 Nota: PostgREST pode precisar de reiniciar para detectar novas tabelas.')
    console.log('   Se estiver usando Supabase Cloud, as alterações podem demorar alguns minutos.')

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await client.end()
  }
}

refreshSchema()

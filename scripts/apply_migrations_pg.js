const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

async function applyMigrations() {
  const client = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  })

  try {
    console.log('🔌 Conectando à base de dados PostgreSQL...')
    await client.connect()
    console.log('✅ Conectado com sucesso\n')

    // Get migration files
    const migrationsDir = path.join(__dirname, '../supabase/migrations')
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    console.log(`📋 Migrações encontradas: ${migrationFiles.length}\n`)

    // Execute each migration
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf-8')

      console.log(`▶️  A executar: ${file}`)

      try {
        await client.query(sql)
        console.log(`✅ Sucesso\n`)
      } catch (error) {
        console.error(`❌ Erro: ${error.message}\n`)
        // Continue with next migration
      }
    }

    console.log('✅ Todas as migrações foram processadas')

  } catch (error) {
    console.error('❌ Erro de conexão:', error.message)
  } finally {
    await client.end()
  }
}

applyMigrations()

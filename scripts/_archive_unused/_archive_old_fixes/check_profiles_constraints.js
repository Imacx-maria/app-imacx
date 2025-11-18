const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function checkConstraints() {
  const client = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  })

  try {
    console.log('🔎 Verificando constraints na tabela public.profiles...')
    await client.connect()

    const res = await client.query(`
      SELECT conname AS constraint_name,
             pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'profiles'
        AND c.conname = 'profiles_user_id_key';
    `)

    if (res.rows.length === 0) {
      console.log('❌ Constraint profiles_user_id_key NÃO encontrada')
    } else {
      console.log('✅ Constraint encontrada:')
      console.table(res.rows)
    }
  } catch (err) {
    console.error('❌ Erro ao verificar constraints:', err.message)
  } finally {
    await client.end()
  }
}

checkConstraints()
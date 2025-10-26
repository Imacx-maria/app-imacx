const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function findUser() {
  const client = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  })

  try {
    console.log('🔍 Procurando utilizador e maria.martins@imacx.pt\n')
    await client.connect()

    // Look for the user ID from the error log
    const userId = 'e813594a-8712-4343-83a7-42582718fced'
    const email = 'maria.martins@imacx.pt'

    console.log(`1️⃣  Procurando user_id: ${userId}`)
    const result1 = await client.query(
      'SELECT id, user_id, first_name, last_name, email, active FROM profiles WHERE user_id = $1',
      [userId],
    )

    if (result1.rows.length > 0) {
      const profile = result1.rows[0]
      console.log(`   ✅ Encontrado profile:`)
      console.log(`      Nome: ${profile.first_name} ${profile.last_name}`)
      console.log(`      Email: ${profile.email}`)
      console.log(`      Ativo: ${profile.active}`)
    } else {
      console.log(`   ❌ Profile não encontrado`)
    }

    console.log(`\n2️⃣  Procurando email: ${email}`)
    const result2 = await client.query(
      'SELECT id, user_id, first_name, last_name, email, active FROM profiles WHERE LOWER(email) = LOWER($1)',
      [email],
    )

    if (result2.rows.length > 0) {
      const profile = result2.rows[0]
      console.log(`   ✅ Encontrado profile:`)
      console.log(`      Nome: ${profile.first_name} ${profile.last_name}`)
      console.log(`      Email: ${profile.email}`)
      console.log(`      user_id: ${profile.user_id}`)
      console.log(`      Ativo: ${profile.active}`)
    } else {
      console.log(`   ❌ Profile não encontrado`)
    }

    console.log(`\n3️⃣  Procurando maria.martins em qualquer lugar`)
    const result3 = await client.query(
      "SELECT id, user_id, first_name, last_name, email FROM profiles WHERE email LIKE '%maria%' OR first_name = 'MARIA' OR last_name LIKE '%MARTIN%'",
    )

    if (result3.rows.length > 0) {
      console.log(`   ✅ Encontrados ${result3.rows.length} profile(s):`)
      result3.rows.forEach((p) => {
        console.log(`      - ${p.first_name} ${p.last_name} (${p.email}) [${p.user_id}]`)
      })
    } else {
      console.log(`   ❌ Nenhum profile encontrado`)
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await client.end()
  }
}

findUser()

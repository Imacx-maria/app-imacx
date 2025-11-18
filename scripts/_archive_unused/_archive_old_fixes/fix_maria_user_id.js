const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function fixMaria() {
  const client = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  })

  try {
    console.log('🔧 Corrigindo ID do utilizador Maria...\n')
    await client.connect()

    const oldUserId = 'e813594a-8712-4343-83a7-42582718fced'
    const newUserId = 'b053e186-b481-4e2a-b972-7451da9e2626'

    console.log(`Atualizando user_id na tabela profiles:`)
    console.log(`  De: ${oldUserId}`)
    console.log(`  Para: ${newUserId}\n`)

    const result = await client.query(
      'UPDATE profiles SET user_id = $1, updated_at = NOW() WHERE user_id = $2 RETURNING id, first_name, last_name, email, user_id',
      [newUserId, oldUserId],
    )

    if (result.rows.length > 0) {
      const profile = result.rows[0]
      console.log(`✅ Profile atualizado com sucesso:`)
      console.log(`   Nome: ${profile.first_name} ${profile.last_name}`)
      console.log(`   Email: ${profile.email}`)
      console.log(`   Novo user_id: ${profile.user_id}`)
    } else {
      console.log(`❌ Nenhum profile foi atualizado`)
    }

    console.log(`\n✅ Pronto! Maria pode agora fazer login com:`)
    console.log(`   Email: maria.martins@imacx.pt`)
    console.log(`   Palavra-passe: Maria123!@#`)

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await client.end()
  }
}

fixMaria()

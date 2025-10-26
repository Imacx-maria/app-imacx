const { createClient } = require('@supabase/supabase-js')
const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function setupAllPasswords() {
  let pgClient = null
  let supabaseClient = null

  try {
    console.log('🔧 Configurando passwords para todos os utilizadores...\n')

    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    pgClient = new Client({
      host: process.env.PG_HOST,
      port: process.env.PG_PORT,
      database: process.env.PG_DB,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      ssl: process.env.PG_SSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    })
    await pgClient.connect()

    const { data: users } = await supabaseClient.auth.admin.listUsers()
    const authUsers = users?.users || []

    console.log(`📋 Encontrados ${authUsers.length} utilizadores\n`)

    // Generate passwords based on email
    const credentials = []

    for (const user of authUsers) {
      // Generate a simple temporary password (users should change it)
      // Format: FirstPart@Email123 (e.g., pookster@522123 for pookster522@gmail.com)
      const emailParts = user.email.split('@')
      const tempPassword = `${emailParts[0].substring(0, 8)}@${emailParts[0].substring(8, 15).toUpperCase()}123`

      console.log(`🔐 ${user.email}`)
      console.log(`   Tentando definir password...`)

      try {
        const { error } = await supabaseClient.auth.admin.updateUserById(user.id, {
          password: tempPassword,
          email_confirm: true,
        })

        if (error) {
          console.log(`   ❌ Erro: ${error.message}`)
        } else {
          console.log(`   ✅ Password definida`)
          credentials.push({
            email: user.email,
            password: tempPassword,
          })
        }
      } catch (err) {
        console.log(`   ❌ Exception: ${err.message}`)
      }

      console.log('')
    }

    console.log('\n' + '═'.repeat(70))
    console.log('✅ CREDENCIAIS PARA LOGIN:\n')

    credentials.forEach((cred) => {
      console.log(`📧 ${cred.email}`)
      console.log(`🔐 ${cred.password}`)
      console.log('')
    })

    console.log('═'.repeat(70))
    console.log('\n⚠️  IMPORTANTE:')
    console.log('   - Estas são passwords temporárias')
    console.log('   - Os utilizadores devem mudar a password após primeiro login')
    console.log('   - Não compartilhe estas passwords por email/chat inseguro')

    console.log('\n💡 Para usar no login:')
    console.log('   1. Abra http://localhost:3003/login')
    console.log('   2. Use um dos emails acima')
    console.log('   3. Use a password correspondente')

  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    if (pgClient) await pgClient.end()
  }
}

setupAllPasswords()

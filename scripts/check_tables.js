const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkTables() {
  try {
    console.log('🔍 A verificar tabelas no Supabase...\n')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase URL ou Service Role Key não encontrados em .env.local')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Try to get info about different tables
    const tablesToCheck = [
      'profiles',
      'user_profiles',
      'roles',
      'user_roles',
      'role_permissions',
    ]

    console.log('Verificando existência de tabelas:\n')

    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1)

        if (error && error.code === 'PGRST205') {
          console.log(`❌ ${table} - Não encontrada`)
        } else if (error) {
          console.log(`⚠️  ${table} - Erro: ${error.message}`)
        } else {
          console.log(`✅ ${table} - Encontrada`)
        }
      } catch (e) {
        console.log(`❌ ${table} - Erro: ${e.message}`)
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

checkTables()

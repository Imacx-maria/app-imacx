const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkProfilesDetail() {
  try {
    console.log('🔍 A verificar detalhes dos profiles...\n')

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

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email, phone, active')
      .order('created_at', { ascending: false })

    if (profilesError) {
      throw profilesError
    }

    console.log(`✅ Total de profiles: ${profiles.length}\n`)

    console.log('Profiles registados:')
    console.log('─'.repeat(100))

    profiles.forEach((profile, i) => {
      console.log(`${i + 1}. ${profile.first_name || ''} ${profile.last_name || ''}`)
      console.log(`   Email: ${profile.email || 'Sem email'}`)
      console.log(`   Telefone: ${profile.phone || 'Sem telefone'}`)
      console.log(`   Ativo: ${profile.active ? 'Sim' : 'Não'}`)
      console.log(`   user_id: ${profile.user_id || 'Sem ID'}`)
      console.log('─'.repeat(100))
    })

    // Check how many have email
    const withEmail = profiles.filter((p) => p.email).length
    const withUserId = profiles.filter((p) => p.user_id).length

    console.log(`\n📊 Estatísticas:`)
    console.log(`   Com email: ${withEmail}/${profiles.length}`)
    console.log(`   Com user_id: ${withUserId}/${profiles.length}`)

  } catch (error) {
    console.error('❌ Erro ao verificar profiles:', error.message)
    if (error.code) {
      console.error('Código de erro:', error.code)
    }
  }
}

checkProfilesDetail()

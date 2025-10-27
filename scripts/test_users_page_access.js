const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testUsersPageAccess() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = 'maria.martins@imacx.pt'
  const password = process.env.MARIA_PASSWORD || 'password_123456789'

  if (!url || !anon) {
    console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, anon)

  console.log('🔐 Fazendo login como Maria...')
  const { data: login, error: loginError } = await supabase.auth.signInWithPassword({ email, password })
  if (loginError) {
    console.error('❌ Erro de login:', loginError.message)
    process.exit(1)
  }
  console.log('✅ Login OK. User ID:', login.user?.id)

  console.log('\n📥 Carregando perfis (como no UtilizadoresPage)...')
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, user_id, first_name, last_name, email, phone, notes, role_id, active, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (profilesError) {
    console.error('❌ Erro ao carregar perfis:', profilesError.message)
  } else {
    console.log(`✅ Perfis carregados: ${profiles?.length || 0}`)
    console.log('🧪 Primeiro registo:', profiles?.[0] || null)
  }

  console.log('\n📚 Carregando funções (roles)...')
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name')
    .order('name', { ascending: true })

  if (rolesError) {
    console.error('❌ Erro ao carregar funções:', rolesError.message)
  } else {
    console.log(`✅ Funções carregadas: ${roles?.length || 0}`)
    console.log('🧪 Função exemplo:', roles?.[0] || null)
  }

  console.log('\n🏁 Concluído.')
}

testUsersPageAccess()
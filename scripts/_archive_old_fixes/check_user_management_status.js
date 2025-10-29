#!/usr/bin/env node

const { readFileSync } = require('fs')
const { resolve } = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnv(filePath) {
  const env = {}
  const contents = readFileSync(filePath, 'utf8')

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const equalsIndex = line.indexOf('=')
    if (equalsIndex === -1) continue

    const key = line.slice(0, equalsIndex).trim()
    const value = line.slice(equalsIndex + 1).trim()
    env[key] = value
  }

  return env
}

async function run() {
  const projectRoot = resolve(__dirname, '..')
  const envPath = resolve(projectRoot, '.env.local')

  const env = loadEnv(envPath)

  const requiredKeys = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  for (const key of requiredKeys) {
    if (!env[key]) {
      throw new Error(`Variável de ambiente ausente: ${key}`)
    }
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  console.log('▶️  A verificar tabelas roles e profiles...')

  const { data: roles, error: rolesError, count: rolesCount } = await supabase
    .from('roles')
    .select('id', { count: 'exact' })

  if (rolesError) {
    console.error('❌ Erro ao obter roles:', rolesError.message)
  } else {
    console.log(`✅ roles disponíveis: ${rolesCount ?? roles.length}`)
  }

  const { data: profiles, error: profilesError, count: profilesCount } = await supabase
    .from('profiles')
    .select('id, active', { count: 'exact' })

  if (profilesError) {
    console.error('❌ Erro ao obter profiles:', profilesError.message)
  } else {
    const activeCount = profiles?.filter((profile) => profile.active ?? true).length ?? 0
    console.log(`✅ profiles registados: ${profilesCount ?? profiles.length} (ativos: ${activeCount})`)
  }

  if (!profilesError && profilesCount === 0) {
    console.log('ℹ️  Nenhum perfil encontrado. Utilize a interface para criar um novo utilizador.')
  }
}

run().catch((error) => {
  console.error('❌ Erro inesperado:')
  console.error(error)
  process.exit(1)
})

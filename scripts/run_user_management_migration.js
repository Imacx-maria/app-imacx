#!/usr/bin/env node

const { readFileSync } = require('fs')
const { resolve } = require('path')
const { Client } = require('pg')

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

  const args = process.argv.slice(2)
  const sqlFiles = (args.length > 0 ? args : ['supabase/migrations/20250102000000_create_user_management.sql']).map(
    (relativePath) => resolve(projectRoot, relativePath),
  )

  const env = loadEnv(envPath)

  const requiredKeys = ['PG_HOST', 'PG_PORT', 'PG_DB', 'PG_USER', 'PG_PASSWORD']
  for (const key of requiredKeys) {
    if (!env[key]) {
      throw new Error(`Variável de ambiente ausente: ${key}`)
    }
  }

  const client = new Client({
    host: env.PG_HOST,
    port: Number(env.PG_PORT),
    database: env.PG_DB,
    user: env.PG_USER,
    password: env.PG_PASSWORD,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  await client.connect()

  try {
    for (const sqlPath of sqlFiles) {
      const sql = readFileSync(sqlPath, 'utf8')
      console.log(`▶️  A executar migração: ${sqlPath}`)

      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('COMMIT')
        console.log('✅ Migração concluída com sucesso.')
      } catch (error) {
        await client.query('ROLLBACK')
        console.error('❌ Erro ao executar migração:')
        console.error(error.message)
        process.exitCode = 1
        throw error
      }
    }
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error('❌ Erro inesperado:')
  console.error(error)
  process.exit(1)
})

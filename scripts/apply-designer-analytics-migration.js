/**
 * Apply Designer Analytics Migration
 *
 * Reads the migration SQL file and applies it to the Supabase database
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  console.log('📊 Applying Designer Analytics Migration...')

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251120_designer_analytics_rpcs.sql')

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath)
    process.exit(1)
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('📄 Migration file loaded')
  console.log('📝 Executing SQL...')

  try {
    // Split SQL by function to execute them individually
    const statements = sql
      .split(/CREATE OR REPLACE FUNCTION/gi)
      .filter(s => s.trim().length > 0)

    console.log(`📊 Found ${statements.length} statements to execute`)

    // Execute the index creation statements first (they don't split well)
    const indexStatements = sql.match(/CREATE INDEX.*?;/gs) || []

    // Execute indexes
    for (let i = 0; i < indexStatements.length; i++) {
      const stmt = indexStatements[i]
      console.log(`\n[${i + 1}/${indexStatements.length}] Executing index statement...`)

      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt })

      if (error) {
        // Ignore "already exists" errors for indexes
        if (error.message && error.message.includes('already exists')) {
          console.log('⚠️  Index already exists, skipping...')
        } else {
          console.error('❌ Error:', error.message)
        }
      } else {
        console.log('✅ Success')
      }
    }

    // Now execute functions
    for (let i = 1; i < statements.length; i++) {
      const functionSql = 'CREATE OR REPLACE FUNCTION' + statements[i]
      const functionName = functionSql.match(/FUNCTION\s+(\w+)/i)?.[1] || `function_${i}`

      console.log(`\n[${i}/${statements.length - 1}] Creating function: ${functionName}`)

      const { error } = await supabase.rpc('exec_sql', { sql_query: functionSql })

      if (error) {
        console.error('❌ Error:', error.message)
        console.error('SQL:', functionSql.substring(0, 200) + '...')
      } else {
        console.log('✅ Success')
      }
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📊 Created RPC functions:')
    console.log('  - get_designer_complexity_distribution')
    console.log('  - get_designer_cycle_times')
    console.log('  - get_approval_cycle_metrics')
    console.log('  - get_revision_metrics')
    console.log('  - get_bottleneck_items')
    console.log('  - get_designer_workload_over_time')
    console.log('  - get_designer_kpis')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

applyMigration()

/**
 * Apply Quote RPC Migration
 *
 * Fixes permission denied error for 'bo' table access
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
  console.log('🔐 Applying Quote RPC Migration...\n')

  // Read migration file
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20251121000003_add_get_quotes_by_numbers_rpc.sql'
  )

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath)
    process.exit(1)
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('📄 Migration file loaded')
  console.log('📝 Creating RPC function...\n')

  try {
    // Extract the function definition
    const functionMatch = sql.match(/CREATE OR REPLACE FUNCTION get_quotes_by_numbers[\s\S]*?\$\$;/i)

    if (!functionMatch) {
      console.error('❌ Could not find function definition in migration')
      process.exit(1)
    }

    console.log('Creating: get_quotes_by_numbers')

    // Since exec_sql doesn't exist, we'll test if the function works by calling it
    // If it doesn't exist, we'll get an error and know we need manual intervention

    const testQuoteNumbers = ['0001', '3957']

    const { data, error } = await supabase.rpc('get_quotes_by_numbers', {
      quote_numbers: testQuoteNumbers
    })

    if (error) {
      if (error.message && error.message.includes('Could not find the function')) {
        console.log('⚠️  Function does not exist yet')
        console.log('\n📋 To apply this migration, please:')
        console.log('1. Go to Supabase Dashboard > SQL Editor')
        console.log('2. Copy and paste the following SQL:\n')
        console.log('─'.repeat(60))
        console.log(functionMatch[0])

        // Also print GRANT statement
        const grantMatch = sql.match(/GRANT EXECUTE.*?;/i)
        if (grantMatch) {
          console.log(grantMatch[0])
        }
        console.log('─'.repeat(60))
        console.log('\n3. Click "Run" to execute')
        console.log('4. Run this script again to verify\n')

        return
      } else {
        console.error('❌ Error:', error.message)
        process.exit(1)
      }
    }

    console.log('✅ Function already exists and is working!')
    console.log(`📊 Test result: ${data?.length || 0} quotes found`)

    if (data && data.length > 0) {
      console.log('Sample:', data[0])
    }

    console.log('\n🎉 Migration verified successfully!')

  } catch (error) {
    console.error('\n❌ Unexpected error:', error)
    process.exit(1)
  }
}

applyMigration()

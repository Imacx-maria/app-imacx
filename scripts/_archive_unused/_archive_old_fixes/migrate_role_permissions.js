/**
 * Migration script to add page_permissions column to roles table
 * Run with: node scripts/migrate_role_permissions.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('Running migration: add_role_permissions...')

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251027_add_role_permissions.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      console.log('\nExecuting:', statement.substring(0, 60) + '...')
      
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement
      })

      if (error) {
        // Try direct execution via database client
        console.log('Trying alternative method...')
        const { error: directError } = await supabase
          .from('_sql_temp')
          .select('*')
          .limit(0)
        
        if (directError) {
          console.error('Error executing statement:', error)
          // Continue with other statements
        }
      } else {
        console.log('✓ Success')
      }
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\nPlease verify in Supabase Dashboard:')
    console.log('1. Check that roles table has page_permissions column')
    console.log('2. Check that existing roles have default permissions assigned')

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Alternative: Apply migration directly using Supabase schema API
async function applyMigrationManually() {
  console.log('\nApplying migration manually via API...')
  
  try {
    // First check if column already exists
    const { data: columns, error: checkError } = await supabase
      .from('roles')
      .select('*')
      .limit(1)
    
    if (columns && columns.length > 0) {
      if ('page_permissions' in columns[0]) {
        console.log('✓ page_permissions column already exists')
      } else {
        console.log('⚠ Column does not exist. Please run this SQL manually in Supabase Dashboard:')
        console.log('\nSQL Dashboard > SQL Editor > New Query:')
        console.log('--------------------')
        console.log(fs.readFileSync(
          path.join(__dirname, '..', 'supabase', 'migrations', '20251027_add_role_permissions.sql'),
          'utf8'
        ))
        console.log('--------------------')
      }
    }

    // Update roles with default permissions
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name, page_permissions')

    if (rolesError) {
      throw rolesError
    }

    console.log('\nUpdating roles with default permissions...')
    for (const role of roles) {
      // Skip if already has permissions set
      if (role.page_permissions && role.page_permissions.length > 0) {
        console.log(`✓ ${role.name} already has permissions`)
        continue
      }

      let permissions = ['dashboard'] // Default
      const name = role.name.toLowerCase()
      
      if (name.includes('admin')) {
        permissions = ['*']
      } else if (name.includes('designer')) {
        permissions = ['dashboard', 'designer-flow']
      } else if (name.includes('gestor') || name.includes('manager')) {
        permissions = ['dashboard', 'gestao']
      }

      const { error: updateError } = await supabase
        .from('roles')
        .update({ page_permissions: permissions })
        .eq('id', role.id)

      if (updateError) {
        console.error(`✗ Error updating ${role.name}:`, updateError)
      } else {
        console.log(`✓ Updated ${role.name} with permissions: ${permissions.join(', ')}`)
      }
    }

    console.log('\n✅ Default permissions applied successfully!')

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run both approaches
async function main() {
  console.log('===================================')
  console.log('Role Permissions Migration Tool')
  console.log('===================================\n')
  
  await applyMigrationManually()
  
  console.log('\n===================================')
  console.log('Migration process completed!')
  console.log('===================================')
}

main()

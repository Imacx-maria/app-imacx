/**
 * Script to apply Financial Analysis RPC function migrations
 * Fixes: Monthly Revenue & Top Customers API permission errors
 *
 * Run: node scripts/apply_financial_analysis_migrations.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n📋 Financial Analysis RPC Migrations\n');
console.log('=' .repeat(70));
console.log('\n🎯 Purpose: Fix "permission denied for table ft" errors\n');
console.log('✅ Migration 1: get_monthly_revenue_breakdown()');
console.log('✅ Migration 2: get_invoices_for_period()\n');
console.log('=' .repeat(70));

console.log('\n📦 Step 1: Apply Monthly Revenue RPC Function\n');
console.log('1. Go to: https://supabase.com/dashboard/project/bnfixjkjrbfalgcqhzof/sql\n');
console.log('2. Copy and execute this SQL:\n');
console.log('-' .repeat(70));

const sql1Path = path.join(__dirname, '../supabase/migrations/_applied/20251216_create_monthly_revenue_rpc.sql');
const sql1 = fs.readFileSync(sql1Path, 'utf8');
console.log(sql1);

console.log('-' .repeat(70));
console.log('\n📦 Step 2: Apply Top Customers RPC Function\n');
console.log('3. Copy and execute this SQL:\n');
console.log('-' .repeat(70));

const sql2Path = path.join(__dirname, '../supabase/migrations/_applied/20251216_create_top_customers_rpc.sql');
const sql2 = fs.readFileSync(sql2Path, 'utf8');
console.log(sql2);

console.log('-' .repeat(70));

console.log('\n✅ Verification Commands:\n');
console.log('Test Monthly Revenue RPC:');
console.log('  node -e "...(see TEMP/docs/features/FINANCIAL_ANALYSIS_MONTHLY_REVENUE_FIX.md)"\n');

console.log('Test Top Customers RPC:');
console.log('  node -e "...(see TEMP/docs/features/FINANCIAL_ANALYSIS_MONTHLY_REVENUE_FIX.md)"\n');

console.log('📚 Full Documentation:');
console.log('   TEMP/docs/features/FINANCIAL_ANALYSIS_MONTHLY_REVENUE_FIX.md\n');

console.log('=' .repeat(70));
console.log('\n🎉 After applying both migrations, the Financial Analysis page');
console.log('   should load without permission errors!\n');

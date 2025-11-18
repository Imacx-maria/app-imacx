# Verify Migration State Before Cleanup
# Run this BEFORE executing the cleanup to verify current state

$projectRoot = "C:\Users\maria\Desktop\Imacx\IMACX_PROD\NOVO\imacx\NEW-APP\imacx-clean"
Set-Location $projectRoot

Write-Host "`n🔍 VERIFYING MIGRATION STATE`n" -ForegroundColor Cyan

# Count current migrations
$migrations = Get-ChildItem -Path "supabase\migrations\*.sql" -Exclude "*_archive*"
$migrationCount = $migrations.Count
Write-Host "Current migrations: $migrationCount" -ForegroundColor Yellow

# Check for archive directory
$archiveDir = "supabase\migrations_archive_20250118"
if (Test-Path $archiveDir) {
    $archivedCount = (Get-ChildItem $archiveDir -Filter "*.sql").Count
    Write-Host "Archive exists: $archivedCount files" -ForegroundColor Green
} else {
    Write-Host "No archive directory found (will be created)" -ForegroundColor Yellow
}

# Check git status
Write-Host "`nGit status:" -ForegroundColor Cyan
git status --short supabase/migrations/

# Check Supabase CLI
Write-Host "`nSupabase CLI:" -ForegroundColor Cyan
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI installed: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI not found. Install from: https://supabase.com/docs/guides/cli" -ForegroundColor Red
}

# Check for .env.local
Write-Host "`nEnvironment:" -ForegroundColor Cyan
if (Test-Path ".env.local") {
    Write-Host "✅ .env.local found" -ForegroundColor Green
    $envContent = Get-Content ".env.local" -Raw
    if ($envContent -match "PG_PASSWORD") {
        Write-Host "✅ PG_PASSWORD found in .env.local" -ForegroundColor Green
    } else {
        Write-Host "⚠️  PG_PASSWORD not found in .env.local" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  .env.local not found" -ForegroundColor Yellow
}

# Summary
Write-Host "`n📊 SUMMARY" -ForegroundColor Cyan
Write-Host "Migrations to archive: $migrationCount"
Write-Host "Ready for cleanup: $($migrationCount -gt 0)"

Write-Host "`n⚠️  IMPORTANT: Make sure you have:" -ForegroundColor Yellow
Write-Host "1. Backed up your Supabase database via dashboard"
Write-Host "2. Notified your team"
Write-Host "3. Have your Supabase database password ready"
Write-Host "4. Tested locally with: supabase db reset"


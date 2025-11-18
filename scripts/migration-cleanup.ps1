# Migration Cleanup Script - Wipe & Rebase Supabase Migrations
# Execute this script step-by-step, verifying each checkpoint

param(
    [string]$SupabasePassword = "",
    [switch]$SkipArchive = $false,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$projectRoot = "C:\Users\maria\Desktop\Imacx\IMACX_PROD\NOVO\imacx\NEW-APP\imacx-clean"
$projectId = "bnfixjkjrbfalgcqhzof"
$workDir = "$env:USERPROFILE\imacx-migration-cleanup-20250118"

# Colors for output
function Write-Step { param($msg) Write-Host "`n🔵 $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }

# Step 1: Preparation
Write-Step "STEP 1: Preparation & Setup"
New-Item -ItemType Directory -Path $workDir -Force | Out-Null
Set-Location $workDir
"Migration cleanup started at: $(Get-Date)" | Out-File -FilePath cleanup_log.txt
Write-Success "Working directory created: $workDir"

# Step 2: Archive Current Migrations
if (-not $SkipArchive) {
    Write-Step "STEP 2: Archiving Current Migrations"
    Set-Location $projectRoot
    
    $archiveDir = "supabase\migrations_archive_20250118"
    if (Test-Path $archiveDir) {
        Write-Warning "Archive directory already exists. Skipping archive step."
    } else {
        New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
        $migrationFiles = Get-ChildItem -Path "supabase\migrations\*.sql" -Exclude "*_archive*"
        $migrationCount = $migrationFiles.Count
        
        Write-Host "Found $migrationCount migration files to archive"
        
        if ($DryRun) {
            Write-Warning "DRY RUN: Would copy $migrationCount files to $archiveDir"
        } else {
            Copy-Item -Path "supabase\migrations\*.sql" -Destination $archiveDir -Force -Exclude "*_archive*"
            $archivedCount = (Get-ChildItem $archiveDir -Filter "*.sql").Count
            Write-Success "Archived $archivedCount migration files"
            
            # Commit archive
            git add $archiveDir
            git commit -m "🔒 Archive: Backup of all migrations before wipe & rebase - $(Get-Date -Format 'yyyyMMdd_HHmm')"
            Write-Success "Archive committed to git"
        }
    }
} else {
    Write-Warning "Skipping archive step (SkipArchive flag set)"
}

# Step 3: Export Production Schema
Write-Step "STEP 3: Export Production Schema"
Set-Location $projectRoot

if ([string]::IsNullOrEmpty($SupabasePassword)) {
    Write-Error "Supabase password is required!"
    Write-Host "Usage: .\migration-cleanup.ps1 -SupabasePassword 'your-password'"
    Write-Host "Or set it interactively:"
    $securePassword = Read-Host "Enter Supabase database password" -AsSecureString
    $SupabasePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    )
}

$dbUrl = "postgresql://postgres:$SupabasePassword@db.$projectId.supabase.co:5432/postgres"
$schemaFile = "supabase\production_schema_complete.sql"

if ($DryRun) {
    Write-Warning "DRY RUN: Would export schema to $schemaFile"
} else {
    Write-Host "Exporting production schema (this may take a few minutes)..."
    supabase db dump `
        --db-url $dbUrl `
        --schema public `
        --schema phc `
        --no-owner `
        --no-privileges `
        --if-exists `
        --clean `
        | Out-File -FilePath $schemaFile -Encoding utf8
    
    $fileSize = (Get-Item $schemaFile).Length / 1KB
    Write-Success "Schema exported: $schemaFile ($([math]::Round($fileSize, 2)) KB)"
    
    if ($fileSize -lt 100) {
        Write-Warning "File size seems small. Please verify the export."
    }
}

# Step 4: Clean Migrations & Create Baseline
Write-Step "STEP 4: Clean Migrations & Create Baseline"
Set-Location $projectRoot

if ($DryRun) {
    Write-Warning "DRY RUN: Would remove all migrations and create baseline"
} else {
    # Verify archive exists
    $archiveCount = (Get-ChildItem "supabase\migrations_archive_20250118" -Filter "*.sql" -ErrorAction SilentlyContinue).Count
    if ($archiveCount -eq 0) {
        Write-Error "Archive not found! Aborting to prevent data loss."
        exit 1
    }
    Write-Success "Verified archive exists with $archiveCount files"
    
    # Remove old migrations
    Remove-Item -Path "supabase\migrations\*.sql" -Force -Exclude "*_archive*"
    Write-Success "Removed old migration files"
    
    # Create baseline migration
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $migrationFile = "supabase\migrations\${timestamp}_baseline_complete_schema.sql"
    
    $header = @"
-- Baseline Migration: Complete Schema Snapshot
-- Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- This is a wipe & rebase from production state
-- All previous migrations have been archived to migrations_archive_20250118/

-- Safety check
DO $$ 
BEGIN 
    RAISE NOTICE 'Starting baseline migration from production snapshot...'; 
END $$;

"@
    
    $header | Out-File -FilePath $migrationFile -Encoding utf8
    Get-Content $schemaFile | Add-Content -Path $migrationFile
    "-- Baseline migration complete" | Add-Content -Path $migrationFile
    
    Write-Success "Created baseline migration: $migrationFile"
    
    # Verify single migration exists
    $migrationCount = (Get-ChildItem "supabase\migrations\*.sql").Count
    if ($migrationCount -eq 1) {
        Write-Success "Verified: Single migration file exists"
    } else {
        Write-Error "Expected 1 migration file, found $migrationCount"
        exit 1
    }
}

# Step 5: Summary
Write-Step "STEP 5: Summary"
Write-Host "`nMigration cleanup script completed!"
Write-Host "Next steps:"
Write-Host "1. Test locally: supabase db reset"
Write-Host "2. Review the baseline migration file"
Write-Host "3. Commit changes: git add supabase/migrations/"
Write-Host "4. Push to deploy: git push origin main"
Write-Host "`nLog file: $workDir\cleanup_log.txt"


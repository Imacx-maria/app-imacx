# Helper script to construct Supabase connection string
# This helps you get the connection string for the dump command

$projectRoot = "C:\Users\maria\Desktop\Imacx\IMACX_PROD\NOVO\imacx\NEW-APP\imacx-clean"
Set-Location $projectRoot

$projectId = "bnfixjkjrbfalgcqhzof"

Write-Host "`n🔗 SUPABASE CONNECTION STRING HELPER`n" -ForegroundColor Cyan

# Try to read password from .env.local
$password = ""
if (Test-Path ".env.local") {
    $envLines = Get-Content ".env.local"
    foreach ($line in $envLines) {
        if ($line -match "^PG_PASSWORD=(.+)") {
            $password = $matches[1].Trim()
            break
        }
    }
}

if ([string]::IsNullOrEmpty($password)) {
    Write-Host "Password not found in .env.local" -ForegroundColor Yellow
    Write-Host "Enter your Supabase database password:" -ForegroundColor Yellow
    $securePassword = Read-Host -AsSecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    )
} else {
    Write-Host "✅ Found password in .env.local" -ForegroundColor Green
}

# Construct connection string
$connectionString = "postgresql://postgres:$password@db.$projectId.supabase.co:5432/postgres"

Write-Host "`nConnection string:" -ForegroundColor Cyan
Write-Host $connectionString -ForegroundColor White

Write-Host "`nTo use with supabase db dump:" -ForegroundColor Cyan
Write-Host "supabase db dump --db-url `"$connectionString`" --schema public --schema phc --no-owner --no-privileges --if-exists --clean > schema.sql" -ForegroundColor White

# Clear password from memory
$password = $null
$connectionString = $null


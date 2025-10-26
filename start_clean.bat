@echo off
REM Clear any Supabase environment variables
set NEXT_PUBLIC_SUPABASE_URL=
set NEXT_PUBLIC_SUPABASE_ANON_KEY=
set SUPABASE_SERVICE_ROLE_KEY=

echo ========================================
echo Starting with CLEAN environment
echo ========================================
echo.

REM Verify env vars are cleared
echo Checking environment variables...
if defined NEXT_PUBLIC_SUPABASE_URL (
    echo WARNING: NEXT_PUBLIC_SUPABASE_URL is still set!
) else (
    echo OK: NEXT_PUBLIC_SUPABASE_URL is clear
)

echo.
echo Running verification script...
node scripts\verify_env.js

echo.
echo ========================================
echo Starting dev server...
echo ========================================
pnpm dev

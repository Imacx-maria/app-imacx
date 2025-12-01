# Cleanup remaining worktrees - handle problematic directories

Write-Host "`n=== Cleaning Remaining Worktrees ===" -ForegroundColor Cyan
Write-Host ""

$worktreeBasePath = "$env:USERPROFILE\.claude-worktrees\imacx-clean"

# Try to delete problematic directories using robocopy trick (empties directory first)
Write-Host "Step 1: Attempting to clean problematic directories..." -ForegroundColor Yellow

$problematicDirs = @("frosty-northcutt", "thirsty-babbage")

foreach ($dir in $problematicDirs) {
    $dirPath = Join-Path $worktreeBasePath $dir
    if (Test-Path $dirPath) {
        Write-Host "  Cleaning: $dir" -ForegroundColor Gray
        try {
            # Use robocopy trick to empty directory (creates empty dir, then mirrors it)
            $emptyDir = Join-Path $env:TEMP "empty_$(New-Guid)"
            New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
            robocopy $emptyDir $dirPath /MIR /R:0 /W:0 /NFL /NDL /NJH /NJS | Out-Null
            Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
            Remove-Item $dirPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "    ✓ Cleaned: $dir" -ForegroundColor Green
        } catch {
            Write-Host "    ⚠ Could not fully clean $dir : $_" -ForegroundColor Yellow
            Write-Host "    (Will try Git prune to clean up references)" -ForegroundColor Gray
        }
    }
}

Write-Host "`nStep 2: Cleaning up Git worktree references..." -ForegroundColor Yellow
git worktree prune

Write-Host "`nStep 3: Deleting branches..." -ForegroundColor Yellow
$branchesToDelete = @(
    "adoring-ptolemy",
    "frosty-northcutt", 
    "heuristic-mcclintock",
    "hopeful-kilby",
    "interesting-hermann",
    "kind-darwin",
    "thirsty-babbage",
    "feature/designer-analytics",
    "feature/development-2025-11-18",
    "feature/updates"
)

foreach ($branch in $branchesToDelete) {
    git branch -D "$branch" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓ Deleted branch: $branch" -ForegroundColor Green
    }
}

Write-Host "`nStep 4: Cleaning up remote tracking..." -ForegroundColor Yellow
git fetch --prune 2>&1 | Out-Null

Write-Host "`n=== Summary ===" -ForegroundColor Green
Write-Host "`nRemaining branches:" -ForegroundColor Cyan
git branch

Write-Host "`nRemaining worktrees:" -ForegroundColor Cyan
git worktree list

Write-Host "`nNote: If some directories still exist, you can manually delete them" -ForegroundColor Yellow
Write-Host "or just leave them - Git references are cleaned up." -ForegroundColor Yellow


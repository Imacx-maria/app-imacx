# Force cleanup of worktrees - manually delete directories then clean Git references

Write-Host "`n=== Force Cleaning Git Worktrees ===" -ForegroundColor Cyan
Write-Host ""

$worktreesToRemove = @(
    "adoring-ptolemy",
    "frosty-northcutt",
    "heuristic-mcclintock",
    "hopeful-kilby",
    "interesting-hermann",
    "kind-darwin",
    "thirsty-babbage"
)

$worktreeBasePath = "$env:USERPROFILE\.claude-worktrees\imacx-clean"

Write-Host "Step 1: Manually deleting worktree directories..." -ForegroundColor Yellow
foreach ($worktree in $worktreesToRemove) {
    $worktreePath = Join-Path $worktreeBasePath $worktree
    if (Test-Path $worktreePath) {
        Write-Host "  Deleting: $worktreePath" -ForegroundColor Gray
        try {
            Remove-Item -Path $worktreePath -Recurse -Force -ErrorAction Stop
            Write-Host "    ✓ Deleted: $worktree" -ForegroundColor Green
        } catch {
            Write-Host "    ⚠ Error deleting $worktree : $_" -ForegroundColor Yellow
        }
    } else {
        Write-Host "    - Not found: $worktree (may already be removed)" -ForegroundColor Gray
    }
}

Write-Host "`nStep 2: Cleaning up Git worktree references..." -ForegroundColor Yellow
git worktree prune

Write-Host "`nStep 3: Deleting branches..." -ForegroundColor Yellow
foreach ($branch in $worktreesToRemove) {
    Write-Host "  Deleting branch: $branch" -ForegroundColor Gray
    git branch -D "$branch" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓ Deleted branch: $branch" -ForegroundColor Green
    } else {
        Write-Host "    - Branch not found or already deleted: $branch" -ForegroundColor Gray
    }
}

Write-Host "`nStep 4: Cleaning up remote tracking..." -ForegroundColor Yellow
git fetch --prune 2>&1 | Out-Null

Write-Host "`n=== Cleanup Complete! ===" -ForegroundColor Green
Write-Host "`nRemaining branches:" -ForegroundColor Cyan
git branch

Write-Host "`nRemaining worktrees:" -ForegroundColor Cyan
git worktree list


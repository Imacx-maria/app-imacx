# Cleanup old Git worktrees and branches
# Keep only feature/temp-quotes-bi-import and main

Write-Host "`n=== Cleaning up Git worktrees and branches ===" -ForegroundColor Cyan
Write-Host ""

# List of worktrees/branches to remove
$itemsToRemove = @(
    "adoring-ptolemy",
    "feature/designer-analytics",
    "feature/development-2025-11-18",
    "feature/updates",
    "frosty-northcutt",
    "heuristic-mcclintock",
    "hopeful-kilby",
    "interesting-hermann",
    "kind-darwin",
    "thirsty-babbage"
)

Write-Host "Step 1: Removing worktrees..." -ForegroundColor Yellow
foreach ($item in $itemsToRemove) {
    Write-Host "  Removing worktree: $item" -ForegroundColor Gray
    git worktree remove "$item" --force 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓ Removed worktree: $item" -ForegroundColor Green
    }
}

Write-Host "`nStep 2: Deleting branches..." -ForegroundColor Yellow
foreach ($item in $itemsToRemove) {
    Write-Host "  Deleting branch: $item" -ForegroundColor Gray
    git branch -D "$item" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓ Deleted branch: $item" -ForegroundColor Green
    }
}

Write-Host "`nStep 3: Cleaning up remote tracking..." -ForegroundColor Yellow
git fetch --prune 2>&1 | Out-Null

Write-Host "`n=== Cleanup Complete! ===" -ForegroundColor Green
Write-Host "`nRemaining branches:" -ForegroundColor Cyan
git branch

Write-Host "`nRemaining worktrees:" -ForegroundColor Cyan
git worktree list


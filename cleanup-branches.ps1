# Cleanup old branches - keep only feature/temp-quotes-bi-import and main
$branchesToDelete = @(
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

Write-Host "Deleting old branches..." -ForegroundColor Yellow

foreach ($branch in $branchesToDelete) {
    Write-Host "Deleting branch: $branch" -ForegroundColor Cyan
    git branch -D $branch 2>&1 | Out-String
}

Write-Host "`nChecking remaining branches..." -ForegroundColor Green
git branch

Write-Host "`nDone! Remaining branches should be:" -ForegroundColor Green
Write-Host "  - feature/temp-quotes-bi-import (current)" -ForegroundColor White
Write-Host "  - main" -ForegroundColor White


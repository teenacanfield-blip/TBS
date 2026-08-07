# Bumps the ?v= number on every page that has one, so browsers fetch the new
# files instead of using an old cached copy. Run this after you change anything,
# BEFORE you publish.
#
#   Right-click this file -> "Run with PowerShell"
#   or from a terminal:  powershell -ExecutionPolicy Bypass -File bump-version.ps1
#
# Each page keeps its own counter, so the hub and the games do not have to be
# in step with each other. A page without a ?v= marker is skipped, not an error —
# that is how a page that does not need cache-busting behaves.
#
# This script lives at the top of the site and the paths below are relative to
# it. Add a line when you add a game that has its own ?v= markers.
$pages = @(
    "index.html",
    "the-13-dynasties/index.html",
    "ufo-caveman/game load up!.html"
)

# Read/write with explicit UTF-8 so accented and symbol characters survive.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$bumped = 0
$missing = 0

foreach ($rel in $pages) {
    $path = Join-Path $PSScriptRoot $rel

    if (-not (Test-Path $path)) {
        Write-Host "skipped  $rel (not found)" -ForegroundColor DarkGray
        $missing++
        continue
    }

    $content = [System.IO.File]::ReadAllText($path, $utf8NoBom)
    $match = [regex]::Match($content, '\?v=(\d+)')

    if (-not $match.Success) {
        Write-Host "skipped  $rel (no ?v= marker)" -ForegroundColor DarkGray
        continue
    }

    $current = [int]$match.Groups[1].Value
    $next = $current + 1
    $updated = [regex]::Replace($content, '\?v=\d+', "?v=$next")
    [System.IO.File]::WriteAllText($path, $updated, $utf8NoBom)

    Write-Host ("bumped   {0}: {1} -> {2}" -f $rel, $current, $next) -ForegroundColor Green
    $bumped++
}

if ($bumped -eq 0) {
    Write-Host ""
    Write-Host "Nothing was bumped. Expected a marker like: game.js?v=1" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Now publish the update with:" -ForegroundColor Cyan
Write-Host "  git add -A" -ForegroundColor White
Write-Host "  git commit -m `"Update game`"" -ForegroundColor White
Write-Host "  git push" -ForegroundColor White
Write-Host ""
Write-Host "Players get the new version next time they load the page." -ForegroundColor Cyan

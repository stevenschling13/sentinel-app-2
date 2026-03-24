<#
.SYNOPSIS
    Sentinel App 2.0 -- Repository Health Audit (PowerShell)

.DESCRIPTION
    Performs a comprehensive audit of the monorepo:
      1. Sync check (ahead/behind origin/main)
      2. Working tree status (untracked, modified, stashes)
      3. Branch hygiene (stale branches >14 days)
      4. CI workflow drift (local vs origin/main)
      5. Dependency drift (lockfile changes)
      6. Open PRs with CI status (requires gh CLI)

.PARAMETER Json
    Output results as machine-readable JSON.

.PARAMETER Help
    Show this help message.

.EXAMPLE
    .\scripts\repo-audit.ps1
    .\scripts\repo-audit.ps1 -Json
    .\scripts\repo-audit.ps1 --json
    .\scripts\repo-audit.ps1 -Help
    .\scripts\repo-audit.ps1 --help
#>

param(
    [switch]$Json,
    [switch]$Help
)

$ErrorActionPreference = "Continue"

# -- Handle --json / --help style args ----------------------------------------
foreach ($a in $args) {
    switch ($a) {
        '--json' { $Json = $true }
        '--help' { $Help = $true }
        '-h'     { $Help = $true }
    }
}

# -- Help ---------------------------------------------------------------------
if ($Help) {
    Write-Host ""
    Write-Host "Sentinel App 2.0 -- Repository Health Audit" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\scripts\repo-audit.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  --json, -Json   Output results as machine-readable JSON"
    Write-Host "  --help, -Help   Show this help message"
    Write-Host ""
    Write-Host "Checks performed:"
    Write-Host "  1. Sync check        - commits ahead/behind origin/main"
    Write-Host "  2. Working tree      - untracked files, modifications, stashes"
    Write-Host "  3. Branch hygiene    - remote branches older than 14 days"
    Write-Host "  4. CI workflow drift - workflow file changes vs origin/main"
    Write-Host "  5. Dependency drift  - lockfile changes vs origin/main"
    Write-Host "  6. Open PRs          - open pull requests with CI status (requires gh)"
    Write-Host ""
    Write-Host "Exit codes:"
    Write-Host "  0  All checks passed"
    Write-Host "  1  Drift or issues detected"
    exit 0
}

# -- State ---------------------------------------------------------------------
$script:TotalChecks  = 0
$script:PassedChecks = 0
$script:FailedChecks = 0
$script:WarnedChecks = 0
$script:DriftDetected = $false
$script:JsonSections = [ordered]@{}

# -- Helpers -------------------------------------------------------------------
function Write-Header {
    param([string]$Title)
    if (-not $Json) {
        Write-Host ""
        Write-Host ("=" * 55) -ForegroundColor Blue
        Write-Host "  $Title" -ForegroundColor Blue
        Write-Host ("=" * 55) -ForegroundColor Blue
    }
}

function Record-Pass {
    param([string]$Message)
    $script:TotalChecks++
    $script:PassedChecks++
    if (-not $Json) {
        Write-Host "  [PASS] " -ForegroundColor Green -NoNewline
        Write-Host $Message -ForegroundColor Green
    }
}

function Record-Fail {
    param([string]$Message)
    $script:TotalChecks++
    $script:FailedChecks++
    $script:DriftDetected = $true
    if (-not $Json) {
        Write-Host "  [FAIL] " -ForegroundColor Red -NoNewline
        Write-Host $Message -ForegroundColor Red
    }
}

function Record-Warn {
    param([string]$Message)
    $script:TotalChecks++
    $script:WarnedChecks++
    if (-not $Json) {
        Write-Host "  [WARN] " -ForegroundColor Yellow -NoNewline
        Write-Host $Message -ForegroundColor Yellow
    }
}

function Write-Info {
    param([string]$Message)
    if (-not $Json) {
        Write-Host "  [INFO] " -ForegroundColor DarkGray -NoNewline
        Write-Host $Message -ForegroundColor DarkGray
    }
}

# -- Ensure git repo -----------------------------------------------------------
$gitCheck = git rev-parse --is-inside-work-tree 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Not inside a git repository." -ForegroundColor Red
    exit 1
}

$RepoRoot = (git rev-parse --show-toplevel 2>&1) -replace '/', '\'
Set-Location $RepoRoot

if (-not $Json) {
    Write-Host ""
    Write-Host "  🚀 Sentinel App 2.0 -- Repository Health Audit" -ForegroundColor Cyan
    Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
    Write-Host "  Repo: $RepoRoot" -ForegroundColor DarkGray
}

# =============================================================================
# 1. SYNC CHECK
# =============================================================================
Write-Header "🕐 Sync Check"

$fetchOk = $true
git fetch origin --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    $fetchOk = $false
    Record-Warn "Could not fetch from origin (offline or no remote)"
    $script:JsonSections["sync"] = @{ status = "error"; message = "fetch failed" }
}

if ($fetchOk) {
    $hasOriginMain = git rev-parse origin/main 2>$null
    if ($LASTEXITCODE -eq 0) {
        $counts = (git rev-list --left-right --count HEAD...origin/main 2>$null) -split '\s+'
        $ahead  = [int]$counts[0]
        $behind = [int]$counts[1]

        if ($ahead -eq 0 -and $behind -eq 0) {
            Record-Pass "In sync with origin/main"
        }
        else {
            if ($ahead -gt 0) {
                Record-Fail "Local is $ahead commit(s) ahead of origin/main"
            }
            if ($behind -gt 0) {
                Record-Fail "Local is $behind commit(s) behind origin/main"
            }
        }

        $script:JsonSections["sync"] = @{
            ahead   = $ahead
            behind  = $behind
            in_sync = ($ahead -eq 0 -and $behind -eq 0)
        }
    }
    else {
        Record-Warn "origin/main branch not found"
        $script:JsonSections["sync"] = @{ status = "error"; message = "origin/main not found" }
    }
}

# =============================================================================
# 2. WORKING TREE STATUS
# =============================================================================
Write-Header "📂 Working Tree Status"

$untracked = @(git ls-files --others --exclude-standard 2>$null)
$modified  = @(git diff --name-only 2>$null)
$staged    = @(git diff --cached --name-only 2>$null)
$stashList = @(git stash list 2>$null)

$untrackedCount = $untracked.Count
$modifiedCount  = $modified.Count
$stagedCount    = $staged.Count
$stashCount     = $stashList.Count
$treeClean      = $true

if ($untrackedCount -gt 0) {
    Record-Warn "$untrackedCount untracked file(s)"
    if (-not $Json) {
        $untracked | Select-Object -First 10 | ForEach-Object {
            Write-Host "         + $_" -ForegroundColor DarkGray
        }
        if ($untrackedCount -gt 10) {
            Write-Host "         ... and $($untrackedCount - 10) more" -ForegroundColor DarkGray
        }
    }
    $treeClean = $false
}

if ($modifiedCount -gt 0) {
    Record-Warn "$modifiedCount modified file(s)"
    if (-not $Json) {
        $modified | Select-Object -First 10 | ForEach-Object {
            Write-Host "         ~ $_" -ForegroundColor DarkGray
        }
        if ($modifiedCount -gt 10) {
            Write-Host "         ... and $($modifiedCount - 10) more" -ForegroundColor DarkGray
        }
    }
    $treeClean = $false
}

if ($stagedCount -gt 0) {
    Record-Warn "$stagedCount staged file(s)"
    $treeClean = $false
}

if ($stashCount -gt 0) {
    Write-Info "$stashCount stash(es) saved"
}

if ($treeClean -and $stashCount -eq 0) {
    Record-Pass "Working tree is clean"
}

$script:JsonSections["working_tree"] = @{
    untracked = $untrackedCount
    modified  = $modifiedCount
    staged    = $stagedCount
    stashes   = $stashCount
    clean     = $treeClean
}

# =============================================================================
# 3. BRANCH HYGIENE
# =============================================================================
Write-Header "🌿 Branch Hygiene"

$staleThresholdDays = 14
$now = Get-Date
$staleBranches  = @()
$activeBranches = @()
$totalRemote    = 0

$refs = git for-each-ref --format="%(refname:short) %(committerdate:iso8601)" refs/remotes/origin/ 2>$null
foreach ($line in $refs) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $parts = $line -split '\s+', 2
    $refName = $parts[0] -replace '^origin/', ''
    if ($refName -eq "HEAD") { continue }

    $totalRemote++

    $age = 0
    $commitDate = $now
    try {
        $commitDate = [datetime]::Parse($parts[1])
        $age = ($now - $commitDate).Days
    }
    catch {
        $age = 0
        $commitDate = $now
    }

    if ($age -gt $staleThresholdDays) {
        $staleBranches += @{
            name      = $refName
            days_old  = $age
            last_date = $commitDate.ToString("yyyy-MM-dd")
        }
        if (-not $Json) {
            Write-Host "  [FAIL] " -ForegroundColor Red -NoNewline
            Write-Host "$refName" -ForegroundColor Red -NoNewline
            Write-Host " -- $age days old ($($commitDate.ToString('yyyy-MM-dd')))" -ForegroundColor DarkGray
        }
    }
    else {
        $activeBranches += $refName
    }
}

$staleCount  = $staleBranches.Count
$activeCount = $activeBranches.Count

if ($staleCount -eq 0) {
    Record-Pass "No stale branches (all within 14 days)"
}
else {
    Record-Fail "$staleCount stale branch(es) older than 14 days"
}

Write-Info "$totalRemote remote branch(es) total, $activeCount active"

$script:JsonSections["branch_hygiene"] = @{
    total_remote   = $totalRemote
    active         = $activeCount
    stale          = $staleCount
    stale_branches = $staleBranches
}

# =============================================================================
# 4. CI WORKFLOW DRIFT
# =============================================================================
Write-Header "⚙️  CI Workflow Drift"

$workflowDir = ".github\workflows"
$ciDrift = $false
$driftedWorkflows = @()
$cleanWorkflows   = @()

$null = git rev-parse origin/main 2>$null
$hasMainRef = ($LASTEXITCODE -eq 0)

if ((Test-Path $workflowDir) -and $hasMainRef) {
    $wfFiles = Get-ChildItem -Path $workflowDir -File -ErrorAction SilentlyContinue
    foreach ($wf in $wfFiles) {
        $filename = $wf.Name
        $localHash  = git hash-object $wf.FullName 2>$null
        $remoteHash = git rev-parse "origin/main:.github/workflows/$filename" 2>$null

        if ($LASTEXITCODE -ne 0) { $remoteHash = "none" }
        if (-not $localHash) { $localHash = "none" }

        if ($localHash -eq $remoteHash) {
            $cleanWorkflows += $filename
            if (-not $Json) {
                Write-Host "  [PASS] " -ForegroundColor Green -NoNewline
                Write-Host "$filename" -ForegroundColor Green -NoNewline
                Write-Host " -- matches origin/main" -ForegroundColor DarkGray
            }
        }
        else {
            $ciDrift = $true
            $driftedWorkflows += $filename
            if (-not $Json) {
                Write-Host "  [FAIL] " -ForegroundColor Red -NoNewline
                Write-Host "$filename" -ForegroundColor Red -NoNewline
                Write-Host " -- differs from origin/main" -ForegroundColor DarkGray
            }
        }
    }

    if ($ciDrift) {
        Record-Fail "$($driftedWorkflows.Count) workflow(s) differ from origin/main"
    }
    else {
        Record-Pass "All CI workflows match origin/main"
    }
}
else {
    if (-not (Test-Path $workflowDir)) {
        Record-Warn "No .github\workflows directory found"
    }
    else {
        Record-Warn "Cannot compare -- origin/main not available"
    }
}

$script:JsonSections["ci_workflows"] = @{
    drift   = $ciDrift
    drifted = $driftedWorkflows
    clean   = $cleanWorkflows
}

# =============================================================================
# 5. DEPENDENCY DRIFT
# =============================================================================
Write-Header "🔒 Dependency Drift"

$lockfiles = @("pnpm-lock.yaml", "uv.lock")
$depDrift  = $false
$depResults = @()

$null = git rev-parse origin/main 2>$null
$hasMainRef = ($LASTEXITCODE -eq 0)

if ($hasMainRef) {
    foreach ($lockfile in $lockfiles) {
        if (Test-Path $lockfile) {
            $localHash  = git hash-object $lockfile 2>$null
            $remoteHash = git rev-parse "origin/main:$lockfile" 2>$null

            if ($LASTEXITCODE -ne 0) {
                Record-Warn "$lockfile -- not found on origin/main [new file]"
                $depResults += @{ file = $lockfile; status = 'new' }
            }
            elseif ($localHash -eq $remoteHash) {
                Record-Pass "$lockfile -- matches origin/main"
                $depResults += @{ file = $lockfile; status = "clean" }
            }
            else {
                $depDrift = $true
                Record-Fail "$lockfile -- differs from origin/main"
                $depResults += @{ file = $lockfile; status = "drifted" }
            }
        }
        else {
            Write-Info "$lockfile -- not found locally"
            $depResults += @{ file = $lockfile; status = "missing" }
        }
    }
}
else {
    Record-Warn "Cannot compare -- origin/main not available"
}

$script:JsonSections["dependency_drift"] = @{
    drift     = $depDrift
    lockfiles = $depResults
}

# =============================================================================
# 6. OPEN PRS
# =============================================================================
Write-Header "🔀 Open Pull Requests"

$ghAvailable = $false
try {
    $null = Get-Command gh -ErrorAction Stop
    $ghAvailable = $true
}
catch {
    $ghAvailable = $false
}

if ($ghAvailable) {
    $authCheck = gh auth status 2>&1
    if ($LASTEXITCODE -eq 0) {
        try {
            $prJson = gh pr list --state open --json number,title,author,statusCheckRollup,headRefName,updatedAt 2>$null
            $prs = $prJson | ConvertFrom-Json -ErrorAction Stop

            if ($prs.Count -eq 0) {
                Record-Pass "No open pull requests"
            }
            else {
                Write-Info "$($prs.Count) open pull request(s)"
                if (-not $Json) {
                    foreach ($pr in $prs) {
                        $prTitle = $pr.title
                        if ($prTitle.Length -gt 50) { $prTitle = $prTitle.Substring(0, 50) + "..." }
                        $author = $pr.author.login
                        $branch = $pr.headRefName
                        $checks = $pr.statusCheckRollup

                        $ciStatus = "pending"
                        if ($null -eq $checks -or $checks.Count -eq 0) {
                            $ciStatus = "pending"
                        }
                        elseif (($checks | Where-Object { $_.conclusion -eq "FAILURE" }).Count -gt 0) {
                            $ciStatus = "failing"
                        }
                        elseif (($checks | Where-Object { $_.conclusion -eq "SUCCESS" }).Count -eq $checks.Count) {
                            $ciStatus = "passing"
                        }
                        else {
                            $ciStatus = "in progress"
                        }

                        $statusColor = "Yellow"
                        if ($ciStatus -eq "passing") { $statusColor = "Green" }
                        elseif ($ciStatus -eq "failing") { $statusColor = "Red" }

                        Write-Host "         #$($pr.number) $prTitle" -ForegroundColor White
                        Write-Host "              $branch by @$author -- " -ForegroundColor DarkGray -NoNewline
                        Write-Host $ciStatus -ForegroundColor $statusColor
                    }
                }
                $script:TotalChecks++
                $script:PassedChecks++
            }

            $script:JsonSections["open_prs"] = @{
                count = $prs.Count
                prs   = $prs
            }
        }
        catch {
            Record-Warn "Failed to fetch PR data from gh CLI"
            $script:JsonSections["open_prs"] = @{ status = "error"; message = $_.Exception.Message }
        }
    }
    else {
        Record-Warn "gh CLI not authenticated -- run 'gh auth login'"
        $script:JsonSections["open_prs"] = @{ status = "not_authenticated" }
    }
}
else {
    Record-Warn "gh CLI not installed -- skipping PR check"
    $script:JsonSections["open_prs"] = @{ status = "gh_not_installed" }
}

# =============================================================================
# SUMMARY
# =============================================================================
if ($Json) {
    $output = [ordered]@{
        timestamp  = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        repository = (Split-Path $RepoRoot -Leaf)
        summary    = @{
            total_checks   = $script:TotalChecks
            passed         = $script:PassedChecks
            failed         = $script:FailedChecks
            warnings       = $script:WarnedChecks
            drift_detected = $script:DriftDetected
        }
    }
    foreach ($key in $script:JsonSections.Keys) {
        $output[$key] = $script:JsonSections[$key]
    }
    $output | ConvertTo-Json -Depth 10
}
else {
    Write-Host ""
    Write-Host ("=" * 55) -ForegroundColor Cyan
    Write-Host "  🚀 Audit Summary" -ForegroundColor Cyan
    Write-Host ("=" * 55) -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Total checks:  $($script:TotalChecks)"
    Write-Host "  [PASS] Passed: $($script:PassedChecks)" -ForegroundColor Green
    if ($script:FailedChecks -gt 0) {
        Write-Host "  [FAIL] Failed: $($script:FailedChecks)" -ForegroundColor Red
    }
    else {
        Write-Host "  [PASS] Failed: 0" -ForegroundColor Green
    }
    if ($script:WarnedChecks -gt 0) {
        Write-Host "  [WARN] Warnings: $($script:WarnedChecks)" -ForegroundColor Yellow
    }
    else {
        Write-Host "        Warnings: 0" -ForegroundColor DarkGray
    }
    Write-Host ""

    if ($script:DriftDetected) {
        Write-Host "  [FAIL] DRIFT DETECTED -- repository is out of sync" -ForegroundColor Red
    }
    else {
        Write-Host "  [PASS] ALL CLEAR -- repository is healthy" -ForegroundColor Green
    }
    Write-Host ""
}

# -- Exit Code -----------------------------------------------------------------
if ($script:DriftDetected) {
    exit 1
}
else {
    exit 0
}

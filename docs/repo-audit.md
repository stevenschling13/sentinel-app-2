# Repository Health Audit System

Automated drift prevention for the Sentinel App 2.0 monorepo. Keeps local and remote codebases in sync with continuous monitoring.

## Quick Start

```bash
# Run audit locally
pnpm audit:repo

# Quick sync check (ahead/behind count)
pnpm audit:sync
```

## What Gets Checked

The audit performs **6 health checks**:

| # | Check | What It Detects |
|---|-------|-----------------|
| 1 | **Sync Check** | Commits ahead/behind `origin/main` |
| 2 | **Working Tree** | Untracked files, unstaged changes, stashes |
| 3 | **Branch Hygiene** | Remote branches older than 14 days |
| 4 | **CI Workflow Drift** | Local `.github/workflows/` differs from remote |
| 5 | **Dependency Drift** | `pnpm-lock.yaml` or `uv.lock` out of sync |
| 6 | **Open PRs** | Open pull requests with CI status (requires `gh`) |

## Running Locally

### Bash (Linux/macOS/Git Bash)

```bash
bash scripts/repo-audit.sh          # Color terminal output
bash scripts/repo-audit.sh --json   # Machine-readable JSON
bash scripts/repo-audit.sh --help   # Usage info
```

### PowerShell (Windows)

```powershell
.\scripts\repo-audit.ps1            # Color terminal output
.\scripts\repo-audit.ps1 -Json      # Machine-readable JSON
.\scripts\repo-audit.ps1 -Help      # Usage info
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All checks passed — repository is healthy |
| `1` | Drift detected — action needed |

## Automated Monitoring

### GitHub Actions Workflow

**File:** `.github/workflows/repo-audit.yml`

- **Schedule:** Every Monday at 9:00 AM UTC
- **Manual trigger:** Available via `workflow_dispatch`
- **On drift detection:** Auto-creates a GitHub issue labeled `maintenance`
- **Artifacts:** Uploads `audit-results.json` (retained 30 days)

The workflow generates a **Step Summary** with a formatted table of all check results.

### Pre-Push Hook

**File:** `.githooks/pre-push`

Runs automatically before every `git push` and warns about:

- Local branch behind `origin/main`
- Modified tracked files not staged for commit
- Untracked test files that should be committed

> **Note:** The pre-push hook is **warning-only** — it never blocks pushes.

### Git Hooks Setup

Hooks live in `.githooks/` (migrated from `.husky/`). They activate automatically via the `prepare` script in `package.json`:

```json
"prepare": "git config core.hooksPath .githooks"
```

After cloning or pulling, run `pnpm install` to configure the hooks path.

To manually activate:

```bash
git config core.hooksPath .githooks
```

## Troubleshooting

### "Could not fetch from origin"

You're offline or the remote is unreachable. The audit skips sync-dependent checks gracefully.

### "gh CLI not installed / not authenticated"

The Open PRs check requires the [GitHub CLI](https://cli.github.com/). Install and run:

```bash
gh auth login
```

### Emoji display issues on Windows

Some terminals may not render emoji correctly. The audit logic and exit codes work regardless of display. Use `--json` mode for programmatic consumption.

### Branch marked as stale but still needed

The 14-day threshold is a guideline. Review stale branches and either push updates or delete them:

```bash
git push origin --delete <branch-name>
```

### Hook not running

Verify the hooks path is set:

```bash
git config core.hooksPath
# Should output: .githooks
```

If not, run `pnpm install` or set it manually.

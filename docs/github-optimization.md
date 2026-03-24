# GitHub Agents, Workflows & Actions — Optimization Guide

This document captures the full audit of the Sentinel Trading Platform's GitHub
automation setup and the optimizations applied to reduce wasted compute, improve
developer experience, and get more value from AI coding agents.

---

## 1. What You Have (Inventory)

| Category | Item | Purpose |
|----------|------|---------|
| **CI Workflow** | `.github/workflows/ci.yml` | Lint, test, build, Docker for every PR/push to `main` |
| **Dependency Audit** | `.github/workflows/dependency-audit.yml` | npm + pip vulnerability scanning |
| **Auto-Labeler** | `.github/workflows/labeler.yml` | Auto-labels PRs by changed files |
| **Dependabot** | `.github/dependabot.yml` | Weekly dependency updates (npm, pip, GitHub Actions) |
| **Release Drafter** | `.github/release.yml` | Auto-generated changelogs from labels |
| **PR Template** | `.github/pull_request_template.md` | Standardized PR descriptions |
| **Issue Templates** | `.github/ISSUE_TEMPLATE/` | Bug reports + feature requests |
| **CODEOWNERS** | `.github/CODEOWNERS` | Auto-assigns reviewers |
| **Copilot Coding Agent** | Dynamic workflow | AI agent that opens PRs from issues |
| **Copilot Code Review** | Dynamic workflow | AI-powered PR review |
| **Claude Code Agent** | Dynamic workflow | Anthropic coding agent |
| **Pre-commit** | `.pre-commit-config.yaml` | Ruff + mypy + file checks on commit |
| **Husky** | `.husky/` | lint-staged + commitlint on commit |
| **Claude Skills** | `.claude/skills/` | Deploy, health-check, env-check automations |

---

## 2. Audit Findings

### 2.1 CI Was Running Every Job on Every PR

**Problem:** The original `ci.yml` ran all four jobs (Web, Engine, Agents, Docker)
on every pull request — even when only one service's code changed. A docs-only PR
still triggered a full Docker build matrix.

**Fix applied:** Added a `changes` job using
[`dorny/paths-filter`](https://github.com/dorny/paths-filter) to detect which
directories changed. Each downstream job now has an `if:` condition that skips it
unless its files were modified (or the event is a push to `main`, which always
runs everything).

**Impact:** A PR touching only `apps/web/` now runs just the Web job instead of
all four — saving ~8 minutes of CI time per PR.

### 2.2 Agents Tests Ran Twice

**Problem:** The Agents CI job had two separate steps:
```yaml
- name: Test
  run: pnpm --filter @sentinel/agents test
- name: Test with coverage
  run: pnpm --filter @sentinel/agents test -- --coverage ...
```
The first run was redundant since the coverage run already executes all tests.

**Fix applied:** Removed the bare `test` step. The coverage step is the single
test run.

### 2.3 Engine Lint Missed the `tests/` Directory

**Problem:** The CI lint step ran `uv run ruff check src/` but the root
`package.json` script runs `ruff check src tests`. Test code was not linted in CI.

**Fix applied:** Changed CI to `uv run ruff check src/ tests/` to match the local
script.

### 2.4 Dependency Audit Ran on Every PR

**Problem:** `dependency-audit.yml` triggered on every `pull_request` and
`push` to `main`. Vulnerability databases rarely change between individual commits,
making most of these runs redundant.

**Fix applied:**
- Runs **weekly** on a cron schedule (Monday 8 AM UTC).
- Runs on pushes to `main` **only when lockfiles change** (path filter).
- Added `workflow_dispatch` for manual trigger when needed.

### 2.5 Dependabot Did Not Cover GitHub Actions

**Problem:** Only `npm` and `pip` ecosystems were configured. GitHub Actions
versions (`actions/checkout@v4`, `actions/setup-node@v4`, etc.) were not tracked
by Dependabot — they could silently become outdated or insecure.

**Fix applied:** Added a `github-actions` ecosystem entry. Also added `assignees`
to all entries so Dependabot PRs appear in your PR dashboard.

### 2.6 Claude Agent Runs Frequently Cancelled (57% Waste)

**Problem:** At the time of this audit, 4 of 7 Claude agent runs were cancelled
after running for roughly an hour each. This is typical when:
- Multiple issues are assigned to an agent concurrently.
- An issue is reassigned or closed while the agent is working.
- The agent hits its timeout.

**Recommendations** (no code change — these are operational tips):
1. **Assign one issue at a time** to the Claude agent. Wait for its PR before
   assigning the next issue.
2. **Write clear, scoped issues** with acceptance criteria. Vague issues
   ("audit this repo") cause the agent to produce large, unfocused PRs.
3. **Use labels** like `copilot` or `claude` so you can filter which issues are
   agent-eligible.
4. **Review agent PRs promptly** — if the agent's PR needs changes, provide
   specific feedback in comments rather than closing and re-assigning.

### 2.7 No Auto-Labeling on PRs

**Problem:** The release drafter (`release.yml`) categorizes changes by labels,
but no labels were being applied automatically — meaning the release notes would
always fall into "Other Changes."

**Fix applied:** Added `.github/labeler.yml` config + `.github/workflows/labeler.yml`
workflow using `actions/labeler@v5`. PRs are now auto-labeled:

| Label | Trigger |
|-------|---------|
| `web` | Changes to `apps/web/` |
| `engine` | Changes to `apps/engine/` |
| `agents` | Changes to `apps/agents/` |
| `shared` | Changes to `packages/shared/` |
| `infra` | Changes to `.github/`, Dockerfiles, `turbo.json` |
| `deps` | Changes to lockfiles or `package.json` |

### 2.8 UV Cache Not Enabled

**Problem:** The `astral-sh/setup-uv@v5` action supports built-in caching via
`enable-cache: true`, but it was not enabled. Every CI run re-downloaded all
Python dependencies.

**Fix applied:** Added `enable-cache: true` to the uv setup step in both CI and
the dependency audit workflow.

---

## 3. How to Use AI Coding Agents Effectively

### 3.1 Copilot Coding Agent (GitHub)

The Copilot coding agent is triggered when you assign an issue to `@copilot`.
It creates a branch, makes changes, and opens a PR.

**Best practices:**
- **One issue per agent session.** Don't batch multiple features into one issue.
- **Be specific.** Instead of "improve the dashboard," write "Add a loading
  spinner to the portfolio table in `apps/web/src/components/PortfolioTable.tsx`."
- **Include file paths** when you know them — agents are faster when they don't
  have to search.
- **Set acceptance criteria** in the issue body — the agent uses these to
  self-validate.
- **Review the PR diff**, not just whether CI passes. Agents can produce
  technically correct but architecturally wrong changes.

### 3.2 Claude Code Agent (Anthropic)

Similar to Copilot but powered by Claude. Activated via issue assignment or
GitHub Actions dispatch.

**Additional tips:**
- Claude tends to produce larger changes. Break issues into smaller pieces.
- The `.claude/skills/` files give Claude operational context (deploy commands,
  health checks, env vars). Keep these updated when infrastructure changes.
- If a Claude run is cancelled, check if the issue description was ambiguous.

### 3.3 Copilot Code Review

Automatically reviews PRs. This is a passive tool — no action needed from you.

**Tips:**
- Don't merge PRs solely because Copilot approved them. Use it as a first-pass
  filter.
- If Copilot's review is noisy (too many false positives), you can configure its
  behavior via the repo's Copilot settings.

---

## 4. Workflow Execution Cost Summary

| Before | After | Savings |
|--------|-------|---------|
| CI: 4 jobs on every PR | CI: only changed-service jobs run | ~60-75% fewer job-minutes on typical PRs |
| Dep audit: every PR + push | Dep audit: weekly + lockfile-change pushes | ~90% fewer audit runs |
| Agents: 2 test runs | Agents: 1 test run (with coverage) | ~2 min per agents CI run |
| uv: no caching | uv: cached | ~30s faster engine setup |

---

## 5. Recommended Next Steps

These are improvements you can make over time:

1. **Add branch protection rules** on `main` requiring the CI status checks
   to pass before merging. Go to Settings → Branches → Add rule.

2. **Enable "Require up-to-date branches"** so PRs must be rebased before
   merging — prevents broken `main` from merge conflicts.

3. **Add a stale bot** to auto-close old issues/PRs. The PR #8 attempted this
   but was closed — consider re-implementing with
   [`actions/stale@v9`](https://github.com/actions/stale).

4. **Add deployment status notifications** — use a Slack/Discord webhook in a
   post-deploy workflow step to notify you when deployments succeed or fail.

5. **Pin action versions to SHAs** instead of tags for security (e.g.,
   `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` instead of `@v4`).
   Dependabot will keep these up to date now that the `github-actions` ecosystem
   is configured.

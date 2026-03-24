#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Sentinel App 2.0 — Repository Health Audit
# =============================================================================
# Performs a comprehensive audit of the monorepo:
#   1. Sync check (ahead/behind origin/main)
#   2. Working tree status (untracked, modified, stashes)
#   3. Branch hygiene (stale branches >14 days)
#   4. CI workflow drift (local vs origin/main)
#   5. Dependency drift (lockfile changes)
#   6. Open PRs with CI status (requires gh CLI)
#
# Usage:
#   ./scripts/repo-audit.sh [--json] [--help]
#
# Exit codes:
#   0  All checks passed
#   1  One or more checks detected drift / issues
# =============================================================================

# ── Colours & Symbols ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

PASS="✅"
FAIL="❌"
WARN="⚠️"
INFO="ℹ️"
BRANCH_ICON="🌿"
CLOCK="🕐"
LOCK="🔒"
PR_ICON="🔀"
ROCKET="🚀"

# ── State ─────────────────────────────────────────────────────────────────────
JSON_MODE=false
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNED_CHECKS=0
DRIFT_DETECTED=false

declare -a JSON_SECTIONS=()

# ── Helpers ───────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}Sentinel App 2.0 — Repository Health Audit${RESET}

Usage:
  $(basename "$0") [OPTIONS]

Options:
  --json    Output results as machine-readable JSON
  --help    Show this help message

Checks performed:
  1. Sync check       — commits ahead/behind origin/main
  2. Working tree     — untracked files, modifications, stashes
  3. Branch hygiene   — remote branches older than 14 days
  4. CI workflow drift — workflow file changes vs origin/main
  5. Dependency drift  — lockfile changes vs origin/main
  6. Open PRs         — open pull requests with CI status (requires gh)

Exit codes:
  0  All checks passed
  1  Drift or issues detected
EOF
  exit 0
}

header() {
  if ! $JSON_MODE; then
    echo ""
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════${RESET}"
    echo -e "${BOLD}${BLUE}  $1${RESET}"
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════${RESET}"
  fi
}

record_pass() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
  if ! $JSON_MODE; then
    echo -e "  ${PASS} ${GREEN}$1${RESET}"
  fi
}

record_fail() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  DRIFT_DETECTED=true
  if ! $JSON_MODE; then
    echo -e "  ${FAIL} ${RED}$1${RESET}"
  fi
}

record_warn() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  WARNED_CHECKS=$((WARNED_CHECKS + 1))
  if ! $JSON_MODE; then
    echo -e "  ${WARN} ${YELLOW}$1${RESET}"
  fi
}

info_line() {
  if ! $JSON_MODE; then
    echo -e "  ${INFO} ${DIM}$1${RESET}"
  fi
}

add_json_section() {
  local name="$1"
  local content="$2"
  JSON_SECTIONS+=("\"$name\": $content")
}

# ── Parse Arguments ───────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=true ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $arg"; usage ;;
  esac
done

# ── Ensure we're in a git repo ────────────────────────────────────────────────
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo -e "${FAIL} ${RED}Not inside a git repository.${RESET}" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if ! $JSON_MODE; then
  echo ""
  echo -e "${BOLD}${CYAN}${ROCKET} Sentinel App 2.0 — Repository Health Audit${RESET}"
  echo -e "${DIM}   $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
  echo -e "${DIM}   Repo: ${REPO_ROOT}${RESET}"
fi

# =============================================================================
# 1. SYNC CHECK
# =============================================================================
header "${CLOCK} Sync Check"

FETCH_OK=true
if ! git fetch origin --quiet 2>/dev/null; then
  FETCH_OK=false
  record_warn "Could not fetch from origin (offline or no remote)"
  add_json_section "sync" '{"status":"error","message":"fetch failed"}'
fi

if $FETCH_OK; then
  if git rev-parse origin/main &>/dev/null; then
    COUNTS=$(git rev-list --left-right --count HEAD...origin/main 2>/dev/null || echo "0 0")
    AHEAD=$(echo "$COUNTS" | awk '{print $1}')
    BEHIND=$(echo "$COUNTS" | awk '{print $2}')

    if [ "$AHEAD" -eq 0 ] && [ "$BEHIND" -eq 0 ]; then
      record_pass "In sync with origin/main"
    else
      if [ "$AHEAD" -gt 0 ]; then
        record_fail "Local is ${AHEAD} commit(s) ahead of origin/main"
      fi
      if [ "$BEHIND" -gt 0 ]; then
        record_fail "Local is ${BEHIND} commit(s) behind origin/main"
      fi
    fi

    add_json_section "sync" "{\"ahead\":${AHEAD},\"behind\":${BEHIND},\"in_sync\":$([ "$AHEAD" -eq 0 ] && [ "$BEHIND" -eq 0 ] && echo true || echo false)}"
  else
    record_warn "origin/main branch not found"
    add_json_section "sync" '{"status":"error","message":"origin/main not found"}'
  fi
fi

# =============================================================================
# 2. WORKING TREE STATUS
# =============================================================================
header "📂 Working Tree Status"

UNTRACKED=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')
MODIFIED=$(git diff --name-only | wc -l | tr -d ' ')
STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
STASH_COUNT=$(git stash list 2>/dev/null | wc -l | tr -d ' ')

TREE_CLEAN=true

if [ "$UNTRACKED" -gt 0 ]; then
  record_warn "${UNTRACKED} untracked file(s)"
  if ! $JSON_MODE; then
    git ls-files --others --exclude-standard | head -10 | while read -r f; do
      echo -e "       ${DIM}+ ${f}${RESET}"
    done
    [ "$UNTRACKED" -gt 10 ] && echo -e "       ${DIM}... and $((UNTRACKED - 10)) more${RESET}"
  fi
  TREE_CLEAN=false
fi

if [ "$MODIFIED" -gt 0 ]; then
  record_warn "${MODIFIED} modified file(s)"
  if ! $JSON_MODE; then
    git diff --name-only | head -10 | while read -r f; do
      echo -e "       ${DIM}~ ${f}${RESET}"
    done
    [ "$MODIFIED" -gt 10 ] && echo -e "       ${DIM}... and $((MODIFIED - 10)) more${RESET}"
  fi
  TREE_CLEAN=false
fi

if [ "$STAGED" -gt 0 ]; then
  record_warn "${STAGED} staged file(s)"
  TREE_CLEAN=false
fi

if [ "$STASH_COUNT" -gt 0 ]; then
  info_line "${STASH_COUNT} stash(es) saved"
fi

if $TREE_CLEAN && [ "$STASH_COUNT" -eq 0 ]; then
  record_pass "Working tree is clean"
fi

add_json_section "working_tree" "{\"untracked\":${UNTRACKED},\"modified\":${MODIFIED},\"staged\":${STAGED},\"stashes\":${STASH_COUNT},\"clean\":${TREE_CLEAN}}"

# =============================================================================
# 3. BRANCH HYGIENE
# =============================================================================
header "${BRANCH_ICON} Branch Hygiene"

STALE_THRESHOLD=$((14 * 86400))
NOW=$(date +%s)
STALE_BRANCHES=()
ACTIVE_BRANCHES=()
TOTAL_REMOTE_BRANCHES=0

while IFS= read -r line; do
  [ -z "$line" ] && continue
  ref=$(echo "$line" | awk '{print $1}')
  branch_name="${ref#refs/remotes/origin/}"

  # Skip HEAD pointer
  [[ "$branch_name" == "HEAD" ]] && continue

  TOTAL_REMOTE_BRANCHES=$((TOTAL_REMOTE_BRANCHES + 1))

  commit_date_unix=$(git log -1 --format='%ct' "$ref" 2>/dev/null || echo "0")
  commit_date_human=$(git log -1 --format='%ci' "$ref" 2>/dev/null | cut -d' ' -f1)
  age=$((NOW - commit_date_unix))

  if [ "$age" -gt "$STALE_THRESHOLD" ]; then
    days_old=$((age / 86400))
    STALE_BRANCHES+=("${branch_name} (${days_old}d old, last: ${commit_date_human})")
    if ! $JSON_MODE; then
      echo -e "  ${FAIL} ${RED}${branch_name}${RESET} ${DIM}— ${days_old} days old (${commit_date_human})${RESET}"
    fi
  else
    ACTIVE_BRANCHES+=("$branch_name")
  fi
done < <(git for-each-ref --format='%(refname) %(committerdate:unix)' refs/remotes/origin/)

STALE_COUNT=${#STALE_BRANCHES[@]}
ACTIVE_COUNT=${#ACTIVE_BRANCHES[@]}

if [ "$STALE_COUNT" -eq 0 ]; then
  record_pass "No stale branches (all within 14 days)"
else
  record_fail "${STALE_COUNT} stale branch(es) older than 14 days"
fi

info_line "${TOTAL_REMOTE_BRANCHES} remote branch(es) total, ${ACTIVE_COUNT} active"

# Build JSON array for stale branches
STALE_JSON="["
for i in "${!STALE_BRANCHES[@]}"; do
  [ "$i" -gt 0 ] && STALE_JSON+=","
  STALE_JSON+="\"${STALE_BRANCHES[$i]}\""
done
STALE_JSON+="]"

add_json_section "branch_hygiene" "{\"total_remote\":${TOTAL_REMOTE_BRANCHES},\"active\":${ACTIVE_COUNT},\"stale\":${STALE_COUNT},\"stale_branches\":${STALE_JSON}}"

# =============================================================================
# 4. CI WORKFLOW DRIFT
# =============================================================================
header "⚙️  CI Workflow Drift"

WORKFLOW_DIR=".github/workflows"
CI_DRIFT=false
DRIFTED_WORKFLOWS=()
CLEAN_WORKFLOWS=()

if [ -d "$WORKFLOW_DIR" ] && git rev-parse origin/main &>/dev/null; then
  for wf_file in "$WORKFLOW_DIR"/*; do
    [ ! -f "$wf_file" ] && continue
    filename=$(basename "$wf_file")

    # Get local hash
    local_hash=$(git hash-object "$wf_file" 2>/dev/null || echo "none")

    # Get origin/main hash
    remote_hash=$(git rev-parse "origin/main:${WORKFLOW_DIR}/${filename}" 2>/dev/null || echo "none")

    if [ "$local_hash" = "$remote_hash" ]; then
      CLEAN_WORKFLOWS+=("$filename")
      if ! $JSON_MODE; then
        echo -e "  ${PASS} ${GREEN}${filename}${RESET} ${DIM}— matches origin/main${RESET}"
      fi
    else
      CI_DRIFT=true
      DRIFTED_WORKFLOWS+=("$filename")
      if ! $JSON_MODE; then
        echo -e "  ${FAIL} ${RED}${filename}${RESET} ${DIM}— differs from origin/main${RESET}"
      fi
    fi
  done

  if $CI_DRIFT; then
    record_fail "${#DRIFTED_WORKFLOWS[@]} workflow(s) differ from origin/main"
  else
    record_pass "All CI workflows match origin/main"
  fi
else
  if [ ! -d "$WORKFLOW_DIR" ]; then
    record_warn "No .github/workflows directory found"
  else
    record_warn "Cannot compare — origin/main not available"
  fi
fi

# Build JSON arrays
DRIFTED_JSON="["
for i in "${!DRIFTED_WORKFLOWS[@]}"; do
  [ "$i" -gt 0 ] && DRIFTED_JSON+=","
  DRIFTED_JSON+="\"${DRIFTED_WORKFLOWS[$i]}\""
done
DRIFTED_JSON+="]"

CLEAN_JSON="["
for i in "${!CLEAN_WORKFLOWS[@]}"; do
  [ "$i" -gt 0 ] && CLEAN_JSON+=","
  CLEAN_JSON+="\"${CLEAN_WORKFLOWS[$i]}\""
done
CLEAN_JSON+="]"

add_json_section "ci_workflows" "{\"drift\":${CI_DRIFT},\"drifted\":${DRIFTED_JSON},\"clean\":${CLEAN_JSON}}"

# =============================================================================
# 5. DEPENDENCY DRIFT
# =============================================================================
header "${LOCK} Dependency Drift"

LOCKFILES=("pnpm-lock.yaml" "uv.lock")
DEP_DRIFT=false
DEP_RESULTS=()

if git rev-parse origin/main &>/dev/null; then
  for lockfile in "${LOCKFILES[@]}"; do
    if [ -f "$lockfile" ]; then
      local_hash=$(git hash-object "$lockfile" 2>/dev/null || echo "none")
      remote_hash=$(git rev-parse "origin/main:${lockfile}" 2>/dev/null || echo "none")

      if [ "$remote_hash" = "none" ]; then
        record_warn "${lockfile} — not found on origin/main (new file?)"
        DEP_RESULTS+=("{\"file\":\"${lockfile}\",\"status\":\"new\"}")
      elif [ "$local_hash" = "$remote_hash" ]; then
        record_pass "${lockfile} — matches origin/main"
        DEP_RESULTS+=("{\"file\":\"${lockfile}\",\"status\":\"clean\"}")
      else
        DEP_DRIFT=true
        record_fail "${lockfile} — differs from origin/main"
        DEP_RESULTS+=("{\"file\":\"${lockfile}\",\"status\":\"drifted\"}")
      fi
    else
      info_line "${lockfile} — not found locally"
      DEP_RESULTS+=("{\"file\":\"${lockfile}\",\"status\":\"missing\"}")
    fi
  done
else
  record_warn "Cannot compare — origin/main not available"
fi

DEP_JSON="["
for i in "${!DEP_RESULTS[@]}"; do
  [ "$i" -gt 0 ] && DEP_JSON+=","
  DEP_JSON+="${DEP_RESULTS[$i]}"
done
DEP_JSON+="]"

add_json_section "dependency_drift" "{\"drift\":${DEP_DRIFT},\"lockfiles\":${DEP_JSON}}"

# =============================================================================
# 6. OPEN PRS
# =============================================================================
header "${PR_ICON} Open Pull Requests"

if command -v gh &>/dev/null; then
  if gh auth status &>/dev/null 2>&1; then
    PR_LIST=$(gh pr list --state open --json number,title,author,statusCheckRollup,headRefName,updatedAt 2>/dev/null || echo "[]")
    PR_COUNT=$(echo "$PR_LIST" | grep -o '"number"' | wc -l | tr -d ' ')

    if [ "$PR_COUNT" -eq 0 ]; then
      record_pass "No open pull requests"
    else
      info_line "${PR_COUNT} open pull request(s)"
      if ! $JSON_MODE; then
        echo "$PR_LIST" | python3 -c "
import sys, json
try:
    prs = json.load(sys.stdin)
    for pr in prs:
        num = pr.get('number', '?')
        title = pr.get('title', 'untitled')[:50]
        branch = pr.get('headRefName', '?')
        author = pr.get('author', {}).get('login', '?')
        checks = pr.get('statusCheckRollup', []) or []
        if not checks:
            ci = '⏳ pending'
        elif all(c.get('conclusion') == 'SUCCESS' for c in checks):
            ci = '✅ passing'
        elif any(c.get('conclusion') == 'FAILURE' for c in checks):
            ci = '❌ failing'
        else:
            ci = '⏳ in progress'
        print(f'       #{num} {title}')
        print(f'            {branch} by @{author} — {ci}')
except Exception:
    pass
" 2>/dev/null || true
      fi
      TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
      PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi

    add_json_section "open_prs" "{\"count\":${PR_COUNT},\"prs\":${PR_LIST}}"
  else
    record_warn "gh CLI not authenticated — run 'gh auth login'"
    add_json_section "open_prs" '{"status":"not_authenticated"}'
  fi
else
  record_warn "gh CLI not installed — skipping PR check"
  add_json_section "open_prs" '{"status":"gh_not_installed"}'
fi

# =============================================================================
# SUMMARY
# =============================================================================
if $JSON_MODE; then
  echo "{"
  echo "  \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\","
  echo "  \"repository\": \"$(basename "$REPO_ROOT")\","
  echo "  \"summary\": {"
  echo "    \"total_checks\": ${TOTAL_CHECKS},"
  echo "    \"passed\": ${PASSED_CHECKS},"
  echo "    \"failed\": ${FAILED_CHECKS},"
  echo "    \"warnings\": ${WARNED_CHECKS},"
  echo "    \"drift_detected\": ${DRIFT_DETECTED}"
  echo "  },"
  for i in "${!JSON_SECTIONS[@]}"; do
    if [ "$i" -lt $((${#JSON_SECTIONS[@]} - 1)) ]; then
      echo "  ${JSON_SECTIONS[$i]},"
    else
      echo "  ${JSON_SECTIONS[$i]}"
    fi
  done
  echo "}"
else
  echo ""
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${CYAN}  ${ROCKET} Audit Summary${RESET}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════${RESET}"
  echo ""
  echo -e "  ${BOLD}Total checks:${RESET}  ${TOTAL_CHECKS}"
  echo -e "  ${PASS} ${GREEN}Passed:${RESET}       ${PASSED_CHECKS}"
  if [ "$FAILED_CHECKS" -gt 0 ]; then
    echo -e "  ${FAIL} ${RED}Failed:${RESET}       ${FAILED_CHECKS}"
  else
    echo -e "  ${PASS} ${GREEN}Failed:${RESET}       0"
  fi
  if [ "$WARNED_CHECKS" -gt 0 ]; then
    echo -e "  ${WARN} ${YELLOW}Warnings:${RESET}     ${WARNED_CHECKS}"
  else
    echo -e "     ${DIM}Warnings:${RESET}     0"
  fi
  echo ""

  if $DRIFT_DETECTED; then
    echo -e "  ${FAIL} ${RED}${BOLD}DRIFT DETECTED${RESET} — repository is out of sync"
  else
    echo -e "  ${PASS} ${GREEN}${BOLD}ALL CLEAR${RESET} — repository is healthy"
  fi
  echo ""
fi

# ── Exit Code ─────────────────────────────────────────────────────────────────
if $DRIFT_DETECTED; then
  exit 1
else
  exit 0
fi

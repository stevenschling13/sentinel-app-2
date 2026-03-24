# Open PR Analysis and Recommendations

Generated: 2026-03-24

## Summary

Analyzed all open PRs and determined the best course of action for each. The main issue affecting PRs #12 and #13 was the Google Fonts dependency causing Vercel deployment failures.

## Resolution

✅ **Fixed**: Applied Google Fonts fix directly to main branch via PR on `claude/review-close-or-merge-prs` branch
- Removed `next/font/google` imports
- Replaced with system font stack (ui-sans-serif, system-ui)
- This eliminates build-time network dependencies

## PR Recommendations

### PR #13: [WIP] Fix failing Vercel deployments in recent PRs
**Status**: Draft
**Recommendation**: **CLOSE**

**Rationale**:
- Based on PR #12's branch (`claude/audit-codebase-and-remove-conflicts`)
- Removes valuable audit logging code that PR #12 adds (463 deletions including compliance/audit_logger.py)
- Font fix has been applied to main branch instead
- This PR is now obsolete

### PR #12: Complete Phase 2 features and implement Phase 3 architecture improvements
**Status**: Draft
**Recommendation**: **REBASE AND REVIEW**

**Rationale**:
- Adds valuable compliance/audit logging features:
  - Phase 3.1: Audit trail logging service
  - Risk check audit logging
  - Order lifecycle audit logging
- 1680 additions, 279 deletions across 17 files
- Still has Vercel deployment failures due to Google Fonts
- **Action**: Rebase onto main (which now has font fix) to resolve deployment issues

### PR #17: chore(deps-dev): bump @vitejs/plugin-react from 4.7.0 to 6.0.1
**Recommendation**: **REVIEW AND MERGE** (if tests pass)
- Standard Dependabot dependency update
- Major version bump (4.x → 6.x)
- Should verify compatibility

### PR #16: chore(deps): bump the minor-and-patch group with 4 updates
**Recommendation**: **REVIEW AND MERGE** (if tests pass)
- Standard Dependabot dependency updates (Supabase, ai, vitest)
- Minor/patch versions only

### PR #15: chore(deps): bump the actions group with 7 updates
**Recommendation**: **REVIEW AND MERGE** (if tests pass)
- GitHub Actions updates (checkout v4→v6, paths-filter v3→v4, etc.)
- Should work with existing CI

## Next Steps

1. **PR #13**: Close with comment explaining it's obsolete
2. **PR #12**: Rebase onto latest main to pick up font fix, then review for merge
3. **PRs #15-17**: Review Dependabot PRs and merge if CI passes
4. **Main branch**: Merge the font fix PR (`claude/review-close-or-merge-prs`)

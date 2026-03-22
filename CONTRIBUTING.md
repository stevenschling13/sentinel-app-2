# Contributing to Sentinel Trading Platform

Thanks for your interest in contributing! Here's how to get started.

## Branch Naming

Use descriptive prefixed branches:

- `feature/*` — New features (e.g., `feature/portfolio-rebalancer`)
- `fix/*` — Bug fixes (e.g., `fix/websocket-reconnect`)
- `chore/*` — Maintenance (e.g., `chore/update-dependencies`)

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `chore:` — Maintenance / tooling
- `docs:` — Documentation changes

Examples:
```
feat: add RSI indicator to engine
fix: correct position sizing calculation
chore: upgrade FastAPI to 0.115
docs: update quick start guide
```

## Pull Request Process

1. Create a branch from `main` following the naming convention above
2. Make your changes and commit using conventional commits
3. Ensure all tests pass locally
4. Open a pull request against `main`
5. Fill out the PR template
6. Wait for CI to pass and request a review

## Development Setup

```bash
git clone https://github.com/stevenschling13/sentinel-app-2.git
cd sentinel-app-2
pnpm install
cd apps/engine && uv sync && cd ../..
cp .env.example .env
pnpm dev
```

## CI Requirements

All PRs must pass CI before merging:
- **Web**: Lint + typecheck + build
- **Engine**: Ruff lint + pytest
- **Agents**: Lint + typecheck + build
# Contributing

## Branch Naming

- `feature/*` — New features
- `fix/*` — Bug fixes
- `chore/*` — Maintenance, deps, CI

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add strategy backtesting page
fix: correct health check proxy path
chore: update Python dependencies
docs: add deployment instructions
```

## Pull Request Process

1. Create a branch from `main`
2. Make your changes
3. Run tests locally:
   ```bash
   pnpm build                    # TypeScript builds
   cd apps/engine && uv run python -m pytest tests/ -v  # Python tests
   cd apps/engine && uv run ruff check src tests         # Python lint
   ```
4. Open a PR against `main`
5. Ensure CI passes
6. Request review

## Development Setup

See [README.md](README.md#quick-start) for setup instructions.

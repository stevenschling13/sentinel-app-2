# Sentinel Trading Platform

[![CI](https://github.com/stevenschling13/sentinel-app-2/actions/workflows/ci.yml/badge.svg)](https://github.com/stevenschling13/sentinel-app-2/actions/workflows/ci.yml)
[![CodeQL](https://github.com/stevenschling13/sentinel-app-2/actions/workflows/codeql.yml/badge.svg)](https://github.com/stevenschling13/sentinel-app-2/actions/workflows/codeql.yml)

AI-powered trading platform with autonomous agents, quantitative strategies, and real-time risk management.

## Architecture

| Service | Stack | Port |
|---------|-------|------|
| [Web Dashboard](apps/web) | Next.js 16, React 19, Tailwind | 3000 |
| [Trading Engine](apps/engine) | FastAPI, Python 3.12+, Polygon.io | 8000 |
| [Agent Orchestrator](apps/agents) | Express, TypeScript, Claude AI | 3001 |
| [Shared Types](packages/shared) | TypeScript type definitions | — |

See [Architecture Documentation](docs/architecture.md) for detailed system design.

## Quick Start

### Prerequisites

- Node.js ≥ 22
- pnpm ≥ 10
- Python ≥ 3.12
- [uv](https://docs.astral.sh/uv/) (Python package manager)

### Setup

```bash
# Clone and install
git clone https://github.com/stevenschling13/sentinel-app-2.git
cd sentinel-app-2
pnpm install
cd apps/engine && uv sync --extra dev && cd ../..

# Copy environment variables
cp .env.example .env
# Fill in API keys (Polygon, Anthropic, Supabase)
```

### Development

```bash
# Run all services (requires Docker)
docker compose up

# Or run individually:
pnpm --filter @sentinel/web dev          # Web on :3000
cd apps/engine && uv run uvicorn src.main:app --reload  # Engine on :8000
pnpm --filter @sentinel/agents dev       # Agents on :3001
```

### Testing

```bash
# All tests
pnpm test                                 # JS/TS tests
cd apps/engine && uv run pytest tests/    # Python tests

# With coverage
pnpm --filter @sentinel/web test -- --coverage
pnpm --filter @sentinel/agents test -- --coverage
cd apps/engine && uv run pytest tests/ --cov=src --cov-fail-under=70
```

## Project Structure

```
sentinel-app-2/
├── apps/
│   ├── web/          # Next.js dashboard
│   ├── engine/       # Python trading engine
│   └── agents/       # AI agent orchestrator
├── packages/
│   └── shared/       # Shared TypeScript types
├── docs/             # Architecture documentation
├── docker-compose.yml
└── turbo.json        # Turborepo pipeline config
```

## Key Features

- **Autonomous Trading Agents**: Three AI agents (Market Sentinel, Strategy Analyst, Risk Monitor) run sequential trading cycles
- **Quantitative Strategies**: 6 strategy families with 10+ individual strategies
- **Real-Time Risk Management**: Drawdown circuit breakers, position limits, pre-trade checks
- **Live Market Data**: Polygon.io integration for quotes, OHLCV bars, and market sentiment
- **Professional Dashboard**: Dark-themed trading UI with portfolio tracking, signal feeds, and backtesting

## Contributing

This project uses:
- [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint)
- [Prettier](https://prettier.io/) for code formatting
- [Ruff](https://docs.astral.sh/ruff/) for Python linting
- Pre-commit hooks via Husky + lint-staged

## License

Private — All rights reserved.
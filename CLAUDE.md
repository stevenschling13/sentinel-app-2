# Sentinel Trading Platform 2.0

Autonomous stock trading platform with AI-powered agents, a Python quantitative engine, and a Next.js dashboard.

## Architecture

```
apps/
├── web/       # Next.js 16 dashboard (React 19, Tailwind 4, Zustand)
├── engine/    # Python FastAPI (strategies, backtest, data, risk)
└── agents/    # TypeScript agent orchestrator (6 Claude agents)
packages/
└── shared/    # Shared TypeScript types
supabase/
└── migrations/  # PostgreSQL schema
```

**Deploy targets**: Vercel (web) → Railway (engine, agents) → Supabase (database)

## Tech Stack

- **Web**: Next.js 16, React 19, Tailwind 4, Zustand, Supabase SSR, Geist fonts
- **Engine**: Python 3.12+, FastAPI, NumPy, Polygon.io, Alpaca
- **Agents**: TypeScript, Anthropic SDK, 6-agent orchestrator (Market Sentinel, News Analyst, Strategy Analyst, Risk Monitor, Execution Planner, Portfolio Manager)
- **Database**: Supabase (PostgreSQL), Realtime subscriptions
- **Monorepo**: pnpm workspaces, Turborepo

## Commands

```bash
pnpm dev              # Start all services via Turbo
pnpm build            # Build all packages
pnpm test:engine      # Run Python tests
pnpm lint:engine      # Lint Python with ruff

cd apps/web && pnpm dev        # Web only (port 3000)
cd apps/engine && uv run uvicorn src.api.main:app --reload  # Engine only (port 8000)
cd apps/agents && pnpm dev     # Agents only (port 3001)
```

## Key Patterns

- **Engine proxy**: Client fetches go through `/api/engine/[...path]` and `/api/agents/[...path]` route handlers. API keys stay server-side.
- **Health polling**: `useServiceHealth` hook polls every 15s, writes to Zustand. Mount once in AppShell.
- **Strategy scanning**: Engine runs 12 strategies across watchlist tickers. Agents orchestrate scans on a cycle.
- **Risk management**: Circuit breakers at 10% (soft) and 15% (hard) drawdown. Max 5% per position, 20% per sector.

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Web | Vercel | sentinel-app-2.vercel.app |
| Engine | Railway | engine-production-8052.up.railway.app |
| Agents | Railway | agents-production-633a.up.railway.app |
| Database | Supabase | luwyjfwauljwsfsnwiqb.supabase.co |

- **Deploy engine/agents**: `railway up --service <id> --detach` from monorepo root
- **Deploy web**: Push to `main` triggers Vercel auto-deploy
- **Dockerfiles**: Use monorepo-root-relative paths (Railway build context is repo root)

## Environment Variables

Copy `.env.example` to `.env` and fill in credentials. Required services:
- Supabase (database + auth)
- Polygon.io (market data)
- Alpaca (paper trading broker)
- Anthropic (AI agents)

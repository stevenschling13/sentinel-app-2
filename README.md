# Sentinel Trading Platform 2.0

[![CI](https://github.com/stevenschling13/sentinel-app-2/actions/workflows/ci.yml/badge.svg)](https://github.com/stevenschling13/sentinel-app-2/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Autonomous stock trading platform with AI-powered agents, a Python quant engine, and a Next.js dashboard.

## Architecture

```
                    +------------------+
                    |   Next.js Web    |
                    |  (Vercel)        |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v----------+      +-----------v--------+
    |   Python Engine    |      |   Agent Orchestrator|
    |   (Railway)        |      |   (Railway)         |
    +--------+-----------+      +-----------+---------+
              |                             |
              +--------------+--------------+
                             |
                    +--------v---------+
                    |    Supabase      |
                    |  (PostgreSQL)    |
                    +------------------+
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web | Next.js 16, React 19, Tailwind 4, Zustand |
| Engine | Python 3.13, FastAPI, NumPy, Polygon.io, Alpaca |
| Agents | TypeScript, Anthropic SDK, Express |
| Database | Supabase (PostgreSQL + Realtime) |
| Monorepo | pnpm workspaces, Turborepo |

## Quick Start

```bash
# Clone
git clone https://github.com/stevenschling13/sentinel-app-2.git
cd sentinel-app-2

# Install JS dependencies
pnpm install

# Install Python dependencies
cd apps/engine && uv sync && cd ../..

# Configure environment
cp .env.example .env
# Fill in: Supabase, Polygon.io, Alpaca, Anthropic API keys

# Start all services
pnpm dev
```

Services start on:
- **Web**: http://localhost:3000
- **Engine**: http://localhost:8000
- **Agents**: http://localhost:3001

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Web | Vercel | sentinel-app-2.vercel.app |
| Engine | Railway | engine-production-8052.up.railway.app |
| Agents | Railway | agents-production-633a.up.railway.app |
| Database | Supabase | luwyjfwauljwsfsnwiqb.supabase.co |

## License

[MIT](LICENSE)

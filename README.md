# Sentinel Trading Platform 2.0

[![CI](https://github.com/stevenschling13/sentinel-app-2/actions/workflows/ci.yml/badge.svg)](https://github.com/stevenschling13/sentinel-app-2/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Autonomous stock trading platform with AI-powered agents, a Python quant engine, and a Next.js dashboard.

## Architecture

| Service | Stack | Directory | Deploy |
|---------|-------|-----------|--------|
| **Web** | Next.js 16, TypeScript, Tailwind | `apps/web/` | Vercel |
| **Engine** | Python 3.13, FastAPI, NumPy, Pandas | `apps/engine/` | Railway |
| **Agents** | TypeScript, AI orchestration | `apps/agents/` | Railway |
| **Shared** | TypeScript types &amp; utilities | `packages/shared/` | — |
| **Database** | PostgreSQL, Row Level Security | `supabase/` | Supabase |

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 16, React, Tailwind CSS
- **Backend**: FastAPI, Pydantic, uv
- **AI Agents**: TypeScript-based autonomous trading agents
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **CI/CD**: GitHub Actions, Vercel, Railway

## Quick Start

```bash
# Clone
git clone https://github.com/stevenschling13/sentinel-app-2.git
cd sentinel-app-2

# Install dependencies
pnpm install
cd apps/engine && uv sync && cd ../..

# Configure environment
cp .env.example .env
# Fill in your credentials (see .env.example for guidance)

# Start development
pnpm dev
```

## Project Structure

```
sentinel-app-2/
├── apps/
│   ├── web/           # Next.js 16 dashboard
│   ├── engine/        # Python FastAPI quant engine
│   └── agents/        # TypeScript AI agents
├── packages/
│   └── shared/        # Shared types & utilities
├── supabase/          # Database migrations
├── turbo.json         # Turborepo config
├── pnpm-workspace.yaml
└── package.json
```

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Web | Vercel | [sentinel-app-2.vercel.app](https://sentinel-app-2.vercel.app) |
| Engine | Railway | Internal API |
| Database | Supabase | Managed PostgreSQL |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

[MIT](LICENSE) © 2026 Steven Schlingman
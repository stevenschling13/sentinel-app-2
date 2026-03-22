# @sentinel/web

Next.js trading dashboard for the Sentinel Trading Platform.

## Stack

- **Framework**: Next.js 16 with App Router
- **React**: 19
- **Styling**: Tailwind CSS (dark theme)
- **State**: Zustand
- **Icons**: Lucide React

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm --filter @sentinel/web dev

# Run tests
pnpm --filter @sentinel/web test

# Build
pnpm --filter @sentinel/web build

# Lint (via next build)
pnpm --filter @sentinel/web build
```

## Pages

| Path | Description |
|------|-------------|
| `/` | Main dashboard with live metrics, alerts, price tickers |
| `/portfolio` | Position table with P&L tracking |
| `/signals` | Live signal feed from strategy scans |
| `/strategies` | Strategy browser with performance stats |
| `/backtest` | Backtest configuration and results |
| `/settings` | Platform configuration and risk limits |

## Architecture

- **Server Components**: Pages, layouts, data fetching
- **Client Components**: Interactive widgets, real-time updates
- **Service Proxy**: Server-side proxy to engine/agents with retry + timeout
- **Error Handling**: Global error boundary, per-page not-found, loading states

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ENGINE_URL` | Python engine base URL |
| `ENGINE_API_KEY` | Engine API key (server-side only) |
| `AGENTS_URL` | Agent orchestrator base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |

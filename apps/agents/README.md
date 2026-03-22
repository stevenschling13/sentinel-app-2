# @sentinel/agents

AI-powered trading agent orchestrator for the Sentinel Trading Platform.

## Architecture

Three specialized agents run in a sequential trading cycle:

1. **Market Sentinel** — Monitors market conditions, detects significant events
2. **Strategy Analyst** — Runs strategy scans, recommends trades
3. **Risk Monitor** — Enforces risk limits, calculates position sizes

## Stack

- **Runtime**: Node.js 22, TypeScript, Express
- **AI**: Anthropic Claude (tool-calling pattern)
- **Validation**: Zod schemas on all tool inputs
- **Resilience**: Exponential backoff retry, request timeouts, rate limiting

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm --filter @sentinel/agents dev

# Run tests
pnpm --filter @sentinel/agents test

# Type check
pnpm --filter @sentinel/agents lint
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for agent reasoning |
| `ENGINE_URL` | Python engine base URL |
| `ENGINE_API_KEY` | Engine authentication key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/agents` | List all agents and their status |
| `POST` | `/cycle` | Trigger a manual trading cycle |
| `GET` | `/alerts` | Get recent alerts |

# @sentinel/engine

Python trading engine powering the Sentinel Trading Platform.

## Stack

- **Framework**: FastAPI with uvicorn
- **Data**: Polygon.io for market data
- **Storage**: Supabase PostgreSQL (via PostgREST)
- **Strategies**: Pluggable strategy framework (6 families, 10+ strategies)
- **Risk**: Position sizing, drawdown circuit breakers, pre-trade checks

## Development

```bash
cd apps/engine

# Install dependencies
uv sync --extra dev

# Run development server
uv run uvicorn src.main:app --reload --port 8000

# Run tests
uv run python -m pytest tests/ -v

# Run tests with coverage
uv run python -m pytest tests/ -v --cov=src --cov-fail-under=70

# Lint
uv run ruff check src/ tests/

# Type check
uv run python -m mypy src/ --ignore-missing-imports
```

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/data/ingest` | Ingest market data for tickers |
| `GET` | `/api/v1/data/quotes` | Get latest quotes |
| `GET` | `/api/v1/data/bars/{ticker}` | Get OHLCV bars |
| `GET` | `/api/v1/strategies/` | List available strategies |
| `POST` | `/api/v1/strategies/scan` | Run strategy scan |
| `GET` | `/api/v1/portfolio/account` | Get account summary |
| `GET` | `/api/v1/portfolio/positions` | Get open positions |
| `POST` | `/api/v1/risk/assess` | Assess portfolio risk |
| `POST` | `/api/v1/risk/position-size` | Calculate position size |
| `POST` | `/api/v1/risk/pre-trade-check` | Pre-trade risk check |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `POLYGON_API_KEY` | Polygon.io API key for market data |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ENGINE_API_KEY` | API key for authenticating requests |

## Strategy Families

| Family | Description |
|--------|-------------|
| `momentum` | Breakout detection with volume confirmation |
| `mean_reversion` | Oversold/overbought reversal entries |
| `trend` | Moving average crossovers, ADX trends |
| `volatility` | Bollinger Band squeezes, ATR breakouts |
| `gap` | Overnight gap analysis |
| `volume` | Volume profile and distribution analysis |

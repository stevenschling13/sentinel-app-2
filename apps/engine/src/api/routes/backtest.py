"""Backtest API routes.

Endpoints for running strategy backtests against historical data.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.backtest.engine import BacktestEngine
from src.strategies.base import OHLCVData
from src.strategies.registry import STRATEGY_CLASSES, create_strategy

router = APIRouter(prefix="/backtest", tags=["backtest"])


class BacktestRequest(BaseModel):
    """Request to run a backtest."""

    strategy_name: str
    ticker: str = "SYNTHETIC"
    bars: int = Field(default=252, ge=50, le=5000)
    initial_capital: float = 100_000.0
    commission_per_share: float = 0.005
    slippage_pct: float = 0.001
    position_size_pct: float = 0.10
    trend: str = Field(default="random", pattern="^(up|down|volatile|random)$")
    seed: int = 42


class BacktestSummary(BaseModel):
    """Concise backtest result."""

    strategy: str
    ticker: str
    total_return: str
    annualized_return: str
    max_drawdown: str
    sharpe_ratio: str
    sortino_ratio: str
    win_rate: str
    profit_factor: str
    total_trades: int
    avg_holding_bars: str


class TradeOut(BaseModel):
    """Individual trade record from backtest."""

    side: str
    entry_bar: int
    exit_bar: int
    entry_price: float
    exit_price: float
    pnl: float
    return_pct: float


class BacktestResponse(BaseModel):
    """Full backtest result."""

    summary: BacktestSummary
    equity_curve: list[float]
    drawdown_curve: list[float]
    trade_count: int
    trades: list[TradeOut]


def generate_synthetic_data(
    ticker: str,
    n: int,
    trend: str,
    seed: int,
) -> OHLCVData:
    """Generate synthetic OHLCV data for backtesting."""
    rng = np.random.default_rng(seed)

    if trend == "up":
        base = 100 + np.linspace(0, 50, n) + np.cumsum(rng.normal(0, 0.5, n))
    elif trend == "down":
        base = 150 - np.linspace(0, 50, n) + np.cumsum(rng.normal(0, 0.5, n))
    elif trend == "volatile":
        base = 100 + 15 * np.sin(np.linspace(0, 8 * np.pi, n)) + np.cumsum(rng.normal(0, 0.8, n))
    else:  # random
        base = 100 + np.cumsum(rng.normal(0.02, 1.5, n))

    close = np.maximum(base, 10.0).astype(np.float64)
    high = (close + rng.uniform(0.5, 3.0, n)).astype(np.float64)
    low = (close - rng.uniform(0.5, 3.0, n)).astype(np.float64)
    open_ = (close + rng.normal(0, 0.5, n)).astype(np.float64)
    volume = rng.uniform(1e6, 5e6, n).astype(np.float64)
    timestamps = np.arange(n, dtype=np.float64)

    return OHLCVData(
        ticker=ticker,
        timestamps=timestamps,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


@router.post("/run", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest) -> BacktestResponse:
    """Run a backtest with synthetic data."""
    if req.strategy_name not in STRATEGY_CLASSES:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown strategy: {req.strategy_name}. "
                f"Available: {sorted(STRATEGY_CLASSES.keys())}"
            ),
        )

    strategy = create_strategy(req.strategy_name)
    data = generate_synthetic_data(req.ticker, req.bars, req.trend, req.seed)

    engine = BacktestEngine(
        initial_capital=req.initial_capital,
        commission_per_share=req.commission_per_share,
        slippage_pct=req.slippage_pct,
        position_size_pct=req.position_size_pct,
    )

    result = engine.run(strategy, data)
    summary = result.summary()

    return BacktestResponse(
        summary=BacktestSummary(**summary),
        equity_curve=result.equity_curve.equity.tolist(),
        drawdown_curve=result.equity_curve.drawdown.tolist(),
        trade_count=result.total_trades,
        trades=[
            TradeOut(
                side=t.side,
                entry_bar=int(t.entry_bar),
                exit_bar=int(t.exit_bar),
                entry_price=float(t.entry_price),
                exit_price=float(t.exit_price),
                pnl=float(t.pnl),
                return_pct=float(t.pnl_pct),
            )
            for t in result.trades
        ],
    )


@router.get("/strategies")
async def list_backtestable_strategies() -> dict:
    """List strategies available for backtesting."""
    return {
        "strategies": sorted(STRATEGY_CLASSES.keys()),
        "trends": ["up", "down", "volatile", "random"],
    }


# ── Walk-Forward Analysis ─────────────────────────────────


class WalkForwardRequest(BaseModel):
    """Request to run walk-forward analysis."""

    strategy_name: str
    ticker: str = "SYNTHETIC"
    bars: int = Field(default=504, ge=120, le=5000)
    in_sample_pct: float = Field(default=0.7, ge=0.5, le=0.9)
    num_windows: int = Field(default=4, ge=2, le=10)
    trend: str = Field(default="random", pattern="^(up|down|volatile|random)$")
    seed: int = 42


@router.post("/walk-forward")
async def run_walk_forward(req: WalkForwardRequest) -> dict:
    """Run walk-forward analysis with rolling in-sample/out-of-sample windows."""
    if req.strategy_name not in STRATEGY_CLASSES:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown strategy: {req.strategy_name}. "
                f"Available: {sorted(STRATEGY_CLASSES.keys())}"
            ),
        )

    from src.backtest.walk_forward import WalkForwardAnalyzer

    data = generate_synthetic_data(req.ticker, req.bars, req.trend, req.seed)
    analyzer = WalkForwardAnalyzer()
    result = analyzer.run(req.strategy_name, data, req.in_sample_pct, req.num_windows)
    return {
        "summary": result.summary(),
        "windows": [
            {
                "window_index": w.window_index,
                "in_sample_sharpe": round(w.in_sample_sharpe, 4),
                "out_sample_sharpe": round(w.out_sample_sharpe, 4),
                "in_sample_return": round(w.in_sample_return, 4),
                "out_sample_return": round(w.out_sample_return, 4),
            }
            for w in result.windows
        ],
    }


# ── Parameter Optimization ────────────────────────────────


class OptimizeRequest(BaseModel):
    """Request to run parameter grid search."""

    strategy_name: str
    ticker: str = "SYNTHETIC"
    bars: int = Field(default=252, ge=50, le=5000)
    param_grid: dict[str, list]
    top_n: int = Field(default=10, ge=1, le=100)
    trend: str = Field(default="random", pattern="^(up|down|volatile|random)$")
    seed: int = 42


@router.post("/optimize")
async def run_optimize(req: OptimizeRequest) -> dict:
    """Run grid-search parameter optimization."""
    if req.strategy_name not in STRATEGY_CLASSES:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown strategy: {req.strategy_name}. "
                f"Available: {sorted(STRATEGY_CLASSES.keys())}"
            ),
        )

    from src.backtest.optimizer import StrategyOptimizer

    data = generate_synthetic_data(req.ticker, req.bars, req.trend, req.seed)
    optimizer = StrategyOptimizer()
    results = optimizer.grid_search(req.strategy_name, data, req.param_grid, req.top_n)
    return {
        "strategy_name": req.strategy_name,
        "combinations_tested": len(results),
        "results": [
            {
                "params": r.params,
                "sharpe": round(r.sharpe, 4),
                "total_return": round(r.total_return, 4),
                "max_drawdown": round(r.max_drawdown, 4),
                "num_trades": r.num_trades,
            }
            for r in results
        ],
    }


# ── Monte Carlo Simulation ────────────────────────────────


class MonteCarloRequest(BaseModel):
    """Request to run Monte Carlo simulation."""

    trade_returns: list[float]
    num_simulations: int = Field(default=1000, ge=100, le=50000)
    num_trades: int = Field(default=100, ge=10, le=10000)
    seed: int | None = None


@router.post("/monte-carlo")
async def run_monte_carlo(req: MonteCarloRequest) -> dict:
    """Run Monte Carlo bootstrap simulation on trade returns."""
    if not req.trade_returns:
        raise HTTPException(status_code=400, detail="trade_returns must not be empty")

    from src.backtest.monte_carlo import MonteCarloSimulator

    simulator = MonteCarloSimulator()
    result = simulator.simulate(req.trade_returns, req.num_simulations, req.num_trades, req.seed)
    return {
        "num_simulations": result.num_simulations,
        "median_return": round(result.median_return, 4),
        "p5_return": round(result.p5_return, 4),
        "p95_return": round(result.p95_return, 4),
        "probability_of_profit": round(result.probability_of_profit, 4),
        "max_drawdown_median": round(result.max_drawdown_median, 4),
    }

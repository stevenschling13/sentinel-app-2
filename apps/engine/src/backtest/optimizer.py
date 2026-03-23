"""Parameter optimization — grid search over strategy parameter space."""
from __future__ import annotations

import itertools
import logging
from dataclasses import dataclass

from src.backtest.engine import BacktestEngine
from src.strategies.base import OHLCVData
from src.strategies.registry import STRATEGY_CLASSES, create_strategy

logger = logging.getLogger(__name__)


@dataclass
class OptimizationResult:
    """Result of a single parameter combination backtest."""

    params: dict
    sharpe: float
    total_return: float
    max_drawdown: float
    num_trades: int


class StrategyOptimizer:
    """Grid-search parameter optimizer for trading strategies."""

    def __init__(
        self,
        initial_capital: float = 100_000.0,
        commission_per_share: float = 0.005,
        slippage_pct: float = 0.001,
        position_size_pct: float = 0.10,
    ) -> None:
        self.initial_capital = initial_capital
        self.commission_per_share = commission_per_share
        self.slippage_pct = slippage_pct
        self.position_size_pct = position_size_pct

    def grid_search(
        self,
        strategy_name: str,
        data: OHLCVData,
        param_grid: dict[str, list],
        top_n: int = 10,
    ) -> list[OptimizationResult]:
        """Run grid search over parameter combinations.

        Returns results sorted by Sharpe ratio (descending), limited to `top_n`.
        """
        if strategy_name not in STRATEGY_CLASSES:
            raise KeyError(
                f"Unknown strategy '{strategy_name}'. "
                f"Available: {sorted(STRATEGY_CLASSES.keys())}"
            )

        keys = sorted(param_grid.keys())
        values = [param_grid[k] for k in keys]
        combinations = list(itertools.product(*values))

        logger.info(
            "optimizer.grid_search.start",
            extra={"strategy": strategy_name, "combinations": len(combinations)},
        )

        results: list[OptimizationResult] = []
        for combo in combinations:
            params = dict(zip(keys, combo, strict=False))
            try:
                strategy = create_strategy(strategy_name, params=params)
                engine = BacktestEngine(
                    initial_capital=self.initial_capital,
                    commission_per_share=self.commission_per_share,
                    slippage_pct=self.slippage_pct,
                    position_size_pct=self.position_size_pct,
                )
                bt = engine.run(strategy, data)
                results.append(
                    OptimizationResult(
                        params=params,
                        sharpe=bt.sharpe_ratio,
                        total_return=bt.total_return,
                        max_drawdown=bt.max_drawdown,
                        num_trades=bt.total_trades,
                    )
                )
            except Exception:
                logger.warning(
                    "optimizer.combination.failed",
                    extra={"params": params},
                    exc_info=True,
                )

        results.sort(key=lambda r: r.sharpe, reverse=True)
        return results[:top_n]

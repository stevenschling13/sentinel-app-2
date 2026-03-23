"""Monte Carlo simulation — bootstrap trade returns for outcome distribution."""
from __future__ import annotations

import logging
import random
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class MonteCarloResult:
    """Aggregate result of Monte Carlo bootstrap simulation."""

    num_simulations: int
    median_return: float
    p5_return: float  # 5th percentile (worst-case)
    p95_return: float  # 95th percentile (best-case)
    probability_of_profit: float
    max_drawdown_median: float


class MonteCarloSimulator:
    """Bootstrap simulator that resamples historical trade returns."""

    def simulate(
        self,
        trade_returns: list[float],
        num_simulations: int = 1000,
        num_trades: int = 100,
        seed: int | None = None,
    ) -> MonteCarloResult:
        """Run bootstrap simulation of trade return sequences.

        For each simulation, randomly sample `num_trades` returns (with
        replacement) from `trade_returns`, compute a cumulative equity
        curve, and collect the terminal return and max drawdown.
        """
        if not trade_returns:
            return MonteCarloResult(
                num_simulations=0,
                median_return=0.0,
                p5_return=0.0,
                p95_return=0.0,
                probability_of_profit=0.0,
                max_drawdown_median=0.0,
            )

        rng = random.Random(seed)
        terminal_returns: list[float] = []
        max_drawdowns: list[float] = []

        for _ in range(num_simulations):
            sampled = rng.choices(trade_returns, k=num_trades)
            equity = np.cumprod(1.0 + np.array(sampled, dtype=np.float64))
            terminal_returns.append(float(equity[-1] - 1.0))

            peak = np.maximum.accumulate(equity)
            dd = np.where(peak > 0, (equity - peak) / peak, 0.0)
            max_drawdowns.append(float(np.min(dd)))

        arr = np.array(terminal_returns)
        dd_arr = np.array(max_drawdowns)

        return MonteCarloResult(
            num_simulations=num_simulations,
            median_return=float(np.median(arr)),
            p5_return=float(np.percentile(arr, 5)),
            p95_return=float(np.percentile(arr, 95)),
            probability_of_profit=float(np.mean(arr > 0)),
            max_drawdown_median=float(np.median(dd_arr)),
        )

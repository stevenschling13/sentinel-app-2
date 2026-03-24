"""Tests for the strategy parameter optimizer."""


import numpy as np
import pytest

from src.backtest.optimizer import OptimizationResult, StrategyOptimizer
from src.strategies.base import OHLCVData


def _make_data(n=200, seed=42):
    rng = np.random.default_rng(seed)
    close = np.cumprod(1 + rng.normal(0.0003, 0.015, n)) * 100
    close = np.maximum(close, 10.0).astype(np.float64)
    return OHLCVData(
        ticker="TEST",
        timestamps=np.arange(n, dtype=np.float64),
        open=close + rng.normal(0, 0.2, n),
        high=close + rng.uniform(0.5, 2, n),
        low=close - rng.uniform(0.5, 2, n),
        close=close,
        volume=rng.uniform(1e6, 5e6, n).astype(np.float64),
    )


class TestGridSearch:
    def test_basic_grid_search(self):
        opt = StrategyOptimizer()
        data = _make_data(n=200)
        results = opt.grid_search(
            strategy_name="sma_crossover",
            data=data,
            param_grid={"short_window": [10, 20], "long_window": [50]},
            top_n=5,
        )
        assert len(results) > 0
        assert all(isinstance(r, OptimizationResult) for r in results)

    def test_results_sorted_by_sharpe(self):
        opt = StrategyOptimizer()
        data = _make_data(n=200)
        results = opt.grid_search(
            strategy_name="sma_crossover",
            data=data,
            param_grid={"short_window": [5, 10, 15], "long_window": [40, 50]},
            top_n=10,
        )
        if len(results) >= 2:
            sharpes = [r.sharpe for r in results]
            assert sharpes == sorted(sharpes, reverse=True)

    def test_top_n_limits_results(self):
        opt = StrategyOptimizer()
        data = _make_data(n=200)
        results = opt.grid_search(
            strategy_name="sma_crossover",
            data=data,
            param_grid={"short_window": [5, 10, 15, 20], "long_window": [40, 50, 60]},
            top_n=2,
        )
        assert len(results) <= 2

    def test_unknown_strategy_raises(self):
        opt = StrategyOptimizer()
        data = _make_data()
        with pytest.raises(KeyError, match="Unknown strategy"):
            opt.grid_search("nonexistent_strategy", data, {"x": [1]})

    def test_result_fields(self):
        opt = StrategyOptimizer()
        data = _make_data(n=200)
        results = opt.grid_search(
            strategy_name="sma_crossover",
            data=data,
            param_grid={"short_window": [10], "long_window": [50]},
        )
        assert len(results) >= 1
        r = results[0]
        assert "short_window" in r.params
        assert "long_window" in r.params
        assert isinstance(r.sharpe, float)
        assert isinstance(r.total_return, float)
        assert isinstance(r.num_trades, int)

    def test_single_combination(self):
        opt = StrategyOptimizer()
        data = _make_data(n=200)
        results = opt.grid_search(
            strategy_name="sma_crossover",
            data=data,
            param_grid={"short_window": [10], "long_window": [50]},
        )
        assert len(results) == 1

    def test_failed_combinations_skipped(self):
        """Strategy combos that error out are gracefully skipped."""
        opt = StrategyOptimizer()
        data = _make_data(n=200)
        # short_window > long_window may not make sense but shouldn't crash
        results = opt.grid_search(
            strategy_name="sma_crossover",
            data=data,
            param_grid={"short_window": [100], "long_window": [10]},
        )
        # May return 0 or 1 depending on strategy behavior — just shouldn't crash
        assert isinstance(results, list)

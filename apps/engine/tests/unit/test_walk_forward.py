"""Tests for walk-forward analysis."""

import numpy as np
import pytest

from src.backtest.walk_forward import WalkForwardAnalyzer, WalkForwardResult, WalkForwardWindow
from src.strategies.base import OHLCVData


def _make_data(n=500, seed=42):
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


class TestWalkForwardAnalysis:
    def test_basic_run(self):
        analyzer = WalkForwardAnalyzer()
        data = _make_data(n=500)
        result = analyzer.run("sma_crossover", data, num_windows=4)
        assert isinstance(result, WalkForwardResult)
        assert result.num_windows == 4
        assert len(result.windows) == 4
        assert result.strategy_name == "sma_crossover"
        assert result.ticker == "TEST"

    def test_window_structure(self):
        analyzer = WalkForwardAnalyzer()
        data = _make_data(n=500)
        result = analyzer.run("sma_crossover", data, num_windows=3)
        for w in result.windows:
            assert isinstance(w, WalkForwardWindow)
            assert w.in_sample_start < w.in_sample_end
            assert w.out_sample_start < w.out_sample_end
            assert w.in_sample_end == w.out_sample_start

    def test_aggregated_metrics(self):
        analyzer = WalkForwardAnalyzer()
        data = _make_data(n=500)
        result = analyzer.run("sma_crossover", data, num_windows=4)
        assert np.isfinite(result.avg_in_sample_sharpe)
        assert np.isfinite(result.avg_out_sample_sharpe)
        assert np.isfinite(result.avg_in_sample_return)
        assert np.isfinite(result.avg_out_sample_return)
        assert np.isfinite(result.efficiency_ratio)

    def test_insufficient_data_raises(self):
        analyzer = WalkForwardAnalyzer()
        data = _make_data(n=100)
        with pytest.raises(ValueError, match="Not enough data"):
            analyzer.run("sma_crossover", data, num_windows=10)

    def test_summary(self):
        analyzer = WalkForwardAnalyzer()
        data = _make_data(n=500)
        result = analyzer.run("sma_crossover", data, num_windows=2)
        summary = result.summary()
        assert summary["strategy_name"] == "sma_crossover"
        assert summary["ticker"] == "TEST"
        assert summary["num_windows"] == 2
        assert "avg_in_sample_sharpe" in summary
        assert "efficiency_ratio" in summary

    def test_two_windows(self):
        analyzer = WalkForwardAnalyzer()
        data = _make_data(n=300)
        result = analyzer.run("sma_crossover", data, num_windows=2)
        assert len(result.windows) == 2

    def test_custom_in_sample_pct(self):
        analyzer = WalkForwardAnalyzer()
        data = _make_data(n=500)
        result = analyzer.run("sma_crossover", data, in_sample_pct=0.5, num_windows=3)
        for w in result.windows:
            is_len = w.in_sample_end - w.in_sample_start
            oos_len = w.out_sample_end - w.out_sample_start
            # With 50/50 split, both should be similar
            assert abs(is_len - oos_len) <= 2

    def test_different_strategies(self):
        analyzer = WalkForwardAnalyzer()
        data = _make_data(n=500)
        result_sma = analyzer.run("sma_crossover", data, num_windows=2)
        result_ema = analyzer.run("ema_momentum_trend", data, num_windows=2)
        assert result_sma.strategy_name != result_ema.strategy_name

    def test_efficiency_ratio_zero_when_is_sharpe_zero(self):
        """If in-sample sharpe is 0, efficiency ratio should be 0."""
        analyzer = WalkForwardAnalyzer()
        # Create flat data where sharpe might be 0
        n = 500
        flat_data = OHLCVData(
            ticker="FLAT",
            timestamps=np.arange(n, dtype=np.float64),
            open=np.full(n, 100.0),
            high=np.full(n, 100.0),
            low=np.full(n, 100.0),
            close=np.full(n, 100.0),
            volume=np.full(n, 1e6),
        )
        result = analyzer.run("sma_crossover", flat_data, num_windows=2)
        # Sharpe should be 0 with flat data
        if result.avg_in_sample_sharpe == 0:
            assert result.efficiency_ratio == 0.0

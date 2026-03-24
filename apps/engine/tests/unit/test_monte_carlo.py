"""Tests for the Monte Carlo bootstrap simulator."""

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from src.backtest.monte_carlo import MonteCarloSimulator


class TestMonteCarloSimulate:
    def setup_method(self):
        self.sim = MonteCarloSimulator()

    def test_empty_returns(self):
        result = self.sim.simulate([])
        assert result.num_simulations == 0
        assert result.median_return == 0.0
        assert result.probability_of_profit == 0.0

    def test_deterministic_seed(self):
        returns = [0.01, -0.005, 0.02, -0.01, 0.015]
        r1 = self.sim.simulate(returns, num_simulations=100, seed=42)
        r2 = self.sim.simulate(returns, num_simulations=100, seed=42)
        assert r1.median_return == r2.median_return
        assert r1.p5_return == r2.p5_return
        assert r1.p95_return == r2.p95_return

    def test_different_seeds_give_different_results(self):
        returns = [0.01, -0.005, 0.02, -0.01, 0.015]
        r1 = self.sim.simulate(returns, num_simulations=500, seed=1)
        r2 = self.sim.simulate(returns, num_simulations=500, seed=99)
        # Very unlikely to be identical with different seeds
        assert r1.median_return != r2.median_return

    def test_num_simulations_matches(self):
        result = self.sim.simulate([0.01, -0.01], num_simulations=200, seed=42)
        assert result.num_simulations == 200

    def test_p5_less_than_median_less_than_p95(self):
        returns = list(np.random.default_rng(42).normal(0.005, 0.02, 50))
        result = self.sim.simulate(returns, num_simulations=1000, seed=42)
        assert result.p5_return <= result.median_return <= result.p95_return

    def test_all_positive_returns_high_profit_probability(self):
        returns = [0.01, 0.02, 0.03, 0.005, 0.015]
        result = self.sim.simulate(returns, num_simulations=500, seed=42)
        assert result.probability_of_profit > 0.9
        assert result.median_return > 0

    def test_all_negative_returns_low_profit_probability(self):
        returns = [-0.01, -0.02, -0.03, -0.005, -0.015]
        result = self.sim.simulate(returns, num_simulations=500, seed=42)
        assert result.probability_of_profit < 0.1
        assert result.median_return < 0

    def test_max_drawdown_is_negative_or_zero(self):
        returns = [0.01, -0.02, 0.03, -0.01]
        result = self.sim.simulate(returns, num_simulations=500, seed=42)
        assert result.max_drawdown_median <= 0

    def test_single_return(self):
        result = self.sim.simulate([0.05], num_simulations=100, num_trades=10, seed=42)
        assert result.num_simulations == 100
        # All sampled returns are 0.05, so terminal return = (1.05)^10 - 1
        expected = (1.05**10) - 1
        assert result.median_return == pytest.approx(expected, rel=1e-6)

    def test_num_trades_parameter(self):
        returns = [0.01, -0.005]
        r_short = self.sim.simulate(returns, num_simulations=500, num_trades=10, seed=42)
        r_long = self.sim.simulate(returns, num_simulations=500, num_trades=200, seed=42)
        # With more trades, variance should be larger
        spread_short = r_short.p95_return - r_short.p5_return
        spread_long = r_long.p95_return - r_long.p5_return
        assert spread_long > spread_short

    @given(
        n_returns=st.integers(min_value=1, max_value=20),
        n_sims=st.integers(min_value=10, max_value=100),
    )
    @settings(max_examples=20)
    def test_result_fields_finite(self, n_returns, n_sims):
        rng = np.random.default_rng(42)
        returns = list(rng.normal(0.001, 0.01, n_returns))
        result = self.sim.simulate(returns, num_simulations=n_sims, seed=42)
        assert np.isfinite(result.median_return)
        assert np.isfinite(result.p5_return)
        assert np.isfinite(result.p95_return)
        assert 0.0 <= result.probability_of_profit <= 1.0

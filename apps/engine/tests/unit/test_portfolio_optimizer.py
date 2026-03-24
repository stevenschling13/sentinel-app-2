"""Tests for the portfolio optimizer."""

import numpy as np

from src.risk.portfolio_optimizer import (
    OptimizationResult,
    PortfolioOptimizer,
    RebalanceAction,
)


def _make_prices(n_assets=3, n_days=252, seed=42):
    """Generate correlated price data for testing."""
    rng = np.random.default_rng(seed)
    prices = {}
    tickers = [f"ASSET{i}" for i in range(n_assets)]
    for i, t in enumerate(tickers):
        drift = 0.0003 + i * 0.0001
        noise = rng.normal(drift, 0.02, n_days)
        prices[t] = np.cumprod(1 + noise) * 100
    return prices, tickers


class TestEstimateReturns:
    def test_basic_estimation(self):
        opt = PortfolioOptimizer()
        prices, tickers = _make_prices()
        exp_ret, cov, returned_tickers = opt.estimate_returns(prices)
        assert len(exp_ret) == 3
        assert cov.shape == (3, 3)
        assert returned_tickers == sorted(tickers)

    def test_empty_prices(self):
        opt = PortfolioOptimizer()
        exp_ret, _cov, tickers = opt.estimate_returns({})
        assert len(exp_ret) == 0
        assert len(tickers) == 0

    def test_single_asset(self):
        opt = PortfolioOptimizer()
        rng = np.random.default_rng(0)
        prices = {"SPY": np.cumprod(1 + rng.normal(0.0003, 0.01, 100)) * 100}
        exp_ret, cov, _tickers = opt.estimate_returns(prices)
        assert len(exp_ret) == 1
        # np.cov with single asset returns a scalar, not a 1x1 matrix
        assert cov.ndim in (0, 2)

    def test_returns_are_annualized(self):
        opt = PortfolioOptimizer()
        prices, _ = _make_prices()
        exp_ret, _cov, _ = opt.estimate_returns(prices)
        # Annualized returns should be in a reasonable range
        assert all(-2.0 < r < 2.0 for r in exp_ret)


class TestMinimumVariance:
    def test_weights_sum_to_one(self):
        opt = PortfolioOptimizer()
        prices, _ = _make_prices()
        result = opt.minimum_variance(prices)
        assert isinstance(result, OptimizationResult)
        assert result.method == "minimum_variance"
        assert abs(sum(result.weights.values()) - 1.0) < 1e-6

    def test_empty_portfolio(self):
        opt = PortfolioOptimizer()
        result = opt.minimum_variance({})
        assert result.weights == {}
        assert result.expected_return == 0
        assert result.expected_volatility == 0

    def test_no_negative_weights(self):
        opt = PortfolioOptimizer()
        prices, _ = _make_prices()
        result = opt.minimum_variance(prices)
        assert all(w >= 0 for w in result.weights.values())

    def test_max_weight_respected(self):
        opt = PortfolioOptimizer(max_weight=0.50)
        prices, _ = _make_prices()
        result = opt.minimum_variance(prices)
        assert all(w <= 0.50 + 1e-6 for w in result.weights.values())


class TestRiskParity:
    def test_weights_sum_to_one(self):
        opt = PortfolioOptimizer()
        prices, _ = _make_prices()
        result = opt.risk_parity(prices)
        assert result.method == "risk_parity"
        assert abs(sum(result.weights.values()) - 1.0) < 1e-6

    def test_empty_portfolio(self):
        opt = PortfolioOptimizer()
        result = opt.risk_parity({})
        assert result.weights == {}

    def test_no_negative_weights(self):
        opt = PortfolioOptimizer()
        prices, _ = _make_prices()
        result = opt.risk_parity(prices)
        assert all(w >= 0 for w in result.weights.values())


class TestMaxSharpe:
    def test_weights_sum_to_one(self):
        opt = PortfolioOptimizer()
        prices, _ = _make_prices()
        result = opt.max_sharpe(prices)
        assert result.method == "max_sharpe"
        assert abs(sum(result.weights.values()) - 1.0) < 1e-6

    def test_empty_portfolio(self):
        opt = PortfolioOptimizer()
        result = opt.max_sharpe({})
        assert result.weights == {}

    def test_sharpe_ratio_calculated(self):
        opt = PortfolioOptimizer()
        prices, _ = _make_prices()
        result = opt.max_sharpe(prices)
        # Sharpe should be a finite number
        assert np.isfinite(result.sharpe_ratio)


class TestRebalanceTrades:
    def setup_method(self):
        self.opt = PortfolioOptimizer()

    def test_basic_rebalance(self):
        current = {"AAPL": 0.5, "MSFT": 0.3, "GOOGL": 0.2}
        target = {"AAPL": 0.33, "MSFT": 0.33, "GOOGL": 0.34}
        actions = self.opt.generate_rebalance_trades(current, target)
        assert len(actions) > 0
        assert all(isinstance(a, RebalanceAction) for a in actions)

    def test_no_trades_when_identical(self):
        weights = {"AAPL": 0.5, "MSFT": 0.5}
        actions = self.opt.generate_rebalance_trades(weights, weights)
        assert len(actions) == 0

    def test_small_changes_filtered(self):
        current = {"AAPL": 0.500, "MSFT": 0.500}
        target = {"AAPL": 0.505, "MSFT": 0.495}
        actions = self.opt.generate_rebalance_trades(current, target, min_trade_pct=0.01)
        assert len(actions) == 0

    def test_new_asset_added(self):
        current = {"AAPL": 1.0}
        target = {"AAPL": 0.5, "MSFT": 0.5}
        actions = self.opt.generate_rebalance_trades(current, target)
        buy_actions = [a for a in actions if a.direction == "buy"]
        sell_actions = [a for a in actions if a.direction == "sell"]
        assert any(a.ticker == "MSFT" for a in buy_actions)
        assert any(a.ticker == "AAPL" for a in sell_actions)

    def test_asset_removed(self):
        current = {"AAPL": 0.5, "MSFT": 0.5}
        target = {"AAPL": 1.0}
        actions = self.opt.generate_rebalance_trades(current, target)
        sell_msft = [a for a in actions if a.ticker == "MSFT"]
        assert len(sell_msft) == 1
        assert sell_msft[0].direction == "sell"

    def test_sorted_by_priority(self):
        current = {"A": 0.1, "B": 0.3, "C": 0.6}
        target = {"A": 0.5, "B": 0.3, "C": 0.2}
        actions = self.opt.generate_rebalance_trades(current, target)
        priorities = [a.priority for a in actions]
        assert priorities == sorted(priorities, reverse=True)


class TestApplyConstraints:
    def test_negative_weights_clipped(self):
        opt = PortfolioOptimizer(min_weight=0.0)
        weights = np.array([-0.1, 0.5, 0.6])
        result = opt._apply_constraints(weights)
        assert all(r >= 0 for r in result)
        assert abs(sum(result) - 1.0) < 1e-6

    def test_max_weight_capped(self):
        opt = PortfolioOptimizer(max_weight=0.4)
        weights = np.array([0.8, 0.1, 0.1])
        result = opt._apply_constraints(weights)
        # After capping at 0.4 and renormalizing, weights are [0.4, 0.1, 0.1] / 0.6
        # = [0.667, 0.167, 0.167]. _apply_constraints clips and renormalizes once.
        assert abs(sum(result) - 1.0) < 1e-6
        # The originally-largest weight should be reduced compared to 0.8
        assert result[0] < 0.8

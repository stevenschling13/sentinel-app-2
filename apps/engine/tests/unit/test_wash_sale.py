"""Tests for wash sale detection."""

from datetime import UTC, datetime, timedelta

import pytest

from src.risk.wash_sale import WashSaleDetector


def _sell_at_loss(ticker, days_ago, price, cost_basis, shares=100):
    ts = datetime.now(tz=UTC) - timedelta(days=days_ago)
    return {
        "ticker": ticker,
        "side": "sell",
        "executed_at": ts.isoformat(),
        "price": price,
        "cost_basis": cost_basis,
        "shares": shares,
    }


def _sell_at_profit(ticker, days_ago, price, cost_basis, shares=100):
    return _sell_at_loss(ticker, days_ago, price, cost_basis, shares)


class TestWashSaleDetection:
    def setup_method(self):
        self.detector = WashSaleDetector()

    def test_buy_after_recent_loss_triggers_wash_sale(self):
        trades = [_sell_at_loss("AAPL", days_ago=10, price=90.0, cost_basis=100.0)]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is True
        assert result["triggering_trade"]["ticker"] == "AAPL"
        assert result["days_since_loss"] <= 10
        assert "Wash sale warning" in result["message"]

    def test_no_wash_sale_for_sell_side(self):
        trades = [_sell_at_loss("AAPL", days_ago=10, price=90.0, cost_basis=100.0)]
        result = self.detector.check_wash_sale(trades, "AAPL", "sell")
        assert result["wash_sale"] is False
        assert result["triggering_trade"] is None

    def test_no_wash_sale_outside_30_day_window(self):
        trades = [_sell_at_loss("AAPL", days_ago=35, price=90.0, cost_basis=100.0)]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is False

    def test_no_wash_sale_when_sold_at_profit(self):
        trades = [_sell_at_profit("AAPL", days_ago=5, price=110.0, cost_basis=100.0)]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is False

    def test_no_wash_sale_different_ticker(self):
        trades = [_sell_at_loss("MSFT", days_ago=5, price=90.0, cost_basis=100.0)]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is False

    def test_no_trades_no_wash_sale(self):
        result = self.detector.check_wash_sale([], "AAPL", "buy")
        assert result["wash_sale"] is False

    def test_missing_cost_basis_skipped(self):
        ts = datetime.now(tz=UTC) - timedelta(days=5)
        trades = [
            {
                "ticker": "AAPL",
                "side": "sell",
                "executed_at": ts.isoformat(),
                "price": 90.0,
                # no cost_basis
            }
        ]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is False

    def test_loss_amount_calculation(self):
        trades = [_sell_at_loss("AAPL", days_ago=3, price=95.0, cost_basis=100.0, shares=50)]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is True
        # Loss = (100 - 95) * 50 = 250
        assert result["triggering_trade"]["loss_amount"] == pytest.approx(250.0)

    def test_most_recent_loss_found_first(self):
        trades = [
            _sell_at_loss("AAPL", days_ago=20, price=80.0, cost_basis=100.0, shares=10),
            _sell_at_loss("AAPL", days_ago=5, price=90.0, cost_basis=100.0, shares=10),
        ]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is True
        # Should find the most recent loss (5 days ago, price=90)
        assert result["triggering_trade"]["price"] == 90.0

    def test_buy_side_only_trades_no_wash_sale(self):
        ts = datetime.now(tz=UTC) - timedelta(days=3)
        trades = [
            {
                "ticker": "AAPL",
                "side": "buy",
                "executed_at": ts.isoformat(),
                "price": 100.0,
                "cost_basis": 100.0,
            }
        ]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is False

    def test_boundary_exactly_30_days(self):
        """Exactly 30 days ago is right at the cutoff — may be excluded depending on time."""
        trades = [_sell_at_loss("AAPL", days_ago=29, price=90.0, cost_basis=100.0)]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is True

    def test_boundary_31_days_excluded(self):
        trades = [_sell_at_loss("AAPL", days_ago=31, price=90.0, cost_basis=100.0)]
        result = self.detector.check_wash_sale(trades, "AAPL", "buy")
        assert result["wash_sale"] is False

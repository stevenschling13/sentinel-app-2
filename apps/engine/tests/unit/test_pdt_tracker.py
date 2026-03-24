"""Tests for Pattern Day Trader (PDT) detection."""

from datetime import UTC, datetime, timedelta

from src.risk.pdt_tracker import PDTTracker


def _trade(ticker, side, minutes_ago=0):
    """Helper to create a trade dict relative to now, using a stable
    intra-day reference so tests don't break near midnight UTC."""
    # Anchor at midday today so minute offsets never cross a date boundary
    now = datetime.now(tz=UTC)
    base = now.replace(hour=12, minute=0, second=0, microsecond=0)
    ts = base - timedelta(minutes=minutes_ago)
    return {"ticker": ticker, "side": side, "executed_at": ts.isoformat()}


class TestCountDayTrades:
    def setup_method(self):
        self.tracker = PDTTracker()

    def test_no_trades(self):
        assert self.tracker.count_day_trades([]) == 0

    def test_single_buy_no_day_trade(self):
        trades = [_trade("AAPL", "buy")]
        assert self.tracker.count_day_trades(trades) == 0

    def test_one_round_trip(self):
        trades = [_trade("AAPL", "buy", 60), _trade("AAPL", "sell", 30)]
        assert self.tracker.count_day_trades(trades) == 1

    def test_multiple_round_trips_same_ticker(self):
        trades = [
            _trade("AAPL", "buy", 120),
            _trade("AAPL", "sell", 100),
            _trade("AAPL", "buy", 80),
            _trade("AAPL", "sell", 60),
        ]
        assert self.tracker.count_day_trades(trades) == 2

    def test_different_tickers(self):
        trades = [
            _trade("AAPL", "buy", 60),
            _trade("AAPL", "sell", 30),
            _trade("MSFT", "buy", 60),
            _trade("MSFT", "sell", 30),
        ]
        assert self.tracker.count_day_trades(trades) == 2

    def test_old_trades_excluded(self):
        old = datetime.now(tz=UTC) - timedelta(days=10)
        trades = [
            {"ticker": "AAPL", "side": "buy", "executed_at": old.isoformat()},
            {"ticker": "AAPL", "side": "sell", "executed_at": old.isoformat()},
        ]
        assert self.tracker.count_day_trades(trades, window_days=5) == 0

    def test_buy_only_no_day_trade(self):
        trades = [_trade("AAPL", "buy", 30), _trade("AAPL", "buy", 20)]
        assert self.tracker.count_day_trades(trades) == 0

    def test_sell_only_no_day_trade(self):
        trades = [_trade("AAPL", "sell", 30), _trade("AAPL", "sell", 20)]
        assert self.tracker.count_day_trades(trades) == 0

    def test_custom_window(self):
        two_days_ago = datetime.now(tz=UTC) - timedelta(days=2)
        trades = [
            {"ticker": "X", "side": "buy", "executed_at": two_days_ago.isoformat()},
            {"ticker": "X", "side": "sell", "executed_at": two_days_ago.isoformat()},
        ]
        assert self.tracker.count_day_trades(trades, window_days=3) == 1
        assert self.tracker.count_day_trades(trades, window_days=1) == 0

    def test_unmatched_excess_sells(self):
        trades = [
            _trade("AAPL", "buy", 60),
            _trade("AAPL", "sell", 50),
            _trade("AAPL", "sell", 40),
        ]
        # Only 1 matched pair: min(1 buy, 2 sells) = 1
        assert self.tracker.count_day_trades(trades) == 1


class TestCheckPDTLimit:
    def setup_method(self):
        self.tracker = PDTTracker()

    def test_under_limit_allowed(self):
        trades = [_trade("AAPL", "buy", 60), _trade("AAPL", "sell", 30)]
        result = self.tracker.check_pdt_limit(trades, "AAPL", max_day_trades=3)
        assert result["allowed"] is True
        assert result["day_trade_count"] == 1
        assert result["warning"] is None

    def test_at_limit_blocked(self):
        trades = []
        for i in range(3):
            trades.append(_trade("AAPL", "buy", 200 - i * 10))
            trades.append(_trade("AAPL", "sell", 190 - i * 10))
        result = self.tracker.check_pdt_limit(trades, "AAPL", max_day_trades=3)
        assert result["allowed"] is False
        assert result["day_trade_count"] == 3
        assert "PDT limit reached" in result["warning"]

    def test_zero_trades_allowed(self):
        result = self.tracker.check_pdt_limit([], "TSLA")
        assert result["allowed"] is True
        assert result["day_trade_count"] == 0
        assert result["ticker"] == "TSLA"

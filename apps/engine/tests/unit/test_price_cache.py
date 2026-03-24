"""Tests for the in-memory PriceCache."""

import threading
from datetime import UTC, datetime
from unittest.mock import MagicMock

from src.data.price_cache import PriceCache


class TestPriceCacheUpdate:
    def test_update_and_get(self):
        cache = PriceCache()
        now = datetime.now(tz=UTC)
        cache.update("AAPL", price=150.0, volume=1_000_000, timestamp=now)
        entry = cache.get("AAPL")
        assert entry is not None
        assert entry["price"] == 150.0
        assert entry["volume"] == 1_000_000
        assert entry["timestamp"] == now

    def test_update_overwrites(self):
        cache = PriceCache()
        now = datetime.now(tz=UTC)
        cache.update("AAPL", price=150.0, volume=100, timestamp=now)
        cache.update("AAPL", price=155.0, volume=200, timestamp=now)
        entry = cache.get("AAPL")
        assert entry["price"] == 155.0
        assert entry["volume"] == 200

    def test_optional_ohlc_fields(self):
        cache = PriceCache()
        now = datetime.now(tz=UTC)
        cache.update(
            "AAPL",
            price=150.0,
            volume=100,
            timestamp=now,
            open_=148.0,
            high=152.0,
            low=147.0,
            change_pct=1.5,
        )
        entry = cache.get("AAPL")
        assert entry["open"] == 148.0
        assert entry["high"] == 152.0
        assert entry["low"] == 147.0
        assert entry["change_pct"] == 1.5

    def test_default_ohlc_uses_price(self):
        cache = PriceCache()
        now = datetime.now(tz=UTC)
        cache.update("AAPL", price=150.0, volume=100, timestamp=now)
        entry = cache.get("AAPL")
        assert entry["open"] == 150.0
        assert entry["high"] == 150.0
        assert entry["low"] == 150.0


class TestPriceCacheGet:
    def test_get_missing_returns_none(self):
        cache = PriceCache()
        assert cache.get("XYZ") is None

    def test_get_all_empty(self):
        cache = PriceCache()
        assert cache.get_all() == {}

    def test_get_all_snapshot(self):
        cache = PriceCache()
        now = datetime.now(tz=UTC)
        cache.update("AAPL", price=150.0, volume=100, timestamp=now)
        cache.update("MSFT", price=300.0, volume=200, timestamp=now)
        snapshot = cache.get_all()
        assert "AAPL" in snapshot
        assert "MSFT" in snapshot
        assert len(snapshot) == 2

    def test_get_all_returns_copy(self):
        cache = PriceCache()
        now = datetime.now(tz=UTC)
        cache.update("AAPL", price=150.0, volume=100, timestamp=now)
        snap1 = cache.get_all()
        snap1["NEW"] = {"price": 999}
        snap2 = cache.get_all()
        assert "NEW" not in snap2


class TestPriceCacheAge:
    def test_age_returns_none_for_unknown(self):
        cache = PriceCache()
        assert cache.age("XYZ") is None

    def test_age_increases(self):
        cache = PriceCache()
        now = datetime.now(tz=UTC)
        cache.update("AAPL", price=150.0, volume=100, timestamp=now)
        age = cache.age("AAPL")
        assert age is not None
        assert age >= 0.0


class TestPriceCachePubSub:
    def test_subscriber_called_on_update(self):
        cache = PriceCache()
        cb = MagicMock()
        cache.subscribe(cb)
        now = datetime.now(tz=UTC)
        cache.update("AAPL", price=150.0, volume=100, timestamp=now)
        cb.assert_called_once()
        args = cb.call_args[0]
        assert args[0] == "AAPL"
        assert args[1]["price"] == 150.0

    def test_multiple_subscribers(self):
        cache = PriceCache()
        cb1 = MagicMock()
        cb2 = MagicMock()
        cache.subscribe(cb1)
        cache.subscribe(cb2)
        now = datetime.now(tz=UTC)
        cache.update("MSFT", price=300.0, volume=100, timestamp=now)
        cb1.assert_called_once()
        cb2.assert_called_once()

    def test_unsubscribe(self):
        cache = PriceCache()
        cb = MagicMock()
        cache.subscribe(cb)
        cache.unsubscribe(cb)
        now = datetime.now(tz=UTC)
        cache.update("AAPL", price=150.0, volume=100, timestamp=now)
        cb.assert_not_called()

    def test_unsubscribe_nonexistent_no_error(self):
        cache = PriceCache()
        cb = MagicMock()
        # Should not raise
        cache.unsubscribe(cb)

    def test_subscriber_exception_suppressed(self):
        cache = PriceCache()
        bad_cb = MagicMock(side_effect=RuntimeError("boom"))
        good_cb = MagicMock()
        cache.subscribe(bad_cb)
        cache.subscribe(good_cb)
        now = datetime.now(tz=UTC)
        cache.update("AAPL", price=150.0, volume=100, timestamp=now)
        bad_cb.assert_called_once()
        good_cb.assert_called_once()


class TestPriceCacheThreadSafety:
    def test_concurrent_updates(self):
        cache = PriceCache()
        now = datetime.now(tz=UTC)

        def writer(prefix, count):
            for i in range(count):
                cache.update(f"{prefix}{i}", price=float(i), volume=i, timestamp=now)

        t1 = threading.Thread(target=writer, args=("A", 50))
        t2 = threading.Thread(target=writer, args=("B", 50))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        all_data = cache.get_all()
        assert len(all_data) == 100

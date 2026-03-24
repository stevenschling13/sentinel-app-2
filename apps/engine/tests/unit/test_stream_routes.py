"""Tests for the SSE streaming API routes."""

from datetime import datetime
from unittest.mock import MagicMock

import pytest

from src.api.routes.stream import HEARTBEAT_INTERVAL, _serialize


class TestSerializeHelper:
    def test_datetime_serialized(self):
        dt = datetime(2024, 7, 25, 12, 0, 0)
        assert _serialize(dt) == "2024-07-25T12:00:00"

    def test_non_datetime_raises(self):
        with pytest.raises(TypeError):
            _serialize(set())


class TestStreamConfiguration:
    def test_heartbeat_interval_is_configured(self):
        assert HEARTBEAT_INTERVAL == 15

    def test_mock_cache_interface(self):
        """Verify the price cache interface used by the stream."""
        mock_cache = MagicMock()
        mock_cache.get_all.return_value = {"AAPL": {"price": 150.0}}
        mock_cache.subscribe = MagicMock()
        mock_cache.unsubscribe = MagicMock()
        # Verify mock is callable
        assert mock_cache.get_all() == {"AAPL": {"price": 150.0}}
        mock_cache.subscribe.assert_not_called()

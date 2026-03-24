"""Tests for the Redis event bus."""

import json
from unittest.mock import MagicMock, patch

from src.events.redis_bus import RedisBus

# Redis is imported lazily inside RedisBus.__init__ via
# ``from upstash_redis import Redis``.  We patch at the library level.
_REDIS_CLS_PATH = "upstash_redis.Redis"


class TestRedisBusInit:
    def test_no_credentials_disables_bus(self):
        bus = RedisBus(url=None, token=None)
        assert bus._redis is None

    def test_url_only_disables_bus(self):
        bus = RedisBus(url="https://redis.example.com", token=None)
        assert bus._redis is None

    def test_token_only_disables_bus(self):
        bus = RedisBus(url=None, token="some-token")
        assert bus._redis is None

    @patch(_REDIS_CLS_PATH)
    def test_valid_credentials_connect(self, mock_redis_cls):
        mock_redis_cls.return_value = MagicMock()
        bus = RedisBus(url="https://redis.example.com", token="tok")
        assert bus._redis is not None
        mock_redis_cls.assert_called_once_with(
            url="https://redis.example.com", token="tok"
        )

    @patch(_REDIS_CLS_PATH, side_effect=Exception("connection failed"))
    def test_connection_failure_disables_bus(self, mock_redis_cls):
        bus = RedisBus(url="https://redis.example.com", token="tok")
        assert bus._redis is None


class TestRedisBusPublish:
    def test_publish_noop_when_disabled(self):
        bus = RedisBus(url=None, token=None)
        # Should not raise
        bus.publish("test_channel", {"key": "value"})

    @patch(_REDIS_CLS_PATH)
    def test_publish_sends_json(self, mock_redis_cls):
        mock_redis = MagicMock()
        mock_redis_cls.return_value = mock_redis
        bus = RedisBus(url="https://redis.example.com", token="tok")

        data = {"event": "order_filled", "ticker": "AAPL"}
        bus.publish("trades", data)

        mock_redis.publish.assert_called_once_with("trades", json.dumps(data))

    @patch(_REDIS_CLS_PATH)
    def test_publish_exception_suppressed(self, mock_redis_cls):
        mock_redis = MagicMock()
        mock_redis.publish.side_effect = RuntimeError("Redis error")
        mock_redis_cls.return_value = mock_redis
        bus = RedisBus(url="https://redis.example.com", token="tok")

        # Should not raise
        bus.publish("trades", {"event": "test"})

    @patch(_REDIS_CLS_PATH)
    def test_publish_multiple_channels(self, mock_redis_cls):
        mock_redis = MagicMock()
        mock_redis_cls.return_value = mock_redis
        bus = RedisBus(url="https://redis.example.com", token="tok")

        bus.publish("ch1", {"a": 1})
        bus.publish("ch2", {"b": 2})

        assert mock_redis.publish.call_count == 2

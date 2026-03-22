"""
Cross-service event bus using Upstash Redis REST API.

Publishes events for consumption by agents, dashboard, and other services.
Graceful no-op when Redis credentials are not configured.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class RedisBus:
    """Thin wrapper around Upstash Redis for publishing events."""

    def __init__(self, url: str | None = None, token: str | None = None) -> None:
        self._redis = None

        url = url or os.getenv("UPSTASH_REDIS_REST_URL")
        token = token or os.getenv("UPSTASH_REDIS_REST_TOKEN")

        if url and token:
            try:
                from upstash_redis import Redis

                self._redis = Redis(url=url, token=token)
                logger.info("event-bus connected to Upstash Redis")
            except Exception:
                logger.warning("event-bus failed to initialise Upstash Redis client", exc_info=True)
        else:
            logger.warning(
                "event-bus disabled: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set"
            )

    def publish(self, channel: str, data: dict[str, Any]) -> None:
        """Publish a JSON payload to a Redis channel. No-op if Redis is not configured."""
        if self._redis is None:
            return
        try:
            self._redis.publish(channel, json.dumps(data))
        except Exception:
            logger.warning("event-bus publish failed on channel=%s", channel, exc_info=True)


# ── Module-level singleton ───────────────────────────────────

redis_bus = RedisBus()

"""Thread-safe in-memory latest-price store.

Populated by the Alpaca WebSocket feed and consumed by data routes as a
fast-path before falling back to Polygon REST.
"""

from __future__ import annotations

import contextlib
import threading
from collections.abc import Callable
from datetime import datetime
from time import monotonic
from typing import Any


class PriceCache:
    """Thread-safe cache of the most recent bar per ticker."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: dict[str, dict[str, Any]] = {}
        self._updated_at: dict[str, float] = {}  # monotonic timestamps
        self._subscribers: list[Callable[[str, dict[str, Any]], Any]] = []

    # ── mutations ────────────────────────────────────────────

    def update(
        self,
        ticker: str,
        price: float,
        volume: int,
        timestamp: datetime,
        *,
        open_: float | None = None,
        high: float | None = None,
        low: float | None = None,
        change_pct: float = 0.0,
    ) -> None:
        """Store (or overwrite) the latest data for *ticker*."""
        entry = {
            "price": price,
            "open": open_ if open_ is not None else price,
            "high": high if high is not None else price,
            "low": low if low is not None else price,
            "volume": volume,
            "timestamp": timestamp,
            "change_pct": change_pct,
        }
        with self._lock:
            self._data[ticker] = entry
            self._updated_at[ticker] = monotonic()
            subscribers = list(self._subscribers)

        for cb in subscribers:
            with contextlib.suppress(Exception):
                cb(ticker, entry)

    # ── reads ────────────────────────────────────────────────

    def get(self, ticker: str) -> dict[str, Any] | None:
        """Return latest data for *ticker*, or ``None``."""
        with self._lock:
            return self._data.get(ticker)

    def get_all(self) -> dict[str, dict[str, Any]]:
        """Return a snapshot of all cached prices."""
        with self._lock:
            return dict(self._data)

    def age(self, ticker: str) -> float | None:
        """Seconds since the last update for *ticker*, or ``None``."""
        with self._lock:
            ts = self._updated_at.get(ticker)
        if ts is None:
            return None
        return monotonic() - ts

    # ── pub/sub ──────────────────────────────────────────────

    def subscribe(self, callback: Callable[[str, dict[str, Any]], Any]) -> None:
        """Register *callback(ticker, entry)* to fire on each update."""
        with self._lock:
            self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[str, dict[str, Any]], Any]) -> None:
        """Remove a previously registered callback."""
        with self._lock, contextlib.suppress(ValueError):
            self._subscribers.remove(callback)

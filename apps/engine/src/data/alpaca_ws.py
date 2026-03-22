"""Alpaca IEX WebSocket client for real-time minute bars.

Connects to the free IEX feed, authenticates, subscribes to minute bars
for a configurable watchlist, and pushes updates into a :class:`PriceCache`.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import websockets

if TYPE_CHECKING:
    from src.data.price_cache import PriceCache

logger = logging.getLogger(__name__)

_WS_URL = "wss://stream.data.alpaca.markets/v2/iex"
_DEFAULT_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY"]

# Reconnect back-off parameters
_INITIAL_BACKOFF = 1.0
_MAX_BACKOFF = 60.0
_BACKOFF_FACTOR = 2.0


class AlpacaWebSocket:
    """Manages a resilient WebSocket connection to Alpaca's IEX feed."""

    def __init__(self, api_key: str, secret_key: str) -> None:
        self._api_key = api_key
        self._secret_key = secret_key
        self._tickers: list[str] = list(_DEFAULT_TICKERS)
        self._price_cache: PriceCache | None = None
        self._task: asyncio.Task[None] | None = None
        self._stop_event: asyncio.Event = asyncio.Event()

    # ── public API ───────────────────────────────────────────

    def start(self, price_cache: PriceCache) -> None:
        """Launch the WebSocket listener as a background asyncio task."""
        self._price_cache = price_cache
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_forever(), name="alpaca-ws")
        logger.info("Alpaca WebSocket task started")

    async def stop(self) -> None:
        """Signal the listener to stop and wait for it to finish."""
        if self._task is None:
            return
        self._stop_event.set()
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None
        logger.info("Alpaca WebSocket task stopped")

    async def update_subscriptions(self, tickers: list[str]) -> None:
        """Update the set of subscribed tickers at runtime.

        The change takes effect on the next reconnect cycle.  If the
        WebSocket is currently connected, it is *not* disconnected — the
        new list will be used on the next subscribe handshake.
        """
        self._tickers = [t.upper() for t in tickers]
        logger.info("Alpaca subscription list updated: %s", self._tickers)

    # ── internals ────────────────────────────────────────────

    async def _run_forever(self) -> None:
        """Reconnect loop with exponential back-off."""
        backoff = _INITIAL_BACKOFF
        while not self._stop_event.is_set():
            try:
                await self._connect_and_listen()
                backoff = _INITIAL_BACKOFF  # reset on clean disconnect
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Alpaca WebSocket error; reconnecting in %.1fs", backoff)
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=backoff)
                    return  # stop requested during back-off
                except TimeoutError:
                    pass
                backoff = min(backoff * _BACKOFF_FACTOR, _MAX_BACKOFF)

    async def _connect_and_listen(self) -> None:
        logger.info("Connecting to Alpaca IEX WebSocket …")
        async with websockets.connect(_WS_URL) as ws:
            # The server sends a welcome message first
            welcome = await ws.recv()
            logger.debug("Alpaca welcome: %s", welcome)

            # Authenticate
            await ws.send(json.dumps({
                "action": "auth",
                "key": self._api_key,
                "secret": self._secret_key,
            }))
            auth_resp = json.loads(await ws.recv())
            if not self._check_auth(auth_resp):
                return

            # Subscribe to minute bars
            await ws.send(json.dumps({
                "action": "subscribe",
                "bars": self._tickers,
            }))
            sub_resp = await ws.recv()
            logger.info("Alpaca subscribe response: %s", sub_resp)

            # Listen for messages until stopped or disconnected
            async for raw in ws:
                if self._stop_event.is_set():
                    break
                self._handle_message(raw)

    def _check_auth(self, messages: list[dict] | dict | str) -> bool:
        """Return True if auth succeeded, else log and return False."""
        if isinstance(messages, str):
            messages = json.loads(messages)
        if isinstance(messages, dict):
            messages = [messages]
        for msg in messages:
            if msg.get("T") == "error":
                logger.error("Alpaca auth error: %s", msg)
                return False
            if msg.get("T") == "success" and msg.get("msg") == "authenticated":
                logger.info("Alpaca WebSocket authenticated")
                return True
        logger.warning("Unexpected auth response: %s", messages)
        return False

    def _handle_message(self, raw: str | bytes) -> None:
        """Parse incoming messages and update the price cache."""
        try:
            messages = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Non-JSON message from Alpaca: %s", raw[:200])
            return

        if isinstance(messages, dict):
            messages = [messages]

        for msg in messages:
            msg_type = msg.get("T")
            if msg_type == "b":  # minute bar
                self._process_bar(msg)
            elif msg_type == "error":
                logger.error("Alpaca stream error: %s", msg)

    def _process_bar(self, bar: dict) -> None:
        """Extract fields from an Alpaca bar message and push to cache."""
        if self._price_cache is None:
            return

        ticker = bar.get("S", "")
        try:
            close = float(bar["c"])
            open_ = float(bar["o"])
            high = float(bar["h"])
            low = float(bar["l"])
            volume = int(bar["v"])
            ts_str = bar.get("t", "")
            timestamp = (
                datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if ts_str
                else datetime.now(tz=UTC)
            )
            change_pct = round(((close - open_) / open_) * 100, 4) if open_ else 0.0
        except (KeyError, ValueError, TypeError):
            logger.warning("Malformed Alpaca bar: %s", bar)
            return

        self._price_cache.update(
            ticker=ticker,
            price=close,
            volume=volume,
            timestamp=timestamp,
            open_=open_,
            high=high,
            low=low,
            change_pct=change_pct,
        )
        logger.debug("Updated price cache: %s @ %.2f", ticker, close)

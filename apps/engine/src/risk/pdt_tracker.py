"""Pattern Day Trader (PDT) tracking.

Counts round-trip day trades in a rolling 5-business-day window.
A day trade is defined as a buy and sell (or sell and buy) of the
same ticker on the same calendar date.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


class PDTTracker:
    """Detect and count pattern day trades."""

    def count_day_trades(self, trades: list[dict], window_days: int = 5) -> int:
        """Count round-trip day trades in the rolling window.

        Each *trade* dict must contain at minimum:
        - ``ticker``: str
        - ``side``: ``"buy"`` | ``"sell"``
        - ``executed_at``: ISO-8601 datetime string
        """
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=window_days)

        # Group trades by (ticker, date)
        daily: dict[tuple[str, str], dict[str, int]] = {}
        for t in trades:
            ts = datetime.fromisoformat(t["executed_at"])
            if ts < cutoff:
                continue
            key = (t["ticker"], ts.date().isoformat())
            counts = daily.setdefault(key, {"buy": 0, "sell": 0})
            side = t["side"].lower()
            if side in counts:
                counts[side] += 1

        # A day trade occurs for each paired buy+sell on the same day/ticker.
        return sum(min(c["buy"], c["sell"]) for c in daily.values())

    def check_pdt_limit(
        self,
        trades: list[dict],
        proposed_ticker: str,
        max_day_trades: int = 3,
    ) -> dict:
        """Check if executing a proposed trade would breach PDT limits.

        Returns a status dict with the current count, the limit,
        whether the trade is allowed, and an optional warning message.
        """
        count = self.count_day_trades(trades)
        return {
            "day_trade_count": count,
            "limit": max_day_trades,
            "ticker": proposed_ticker,
            "allowed": count < max_day_trades,
            "warning": (
                f"PDT limit reached ({count}/{max_day_trades})" if count >= max_day_trades else None
            ),
        }

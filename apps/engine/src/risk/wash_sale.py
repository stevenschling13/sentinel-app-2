"""Wash sale detection.

Flags repurchases of a security within 30 days of realising a loss,
per IRS wash sale rules (IRC §1091).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta


class WashSaleDetector:
    """Detect potential wash sales across a trade history."""

    def check_wash_sale(
        self,
        trades: list[dict],
        proposed_ticker: str,
        proposed_side: str,
    ) -> dict:
        """Check if buying a ticker would trigger a wash sale.

        Only buy-side orders can trigger a wash sale.  Each *trade* dict
        should contain:
        - ``ticker``: str
        - ``side``: ``"buy"`` | ``"sell"``
        - ``executed_at``: ISO-8601 datetime string
        - ``price``: float (execution price)
        - ``cost_basis``: float (average cost basis at time of sale)

        If *cost_basis* is not present the trade is skipped.
        """
        if proposed_side != "buy":
            return {"wash_sale": False, "triggering_trade": None, "days_since_loss": None}

        now = datetime.now(tz=UTC)
        cutoff = now - timedelta(days=30)

        # Find sells at a loss for the same ticker within 30 days
        for t in sorted(trades, key=lambda x: x["executed_at"], reverse=True):
            if t["ticker"] != proposed_ticker:
                continue
            if t["side"].lower() != "sell":
                continue

            cost_basis = t.get("cost_basis")
            if cost_basis is None:
                continue

            sell_price = t["price"]
            if sell_price >= cost_basis:
                continue  # not a loss

            ts = datetime.fromisoformat(t["executed_at"])
            if ts < cutoff:
                continue  # outside 30-day window

            days_since = (now - ts).days
            loss_amount = round((cost_basis - sell_price) * t.get("shares", 0), 6)

            return {
                "wash_sale": True,
                "triggering_trade": {
                    "ticker": t["ticker"],
                    "side": t["side"],
                    "executed_at": t["executed_at"],
                    "price": sell_price,
                    "cost_basis": cost_basis,
                    "loss_amount": loss_amount,
                },
                "days_since_loss": days_since,
                "message": (
                    f"Wash sale warning: {proposed_ticker} was sold at a loss "
                    f"${loss_amount:.2f} {days_since} day(s) ago. "
                    f"Repurchasing within 30 days disallows the loss deduction."
                ),
            }

        return {"wash_sale": False, "triggering_trade": None, "days_since_loss": None}

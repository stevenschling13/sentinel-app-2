"""Earnings calendar client.

Fetches upcoming earnings dates from Finnhub (primary) and Polygon.io (fallback).
Degrades gracefully when API keys are missing.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EarningsEvent:
    """A single earnings calendar entry."""

    ticker: str
    date: str
    eps_estimate: float | None = None
    eps_actual: float | None = None
    revenue_estimate: float | None = None
    revenue_actual: float | None = None
    hour: str = "unknown"  # "bmo" (before market open), "amc" (after market close), "unknown"
    raw: dict[str, Any] = field(default_factory=dict)


class EarningsClient:
    """Earnings calendar client with Finnhub (primary) and Polygon.io (fallback)."""

    FINNHUB_BASE = "https://finnhub.io"
    POLYGON_BASE = "https://api.polygon.io"

    def __init__(
        self,
        finnhub_api_key: str | None = None,
        polygon_api_key: str | None = None,
    ) -> None:
        self._finnhub_key = finnhub_api_key or os.environ.get("FINNHUB_API_KEY", "")
        self._polygon_key = polygon_api_key or os.environ.get("POLYGON_API_KEY", "")
        self._http = httpx.AsyncClient(timeout=15.0)

    # ── Internal helpers ─────────────────────────────────────

    async def _fetch_finnhub_earnings(
        self,
        tickers: list[str],
        from_date: str,
        to_date: str,
    ) -> list[EarningsEvent]:
        """Fetch earnings calendar from Finnhub."""
        if not self._finnhub_key:
            return []

        events: list[EarningsEvent] = []

        if tickers:
            for ticker in tickers[:20]:
                try:
                    resp = await self._http.get(
                        f"{self.FINNHUB_BASE}/api/v1/calendar/earnings",
                        params={
                            "symbol": ticker.upper(),
                            "from": from_date,
                            "to": to_date,
                            "token": self._finnhub_key,
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                except httpx.HTTPError as exc:
                    logger.warning("Finnhub earnings fetch for %s failed: %s", ticker, exc)
                    continue

                for item in data.get("earningsCalendar", []):
                    events.append(self._parse_finnhub_event(item))
        else:
            try:
                resp = await self._http.get(
                    f"{self.FINNHUB_BASE}/api/v1/calendar/earnings",
                    params={
                        "from": from_date,
                        "to": to_date,
                        "token": self._finnhub_key,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPError as exc:
                logger.warning("Finnhub earnings calendar fetch failed: %s", exc)
                return []

            for item in data.get("earningsCalendar", []):
                events.append(self._parse_finnhub_event(item))

        return events

    @staticmethod
    def _parse_finnhub_event(item: dict[str, Any]) -> EarningsEvent:
        hour_raw = item.get("hour", "unknown")
        hour = {"bmo": "bmo", "amc": "amc"}.get(str(hour_raw).lower(), "unknown")
        return EarningsEvent(
            ticker=item.get("symbol", ""),
            date=item.get("date", ""),
            eps_estimate=item.get("epsEstimate"),
            eps_actual=item.get("epsActual"),
            revenue_estimate=item.get("revenueEstimate"),
            revenue_actual=item.get("revenueActual"),
            hour=hour,
            raw=item,
        )

    async def _fetch_polygon_earnings(
        self,
        tickers: list[str],
        from_date: str,
        to_date: str,
    ) -> list[EarningsEvent]:
        """Fetch earnings from Polygon.io as a fallback."""
        if not self._polygon_key:
            return []

        events: list[EarningsEvent] = []
        for ticker in tickers[:20]:
            try:
                resp = await self._http.get(
                    f"{self.POLYGON_BASE}/vX/reference/financials",
                    params={
                        "ticker": ticker.upper(),
                        "filing_date.gte": from_date,
                        "filing_date.lte": to_date,
                        "limit": 5,
                        "apiKey": self._polygon_key,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPError as exc:
                logger.warning("Polygon earnings fetch for %s failed: %s", ticker, exc)
                continue

            for item in data.get("results", []):
                events.append(
                    EarningsEvent(
                        ticker=ticker.upper(),
                        date=item.get("filing_date", item.get("start_date", "")),
                        raw=item,
                    )
                )

        return events

    # ── Public API ───────────────────────────────────────────

    async def get_upcoming_earnings(
        self,
        tickers: list[str] | None = None,
        days_ahead: int = 14,
    ) -> list[EarningsEvent]:
        """Fetch upcoming earnings events. Tries Finnhub first, falls back to Polygon."""
        tickers = tickers or []
        today = date.today()
        from_date = today.isoformat()
        to_date = (today + timedelta(days=days_ahead)).isoformat()

        events = await self._fetch_finnhub_earnings(tickers, from_date, to_date)
        if not events and tickers:
            events = await self._fetch_polygon_earnings(tickers, from_date, to_date)
        return events

    async def has_upcoming_earnings(
        self, ticker: str, within_days: int = 2
    ) -> bool:
        """Check if a ticker has earnings within the specified number of days."""
        events = await self.get_upcoming_earnings(
            tickers=[ticker], days_ahead=within_days
        )
        today = date.today()
        for event in events:
            if event.ticker.upper() == ticker.upper():
                try:
                    event_date = datetime.strptime(event.date, "%Y-%m-%d").replace(
                        tzinfo=UTC
                    ).date()
                    if today <= event_date <= today + timedelta(days=within_days):
                        return True
                except ValueError:
                    continue
        return False

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()

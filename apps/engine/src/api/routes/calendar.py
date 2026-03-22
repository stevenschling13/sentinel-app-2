"""Earnings calendar API routes."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter

from src.config import Settings
from src.data.earnings_client import EarningsClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _get_earnings_client() -> EarningsClient:
    """Create an EarningsClient using available API keys."""
    settings = Settings()
    return EarningsClient(
        finnhub_api_key=getattr(settings, "finnhub_api_key", ""),
        polygon_api_key=settings.polygon_api_key,
    )


@router.get("/earnings")
async def get_upcoming_earnings(
    tickers: str = "",
    days: int = 14,
) -> dict[str, Any]:
    """Fetch upcoming earnings events.

    Query params:
        tickers: comma-separated ticker symbols (e.g. ``AAPL,MSFT``)
        days: look-ahead window in days (default 14)
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    client = _get_earnings_client()
    try:
        events = await client.get_upcoming_earnings(tickers=ticker_list, days_ahead=days)
        return {
            "earnings": [asdict(e) for e in events],
            "count": len(events),
            "tickers": ticker_list,
            "days_ahead": days,
        }
    finally:
        await client.close()


@router.get("/earnings/{ticker}/check")
async def check_earnings(
    ticker: str,
    days: int = 2,
) -> dict[str, Any]:
    """Check whether a ticker has earnings within the specified days."""
    client = _get_earnings_client()
    try:
        has_earnings = await client.has_upcoming_earnings(
            ticker=ticker.upper(), within_days=days
        )
        return {
            "ticker": ticker.upper(),
            "has_upcoming_earnings": has_earnings,
            "within_days": days,
        }
    finally:
        await client.close()

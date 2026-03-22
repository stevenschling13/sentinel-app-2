"""News and sentiment analysis API routes."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter

from src.config import Settings
from src.data.news_client import NewsClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/news", tags=["news"])


def _get_news_client() -> NewsClient:
    """Create a NewsClient using available API keys."""
    settings = Settings()
    return NewsClient(
        polygon_api_key=settings.polygon_api_key,
        finnhub_api_key=getattr(settings, "finnhub_api_key", ""),
    )


@router.get("/latest")
async def get_latest_news(
    tickers: str = "",
    limit: int = 20,
) -> dict[str, Any]:
    """Fetch latest financial news articles.

    Query params:
        tickers: comma-separated ticker symbols (e.g. ``AAPL,MSFT``)
        limit: max articles to return (default 20)
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    client = _get_news_client()
    try:
        articles = await client.get_latest_news(tickers=ticker_list, limit=limit)
        return {
            "articles": [asdict(a) for a in articles],
            "count": len(articles),
            "tickers": ticker_list,
        }
    finally:
        await client.close()


@router.get("/sentiment/{ticker}")
async def get_ticker_sentiment(ticker: str) -> dict[str, Any]:
    """Get sentiment analysis summary for a single ticker."""
    client = _get_news_client()
    try:
        summary = await client.get_ticker_sentiment(ticker.upper())
        result = asdict(summary)
        # Trim full articles from response to keep payload small
        result["articles"] = [
            {"headline": a["headline"], "sentiment_label": a["sentiment_label"],
             "sentiment_score": a["sentiment_score"], "source": a["source"],
             "published_at": a["published_at"]}
            for a in result.get("articles", [])
        ]
        return result
    finally:
        await client.close()

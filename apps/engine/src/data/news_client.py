"""Financial news and sentiment analysis client.

Fetches news from Polygon.io (primary) and Finnhub (fallback).
Degrades gracefully when API keys are missing.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ── Keyword lists for simple headline sentiment scoring ────────

_BULLISH_KEYWORDS = frozenset({
    "beat", "beats", "surge", "surges", "rally", "rallies", "upgrade",
    "upgraded", "record", "high", "growth", "profit", "gains", "bullish",
    "outperform", "buy", "boom", "soar", "soars", "strong", "positive",
})

_BEARISH_KEYWORDS = frozenset({
    "miss", "misses", "drop", "drops", "crash", "plunge", "downgrade",
    "downgraded", "loss", "losses", "bearish", "sell", "selloff", "decline",
    "declines", "weak", "negative", "warning", "layoff", "layoffs", "cut",
})


def _score_headline(headline: str) -> tuple[float, str]:
    """Return (score, label) for a headline using keyword matching.

    Score ranges from -1.0 (very bearish) to 1.0 (very bullish).
    """
    words = set(headline.lower().split())
    bullish = len(words & _BULLISH_KEYWORDS)
    bearish = len(words & _BEARISH_KEYWORDS)

    total = bullish + bearish
    if total == 0:
        return 0.0, "neutral"

    score = (bullish - bearish) / total
    if score > 0.15:
        return round(score, 4), "bullish"
    if score < -0.15:
        return round(score, 4), "bearish"
    return round(score, 4), "neutral"


@dataclass(frozen=True)
class NewsArticle:
    """A single news article."""

    headline: str
    summary: str
    source: str
    url: str
    published_at: str
    tickers: list[str] = field(default_factory=list)
    sentiment_score: float = 0.0
    sentiment_label: str = "neutral"
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SentimentSummary:
    """Aggregated sentiment for a ticker."""

    ticker: str
    avg_sentiment: float
    article_count: int
    bullish_count: int
    bearish_count: int
    neutral_count: int
    label: str
    articles: list[NewsArticle] = field(default_factory=list)


class NewsClient:
    """Financial news client with Polygon.io (primary) and Finnhub (fallback)."""

    POLYGON_BASE = "https://api.polygon.io"
    FINNHUB_BASE = "https://finnhub.io"

    def __init__(
        self,
        polygon_api_key: str | None = None,
        finnhub_api_key: str | None = None,
    ) -> None:
        self._polygon_key = polygon_api_key or os.environ.get("POLYGON_API_KEY", "")
        self._finnhub_key = finnhub_api_key or os.environ.get("FINNHUB_API_KEY", "")
        self._http = httpx.AsyncClient(timeout=15.0)

    # ── Internal helpers ─────────────────────────────────────

    @staticmethod
    def _extract_tickers(item: dict[str, Any]) -> list[str]:
        """Extract ticker list from a Polygon news item."""
        raw = item.get("tickers", [])
        if not isinstance(raw, list) or not raw:
            return []
        if isinstance(raw[0], dict):
            return [t.get("ticker", "") for t in raw]
        return list(raw)

    async def _fetch_polygon_news(
        self, tickers: list[str], limit: int
    ) -> list[NewsArticle]:
        """Fetch news articles from Polygon.io REST API."""
        if not self._polygon_key:
            return []

        params: dict[str, Any] = {
            "apiKey": self._polygon_key,
            "limit": limit,
            "order": "desc",
            "sort": "published_utc",
        }
        if tickers:
            params["ticker"] = ",".join(t.upper() for t in tickers)

        try:
            resp = await self._http.get(
                f"{self.POLYGON_BASE}/v2/reference/news", params=params
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            logger.warning("Polygon news fetch failed: %s", exc)
            return []

        articles: list[NewsArticle] = []
        for item in data.get("results", []):
            headline = item.get("title", "")
            score, label = _score_headline(headline)
            articles.append(
                NewsArticle(
                    headline=headline,
                    summary=item.get("description", ""),
                    source=item.get("publisher", {}).get("name", "unknown"),
                    url=item.get("article_url", ""),
                    published_at=item.get("published_utc", ""),
                    tickers=self._extract_tickers(item),
                    sentiment_score=score,
                    sentiment_label=label,
                    raw=item,
                )
            )
        return articles

    async def _fetch_finnhub_news(
        self, tickers: list[str], limit: int
    ) -> list[NewsArticle]:
        """Fetch news from Finnhub as a fallback source."""
        if not self._finnhub_key:
            return []

        articles: list[NewsArticle] = []

        if tickers:
            # Finnhub company news endpoint
            for ticker in tickers[:5]:  # limit to avoid rate issues
                try:
                    today = datetime.now(tz=UTC).strftime("%Y-%m-%d")
                    resp = await self._http.get(
                        f"{self.FINNHUB_BASE}/api/v1/company-news",
                        params={
                            "symbol": ticker.upper(),
                            "from": today,
                            "to": today,
                            "token": self._finnhub_key,
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                except httpx.HTTPError as exc:
                    logger.warning("Finnhub news fetch for %s failed: %s", ticker, exc)
                    continue

                for item in (data if isinstance(data, list) else [])[:limit]:
                    headline = item.get("headline", "")
                    score, label = _score_headline(headline)
                    ts = item.get("datetime", 0)
                    published = (
                        datetime.fromtimestamp(ts, tz=UTC).isoformat()
                        if isinstance(ts, int | float)
                        else str(ts)
                    )
                    articles.append(
                        NewsArticle(
                            headline=headline,
                            summary=item.get("summary", ""),
                            source=item.get("source", "unknown"),
                            url=item.get("url", ""),
                            published_at=published,
                            tickers=[ticker.upper()],
                            sentiment_score=score,
                            sentiment_label=label,
                            raw=item,
                        )
                    )
        else:
            # General market news
            try:
                resp = await self._http.get(
                    f"{self.FINNHUB_BASE}/api/v1/news",
                    params={"category": "general", "token": self._finnhub_key},
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPError as exc:
                logger.warning("Finnhub general news fetch failed: %s", exc)
                return []

            for item in (data if isinstance(data, list) else [])[:limit]:
                headline = item.get("headline", "")
                score, label = _score_headline(headline)
                ts = item.get("datetime", 0)
                published = (
                    datetime.fromtimestamp(ts, tz=UTC).isoformat()
                    if isinstance(ts, int | float)
                    else str(ts)
                )
                articles.append(
                    NewsArticle(
                        headline=headline,
                        summary=item.get("summary", ""),
                        source=item.get("source", "unknown"),
                        url=item.get("url", ""),
                        published_at=published,
                        tickers=[],
                        sentiment_score=score,
                        sentiment_label=label,
                        raw=item,
                    )
                )

        return articles[:limit]

    # ── Public API ───────────────────────────────────────────

    async def get_latest_news(
        self, tickers: list[str] | None = None, limit: int = 20
    ) -> list[NewsArticle]:
        """Fetch latest financial news.  Tries Polygon first, falls back to Finnhub."""
        tickers = tickers or []
        articles = await self._fetch_polygon_news(tickers, limit)
        if not articles:
            articles = await self._fetch_finnhub_news(tickers, limit)
        return articles[:limit]

    async def get_ticker_sentiment(self, ticker: str) -> SentimentSummary:
        """Return aggregated sentiment analysis for a single ticker."""
        articles = await self.get_latest_news(tickers=[ticker], limit=50)

        if not articles:
            return SentimentSummary(
                ticker=ticker.upper(),
                avg_sentiment=0.0,
                article_count=0,
                bullish_count=0,
                bearish_count=0,
                neutral_count=0,
                label="neutral",
            )

        bullish = sum(1 for a in articles if a.sentiment_label == "bullish")
        bearish = sum(1 for a in articles if a.sentiment_label == "bearish")
        neutral = sum(1 for a in articles if a.sentiment_label == "neutral")
        avg = sum(a.sentiment_score for a in articles) / len(articles)

        if avg > 0.1:
            overall = "bullish"
        elif avg < -0.1:
            overall = "bearish"
        else:
            overall = "neutral"

        return SentimentSummary(
            ticker=ticker.upper(),
            avg_sentiment=round(avg, 4),
            article_count=len(articles),
            bullish_count=bullish,
            bearish_count=bearish,
            neutral_count=neutral,
            label=overall,
            articles=articles[:10],
        )

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()

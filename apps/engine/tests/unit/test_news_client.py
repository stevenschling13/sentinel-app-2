"""Tests for the financial news and sentiment client."""

import httpx
import respx

from src.data.news_client import (
    NewsClient,
    SentimentSummary,
    _score_headline,
)


class TestScoreHeadline:
    def test_bullish_headline(self):
        score, label = _score_headline("AAPL beats earnings with record profit")
        assert score > 0
        assert label == "bullish"

    def test_bearish_headline(self):
        score, label = _score_headline("AAPL misses estimates losses mount")
        assert score < 0
        assert label == "bearish"

    def test_neutral_headline(self):
        score, label = _score_headline("AAPL announces new product launch date")
        assert score == 0.0
        assert label == "neutral"

    def test_mixed_headline(self):
        score, label = _score_headline("gains and losses balanced evenly today")
        assert isinstance(score, float)
        assert label in ("bullish", "bearish", "neutral")

    def test_empty_headline(self):
        score, label = _score_headline("")
        assert score == 0.0
        assert label == "neutral"


class TestNewsClientPolygon:
    @respx.mock
    async def test_fetch_polygon_news(self):
        respx.get("https://api.polygon.io/v2/reference/news").mock(
            return_value=httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "title": "AAPL surges on strong earnings",
                            "description": "Apple beat expectations.",
                            "publisher": {"name": "MarketWatch"},
                            "article_url": "https://example.com/1",
                            "published_utc": "2024-07-25T12:00:00Z",
                            "tickers": ["AAPL"],
                        }
                    ]
                },
            )
        )
        client = NewsClient(polygon_api_key="pk")
        try:
            articles = await client.get_latest_news(tickers=["AAPL"], limit=10)
            assert len(articles) == 1
            assert articles[0].headline == "AAPL surges on strong earnings"
            assert articles[0].source == "MarketWatch"
            assert articles[0].sentiment_label == "bullish"
        finally:
            await client.close()

    @respx.mock
    async def test_polygon_error_falls_back_to_finnhub(self):
        respx.get("https://api.polygon.io/v2/reference/news").mock(
            return_value=httpx.Response(500)
        )
        respx.get("https://finnhub.io/api/v1/company-news").mock(
            return_value=httpx.Response(
                200,
                json=[
                    {
                        "headline": "MSFT drops on weak guidance",
                        "summary": "Microsoft warned.",
                        "source": "Reuters",
                        "url": "https://example.com/2",
                        "datetime": 1721900000,
                    }
                ],
            )
        )
        client = NewsClient(polygon_api_key="pk", finnhub_api_key="fk")
        try:
            articles = await client.get_latest_news(tickers=["MSFT"], limit=5)
            assert len(articles) == 1
            assert articles[0].sentiment_label == "bearish"
        finally:
            await client.close()

    async def test_no_api_keys_returns_empty(self):
        client = NewsClient(polygon_api_key="", finnhub_api_key="")
        try:
            articles = await client.get_latest_news(tickers=["AAPL"])
            assert articles == []
        finally:
            await client.close()


class TestNewsClientFinnhub:
    @respx.mock
    async def test_general_market_news(self):
        respx.get("https://api.polygon.io/v2/reference/news").mock(
            return_value=httpx.Response(200, json={"results": []})
        )
        respx.get("https://finnhub.io/api/v1/news").mock(
            return_value=httpx.Response(
                200,
                json=[
                    {
                        "headline": "Markets rally on positive data",
                        "summary": "Broad gains.",
                        "source": "Bloomberg",
                        "url": "https://example.com/3",
                        "datetime": 1721900000,
                    }
                ],
            )
        )
        client = NewsClient(polygon_api_key="", finnhub_api_key="fk")
        try:
            articles = await client.get_latest_news(limit=10)
            assert len(articles) == 1
            assert articles[0].tickers == []
        finally:
            await client.close()


class TestTickerSentiment:
    @respx.mock
    async def test_sentiment_summary_bullish(self):
        respx.get("https://api.polygon.io/v2/reference/news").mock(
            return_value=httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "title": "AAPL beats expectations",
                            "description": "",
                            "publisher": {"name": "MW"},
                            "article_url": "",
                            "published_utc": "2024-01-01T00:00:00Z",
                            "tickers": ["AAPL"],
                        },
                        {
                            "title": "AAPL surges to record high",
                            "description": "",
                            "publisher": {"name": "MW"},
                            "article_url": "",
                            "published_utc": "2024-01-01T00:00:00Z",
                            "tickers": ["AAPL"],
                        },
                    ]
                },
            )
        )
        client = NewsClient(polygon_api_key="pk")
        try:
            summary = await client.get_ticker_sentiment("AAPL")
            assert isinstance(summary, SentimentSummary)
            assert summary.ticker == "AAPL"
            assert summary.article_count == 2
            assert summary.bullish_count >= 1
        finally:
            await client.close()

    async def test_sentiment_no_articles(self):
        client = NewsClient(polygon_api_key="", finnhub_api_key="")
        try:
            summary = await client.get_ticker_sentiment("XYZ")
            assert summary.article_count == 0
            assert summary.label == "neutral"
        finally:
            await client.close()


class TestExtractTickers:
    def test_simple_list(self):
        item = {"tickers": ["AAPL", "MSFT"]}
        assert NewsClient._extract_tickers(item) == ["AAPL", "MSFT"]

    def test_dict_list(self):
        item = {"tickers": [{"ticker": "GOOGL"}]}
        assert NewsClient._extract_tickers(item) == ["GOOGL"]

    def test_empty(self):
        assert NewsClient._extract_tickers({}) == []
        assert NewsClient._extract_tickers({"tickers": []}) == []

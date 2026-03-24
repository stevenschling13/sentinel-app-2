"""Tests for the news and sentiment API routes."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.main import _settings, app
from src.data.news_client import NewsArticle, SentimentSummary


def _make_article(**overrides):
    defaults = dict(
        headline="AAPL beats earnings",
        summary="Apple reported strong Q3 results.",
        source="MarketWatch",
        url="https://example.com/article",
        published_at="2024-07-25T16:00:00Z",
        tickers=["AAPL"],
        sentiment_score=0.5,
        sentiment_label="bullish",
    )
    defaults.update(overrides)
    return NewsArticle(**defaults)


class TestGetLatestNews:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.news._get_news_client")
    def test_latest_news_default(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.get_latest_news.return_value = [_make_article()]
        mock_factory.return_value = mock_client

        resp = self.client.get("/api/v1/news/latest")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["articles"][0]["headline"] == "AAPL beats earnings"
        assert data["tickers"] == []
        mock_client.close.assert_awaited_once()

    @patch("src.api.routes.news._get_news_client")
    def test_latest_news_with_tickers(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.get_latest_news.return_value = []
        mock_factory.return_value = mock_client

        resp = self.client.get("/api/v1/news/latest?tickers=MSFT,GOOGL&limit=5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tickers"] == ["MSFT", "GOOGL"]
        mock_client.get_latest_news.assert_awaited_once_with(
            tickers=["MSFT", "GOOGL"], limit=5
        )

    @patch("src.api.routes.news._get_news_client")
    def test_latest_news_client_closed_on_error(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.get_latest_news.side_effect = RuntimeError("boom")
        mock_factory.return_value = mock_client

        with pytest.raises(RuntimeError, match="boom"):
            self.client.get("/api/v1/news/latest")
        mock_client.close.assert_awaited_once()


class TestGetTickerSentiment:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.news._get_news_client")
    def test_sentiment_returns_summary(self, mock_factory):
        mock_client = AsyncMock()
        articles = [
            _make_article(headline="Strong gains", sentiment_score=0.8, sentiment_label="bullish"),
        ]
        mock_client.get_ticker_sentiment.return_value = SentimentSummary(
            ticker="AAPL",
            avg_sentiment=0.5,
            article_count=1,
            bullish_count=1,
            bearish_count=0,
            neutral_count=0,
            label="bullish",
            articles=articles,
        )
        mock_factory.return_value = mock_client

        resp = self.client.get("/api/v1/news/sentiment/aapl")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ticker"] == "AAPL"
        assert data["label"] == "bullish"
        assert data["article_count"] == 1
        # Verify trimmed article keys
        art = data["articles"][0]
        assert set(art.keys()) == {
            "headline", "sentiment_label", "sentiment_score", "source", "published_at"
        }

    @patch("src.api.routes.news._get_news_client")
    def test_sentiment_neutral(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.get_ticker_sentiment.return_value = SentimentSummary(
            ticker="XYZ",
            avg_sentiment=0.0,
            article_count=0,
            bullish_count=0,
            bearish_count=0,
            neutral_count=0,
            label="neutral",
        )
        mock_factory.return_value = mock_client

        resp = self.client.get("/api/v1/news/sentiment/XYZ")
        assert resp.status_code == 200
        data = resp.json()
        assert data["label"] == "neutral"
        assert data["articles"] == []
        mock_client.close.assert_awaited_once()

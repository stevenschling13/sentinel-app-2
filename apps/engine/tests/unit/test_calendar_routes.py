"""Tests for the earnings calendar API routes."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.main import _settings, app
from src.data.earnings_client import EarningsEvent


class TestGetUpcomingEarnings:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.calendar._get_earnings_client")
    def test_earnings_no_tickers(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.get_upcoming_earnings.return_value = [
            EarningsEvent(ticker="AAPL", date="2024-07-25", hour="amc"),
        ]
        mock_factory.return_value = mock_client

        resp = self.client.get("/api/v1/calendar/earnings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["earnings"][0]["ticker"] == "AAPL"
        assert data["tickers"] == []
        assert data["days_ahead"] == 14
        mock_client.close.assert_awaited_once()

    @patch("src.api.routes.calendar._get_earnings_client")
    def test_earnings_with_tickers(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.get_upcoming_earnings.return_value = [
            EarningsEvent(ticker="MSFT", date="2024-07-23"),
        ]
        mock_factory.return_value = mock_client

        resp = self.client.get("/api/v1/calendar/earnings?tickers=MSFT,AAPL&days=7")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tickers"] == ["MSFT", "AAPL"]
        assert data["days_ahead"] == 7
        mock_client.get_upcoming_earnings.assert_awaited_once_with(
            tickers=["MSFT", "AAPL"], days_ahead=7
        )

    @patch("src.api.routes.calendar._get_earnings_client")
    def test_earnings_empty_result(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.get_upcoming_earnings.return_value = []
        mock_factory.return_value = mock_client

        resp = self.client.get("/api/v1/calendar/earnings?tickers=XYZ")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["earnings"] == []

    @patch("src.api.routes.calendar._get_earnings_client")
    def test_earnings_client_closed_on_error(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.get_upcoming_earnings.side_effect = RuntimeError("API error")
        mock_factory.return_value = mock_client

        # The route doesn't catch the error, so TestClient propagates it
        with pytest.raises(RuntimeError, match="API error"):
            self.client.get("/api/v1/calendar/earnings", params={"tickers": ""})
        mock_client.close.assert_awaited_once()


class TestCheckEarnings:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.calendar._get_earnings_client")
    def test_check_earnings_true(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.has_upcoming_earnings.return_value = True
        mock_factory.return_value = mock_client

        resp = self.client.get("/api/v1/calendar/earnings/aapl/check")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ticker"] == "AAPL"
        assert data["has_upcoming_earnings"] is True
        assert data["within_days"] == 2

    @patch("src.api.routes.calendar._get_earnings_client")
    def test_check_earnings_false(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.has_upcoming_earnings.return_value = False
        mock_factory.return_value = mock_client

        resp = self.client.get("/api/v1/calendar/earnings/TSLA/check?days=5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_upcoming_earnings"] is False
        assert data["within_days"] == 5

    @patch("src.api.routes.calendar._get_earnings_client")
    def test_check_earnings_client_closed(self, mock_factory):
        mock_client = AsyncMock()
        mock_client.has_upcoming_earnings.return_value = False
        mock_factory.return_value = mock_client

        self.client.get("/api/v1/calendar/earnings/AAPL/check")
        mock_client.close.assert_awaited_once()

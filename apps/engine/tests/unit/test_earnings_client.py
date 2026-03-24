"""Tests for the earnings calendar client."""

import httpx
import respx

from src.data.earnings_client import EarningsClient


class TestEarningsClientFinnhub:
    @respx.mock
    async def test_fetch_finnhub_by_ticker(self):
        respx.get("https://finnhub.io/api/v1/calendar/earnings").mock(
            return_value=httpx.Response(
                200,
                json={
                    "earningsCalendar": [
                        {
                            "symbol": "AAPL",
                            "date": "2024-07-25",
                            "epsEstimate": 1.35,
                            "epsActual": None,
                            "hour": "amc",
                        }
                    ]
                },
            )
        )
        client = EarningsClient(finnhub_api_key="test-key")
        try:
            events = await client.get_upcoming_earnings(tickers=["AAPL"], days_ahead=14)
            assert len(events) == 1
            assert events[0].ticker == "AAPL"
            assert events[0].hour == "amc"
            assert events[0].eps_estimate == 1.35
        finally:
            await client.close()

    @respx.mock
    async def test_fetch_finnhub_no_tickers(self):
        respx.get("https://finnhub.io/api/v1/calendar/earnings").mock(
            return_value=httpx.Response(
                200,
                json={
                    "earningsCalendar": [
                        {"symbol": "MSFT", "date": "2024-07-23", "hour": "bmo"},
                        {"symbol": "GOOGL", "date": "2024-07-24", "hour": "unknown"},
                    ]
                },
            )
        )
        client = EarningsClient(finnhub_api_key="test-key")
        try:
            events = await client.get_upcoming_earnings(tickers=[], days_ahead=14)
            assert len(events) == 2
        finally:
            await client.close()

    @respx.mock
    async def test_finnhub_api_error_returns_empty(self):
        respx.get("https://finnhub.io/api/v1/calendar/earnings").mock(
            return_value=httpx.Response(500)
        )
        client = EarningsClient(finnhub_api_key="test-key")
        try:
            events = await client.get_upcoming_earnings(tickers=[], days_ahead=14)
            assert events == []
        finally:
            await client.close()

    async def test_no_api_key_returns_empty(self):
        client = EarningsClient(finnhub_api_key="", polygon_api_key="")
        try:
            events = await client.get_upcoming_earnings(tickers=["AAPL"])
            assert events == []
        finally:
            await client.close()


class TestEarningsClientPolygonFallback:
    @respx.mock
    async def test_falls_back_to_polygon(self):
        # Finnhub returns nothing, Polygon has results
        respx.get("https://finnhub.io/api/v1/calendar/earnings").mock(
            return_value=httpx.Response(200, json={"earningsCalendar": []})
        )
        respx.get("https://api.polygon.io/vX/reference/financials").mock(
            return_value=httpx.Response(
                200,
                json={
                    "results": [
                        {"filing_date": "2024-07-25", "ticker": "NVDA"}
                    ]
                },
            )
        )
        client = EarningsClient(finnhub_api_key="fk", polygon_api_key="pk")
        try:
            events = await client.get_upcoming_earnings(tickers=["NVDA"], days_ahead=14)
            assert len(events) == 1
            assert events[0].ticker == "NVDA"
        finally:
            await client.close()


class TestParseFinnhubEvent:
    def test_parse_standard_event(self):
        item = {
            "symbol": "AAPL",
            "date": "2024-07-25",
            "epsEstimate": 1.35,
            "epsActual": 1.40,
            "revenueEstimate": 85000000000,
            "revenueActual": 86000000000,
            "hour": "amc",
        }
        event = EarningsClient._parse_finnhub_event(item)
        assert event.ticker == "AAPL"
        assert event.eps_estimate == 1.35
        assert event.eps_actual == 1.40
        assert event.hour == "amc"

    def test_parse_unknown_hour(self):
        item = {"symbol": "X", "date": "2024-01-01", "hour": "weird"}
        event = EarningsClient._parse_finnhub_event(item)
        assert event.hour == "unknown"

    def test_parse_missing_fields(self):
        item = {"symbol": "Y", "date": "2024-01-01"}
        event = EarningsClient._parse_finnhub_event(item)
        assert event.eps_estimate is None
        assert event.hour == "unknown"


class TestHasUpcomingEarnings:
    @respx.mock
    async def test_has_earnings_true(self):
        from datetime import date, timedelta

        today = date.today()
        tomorrow = today + timedelta(days=1)
        respx.get("https://finnhub.io/api/v1/calendar/earnings").mock(
            return_value=httpx.Response(
                200,
                json={
                    "earningsCalendar": [
                        {"symbol": "AAPL", "date": tomorrow.isoformat(), "hour": "bmo"}
                    ]
                },
            )
        )
        client = EarningsClient(finnhub_api_key="key")
        try:
            result = await client.has_upcoming_earnings("AAPL", within_days=2)
            assert result is True
        finally:
            await client.close()

    @respx.mock
    async def test_has_earnings_false_no_events(self):
        respx.get("https://finnhub.io/api/v1/calendar/earnings").mock(
            return_value=httpx.Response(200, json={"earningsCalendar": []})
        )
        client = EarningsClient(finnhub_api_key="key")
        try:
            result = await client.has_upcoming_earnings("AAPL", within_days=2)
            assert result is False
        finally:
            await client.close()

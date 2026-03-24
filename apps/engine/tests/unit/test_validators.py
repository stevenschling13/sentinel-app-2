"""Tests for request validation models."""

import pytest
from pydantic import ValidationError

from src.api.validators import (
    GetBarsRequest,
    GetQuotesRequest,
    IngestRequestValidated,
    ListResponse,
    PaginationParams,
    ScanRequestValidated,
)


class TestGetBarsRequest:
    def test_valid_request(self):
        req = GetBarsRequest(ticker="AAPL")
        assert req.ticker == "AAPL"
        assert req.timeframe == "1d"
        assert req.days == 90

    def test_all_timeframes(self):
        for tf in ("1m", "5m", "15m", "1h", "1d"):
            req = GetBarsRequest(ticker="SPY", timeframe=tf)
            assert req.timeframe == tf

    def test_invalid_timeframe_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AAPL", timeframe="2h")

    def test_empty_ticker_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="")

    def test_lowercase_ticker_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="aapl")

    def test_ticker_too_long(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="A" * 11)

    def test_special_chars_in_ticker_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AA$L")

    def test_days_min_boundary(self):
        req = GetBarsRequest(ticker="AAPL", days=1)
        assert req.days == 1

    def test_days_max_boundary(self):
        req = GetBarsRequest(ticker="AAPL", days=365)
        assert req.days == 365

    def test_days_below_min_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AAPL", days=0)

    def test_days_above_max_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AAPL", days=366)


class TestGetQuotesRequest:
    def test_default_tickers(self):
        req = GetQuotesRequest()
        assert "AAPL" in req.tickers

    def test_custom_tickers(self):
        req = GetQuotesRequest(tickers="TSLA,NVDA")
        assert req.tickers == "TSLA,NVDA"

    def test_empty_tickers_rejected(self):
        with pytest.raises(ValidationError):
            GetQuotesRequest(tickers="")

    def test_too_many_tickers_rejected(self):
        tickers = ",".join([f"T{i:03d}" for i in range(101)])
        with pytest.raises(ValidationError):
            GetQuotesRequest(tickers=tickers)

    def test_invalid_ticker_format_rejected(self):
        with pytest.raises(ValidationError):
            GetQuotesRequest(tickers="AAPL,$INVALID")


class TestIngestRequestValidated:
    def test_valid_request(self):
        req = IngestRequestValidated(tickers=["AAPL", "MSFT"])
        assert req.tickers == ["AAPL", "MSFT"]
        assert req.timeframe == "1d"

    def test_empty_tickers_rejected(self):
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=[])

    def test_too_many_tickers_rejected(self):
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=[f"T{i}" for i in range(51)])

    def test_tickers_uppercased(self):
        req = IngestRequestValidated(tickers=["aapl", "msft"])
        assert req.tickers == ["AAPL", "MSFT"]

    def test_invalid_ticker_format(self):
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=["$INVALID"])

    def test_ticker_too_long(self):
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=["A" * 11])


class TestScanRequestValidated:
    def test_valid_request(self):
        req = ScanRequestValidated(tickers=["AAPL"])
        assert req.tickers == ["AAPL"]
        assert req.days == 90
        assert req.min_strength == 0.3
        assert req.use_composite is False

    def test_tickers_uppercased(self):
        req = ScanRequestValidated(tickers=["aapl", "msft"])
        assert req.tickers == ["AAPL", "MSFT"]

    def test_empty_tickers_rejected(self):
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=[])

    def test_too_many_tickers(self):
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=[f"T{i}" for i in range(21)])

    def test_min_strength_boundaries(self):
        req = ScanRequestValidated(tickers=["A"], min_strength=0.0)
        assert req.min_strength == 0.0
        req = ScanRequestValidated(tickers=["A"], min_strength=1.0)
        assert req.min_strength == 1.0

    def test_min_strength_out_of_range(self):
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["A"], min_strength=1.5)
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["A"], min_strength=-0.1)

    def test_days_boundaries(self):
        req = ScanRequestValidated(tickers=["A"], days=30)
        assert req.days == 30
        req = ScanRequestValidated(tickers=["A"], days=365)
        assert req.days == 365

    def test_days_out_of_range(self):
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["A"], days=29)
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["A"], days=366)


class TestPaginationParams:
    def test_defaults(self):
        p = PaginationParams()
        assert p.offset == 0
        assert p.limit == 100

    def test_custom_values(self):
        p = PaginationParams(offset=50, limit=25)
        assert p.offset == 50
        assert p.limit == 25

    def test_negative_offset_rejected(self):
        with pytest.raises(ValidationError):
            PaginationParams(offset=-1)

    def test_limit_too_high(self):
        with pytest.raises(ValidationError):
            PaginationParams(limit=1001)

    def test_limit_zero_rejected(self):
        with pytest.raises(ValidationError):
            PaginationParams(limit=0)


class TestListResponse:
    def test_basic_response(self):
        resp = ListResponse[str](
            data=["a", "b", "c"],
            offset=0,
            limit=10,
            total=3,
            has_more=False,
        )
        assert resp.data == ["a", "b", "c"]
        assert resp.has_more is False

    def test_has_more_true(self):
        resp = ListResponse[int](
            data=[1, 2],
            offset=0,
            limit=2,
            total=10,
            has_more=True,
        )
        assert resp.has_more is True
        assert resp.total == 10

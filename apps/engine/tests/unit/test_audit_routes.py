"""Tests for the audit trail API routes."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.api.main import _settings, app


class TestGetTradeAudit:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.audit.get_db")
    def test_trade_audit_returns_trades(self, mock_get_db):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.in_.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.execute.return_value = MagicMock(
            data=[
                {"id": 1, "event_type": "order", "ticker": "AAPL", "created_at": "2024-01-01"},
                {"id": 2, "event_type": "fill", "ticker": "AAPL", "created_at": "2024-01-01"},
            ]
        )
        mock_db.table.return_value = mock_query
        mock_get_db.return_value = mock_db

        resp = self.client.get("/api/v1/audit/trades")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["trades"]) == 2
        assert data["trades"][0]["event_type"] == "order"

    @patch("src.api.routes.audit.get_db")
    def test_trade_audit_with_ticker_filter(self, mock_get_db):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.in_.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[{"ticker": "MSFT"}])
        mock_db.table.return_value = mock_query
        mock_get_db.return_value = mock_db

        resp = self.client.get("/api/v1/audit/trades?ticker=MSFT")
        assert resp.status_code == 200
        mock_query.eq.assert_called_once_with("ticker", "MSFT")

    @patch("src.api.routes.audit.get_db")
    def test_trade_audit_custom_limit(self, mock_get_db):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.in_.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[])
        mock_db.table.return_value = mock_query
        mock_get_db.return_value = mock_db

        resp = self.client.get("/api/v1/audit/trades?limit=10")
        assert resp.status_code == 200
        mock_query.limit.assert_called_with(10)

    @patch("src.api.routes.audit.get_db")
    def test_trade_audit_db_not_configured(self, mock_get_db):
        mock_get_db.return_value = None
        resp = self.client.get("/api/v1/audit/trades")
        assert resp.status_code == 200
        data = resp.json()
        assert data["trades"] == []
        assert "not configured" in data["message"]

    def test_trade_audit_limit_exceeds_max(self):
        resp = self.client.get("/api/v1/audit/trades?limit=300")
        assert resp.status_code == 422


class TestGetDecisionLog:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.audit.get_db")
    def test_decision_log_returns_decisions(self, mock_get_db):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.in_.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.execute.return_value = MagicMock(
            data=[{"event_type": "signal", "agent_role": "analyst"}]
        )
        mock_db.table.return_value = mock_query
        mock_get_db.return_value = mock_db

        resp = self.client.get("/api/v1/audit/decisions")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["decisions"]) == 1

    @patch("src.api.routes.audit.get_db")
    def test_decision_log_filter_by_agent_role(self, mock_get_db):
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.in_.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[])
        mock_db.table.return_value = mock_query
        mock_get_db.return_value = mock_db

        resp = self.client.get("/api/v1/audit/decisions?agent_role=risk_manager")
        assert resp.status_code == 200
        mock_query.eq.assert_called_once_with("agent_role", "risk_manager")

    @patch("src.api.routes.audit.get_db")
    def test_decision_log_db_not_configured(self, mock_get_db):
        mock_get_db.return_value = None
        resp = self.client.get("/api/v1/audit/decisions")
        assert resp.status_code == 200
        data = resp.json()
        assert data["decisions"] == []
        assert "not configured" in data["message"]

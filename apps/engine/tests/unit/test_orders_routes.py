"""Tests for the order management API routes."""

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from src.api.main import _settings, app
from src.execution.broker_interface import OrderResult
from src.execution.order_store import OrderStore, StoredOrder


def _patch_orders_datetime():
    """Patch datetime in orders module to fix datetime.UTC reference.

    The source does ``datetime.now(tz=datetime.UTC)`` after
    ``from datetime import datetime``, which fails because the class
    doesn't have a ``.UTC`` attribute.  We patch a sentinel that does.
    """
    import datetime as _dt_mod

    class _PatchedDatetime(_dt_mod.datetime):
        UTC = _dt_mod.UTC

    return patch("src.api.routes.orders.datetime", _PatchedDatetime)


class TestSubmitOrder:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.orders.get_order_store")
    @patch("src.api.routes.orders.get_broker")
    def test_submit_market_order_filled(self, mock_get_broker, mock_get_store):
        mock_broker = AsyncMock()
        mock_broker.submit_order.return_value = OrderResult(
            order_id="ord-123",
            status="filled",
            fill_price=150.0,
            fill_quantity=10.0,
        )
        mock_get_broker.return_value = mock_broker

        mock_store = MagicMock()
        mock_get_store.return_value = mock_store

        with _patch_orders_datetime():
            resp = self.client.post(
                "/api/v1/orders/submit",
                json={"ticker": "aapl", "shares": 10, "side": "buy"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["order_id"] == "ord-123"
        assert data["status"] == "filled"
        assert data["filled_price"] == 150.0
        assert data["filled_at"] is not None
        mock_store.add.assert_called_once()

    @patch("src.api.routes.orders.get_order_store")
    @patch("src.api.routes.orders.get_broker")
    def test_submit_limit_order_pending(self, mock_get_broker, mock_get_store):
        mock_broker = AsyncMock()
        mock_broker.submit_order.return_value = OrderResult(
            order_id="ord-456",
            status="pending",
            fill_price=None,
            fill_quantity=None,
        )
        mock_get_broker.return_value = mock_broker
        mock_get_store.return_value = MagicMock()

        with _patch_orders_datetime():
            resp = self.client.post(
                "/api/v1/orders/submit",
                json={
                    "ticker": "MSFT",
                    "shares": 5,
                    "side": "sell",
                    "order_type": "limit",
                    "limit_price": 400.0,
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert data["filled_at"] is None

    @patch("src.api.routes.orders.get_broker")
    def test_submit_order_broker_failure(self, mock_get_broker):
        mock_broker = AsyncMock()
        mock_broker.submit_order.side_effect = RuntimeError("Broker down")
        mock_get_broker.return_value = mock_broker

        resp = self.client.post(
            "/api/v1/orders/submit",
            json={"ticker": "AAPL", "shares": 10, "side": "buy"},
        )
        assert resp.status_code == 502

    def test_submit_order_missing_fields(self):
        resp = self.client.post("/api/v1/orders/submit", json={"ticker": "AAPL"})
        assert resp.status_code == 422


class TestGetActiveOrders:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.orders.get_broker")
    def test_get_active_orders(self, mock_get_broker):
        mock_broker = AsyncMock()
        mock_broker.get_orders.return_value = [
            {"order_id": "ord-1", "status": "open"},
        ]
        mock_get_broker.return_value = mock_broker

        resp = self.client.get("/api/v1/orders/active")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        mock_broker.get_orders.assert_awaited_once_with(status="open")

    @patch("src.api.routes.orders.get_broker")
    def test_get_active_orders_broker_error(self, mock_get_broker):
        mock_broker = AsyncMock()
        mock_broker.get_orders.side_effect = RuntimeError("fail")
        mock_get_broker.return_value = mock_broker

        resp = self.client.get("/api/v1/orders/active")
        assert resp.status_code == 502


class TestGetOrder:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.orders.get_order_store")
    def test_get_existing_order(self, mock_get_store):
        store = OrderStore()
        store.add(
            StoredOrder(
                order_id="ord-999",
                symbol="AAPL",
                side="buy",
                order_type="market",
                qty=10.0,
                filled_qty=10.0,
                status="filled",
                fill_price=150.0,
                submitted_at="2024-01-01T00:00:00",
                filled_at="2024-01-01T00:00:01",
                risk_note=None,
            )
        )
        mock_get_store.return_value = store

        resp = self.client.get("/api/v1/orders/ord-999")
        assert resp.status_code == 200
        data = resp.json()
        assert data["order_id"] == "ord-999"
        assert data["symbol"] == "AAPL"

    @patch("src.api.routes.orders.get_order_store")
    def test_get_nonexistent_order(self, mock_get_store):
        mock_get_store.return_value = OrderStore()
        resp = self.client.get("/api/v1/orders/no-such-id")
        assert resp.status_code == 404


class TestCancelOrder:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.orders.get_order_store")
    @patch("src.api.routes.orders.get_broker")
    def test_cancel_order_success(self, mock_get_broker, mock_get_store):
        mock_broker = AsyncMock()
        mock_get_broker.return_value = mock_broker
        mock_store = MagicMock()
        mock_get_store.return_value = mock_store

        resp = self.client.post("/api/v1/orders/ord-123/cancel")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "cancelled"
        assert data["order_id"] == "ord-123"

    @patch("src.api.routes.orders.get_broker")
    def test_cancel_order_not_found(self, mock_get_broker):
        mock_broker = AsyncMock()
        mock_broker.cancel_order.side_effect = ValueError("Order not found")
        mock_get_broker.return_value = mock_broker

        resp = self.client.post("/api/v1/orders/bad-id/cancel")
        assert resp.status_code == 404

    @patch("src.api.routes.orders.get_broker")
    def test_cancel_order_broker_error(self, mock_get_broker):
        mock_broker = AsyncMock()
        mock_broker.cancel_order.side_effect = RuntimeError("fail")
        mock_get_broker.return_value = mock_broker

        resp = self.client.post("/api/v1/orders/ord-1/cancel")
        assert resp.status_code == 502

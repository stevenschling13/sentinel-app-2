"""Order management API routes.

Endpoints for submitting, tracking, and cancelling orders.
Supports both live broker execution and paper trading simulation.
"""

from __future__ import annotations

import dataclasses
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.execution import get_broker
from src.execution.broker_interface import OrderRequest
from src.execution.order_store import StoredOrder, get_order_store

router = APIRouter(prefix="/orders", tags=["orders"])
_logger = logging.getLogger(__name__)


# ── Request / Response models ────────────────────────────────


class SubmitOrderBody(BaseModel):
    """Body for order submission."""

    ticker: str
    shares: int
    side: str
    order_type: str = "market"
    limit_price: float | None = None


class SubmitOrderResponse(BaseModel):
    """Response after order submission."""

    order_id: str
    status: str
    filled_price: float | None = None
    filled_at: str | None = None


# ── Endpoints ────────────────────────────────────────────────


@router.post("/submit", response_model=SubmitOrderResponse)
async def submit_order(body: SubmitOrderBody) -> SubmitOrderResponse:
    """Submit a new order via the configured broker."""
    try:
        broker = get_broker()
        request = OrderRequest(
            instrument_id=body.ticker.upper(),
            side=body.side,
            order_type=body.order_type,
            quantity=float(body.shares),
            limit_price=body.limit_price,
        )
        result = await broker.submit_order(request)
        now = datetime.now(tz=datetime.UTC).isoformat()

        store = get_order_store()
        store.add(
            StoredOrder(
                order_id=result.order_id,
                symbol=body.ticker.upper(),
                side=body.side,
                order_type=body.order_type,
                qty=float(body.shares),
                filled_qty=result.fill_quantity or 0.0,
                status=result.status,
                fill_price=result.fill_price,
                submitted_at=now,
                filled_at=now if result.status == "filled" else None,
                risk_note=None,
            )
        )

        return SubmitOrderResponse(
            order_id=result.order_id,
            status=result.status,
            filled_price=result.fill_price,
            filled_at=now if result.status == "filled" else None,
        )
    except HTTPException:
        raise
    except Exception as exc:
        _logger.error("Order submission failed: %s", exc)
        raise HTTPException(status_code=502, detail="Order submission failed") from exc


@router.get("/active")
async def get_active_orders() -> list[dict]:
    """List active (non-terminal) open orders."""
    try:
        broker = get_broker()
        return await broker.get_orders(status="open")
    except Exception as exc:
        _logger.error("Failed to fetch active orders: %s", exc)
        raise HTTPException(
            status_code=502, detail="Failed to fetch active orders"
        ) from exc


@router.get("/{order_id}")
async def get_order(order_id: str) -> dict:
    """Get details for a single order by ID."""
    store = get_order_store()
    order = store.get(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order not found: {order_id}")
    return dataclasses.asdict(order)


@router.post("/{order_id}/cancel")
async def cancel_order(order_id: str) -> dict:
    """Cancel an open order."""
    try:
        broker = get_broker()
        await broker.cancel_order(order_id)
        store = get_order_store()
        store.update(order_id, status="cancelled")
        return {"status": "cancelled", "order_id": order_id}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        _logger.error("Failed to cancel order: %s", exc)
        raise HTTPException(
            status_code=502, detail="Failed to cancel order"
        ) from exc

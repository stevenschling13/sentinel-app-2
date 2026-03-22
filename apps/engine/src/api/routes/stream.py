"""Server-Sent Events endpoint for real-time price streaming."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stream", tags=["stream"])

HEARTBEAT_INTERVAL = 15  # seconds


def _serialize(obj: Any) -> Any:
    """JSON serializer that handles datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


async def _price_event_generator(
    request: Request,
) -> AsyncGenerator[str, None]:
    """Yield SSE events from the PriceCache subscription."""
    price_cache = request.app.state.price_cache
    queue: asyncio.Queue[tuple[str, dict[str, Any]]] = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def _on_update(ticker: str, entry: dict[str, Any]) -> None:
        """Sync callback invoked from PriceCache thread — enqueue for async."""
        loop.call_soon_threadsafe(queue.put_nowait, (ticker, entry))

    # Send initial snapshot of all cached prices
    snapshot = price_cache.get_all()
    if snapshot:
        payload = json.dumps(
            {"type": "snapshot", "data": snapshot}, default=_serialize
        )
        yield f"data: {payload}\n\n"

    # Subscribe to live updates
    price_cache.subscribe(_on_update)
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                ticker, entry = await asyncio.wait_for(
                    queue.get(), timeout=HEARTBEAT_INTERVAL
                )
                payload = json.dumps(
                    {"type": "update", "ticker": ticker, "data": entry},
                    default=_serialize,
                )
                yield f"data: {payload}\n\n"
            except TimeoutError:
                # No update within heartbeat window — send keepalive comment
                yield ":\n\n"
    finally:
        price_cache.unsubscribe(_on_update)
        _logger.debug("SSE client disconnected, unsubscribed from price cache")


@router.get("/prices")
async def stream_prices(request: Request) -> StreamingResponse:
    """Stream live price updates via Server-Sent Events."""
    return StreamingResponse(
        _price_event_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

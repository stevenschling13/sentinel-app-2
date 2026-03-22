"""Request tracing middleware using contextvars for correlation IDs."""

import uuid
from contextvars import ContextVar

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

request_id_context: ContextVar[str] = ContextVar("request_id", default="")


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """Attach a unique request ID to each incoming request via contextvars."""

    async def dispatch(self, request: Request, call_next):
        """Set request ID from header or generate a new UUID."""
        rid = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        token = request_id_context.set(rid)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            request_id_context.reset(token)

"""Audit trail logging service for compliance tracking.

Provides centralized logging to the audit_trail table for:
- Trading signals and recommendations
- Risk checks and approvals
- Order lifecycle events (submit, fill, cancel)
- Agent decisions and errors
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from src.db import get_db

logger = logging.getLogger(__name__)

EventType = Literal[
    "signal",
    "recommendation",
    "risk_check",
    "approval",
    "order",
    "fill",
    "cancel",
    "error",
]


class AuditLogger:
    """Service for writing audit trail events to the database."""

    def __init__(self) -> None:
        """Initialize the audit logger with database connection."""
        self.db = get_db()

    def log_event(
        self,
        event_type: EventType,
        ticker: str | None = None,
        entity_id: UUID | str | None = None,
        agent_role: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> bool:
        """Log an audit event to the audit_trail table.

        Args:
            event_type: Type of event (signal, recommendation, risk_check, etc.)
            ticker: Optional stock ticker symbol
            entity_id: Optional UUID of related entity (order, recommendation, etc.)
            agent_role: Optional role of the agent that triggered the event
            details: Optional additional details as JSON

        Returns:
            True if logged successfully, False otherwise
        """
        if self.db is None:
            logger.warning("Database not configured, skipping audit log")
            return False

        try:
            # Convert UUID to string if needed
            entity_id_str = str(entity_id) if entity_id else None

            data = {
                "event_type": event_type,
                "ticker": ticker,
                "entity_id": entity_id_str,
                "agent_role": agent_role,
                "details": details or {},
                "created_at": datetime.utcnow().isoformat(),
            }

            self.db.table("audit_trail").insert(data).execute()
            logger.debug(f"Audit event logged: {event_type} for {ticker or 'N/A'}")
            return True

        except Exception as e:
            logger.error(f"Failed to log audit event: {e}", exc_info=True)
            return False

    def log_signal(
        self,
        ticker: str,
        strategy: str,
        signal_type: str,
        confidence: float | None = None,
        details: dict[str, Any] | None = None,
    ) -> bool:
        """Log a trading signal generation event.

        Args:
            ticker: Stock ticker symbol
            strategy: Strategy that generated the signal
            signal_type: Type of signal (buy, sell, hold)
            confidence: Optional confidence score
            details: Additional signal details

        Returns:
            True if logged successfully
        """
        event_details = {
            "strategy": strategy,
            "signal_type": signal_type,
            **({"confidence": confidence} if confidence is not None else {}),
            **(details or {}),
        }
        return self.log_event("signal", ticker=ticker, details=event_details)

    def log_recommendation(
        self,
        recommendation_id: UUID | str,
        ticker: str,
        agent_role: str,
        action: str,
        details: dict[str, Any] | None = None,
    ) -> bool:
        """Log an agent recommendation event.

        Args:
            recommendation_id: UUID of the recommendation
            ticker: Stock ticker symbol
            agent_role: Role of the agent making recommendation
            action: Recommended action (buy, sell, hold)
            details: Additional recommendation details

        Returns:
            True if logged successfully
        """
        event_details = {"action": action, **(details or {})}
        return self.log_event(
            "recommendation",
            ticker=ticker,
            entity_id=recommendation_id,
            agent_role=agent_role,
            details=event_details,
        )

    def log_risk_check(
        self,
        ticker: str,
        check_type: str,
        passed: bool,
        reason: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> bool:
        """Log a risk check event.

        Args:
            ticker: Stock ticker symbol
            check_type: Type of risk check (pdt, wash_sale, drawdown, etc.)
            passed: Whether the check passed
            reason: Optional reason if check failed
            details: Additional check details

        Returns:
            True if logged successfully
        """
        event_details = {
            "check_type": check_type,
            "passed": passed,
            **({"reason": reason} if reason else {}),
            **(details or {}),
        }
        return self.log_event("risk_check", ticker=ticker, details=event_details)

    def log_approval(
        self,
        recommendation_id: UUID | str,
        ticker: str,
        agent_role: str,
        approved: bool,
        reason: str | None = None,
    ) -> bool:
        """Log a trade approval/rejection event.

        Args:
            recommendation_id: UUID of the recommendation
            ticker: Stock ticker symbol
            agent_role: Role of the approving agent
            approved: Whether the trade was approved
            reason: Optional reason for decision

        Returns:
            True if logged successfully
        """
        event_details = {
            "approved": approved,
            **({"reason": reason} if reason else {}),
        }
        return self.log_event(
            "approval",
            ticker=ticker,
            entity_id=recommendation_id,
            agent_role=agent_role,
            details=event_details,
        )

    def log_order(
        self,
        order_id: UUID | str,
        ticker: str,
        side: str,
        quantity: float,
        order_type: str,
        details: dict[str, Any] | None = None,
    ) -> bool:
        """Log an order submission event.

        Args:
            order_id: UUID of the order
            ticker: Stock ticker symbol
            side: Order side (buy, sell)
            quantity: Order quantity
            order_type: Type of order (market, limit, etc.)
            details: Additional order details

        Returns:
            True if logged successfully
        """
        event_details = {
            "side": side,
            "quantity": quantity,
            "order_type": order_type,
            **(details or {}),
        }
        return self.log_event(
            "order",
            ticker=ticker,
            entity_id=order_id,
            details=event_details,
        )

    def log_fill(
        self,
        order_id: UUID | str,
        ticker: str,
        side: str,
        quantity: float,
        fill_price: float,
        details: dict[str, Any] | None = None,
    ) -> bool:
        """Log an order fill event.

        Args:
            order_id: UUID of the order
            ticker: Stock ticker symbol
            side: Order side (buy, sell)
            quantity: Filled quantity
            fill_price: Fill price
            details: Additional fill details

        Returns:
            True if logged successfully
        """
        event_details = {
            "side": side,
            "quantity": quantity,
            "fill_price": fill_price,
            **(details or {}),
        }
        return self.log_event(
            "fill",
            ticker=ticker,
            entity_id=order_id,
            details=event_details,
        )

    def log_cancel(
        self,
        order_id: UUID | str,
        ticker: str,
        reason: str | None = None,
    ) -> bool:
        """Log an order cancellation event.

        Args:
            order_id: UUID of the order
            ticker: Stock ticker symbol
            reason: Optional cancellation reason

        Returns:
            True if logged successfully
        """
        event_details = {"reason": reason} if reason else {}
        return self.log_event(
            "cancel",
            ticker=ticker,
            entity_id=order_id,
            details=event_details,
        )

    def log_error(
        self,
        error_type: str,
        message: str,
        ticker: str | None = None,
        entity_id: UUID | str | None = None,
        details: dict[str, Any] | None = None,
    ) -> bool:
        """Log an error event.

        Args:
            error_type: Type of error
            message: Error message
            ticker: Optional stock ticker symbol
            entity_id: Optional UUID of related entity
            details: Additional error details

        Returns:
            True if logged successfully
        """
        event_details = {
            "error_type": error_type,
            "message": message,
            **(details or {}),
        }
        return self.log_event(
            "error",
            ticker=ticker,
            entity_id=entity_id,
            details=event_details,
        )


# Global singleton instance
_audit_logger: AuditLogger | None = None


def get_audit_logger() -> AuditLogger:
    """Get or create the global audit logger instance."""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger

"""Audit trail API for trade decisions and execution history."""

from __future__ import annotations

from fastapi import APIRouter, Query

from src.db import get_db

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/trades")
async def get_trade_audit(
    ticker: str | None = None,
    limit: int = Query(default=50, le=200),
) -> dict:
    """Get trade audit trail with full decision chain."""
    db = get_db()
    if db is None:
        return {"trades": [], "message": "Database not configured"}

    query = (
        db.table("audit_trail")
        .select("*")
        .in_("event_type", ["order", "fill", "cancel"])
        .order("created_at", desc=True)
        .limit(limit)
    )
    if ticker:
        query = query.eq("ticker", ticker)

    result = query.execute()
    return {"trades": result.data}


@router.get("/decisions")
async def get_decision_log(
    agent_role: str | None = None,
    limit: int = Query(default=50, le=200),
) -> dict:
    """Get agent decision log."""
    db = get_db()
    if db is None:
        return {"decisions": [], "message": "Database not configured"}

    query = (
        db.table("audit_trail")
        .select("*")
        .in_("event_type", ["signal", "recommendation", "risk_check", "approval"])
        .order("created_at", desc=True)
        .limit(limit)
    )
    if agent_role:
        query = query.eq("agent_role", agent_role)

    result = query.execute()
    return {"decisions": result.data}

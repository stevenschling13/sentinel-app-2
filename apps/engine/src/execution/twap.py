"""Time-Weighted Average Price (TWAP) execution algorithm."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class TWAPSlice:
    """A single TWAP execution slice."""

    slice_index: int
    shares: int
    scheduled_at: str  # ISO 8601
    status: str = "pending"


class TWAPExecutor:
    """Split a large order into equal time-weighted slices."""

    def generate_slices(
        self,
        total_shares: int,
        num_slices: int = 5,
        interval_minutes: int = 6,
        start_time: str | None = None,
    ) -> list[TWAPSlice]:
        """Generate TWAP slices for an order.

        Shares are distributed as evenly as possible across *num_slices*
        intervals.  Any remainder is spread one extra share per slice
        starting from the first slice.
        """
        if total_shares <= 0:
            return []
        if num_slices <= 0:
            raise ValueError("num_slices must be positive")

        base_ts = (
            datetime.fromisoformat(start_time) if start_time else datetime.now(tz=timezone.utc)
        )

        base_shares = total_shares // num_slices
        remainder = total_shares % num_slices

        slices: list[TWAPSlice] = []
        for i in range(num_slices):
            shares = base_shares + (1 if i < remainder else 0)
            scheduled = base_ts + timedelta(minutes=i * interval_minutes)
            slices.append(
                TWAPSlice(
                    slice_index=i,
                    shares=shares,
                    scheduled_at=scheduled.isoformat(),
                )
            )
        return slices

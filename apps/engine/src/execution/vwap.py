"""Volume-Weighted Average Price (VWAP) execution algorithm."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

# Default U-shaped intraday volume profile (high at open/close, low midday).
# Represents relative volume for 5 equal periods across a trading session.
_DEFAULT_VOLUME_PROFILE: list[float] = [0.30, 0.15, 0.10, 0.15, 0.30]


@dataclass
class VWAPSlice:
    """A single VWAP execution slice."""

    slice_index: int
    shares: int
    volume_weight: float
    scheduled_at: str  # ISO 8601
    status: str = "pending"


class VWAPExecutor:
    """Split orders proportional to historical volume profile."""

    def generate_slices(
        self,
        total_shares: int,
        volume_profile: list[float] | None = None,
        start_time: str | None = None,
        interval_minutes: int = 6,
    ) -> list[VWAPSlice]:
        """Generate VWAP slices weighted by volume profile.

        *volume_profile* should be a list of floats that represent
        relative volume for each period.  They need not sum to 1 —
        normalisation is applied automatically.  When omitted, a
        default U-shaped profile is used.
        """
        if total_shares <= 0:
            return []

        profile = list(volume_profile or _DEFAULT_VOLUME_PROFILE)
        if not profile:
            raise ValueError("volume_profile must not be empty")

        total_weight = sum(profile)
        if total_weight <= 0:
            raise ValueError("volume_profile weights must be positive")

        weights = [w / total_weight for w in profile]

        base_ts = (
            datetime.fromisoformat(start_time) if start_time else datetime.now(tz=UTC)
        )

        # Distribute shares proportionally, accumulating rounding error.
        allocated = 0
        raw_shares: list[int] = []
        for i, w in enumerate(weights):
            if i == len(weights) - 1:
                # Last slice gets whatever remains to ensure exact total.
                raw_shares.append(total_shares - allocated)
            else:
                s = round(total_shares * w)
                raw_shares.append(s)
                allocated += s

        slices: list[VWAPSlice] = []
        for i, (shares, w) in enumerate(zip(raw_shares, weights, strict=True)):
            scheduled = base_ts + timedelta(minutes=i * interval_minutes)
            slices.append(
                VWAPSlice(
                    slice_index=i,
                    shares=shares,
                    volume_weight=round(w, 6),
                    scheduled_at=scheduled.isoformat(),
                )
            )
        return slices

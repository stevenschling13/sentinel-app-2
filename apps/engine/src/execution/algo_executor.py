"""Algorithm selector and executor."""

from __future__ import annotations

from dataclasses import asdict

from src.execution.twap import TWAPExecutor
from src.execution.vwap import VWAPExecutor


class AlgoExecutor:
    """Facade for selecting and running execution algorithms."""

    def __init__(self) -> None:
        self.twap = TWAPExecutor()
        self.vwap = VWAPExecutor()

    def plan_execution(
        self,
        total_shares: int,
        algorithm: str = "twap",
        num_slices: int = 5,
        volume_profile: list[float] | None = None,
    ) -> dict:
        """Plan an order execution using the chosen algorithm.

        Returns a dict with the algorithm name and a list of slice dicts.
        """
        if algorithm == "twap":
            slices = self.twap.generate_slices(total_shares, num_slices)
        elif algorithm == "vwap":
            slices = self.vwap.generate_slices(total_shares, volume_profile=volume_profile)
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        return {"algorithm": algorithm, "slices": [asdict(s) for s in slices]}

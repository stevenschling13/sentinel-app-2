"""Walk-forward analysis — in-sample/out-of-sample rolling window backtesting."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from src.backtest.engine import BacktestEngine, BacktestResult
from src.strategies.base import OHLCVData
from src.strategies.registry import create_strategy

logger = logging.getLogger(__name__)


@dataclass
class WalkForwardWindow:
    """Result of a single in-sample / out-of-sample window."""

    window_index: int
    in_sample_start: int
    in_sample_end: int
    out_sample_start: int
    out_sample_end: int
    in_sample_sharpe: float
    out_sample_sharpe: float
    in_sample_return: float
    out_sample_return: float


@dataclass
class WalkForwardResult:
    """Aggregate result of walk-forward analysis."""

    strategy_name: str
    ticker: str
    num_windows: int
    windows: list[WalkForwardWindow] = field(default_factory=list)
    avg_in_sample_sharpe: float = 0.0
    avg_out_sample_sharpe: float = 0.0
    avg_in_sample_return: float = 0.0
    avg_out_sample_return: float = 0.0
    efficiency_ratio: float = 0.0  # out-of-sample / in-sample Sharpe

    def summary(self) -> dict:
        return {
            "strategy_name": self.strategy_name,
            "ticker": self.ticker,
            "num_windows": self.num_windows,
            "avg_in_sample_sharpe": round(self.avg_in_sample_sharpe, 4),
            "avg_out_sample_sharpe": round(self.avg_out_sample_sharpe, 4),
            "avg_in_sample_return": round(self.avg_in_sample_return, 4),
            "avg_out_sample_return": round(self.avg_out_sample_return, 4),
            "efficiency_ratio": round(self.efficiency_ratio, 4),
        }


class WalkForwardAnalyzer:
    """Rolling-window walk-forward analysis engine."""

    def __init__(
        self,
        initial_capital: float = 100_000.0,
        commission_per_share: float = 0.005,
        slippage_pct: float = 0.001,
        position_size_pct: float = 0.10,
    ) -> None:
        self.initial_capital = initial_capital
        self.commission_per_share = commission_per_share
        self.slippage_pct = slippage_pct
        self.position_size_pct = position_size_pct

    def run(
        self,
        strategy_name: str,
        data: OHLCVData,
        in_sample_pct: float = 0.7,
        num_windows: int = 4,
    ) -> WalkForwardResult:
        """Run walk-forward analysis with rolling windows.

        Splits the data into `num_windows` overlapping segments. For each
        window the first `in_sample_pct` fraction is used for in-sample
        evaluation and the remainder for out-of-sample testing.
        """
        n = len(data)
        window_size = n // num_windows
        if window_size < 60:
            raise ValueError(
                f"Not enough data for {num_windows} windows "
                f"(need ≥ {60 * num_windows} bars, got {n})"
            )

        windows: list[WalkForwardWindow] = []

        for i in range(num_windows):
            start = i * (n - window_size) // max(num_windows - 1, 1)
            end = start + window_size
            split = start + int(window_size * in_sample_pct)

            is_result = self._run_segment(strategy_name, data, start, split)
            oos_result = self._run_segment(strategy_name, data, split, end)

            windows.append(
                WalkForwardWindow(
                    window_index=i,
                    in_sample_start=start,
                    in_sample_end=split,
                    out_sample_start=split,
                    out_sample_end=end,
                    in_sample_sharpe=is_result.sharpe_ratio,
                    out_sample_sharpe=oos_result.sharpe_ratio,
                    in_sample_return=is_result.total_return,
                    out_sample_return=oos_result.total_return,
                )
            )

        avg_is_sharpe = float(np.mean([w.in_sample_sharpe for w in windows]))
        avg_oos_sharpe = float(np.mean([w.out_sample_sharpe for w in windows]))
        avg_is_ret = float(np.mean([w.in_sample_return for w in windows]))
        avg_oos_ret = float(np.mean([w.out_sample_return for w in windows]))
        efficiency = avg_oos_sharpe / avg_is_sharpe if avg_is_sharpe != 0 else 0.0

        return WalkForwardResult(
            strategy_name=strategy_name,
            ticker=data.ticker,
            num_windows=num_windows,
            windows=windows,
            avg_in_sample_sharpe=avg_is_sharpe,
            avg_out_sample_sharpe=avg_oos_sharpe,
            avg_in_sample_return=avg_is_ret,
            avg_out_sample_return=avg_oos_ret,
            efficiency_ratio=efficiency,
        )

    def _run_segment(
        self,
        strategy_name: str,
        data: OHLCVData,
        start: int,
        end: int,
    ) -> BacktestResult:
        """Backtest a strategy on a slice of data."""
        segment = OHLCVData(
            ticker=data.ticker,
            timestamps=data.timestamps[start:end],
            open=data.open[start:end],
            high=data.high[start:end],
            low=data.low[start:end],
            close=data.close[start:end],
            volume=data.volume[start:end],
        )
        strategy = create_strategy(strategy_name)
        engine = BacktestEngine(
            initial_capital=self.initial_capital,
            commission_per_share=self.commission_per_share,
            slippage_pct=self.slippage_pct,
            position_size_pct=self.position_size_pct,
        )
        return engine.run(strategy, segment)

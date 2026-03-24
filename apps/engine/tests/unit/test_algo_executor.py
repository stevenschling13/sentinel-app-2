"""Tests for the algorithm executor facade."""

import pytest

from src.execution.algo_executor import AlgoExecutor


class TestAlgoExecutorPlanExecution:
    def setup_method(self):
        self.executor = AlgoExecutor()

    def test_twap_plan(self):
        result = self.executor.plan_execution(100, algorithm="twap", num_slices=5)
        assert result["algorithm"] == "twap"
        assert len(result["slices"]) == 5
        total = sum(s["shares"] for s in result["slices"])
        assert total == 100

    def test_vwap_plan(self):
        profile = [0.3, 0.2, 0.2, 0.3]
        result = self.executor.plan_execution(
            100, algorithm="vwap", volume_profile=profile
        )
        assert result["algorithm"] == "vwap"
        assert len(result["slices"]) == 4
        total = sum(s["shares"] for s in result["slices"])
        assert total == 100

    def test_vwap_default_profile(self):
        result = self.executor.plan_execution(200, algorithm="vwap")
        assert result["algorithm"] == "vwap"
        assert len(result["slices"]) == 5  # default profile has 5 periods
        total = sum(s["shares"] for s in result["slices"])
        assert total == 200

    def test_unknown_algorithm_raises(self):
        with pytest.raises(ValueError, match="Unknown algorithm"):
            self.executor.plan_execution(100, algorithm="invalid")

    def test_twap_slice_dicts_have_required_keys(self):
        result = self.executor.plan_execution(50, algorithm="twap", num_slices=3)
        for s in result["slices"]:
            assert "slice_index" in s
            assert "shares" in s
            assert "scheduled_at" in s
            assert "status" in s

    def test_vwap_slice_dicts_have_volume_weight(self):
        result = self.executor.plan_execution(50, algorithm="vwap")
        for s in result["slices"]:
            assert "volume_weight" in s
            assert s["volume_weight"] > 0

    def test_zero_shares_twap(self):
        result = self.executor.plan_execution(0, algorithm="twap")
        assert result["slices"] == []

    def test_zero_shares_vwap(self):
        result = self.executor.plan_execution(0, algorithm="vwap")
        assert result["slices"] == []

    def test_large_order_twap(self):
        result = self.executor.plan_execution(10000, algorithm="twap", num_slices=10)
        total = sum(s["shares"] for s in result["slices"])
        assert total == 10000
        assert len(result["slices"]) == 10

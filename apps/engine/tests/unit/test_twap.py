"""Tests for the TWAP execution algorithm."""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from src.execution.twap import TWAPExecutor


class TestTWAPSlicing:
    def setup_method(self):
        self.executor = TWAPExecutor()

    def test_even_split(self):
        slices = self.executor.generate_slices(100, num_slices=5)
        assert len(slices) == 5
        assert all(s.shares == 20 for s in slices)
        assert sum(s.shares for s in slices) == 100

    def test_remainder_distribution(self):
        slices = self.executor.generate_slices(103, num_slices=5)
        assert len(slices) == 5
        assert sum(s.shares for s in slices) == 103
        # First 3 slices get 21 shares, last 2 get 20
        assert slices[0].shares == 21
        assert slices[1].shares == 21
        assert slices[2].shares == 21
        assert slices[3].shares == 20
        assert slices[4].shares == 20

    def test_single_slice(self):
        slices = self.executor.generate_slices(50, num_slices=1)
        assert len(slices) == 1
        assert slices[0].shares == 50

    def test_zero_shares_returns_empty(self):
        slices = self.executor.generate_slices(0)
        assert slices == []

    def test_negative_shares_returns_empty(self):
        slices = self.executor.generate_slices(-10)
        assert slices == []

    def test_zero_num_slices_raises(self):
        with pytest.raises(ValueError, match="num_slices must be positive"):
            self.executor.generate_slices(100, num_slices=0)

    def test_negative_num_slices_raises(self):
        with pytest.raises(ValueError, match="num_slices must be positive"):
            self.executor.generate_slices(100, num_slices=-1)

    def test_slice_indices_sequential(self):
        slices = self.executor.generate_slices(50, num_slices=5)
        indices = [s.slice_index for s in slices]
        assert indices == list(range(5))

    def test_all_slices_pending(self):
        slices = self.executor.generate_slices(50, num_slices=3)
        assert all(s.status == "pending" for s in slices)

    def test_custom_start_time(self):
        slices = self.executor.generate_slices(
            30, num_slices=3, start_time="2024-01-01T10:00:00+00:00"
        )
        assert "2024-01-01T10:00:00" in slices[0].scheduled_at
        assert "2024-01-01T10:06:00" in slices[1].scheduled_at
        assert "2024-01-01T10:12:00" in slices[2].scheduled_at

    def test_custom_interval(self):
        slices = self.executor.generate_slices(
            20,
            num_slices=2,
            interval_minutes=15,
            start_time="2024-01-01T09:30:00+00:00",
        )
        assert "2024-01-01T09:30:00" in slices[0].scheduled_at
        assert "2024-01-01T09:45:00" in slices[1].scheduled_at

    def test_shares_equal_to_slices(self):
        slices = self.executor.generate_slices(3, num_slices=3)
        assert all(s.shares == 1 for s in slices)

    def test_more_slices_than_shares(self):
        slices = self.executor.generate_slices(2, num_slices=5)
        assert sum(s.shares for s in slices) == 2
        # First 2 get 1, last 3 get 0
        shares_list = [s.shares for s in slices]
        assert shares_list == [1, 1, 0, 0, 0]

    @given(
        total=st.integers(min_value=1, max_value=100_000),
        num_slices=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=50)
    def test_total_shares_preserved(self, total, num_slices):
        slices = self.executor.generate_slices(total, num_slices=num_slices)
        assert sum(s.shares for s in slices) == total
        assert len(slices) == num_slices

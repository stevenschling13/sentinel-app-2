"""Tests for the VWAP execution algorithm."""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from src.execution.vwap import _DEFAULT_VOLUME_PROFILE, VWAPExecutor


class TestVWAPSlicing:
    def setup_method(self):
        self.executor = VWAPExecutor()

    def test_default_profile(self):
        slices = self.executor.generate_slices(100)
        assert len(slices) == len(_DEFAULT_VOLUME_PROFILE)
        assert sum(s.shares for s in slices) == 100

    def test_custom_profile(self):
        profile = [0.5, 0.5]
        slices = self.executor.generate_slices(100, volume_profile=profile)
        assert len(slices) == 2
        assert sum(s.shares for s in slices) == 100
        assert slices[0].shares == 50
        assert slices[1].shares == 50

    def test_unequal_profile(self):
        profile = [0.7, 0.3]
        slices = self.executor.generate_slices(100, volume_profile=profile)
        assert sum(s.shares for s in slices) == 100
        # First slice should be roughly 70
        assert slices[0].shares == 70

    def test_unnormalized_profile(self):
        """Profile weights need not sum to 1 — normalization is automatic."""
        profile = [3, 1, 1]
        slices = self.executor.generate_slices(100, volume_profile=profile)
        assert sum(s.shares for s in slices) == 100
        assert slices[0].shares == 60  # 3/5 * 100

    def test_zero_shares_returns_empty(self):
        slices = self.executor.generate_slices(0)
        assert slices == []

    def test_negative_shares_returns_empty(self):
        slices = self.executor.generate_slices(-5)
        assert slices == []

    def test_empty_profile_uses_default(self):
        """An empty list is falsy, so the default U-shaped profile is used."""
        slices = self.executor.generate_slices(100, volume_profile=[])
        assert len(slices) == len(_DEFAULT_VOLUME_PROFILE)
        assert sum(s.shares for s in slices) == 100

    def test_all_zero_profile_raises(self):
        with pytest.raises(ValueError, match="must be positive"):
            self.executor.generate_slices(100, volume_profile=[0.0, 0.0])

    def test_volume_weights_sum_to_one(self):
        slices = self.executor.generate_slices(100)
        total_weight = sum(s.volume_weight for s in slices)
        assert abs(total_weight - 1.0) < 1e-4

    def test_slice_indices_sequential(self):
        slices = self.executor.generate_slices(50)
        assert [s.slice_index for s in slices] == list(range(len(_DEFAULT_VOLUME_PROFILE)))

    def test_all_slices_pending(self):
        slices = self.executor.generate_slices(50)
        assert all(s.status == "pending" for s in slices)

    def test_custom_start_time(self):
        profile = [0.5, 0.5]
        slices = self.executor.generate_slices(
            20, volume_profile=profile, start_time="2024-06-01T10:00:00+00:00"
        )
        assert "2024-06-01T10:00:00" in slices[0].scheduled_at
        assert "2024-06-01T10:06:00" in slices[1].scheduled_at

    def test_custom_interval(self):
        profile = [1, 1]
        slices = self.executor.generate_slices(
            20,
            volume_profile=profile,
            interval_minutes=30,
            start_time="2024-01-01T09:30:00+00:00",
        )
        assert "09:30" in slices[0].scheduled_at
        assert "10:00" in slices[1].scheduled_at

    def test_u_shaped_profile_distribution(self):
        """Default profile is U-shaped: more volume at open/close."""
        slices = self.executor.generate_slices(1000)
        # First and last slices should have most shares
        middle_shares = slices[2].shares
        edge_shares = slices[0].shares
        assert edge_shares > middle_shares

    @given(
        total=st.integers(min_value=1, max_value=100_000),
    )
    @settings(max_examples=50)
    def test_total_shares_preserved_default_profile(self, total):
        slices = self.executor.generate_slices(total)
        assert sum(s.shares for s in slices) == total

    @given(
        total=st.integers(min_value=1, max_value=10_000),
        weights=st.lists(
            st.floats(min_value=0.01, max_value=10.0), min_size=2, max_size=10
        ),
    )
    @settings(max_examples=50)
    def test_total_shares_preserved_custom_profile(self, total, weights):
        slices = self.executor.generate_slices(total, volume_profile=weights)
        assert sum(s.shares for s in slices) == total
        assert len(slices) == len(weights)

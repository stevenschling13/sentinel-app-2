"""Tests for the rate limiting middleware."""


from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.middleware.rate_limit import RateLimitMiddleware


def _create_app(requests_per_minute: int = 5) -> FastAPI:
    """Create a minimal FastAPI app with rate limiting middleware."""
    test_app = FastAPI()
    test_app.add_middleware(RateLimitMiddleware, requests_per_minute=requests_per_minute)

    @test_app.get("/health")
    async def health():
        return {"status": "ok"}

    @test_app.get("/api/test")
    async def test_endpoint():
        return {"result": "ok"}

    return test_app


class TestRateLimitMiddleware:
    def test_health_bypasses_rate_limit(self):
        app = _create_app(requests_per_minute=1)
        client = TestClient(app)
        # Even with limit=1, health should always work
        for _ in range(5):
            resp = client.get("/health")
            assert resp.status_code == 200

    def test_under_limit_allowed(self):
        app = _create_app(requests_per_minute=10)
        client = TestClient(app)
        for _ in range(5):
            resp = client.get("/api/test")
            assert resp.status_code == 200

    def test_at_limit_returns_429(self):
        app = _create_app(requests_per_minute=3)
        client = TestClient(app)
        # Make 3 requests (at limit)
        for _ in range(3):
            resp = client.get("/api/test")
            assert resp.status_code == 200
        # 4th should be rate limited
        resp = client.get("/api/test")
        assert resp.status_code == 429

    def test_429_response_detail(self):
        app = _create_app(requests_per_minute=1)
        client = TestClient(app)
        client.get("/api/test")
        resp = client.get("/api/test")
        assert resp.status_code == 429
        data = resp.json()
        assert "Rate limit exceeded" in data["detail"]

    def test_rate_limit_headers_present(self):
        app = _create_app(requests_per_minute=10)
        client = TestClient(app)
        resp = client.get("/api/test")
        assert "x-ratelimit-limit" in resp.headers
        assert resp.headers["x-ratelimit-limit"] == "10"
        assert "x-ratelimit-remaining" in resp.headers

    def test_remaining_decreases(self):
        app = _create_app(requests_per_minute=5)
        client = TestClient(app)
        resp1 = client.get("/api/test")
        remaining1 = int(resp1.headers["x-ratelimit-remaining"])
        resp2 = client.get("/api/test")
        remaining2 = int(resp2.headers["x-ratelimit-remaining"])
        assert remaining2 < remaining1

    def test_different_paths_share_limit(self):
        """All non-health paths share the same per-IP rate limit."""
        test_app = FastAPI()
        test_app.add_middleware(RateLimitMiddleware, requests_per_minute=2)

        @test_app.get("/a")
        async def route_a():
            return {"r": "a"}

        @test_app.get("/b")
        async def route_b():
            return {"r": "b"}

        client = TestClient(test_app)
        client.get("/a")
        client.get("/b")
        # 3rd request should be limited
        resp = client.get("/a")
        assert resp.status_code == 429

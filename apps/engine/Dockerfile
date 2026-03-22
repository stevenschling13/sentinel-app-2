# --- Build stage ---
FROM python:3.13-slim AS builder

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY apps/engine/pyproject.toml apps/engine/uv.lock ./
RUN uv sync --no-dev --frozen --no-install-project

COPY apps/engine/src/ src/

# --- Runtime stage ---
FROM python:3.13-slim

RUN groupadd -r sentinel && useradd -r -g sentinel -d /app sentinel

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY --from=builder --chown=sentinel:sentinel /app .

USER sentinel

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uv", "run", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

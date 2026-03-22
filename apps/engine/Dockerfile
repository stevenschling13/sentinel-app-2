FROM python:3.13-slim

WORKDIR /app

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy project files (context is monorepo root)
COPY apps/engine/pyproject.toml apps/engine/uv.lock ./
COPY apps/engine/src/ src/

# Install dependencies
RUN uv sync --no-dev --frozen

# Run the server
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

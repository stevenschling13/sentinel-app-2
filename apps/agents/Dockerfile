# --- Build stage ---
FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/ packages/shared/
COPY apps/agents/package.json apps/agents/

RUN pnpm install --frozen-lockfile

COPY apps/agents/ apps/agents/

RUN pnpm --filter @sentinel/agents build

# --- Runtime stage ---
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

RUN groupadd -r sentinel && useradd -r -g sentinel -d /app sentinel

WORKDIR /app

COPY --from=builder --chown=sentinel:sentinel /app .

USER sentinel

WORKDIR /app/apps/agents

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>{if(!r.ok)throw r.status})" || exit 1

CMD ["pnpm", "start"]

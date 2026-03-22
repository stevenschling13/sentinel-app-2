FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Copy workspace root files needed for pnpm install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy the packages this service depends on
COPY packages/shared/ packages/shared/
COPY apps/agents/package.json apps/agents/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy agent source
COPY apps/agents/ apps/agents/

WORKDIR /app/apps/agents

EXPOSE 3001
CMD ["pnpm", "start"]

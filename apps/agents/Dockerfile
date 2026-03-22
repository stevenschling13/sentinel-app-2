FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Copy package manifest (context is apps/agents/ via RAILWAY_ROOT_DIRECTORY)
COPY package.json ./

# Remove workspace deps (type-only, not needed at runtime) and install
RUN node -e "const p=require('./package.json'); delete p.dependencies?.['@sentinel/shared']; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2))" \
    && pnpm install --no-frozen-lockfile

# Copy source
COPY src/ src/
COPY tsconfig.json ./

EXPOSE 3001
CMD ["pnpm", "start"]

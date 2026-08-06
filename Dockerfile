# ============================================================
# Back4App Containers build for the Socket.IO realtime server (@gitwit/server)
#
# The repo is an npm-workspaces / Turborepo monorepo, so the whole
# repo must be installed, then we build ONLY the server workspace
# (turbo builds its dependencies: @gitwit/db, @gitwit/lib, @gitwit/templates).
#
# Deploy to Back4App Containers with this Dockerfile at the repo root.
# ============================================================

FROM node:20-slim

# git is required by the app's git operations (simple-git); build tools are
# required by node-pty (native module) if no prebuilt binary is available
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git ca-certificates build-essential python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- Copy manifests first for better layer caching ----
COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY db/package.json ./db/package.json
COPY ai/package.json ./ai/package.json
COPY lib/package.json ./lib/package.json
COPY templates/package.json ./templates/package.json
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
COPY tests/package.json ./tests/package.json

# Install all workspace dependencies
RUN npm ci

# ---- Copy source ----
COPY packages ./packages
COPY db ./db
COPY ai ./ai
COPY lib ./lib
COPY templates ./templates
COPY server ./server

# Build the server and its workspace dependencies (db, lib, templates)
RUN npx turbo build --filter=@gitwit/server

# Writable dir for local sandbox project files (LocalSandbox uses ./projects)
RUN mkdir -p /app/projects && chmod 777 /app/projects

ENV PORT=4000
EXPOSE 4000

# The Socket.IO server reads env vars from the platform (Back4App Containers)
CMD ["node", "server/dist/index.js"]

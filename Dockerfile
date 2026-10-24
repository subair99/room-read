# RoomRead runs as ONE always-on container: the Next.js server and the
# `qloo mcp` child process it spawns. Serverless hosts are not supported
# by the Qloo harness.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Qloo harness (must be >= 0.1.26).
RUN npm install --global @qloo/qloo-harness@latest && qloo --version

WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build && mkdir -p data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# QLOO_API_KEY and the model key are injected by the host as secrets.
CMD ["npm", "start"]

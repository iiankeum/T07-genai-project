FROM node:24-bookworm-slim

WORKDIR /app/src/app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -m 0750 -o node -g node /data

COPY src/app/package.json src/app/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY LICENSE THIRD_PARTY_NOTICES.md /app/
COPY src/app/ ./

ARG GIT_COMMIT=unknown
ENV NODE_ENV=production \
    GIT_COMMIT=${GIT_COMMIT} \
    HOST=0.0.0.0 \
    PORT=5600 \
    DATA_DIR=/data \
    DEMO_MODE=0 \
    AI_PROVIDER=off \
    TRUST_PROXY=0

USER node
EXPOSE 5600
CMD ["node", "server.mjs"]

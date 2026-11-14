# syntax=docker/dockerfile:1.7
# One image runs three roles: api (MODE=api), worker (MODE=worker) and the
# one-shot migrate job. It builds for linux/amd64 and linux/arm64 (ADR-002).

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@tadhkirah/api...
RUN pnpm --filter @tadhkirah/api deploy --prod --legacy /out/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD [ "$MODE" = "worker" ] || wget -qO- http://127.0.0.1:${PORT:-4000}/healthz >/dev/null || exit 1
CMD ["node", "dist/main.js"]

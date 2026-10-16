# Build from the repository root (the API bundles the shared rules in src/):
#   docker build -f server/Dockerfile -t survivors-api .
# One image, two apps: the API (`node dist/index.js`, the default) and the
# realtime co-op server (`node dist/play.js`, with PORT=3001).
FROM node:24-alpine AS build
WORKDIR /repo
COPY server/package.json server/package-lock.json server/
RUN npm ci --prefix server
COPY src src
COPY server server
RUN npm run build --prefix server

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /repo/server/dist dist
COPY server/migrations migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:$PORT/health || exit 1
CMD ["node", "dist/index.js"]

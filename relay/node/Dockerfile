# A VPS co-op relay (São Paulo first), as Dokploy builds it. From the repository root
# (the relay bundles relay/src, src/net/protocol.ts and the Arena's import-free files, never game code):
#   docker build -f relay/node/Dockerfile -t ps-relay .
FROM node:24-alpine AS build
WORKDIR /repo
COPY relay/node/package.json relay/node/package-lock.json relay/node/
RUN npm ci --prefix relay/node
COPY src/net/protocol.ts src/net/arena.ts src/net/arenaQueue.ts src/net/coopReport.ts src/net/realm.ts src/net/realmRelay.ts src/net/realmTables.ts src/net/
COPY src/data/arenaRanked.ts src/data/arenaFormats.ts src/data/minigames.ts src/data/realmMap.ts src/data/realmStamps.ts src/data/realmEvents.ts src/data/furnitureCatalog.ts src/data/furnitureDef.ts src/data/furnitureUse.ts src/data/
# The furniture catalog (what a piece does in the realm, `FurnitureDef.use`); its sets import only types and `furnitureUse.ts`.
COPY src/data/furnitureSets/shop.ts src/data/furnitureSets/home.ts src/data/furnitureSets/pokemon.ts src/data/furnitureSets/games.ts src/data/furnitureSets/
COPY src/realm/games/tables.ts src/realm/games/fourInRow.rules.ts src/realm/games/typeDuel.rules.ts src/realm/games/ludo.rules.ts src/realm/games/unown.rules.ts src/realm/games/
COPY relay/src relay/src
COPY relay/node relay/node
# One file (ws included, node:sqlite is built in), and its hash: /health shows it as `version`.
RUN mkdir -p relay/node/dist && node relay/node/build.mjs > relay/node/dist/version

FROM node:24-alpine
WORKDIR /app
# The rooms and dumps live in /data: mount a volume there, or every deploy loses the rooms in play.
# IP_HEADER: Traefik (Dokploy's proxy, the only way in) puts the player's address in X-Real-Ip.
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data IP_HEADER=x-real-ip
COPY --from=build /repo/relay/node/dist/relay.mjs /repo/relay/node/dist/version ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
# SIGTERM is the graceful stop: every socket closes as a restart (1012), the players reconnect and resume.
STOPSIGNAL SIGTERM
CMD ["sh", "-c", "RELAY_VERSION=$(cat version) exec node --enable-source-maps --disable-warning=ExperimentalWarning relay.mjs"]

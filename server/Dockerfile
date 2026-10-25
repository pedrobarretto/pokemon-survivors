# Build from the repository root (the API bundles the shared rules in src/):
#   docker build -f server/Dockerfile -t survivors-api .
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
# What the Discord staff bot knows about the game (`loadKnowledge` in src/gameKnowledge.ts reads it beside dist/).
COPY public/llms.txt llms.txt
# The previous rules' frozen simulator (`npm run rules:freeze`): the checks' worker loads it only for a run that straddled a rules deploy.
COPY server/sims/*.mjs sims/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# The API, or with ROLE=checks the verifier alone (src/index.ts); both answer /health on PORT.
CMD ["node", "dist/index.js"]

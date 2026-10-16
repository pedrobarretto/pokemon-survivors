# Accounts API and co-op server

Two small Node processes from one package and one image:

- **The API** (`src/index.ts`): the optional accounts, each signed-in player's save synced across devices, the ranking and friends. Hono on Node 24, Postgres through [`postgres`](https://github.com/porsager/postgres), Clerk session tokens checked with `@clerk/backend`.
- **The realtime server** (`src/play.ts`, `src/play/`): co-op rooms, friends' presence and invites over one WebSocket. See [Realtime co-op server](#realtime-co-op-server).

The merge rules are not here: `mergeSaves` and `applyPush` live in `src/game/sync.ts` and the game uses the same code. The build bundles them in (`esbuild`), so the image only runs `dist/index.js`.

## Routes

| Route | |
| --- | --- |
| `GET /health` | 200 while Postgres answers, else 503 |
| `GET /save` | The player's `{ save, revision }`, 404 before the first push |
| `PUT /save` | Body `{ save, base }`: the device's save and the revision it last got (`null` if it never synced). Stores the save as is when `base` is the latest revision, else merges both. Returns `{ save, revision, merged }` |
| `GET /me` | `{ profile }`: the player's `{ handle, name }`, `null` before they pick them |
| `PUT /me` | Body `{ handle, name }`. 400 when invalid, 409 `{ suggestion }` when the handle is taken |
| `POST /runs` | Body `{ challenge? }`. `{ token }` for a run that just started (the id of a new `runs` row). 429 past 30 starts in 10 minutes. With `challenge` (a Brasília day, `YYYY-MM-DD`) it's that day's Desafio do dia; 400 when that challenge isn't open (its day, or 10 minutes past it) |
| `PUT /runs/:token` | Body `RunResult` (`src/game/ranking.ts`). Records how the run ended and returns `{ ranks: { day, week, all }, challenge }` (`ChallengePlace` for a challenge run, else null). 400 implausible or a challenge run whose replay isn't its day's challenge, 404 unknown token, 409 contradicts what the run recorded, 422 more play than the wall clock since the token allows |
| `GET /boards/:difficulty` | `?period=day\|week\|all&starter=<id>&friends=1`. `{ entries, me }`: the top 50, each player once with their best run, and the asker's own line |
| `GET /challenge/:day` | `?friends=1`. `ChallengeBoard`: the day's official attempts (top 50, the asker's line), how many took part and whether the asker made theirs (`attempted`) |
| `GET /profiles/:handle` | The public profile: name, title, Pokédex counts, records, recent runs, follower counts, and whether the asker follows them (`followed`) and they follow the asker (`followsYou`). 404 if nobody has the handle |
| `PUT /follows/:handle`, `DELETE /follows/:handle` | Follows or unfollows. `{ followed, followers }`. Following is a friend request; following back accepts it |
| `GET /gifts` | `{ gifts }`: the player's unclaimed Mystery Gifts (`{ id, content, reason, at }`), oldest first, 20 at most |
| `POST /gifts/claim` | Body `{ ids }`: marks those gifts claimed once the game applied them. `{ claimed }` |
| `POST /referral` | Body `{ ref }`: the inviter's handle a new account came with. `{ referred }`, whether it counted |
| `GET /friends` | `FriendList`: `{ friends, incoming, outgoing }`, each `{ handle, name, title }`. Friends follow each other; `incoming` follow the player, who doesn't follow back; `outgoing` the other way round |
| `DELETE /followers/:handle` | Declines a request: drops their follow of the player. `{ ok: true }`, 404 unknown handle |
| `DELETE /friends/:handle` | Unfriends: drops both follows. `{ ok: true }`, 404 unknown handle |
| `GET /players?q=` | `{ players }`: up to 8 `{ handle, name }` whose handle starts with `q` (normalized, 2+ characters, else empty), without the asker |

`/save`, `/me`, `/runs`, `/follows`, `/friends`, `/followers`, `/gifts` and `/referral` need `Authorization: Bearer <Clerk session token>`. `/boards`, `/challenge`, `/profiles` and `/players` are public and read the token when there is one (`friends=1` needs it). The response shapes (`PublicProfile`, `FriendList`, `PlayerMatch`) live in `src/game/ranking.ts`, shared with the game. CORS allows `https://www.pokemonsurvivors.com`, `https://pokemonsurvivors.com`, any `http://localhost` port and whatever `CORS_ORIGINS` adds.

### Ranked runs

The game asks for a start token when a run begins and sends the result when it ends. The server takes it only if the wall clock since the token is at least the time survived, minus a 30 s slack for a token that arrived late (the simulation never runs faster than real time, and pausing only widens the gap). It also checks plausible numbers (`parseRunResult`) and limits run starts per player. A victory that goes on into endless mode sends again with the same token; the run may only grow. Day and week boards start at midnight and on Monday in America/Sao_Paulo, and a run counts for the period it started in.

### Desafio do dia and ribbons

The day's challenge is pure from the Brasília date (`dailyChallenge` in `src/game/challenge.ts`): the seed, the Pokémon and the difficulty, with no upgrades, Lure, Incense or lucky egg, and the day's outbreak on.

- A challenge run says so when it starts (`POST /runs { challenge }`), and the row keeps the day (`runs.challenge`). It can only start on its day (10 minutes of grace past midnight).
- When it ends, its replay must be that day's challenge (`challengeProblem`: seed, Pokémon, difficulty, outbreak, all ranks at 0, no items), else 400. The first challenge run of the player's day to finish is their official attempt (`runs.official`); later ones are practice and stay off the challenge board (they still count on the regular boards, like any run). Re-simulation then checks the attempt like any run, and a failed one leaves the board.
- The challenge board ranks each player's official attempt, players with a handle only, like the other boards.
- Ribbons (`src/challenge.ts`): every 15 minutes the API looks at the last two days, and once a day ended 3 hours ago (`ribbonsDue`), ranks its verified official attempts with ties sharing a place and sends each player a Mystery Gift `ribbon` (`ribbonFor`: gold for the top 10%, silver for the top half, bronze for the rest, the #1 always gold) with `key` `ribbon:<day>`. Running it again sends nothing twice, and a run verified late still gets its ribbon on the next look. Profiles count ribbons from the `gifts` table, so they show before the game claims them.

### Invites and Mystery Gifts

Every reward outside a run goes through the gift inbox (`src/gifts.ts`): `send(userId, content, reason, key)` adds a gift, and a `key` keeps one gift per occasion (sending the same key again does nothing), so a job can safely retry. The game fetches the unclaimed ones on every sync, applies them (`applyGift` in `src/game/gifts.ts`, which keeps the applied ids in the save) and claims them. A kind an older game doesn't know stays unclaimed until a newer one picks it up.

Invites are counted here, never on the device:

- `POST /referral` records `referred_by` only for a new account: no save stored yet, first seen in the last 48 hours, no inviter yet, and not the player's own handle (`canRefer` in `src/game/referral.ts`). The game sends it on a device's first sync, before the save goes up. Both players then follow each other and the newcomer gets a Friendship Egg (`key` `welcome`).
- After each verified run (`checks.ts` calls `credit`), once the newcomer has 3 verified runs the invite counts for the inviter (once: `referral_credited_at`), who gets the milestone's gifts (`key` `friends:<count>:<i>`): 1 friend, a Friendship Egg; 3, the Ambassador title and frame; 10, a shiny Munchlax.
- Public profiles show `brought`, the friends whose invite counted.

### Verification by re-simulation

The result comes with the run's replay (`src/game/replay.ts`). After answering, the API re-simulates it from the seed (`src/checks.ts`), one run at a time on a worker thread (`src/verify.ts`, bundled to `dist/verify.js`), so requests never wait on it. The run is verified when the replay ends on the same time, faints and level it reported; otherwise it's marked failed and counts nowhere. Boards and profiles show pending runs marked (`verified: null`). A verified run's replay is dropped; a failed one keeps it, to look into. If the worker itself fails, the run stays pending and is checked again at the next start (`resume`). Under `npm run dev` (tsx) the check runs in place, since a worker can't load the TypeScript source.

Cost, measured on an Apple M4 Pro with Node 24 (bot runs with a full Poké Mart, `dist/verify.js`):

| Run | Re-simulation | Replay (JSON / gzip) |
| --- | --- | --- |
| 14:20 | 2.1 s | 30 KB / 2.7 KB |
| 21:20 | 6.0 s | 45 KB / 3.7 KB |
| 32:00 | 11.8 to 23.8 s | 66 KB / 5.1 KB |

The cost grows with the horde: late endless minutes are the heavy ones. A VPS core is likely 2 to 3 times slower.

## Realtime co-op server

Co-op (up to 4 players) runs in deterministic lockstep: every client runs the same simulation from the same seed, and this server only relays inputs. It never simulates and imports no simulation code, only the wire protocol (`src/net/protocol.ts`, the contract: read its doc comments) and the small parsers it uses. It's its own process (`dist/play.js`) so the API's frequent deploys don't end the runs in progress.

- `src/play/rooms.ts`: the rooms, a pure state machine (no sockets, timers or randomness: `now` and a generator are passed in). Tested in `rooms.test.ts`.
- `src/play/presence.ts`: signed-in players online, their mutual friends' presence and invites, pure too (the database is read by the caller).
- `src/play/server.ts`: the wiring: `node:http` with `GET /health` (`{ ok, rooms, sockets }`), WebSocket upgrades on `/ws` (`ws`, `noServer`), limits and the one global interval.

### Protocol in short

JSON messages over one WebSocket.

1. **Handshake.** The first message is `hello` (`protocol`, `build`, display `name`, a device `guest` id, the Clerk `token` or null). A different `PROTOCOL` is refused (`version`). With a valid token the server loads the player's handle and mutual friends and answers `welcome { me, online }`, and tells the friends online (`presence`). Guests get `welcome { me: null, online: [] }`. Messages sent before the `welcome` are dropped.
2. **Lobby.** `create` makes a room with a 5-character code (the creator hosts, slot 0); `join { code }` enters a lobby (refused `notFound`, `full`, `started`, or `version` when the game build differs from the creator's, since mixed builds would desync). Members send `loadout` (Pokémon, shiny, Poké Mart ranks, screen size) and `ready`; the host sets `difficulty`, can `kick` and `start` (refused `notHost`, or `notReady` until every connected member is ready; the host's start counts as their ready, so a room of one starts too). Every change broadcasts `lobby`. If the host leaves, the lowest slot left hosts.
3. **Start.** Slots are compacted 0..n-1 in join order (members whose slot moved get `room` again), then `lobby` and `start { seed, difficulty, view, members }` go out. The view is `roomView` of everyone's screens. Clients load and send `loaded`; once every connected member did (or after 30 s) the clock starts: `go`.
4. **Clock.** Tick `t` covers `[t, t + 1) / 60` s after `go` and goes out once that window has fully passed (`ticksDue`, computed from the start time every time, so it never drifts and never sends a tick early). The interval fires 30 times a second and sends every tick due since the last call as one `frame { first, count, entries }`, usually 2 ticks (`FRAME_TICKS`). Inputs that arrived since the last frame (`move`, `press`, `choice`, `offer`, `away`) are stamped into its first tick, in arrival order: a player's newer `move` replaces the older one and a repeated press, choice or pick is dropped. The server never waits for anyone: a slow tab falls behind and fast-forwards on its own.
5. **Drops.** A dropped lobby member keeps their seat 15 s. In a run the player is stamped `away`, and `leave` if they're not back within 90 s; their slot then stays empty for the rest of the run. `leave` (or a kick) in a run stamps `leave` at once. `join { code, secret }` takes a held seat back in any phase: in a run the player gets `room`, `lobby`, `start`, `go`, then the whole run so far as one backlog frame from tick 0, and is stamped `back`. A room with nobody connected for 120 s is deleted.
6. **Checks and the end.** Clients send `sum { tick, sum }` every 120 ticks; the first two connected players that disagree on a tick get the room a `desync` (once, logged with the sums). `over` marks the run finished; `lobby` then brings everyone back (anyone after `over`, the host any time), with slots compacted and nobody ready.
7. **Friends.** `invite { handle }` forwards `invited { from, code }` to every connection of a mutual friend online (refused `notFriend`, `offline`, `noRoom`, or `rate`: one invite per pair every 10 s). `friends` reloads the player's mutual friends after a request was accepted, and newly mutual friends online see each other. `ping { at }` answers `pong { at }`.

Besides the lobby itself, `lobby` also goes out right before `start` and mid-run when the host moves to someone else, with the room's `phase` (rejoining players get one the same way).

### Limits

| | |
| --- | --- |
| Origin | `allowedOrigin` (the game's domains, localhost, `CORS_ORIGINS`); others get 403 |
| Message size | 4 KB (`maxPayload`), bigger closes the socket |
| Rate | Token bucket per socket: 120 burst, 60 a second sustained; running dry closes the socket. 20 messages that don't parse close it too |
| Sockets | 20 per IP (`X-Real-Ip` from Traefik). A socket must send `hello` within 10 s |
| Rooms | 10 created per IP a minute (`refused rate`) |
| Heartbeat | WebSocket ping every 15 s; a socket that missed the last pong is dropped (its seat is held as above) |
| Slow readers | A socket with more than 8 MB queued is dropped; it rejoins with the backlog |
| Friend reloads | One every 2 s per socket |

Rooms live in memory only, so run **one** replica, and know that a restart (a deploy) ends the runs in progress: on `SIGTERM` the server closes every socket with code 1012 and exits.

### Capacity

The server only moves inputs: per player about 30 small messages a second each way (a frame is usually a few dozen bytes), and the work per frame is a loop over the rooms. One Node process handles thousands of players. Memory per room is its run's input history (kept for rejoins), at most one `move` per player per tick and usually far less.

## Environment

| Variable | |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (required) |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API keys → Secret key (required) |
| `CLERK_JWT_KEY` | Optional. Clerk's JWT public key (PEM), to verify tokens without fetching Clerk's keys |
| `CORS_ORIGINS` | Optional. Extra allowed origins, comma separated (e.g. a Vercel preview) |
| `PORT` | Default `3000` for the API, `3001` for the realtime server |

The realtime server needs the same `DATABASE_URL` and Clerk keys (it reads profiles and follows, and verifies tokens) and `CORS_ORIGINS` for its origin check.

## Database

Migrations are plain SQL files in `migrations/`, run in name order at boot (each once, tracked in the `migrations` table). To change the schema, add the next numbered file; never edit one that already ran.

- `users`: one row per Clerk user id, with the public `handle` (unique, lower case) and display `name`, null until the player picks them.
- `saves`: one JSONB save per user, with the save's schema `version` and a `revision` bumped on every push.
- `runs`: one row per ranked run, created at its start (the id is the start token) and filled when it ends. Unfinished rows never show, and are dropped after 7 days.
- `follows`: who follows whom, one way. Both ways make friends (`src/friends.ts`).
- `runs.replay`, `runs.verified`: the replay waiting for its check, and the verdict (null while pending).
- `gifts`: each player's Mystery Gifts (`kind`, `payload` = `GiftContent`, `reason`, a per-player unique `key`, `claimed_at`).
- `users.referred_by`, `referred_at`, `referral_credited_at`: who brought the player and when the invite counted.
- `runs.challenge`, `runs.official`: the Desafio do dia a run plays (its day) and whether it's the player's official attempt of that day.
- `users_handle_prefix`: a `text_pattern_ops` index on `users.handle`, so `/players` prefix searches stay fast under any collation.

The realtime server reads `users` and `follows` but never runs migrations: the API owns the schema.

## Local development

```bash
docker run -d --name survivors-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=survivors -p 5433:5432 postgres:17-alpine
cp .env.example .env   # fill CLERK_SECRET_KEY
npm install
npm run dev            # API on http://localhost:3000 (runs the migrations)
npm run dev:play       # realtime server on ws://localhost:3001/ws (same .env, PORT forced to 3001)
```

In the game, set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL=http://localhost:3000` in `.env.local` at the repository root.

`npm run typecheck` checks the server together with the shared game code; CI runs it.

## Deploy (Dokploy)

### What runs

The Dokploy project **Pokémon Survivors** has these services:

- **Postgres 18** `survivors-postgres-kwkfm5`, with no external port. Only the API and the realtime server reach it, over Dokploy's internal network.
- **App `api`**: built with the Dockerfile `server/Dockerfile` and build context `.` (the repository root, since the API bundles `src/`). It listens on container port `3000` behind `api.pokemonsurvivors.com`, with a Let's Encrypt certificate.
- **App `play`** (the realtime server, see below).

### The realtime server (`play`)

A second Dokploy application from the same repository and Dockerfile:

- **Build:** Dockerfile `server/Dockerfile`, build context `.`, like `api`.
- **Command:** `node dist/play.js` (overrides the image's `CMD`).
- **Environment:** `PORT=3001`, plus `DATABASE_URL`, `CLERK_SECRET_KEY` (and `CLERK_JWT_KEY`, `CORS_ORIGINS` if `api` has them) with the same values as `api`. The image's healthcheck calls `/health` on `$PORT`.
- **Domain:** host `api.pokemonsurvivors.com`, path `/ws`, container port `3001`, HTTPS with Let's Encrypt, path stripping off (the server expects `/ws`). Traefik prefers the longer rule (`Host && PathPrefix(/ws)`) over the API's host-only one, so `wss://api.pokemonsurvivors.com/ws` reaches `play` with no DNS change.
- **Replicas:** one. Rooms live in its memory.
- **Watch paths:** `server/src/play/**`, `server/src/play.ts`, `src/net/**`, plus what it shares: `server/src/friends.ts`, `server/src/auth.ts`, `server/src/db.ts`, `server/src/env.ts`, `server/package.json`. Keep it narrow on purpose: every deploy of `play` ends the runs in progress.

The relay doesn't need the game's data: a member's loadout travels loosely typed (any Pokémon id, any upgrade name) and the clients read it with `setupOf`, all on the same build (a room only admits its creator's `build`). So a new Pokémon or upgrade never needs a `play` deploy; only a new difficulty does (the lobby's difficulty is still checked).

### When it deploys

A push to `main` deploys the API automatically, but only when it touches `server/**`, `src/game/**`, `src/data/**` or `src/engine/**`. Those are the folders the API bundle imports. **If the bundle starts importing another folder of `src/`, add it to this list in Dokploy** (and here). Otherwise a change there ships to the site but not to the API, and the two drift apart.

### Rollout

New versions roll out with no downtime:

- The new container starts before the old one stops (start-first).
- If its `HEALTHCHECK` (`/health`) doesn't pass within 30 s, Swarm rolls back to the previous version on its own. That includes a migration that breaks the boot.
- `play` rolls out the same way, but its rooms don't move: the old container closes its sockets on `SIGTERM` and the runs in progress end.

### Migrations

- The files are numbered and only move forward. Never edit a migration that already ran: add the next file.
- Every change must work with the previous version of the API, since both run side by side during a rollout. For example, add a nullable column first, and drop the old one only in a later PR.
- All pending migrations run in one transaction, so a failure leaves nothing half applied.

### Environment

| Variable | Where | |
| --- | --- | --- |
| `DATABASE_URL` | Dokploy (`api`, `play`) | Internal connection string of `survivors-postgres-kwkfm5` |
| `CLERK_SECRET_KEY` | Dokploy (`api`, `play`) | Production instance secret key |
| `PORT` | Dokploy (`play`) | `3001` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Vercel, production only | `pk_live_…`, which only works on `pokemonsurvivors.com` |
| `VITE_API_URL` | Vercel, production only | `https://api.pokemonsurvivors.com` |

### Local development

The `pk_live` key doesn't work on `localhost`. To test sign-in locally, put the keys of Clerk's **development** instance in `.env.local` at the repository root (and its secret key in `server/.env`).

# Co-op relay

The room relay for co-op: a Cloudflare Worker with one Durable Object per room
(`idFromName(code)`, SQLite storage). It owns the run's clock (60 Hz, ticks
derived from elapsed time), stamps inputs into the next unsent tick, broadcasts
frames without waiting on storage, writes the input log once a second,
compares the players' state hashes, keeps the latest snapshot a majority agreed
on, heals a diverged client and records a desync dump. It runs no game code: it
imports only `../src/net/protocol.ts`, which imports nothing (a test checks it).

Storage comes two ways (the doc block atop `src/room.ts`; `src/store.ts` writes
and reads it for both shells). Rare state (seats, run start and end, the agreed
snapshot, pauses) is a durable room save: the output gate holds every message
until it commits. The input log, decided hashes, clock bound and snapshot
chunks are written with `allowUnconfirmed` (KV keys; `sql.exec` always takes
the gate), so frames and pongs never wait on a commit. A crash can lose the newest second of log: the clock bound, written
3 s ahead with every batch (never under 2 s, so a lost batch is covered while
its commit takes under 2 s; the worst measured took 1.1 s), keeps the
restarted room from sending a tick twice, the clients resume from their own
state, and the hash check heals anyone who rebuilt without it. The cost: after
a restart the clock resumes at the bound, so the players get 2 to 3 s of ticks
without their input.

- `src/room.ts`: the room as a pure state machine (all the rules, tested in `test/room.test.ts`).
- `src/roomObject.ts`: the Durable Object, a thin shell doing the storage, sockets and timers the room asks for.
- `src/vault.ts`: one Durable Object keeping desync dumps after their room is gone (30 days, the newest 500, pruned by its alarm), and the lab's kept runs (below).
- `src/telemetry.ts`: what makes every run diagnosable (below), kept out of the room's rules.
- `src/index.ts`: the Worker routes; `src/auth.ts`: Clerk session tokens (RS256 against the JWKS).

```bash
npm install
npm test             # vitest in the Workers runtime (pure rules + a restart test)
npm run typecheck    # wrangler types + tsc
npm run dev          # wrangler dev on :8791
npm run deploy       # ps-coop-dev on workers.dev (also allows Vercel previews)
npm run deploy:prod  # ps-coop on workers.dev (only pokemonsurvivors.com)
node scripts/probe.mjs --bots 3 --secs 40 --desync --rejoin   # bots against a deployed relay
```

## Endpoints

- `POST /rooms` `{ v, build, region? }` → `{ code, region, claim }`. The room lives near the host
  (location hint from the request's continent, or `region`). Whoever says `claim` in its `hello`
  becomes its host (the room a group moves to, below, where teammates may land first).
- `GET /rooms/<code>/ws`: the WebSocket. The first message is `hello`. Co-op is for signed-in
  players (a Clerk session token in `hello.auth`): a guest hello is refused with `signIn`, except
  where `ALLOW_GUESTS` is `on` (the dev relay and local `wrangler dev`, for the soak, the in-tab
  bots and dev builds; `env.production` has it `off`).
- `GET /health`: the Worker answering (no Durable Object is touched).
- `GET /admin/dumps` (the last 100) and `GET /admin/dumps/<id>` (gzipped JSON), with
  `Authorization: Bearer <ADMIN_TOKEN>`. Without the token they answer 404.

## Secrets

`ADMIN_TOKEN` is set with `wrangler secret put ADMIN_TOKEN` (add `--env production` for
`ps-coop`). The tokens are in `~/.config/ps-coop/dev-admin-token` and `prod-admin-token` on
Pedro's Mac (mode 600). To fetch a dump:

```bash
H="Authorization: Bearer $(cat ~/.config/ps-coop/dev-admin-token)"
curl -s -H "$H" https://ps-coop-dev.pedrobarretto.workers.dev/admin/dumps
curl -s -H "$H" https://ps-coop-dev.pedrobarretto.workers.dev/admin/dumps/<id> | gunzip > dump.json
```

A dump has `meta` (room, build, region, the run's start with seed and loadouts, the
hashes reported at the diverged tick, seats with builds and user agents), `log`
(`[tick, entries]` for every tick with inputs) and `hashes` (`[tick, {seat: hash}]`).
Re-simulating `meta.run` with `log` reproduces the run.

## Telemetry

JSON lines in Workers Logs (observability is on), one per event:

- `do.boot`: a room's object started (`colo`: where it runs, from Cloudflare's trace asked once per isolate; the run and tick it resumes at).
- `conn.open` / `conn.close`: a socket, with where it meets Cloudflare (`colo`, `country`, `asn`, `rtt`: the edge's TCP round trip, set by the Worker in `X-PS-Edge`), and at close its code or the relay's reason and how long it lived.
- `run.summary`: at a run's end or when its room goes (`why`, `final`), and also when everyone left it (`why: 'left'`, `final: false`: an idle room's object is usually evicted before it expires, and its counts with it): frames sent and those carrying more than a tick, the frame timer's lateness (p50, p99, max ms), messages in by kind (a `batch` once, and each message it carries by its own kind), stick inputs coalesced and messages dropped, bytes per seat, storage writes by kind (log batches, room saves, snapshot chunks, deletes), snapshot sizes, pauses, and per seat its edge, how many times it joined, and its own link report (`net`: round trip, hold, underruns, stalls, reconnects, sent every 15 s).

`welcome` also says where the room runs (`net`: `colo`, `region`, the socket's `edge` and `edgeRtt`), for the client's own `coop_net` event.

**Kept runs.** A run that lasted a minute or more is offered to the vault when it is summed up (above): its input log, as a dump (`kind: 'run'`, `meta.why`, `meta.net` per seat, `score`; one id per run, so an offer made when everyone left is replaced if the run goes on), so a laggy run can be replayed in the lab. At most 20 a UTC day, the laggiest win (`score`: the worst seat's round trip p95, plus 20 per underrun and 50 per reconnect), kept 14 days. `/admin/dumps` lists them with the rest (`kind`, `score`).

## VPS relays: São Paulo and US east (`node/`)

Cloudflare has no Durable Objects in South America, so a Brazilian room runs in the US
(116–140 ms away). `node/` runs the same room (`src/room.ts`, `src/store.ts`, `src/auth.ts`,
`src/codes.ts`) on Node 24 as a Docker image, on Pedro's VPSes through Dokploy:

| Relay | Home (`RELAY_HOME`) | Codes start with | Where | Address | Game env |
|---|---|---|---|---|---|
| São Paulo | `sa` | 2–5 | the main VPS (72.60.58.225, next to the API, ~9 ms from a Brazilian player) | `coop-sa.pokemonsurvivors.com` | `VITE_COOP_URL_SA` |
| US east (being retired, below) | `us` | 6–9 | Hostinger Boston (2.25.92.11), a Dokploy remote server | `coop-us.pokemonsurvivors.com` | `VITE_COOP_URL_US` |

- **Routing:** a room's code says its relay (`RELAY_HOMES` in the protocol). Cloudflare makes
  codes starting with a letter, each VPS relay with its own digits. The game (`src/coop/relays.ts`)
  measures every VPS relay it has a URL for and creates on the one with the lowest round trip
  within 70 ms that isn't full, else on Cloudflare (also the fallback when that relay can't take it). A build
  without a relay's `VITE_COOP_URL_*` sends its codes to Cloudflare. Another relay is one entry in
  `RELAY_HOMES`, one in `RELAY_URLS` (`src/coopShell.ts`), its env var and this image with its
  `RELAY_HOME` (taking characters from a home only after that home's rooms are gone, 6 h).
- **Moving for the group:** the host picks the relay at create, but the group can be elsewhere
  (the first 4-player room ran in São Paulo with players in Spain at 230 ms). In the lobby every
  client reports its round trips (`rtt`: each VPS relay's `/health` median, and a Cloudflare
  room's own pings), kept on its seat and shown in the room. At the host's Start, `groupHome`
  (`src/coop/relays.ts`) scores each VPS relay, and the Cloudflare room it's in, by the worst
  member's round trip, and moves only when one beats the current room by 40 ms and every member
  reported. The host makes a room there (`POST /rooms`, its `claim`), sends `move`; the old room
  tells every seat `moved` and closes them, and keeps answering any `hello` (an old link) with
  `moved` until it expires (6 h from its creation, past the idle limit). Clients follow with their
  Pokémon, ready and settings; the host's Start completes once everyone is in, or after 8 s with
  whoever made it. Any failure (the relay down, no claim, no `moved` within 3 s) starts the run
  where the room is. Only before a room's first run, once. All of it is additive: a relay that
  doesn't say `moves` in its `welcome` is never asked, a client that doesn't report keeps its room
  where it is.
- **Capacity: a VPS relay never caps the game.** Past its capacity it takes no new room and
  Cloudflare, which scales on its own, gets it: the worst case is a Brazilian player with a higher
  ping, never a failed create or a laggy room. The rule is `fullWhy` (`node/src/capacity.ts`):
  full at `MAX_ROOMS` rooms (default 40; it counts every room holding a lobby or a run, not one the
  group moved away from; an empty room leaves within 10 minutes) or while the last minute starved
  it (event-loop p99 over 30 ms, or the whole machine's CPU busy over 90%; read once a minute with
  `relay.stats`, so it doesn't flap). A running 2-player room costs ~1.1% of a core and the relay is
  one event loop, so 40 keeps it near half a core; on 2026-10-22 the São Paulo VPS starved it to a
  ~75 ms p99 with no room at all, the case the guard routes around. `/health` adds `rooms` and
  `full`; a full relay answers `POST /rooms` with `{ error: 'full' }` (503) and logs `room.refused`
  (`why`: `rooms`, `loop` or `host`). The game skips a relay whose `/health` said full, creates on
  Cloudflare when one refuses (the `coop` event's `create` step says `overflow: '<home>'` in
  PostHog), and never moves a room to one; a move refused starts the run where the room is.
  Joining or resuming a room already there is never refused for capacity. `MAX_ROOMS=0` drains a
  relay (no new rooms; the ones in play finish). A relay before this answers no `full`: not full.
- **One process, every room:** one SQLite file per room (`node:sqlite`, WAL) on the `/data`
  volume, a 60 Hz timer per running room, the Worker's routes, origin checks, Clerk tokens,
  rate limits (by `X-Real-Ip` from Traefik) and the dump vault. An exclusive lock on
  `/data/relay.lock` keeps a second container off the same rooms.
- **Storage as the Durable Object's (`src/store.ts`):** the same log batch a second with its
  clock bound (3 s ahead, never under 2 s), the same keys (rows of the room's `kv` here) and the
  same restart (the clock resumes at the newest batch's bound). No output gate: a step's writes
  go in one local transaction (microseconds) before anything it sends.
- **A deploy or a crash loses only sockets:** SIGTERM writes the log still in memory, closes
  the sockets with 1012 (clients reconnect at once and resume) and rooms load back from the
  volume. A crash may lose the newest second of log, covered as on Cloudflare. A room whose
  step throws starts over from its file without touching the others. Logs are the room's
  events as on the Workers, plus `relay.stats` a minute (rooms, sockets, event-loop lag, CPU,
  memory, and the whole VPS's: `hostBusyPct`, `hostStealPct`, `hostIowaitPct`, `load1`, since
  the relay shares its cores with other apps). `welcome`'s `net` says `colo: vps:<home>` and the
  room's region, with no edge; the rest of the telemetry (`run.summary`, `conn.*`, kept runs)
  is Cloudflare's only for now.

```bash
cd node && npm ci
npm test && npm run typecheck   # the Node shell (restart, lock and rate-limit tests)
npm run dev                     # :8795, guests on; the game: ps.coop('relay', 'sa', 'http://localhost:8795')
node ../scripts/probe.mjs --url http://localhost:8795 --bots 3 --secs 40 --desync --rejoin
docker build -f relay/node/Dockerfile -t ps-relay .   # from the repository root, as Dokploy does
```

### One-time setup (Pedro)

The same steps for each relay, with its row of the table above (`<home>`: `sa`; `us` is being retired, below).

1. **DNS** (GoDaddy, `ns23`/`ns24.domaincontrol.com`): an `A` record per relay, TTL 600:
   `coop-sa` → `72.60.58.225` (the main VPS, like `api`) and `coop-us` → `2.25.92.11` (Boston).
   Check: `dig +short coop-<home>.pokemonsurvivors.com`.
2. **Dokploy** (US east: first add the Boston VPS as a **remote server** in Dokploy, Settings →
   Remote Servers, and set it up so it runs Traefik; its app then deploys there), project
   **Pokémon Survivors**, a new application `coop-<home>` (`coop-us` on the Boston server):
   - Source: this GitHub repository, branch `main`. Build type **Dockerfile**, Dockerfile
     `relay/node/Dockerfile`, build context `.` (the repository root).
   - Auto deploy on, with watch paths `relay/src/**`, `relay/node/**` and `src/net/protocol.ts`
     (all the image bundles: game deploys never restart it).
   - **Volume** (Advanced → Mounts): a volume mount, name `ps-relay-<home>-data`, mount path `/data`.
     Without it every deploy loses the rooms in play.
   - **Rollout: stop-first** (Advanced → Swarm → Update config, `Order: stop-first`, Swarm's
     default; not the API's start-first). Two relays can't share the rooms: a new container
     started first would wait on the lock, never get healthy, and roll back.
   - **Environment:**
     ```
     RELAY_HOME=<home>
     ALLOWED_ORIGINS=https://www.pokemonsurvivors.com,https://pokemonsurvivors.com
     ALLOW_GUESTS=off
     ADMIN_TOKEN=<openssl rand -base64 32, kept in ~/.config/ps-coop/<home>-admin-token, mode 600>
     ```
     (`CLERK_ISSUER` defaults to `https://clerk.pokemonsurvivors.com`; `PORT`, `DATA_DIR` and
     `IP_HEADER=x-real-ip` come from the image.)
   - **Domain:** host `coop-<home>.pokemonsurvivors.com`, path `/`, container port `8080`, HTTPS on,
     certificate Let's Encrypt.
3. Deploy, then check: `curl https://coop-<home>.pokemonsurvivors.com/health` answers
   `{"ok":true,"home":"<home>","version":…}`. To soak one, set `ALLOW_GUESTS=on` for a while and run
   the probe with `--url https://coop-<home>.pokemonsurvivors.com`: it must keep its sockets well past
   a minute (Traefik's timeouts) and end with every check green.
4. Ship the Cloudflare relay's code change (`npm run deploy:prod` here: its codes now always start
   with a letter) and wait 6 h, a room's longest life, so no live Cloudflare room has a digit code.
5. Vercel, Production: `VITE_COOP_URL_SA=https://coop-sa.pokemonsurvivors.com` and
   `VITE_COOP_URL_US=https://coop-us.pokemonsurvivors.com` (either alone works), then redeploy the site.

No Clerk change is needed: the issuer is the same, and a token's `azp` is checked against `ALLOWED_ORIGINS`.

### Running it

- **Deploy:** a push to `main` touching the watch paths, or Deploy in Dokploy. The old container
  stops (1012 to every socket), the new one loads the rooms from the volume: players freeze for
  about a second and resume.
- **Rollback:** Dokploy's Deployments tab, redeploy the previous one (the volume stays).
- **Logs:** the app's Logs tab in Dokploy (JSON lines: `run.*`, `seat.*`, `room.*`, `relay.stats`).
- **Dumps:** `curl -s -H "Authorization: Bearer $(cat ~/.config/ps-coop/<home>-admin-token)" https://coop-<home>.pokemonsurvivors.com/admin/dumps`
  (then `/admin/dumps/<id> | gunzip > dump.json`).
- **Costs:** São Paulo shares the main VPS (nothing extra); US east is the Boston VPS's own plan. A 4-player room takes ~1–1.5% of a core and
  ~1 MB of memory past the process's ~80 MB.

### Retiring US east (Boston)

Pedro decided to retire the Boston relay: Cloudflare serves North America, with Durable Objects on
both US coasts, and scales on its own. The `us` home stays in `RELAY_HOMES` (old codes and builds).

1. Vercel, Production: remove `VITE_COOP_URL_US` and redeploy the site. Builds from then on never
   measure Boston nor create there; a 6–9 code they meet (an old link) goes to Cloudflare, which has no
   such room and refuses the `hello` (`unavailable`): the player reads "This room isn't available
   (full, already started or gone)" and stays in the co-op hub, nothing breaks.
2. Wait 6 h (a room's longest life, and time for open tabs of the old build to reload), then stop
   `coop-us` in Dokploy. An old tab still holding the URL then finds Boston down at its `/health` and
   creates on Cloudflare (the same fallback as a down relay); one in a Boston room reconnects until it
   gives up.
3. Later, at leisure: delete the `coop-us` app and its volume, the Boston remote server and the
   `coop-us` DNS record.

## Limits and costs

Storage writes per run: one log batch a second (the ticks with inputs, the hashes
decided and the clock bound), the snapshot chunks every 10 s (and the old ones'
deletes), and a room save for each rare change. A 20-minute run writes a couple of
thousand rows (it was about 75k with a row per input tick). The Workers Free plan
allows 100k rows written a day.

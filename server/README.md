# Accounts API

Small Node API behind the optional accounts: each signed-in player's save, synced across devices. Hono on Node 24, Postgres through [`postgres`](https://github.com/porsager/postgres), Clerk session tokens checked with `@clerk/backend`.

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
| `GET /profiles/:handle` | The public profile: name, title, Pokédex counts, records, recent runs, follower counts. 404 if nobody has the handle |
| `PUT /follows/:handle`, `DELETE /follows/:handle` | Follows or unfollows. `{ followed, followers }` |
| `GET /gifts` | `{ gifts }`: the player's unclaimed Mystery Gifts (`{ id, content, reason, at }`), oldest first, 20 at most |
| `POST /gifts/claim` | Body `{ ids }`: marks those gifts claimed once the game applied them. `{ claimed }` |
| `POST /referral` | Body `{ ref }`: the inviter's handle a new account came with. `{ referred }`, whether it counted |
| `POST /donations` | Body `{ amount, page, handle? }`: `amount` whole reais (`parseDonation` in `src/data/donations.ts`), `page` the site path to come back to, `handle` the account that gets the rewards. `{ url }`, an AbacatePay checkout (Pix or a Brazilian card) that returns to `page?thanks=<ref>` once paid. 400 for an amount out of range or a handle nobody has, 503 without `ABACATEPAY_API_KEY` |
| `GET /donations/:ref` | For the thank-you page: `{ paid, handle, code, redeemed }` (`DonationStatus`). 404 until the payment is known (Stripe's row comes with its webhook) |
| `POST /donations/redeem` | Body `{ code }`: credits a donation's code to the player. `{ tier }`; 404 unknown code, 409 already used |
| `POST /webhooks/stripe` | Stripe's `checkout.session.completed` and `async_payment_succeeded`, signed with `STRIPE_WEBHOOK_SECRET`. 401 bad signature, 503 without the secret |
| `POST /webhooks/abacatepay` | AbacatePay's `checkout.completed`, signed the Standard Webhooks way (`webhook-id`, `webhook-timestamp`, `webhook-signature`, with the `whsec_` secret in `ABACATEPAY_WEBHOOK_SECRET`). A webhook made before 01/10/2026 sends `?webhookSecret=` and `X-Webhook-Signature` instead, also accepted. 401 bad signature, 503 without the secret |
| `GET /me/supporter`, `PUT /me/supporter` | The player's tier, since when, whether they show it and their vote (`SupporterStatus`). `PUT` with `{ public }` shows or hides the badge and name |
| `GET /supporters` | `{ supporters }`: the wall, supporters who show themselves and have a handle, oldest first (500 at most). Each `WallEntry` has `handle`, `name`, `tier`, `since` (first donation) and, for the Hall da Fama, `title` (equipped, or null) and `pokemon` (`{ id, shiny }` from the synced save, `hallPokemon`: a shiny picked with a ticket, else the companion, else the partner; null before any sync). The game reads both as null from an API without them |
| `GET /creators/live` | `{ live }`: the content creators live now (`CreatorLive[]`, `src/data/creators.ts`), newest stream first. Cached 30 s |
| `PUT /creators/:id/live` | Body `{ live }`: the creator says they're live (for 4 hours, `LIVE_HOURS`; again while live renews it) or done. Only the creator's own account (`account` in `CREATORS`) or an admin; 403 for anyone else, 404 for an unknown creator. `{ live, until }` |
| `GET /poll`, `PUT /poll` | `{ id, votes }`, the supporters' poll (`POLL` in `src/data/supporters.ts`). `PUT` with `{ choice }` votes (or changes the vote); 403 for anyone who isn't a supporter |
| `GET /suggestions` | `?sort=top\|new\|done`. `{ suggestions }`: a tab of the idea board (100 at most), open ideas by score or newest first, or the shipped ones; each `Suggestion` (`src/game/suggestions.ts`) has the asker's `vote` and whether it's theirs (`mine`) |
| `POST /suggestions` | Body `{ title, body }` (`parseSuggestionDraft`). 201 `{ suggestion }`, posted with the author's up vote. 400 invalid, 403 before the player has a handle, 429 past 3 ideas in 24 hours |
| `PUT /suggestions/:id/vote` | Body `{ vote }`: 1, -1, or 0 to take it back. `{ score, vote }`. 404 unknown or hidden, 409 shipped |
| `POST /bug-reports` | Body `{ text, tech? }` (`parseBugReport` in `src/game/bugReport.ts`): what the player wrote and, unless they turned it off, the technical info the game gathered. Guests too; with a token the thread shows the player's handle. 201 `{ id }`: stored, and posted to Discord in the background (see [Bug reports](#bug-reports)). 400 invalid, 429 past 5 reports in an hour from the IP or the account |
| `GET /admin` | `{ admin: true }` for an admin (see [Admin gift desk](#admin-gift-desk)), 403 for anyone else, like every `/admin` route |
| `GET /admin/users` | `?q=` a handle (with or without `@`, in part) or an email (in part, asked of Clerk). `{ users }`: up to 10 `AdminUser` with their email and when they were last seen |
| `POST /admin/gifts` | Body `{ userId, content, request }`: sends a Mystery Gift (`parseAdminGift`: any `GiftContent` but a ribbon). `request` is a uuid per send, so a retry sends nothing twice: `{ sent }`, false when it already went. 404 for an unknown player |
| `GET /admin/gifts` | `{ gifts }`: the last 30 gifts sent by hand (`AdminSent`), with when they were claimed |
| `PUT /admin/suggestions/:id` | Body `{ status }`: `done` (shipped, stamps `done_at`), `open` again, or `hidden` (off the board). `{ status }`, 404 for an unknown idea |

`/save`, `/me`, `/runs`, `/follows`, `/gifts`, `/referral`, `/donations/redeem`, `/me/supporter`, `PUT /poll`, `POST /suggestions`, `PUT /suggestions/:id/vote` and `/admin` need `Authorization: Bearer <Clerk session token>`. `/boards`, `/challenge`, `/profiles`, `GET /suggestions` and `POST /bug-reports` are public and read the token when there is one (`friends=1` needs it). CORS allows `https://www.pokemonsurvivors.com`, `https://pokemonsurvivors.com`, any `http://localhost` port and whatever `CORS_ORIGINS` adds.

### Ranked runs

The game asks for a start token when a run begins and sends the result when it ends. The server takes it only if the wall clock since the token is at least the time survived, minus a 30 s slack for a token that arrived late (the simulation never runs faster than real time, and pausing only widens the gap). It also checks plausible numbers (`parseRunResult`) and limits run starts per player. A victory that goes on into endless mode sends again with the same token; the run may only grow. Day and week boards start at midnight and on Monday in America/Sao_Paulo, and a run counts for the period it started in.

### Desafio do dia and ribbons

The day's challenge is pure from the Brasília date (`dailyChallenge` in `src/game/challenge.ts`): the seed, the Pokémon and the difficulty, with no upgrades, Lure, Incense or lucky egg, and the day's outbreak on.

- A challenge run says so when it starts (`POST /runs { challenge }`), and the row keeps the day (`runs.challenge`). It can only start on its day (10 minutes of grace past midnight).
- When it ends, its replay must be that day's challenge (`challengeProblem`: seed, Pokémon, difficulty, outbreak, all ranks at 0, no items), else 400. The first challenge run of the player's day to finish is their official attempt (`runs.official`); later ones are practice and stay off the challenge board (they still count on the regular boards, like any run). Re-simulation always checks an official attempt, and a failed one leaves the board.
- The challenge board ranks each player's official attempt, players with a handle only, like the other boards.
- Ribbons (`src/challenge.ts`): every 15 minutes the API looks at the last two days, and once a day ended 3 hours ago (`ribbonsDue`), ranks its official attempts (not failed) with ties sharing a place and sends each player a Mystery Gift `ribbon` (`ribbonFor`: gold for the top 10%, silver for the top half, bronze for the rest, the #1 always gold) with `key` `ribbon:<day>`. Running it again sends nothing twice. Profiles count ribbons from the `gifts` table, so they show before the game claims them.

### Invites and Mystery Gifts

Every reward outside a run goes through the gift inbox (`src/gifts.ts`): `send(userId, content, reason, key)` adds a gift, and a `key` keeps one gift per occasion (sending the same key again does nothing), so a job can safely retry. The game fetches the unclaimed ones on every sync, applies them (`applyGift` in `src/game/gifts.ts`, which keeps the applied ids in the save) and claims them. A kind an older game doesn't know stays unclaimed until a newer one picks it up.

Invites are counted here, never on the device:

- `POST /referral` records `referred_by` only for a new account: no save stored yet, first seen in the last 48 hours, no inviter yet, and not the player's own handle (`canRefer` in `src/game/referral.ts`). The game sends it on a device's first sync, before the save goes up. Both players then follow each other and the newcomer gets a Friendship Egg (`key` `welcome`).
- After each finished run (`PUT /runs/:token` calls `credit`), once the newcomer has 3 runs that didn't fail their check the invite counts for the inviter (once: `referral_credited_at`), who gets the milestone's gifts (`key` `friends:<count>:<i>`): 1 friend, a Friendship Egg; 3, the Ambassador title and frame; 10, a shiny Munchlax.
- Public profiles show `brought`, the friends whose invite counted.

### Supporters

Donating with an account brings a cosmetic thank-you, sent as Mystery Gifts (`src/game/supporters.ts`). Nothing of it touches a run.

- A donation is tied to an account by its handle: the support page sends it to `POST /donations` (AbacatePay, whose checkout gets `externalId` `pokemon-survivors-donation:<ref>`) or puts it in the Stripe Payment Link as `client_reference_id`. Both come back to the page with `?thanks=<ref>` (Stripe's redirect, set in its dashboard, uses `{CHECKOUT_SESSION_ID}`).
- The webhooks (`src/webhooks.ts`) say it's paid. `src/supporters.ts` records it once (`donations.ref` is unique, so retries change nothing) and credits it: its points (`donationPoints`: one per centavo, five per US cent) join `users.supporter_points`, and each tier the total reaches sends its gifts once (`TIER_GIFTS`, `key` `support:<tier>:<i>`): any donation brings the Supporter title and frame and a shiny of one's choice; 5,000 points (R$ 50 or US$ 10) the gold background and wallpaper.
- A paid donation without an account gets a code (`PS-XXXX-XXXX`) that the thank-you page shows; any signed-in player can redeem it once (`POST /donations/redeem`).
- Boards and profiles show the badge (`supporter`) unless the player hides it (`users.supporter_public`); the same flag keeps them off the wall and the victory's credits. The supporters' poll keeps one vote per player per poll (`poll_votes`).

### Admin gift desk

For gifting players by hand (someone who talked about the game on social media, say). The desk lives in the game's account dialog ("Painel admin", `src/ui/admin.ts`), shown only when `GET /admin` answers 200.

- Who is admin is decided here and nowhere else: a signed-in user with a **verified** email in `ADMIN_EMAILS` (comma separated). The API asks Clerk (`users.getUser`) and keeps the answer 5 minutes per user (`src/admin.ts`); without `ADMIN_EMAILS` nobody is admin and Clerk is never asked. Every `/admin` route sits behind the same check, so whatever the page shows, a request from anyone else gets 403.
- The search reads handles from our `users` table and emails from Clerk (we don't store them). A Clerk account that never synced still shows and can get a gift: it gets its `users` row, and the gift waits in its inbox.
- A gift goes through the same inbox as every other (`sendGift`), with reason `{ kind: 'staff', from: <admin's handle> }` (the banner says "Um presente de @…"), key `staff:<request>` and `gifts.sent_by` the admin, which is what the recent list reads. Each send is logged.

### Verification by re-simulation

Runs are trusted: one counts on the boards as soon as it's reported, and only a failed check takes it off. The result comes with the run's replay (`src/game/replay.ts`). After answering, the API queues it (`src/checks.ts`), and when its turn comes re-simulates it from the seed only if the run is on show: a challenge's official attempt, or the player's line in the top 50 of its difficulty's day, week or all-time board, or the top 3 of its Pokémon's (`CHECKED`, `shown`). A random 5% of the other runs is checked too, to keep an eye on determinism; every other replay is dropped unchecked. Checks run one at a time on a worker thread (`src/verify.ts`, bundled to `dist/verify.js`), so requests never wait on it. The run is verified when the replay ends on the same time, faints and level it reported; otherwise it's marked failed and counts nowhere. The branch isn't judged: a verified run takes the one its replay took over the one the game reported (which `parseRunResult` already keeps only when it's of the run's family, at a stage it reached). Boards and profiles never show whether a run was checked. A verified run's replay is dropped; a failed one keeps it, to look into. If the worker itself fails, the run stays pending and is checked again at the next start (`resume`). Under `npm run dev` (tsx) the check runs in place, since a worker can't load the TypeScript source.

Cost, measured on an Apple M4 Pro with Node 24 (bot runs with a full Poké Mart, `dist/verify.js`):

| Run | Re-simulation | Replay (JSON / gzip) |
| --- | --- | --- |
| 14:20 | 2.1 s | 30 KB / 2.7 KB |
| 21:20 | 6.0 s | 45 KB / 3.7 KB |
| 32:00 | 11.8 to 23.8 s | 66 KB / 5.1 KB |

The cost grows with the horde: late endless minutes are the heavy ones. A VPS core is likely 2 to 3 times slower.

### Discord bot

The community Discord (built by `scripts/discord/setup.mjs`) has a bot that runs inside the API (`src/discord.ts`, texts in `src/discordMessages.ts`), only when `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` are set. It finds its channels and roles by name, and claims a key in `discord_posts` before each post, so two instances side by side in a rollout never post twice.

- **Introduction gate:** a gateway connection (Node's own `WebSocket`, intents GUILDS, GUILD_MESSAGES and MESSAGE_CONTENT) watches #introductions. A message with at least 20 letters or digits from a member without **Trainer** gets the role, a 👋 and a welcome (once per player); a shorter one gets a nudge. The setup script's `GATE` makes only Trainers talk elsewhere. When the connection comes back (a deploy, a drop), the bot reads the last 50 introductions and lets in whoever it missed.
- **Patch notes:** on boot, the changelog's updates (`src/site/changelog.ts`, English) newer than the last one posted go to #patch-notes, pinging **Patch Notes Ping**, and the last one posted is edited to match (an update grows through its day). The very first boot only posts the newest update.
- **Daily posts:** every 15 minutes it looks for what's due: the day's Desafio do dia in #daily-challenge (pinging **Daily Challenge Ping**) and its outbreak in #daily-outbreak when the Brasília day starts, and yesterday's top 3 in #daily-challenge once the ribbons are due (`ribbonsDue`).
- **Creators going live:** when a creator turns their live on (`PUT /creators/:id/live`, `src/creators.ts`), #creators gets their live link, once per stream.
- **Linked accounts** (`src/discordLink.ts`): a player connects Discord to their Clerk account in the game (or signs in with it); `POST /discord/link` reads that account from Clerk, stores its id in `users.discord_id`, adds the player to the server with the OAuth token Clerk keeps (`guilds.join`, a scope of Clerk's Discord connection) and gives **Supporter** or **Gold Supporter** by their tier (Gold replaces Supporter; no tier changes nothing). A donation that raises a linked player's tier updates the role. Linking never grants Trainer.

### Bug reports

The game's "Reportar bug" (Settings → About, the pause menu, and the prompt after the game closed mid-run) sends `POST /bug-reports` (`src/bugReports.ts`).

- Every report is stored in `bug_reports` first, so none is lost when Discord is down or not set up; without the bot the API just stores them.
- With the bot, each one becomes a thread in the **#bug-reports** forum: titled by the report's first line and the device (`Android · Chrome`, 💥 first when the game closed mid-run), opened by the quoted text and the technical info in a code block, then one message per error the game caught. Tags `Open`, `Mobile` or `Desktop`, and `Crash`, matched by name. Posts send `allowed_mentions: { parse: [] }`, so nothing in a report pings anyone. The forum is `DISCORD_BUG_FORUM_ID`, or else the forum channel named `bug-reports`.
- Rate limit: 5 reports per hour per IP (`X-Real-IP`, set by Traefik) and per account, in memory on each instance. The answer never waits for Discord.

The bot's application has **Message Content** and **Server Members** on (Developer Portal → Bot → Privileged Gateway Intents), which needs no review under 100 servers.

## Environment

| Variable | |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (required) |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API keys → Secret key (required) |
| `CLERK_JWT_KEY` | Optional. Clerk's JWT public key (PEM), to verify tokens without fetching Clerk's keys |
| `CORS_ORIGINS` | Optional. Extra allowed origins, comma separated (e.g. a Vercel preview) |
| `ABACATEPAY_API_KEY` | Optional. AbacatePay API key (v2) for donations; a dev key simulates payments. Each amount becomes a product `pokemon-survivors-donation-<reais>` the first time it's given |
| `ABACATEPAY_WEBHOOK_SECRET` | Optional. The AbacatePay webhook's secret: `whsec_` plus base64 (`echo "whsec_$(openssl rand -base64 32)"`), the same one typed in its dashboard. Without it the webhook answers 503 |
| `STRIPE_WEBHOOK_SECRET` | Optional. The Stripe webhook endpoint's signing secret (`whsec_…`). Without it the webhook answers 503 |
| `STRIPE_PAYMENT_LINK` | Optional. The donation Payment Link's id (`plink_…`): set, the webhook ignores other Checkout Sessions of the account |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | Optional. The community Discord bot's token and the server's id. Without both there's no bot |
| `POSTHOG_KEY` | Optional. The game's PostHog project token (`phc_…`, the same as the client's `VITE_POSTHOG_KEY`): 500s, uncaught exceptions and rejections go to its error tracking (`src/errors.ts`), tied to the player's id when the request had one. Without it errors only go to the log |
| `DISCORD_BUG_FORUM_ID` | Optional. The #bug-reports forum's channel id, where bug reports go. Without it the bot finds the forum by name |
| `PORT` | Default `3000` |

## Database

Migrations are plain SQL files in `migrations/`, run in name order at boot (each once, tracked in the `migrations` table). To change the schema, add the next numbered file; never edit one that already ran.

- `users`: one row per Clerk user id, with the public `handle` (unique, lower case) and display `name`, null until the player picks them.
- `saves`: one JSONB save per user, with the save's schema `version` and a `revision` bumped on every push.
- `runs`: one row per ranked run, created at its start (the id is the start token) and filled when it ends. Unfinished rows never show, and are dropped after 7 days.
- `follows`: who follows whom, one way.
- `runs.replay`, `runs.verified`: the replay waiting for its check, and the verdict (null while pending, or when the run wasn't checked).
- `runs.branch`: the branching evolution the run took (`BranchId`, Espeon, Gallade…), so the boards show the form it ended in. Null when it took none, and on every run before it was stored (those keep showing the line's own form).
- `gifts`: each player's Mystery Gifts (`kind`, `payload` = `GiftContent`, `reason`, a per-player unique `key`, `claimed_at`).
- `users.referred_by`, `referred_at`, `referral_credited_at`: who brought the player and when the invite counted.
- `runs.challenge`, `runs.official`: the Desafio do dia a run plays (its day) and whether it's the player's official attempt of that day.
- `donations`: one row per donation (`provider`, its `ref`, the account it's for, the amount and points, the `code` of one with no account, `paid_at`, `credited_at`).
- `users.supporter_points`, `supporter_since`, `supporter_public`: a supporter's total, since when, and whether they show it. `poll_votes`: the supporters' poll.
- `suggestions`: the idea board (`status` `open`, `done` or `hidden`, `score` recounted from the votes on every vote, `done_at`). `suggestion_votes`: one vote per player per idea (1 or -1; taking it back deletes the row).
- `users.discord_id`, `discord_name`: the Discord account a player linked (one game account per Discord account).
- `bug_reports`: each bug report (`user_id`, null for a guest; `text`; `tech`, the `BugTech` JSON or null; `thread_id`, the forum thread once posted).
- `discord_posts`: what the Discord bot already did, by key (`patch:<date>`, `challenge:<day>`, `podium:<day>`, `outbreak:<day>`, `welcome:<user>`, `short:<message>`), with the message a patch note became so it can be edited.

## Local development

```bash
docker run -d --name survivors-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=survivors -p 5433:5432 postgres:17-alpine
cp .env.example .env   # fill CLERK_SECRET_KEY
npm install
npm run dev            # http://localhost:3000
```

In the game, set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL=http://localhost:3000` in `.env.local` at the repository root.

`npm run typecheck` checks the server together with the shared game code; CI runs it.

## Deploy (Dokploy)

### What runs

The Dokploy project **Pokémon Survivors** has two services:

- **Postgres 18** `survivors-postgres-kwkfm5`, with no external port. Only the API reaches it, over Dokploy's internal network.
- **App `api`**: built with the Dockerfile `server/Dockerfile` and build context `.` (the repository root, since the API bundles `src/`). It listens on container port `3000` behind `api.pokemonsurvivors.com`, with a Let's Encrypt certificate.

### When it deploys

A push to `main` deploys the API automatically, but only when it touches `server/**`, `src/game/**`, `src/data/**`, `src/engine/**` or `src/site/**` (the Discord bot posts the changelog). Those are the folders the API bundle imports. **If the bundle starts importing another folder of `src/`, add it to this list in Dokploy** (and here). Otherwise a change there ships to the site but not to the API, and the two drift apart.

### Rollout

New versions roll out with no downtime:

- The new container starts before the old one stops (start-first).
- If its `HEALTHCHECK` (`/health`) doesn't pass within 30 s, Swarm rolls back to the previous version on its own. That includes a migration that breaks the boot.

### Migrations

- The files are numbered and only move forward. Never edit a migration that already ran: add the next file.
- Every change must work with the previous version of the API, since both run side by side during a rollout. For example, add a nullable column first, and drop the old one only in a later PR.
- All pending migrations run in one transaction, so a failure leaves nothing half applied.

### Environment

| Variable | Where | |
| --- | --- | --- |
| `DATABASE_URL` | Dokploy (`api`) | Internal connection string of `survivors-postgres-kwkfm5` |
| `CLERK_SECRET_KEY` | Dokploy (`api`) | Production instance secret key |
| `ABACATEPAY_API_KEY` | Dokploy (`api`) | AbacatePay production key, with `CHECKOUT:CREATE`, `PRODUCT:CREATE` and `PRODUCT:READ` |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | Dokploy (`api`) | The "Pokémon Survivors" bot's token and the community server's id |
| `POSTHOG_KEY` | Dokploy (`api`) | PostHog (US cloud) project token, public |
| `DISCORD_BUG_FORUM_ID` | Dokploy (`api`) | The #bug-reports forum's channel id (optional: found by name without it) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Vercel, production only | `pk_live_…`, which only works on `pokemonsurvivors.com` |
| `VITE_API_URL` | Vercel, production only | `https://api.pokemonsurvivors.com` |
| `VITE_POSTHOG_KEY` | Vercel, production only | The same PostHog project token: the game's events and errors (`src/analytics.ts`) |
| `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID` | Vercel, production only | A PostHog personal key with error tracking write access and the project's id, for `scripts/sourcemaps.mjs` to upload the source maps |

### Local development

The `pk_live` key doesn't work on `localhost`. To test sign-in locally, put the keys of Clerk's **development** instance in `.env.local` at the repository root (and its secret key in `server/.env`).

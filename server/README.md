# Accounts API

Small Node API behind the optional accounts: each signed-in player's save, synced across devices. Hono on Node 24, Postgres through [`postgres`](https://github.com/porsager/postgres), Clerk session tokens checked with `@clerk/backend`.

The merge rules are not here: `mergeSaves` and `applyPush` live in `src/game/sync.ts` and the game uses the same code. The build bundles them in (`esbuild`), so the image only runs `dist/index.js`, as the API or, with `ROLE=checks`, as the verifier (see [Verification by re-simulation](#verification-by-re-simulation)).

## Routes

| Route | |
| --- | --- |
| `GET /health` | 200 while Postgres answers, else 503 |
| `GET /save` | The player's `{ save, revision }`, 404 before the first push |
| `PUT /save` | Body `{ save, base }`: the device's save and the revision it last got (`null` if it never synced). Stores the save as is when `base` is the latest revision, else merges both. Either way the player's ranked wins add their clears (`wonClears`), and gift-only rewards (gift titles, ribbons, shiny tickets, styles never sold, the companion) stay only if the player's gifts brought them (`keepGiven`). After a [reset](#resetting-a-save), a push from a device that hasn't seen it stores nothing and gets the reset save back. Returns `{ save, revision, merged }` |
| `GET /me` | `{ profile }`: the player's `{ handle, name }`, `null` before they pick them |
| `PUT /me` | Body `{ handle, name }`. 400 when invalid, 409 `{ suggestion }` when the handle is taken |
| `POST /runs` | Body `{ challenge? }`. `{ token, seed, outbreak, halloween, rules }` for the player's next run: the start token (the id of a new `runs` row), the seed the run must play, the day's outbreak and whether the day is haunted by the server's clock (`outbreakAt` and `halloweenAt`, the day `outbreakFits` and `halloweenFits` check; a challenge run plays its own), and the `RULES_VERSION` its replay must play by (a game behind it reloads into the newer build before the run, so the run isn't refused as `outdated`). It replaces the player's other unfinished token of the same kind, unless it's a regular run already streaming (see [Ranked runs](#ranked-runs)). 429 past 30 tokens in 10 minutes. With `challenge` (a Brasília day, `YYYY-MM-DD`) it's that day's Desafio do dia, with the day's seed; 400 when that challenge isn't open (its day, or 10 minutes past it) |
| `POST /runs/:token/start` | The run of a token asked for ahead starts now: its clock restarts. 204; 404 unknown or finished token, 409 replaced by a newer one |
| `PUT /runs/:token/chunks/:seq` | Body `ReplayChunk` (`src/game/replayStream.ts`): the replay's ticks `[from, to)` (15 to 30 s of them) while the run plays, chunk `seq` 0, 1, 2… (see [Replay streaming](#replay-streaming)). `{ lag }`, how many seconds late it came (null for a retry of a chunk already in, which changes nothing). 400 wrong shape or size, 404 unknown token or a run that ended (a victory's goes on, into endless mode), 409 replaced token, a `seq` another chunk holds (`committed`) or a chunk that doesn't start where the stream is (`gap`), 422 more play than the wall clock since the start allows |
| `PUT /runs/:token` | Body `RunResult & { replay }` (`src/game/ranking.ts`, `src/game/replay.ts`). Records how the run ended and returns `{ ranks: { day, week, all }, challenge, listed }` (`ChallengePlace` for a challenge run, else null; `listed` false when, with `STREAM_ENFORCE` on, its replay wasn't streamed in time and the run stays off the boards). 400 implausible, without a replay, a replay of another run (or of a screen bigger than the game shows, `parseView`), `seed` (a replay of another seed than the token's), `outdated` (a replay of older rules than the API's, unless it's a run that straddled a rules deploy: see the Rules bullet in [Ranked runs](#ranked-runs)) or a challenge run whose replay isn't its day's challenge, 404 unknown token, 409 a replaced token, one that contradicts what the run recorded, or `rewrite` (a replay that changes inputs its chunks committed), 422 more play than the wall clock since the token allows, 503 a replay of newer rules (the API isn't deployed yet; the game keeps it and sends it again) |
| `GET /boards/:difficulty` | `?period=day\|week\|all&starter=<id>&friends=1`. `{ entries, me }`: the top 50, each player once with their best run (its id in `run`, to report it), and the asker's own line. Banned players never show |
| `GET /challenge/:day` | `?friends=1`. `ChallengeBoard`: the day's official attempts (top 50, the asker's line), how many took part and whether the asker made theirs (`attempted`) |
| `GET /profiles/:handle` | The public profile: name, title, Pokédex counts, records, recent runs, follower counts. 404 if nobody has the handle, or its player is banned |
| `PUT /follows/:handle`, `DELETE /follows/:handle` | Follows or unfollows. `{ followed, followers, friend }`: following someone who follows back makes friends (see [Friends, presence and co-op invites](#friends-presence-and-co-op-invites)). 429 past 60 follows in an hour |
| `GET /players` | `?q=` a handle prefix (2+ characters, with or without `@`). `{ players }`: up to 8 `PlayerMatch` (`src/game/friends.ts`), each with its `relation` to the asker (`none`, `following`, `follower`, `friend`), never the asker. 429 past 30 searches a minute (120 per IP) |
| `GET /friends` | `FriendList`: `friends` (mutual follows), `incoming` (requests: they follow me) and `outgoing` (I follow them), by handle |
| `DELETE /followers/:handle` | Declines `handle`'s request (drops their follow). `{ ok }`, 404 unknown handle |
| `DELETE /friends/:handle` | Unfriends: drops the follows both ways. `{ ok }`, 404 unknown handle |
| `PUT /presence` | Body `PresenceUpdate` `{ activity, room? }`: a heartbeat (`lobby`, `room` with its code, or `run`, with the code in a co-op run). `PresenceView`: `{ friends, invites, appearOffline, beatMs }`, every friend's `FriendPresence` (`online`, `activity`, `room`), the live co-op invites, and when to beat next. 400 invalid, 429 past 12 a minute |
| `DELETE /presence` | Offline now (the player left the lobby or signed out). `{ offline }` |
| `PUT /presence/settings` | Body `{ appearOffline }`. `{ appearOffline }` |
| `POST /coop-invites` | Body `{ to, room }`: invites the friend `to` into a co-op room. 201 `{ expiresAt }` (10 minutes). 404 when `to` isn't a friend (or nobody has the handle), 429 past one per friend every 10 s or 30 in 10 minutes |
| `DELETE /coop-invites/:id` | Dismisses an invite the player got. `{ dismissed }`, 404 unknown |
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
| `GET /poll`, `PUT /poll` | `{ id, votes }`, the supporters' poll (`POLL` in `src/data/supporters.ts`). `PUT` with `{ choice }` votes (or changes the vote); 403 for anyone who isn't a supporter |
| `GET /suggestions` | `?sort=top\|new\|done`. `{ suggestions }`: a tab of the idea board (100 at most), open ideas by score or newest first, or the shipped ones; each `Suggestion` (`src/game/suggestions.ts`) has the asker's `vote` and whether it's theirs (`mine`) |
| `POST /suggestions` | Body `{ title, body }` (`parseSuggestionDraft`). 201 `{ suggestion }`, posted with the author's up vote. 400 invalid, 403 before the player has a handle, 429 past 3 ideas in 24 hours |
| `PUT /suggestions/:id/vote` | Body `{ vote }`: 1, -1, or 0 to take it back. `{ score, vote }`. 404 unknown or hidden, 409 shipped |
| `POST /bug-reports` | Body `{ text, tech? }` (`parseBugReport` in `src/game/bugReport.ts`): what the player wrote and, unless they turned it off, the technical info the game gathered. Guests too; with a token the thread shows the player's handle. 201 `{ id }`: stored, and posted to Discord in the background (see [Bug reports](#bug-reports)). 400 invalid, 429 past 5 reports in an hour from the IP or the account |
| `POST /reports` | Body `{ target, run?, reason, note? }` (`parseReport` in `src/game/reports.ts`): a player's handle, the id of their run on a board when it's about one, `cheating`, `name` or `other`, and up to 200 characters. 202 `{ received: true }` whatever became of it (see [Reports and bans](#reports-and-bans)). 400 invalid or `self`, 429 past 10 reports in 24 hours |
| `GET /admin` | `{ admin: true }` for an admin (see [Admin gift desk](#admin-gift-desk)), 403 for anyone else, like every `/admin` route |
| `GET /admin/users` | `?q=` a handle (with or without `@`, in part) or an email (in part, asked of Clerk). `{ users }`: up to 10 `AdminUser` with their email and when they were last seen |
| `POST /admin/gifts` | Body `{ userId, content, request }`: sends a Mystery Gift (`parseAdminGift`: any `GiftContent` but a ribbon). `request` is a uuid per send, so a retry sends nothing twice: `{ sent }`, false when it already went. 404 for an unknown player |
| `GET /admin/gifts` | `{ gifts }`: the last 30 gifts sent by hand (`AdminSent`), with when they were claimed |
| `GET /admin/reports` | `{ groups, open }`: the open reports grouped by run, or by player when there's no run (`ReportGroup`, `groupReports`: count, reasons, notes with who left them, the player and their ban, the run's numbers and whether it verified), the most reported first, and how many reports are open |
| `POST /admin/moderation` | Body `{ userId, action, run?, reason? }` (`parseModeration`): `remove` (the run leaves the boards), `reset` (wipes the save, see [Resetting a save](#resetting-a-save)), `ban` (a reason is required), `unban` or `dismiss`. Resolves the reports it answers. `{ resolved }`, 404 for an unknown player or run |
| `PUT /admin/suggestions/:id` | Body `{ status }`: `done` (shipped, stamps `done_at`), `open` again, or `hidden` (off the board). `{ status }`, 404 for an unknown idea |

`/save`, `/me`, `/runs` (and its chunks), `/follows`, `/players`, `/friends`, `/followers`, `/presence`, `/coop-invites`, `/gifts`, `/referral`, `/donations/redeem`, `/me/supporter`, `PUT /poll`, `POST /suggestions`, `PUT /suggestions/:id/vote`, `POST /reports` and `/admin` need `Authorization: Bearer <Clerk session token>`. `/boards`, `/challenge`, `/profiles`, `GET /suggestions` and `POST /bug-reports` are public and read the token when there is one (`friends=1` needs it). CORS allows `https://www.pokemonsurvivors.com`, `https://pokemonsurvivors.com`, any `http://localhost` port and whatever `CORS_ORIGINS` adds.

### Ranked runs

The server picks a ranked run's seed, so nobody can try seeds offline and pick an easy one, or play a run out before asking for its token (the game is open source and the simulation is deterministic).

- `POST /runs` deals a start token and its seed (`runs.seed`): random from `crypto.randomInt` in the 32 bits the simulation reads (`RANKED.seedSpan`), or the day's challenge seed for a Desafio do dia run. When the run ends, its replay's `start.seed` must be that seed (`reportProblem`), else 400 `seed`. Rows from before the server dealt seeds (null) take any.
- **One live token per kind:** a new token replaces the player's other unfinished token of the same kind, regular or challenge (`runs.replaced_at`), which can't report anymore (409). So a player holds one seed at a time and can't keep several to pick from. Replaced rows still count for the start limit (30 in 10 minutes), which bounds how fast anyone can throw seeds away. The kinds are apart so the game can hold one of each; challenge tokens are single too, so nobody plays several attempts at once to report the best one first. A regular token whose run already streamed a chunk is the exception: it's in play, its seed spent, and stays live, so another tab or device asking ahead (its lobby prefetching) doesn't kill it. Holding several regular runs at once gives nothing a restart doesn't.
- Two devices or tabs at once: the last one to ask holds the live token. A run started on the other before its first chunk comes out unranked (its `/start` answers 409); one already streaming keeps going and still counts.
- The game asks for its token ahead, on the lobby, the partner select, the challenge screen and the results (for Play again), so Play never waits; it first sends the results still queued, since the new token replaces the unfinished one. A run that starts without a token in hand (offline, rate limited, Play pressed before it came) plays a seed of the game's own and is unranked.
- When the run really starts the game calls `POST /runs/:token/start`, which moves `started_at` to now: the time spent on the menus doesn't widen the clock budget, and the run counts for the day and week it was played. It can only shorten the budget, so skipping it gains nothing a pause doesn't.
- **Rules:** a replay must play by the API's `RULES_VERSION` (else 400 `outdated`), so the token says which (`rules`). A game behind them (a tab opened before a deploy that changed the rules) reloads into the newer build before its next run, once that build is live on the site, instead of playing a run the API would refuse.
- **A run that straddles a rules deploy** still counts: the token pins the rules of the API that dealt it (`runs.rules`), and the next API takes a replay of the previous rules when its token is pinned to them and was dealt at most `RULES_GRACE_SECONDS` ago (`src/rulesGrace.ts`: `RANKED.maxTime` plus two hours), re-simulated with the previous rules' frozen simulator it ships (`sims/`, see [`sims/README.md`](sims/README.md)). The pin is the server's, so a replay that claims older rules than its token's is still `outdated`, as is anything two versions back or past the window, and a token from before migration 022 (no pin). The results screen shows such a run as usual, and the game reloads into the newer build before its next run (the next ticket's `rules` says it's behind). Each bump runs `npm run rules:freeze` (the test in `src/sims.test.ts` fails until it does). Only one previous version is kept, so still batch rule changes: two bumps within the window refuse the runs two versions back.
- The outbreak comes with the token too: a ranked run plays the one the server dealt, so a device whose clock is a day or more off still plays a run that fits `outbreakFits` (a ticket held for 20 hours or more falls back to the device's day, since the run may start two days later). Guests and unranked runs play the device's day. A game that ignores `outbreak` keeps working, judged by `outbreakFits` as before. The same goes for `halloween` (Noite das Bruxas): a ranked run is haunted when the server said so, and `halloweenFits` takes a haunted run on an event day or the day after, so a ticket dealt at 23:59 on the last day still fits when its run starts after midnight (and one dealt at 23:59 the day before the event plays unhaunted, which always fits).
- A game from before server seeds ignores `seed` and plays one of its own. Its token from before this API has no seed and takes any, so a run that straddled the deploy still counts; a token it got after is refused (400 `seed`, which it shows as off the ranking) until the tab reloads. Nothing a client says can exempt a run from the check, since a cheater would say the same.
- A run that reported may only report again grown after a victory (endless mode); any other longer report is 409, so a short run can't keep its seed on hold for later.

The server takes a result only if the wall clock since the token's start is at least the time survived, minus a 30 s slack for a start that arrived late (the simulation never runs faster than real time, and pausing only widens the gap). It also checks plausible numbers (`parseRunResult`). A victory that goes on into endless mode sends again with the same token; the run may only grow. Day and week boards start at midnight and on Monday in America/Sao_Paulo, and a run counts for the period it started in.

### Replay streaming

The simulation is deterministic, open source and much faster than real time, so with a seed in hand a bot could search a run offline (die at 2:50, rewind to 2:40, try another path), wait out the wall clock and send a perfect replay, which re-simulation would verify. So a ranked run's replay reaches the API while it plays, and what's in is committed: the report must keep it.

- **Chunks** (`src/game/replayStream.ts`, `src/ranking.ts`): every 15 s of play (`STREAM.ticks`, counted in ticks, so pauses and level-up screens cut nothing) the game cuts the recorder's new ticks (their moves and events) and sends them to `PUT /runs/:token/chunks/:seq`, in order, after `/start`. A chunk that can't go (offline, an expired session) waits and is sent again (2 s, doubling to 30 s), and the result of the run waits behind its chunks; any other failure (a refusal, a 5xx, an API without the route) ends the stream, so a result never waits on a broken chunk route. A retry of a chunk already in changes nothing. Guests and unranked runs send nothing. The cut reads only the new stretch of the recorder, at most once per 15 s.
- **Checks on each chunk** (`putChunk`): the player's token, not replaced, unfinished (or finished as a victory: endless mode goes on), `seq` next in line, starting at the tick where the last one ended, 15 to 30 s of ticks and 2,000 events at most, and no more play than the wall clock since `started_at` allows (`clockAllows`).
- **Lag** (`commitLag`): how late a commitment came, past the play its new ticks take, counted from the last commitment (the first chunk from when the seed was dealt, `runs.issued_at`, since a seed known on the menus could be searched before `/start`). Real time only runs ahead of game time (pauses, level-up screens, the results screen before endless mode), so an honest stream lags by what the player waited plus the network, and a bot by its search. The run keeps its worst (`runs.stream_lag`) and counts the commitments more than `STREAM.lagTolerance` late (`runs.stream_late`): an honest player pauses a few times a run (switching tabs pauses the game), while a bot searching offline would lag on almost every chunk. It's counted per commitment rather than as the whole stream's distance to the wall clock, which every level-up screen and pause of a long run would add up. The game asks for a fresh ticket when the one in hand is 2 minutes old, so menu time doesn't count against it.
- **The report** (`finishRun`, `settleReport`): its replay must keep every committed input, else 409 `rewrite`. It then pins all its ticks by the sha256 of their canonical form (`runs.stream_base`, `stream_digest`), so a later report of the same run (endless mode) can't rewrite them either, and the chunks it covers are deleted. A victory's report is timed like a chunk (the run may go on from it); a faint's or a quit's isn't. Its **tail**, the ticks it brings past the stream, may be at most 30 s (`STREAM.tailTicks`). Chunks of runs that never reported are swept a day later.
- **Observe or enforce.** A report was streamed in time (`streamedInTime`, stored in `runs.stream_ok` and logged) when its tail fits and no commitment came more than 3 minutes late (`STREAM.lagTolerance`). With `STREAM_ENFORCE` off (the default) nothing else changes. With it on, a run that wasn't stays off the public boards for good (`runs.unlisted`: the boards, the challenge board, ribbons, the Discord podium) but still counts for the player (profile, records, clears), and the results screen says the connection dropped (`listed: false`). A game from before streaming sends no chunks, so with enforcement on its runs longer than 30 s stay off the boards; `watchDeploys` reloads it once its player is back on the menus.

Before turning enforcement on, measure honest lag over the last days (seconds; `stream_seq > 0` keeps games that stream):

```sql
select count(*) as runs,
  percentile_cont(array[0.5, 0.9, 0.95, 0.99]) within group (order by stream_lag) as lag_p50_p90_p95_p99,
  count(*) filter (where stream_lag > 180) as lag_over_3_min,
  count(*) filter (where not stream_ok) as not_in_time,
  percentile_cont(0.95) within group (order by extract(epoch from started_at - issued_at)) as menu_wait_p95
from runs
where finished_at > now() - interval '7 days' and stream_seq > 0;
```

And how many late commitments runs have (counted since migration 018), to pick how many enforcement could forgive:

```sql
select stream_late, count(*) as runs, round(avg(stream_seq)) as avg_chunks, round(max(survived) / 60) as longest_min
from runs
where finished_at > now() - interval '7 days' and stream_seq > 0
  and issued_at > (select ran_at from migrations where name = '018_stream_late.sql')
group by stream_late order by stream_late;
```

And the longest runs enforcement would have kept off the boards, to see whether they look honest:

```sql
select r.id, u.handle, r.difficulty, r.survived, r.stream_lag, r.stream_late as late, r.stream_seq as chunks, r.version
from runs r join users u on u.id = r.user_id
where r.finished_at > now() - interval '7 days' and r.stream_ok is false
order by r.survived desc limit 50;
```

Requests: one chunk every 15 s of play per player in a ranked run (240 an hour, ~1 to 3 KB each), each one transaction with a row lock, an insert and an update.

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

### Friends, presence and co-op invites

Friends are mutual follows (`src/friends.ts`, rules in `src/game/friends.ts`): following someone is a friend request (the other player sees it in `incoming`), following back accepts it, `DELETE /followers/:handle` declines it and `DELETE /friends/:handle` drops both follows. Guests have no friends: they join co-op rooms by link.

- **Presence is short polling, not a socket.** While the game is somewhere friends care about it sends `PUT /presence` every `beatMs` (20 s in the lobby or a co-op room, 3 min in a run) while the page is visible, and stops (`DELETE /presence`) when it leaves. A player reads online until two beats of their activity plus 10 s went by (`presenceOnline`). Each heartbeat is one upsert and two reads; nothing stays open, so idle players cost nothing, and the state is in Postgres, so a deploy (two instances side by side) changes nothing.
- Only mutual friends see a player's presence, and their room code. "Appear offline" (`users.appear_offline`) shows them offline to everyone, room included.
- An invite (`POST /coop-invites`) is one row per sender and friend (a new one replaces the last), shown in the friend's next heartbeat for 10 minutes unless dismissed, and only while both still follow each other. It goes whether the friend looks online or not, so appearing offline gives nothing away. The room code is checked loosely (`parseRoomCode`); the relay owns its format.
- The rate limits (searches, follows, invites, heartbeats) are in memory per instance (`src/rateLimit.ts`).

### Supporters

Donating with an account brings a cosmetic thank-you, sent as Mystery Gifts (`src/game/supporters.ts`). Nothing of it touches a run.

- A donation is tied to an account by its handle: the support page sends it to `POST /donations` (AbacatePay, whose checkout gets `externalId` `pokemon-survivors-donation:<ref>`) or puts it in the Stripe Payment Link as `client_reference_id`. Both come back to the page with `?thanks=<ref>` (Stripe's redirect, set in its dashboard, uses `{CHECKOUT_SESSION_ID}`).
- The webhooks (`src/webhooks.ts`) say it's paid. `src/supporters.ts` records it once (`donations.ref` is unique, so retries change nothing) and credits it: its points (`donationPoints`: one per centavo, five per US cent) join `users.supporter_points`, and each tier the total reaches sends its gifts once (`TIER_GIFTS`, `key` `support:<tier>:<i>`): any donation brings the Supporter title and frame and a shiny of one's choice; 5,000 points (R$ 50 or US$ 10) the gold background and wallpaper.
- A paid donation without an account gets a code (`PS-XXXX-XXXX`) that the thank-you page shows; any signed-in player can redeem it once (`POST /donations/redeem`).
- Boards and profiles show the badge (`supporter`) unless the player hides it (`users.supporter_public`); the same flag keeps them off the wall and the victory's credits. The supporters' poll keeps one vote per player per poll (`poll_votes`).

### Festival da Praça

A community ₽ pot at the plaza's fountain (`src/festival.ts`, festivals as data in `../src/data/festivals.ts`, rules in `../src/game/festival.ts`). Its milestones are Mystery Gifts for every player, guests included, but no row goes into `gifts`: the game builds them from `GET /festival` (ids `festival:<festival>:<milestone>` and `festival:<festival>:patron`, game-made like the candy jar's, `isGameGift`), and every push vouches for the ones a save applied with the pot and the player's donations this API sums itself (`festivalTotals`, run only for a save that opened one), so an edited save can't keep the Lantern frame or the Mecenas title.

- **Only the API takes ₽**, from the save it stores, in one transaction that locks the player's `users` and `saves` rows (`POST /festival/donate`). The amount leaves the wallet and joins the save's `spent` (`donateFrom`), so `mergeSaves` never refunds it; the new save goes in at the next revision and comes back for the device. The request carries the device's revision (`base`): one behind the stored save gets 409 `stale`, and the game syncs and tries once more. ₽ that never synced can't be donated.
- **Who may:** a signed-in account with a @handle and at least 3 verified runs (counted like an invite, `FESTIVAL.minRuns`), not banned (`BAN_GATED`), while a festival runs, up to ₽200k per Brasília day (`FESTIVAL.dailyCap`, every donation not voided counts) and never more than the stored wallet. 10 tries a minute per account.
- **Held:** a save whose wallet is above ₽20M (`FESTIVAL.heldWallet`) donates `held`: it's spent at once but counts in the pot (and for the Mecenas title) only once the admin approves it (`POST /admin/festival/:id/approve`). The admin may also void any donation (`/void`): it never counts and its ₽ stays spent. Both are logged. Voiding below a milestone takes that milestone's frame or title back at the players' next push.
- **The board** (`GET /festival`): every festival's pot, the shown festival's top 10 donors by @handle (counted donations, players who show their name: `PUT /festival/public`, `users.donor_public`), how many gave, and with a token the player's own (with their place among all the festival's donors, `rank`). The public part is cached 30 s per instance (dropped on a donation that counts, a review or a plaque setting).

### Admin gift desk

For gifting players by hand (someone who talked about the game on social media, say). The desk lives in the game's account dialog ("Painel admin", `src/ui/admin.ts`), shown only when `GET /admin` answers 200.

- Who is admin is decided here and nowhere else: a signed-in user with a **verified** email in `ADMIN_EMAILS` (comma separated). The API asks Clerk (`users.getUser`) and keeps the answer 5 minutes per user (`src/admin.ts`); without `ADMIN_EMAILS` nobody is admin and Clerk is never asked. Every `/admin` route sits behind the same check, so whatever the page shows, a request from anyone else gets 403.
- The search reads handles from our `users` table and emails from Clerk (we don't store them). A Clerk account that never synced still shows and can get a gift: it gets its `users` row, and the gift waits in its inbox.
- A gift goes through the same inbox as every other (`sendGift`), with reason `{ kind: 'staff', from: <admin's handle> }` (the banner says "Um presente de @…"), key `staff:<request>` and `gifts.sent_by` the admin, which is what the recent list reads. Each send is logged.

### Reports and bans

Moderation is reactive: a run still counts as soon as it's reported, and nothing waits for an admin. Only a report brings a run or a player before one.

- A signed-in player reports a run from its board row (the flag) or a player from their profile (`POST /reports`, `src/moderation.ts`). One report per reporter per run, or per player when there's no run; 10 a day per reporter. Reporting oneself is refused. The answer never says anything about the target: an unknown handle, a run that isn't theirs and a repeat are dropped as if stored.
- The admin panel's **Denúncias** tab (`src/ui/admin.ts`, its tab label counts the open reports) lists them grouped (`groupReports`), and acts on a group: **Tirar a run** (`runs.verified = false`: off the boards and the profile), **Zerar o save** (in one transaction, exactly what [Resetting a save](#resetting-a-save) does by hand), **Banir** or **Desbanir** (with a reason), or **Descartar**. Every action resolves the reports it answers (`resolved_at`, `resolved_by`, `resolution`): a run's removal or dismissal closes that run's reports, a player's dismissal the ones without a run, and a reset, ban or unban every open report on the player. The panel's player search has Banir/Desbanir and Zerar too, to act without a report. Each action is logged.
- A ban (`users.banned_at`, `banned_reason`) refuses the account's writes with 403 `{ error: 'banned' }`: `POST /runs`, `POST /runs/:token/start`, `PUT /runs/:token/chunks/:seq`, `PUT /runs/:token`, `PUT /save`, `POST /reports`, `POST /suggestions`, `PUT /suggestions/:id/vote`, `PUT /poll`, `POST /coop-invites`, `POST /festival/donate` and `PUT /festival/public` (`BAN_GATED`, checked in `auth`). Reads still answer. The player leaves every board, the challenge board, public profiles (404), the supporters wall, the idea board, the ribbons, the Discord podium and the `/players` search. The game keeps playing as a guest would: a run start gets no token (unranked), a queued result is dropped as rejected, and the save stays on the device (the sync shows offline).

### Verification by re-simulation

Runs are trusted: one counts on the boards as soon as it's reported, and only a failed check takes it off. So every result must come with a replay this API can judge (`src/game/replay.ts`, of its own `RULES_VERSION`, or of the previous one for a run that straddled the deploy, judged by the frozen simulator in `sims/`): one without, or of other rules, is never taken, since nothing could ever take it off. Only runs on show are re-simulated, and that's decided as each one reports (`finishRun`, `checkRank` in `src/checkRank.ts`): the replay is kept when the run is a challenge's official attempt, or the player's line within the top 60 of its mode and difficulty's day, week or all-time board, or the top 4 of its Pokémon's (`CHECKED.top`: the 50 and 3 on show with a 20% margin, so a run a failed check lets climb in still has its replay). A run below those can't climb later in the same period, since boards only get better. One more run every 72 minutes (~20 a day, whatever the traffic; the last one kept is read from the database, so restarts and a second instance don't add more) is kept for the determinism sample. Every other replay is dropped right there (`runs.replay` null, as for a run that sent none), and an endless run decides again on each report. A kept run stores its place in `runs.check_rank` (0 for an official attempt, its best rank, `CHECKED.sampleRank` for the sample), the order the checks take. Ranks are counted as if the player had a handle, so a run of someone who picks one later still had its check. The API never re-simulates: the **verifier** does, the same image in its own process (`ROLE=checks`, `src/verifier.ts`), at the lowest OS priority and under its own CPU limit, so a backlog can never starve the API. It pulls from the database (`src/checks.ts`): it claims the next pending run in `check_rank` order (`claimCheck`, `for update skip locked`, for 30 minutes: two verifiers side by side in a rollout never take the same run, and a claim whose verifier died runs out), re-simulates it if it's still within `CHECKED.top` (`shown`) or a sample, and waits 5 s when nothing is pending. One that fell off loses its replay unchecked. A restart loses nothing, since the queue is the table. Checks run one at a time on a worker thread (`src/verify.ts`, bundled to `dist/verify.js`), so the verifier's `/health` never waits on them; the worker picks the simulator of the replay's rules (`src/sims.ts`) and imports the frozen one only the first time a previous-rules run needs it. The run is verified when the replay ends on the same time, faints and level it reported, even when it ends on an open level-up (`stuck`, which the log notes); otherwise it's marked failed and counts nowhere. The branch isn't judged: a verified run takes the one its replay took over the one the game reported (which `parseRunResult` already keeps only when it's of the run's family, at a stage it reached). Boards and profiles never show whether a run was checked. A verified run's replay is dropped; a failed one keeps it, to look into. If the worker itself fails, the run stays pending and is tried again once its claim runs out 3 times at most (`check_attempts`, `CHECK_LOOP.attempts`): then the verifier gives up and drops its replay, and the run stays unverified. A replay of newer rules than the verifier's (its deploy lags behind the API's) is claimed and put back the same way, but gives its attempt back, so it waits for the updated verifier however long that takes. Runs from before `check_rank` come last. `CHECKS=off` keeps the verifier idle, replays kept. Locally, `ROLE=checks npm run dev` runs the verifier next to the API's `npm run dev`; under tsx the check runs in place, since a worker can't load the TypeScript source.

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
- **The staff's bot:** staff (**Dev**, **Moderator** or the server's owner) tag the bot in any channel but #introductions, often replying to a player, and an LLM on OpenRouter does what they ask (`src/staffAgent.ts`, a tool loop of at most 5 rounds over `src/staffTools.ts`), answering in the language they wrote in. It reads the staff message, the one it replies to and that player's messages right before it (up to 5 minutes apart). Its tools:
  - `game_lookup`: the game's own data on a Pokémon, move, held item, Ability or Mega (`src/gameKnowledge.ts`). The system prompt also carries `public/llms.txt` (copied next to the bundle in the image) and the newest 3 changelog updates, read once at boot. It's told to say it doesn't know rather than invent.
  - `lookup_player`: a player by Discord mention/id (`users.discord_id`) or @handle: when they joined and last played, Discord linked, supporter tier, ban, finished runs per difficulty.
  - `add_idea`: the idea straight to the board's Backlog with the author's vote, past the review and the daily limit, credited to the replied player's linked game account, or the staff member's (it asks to link when neither has one).
  - `report_bug`: a thread in #bug-reports (stored in `bug_reports` like the game's, no technical info, signed by the staff member, with a link back to the message).
  - `send_gift`: an egg or ₽ as a Mystery Gift from the staff member's @handle (`src/staffDesk.ts`), within `STAFF_GIFTS` (`src/staffGifts.ts`): staff send common and rare eggs, up to ₽2,000 a gift and 5 eggs and ₽5,000 per Brasília day each; the owner any of common, rare and ultra, with no daily cap. Each gift's key (`dstaff:<staff>:<day>:<message>:<n>`) counts the allowance and keeps a retry from sending twice, and each one is logged in #mod-chat.
  - `coop_beta`: lets a player into the co-op beta, takes one out or lists who's in it (`src/coopBeta.ts`). The beta is the PostHog flag `coop-beta`, which lets in the @handles listed in its condition on the person's `handle`; the bot reads the flag, edits only that list and writes it back with the flag's `version` (PostHog answers 409 if the flag changed in between, and the bot tries again). Letting in needs a game account with that handle (found by @handle or linked Discord, so a typo lets nobody in); co-op shows in the player's lobby once they reload the game. Each change is logged in #mod-chat. Off without `POSTHOG_PERSONAL_API_KEY`.
  The reply is the LLM's text, then what the tools did as the bot words it (the gift sent and to whom, the bug's thread, the idea's card). ⚠️ on the staff message means it failed (see the log). Tags from anyone else are ignored. Off without `OPENROUTER_API_KEY`.
- **Slash commands** (`src/discordCommands.ts`), registered on the server on boot: `/ask` (the LLM with the read-only tools, answered in the channel), `/idea text [player]` (the LLM writes it up, `src/ideaWriter.ts`), `/bug text`, `/player who` (only the asker sees it), `/gift player kind [amount]` and `/coop-beta add|remove player` or `/coop-beta list`. Only members with Manage Messages see them (the staff roles), and the bot checks the roles again on each use. They come through the gateway (no interactions endpoint in the Developer Portal), and `slash:<id>` in `discord_posts` keeps two instances from answering the same one.
- **Linked accounts** (`src/discordLink.ts`): a player connects Discord to their Clerk account in the game (or signs in with it); `POST /discord/link` reads that account from Clerk, stores its id in `users.discord_id`, adds the player to the server with the OAuth token Clerk keeps (`guilds.join`, a scope of Clerk's Discord connection) and gives **Supporter** or **Gold Supporter** by their tier (Gold replaces Supporter; no tier changes nothing). A donation that raises a linked player's tier updates the role. Linking never grants Trainer.

### Bug reports

The game's "Reportar bug" (Settings → About, the pause menu, and the prompt after the game closed mid-run) sends `POST /bug-reports` (`src/bugReports.ts`).

- Every report is stored in `bug_reports` first, so none is lost when Discord is down or not set up; without the bot the API just stores them.
- With the bot, each one becomes a thread in the **#bug-reports** forum: titled by the report's first line and the device (`Android · Chrome`, 💥 first when the game closed mid-run), opened by the quoted text and the technical info in a code block, then one message per error the game caught. Tags `Open`, `Mobile` or `Desktop`, and `Crash`, matched by name. Posts send `allowed_mentions: { parse: [] }`, so nothing in a report pings anyone. The forum is `DISCORD_BUG_FORUM_ID`, or else the forum channel named `bug-reports`.
- Rate limit: 5 reports per hour per IP (`X-Real-IP`, set by Traefik) and per account, in memory on each instance. The answer never waits for Discord.

The bot's application has **Message Content** and **Server Members** on (Developer Portal → Bot → Privileged Gateway Intents), which needs no review under 100 servers.

### Resetting a save

For a player whose save was edited (a Pokédex full of species they never met, a fortune no run paid): the account goes back to an empty save, and their runs leave the boards. The admin panel's **Zerar o save** does it (`POST /admin/moderation` with `reset`, see [Reports and bans](#reports-and-bans)); by hand, run this in a transaction, with the player's handle:

```sql
begin;
with u as (select id from users where handle = 'HANDLE')
insert into save_resets (user_id, data, revision, reason) select s.user_id, s.data, s.revision, 'edited save' from saves s join u on u.id = s.user_id;
update saves set data = '{"version": 1}', version = 1, revision = revision + 1, updated_at = now() where user_id = (select id from users where handle = 'HANDLE');
update users set save_reset_revision = (select revision from saves where user_id = users.id) where handle = 'HANDLE';
update runs set verified = false where user_id = (select id from users where handle = 'HANDLE') and finished_at is not null;
commit;
```

The player's device still holds the edited save. Its next push comes on top of an older revision than the reset (`users.save_reset_revision`), so `applyPush` stores nothing and answers with the empty save, which the device takes over its own. `save_resets` keeps what was wiped.

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
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Optional. OpenRouter, for the staff's bot in the Discord (tags, `/ask`, `/idea`). The model (it must support tool calls) defaults to `anthropic/claude-haiku-5.5`. Without the key, tagging the bot does nothing and `/ask` and `/idea` say so; `/bug`, `/player` and `/gift` still work |
| `POSTHOG_KEY` | Optional. The game's PostHog project token (`phc_…`, the same as the client's `VITE_POSTHOG_KEY`): 500s, uncaught exceptions and rejections go to its error tracking (`src/errors.ts`), tied to the player's id when the request had one. Without it errors only go to the log |
| `POSTHOG_PERSONAL_API_KEY` | Optional. A PostHog personal API key (`phx_…`) with only the `feature_flag:write` scope, limited to the game's project: the Discord staff's `/coop-beta` edits the `coop-beta` flag's handles with it (`src/coopBeta.ts`). Without it `/coop-beta` asks staff to have Pedro set it |
| `DISCORD_BUG_FORUM_ID` | Optional. The #bug-reports forum's channel id, where bug reports go. Without it the bot finds the forum by name |
| `ROLE` | Optional. `checks` runs the verifier alone (`src/verifier.ts`): only `DATABASE_URL` is needed (and `PORT`, `CHECKS`), and it serves only `GET /health`. Unset, the API |
| `CHECKS` | Optional, for the verifier. `off` pauses the re-simulation of ranked runs: they stay pending with their replays until a start without it |
| `STREAM_ENFORCE` | Optional. `1` keeps ranked runs whose replay wasn't streamed in time off the public boards (see [Replay streaming](#replay-streaming)). Unset, the API only measures and logs the lag |
| `PORT` | Default `3000` |

## Database

Migrations are plain SQL files in `migrations/`, run in name order at boot (each once, tracked in the `migrations` table). To change the schema, add the next numbered file; never edit one that already ran.

- `users`: one row per Clerk user id, with the public `handle` (unique, lower case) and display `name`, null until the player picks them.
- `saves`: one JSONB save per user, with the save's schema `version` and a `revision` bumped on every push.
- `runs`: one row per ranked run, created at its start (the id is the start token) and filled when it ends. Unfinished rows never show, and are dropped after 7 days.
- `follows`: who follows whom, one way.
- `runs.check_claimed_at`, `check_attempts`: when the verifier claimed the run for its check, and how many times it did (both cleared by a new report). `runs.replay`, `runs.verified`: the replay waiting for its check, and the verdict (null while pending, or when the run wasn't checked). `runs.check_rank`: why a finished run kept its replay and the order the checks take it (0 an official attempt, else its best place on show, `CHECKED.sampleRank` the determinism sample); null when the replay was dropped as it reported, and on runs from before migration 024.
- `runs.seed`, `runs.replaced_at`: the seed dealt with the token (null before the server dealt them), and when a newer token of the same kind replaced an unfinished one.
- `runs.branch`: the branching evolution the run took (`BranchId`, Espeon, Gallade…), so the boards show the form it ended in. Null when it took none, and on every run before it was stored (those keep showing the line's own form).
- `runs.bag`: the Bag items the run took (`ReplayStart.bag`: Lure, Rare Candy, Max Revive…), written from its replay when it reports, so the boards and profiles list them (`bag` on each run) after the replay is dropped. Empty on every run before it was stored. A replay whose Bag repeats an item or holds more than the top shop level allows is malformed (400); the Desafio do dia takes none (`challengeProblem`).
- `gifts`: each player's Mystery Gifts (`kind`, `payload` = `GiftContent`, `reason`, a per-player unique `key`, `claimed_at`).
- `users.referred_by`, `referred_at`, `referral_credited_at`: who brought the player and when the invite counted.
- `runs.challenge`, `runs.official`: the Desafio do dia a run plays (its day) and whether it's the player's official attempt of that day.
- `donations`: one row per donation (`provider`, its `ref`, the account it's for, the amount and points, the `code` of one with no account, `paid_at`, `credited_at`).
- `users.supporter_points`, `supporter_since`, `supporter_public`: a supporter's total, since when, and whether they show it. `poll_votes`: the supporters' poll.
- `suggestions`: the idea board (`status` `open`, `done` or `hidden`, `score` recounted from the votes on every vote, `done_at`). `suggestion_votes`: one vote per player per idea (1 or -1; taking it back deletes the row).
- `users.discord_id`, `discord_name`: the Discord account a player linked (one game account per Discord account).
- `presence`: each signed-in player's last heartbeat (`activity`, `room`, `seen_at`). `coop_invites`: one co-op invite per sender and friend (`room`, `expires_at`, `dismissed_at`). `users.appear_offline`: friends see the player offline. `users_handle_prefix` serves the `/players` prefix search.
- `bug_reports`: each bug report (`user_id`, null for a guest; `text`; `tech`, the `BugTech` JSON or null; `thread_id`, the forum thread once posted).
- `users.save_reset_revision`, `save_resets`: the revision a reset stored (see [Resetting a save](#resetting-a-save)), and what each reset wiped.
- `users.banned_at`, `banned_reason`: a ban, since when and why (null for everyone else). `reports`: each report (`reporter_id`, `target_id`, `run_id` when it's about a run, `reason`, `note`), unique per reporter and run (or player, without a run), and how it was resolved (`resolved_at`, `resolved_by`, `resolution`: the `ModerationAction`).
- `runs.issued_at`: when the token and its seed were dealt (`started_at` moves with `/start`, this doesn't). `runs.stream_seq`, `stream_ticks`, `stream_at`, `stream_lag`: the replay stream so far (the next chunk's `seq` and first tick, when the last commitment came, the worst lag in seconds). `runs.stream_base`, `stream_digest`: the ticks the last report pinned and their sha256. `runs.stream_ok`: whether the last report was streamed in time (null before streaming). `runs.unlisted`: kept off the public boards for its stream (only with `STREAM_ENFORCE`). `run_chunks`: each chunk waiting for its run's report (`seq`, `from_tick`, `to_tick`, `moves`, `events`, `received_at`).
- `festival_donations`: each Festival da Praça donation (`festival`, `user_id`, `amount`, the Brasília `day`, `held` until the admin approves it, `voided`). `users.donor_public`: the plaque shows the player's @handle.
- `discord_posts`: what the Discord bot already did, by key (`patch:<date>`, `challenge:<day>`, `podium:<day>`, `outbreak:<day>`, `welcome:<user>`, `short:<message>`, `take:<message>` for a staff tag, `slash:<interaction>`), with the message a patch note became so it can be edited.

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

- **Postgres 17 on Supabase** (project `rkctmaklefamxfleiqwe`, sa-east-1), reached through the **transaction pooler** (port `6543`). The session pooler (`5432`) caps clients at its pool size, and start-first rollouts run two containers at once, so it refused connections on deploys. The API connects as `postgres` with `prepare: false`, and anything that needs one connection stays in a transaction (`sql.begin`, `pg_advisory_xact_lock`): no session locks, `LISTEN` or session `SET`. RLS is on in every table and `anon`/`authenticated` have no grants, since nothing uses Supabase's Data API.
- **App `api`** in the Dokploy project **Pokémon Survivors**:: built with the Dockerfile `server/Dockerfile` and build context `.` (the repository root, since the API bundles `src/`). It listens on container port `3000` behind `api.pokemonsurvivors.com`, with a Let's Encrypt certificate.
- **App `checks`**, the verifier: the same repository, Dockerfile, build context and auto-deploy paths as `api`, with `ROLE=checks` and `DATABASE_URL` (the same pooler URL), a CPU limit of 0.5 (Advanced → Resources) and no domain. Its `/health` on port `3000` serves the image's HEALTHCHECK. It never migrates, so a release whose verifier reads a new column needs `api` deployed first (a verifier ahead of it only logs failed claims until then).

### When it deploys

A push to `main` deploys the API (both apps, `api` and `checks`) automatically, but only when it touches `server/**`, `src/game/**`, `src/data/**`, `src/engine/**`, `src/site/**` (the Discord bot posts the changelog), `src/i18n/**` (the staff bot reads the English texts) or `public/llms.txt` (what the staff bot knows). Those are the folders the API bundle imports. **If the bundle starts importing another folder of `src/`, add it to this list in Dokploy** (on both apps, and here). Otherwise a change there ships to the site but not to the API, and the two drift apart.

### Rollout

New versions roll out with no downtime:

- The new container starts before the old one stops (start-first).
- If its `HEALTHCHECK` (`/health`) doesn't pass within 30 s, Swarm rolls back to the previous version on its own. That includes a migration that breaks the boot.
- A boot step that fails on the database (the migrations) tries again a few times before giving up (`retrying` in `src/db.ts`), so a passing pooler error doesn't crash the new container.
- The old container gets SIGTERM and is killed 10 s later. Its shutdown (`src/api.ts`) fits in that window: it drops idle keep-alive connections, gives requests in flight 4 s, then ends the Postgres pool so every query already sent finishes. Without `prepare`, postgres.js sends a query with parameters in two steps, and a connection killed between them leaves its pooler backend mid-statement: 2 minutes later, that statement's timeout cancels whatever query the backend is serving then (the `statement timeout` errors of 2026-10-22 and 23).

### Migrations

- The files are numbered and only move forward. Never edit a migration that already ran: add the next file.
- Every change must work with the previous version of the API, since both run side by side during a rollout. For example, add a nullable column first, and drop the old one only in a later PR.
- All pending migrations run in one transaction, so a failure leaves nothing half applied.

### Environment

| Variable | Where | |
| --- | --- | --- |
| `DATABASE_URL` | Dokploy (`api`) | Supabase transaction pooler: `postgresql://postgres.rkctmaklefamxfleiqwe:…@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require` |
| `CLERK_SECRET_KEY` | Dokploy (`api`) | Production instance secret key |
| `ABACATEPAY_API_KEY` | Dokploy (`api`) | AbacatePay production key, with `CHECKOUT:CREATE`, `PRODUCT:CREATE` and `PRODUCT:READ` |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | Dokploy (`api`) | The "Pokémon Survivors" bot's token and the community server's id |
| `OPENROUTER_API_KEY` | Dokploy (`api`) | OpenRouter key for the Discord idea intake (optional) |
| `POSTHOG_KEY` | Dokploy (`api`) | PostHog (US cloud) project token, public |
| `POSTHOG_PERSONAL_API_KEY` | Dokploy (`api`) | PostHog personal API key, `feature_flag:write` on the game's project, for `/coop-beta` (optional) |
| `DISCORD_BUG_FORUM_ID` | Dokploy (`api`) | The #bug-reports forum's channel id (optional: found by name without it) |
| `STREAM_ENFORCE` | Dokploy (`api`) | Unset (observe only) until the lag is measured; `1` to enforce |
| `ROLE` | Dokploy (`checks`) | `checks` |
| `DATABASE_URL` | Dokploy (`checks`) | The same as `api`'s |
| `CHECKS` | Dokploy (`checks`) | Unset; `off` pauses the verifier (relief when the VPS is short of CPU) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Vercel, production only | `pk_live_…`, which only works on `pokemonsurvivors.com` |
| `VITE_API_URL` | Vercel, production only | `https://api.pokemonsurvivors.com` |
| `VITE_POSTHOG_KEY` | Vercel, production only | The same PostHog project token: the game's events and errors (`src/analytics.ts`) |
| `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID` | Vercel, production only | A PostHog personal key with error tracking write access and the project's id, for `scripts/sourcemaps.mjs` to upload the source maps |

### Local development

The `pk_live` key doesn't work on `localhost`. To test sign-in locally, put the keys of Clerk's **development** instance in `.env.local` at the repository root (and its secret key in `server/.env`).

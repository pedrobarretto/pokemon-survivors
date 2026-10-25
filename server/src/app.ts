import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import { parseAdminGift, parseAdminQuery } from '../../src/game/admin'
import { parseBugReport } from '../../src/game/bugReport'
import { challengeOpen } from '../../src/game/challenge'
import { parseDonation } from '../../src/data/donations'
import { isPollOption } from '../../src/data/supporters'
import { isDayKey } from '../../src/game/day'
import { parseDonationAmount } from '../../src/game/festival'
import { isDifficulty } from '../../src/game/difficulty'
import { halloweenAt } from '../../src/game/halloween'
import { parseHandlePrefix, parsePresenceUpdate, parseRoomCode } from '../../src/game/friends'
import { parseSaveData } from '../../src/game/meta'
import { outbreakAt } from '../../src/game/outbreak'
import { isRecord } from '../../src/game/parse'
import { isBoardPeriod, isPlayable, isRunMode, parseDisplayName, parseHandle, parseRunResult } from '../../src/game/ranking'
import { parseReplay, RULES_VERSION, rulesStanding } from '../../src/game/replay'
import { parseChunk } from '../../src/game/replayStream'
import { banGated, parseModeration, parseReport } from '../../src/game/reports'
import { parseCode } from '../../src/game/supporters'
import { isSuggestionSort, isSuggestionStatus, isVote, parseSuggestionDraft } from '../../src/game/suggestions'
import type { AdminStore } from './admin'
import type { Verify } from './auth'
import type { BugReports } from './bugReports'
import type { SaveStore } from './db'
import type { DiscordLink } from './discordLink'
import type { Report } from './errors'
import type { Donate } from './donations'
import type { CandyGoalStore } from './candyGoal'
import type { DonateError, FestivalStore } from './festival'
import type { FriendStore } from './friends'
import type { GiftStore } from './gifts'
import type { ModerationStore } from './moderation'
import type { RankingStore } from './ranking'
import { rulesVerdict } from './rulesGrace'
import type { SupporterStore } from './supporters'
import { SUGGESTION_ID, type SuggestionStore } from './suggestions'
import { abacateDonation, ABACATE_REF, stripeDonation, verifyAbacate, verifyStandard, verifyStripe } from './webhooks'

export type AppDeps = {
  store: SaveStore
  ranking: RankingStore
  /** Friends (mutual follows), presence and co-op invites. */
  friends: FriendStore
  gifts: Pick<GiftStore, 'inbox' | 'claim' | 'refer' | 'credit' | 'invites'>
  verify: Verify
  /** Donation checkouts (AbacatePay), null when the server has no key for them. */
  donate: Donate | null
  supporters: SupporterStore
  /** Festival da Praça: the pot, donations from the stored save and the plaque. */
  festival: Pick<FestivalStore, 'status' | 'donate' | 'setPublic' | 'takeDonate' | 'takeToggle' | 'held' | 'review'>
  /** Meta da comunidade: every account's candy jar summed, toward the goal that opens Mega Darkrai. */
  candyGoal: Pick<CandyGoalStore, 'status'>
  /** The idea board. */
  suggestions: SuggestionStore
  /** Bug reports: stored, then posted to the community Discord's #bug-reports. */
  bugReports: Pick<BugReports, 'submit'>
  /** The player's Discord account: the community server and its supporter role. */
  discord: Pick<DiscordLink, 'link' | 'unlink'>
  /** The gift desk: who is admin (asked of Clerk), finding players and sending them gifts. */
  admin: Pick<AdminStore, 'isAdmin' | 'search' | 'send' | 'recent'>
  /** Reports and bans: the write gate asks who is banned, players report, the admin acts. */
  moderation: Pick<ModerationStore, 'banned' | 'report' | 'open' | 'act'>
  /** Webhook secrets: Stripe's signing secret and Payment Link, AbacatePay's URL secret. Unset ones answer 503. */
  webhooks: { stripeSecret?: string; stripePaymentLink: string | null; abacatePaySecret?: string }
  allowedOrigin: (origin: string) => boolean
  /** Whether the database answers, for `/health`. */
  ping: () => Promise<boolean>
  /** Error tracking for the 500s (`errors.ts`). */
  report: Report
}

type Auth = { Variables: { userId: string } }

type MaybeAuth = { Variables: { userId: string | null } }

/** Where donors land when the site that sent them isn't one we know. */
const SITE = 'https://www.pokemonsurvivors.com'

/** A same-site path to come back to (`/apoie/`, `/en/support/`). */
const SITE_PATH = /^\/[a-z0-9/-]{0,40}$/

/** A donation's `ref`: our uuid (AbacatePay) or a Stripe Checkout Session id. */
const DONATION_REF = /^(?:[0-9a-f-]{36}|cs_(?:test|live)_[A-Za-z0-9]{10,200})$/

/**
 * Who's asking, for a rate limit: the address the proxy (Traefik) saw. It
 * sets `X-Real-IP` itself and adds the address to the end of
 * `X-Forwarded-For`, so a client can't pick its own by sending either.
 */
export const clientIp = (realIp: string | undefined, forwarded: string | undefined) =>
  realIp?.trim() || forwarded?.split(',').at(-1)?.trim() || 'unknown'

/** What a hand-sent gift answers when it doesn't go, by `SendOutcome`. */
const SEND_ERRORS = { unknown: 404, 'bad request': 400 } as const

/** What posting or voting on an idea answers when it doesn't go. */
const SUGGESTION_ERRORS = { profile: 403, limit: 429, unknown: 404, closed: 409 } as const

/** What a report answers when it's refused, by `Reported`: only what's about the reporter. */
const REPORT_ERRORS = { self: 400, limit: 429 } as const

/** What inviting a friend answers when it doesn't go, by `Invited`'s error. */
const INVITE_ERRORS = { notFriend: 404, limit: 429 } as const

/** What a festival donation answers when it's refused, by `DonateError`. */
const DONATE_ERRORS = { closed: 409, profile: 403, runs: 403, cap: 409, funds: 409, nosave: 409, stale: 409 } as const satisfies Record<DonateError, number>

/** What a run's end answers when it's refused, by `FinishError`. */
const FINISH_ERRORS = { unknown: 404, replaced: 409, mismatch: 409, seed: 400, clock: 422, challenge: 400, rewrite: 409 } as const

/** What a replay chunk answers when it's refused, by `ChunkError`. */
const CHUNK_ERRORS = { unknown: 404, replaced: 409, committed: 409, gap: 409, clock: 422 } as const

/**
 * The HTTP API. Routes marked (auth) need a Clerk session token
 * (`Authorization: Bearer …`) and act on that player; the public ones read it
 * when present (to answer "me" and "following"). A banned account's writes
 * (`BAN_GATED`: run starts and ends, save pushes, reports, ideas and votes)
 * get 403 `{ error: 'banned' }`, and banned players are left off every board,
 * profile and list.
 *
 * - `GET /health`: 200 while the database answers, else 503.
 * - `GET /save` (auth): the stored save and its revision, 404 before the first push.
 * - `PUT /save` (auth) `{ save, base }`: pushes the device's save on top of
 *   revision `base` (null if it never synced). Returns `{ save, revision, merged }`,
 *   what is stored now, for the device to keep (see `applyPush`).
 * - `GET /me` (auth): `{ profile }`, the player's handle and name, null before they pick them.
 * - `PUT /me` (auth) `{ handle, name }`: sets them. 409 `{ suggestion }` when the handle is taken.
 * - `POST /runs` (auth) `{ challenge? }`: `{ token, seed, rules }` for the player's next run: the start
 *   token, the seed the run must play (random, from `crypto`) and the rules its replay must play by
 *   (`RULES_VERSION`: a game behind them loads the newer build first). It replaces the player's other
 *   unfinished token of the same kind, so only one regular and one challenge token are live at a
 *   time. 429 past the start rate limit. With `challenge` (a `YYYY-MM-DD` Brasília day) it's that
 *   day's Desafio do dia, whose seed is the day's (`dailyChallenge`); 400 when that day's challenge
 *   isn't open (`challengeOpen`).
 * - `POST /runs/:token/start` (auth): the run of a token asked for ahead really starts now: its
 *   clock restarts (`stampRun`). 204, 404 for an unknown or finished token, 409 for a replaced one.
 * - `PUT /runs/:token/chunks/:seq` (auth) `ReplayChunk` (`src/game/replayStream.ts`): the replay's ticks
 *   `[from, to)` while the run plays, chunk `seq` (0, 1, 2…), committing them. `{ lag }`, how late it came
 *   (seconds, `commitLag`; null for a retry of a chunk already in, which changes nothing). 400 for a chunk
 *   of the wrong shape or size, 404 for an unknown token or a run that ended (only a victory's goes on,
 *   into endless mode), 409 for a replaced token, a `seq` another chunk holds (`committed`) or a chunk
 *   that doesn't start where the stream is (`gap`), 422 when the clock can't fit it.
 * - `PUT /runs/:token` (auth) `RunResult & { replay }`: records how it ended and
 *   returns `{ ranks, challenge, listed }` (`ChallengePlace`, null for any other run; `listed`
 *   false when, with `STREAM_ENFORCE` on, it wasn't streamed in time and stays off the boards); the
 *   replay is kept for a re-simulation only when the run is on show (`checkRank`; the verifier, `checks.ts`, takes it from the database), and the run may make the player's invite count (`gifts.credit`). A challenge run's replay must
 *   be its day's challenge.
 *   400 for an implausible result, a missing replay or a replay of another run,
 *   `seed` for a replay of another seed than the token's (`reportProblem`; a token from before the
 *   server dealt seeds takes any), 404 for an unknown token, 409 for a replaced one or when it
 *   contradicts what the run already recorded or rewrites what its chunks committed (`rewrite`), 422 when the clock can't fit it. The replay must play by this
 *   server's rules (`RULES_VERSION`), so every run on the boards can be
 *   re-simulated: 400 `outdated` for older ones (the run straddled a deploy),
 *   503 for newer ones (the API isn't deployed yet: the game keeps the result
 *   and sends it again later).
 * - `GET /boards/:difficulty?period=day|week|all&starter=&friends=1&mode=standard|legend`: `Board`.
 *   `friends` needs a token. `mode=legend` is the Legend mode's board (runs played with a legend); without it, the regular one.
 * - `GET /challenge/:day?friends=1`: `ChallengeBoard`, the day's official attempts. `friends` needs a token.
 * - `GET /profiles/:handle`: `PublicProfile`, 404 if nobody has that handle.
 * - `PUT|DELETE /follows/:handle` (auth): follows or unfollows. `{ followed, followers, friend }`: following
 *   someone who follows back makes friends (`friend`). 429 past the follows rate limit.
 * - `GET /players?q=` (auth): `{ players }`, up to `FRIENDS.searchMax` `PlayerMatch` whose handle starts
 *   with `q` (2+ characters), without the asker. 429 past the search rate limit (player and IP).
 * - `GET /friends` (auth): `FriendList`, friends and pending requests both ways.
 * - `DELETE /followers/:handle` (auth): declines `handle`'s request. `DELETE /friends/:handle` (auth):
 *   unfriends (drops both follows). `{ ok }`, 404 for an unknown handle.
 * - `PUT /presence` (auth) `PresenceUpdate`: a heartbeat. `PresenceView`: the friends' presence and the
 *   co-op invites waiting. 400 invalid, 429 past the heartbeat rate limit. `DELETE /presence` (auth): offline now.
 * - `PUT /presence/settings` (auth) `{ appearOffline }`: friends see the player offline. `{ appearOffline }`.
 * - `POST /coop-invites` (auth) `{ to, room }`: invites the friend `to` into the co-op room. 201
 *   `{ expiresAt }`; 404 when `to` isn't a friend, 429 past the invite rate limit.
 * - `DELETE /coop-invites/:id` (auth): dismisses an invite the player got. `{ dismissed }`, 404 unknown.
 * - `GET /gifts` (auth): `{ gifts }`, the player's unclaimed Mystery Gifts, oldest first.
 * - `POST /gifts/claim` (auth) `{ ids }`: marks those gifts claimed (the game applied them). `{ claimed }`.
 * - `POST /referral` (auth) `{ ref }`: the inviter's handle a new account came with. `{ referred }`:
 *   whether it counted (only a new account, never oneself: `canRefer`).
 * - `GET /invites` (auth): `{ friends }` (`InvitedFriend[]`), who signed up with the player's link, newest first.
 * - `POST /donations` `{ amount, page, handle? }`: `{ url }`, an AbacatePay checkout (Pix or a
 *   Brazilian card) for `amount` whole reais (`parseDonation`), for the account of `handle`
 *   (400 when nobody has it). The donor comes back to `page` on the site, with
 *   `?thanks=<ref>` once paid. 503 without an AbacatePay key.
 * - `GET /donations/:ref`: `DonationStatus`, for the thank-you page (404 until the payment is known).
 * - `POST /donations/redeem` (auth) `{ code }`: credits a donation's code to the player. `{ tier }`;
 *   404 for an unknown code, 409 for one already used.
 * - `POST /webhooks/stripe`, `POST /webhooks/abacatepay`: the payment providers say a donation is paid
 *   (signed: `webhooks.ts`; AbacatePay's the Standard Webhooks way, or with `?webhookSecret=` for an
 *   older webhook). 401 for a bad signature, 503 without the secret.
 * - `GET /me/supporter` (auth): `SupporterStatus`. `PUT /me/supporter` (auth) `{ public }`: shows or hides the badge and name.
 * - `GET /supporters`: `{ supporters, hidden }`, the wall (`WallEntry[]`, with each one's title and Hall da Fama Pokémon) and how many supporters per tier stay off it.
 * - `GET /poll`: `Poll`. `PUT /poll` (auth) `{ choice }`: a supporter's vote, 403 for anyone else.
 * - `GET /suggestions?sort=board|top|new|done`: `{ suggestions }` (`Suggestion[]`), the idea board's columns (`board`,
 *   with the asker's own ideas waiting for review) or an earlier build's tab, with the asker's votes.
 * - `POST /suggestions` (auth) `{ title, body }`: posts an idea (`parseSuggestionDraft`), 201 `{ suggestion }`, `pending`
 *   until staff approve it in the Discord.
 *   400 invalid, 403 before the player has a handle, 429 past `SUGGESTION.perDay` in 24 hours.
 * - `PUT /suggestions/:id/vote` (auth) `{ vote }` (1, -1, or 0 to take it back): `{ score, vote }`. 404 unknown (or under review), 409 shipped.
 * - `POST /bug-reports` `{ text, tech? }`: a bug report (`parseBugReport`), from a guest or (with a token)
 *   a player. 201 `{ id }`, stored and on its way to Discord. 400 invalid, 429 past `BUG_REPORT.perHour`
 *   for the IP or the account.
 * - `POST /reports` (auth) `{ target, run?, reason, note? }` (`parseReport`): reports a player by handle, or one
 *   of their runs on the boards. 202 `{ received: true }` whatever becomes of it (nothing about the target
 *   comes back). 400 invalid or reporting oneself, 429 past `REPORT.perDay` in 24 hours.
 * - `GET /festival`: `FestivalBoard & { me }`, the Festival da Praça the plaza shows (the running one, else the last;
 *   null before the first): its `start` and `end` days, every festival's `pots`, its `pot` and milestones `reached`,
 *   the `top` donors by @handle (counted donations of players who show their name) and how many `donors`; the
 *   public part is cached 30 s. With a token, `me` (`FestivalMine`): ₽ given today (the cap), per festival, held, the plaque setting and the place among the festival's donors (`rank`).
 * - `POST /festival/donate` (auth) `{ amount, base }`: puts `amount` whole ₽ of the stored save in the running festival's
 *   pot, on top of revision `base`. `{ save, revision, held, today }`: the save with the ₽ moved to `spent`, for the device
 *   to keep. 400 invalid amount, 403 `profile` (no @handle) or `runs` (fewer than `FESTIVAL.minRuns` verified runs),
 *   409 `closed` (no festival running), `cap` (past ₽200k today), `funds` (the stored wallet can't cover it), `nosave`
 *   or `stale` (sync first), 429 past the rate limit. `held`: the wallet was above `FESTIVAL.heldWallet`, so it counts once the admin approves it.
 * - `PUT /festival/public` (auth) `{ public }`: shows or hides the player's @handle on the plaque. `{ public }`.
 * - `GET /candy-goal`: `CandyGoal`, the Meta da comunidade: every account's candy jar summed (each up to
 *   `HALLOWEEN.community.cap`), the goal and whether they reached it. Public, cached 2 min.
 * - `POST /discord/link` (auth): links the Discord account the player connected in Clerk, joins them
 *   to the community server and gives them their supporter role. `{ username, joined }`; 404 when
 *   Clerk has no verified Discord account for them, 503 when Clerk can't answer.
 * - `DELETE /discord/link` (auth): forgets it (the player unlinked Discord). `{ unlinked: true }`.
 * - `/admin…` (admin): the gift desk, 403 for anyone whose verified email isn't in `ADMIN_EMAILS`.
 *   `GET /admin`: `{ admin: true }`. `GET /admin/users?q=`: `{ users }` (`AdminUser[]`) by handle or email.
 *   `POST /admin/gifts` `{ userId, content, request }`: sends a gift (`parseAdminGift`), `{ sent }`
 *   (false when that `request` already went); 404 for an unknown player. `GET /admin/gifts`: `{ gifts }`
 *   (`AdminSent[]`), the latest sent by hand. `PUT /admin/suggestions/:id` `{ status }`: moves an idea
 *   to a column (`open` the Backlog, `todo`, `cooking`, `done` shipped) or `hidden` (off the board). `{ status }`, 404 for an unknown idea.
 *   `GET /admin/reports`: `{ groups, open }`, the open reports grouped by run or player (`ReportGroup[]`)
 *   and how many are open. `POST /admin/moderation` (`parseModeration`) `{ userId, action, run?, reason? }`:
 *   `remove` a run from the boards, `reset` the save, `ban` (with a reason) or `unban`, or `dismiss`,
 *   resolving the reports it answers. `{ resolved }`, 404 for an unknown player or run.
 *   `GET /admin/festival`: `{ donations }` (`HeldDonation[]`), the festival donations held for review.
 *   `POST /admin/festival/:id/approve` (it counts in the pot) or `/void` (it never counts; its ₽ stays spent): `{ ok }`, 404 for an unknown or already settled one.
 */
export const createApp = ({ store, ranking, friends, gifts, verify, donate, supporters, festival, candyGoal, suggestions, bugReports, discord, admin, moderation, webhooks, allowedOrigin, ping, report }: AppDeps) => {
  // `userId` is set by `auth` or `maybeAuth` on the routes that ask who's calling; `onError` reports it.
  const app = new Hono<MaybeAuth>()

  app.use(logger())
  app.use(cors({ origin: (origin) => (allowedOrigin(origin) ? origin : null), allowMethods: ['GET', 'PUT', 'POST', 'DELETE'], allowHeaders: ['Authorization', 'Content-Type'], maxAge: 86400 }))

  app.get('/health', async (c) => ((await ping()) ? c.json({ ok: true }) : c.json({ ok: false }, 503)))

  const bearer = (header: string | undefined) => header?.match(/^Bearer (.+)$/)?.[1]

  const auth = createMiddleware<Auth>(async (c, next) => {
    const token = bearer(c.req.header('Authorization'))
    const userId = token ? await verify(token) : null
    if (!userId) return c.json({ error: 'unauthorized' }, 401)
    c.set('userId', userId)
    // Only the writes ask: a banned account still reads its save, boards and gifts.
    if (banGated(c.req.method, c.req.path) && (await moderation.banned(userId))) return c.json({ error: 'banned' }, 403)
    await next()
  })

  /** Public routes: a valid token says who's asking, anything else reads as a guest. */
  const maybeAuth = createMiddleware<MaybeAuth>(async (c, next) => {
    const token = bearer(c.req.header('Authorization'))
    c.set('userId', token ? await verify(token) : null)
    await next()
  })

  const smallBody = bodyLimit({ maxSize: 4 * 1024 })
  // A run's result and its replay: an hour of play records up to ~450 KB, so this fits the longest run `RANKED.maxTime` allows.
  const runBody = bodyLimit({ maxSize: 2 * 1024 * 1024 })

  const json = (c: { req: { json: () => Promise<unknown> } }) => c.req.json().catch(() => null)

  app.get('/save', auth, async (c) => {
    const stored = await store.read(c.var.userId)
    return stored ? c.json(stored) : c.json({ error: 'no save yet' }, 404)
  })

  app.put('/save', auth, bodyLimit({ maxSize: 256 * 1024 }), async (c) => {
    const body = await json(c)
    if (!isRecord(body) || !isRecord(body.save)) return c.json({ error: 'expected { save, base }' }, 400)
    const base = typeof body.base === 'number' && Number.isInteger(body.base) ? body.base : null
    return c.json(await store.push(c.var.userId, { save: parseSaveData(body.save), base }))
  })

  app.get('/me', auth, async (c) => c.json({ profile: await ranking.profileName(c.var.userId) }))

  app.put('/me', auth, smallBody, async (c) => {
    const body = await json(c)
    const handle = isRecord(body) ? parseHandle(body.handle) : null
    const name = isRecord(body) ? parseDisplayName(body.name) : null
    if (!handle || !name) return c.json({ error: 'invalid handle or name' }, 400)
    const set = await ranking.setProfileName(c.var.userId, { handle, name })
    return set.ok ? c.json({ profile: { handle, name } }) : c.json({ error: 'taken', suggestion: set.suggestion }, 409)
  })

  app.post('/runs', auth, smallBody, async (c) => {
    // An older game sends no body: a run like any other.
    const body = await json(c)
    const challenge = isRecord(body) && body.challenge !== undefined ? body.challenge : null
    if (challenge !== null && (!isDayKey(challenge) || !challengeOpen(challenge, new Date()))) return c.json({ error: 'not an open challenge' }, 400)
    const started = await ranking.startRun(c.var.userId, challenge)
    // The day by this clock (the one `outbreakFits` and `halloweenFits` check against): its outbreak and whether it's haunted, so a wrong device clock can't play another day's.
    const now = new Date()
    return started ? c.json({ ...started, outbreak: outbreakAt(now), halloween: halloweenAt(now), rules: RULES_VERSION }, 201) : c.json({ error: 'too many runs' }, 429)
  })

  app.post('/runs/:token/start', auth, async (c) => {
    const stamped = await ranking.stampRun(c.var.userId, c.req.param('token'))
    return stamped === 'ok' ? c.body(null, 204) : c.json({ error: stamped }, stamped === 'replaced' ? 409 : 404)
  })

  // 15 s of play is ~2 KB of JSON; the limits of `STREAM` keep a chunk far below this.
  app.put('/runs/:token/chunks/:seq', auth, bodyLimit({ maxSize: 64 * 1024 }), async (c) => {
    const seq = Number(c.req.param('seq'))
    const chunk = parseChunk(await json(c))
    if (!Number.isSafeInteger(seq) || seq < 0 || !chunk) return c.json({ error: 'invalid chunk' }, 400)
    const taken = await ranking.putChunk(c.var.userId, c.req.param('token'), seq, chunk)
    return taken.ok ? c.json({ lag: taken.lag }) : c.json({ error: taken.error }, CHUNK_ERRORS[taken.error])
  })

  // A 30-minute replay is ~60 KB of JSON.
  app.put('/runs/:token', auth, runBody, async (c) => {
    const body = await json(c)
    const result = parseRunResult(body)
    if (!result) return c.json({ error: 'implausible result' }, 400)
    // A run without a replay, or with one this server can't judge, could claim anything: none counts.
    const replay = isRecord(body) ? parseReplay(body.replay) : null
    if (!replay || replay.start.starter !== result.starter || replay.start.difficulty !== result.difficulty) {
      return c.json({ error: 'replay of another run' }, 400)
    }
    // Older rules count only on a token pinned to them, within the grace window: a run that straddled a rules deploy.
    const token = c.req.param('token')
    const pinned = rulesStanding(replay.rules) === 'older' ? await ranking.tokenRules(c.var.userId, token) : null
    const verdict = rulesVerdict(replay.rules, pinned)
    if (verdict === 'outdated') return c.json({ error: 'outdated' }, 400)
    if (verdict === 'behind') return c.json({ error: 'api behind' }, 503)
    const finished = await ranking.finishRun(c.var.userId, token, result, replay)
    if (!finished.ok) return c.json({ error: finished.error }, FINISH_ERRORS[finished.error])
    if (verdict === 'grace') console.log(`run ${token}: taken under the previous rules (${replay.rules})`)
    void gifts.credit(c.var.userId).catch((err) => console.error('invite credit failed', err))
    const challenge = finished.challenge ? await ranking.challengePlace(c.var.userId, finished.challenge, finished.official === true) : null
    return c.json({ ranks: finished.ranks, challenge, listed: finished.listed })
  })

  app.get('/boards/:difficulty', maybeAuth, async (c) => {
    const difficulty = c.req.param('difficulty')
    const period = c.req.query('period') ?? 'all'
    const starter = c.req.query('starter') || null
    const friends = c.req.query('friends') === '1'
    const mode = c.req.query('mode') ?? 'standard'
    if (!isDifficulty(difficulty) || !isBoardPeriod(period) || !isRunMode(mode) || (starter !== null && !isPlayable(starter))) return c.json({ error: 'unknown board' }, 400)
    if (friends && !c.var.userId) return c.json({ error: 'unauthorized' }, 401)
    return c.json(await ranking.board({ mode, difficulty, period, starter, friends, viewer: c.var.userId }))
  })

  app.get('/challenge/:day', maybeAuth, async (c) => {
    const day = c.req.param('day')
    const friends = c.req.query('friends') === '1'
    if (!isDayKey(day)) return c.json({ error: 'unknown day' }, 400)
    if (friends && !c.var.userId) return c.json({ error: 'unauthorized' }, 401)
    return c.json(await ranking.challengeBoard(day, friends, c.var.userId))
  })

  app.get('/profiles/:handle', maybeAuth, async (c) => {
    const handle = parseHandle(c.req.param('handle'))
    const profile = handle ? await ranking.profile(handle, c.var.userId) : null
    return profile ? c.json(profile) : c.json({ error: 'no such player' }, 404)
  })

  for (const [method, on] of [['put', true], ['delete', false]] as const) {
    app[method]('/follows/:handle', auth, async (c) => {
      const handle = parseHandle(c.req.param('handle'))
      if (on && !friends.takeFollow(c.var.userId)) return c.json({ error: 'too many follows' }, 429)
      const followed = handle ? await ranking.follow(c.var.userId, handle, on) : null
      if (!followed || !handle) return c.json({ error: 'no such player' }, 404)
      return c.json({ ...followed, friend: on && (await friends.followsBack(c.var.userId, handle)) })
    })
  }

  app.get('/players', auth, async (c) => {
    const prefix = parseHandlePrefix(c.req.query('q'))
    if (!prefix) return c.json({ players: [] })
    if (!friends.takeSearch(c.var.userId, clientIp(c.req.header('X-Real-IP'), c.req.header('X-Forwarded-For')))) return c.json({ error: 'too many searches' }, 429)
    return c.json({ players: await friends.search(prefix, c.var.userId) })
  })

  app.get('/friends', auth, async (c) => c.json(await friends.list(c.var.userId)))

  for (const [path, drop] of [['/followers/:handle', friends.decline], ['/friends/:handle', friends.unfriend]] as const) {
    app.delete(path, auth, async (c) => {
      const handle = parseHandle(c.req.param('handle'))
      return handle && (await drop(c.var.userId, handle)) ? c.json({ ok: true }) : c.json({ error: 'no such player' }, 404)
    })
  }

  app.put('/presence', auth, smallBody, async (c) => {
    const update = parsePresenceUpdate(await json(c))
    if (!update) return c.json({ error: 'expected { activity, room? }' }, 400)
    if (!friends.takeBeat(c.var.userId)) return c.json({ error: 'too many heartbeats' }, 429)
    return c.json(await friends.beat(c.var.userId, update))
  })

  app.delete('/presence', auth, async (c) => {
    await friends.offline(c.var.userId)
    return c.json({ offline: true })
  })

  app.put('/presence/settings', auth, smallBody, async (c) => {
    const body = await json(c)
    if (!isRecord(body) || typeof body.appearOffline !== 'boolean') return c.json({ error: 'expected { appearOffline }' }, 400)
    await friends.setAppearOffline(c.var.userId, body.appearOffline)
    return c.json({ appearOffline: body.appearOffline })
  })

  app.post('/coop-invites', auth, smallBody, async (c) => {
    const body = await json(c)
    const to = isRecord(body) ? parseHandle(body.to) : null
    const room = isRecord(body) ? parseRoomCode(body.room) : null
    if (!to || !room) return c.json({ error: 'expected { to, room }' }, 400)
    const invited = await friends.invite(c.var.userId, to, room)
    return invited.ok ? c.json({ expiresAt: invited.expiresAt }, 201) : c.json({ error: invited.error }, INVITE_ERRORS[invited.error])
  })

  app.delete('/coop-invites/:id', auth, async (c) => {
    const id = c.req.param('id')
    return SUGGESTION_ID.test(id) && (await friends.dismiss(c.var.userId, id)) ? c.json({ dismissed: true }) : c.json({ error: 'unknown invite' }, 404)
  })

  app.get('/gifts', auth, async (c) => c.json({ gifts: await gifts.inbox(c.var.userId) }))

  app.post('/gifts/claim', auth, smallBody, async (c) => {
    const body = await json(c)
    const ids = isRecord(body) && Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 50) : null
    if (!ids) return c.json({ error: 'expected { ids }' }, 400)
    return c.json({ claimed: await gifts.claim(c.var.userId, ids) })
  })

  app.get('/invites', auth, async (c) => c.json({ friends: await gifts.invites(c.var.userId) }))

  app.post('/referral', auth, smallBody, async (c) => {
    const body = await json(c)
    const ref = isRecord(body) ? parseHandle(body.ref) : null
    if (!ref) return c.json({ error: 'expected { ref }' }, 400)
    return c.json({ referred: await gifts.refer(c.var.userId, ref) })
  })

  app.post('/donations', smallBody, async (c) => {
    if (!donate) return c.json({ error: 'donations are off' }, 503)
    const body = await json(c)
    const amount = isRecord(body) ? parseDonation(body.amount) : null
    if (!amount) return c.json({ error: 'expected { amount } in whole reais' }, 400)
    const typed = isRecord(body) && typeof body.handle === 'string' ? body.handle.trim() : ''
    const handle = typed ? parseHandle(typed) : null
    if (typed && !handle) return c.json({ error: 'no such player' }, 400)
    const origin = c.req.header('Origin')
    const base = origin && allowedOrigin(origin) ? origin : SITE
    const page = isRecord(body) && typeof body.page === 'string' && SITE_PATH.test(body.page) ? body.page : '/'
    const ref = crypto.randomUUID()
    if (!(await supporters.open(ref, handle))) return c.json({ error: 'no such player' }, 400)
    const url = await donate(amount, { completionUrl: `${base}${page}?thanks=${ref}`, returnUrl: `${base}${page}` }, `${ABACATE_REF}${ref}`)
    return c.json({ url })
  })

  app.get('/donations/:ref', async (c) => {
    const ref = c.req.param('ref')
    const status = DONATION_REF.test(ref) ? await supporters.status(ref) : null
    return status ? c.json(status) : c.json({ error: 'unknown donation' }, 404)
  })

  app.post('/donations/redeem', auth, smallBody, async (c) => {
    const body = await json(c)
    const code = isRecord(body) ? parseCode(body.code) : null
    if (!code) return c.json({ error: 'unknown code' }, 404)
    const redeemed = await supporters.redeem(c.var.userId, code)
    if (!redeemed.ok) return c.json({ error: redeemed.error }, redeemed.error === 'used' ? 409 : 404)
    return c.json({ tier: redeemed.tier })
  })

  const hookBody = bodyLimit({ maxSize: 64 * 1024 })

  app.post('/webhooks/stripe', hookBody, async (c) => {
    if (!webhooks.stripeSecret) return c.json({ error: 'webhook off' }, 503)
    const raw = await c.req.text()
    if (!verifyStripe(raw, c.req.header('Stripe-Signature'), webhooks.stripeSecret, Date.now() / 1000)) return c.json({ error: 'bad signature' }, 401)
    const event: unknown = JSON.parse(raw)
    const paid = stripeDonation(event, webhooks.stripePaymentLink)
    if (paid) await supporters.paid(paid)
    // A paid session dropped only for its link is usually a mistyped STRIPE_PAYMENT_LINK (ids are case-sensitive).
    const dropped = paid ? null : stripeDonation(event, null)
    if (dropped) console.warn(`stripe session ${dropped.ref} is paid but ignored: its payment link isn't STRIPE_PAYMENT_LINK (${webhooks.stripePaymentLink})`)
    return c.json({ received: true })
  })

  // AbacatePay signs the Standard Webhooks way since 01/10/2026; webhooks made before still send the URL secret and the public-key HMAC.
  app.post('/webhooks/abacatepay', hookBody, async (c) => {
    const secret = webhooks.abacatePaySecret
    if (!secret) return c.json({ error: 'webhook off' }, 503)
    const raw = await c.req.text()
    const standard = { id: c.req.header('webhook-id'), timestamp: c.req.header('webhook-timestamp'), signature: c.req.header('webhook-signature') }
    const ok = standard.signature
      ? verifyStandard(raw, standard, secret, Date.now() / 1000)
      : c.req.query('webhookSecret') === secret && verifyAbacate(raw, c.req.header('X-Webhook-Signature'))
    if (!ok) return c.json({ error: 'bad signature' }, 401)
    const paid = abacateDonation(JSON.parse(raw))
    if (paid) await supporters.paid(paid)
    return c.json({ received: true })
  })

  app.post('/discord/link', auth, async (c) => {
    const linked = await discord.link(c.var.userId).catch((err: unknown) => (console.error('discord link failed', err), null))
    if (!linked) return c.json({ error: 'clerk unavailable' }, 503)
    if (!linked.linked) return c.json({ error: 'no discord account' }, 404)
    return c.json({ username: linked.username, joined: linked.joined })
  })

  app.delete('/discord/link', auth, async (c) => {
    await discord.unlink(c.var.userId)
    return c.json({ unlinked: true })
  })

  app.get('/me/supporter', auth, async (c) => c.json(await supporters.mine(c.var.userId)))

  app.put('/me/supporter', auth, smallBody, async (c) => {
    const body = await json(c)
    if (!isRecord(body) || typeof body.public !== 'boolean') return c.json({ error: 'expected { public }' }, 400)
    await supporters.setPublic(c.var.userId, body.public)
    return c.json(await supporters.mine(c.var.userId))
  })

  app.get('/supporters', async (c) => {
    c.header('Cache-Control', 'public, max-age=60')
    const [wall, hidden] = await Promise.all([supporters.wall(), supporters.hidden()])
    return c.json({ supporters: wall, hidden })
  })

  app.get('/poll', async (c) => c.json(await supporters.poll()))

  app.put('/poll', auth, smallBody, async (c) => {
    const body = await json(c)
    const choice = isRecord(body) && isPollOption(body.choice) ? body.choice : null
    if (!choice) return c.json({ error: 'expected { choice }' }, 400)
    if (!(await supporters.vote(c.var.userId, choice))) return c.json({ error: 'supporters only' }, 403)
    return c.json(await supporters.poll())
  })

  app.get('/festival', maybeAuth, async (c) => {
    if (!c.var.userId) c.header('Cache-Control', 'public, max-age=30')
    return c.json(await festival.status(c.var.userId))
  })

  app.get('/candy-goal', async (c) => {
    c.header('Cache-Control', 'public, max-age=60')
    return c.json(await candyGoal.status())
  })

  app.post('/festival/donate', auth, smallBody, async (c) => {
    const body = await json(c)
    const amount = isRecord(body) ? parseDonationAmount(body.amount) : null
    if (!isRecord(body) || amount === null) return c.json({ error: 'expected { amount, base }' }, 400)
    const base = typeof body.base === 'number' && Number.isInteger(body.base) ? body.base : null
    if (!festival.takeDonate(c.var.userId)) return c.json({ error: 'too many donations' }, 429)
    const done = await festival.donate(c.var.userId, amount, base)
    if (!done.ok) return c.json({ error: done.error }, DONATE_ERRORS[done.error])
    return c.json({ save: done.save, revision: done.revision, held: done.held, today: done.today })
  })

  app.put('/festival/public', auth, smallBody, async (c) => {
    const body = await json(c)
    if (!isRecord(body) || typeof body.public !== 'boolean') return c.json({ error: 'expected { public }' }, 400)
    if (!festival.takeToggle(c.var.userId)) return c.json({ error: 'too many changes' }, 429)
    await festival.setPublic(c.var.userId, body.public)
    return c.json({ public: body.public })
  })

  app.get('/suggestions', maybeAuth, async (c) => {
    const sort = c.req.query('sort') ?? 'top'
    if (!isSuggestionSort(sort)) return c.json({ error: 'unknown sort' }, 400)
    return c.json({ suggestions: await suggestions.list(sort, c.var.userId) })
  })

  app.post('/suggestions', auth, smallBody, async (c) => {
    const draft = parseSuggestionDraft(await json(c))
    if (!draft) return c.json({ error: 'expected { title, body }' }, 400)
    const posted = await suggestions.post(c.var.userId, draft)
    if (!posted.ok) return c.json({ error: posted.error }, SUGGESTION_ERRORS[posted.error])
    return c.json({ suggestion: posted.suggestion }, 201)
  })

  app.put('/suggestions/:id/vote', auth, smallBody, async (c) => {
    const id = c.req.param('id')
    const body = await json(c)
    const vote = isRecord(body) && isVote(body.vote) ? body.vote : null
    if (vote === null) return c.json({ error: 'expected { vote }' }, 400)
    if (!SUGGESTION_ID.test(id)) return c.json({ error: 'unknown' }, 404)
    const voted = await suggestions.vote(c.var.userId, id, vote)
    if (!voted.ok) return c.json({ error: voted.error }, SUGGESTION_ERRORS[voted.error])
    return c.json({ score: voted.score, vote: voted.vote })
  })

  app.post('/reports', auth, smallBody, async (c) => {
    const draft = parseReport(await json(c))
    if (!draft) return c.json({ error: 'expected { target, run?, reason, note? }' }, 400)
    const reported = await moderation.report(c.var.userId, draft)
    if (reported !== 'stored') return c.json({ error: reported }, REPORT_ERRORS[reported])
    return c.json({ received: true }, 202)
  })

  app.post('/bug-reports', maybeAuth, bodyLimit({ maxSize: 32 * 1024 }), async (c) => {
    const report = parseBugReport(await json(c))
    if (!report) return c.json({ error: 'expected { text, tech? }' }, 400)
    const submitted = await bugReports.submit(report, { userId: c.var.userId, ip: clientIp(c.req.header('X-Real-IP'), c.req.header('X-Forwarded-For')) })
    return submitted.ok ? c.json({ id: submitted.id }, 201) : c.json({ error: 'too many reports' }, 429)
  })

  /** The desk's routes, all behind a valid token whose user Clerk says is admin. Everyone else gets 403, whatever they send. */
  const desk = new Hono<Auth>()

  desk.use(auth, async (c, next) => {
    if (!(await admin.isAdmin(c.var.userId))) return c.json({ error: 'forbidden' }, 403)
    await next()
  })

  desk.get('/', (c) => c.json({ admin: true }))

  desk.get('/users', async (c) => {
    const q = parseAdminQuery(c.req.query('q'))
    if (!q) return c.json({ error: 'expected ?q= a handle or an email' }, 400)
    return c.json({ users: await admin.search(q) })
  })

  desk.post('/gifts', smallBody, async (c) => {
    const body = await json(c)
    const content = isRecord(body) ? parseAdminGift(body.content) : null
    if (!isRecord(body) || typeof body.userId !== 'string' || typeof body.request !== 'string' || !content) {
      return c.json({ error: 'expected { userId, content, request }' }, 400)
    }
    const outcome = await admin.send(c.var.userId, body.userId, content, body.request)
    if (outcome === 'unknown' || outcome === 'bad request') return c.json({ error: outcome }, SEND_ERRORS[outcome])
    return c.json({ sent: outcome === 'sent' })
  })

  desk.get('/gifts', async (c) => c.json({ gifts: await admin.recent() }))

  desk.put('/suggestions/:id', smallBody, async (c) => {
    const id = c.req.param('id')
    const body = await json(c)
    const status = isRecord(body) && isSuggestionStatus(body.status) ? body.status : null
    if (!status) return c.json({ error: 'expected { status }' }, 400)
    if (!SUGGESTION_ID.test(id) || !(await suggestions.setStatus(id, status))) return c.json({ error: 'unknown' }, 404)
    console.log(`admin ${c.var.userId} set suggestion ${id} to ${status}`)
    return c.json({ status })
  })

  desk.get('/reports', async (c) => c.json(await moderation.open()))

  desk.post('/moderation', smallBody, async (c) => {
    const m = parseModeration(await json(c))
    if (!m) return c.json({ error: 'expected { userId, action, run?, reason? }' }, 400)
    const done = await moderation.act(c.var.userId, m)
    return done ? c.json(done) : c.json({ error: 'unknown' }, 404)
  })

  desk.get('/festival', async (c) => c.json({ donations: await festival.held() }))

  for (const action of ['approve', 'void'] as const) {
    desk.post(`/festival/:id/${action}`, async (c) => ((await festival.review(c.var.userId, c.req.param('id'), action)) ? c.json({ ok: true }) : c.json({ error: 'unknown' }, 404)))
  }

  app.route('/admin', desk)

  app.onError((err, c) => {
    console.error(err)
    report(err, { userId: c.var.userId, method: c.req.method, route: c.req.routePath })
    return c.json({ error: 'internal error' }, 500)
  })

  return app
}

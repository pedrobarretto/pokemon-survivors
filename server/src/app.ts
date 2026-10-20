import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import { parseAdminGift, parseAdminQuery } from '../../src/game/admin'
import { parseBugReport } from '../../src/game/bugReport'
import { challengeOpen } from '../../src/game/challenge'
import { creatorOf, isCreatorId } from '../../src/data/creators'
import { parseDonation } from '../../src/data/donations'
import { isPollOption } from '../../src/data/supporters'
import { isDayKey } from '../../src/game/day'
import { isDifficulty } from '../../src/game/difficulty'
import { parseSaveData } from '../../src/game/meta'
import { isRecord } from '../../src/game/parse'
import { isBoardPeriod, isPlayable, parseDisplayName, parseHandle, parseRunResult } from '../../src/game/ranking'
import { parseReplay } from '../../src/game/replay'
import { parseCode } from '../../src/game/supporters'
import { isSuggestionSort, isSuggestionStatus, isVote, parseSuggestionDraft } from '../../src/game/suggestions'
import type { AdminStore } from './admin'
import type { Verify } from './auth'
import type { BugReports } from './bugReports'
import type { Checks } from './checks'
import type { CreatorStore } from './creators'
import type { SaveStore } from './db'
import type { DiscordLink } from './discordLink'
import type { Report } from './errors'
import type { Donate } from './donations'
import type { GiftStore } from './gifts'
import type { RankingStore } from './ranking'
import type { SupporterStore } from './supporters'
import { SUGGESTION_ID, type SuggestionStore } from './suggestions'
import { abacateDonation, ABACATE_REF, stripeDonation, verifyAbacate, verifyStandard, verifyStripe } from './webhooks'

export type AppDeps = {
  store: SaveStore
  ranking: RankingStore
  gifts: Pick<GiftStore, 'inbox' | 'claim' | 'refer' | 'credit' | 'invites'>
  /** Re-simulates finished runs after the answer went out. */
  checks: Pick<Checks, 'schedule'>
  verify: Verify
  /** Donation checkouts (AbacatePay), null when the server has no key for them. */
  donate: Donate | null
  supporters: SupporterStore
  /** The idea board. */
  suggestions: SuggestionStore
  /** Bug reports: stored, then posted to the community Discord's #bug-reports. */
  bugReports: Pick<BugReports, 'submit'>
  /** The player's Discord account: the community server and its supporter role. */
  discord: Pick<DiscordLink, 'link' | 'unlink'>
  /** The gift desk: who is admin (asked of Clerk), finding players and sending them gifts. */
  admin: Pick<AdminStore, 'isAdmin' | 'search' | 'send' | 'recent'>
  /** Which content creators are live now. */
  creators: Pick<CreatorStore, 'live' | 'set'>
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

/** What a run's end answers when it's refused, by `FinishError`. */
const FINISH_ERRORS = { unknown: 404, mismatch: 409, clock: 422, challenge: 400 } as const

/**
 * The HTTP API. Routes marked (auth) need a Clerk session token
 * (`Authorization: Bearer …`) and act on that player; the public ones read it
 * when present (to answer "me" and "following").
 *
 * - `GET /health`: 200 while the database answers, else 503.
 * - `GET /save` (auth): the stored save and its revision, 404 before the first push.
 * - `PUT /save` (auth) `{ save, base }`: pushes the device's save on top of
 *   revision `base` (null if it never synced). Returns `{ save, revision, merged }`,
 *   what is stored now, for the device to keep (see `applyPush`).
 * - `GET /me` (auth): `{ profile }`, the player's handle and name, null before they pick them.
 * - `PUT /me` (auth) `{ handle, name }`: sets them. 409 `{ suggestion }` when the handle is taken.
 * - `POST /runs` (auth) `{ challenge? }`: `{ token }` for a run that just started. 429 past the start rate limit.
 *   With `challenge` (a `YYYY-MM-DD` Brasília day) it's that day's Desafio do dia, 400 when
 *   that day's challenge isn't open (`challengeOpen`).
 * - `PUT /runs/:token` (auth) `RunResult & { replay }`: records how it ended and
 *   returns `{ ranks, challenge }` (`ChallengePlace`, null for any other run); the
 *   replay may be re-simulated afterwards (`checks.ts`), and the run may make the player's invite count (`gifts.credit`). A challenge run's replay must
 *   be its day's challenge.
 *   400 for an implausible result or a replay of another run, 404 for an
 *   unknown token, 409 when it contradicts what the run already recorded, 422
 *   when the clock can't fit it. A body without a replay (an older game) is
 *   taken and stays unverified.
 * - `GET /boards/:difficulty?period=day|week|all&starter=&friends=1`: `Board`.
 *   `friends` needs a token.
 * - `GET /challenge/:day?friends=1`: `ChallengeBoard`, the day's official attempts. `friends` needs a token.
 * - `GET /profiles/:handle`: `PublicProfile`, 404 if nobody has that handle.
 * - `PUT|DELETE /follows/:handle` (auth): follows or unfollows. `{ followed, followers }`.
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
 * - `GET /supporters`: `{ supporters }`, the wall (`WallEntry[]`, with each one's title and Hall da Fama Pokémon).
 * - `GET /poll`: `Poll`. `PUT /poll` (auth) `{ choice }`: a supporter's vote, 403 for anyone else.
 * - `GET /suggestions?sort=top|new|done`: `{ suggestions }` (`Suggestion[]`), a tab of the idea board, with the asker's votes.
 * - `POST /suggestions` (auth) `{ title, body }`: posts an idea (`parseSuggestionDraft`), 201 `{ suggestion }`.
 *   400 invalid, 403 before the player has a handle, 429 past `SUGGESTION.perDay` in 24 hours.
 * - `PUT /suggestions/:id/vote` (auth) `{ vote }` (1, -1, or 0 to take it back): `{ score, vote }`. 404 unknown, 409 shipped.
 * - `POST /bug-reports` `{ text, tech? }`: a bug report (`parseBugReport`), from a guest or (with a token)
 *   a player. 201 `{ id }`, stored and on its way to Discord. 400 invalid, 429 past `BUG_REPORT.perHour`
 *   for the IP or the account.
 * - `POST /discord/link` (auth): links the Discord account the player connected in Clerk, joins them
 *   to the community server and gives them their supporter role. `{ username, joined }`; 404 when
 *   Clerk has no verified Discord account for them, 503 when Clerk can't answer.
 * - `DELETE /discord/link` (auth): forgets it (the player unlinked Discord). `{ unlinked: true }`.
 * - `GET /creators/live`: `{ live }` (`CreatorLive[]`), the content creators live now, newest stream first.
 * - `PUT /creators/:id/live` (auth) `{ live }`: the creator says they're live (for `LIVE_HOURS`) or done.
 *   Only the creator's own account (`account` in `data/creators.ts`) or an admin. `{ live, until }`;
 *   404 for an unknown creator, 403 for anyone else.
 * - `/admin…` (admin): the gift desk, 403 for anyone whose verified email isn't in `ADMIN_EMAILS`.
 *   `GET /admin`: `{ admin: true }`. `GET /admin/users?q=`: `{ users }` (`AdminUser[]`) by handle or email.
 *   `POST /admin/gifts` `{ userId, content, request }`: sends a gift (`parseAdminGift`), `{ sent }`
 *   (false when that `request` already went); 404 for an unknown player. `GET /admin/gifts`: `{ gifts }`
 *   (`AdminSent[]`), the latest sent by hand. `PUT /admin/suggestions/:id` `{ status }`: marks an idea
 *   `done` (shipped), `open` again or `hidden` (off the board). `{ status }`, 404 for an unknown idea.
 */
export const createApp = ({ store, ranking, gifts, checks, verify, donate, supporters, suggestions, bugReports, discord, admin, creators, webhooks, allowedOrigin, ping, report }: AppDeps) => {
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
    const token = await ranking.startRun(c.var.userId, challenge)
    return token ? c.json({ token }, 201) : c.json({ error: 'too many runs' }, 429)
  })

  // A 30-minute replay is ~60 KB of JSON.
  app.put('/runs/:token', auth, runBody, async (c) => {
    const body = await json(c)
    const result = parseRunResult(body)
    if (!result) return c.json({ error: 'implausible result' }, 400)
    const replay = isRecord(body) && body.replay !== undefined ? parseReplay(body.replay) : null
    if (isRecord(body) && body.replay !== undefined && (!replay || replay.start.starter !== result.starter || replay.start.difficulty !== result.difficulty)) {
      return c.json({ error: 'replay of another run' }, 400)
    }
    const token = c.req.param('token')
    const finished = await ranking.finishRun(c.var.userId, token, result, replay)
    if (!finished.ok) return c.json({ error: finished.error }, FINISH_ERRORS[finished.error])
    if (replay) checks.schedule(token)
    void gifts.credit(c.var.userId).catch((err) => console.error('invite credit failed', err))
    const [ranks, challenge] = await Promise.all([
      ranking.runRanks(c.var.userId, result.difficulty),
      finished.challenge ? ranking.challengePlace(c.var.userId, finished.challenge, finished.official === true) : null,
    ])
    return c.json({ ranks, challenge })
  })

  app.get('/boards/:difficulty', maybeAuth, async (c) => {
    const difficulty = c.req.param('difficulty')
    const period = c.req.query('period') ?? 'all'
    const starter = c.req.query('starter') || null
    const friends = c.req.query('friends') === '1'
    if (!isDifficulty(difficulty) || !isBoardPeriod(period) || (starter !== null && !isPlayable(starter))) return c.json({ error: 'unknown board' }, 400)
    if (friends && !c.var.userId) return c.json({ error: 'unauthorized' }, 401)
    return c.json(await ranking.board({ difficulty, period, starter, friends, viewer: c.var.userId }))
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
      const followed = handle ? await ranking.follow(c.var.userId, handle, on) : null
      return followed ? c.json(followed) : c.json({ error: 'no such player' }, 404)
    })
  }

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

  app.get('/creators/live', async (c) => {
    c.header('Cache-Control', 'public, max-age=30')
    return c.json({ live: await creators.live() })
  })

  app.put('/creators/:id/live', auth, smallBody, async (c) => {
    const id = c.req.param('id')
    const body = await json(c)
    if (!isRecord(body) || typeof body.live !== 'boolean') return c.json({ error: 'expected { live }' }, 400)
    if (!isCreatorId(id)) return c.json({ error: 'unknown' }, 404)
    const { account } = creatorOf(id)
    const own = account !== null && (await ranking.profileName(c.var.userId))?.handle === account
    if (!own && !(await admin.isAdmin(c.var.userId))) return c.json({ error: 'forbidden' }, 403)
    const until = await creators.set(id, body.live)
    console.log(`${c.var.userId} set ${id} ${until ? 'live' : 'offline'}`)
    return c.json({ live: until !== null, until })
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
    return c.json({ supporters: await supporters.wall() })
  })

  app.get('/poll', async (c) => c.json(await supporters.poll()))

  app.put('/poll', auth, smallBody, async (c) => {
    const body = await json(c)
    const choice = isRecord(body) && isPollOption(body.choice) ? body.choice : null
    if (!choice) return c.json({ error: 'expected { choice }' }, 400)
    if (!(await supporters.vote(c.var.userId, choice))) return c.json({ error: 'supporters only' }, 403)
    return c.json(await supporters.poll())
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

  app.route('/admin', desk)

  app.onError((err, c) => {
    console.error(err)
    report(err, { userId: c.var.userId, method: c.req.method, route: c.req.routePath })
    return c.json({ error: 'internal error' }, 500)
  })

  return app
}

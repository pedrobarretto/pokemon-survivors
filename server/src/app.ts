import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import { challengeOpen } from '../../src/game/challenge'
import { isDayKey } from '../../src/game/day'
import { isDifficulty } from '../../src/game/difficulty'
import { parseSaveData } from '../../src/game/meta'
import { isRecord } from '../../src/game/parse'
import { isBoardPeriod, isPlayable, parseDisplayName, parseHandle, parseHandlePrefix, parseRunResult } from '../../src/game/ranking'
import { parseReplay } from '../../src/game/replay'
import type { Verify } from './auth'
import type { Checks } from './checks'
import type { SaveStore } from './db'
import type { FriendStore } from './friends'
import type { GiftStore } from './gifts'
import type { RankingStore } from './ranking'

export type AppDeps = {
  store: SaveStore
  ranking: RankingStore
  friends: FriendStore
  gifts: Pick<GiftStore, 'inbox' | 'claim' | 'refer'>
  /** Re-simulates finished runs after the answer went out. */
  checks: Pick<Checks, 'schedule'>
  verify: Verify
  allowedOrigin: (origin: string) => boolean
  /** Whether the database answers, for `/health`. */
  ping: () => Promise<boolean>
}

type Auth = { Variables: { userId: string } }

type MaybeAuth = { Variables: { userId: string | null } }

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
 *   replay is re-simulated afterwards (`checks.ts`). A challenge run's replay must
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
 *   Following is a friend request; following back accepts it.
 * - `GET /friends` (auth): `FriendList`, friends and pending requests both ways.
 * - `DELETE /followers/:handle` (auth): declines their request (drops their follow). `{ ok }`.
 * - `DELETE /friends/:handle` (auth): unfriends (drops both follows). `{ ok }`.
 * - `GET /players?q=`: `{ players }`, up to 8 `PlayerMatch` whose handle starts with `q` (2+ characters), without the asker.
 * - `GET /gifts` (auth): `{ gifts }`, the player's unclaimed Mystery Gifts, oldest first.
 * - `POST /gifts/claim` (auth) `{ ids }`: marks those gifts claimed (the game applied them). `{ claimed }`.
 * - `POST /referral` (auth) `{ ref }`: the inviter's handle a new account came with. `{ referred }`:
 *   whether it counted (only a new account, never oneself: `canRefer`).
 */
export const createApp = ({ store, ranking, friends, gifts, checks, verify, allowedOrigin, ping }: AppDeps) => {
  const app = new Hono()

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
  app.put('/runs/:token', auth, bodyLimit({ maxSize: 512 * 1024 }), async (c) => {
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

  app.get('/friends', auth, async (c) => c.json(await friends.list(c.var.userId)))

  for (const [path, drop] of [['/followers/:handle', friends.decline], ['/friends/:handle', friends.unfriend]] as const) {
    app.delete(path, auth, async (c) => {
      const handle = parseHandle(c.req.param('handle'))
      return handle && (await drop(c.var.userId, handle)) ? c.json({ ok: true }) : c.json({ error: 'no such player' }, 404)
    })
  }

  app.get('/players', maybeAuth, async (c) => {
    const prefix = parseHandlePrefix(c.req.query('q'))
    return c.json({ players: prefix ? await friends.search(prefix, c.var.userId) : [] })
  })

  app.get('/gifts', auth, async (c) => c.json({ gifts: await gifts.inbox(c.var.userId) }))

  app.post('/gifts/claim', auth, smallBody, async (c) => {
    const body = await json(c)
    const ids = isRecord(body) && Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 50) : null
    if (!ids) return c.json({ error: 'expected { ids }' }, 400)
    return c.json({ claimed: await gifts.claim(c.var.userId, ids) })
  })

  app.post('/referral', auth, smallBody, async (c) => {
    const body = await json(c)
    const ref = isRecord(body) ? parseHandle(body.ref) : null
    if (!ref) return c.json({ error: 'expected { ref }' }, 400)
    return c.json({ referred: await gifts.refer(c.var.userId, ref) })
  })

  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: 'internal error' }, 500)
  })

  return app
}

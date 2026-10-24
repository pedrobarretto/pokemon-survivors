import { track } from './analytics'
import { accountHandle, accountUserId, API_URL, sessionToken, storedRef, storeRef } from './account'
import type { EnemyId } from './data/enemies'
import type { PlayableId } from './data/hatchlings'
import type { Difficulty } from './game/difficulty'
import { isRecord } from './game/parse'
import type { DayKey } from './game/day'
import { isOutbreakSpecies } from './game/outbreak'
import { isPlayable, parseChallengePlace, parseRunResult, rankable, type Board, type BoardPeriod, type ChallengeBoard, type ChallengePlace, type ProfileRun, type PublicProfile, type RunMode, type RunRanks, type RunResult } from './game/ranking'
import { firstTouch, landingRef, parseInvites, REF_PARAM } from './game/referral'
import { RULES_VERSION, type Recorder, type Replay } from './game/replay'
import { cutReplay, STREAM, STREAM_START, type ReplayChunk } from './game/replayStream'
import { ROUTES, SITE_URL } from './site/routes'
import { locale } from './i18n'
import { timeoutSignal } from './net/timeout'

/**
 * Ranked runs and the public side of accounts (boards, profiles, follows),
 * through the API (`server/`). Like `account.ts`, nothing here may block the
 * game: a signed-in player's next run gets its start token and seed ahead, on
 * the menus (a run that starts without one plays unranked), its result
 * waits in a queue in `localStorage` until the API takes it, and every read
 * fails soft (null), so the screens just say the ranking is out of reach.
 */

/** The boards and profiles read from the API; ranked runs also need an account. */
export const rankingEnabled = Boolean(API_URL)

const TIMEOUT_MS = 10_000

/** The API, with the player's token when there is one. Rejects offline. */
const call = (path: string, token: string | null, init: RequestInit = {}) =>
  fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: timeoutSignal(TIMEOUT_MS),
  })

/** A JSON body, or null when the call failed or answered an error; for an error, the API's `{ error }` when it said one. */
const read = async (path: string, token: string | null, init?: RequestInit): Promise<{ status: number; body: unknown; error: string | null }> => {
  try {
    const res = await call(path, token, init)
    if (res.ok) return { status: res.status, body: await res.json(), error: null }
    const said: unknown = await res.json().catch(() => null)
    return { status: res.status, body: null, error: isRecord(said) && typeof said.error === 'string' ? said.error : null }
  } catch {
    return { status: 0, body: null, error: null }
  }
}

/** Called when the API plays newer rules than this build (`RULES_VERSION`): its runs would be refused as `outdated`. */
let rulesBehind = () => {}

/** Sets what to do when this build's rules fall behind the API's (`main.ts` loads the newer build). */
export const onRulesBehind = (then: () => void) => {
  rulesBehind = then
}

/* ---------------- Ranked runs ---------------- */

const QUEUE_KEY = 'ps:runs'

/** Results kept for the API at most (a replay records up to ~450 KB an hour); older ones give way. */
const MAX_PENDING = 10

/**
 * A run result waiting for the API, under the start token of the player who
 * played it, with its replay for the server to re-simulate (checked there).
 */
type Pending = { userId: string; token: string; result: RunResult; replay: unknown }

const readQueue = (): Pending[] => {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
    if (!Array.isArray(data)) return []
    return data.flatMap((p: unknown) => {
      const result = isRecord(p) ? parseRunResult(p.result) : null
      return isRecord(p) && result && typeof p.userId === 'string' && typeof p.token === 'string' ? [{ userId: p.userId, token: p.token, result, replay: p.replay }] : []
    })
  } catch {
    return []
  }
}

/** Stores the newest results: when storage is full (long endless replays), the oldest give way until the rest fit. False when none fit (storage left as it was). */
const storeQueue = (queue: Pending[]) => {
  for (let kept = queue.slice(-MAX_PENDING); kept.length > 0; kept = kept.slice(1)) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(kept))
      return true
    } catch {
      // Full: try again without the oldest.
    }
  }
  return false
}

/** Keeps the newest results (`storeQueue`), or none when not even the newest fits. */
const writeQueue = (queue: Pending[]) => {
  if (storeQueue(queue)) return
  try {
    localStorage.removeItem(QUEUE_KEY)
  } catch {
    // Storage blocked: nothing waits for the API.
  }
}

/**
 * What became of a ranked run's result: on the boards (`ranked`, with the
 * player's position, and the challenge board's for a Desafio do dia run),
 * waiting for a connection (`queued`), refused by the server (`rejected`;
 * `outdated` when it played by older rules than the API's: the game was
 * updated while it played), never ranked because its start got no token (`unranked`), or taken but
 * kept off the boards because its replay didn't reach the API in time while
 * it played (`unlisted`: the connection dropped; only with the API's `STREAM_ENFORCE`).
 */
export type RankOutcome = { kind: 'ranked'; ranks: RunRanks; challenge: ChallengePlace | null } | { kind: 'queued' | 'rejected' | 'outdated' | 'unranked' | 'unlisted' }

const parseRanks = (body: unknown): RunRanks | null => {
  const ranks = isRecord(body) && isRecord(body.ranks) ? body.ranks : null
  const at = (v: unknown) => (typeof v === 'number' ? v : null)
  return ranks ? { day: at(ranks.day), week: at(ranks.week), all: at(ranks.all) } : null
}

/* ---------------- Replay streaming ---------------- */

/** The first wait before sending a chunk again, doubled on each failure up to `RETRY_MAX_MS`. */
const RETRY_MS = 2000
const RETRY_MAX_MS = 30_000

/**
 * A ranked run's replay on its way to the API while it plays
 * (`game/replayStream.ts`): once `STREAM.ticks` ticks were recorded since the
 * last chunk, they become the next one, sent in order and sent again while
 * the network is down. Any other failure ends the stream (the result still
 * reports, and the API decides what it's worth).
 */
type Stream = {
  token: string
  /** Called on every frame that stepped the run: cuts a chunk when one is due (an integer compare otherwise). */
  cut: (rec: Recorder) => void
  /** Sends the chunks cut so far. Whether none is left waiting (false: no connection, they wait). */
  flush: () => Promise<boolean>
}

const createStream = (token: string, live: Promise<boolean>): Stream => {
  let at = STREAM_START
  let seq = 0
  const waiting: { seq: number; chunk: ReplayChunk }[] = []
  let stopped = false
  let sending: Promise<boolean> = Promise.resolve(true)
  let retry: ReturnType<typeof setTimeout> | null = null
  let backoff = RETRY_MS

  const stop = () => {
    stopped = true
    waiting.length = 0
  }

  const sendWaiting = async () => {
    if (!(await live)) stop()
    while (waiting.length > 0) {
      const session = await sessionToken()
      if (!session) return false
      const { seq: n, chunk } = waiting[0]!
      const { status } = await read(`/runs/${token}/chunks/${n}`, session, { method: 'PUT', body: JSON.stringify(chunk) })
      // Only what stops the result too (no connection, an expired session) keeps a chunk waiting: a result never waits on a broken chunk route.
      if (status === 0 || status === 401) return false
      waiting.shift()
      if (status >= 300) stop()
    }
    backoff = RETRY_MS
    return true
  }

  /** Tries again later, while this is the latest run's stream; once they're through, a result that waited behind them goes too. */
  const later = () => {
    if (retry !== null || streaming?.token !== token) return
    retry = setTimeout(() => {
      retry = null
      void flush().then((ok) => ok && void flushRuns())
    }, backoff)
    backoff = Math.min(backoff * 2, RETRY_MAX_MS)
  }

  const flush = (): Promise<boolean> =>
    (sending = sending.then(sendWaiting, sendWaiting).then((ok) => {
      if (!ok) later()
      return ok
    }))

  return {
    token,
    cut: (rec) => {
      if (stopped || rec.tick - at.tick < STREAM.ticks) return
      const { segment, next } = cutReplay(rec.replay, at, rec.tick)
      waiting.push({ seq: seq++, chunk: { from: at.tick, to: next.tick, ...segment } })
      at = next
      void flush()
    },
    flush,
  }
}

/** The stream of the ranked run playing now, or of the last one (its result may still be on its way). */
let streaming: Stream | null = null

/**
 * Sends the queued results of the signed-in player, oldest first. An answer
 * takes a result off the queue, whatever it says (a banned account's 403
 * too: it's `rejected`, never sent again); no connection, an expired
 * session or the rate limit keep it (and the rest) for next time, as do
 * chunks of its stream still waiting, which go first. Returns what the API
 * said, by token.
 */
const flushOnce = async () => {
  const done = new Map<string, RankOutcome>()
  const userId = accountUserId()
  const token = userId ? await sessionToken() : null
  if (!token) return done
  for (const p of readQueue().filter((q) => q.userId === userId)) {
    // The replay's chunks before its result: what they committed must be in by then.
    if (streaming?.token === p.token && !(await streaming.flush())) break
    const { status, body, error } = await read(`/runs/${p.token}`, token, { method: 'PUT', body: JSON.stringify({ ...p.result, replay: p.replay }) })
    if (status === 0 || status === 401 || status === 429 || status >= 500) break
    const ranks = parseRanks(body)
    const listed = !isRecord(body) || body.listed !== false
    const outdated = status === 400 && error === 'outdated'
    if (outdated) rulesBehind()
    done.set(p.token, outdated ? { kind: 'outdated' } : !ranks ? { kind: 'rejected' } : listed ? { kind: 'ranked', ranks, challenge: isRecord(body) ? parseChallengePlace(body.challenge) : null } : { kind: 'unlisted' })
    // A newer result of the same run (endless mode) may have queued meanwhile: only this one is done.
    writeQueue(readQueue().filter((q) => q.token !== p.token || q.result.time > p.result.time))
  }
  return done
}

let flushing: Promise<Map<string, RankOutcome>> = Promise.resolve(new Map())

/** Sends what's queued (boot, end of a run). Calls take turns. Never throws. */
export const flushRuns = () => (flushing = flushing.then(flushOnce, flushOnce).catch(() => new Map<string, RankOutcome>()))

/**
 * A start token the API dealt ahead of its run, for the player `userId`, with
 * the seed the run must play (null from an API older than server seeds,
 * which takes any), the day's outbreak and whether the day is haunted (Noite
 * das Bruxas) by the API's clock (null from an older API), when it came
 * (`dealt`: the wall clock and the page's monotonic one) and the Desafio do
 * dia day it's for (null: a regular run).
 */
type Ticket = TicketPlan & { userId: string; day: DayKey | null; token: string; dealt: { wall: number; mono: number } }

/**
 * How long a ticket's day holds (its outbreak and haunting). The API accepts
 * the outbreak of the day a run starts or the day before (`outbreakFits`),
 * and a haunted run on an event day or the day after (`halloweenFits`), so a
 * day dealt less than a day before the run fits whatever the device's clock
 * says; past this, the run plays the device's day instead.
 */
const DAY_HOLD_MS = 20 * 3600 * 1000

/** How long a ticket has been held, by both clocks (sleep can stall the monotonic one, a clock fix jumps the wall one). */
const heldFor = (t: Ticket) => Math.max(Date.now() - t.dealt.wall, performance.now() - t.dealt.mono)

/** What a ticket tells its run: its seed, plus its day (outbreak and haunting) while it holds. */
const planOf = (t: Ticket): TicketPlan =>
  heldFor(t) < DAY_HOLD_MS
    ? { seed: t.seed, outbreak: t.outbreak, halloween: t.halloween }
    : { seed: t.seed, outbreak: null, halloween: null }

/**
 * A ticket held longer than this is asked for again when the menus prefetch:
 * the API times a run's first chunk from when its seed was dealt (a seed
 * known long before the run could be searched offline), so the seed in hand
 * should be fresh when Play is pressed.
 */
const FRESH_MS = 2 * 60 * 1000

/** What a ticket in hand tells the next run: its seed, outbreak and haunting (null: the game's own). */
export type TicketPlan = { seed: number | null; outbreak: EnemyId | null; halloween: boolean | null }

type TicketKind = 'regular' | 'challenge'

const kindOf = (day: DayKey | null): TicketKind => (day ? 'challenge' : 'regular')

/** The tickets in hand, one per kind: the API keeps only the newest of each kind live (besides runs already streaming). */
const held: Record<TicketKind, Ticket | null> = { regular: null, challenge: null }

/** Asks in flight, one per kind. */
const asking: Record<TicketKind, Promise<Ticket | null> | null> = { regular: null, challenge: null }

/** Settles once every result reported so far reached the API or the queue, so no new token replaces a run that's still reporting. */
let reporting: Promise<unknown> = Promise.resolve()

/** Whether `t` can start a run of `day` for the player signed in now. */
const fits = (t: Ticket | null, day: DayKey | null): t is Ticket => t !== null && t.userId === accountUserId() && t.day === day

/** A start token, its seed and the day (outbreak, haunting) from the API, or null (guest, offline, rate limited, a challenge that closed). */
const requestTicket = async (userId: string, day: DayKey | null): Promise<Ticket | null> => {
  const session = await sessionToken()
  if (!session) return null
  const { body } = await read('/runs', session, { method: 'POST', ...(day ? { body: JSON.stringify({ challenge: day }) } : {}) })
  if (!isRecord(body) || typeof body.token !== 'string') return null
  const seed = typeof body.seed === 'number' && Number.isSafeInteger(body.seed) ? body.seed : null
  const outbreak = isOutbreakSpecies(body.outbreak) ? body.outbreak : null
  const halloween = typeof body.halloween === 'boolean' ? body.halloween : null
  // An API older than this answers no `rules`.
  if (typeof body.rules === 'number' && body.rules > RULES_VERSION) rulesBehind()
  return { userId, day, token: body.token, seed, outbreak, halloween, dealt: { wall: Date.now(), mono: performance.now() } }
}

/**
 * Gets a ticket for the player's next run of this kind (`day`: a Desafio do
 * dia's) in the background, unless one is in hand, so pressing Play never
 * waits on the network. Results still queued go first: the new token replaces
 * the player's unfinished one, which may be a run that just ended. Call it
 * only between runs (menus, results), never while a ranked run plays.
 * Resolves to what the ticket tells its run (`TicketPlan`), null without one.
 */
export const prefetchRanked = async (day: DayKey | null = null): Promise<TicketPlan | null> => {
  const userId = accountUserId()
  const kind = kindOf(day)
  if (!rankingEnabled || !userId) return null
  const have = held[kind]
  if (fits(have, day) && heldFor(have) < FRESH_MS) return planOf(have)
  // A stale ticket gives way now: the new one replaces its token, so no run may start on it meanwhile.
  if (have && !asking[kind]) held[kind] = null
  asking[kind] ??= reporting
    .then(flushRuns)
    .then(() => requestTicket(userId, day))
    .then((t) => (t && accountUserId() === userId ? (held[kind] = t) : null))
    .finally(() => (asking[kind] = null))
  const got = await asking[kind]
  return fits(got, day) ? planOf(got) : null
}

/**
 * A run played signed in. `stream` goes on every frame that stepped it, and
 * sends the replay to the API in chunks as it's recorded (see `Stream`).
 * `submit` reports its result with the replay so far
 * and resolves once the API took it (or the queue did); reporting again only
 * sends a longer run (a victory that went on into endless mode), else it
 * answers what it did last.
 */
export type RankedRun = {
  stream: (rec: Recorder) => void
  submit: (result: RunResult, replay: Replay) => Promise<RankOutcome>
  checkpoint: (time: number, result: () => RunResult, replay: Replay) => void
}

/** A run that starts signed in: the seed, outbreak and haunting it must play (null: the game's own) and its ranking. */
export type RankedStart = TicketPlan & { ranked: RankedRun }

const unranked: RankedRun = { stream: () => {}, submit: () => Promise.resolve({ kind: 'unranked' }), checkpoint: () => {} }

/** Seconds of play between two checkpoints of a run going on past its report (endless mode). */
const CHECKPOINT_S = 60

/** Whether a run at `time` is due a checkpoint: it reported at `sent` (-1: not yet) and was last kept at `kept`. */
const checkpointDue = (time: number, sent: number, kept: number) => sent >= 0 && time >= Math.max(sent, kept) + CHECKPOINT_S

/**
 * Takes the ticket in hand for a run that begins now (`challenge`: the day of
 * the Desafio do dia it plays) and restarts its clock on the API. Without one
 * (offline, rate limited, Play pressed before it came) the run is unranked
 * and plays a seed and day of the game's own. Null for guests.
 */
export const startRanked = (challenge: DayKey | null = null): RankedStart | null => {
  const userId = accountUserId()
  if (!rankingEnabled || !userId) return null
  const kind = kindOf(challenge)
  const ticket = held[kind]
  if (!fits(ticket, challenge)) return { seed: null, outbreak: null, halloween: null, ranked: unranked }
  held[kind] = null
  const { token } = ticket
  // 409: another tab or device got a newer token since, so this one can't report.
  const live = sessionToken().then(async (session) => (session ? (await read(`/runs/${token}/start`, session, { method: 'POST' })).status !== 409 : true))
  let alive = true
  void live.then((ok) => (alive = ok))
  const stream = createStream(token, live)
  streaming = stream
  let sent = -1
  let kept = -1
  let last: Promise<RankOutcome> = Promise.resolve({ kind: 'unranked' })
  return {
    ...planOf(ticket),
    ranked: {
      stream: stream.cut,
      submit: (result, replay) => {
        if (result.time <= sent) return last
        sent = result.time
        // A copy now: the recorder keeps writing if the run goes on.
        const recorded: unknown = JSON.parse(JSON.stringify(replay))
        last = live.then(async (ok): Promise<RankOutcome> => {
          if (!ok) return { kind: 'unranked' }
          writeQueue([...readQueue().filter((q) => q.token !== token), { userId, token, result, replay: recorded }])
          return (await flushRuns()).get(token) ?? { kind: 'queued' }
        })
        reporting = Promise.all([reporting, last])
        return last
      },
      // Past its report (endless mode), the run's latest result waits in the queue unsent: if the page dies
      // (a crash, a closed tab), the next boot sends it, and the end's own report replaces it otherwise.
      checkpoint: (time, report, replay) => {
        if (!alive || !checkpointDue(time, sent, kept)) return
        const result = report()
        if (!rankable(result)) return
        kept = result.time
        // Storage too full even for this one leaves the queue as it was (its last checkpoint).
        storeQueue([...readQueue().filter((q) => q.token !== token), { userId, token, result, replay }])
      },
    },
  }
}

/* ---------------- Boards, profiles, follows ---------------- */

/** Which board to show (see `BoardQuery` on the server): the regular runs' or the Legend mode's (`mode`), by difficulty. */
export type BoardFilter = { mode: RunMode; difficulty: Difficulty; period: BoardPeriod; starter: PlayableId | null; friends: boolean }

/**
 * Whether this build knows a run's Pokémon. The API may already rank one a
 * newer build added (a tab left open across a deploy), and the screens draw
 * every run from `PLAYABLE`: such runs are left out until the page reloads.
 */
const knownRun = (run: { starter: unknown }) => isPlayable(run.starter)

/** A board (or the challenge's) without the runs this build can't draw (`knownRun`). */
const knownBoard = <B extends Board>(board: B): B => ({ ...board, entries: board.entries.filter(knownRun), me: board.me && knownRun(board.me) ? board.me : null })

const knownRecords = (records: Partial<Record<Difficulty, ProfileRun>>): Partial<Record<Difficulty, ProfileRun>> =>
  Object.fromEntries(Object.entries(records).filter(([, run]) => run !== undefined && knownRun(run)))

/** A profile without the runs this build can't draw (`knownRun`). */
const knownProfile = (p: PublicProfile): PublicProfile => ({
  ...p,
  records: knownRecords(p.records ?? {}),
  ...(p.legendRecords ? { legendRecords: knownRecords(p.legendRecords) } : {}),
  recent: p.recent.filter(knownRun),
})

/** A board, or null when the API can't be reached. Friends boards need an account. */
export const fetchBoard = async (f: BoardFilter): Promise<Board | null> => {
  const params = new URLSearchParams({ period: f.period, ...(f.mode === 'legend' ? { mode: f.mode } : {}), ...(f.starter ? { starter: f.starter } : {}), ...(f.friends ? { friends: '1' } : {}) })
  const { body } = await read(`/boards/${f.difficulty}?${params}`, await sessionToken())
  // Our own API: a quick look at the shape is enough, past the Pokémon the screens draw.
  return isRecord(body) && Array.isArray(body.entries) ? knownBoard(body as Board) : null
}

/** A day's challenge board (friends only: who the player follows), or null when the API can't be reached. */
export const fetchChallengeBoard = async (day: DayKey, friends = false): Promise<ChallengeBoard | null> => {
  const { body } = await read(`/challenge/${day}${friends ? '?friends=1' : ''}`, await sessionToken())
  return isRecord(body) && Array.isArray(body.entries) && typeof body.total === 'number' ? knownBoard(body as ChallengeBoard) : null
}

/** A public profile, `missing` when nobody has that handle, null when the API can't be reached. */
export const fetchProfile = async (handle: string): Promise<PublicProfile | 'missing' | null> => {
  const { status, body } = await read(`/profiles/${encodeURIComponent(handle)}`, await sessionToken())
  if (status === 404 || status === 400) return 'missing'
  return isRecord(body) && typeof body.handle === 'string' && Array.isArray(body.recent) ? knownProfile(body as PublicProfile) : null
}

/** Follows or unfollows `handle`. Their follower count after it, or null when it didn't go through. */
export const setFollow = async (handle: string, follow: boolean) => {
  const token = await sessionToken()
  if (!token) return null
  const { body } = await read(`/follows/${encodeURIComponent(handle)}`, token, { method: follow ? 'PUT' : 'DELETE' })
  return isRecord(body) && typeof body.followers === 'number' ? { followed: body.followed === true, followers: body.followers } : null
}

/* ---------------- Links ---------------- */

/** Query parameter of a shared profile link (`/?u=handle`). */
export const PROFILE_PARAM = 'u'

/** The shareable link to a profile: the game opens straight on it, crediting whoever shares it when that's someone else (`?ref=`). */
export const profileUrl = (handle: string) => {
  const own = accountHandle()
  const ref = own && own !== handle ? `&${REF_PARAM}=${encodeURIComponent(own)}` : ''
  return `${location.origin}${ROUTES.play[locale()]}?${PROFILE_PARAM}=${encodeURIComponent(handle)}${ref}`
}

/**
 * The game's link for a share card or its text, crediting `handle` (`?ref=`)
 * when the player has one. Always the public site, so a card shared from a
 * preview build still sends people to the game.
 */
export const gameUrl = (handle: string | null) => `${SITE_URL}${ROUTES.play[locale()]}${handle ? `?${REF_PARAM}=${encodeURIComponent(handle)}` : ''}`

/* ---------------- Invites ---------------- */

/** The friends who signed up with the player's link (`InvitedFriend[]`), or null offline or signed out. */
export const fetchInvites = async () => {
  const token = await sessionToken()
  if (!token) return null
  return parseInvites((await read('/invites', token)).body)
}

const inviters = new Map<string, Promise<string | null>>()

/**
 * The display name of the device's inviter (`storedRef`), for the title's
 * invite banner: asked once per page, null offline or when nobody has that handle.
 */
export const inviterName = (): Promise<string | null> => {
  const ref = storedRef()
  if (!ref || !rankingEnabled) return Promise.resolve(null)
  let name = inviters.get(ref)
  if (!name) inviters.set(ref, (name = fetchProfile(ref).then((p) => (p && p !== 'missing' ? p.name : null))))
  return name
}

/** Dev: lands as if invited by `handle` (shown as `name`), without asking the API. */
export const stageInvite = (handle: string, name: string = handle) => {
  storeRef(handle)
  inviters.set(handle, Promise.resolve(name))
}

/**
 * On boot: a link with `?ref=` (or a profile's `?u=`) keeps its handle as the
 * device's inviter, first touch only and never the player's own, and counts
 * the landing when it's news to this device. `?ref=` stays in the address bar:
 * a friend who opened the link inside an app (X, Instagram) and moves to the
 * browser to sign in with Google still brings it along.
 */
export const captureRef = () => {
  const params = new URLSearchParams(location.search)
  const landed = landingRef(params, PROFILE_PARAM)
  if (!landed) return
  const own = accountHandle()
  const stored = storedRef()
  const keep = firstTouch(stored, landed, own)
  if (keep !== stored && keep !== null) storeRef(keep)
  if (landed !== own && landed !== stored) track('ref_land', { ref: landed, via: params.has(REF_PARAM) ? 'ref' : 'profile', first: stored === null ? 1 : 0 })
}

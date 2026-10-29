import { ARENA_RANKED, type QueueKind } from '../../src/data/arenaRanked'
import { ARENA_FORMATS, arenaPlayers, parseArenaFormat, type ArenaFormat } from '../../src/data/arenaFormats'
import type { ArenaTicketsResponse, QueueClientMessage } from '../../src/net/arena'
import { botsAfter, mmrWindow, splitTeams } from '../../src/net/arenaQueue'
import { LIMITS, parseAuth } from '../../src/net/protocol'

/**
 * The Arena's matchmaker as pure rules (`matchmakerObject.ts` is its Durable
 * Object): who may queue, and every second which tickets make a match. No
 * sockets, clock or I/O: the caller passes `now`.
 */

/** A player waiting in the queue. */
export type Ticket = {
  /** Its socket. */
  conn: string
  /** Its identity (`u:<clerk id>`, or `g:<guest id>` on a dev relay): one ticket each. */
  user: string
  kind: QueueKind
  /** The match format it queues for: tickets of different formats never meet. */
  format: ArenaFormat
  /** Its friends' party (tickets with the same code, kind, format and build play on one team), or null. */
  party: string | null
  build: string
  /** When it queued (ms). */
  since: number
  /** Its MMR, or null while the API is asked (a ticket without one isn't matched yet). */
  mmr: number | null
  /** The Durable Object location hint nearest the player (`hintFor`), or null. */
  hint: string | null
}

/** A match made: its queue and format, whether it's rated, the build its room runs, where it should run and each player's team. */
export type Match = { kind: QueueKind; format: ArenaFormat; ranked: boolean; build: string; hint: string | null; players: { conn: string; user: string; team: 0 | 1 }[] }

/** A ticket still waiting, as `queued` tells it: seconds waited, humans its forming match has, seconds until bots fill it. */
export type Waiting = { conn: string; kind: QueueKind; waited: number; found: number; botsIn: number }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * A queue message from an untrusted string, or null. A `queue` without a
 * format is for the standard 4v4 (every client before formats); one for
 * Ranqueada in a format without a ranked queue is refused (null).
 */
export const parseQueueMessage = (raw: string): QueueClientMessage | null => {
  if (raw.length > LIMITS.message) return null
  let m: unknown
  try {
    m = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(m)) return null
  switch (m.t) {
    case 'queue': {
      const auth = parseAuth(m.auth)
      const kind = m.kind === 'casual' || m.kind === 'ranked' ? m.kind : null
      const party = m.party === null || m.party === undefined ? null : typeof m.party === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(m.party) ? m.party : undefined
      const build = typeof m.build === 'string' && /^[\w.-]{1,40}$/.test(m.build) ? m.build : null
      const starter = typeof m.starter === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(m.starter) ? m.starter : null
      const format = m.format === undefined ? 'standard' : parseArenaFormat(m.format) === m.format ? parseArenaFormat(m.format) : null
      if (!auth || !kind || party === undefined || !build || !starter || !format) return null
      if (kind === 'ranked' && !ARENA_FORMATS[format].ranked) return null
      return { t: 'queue', kind, ...(format !== 'standard' && { format }), starter, party, build, auth }
    }
    case 'cancel':
      return { t: 'cancel' }
    case 'rtt': {
      if (!isRecord(m.homes)) return null
      const homes: Record<string, number> = {}
      for (const [k, v] of Object.entries(m.homes).slice(0, 8)) {
        if (!/^\w{1,8}$/.test(k) || typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 60_000) return null
        homes[k] = v
      }
      return { t: 'rtt', homes }
    }
    default:
      return null
  }
}

/** The API's answer to `POST /arena/tickets`, keeping only well-formed ratings (an account left out matches at the start). */
export const parseTickets = (v: unknown): ArenaTicketsResponse['ratings'] => {
  const out: ArenaTicketsResponse['ratings'] = {}
  if (!isRecord(v) || !isRecord(v.ratings)) return out
  for (const [id, r] of Object.entries(v.ratings)) {
    if (isRecord(r) && typeof r.mmr === 'number' && Number.isFinite(r.mmr)) out[id] = { mmr: r.mmr, rp: typeof r.rp === 'number' ? r.rp : 0, games: typeof r.games === 'number' ? r.games : 0 }
  }
  return out
}

/* ---------------- Matching ---------------- */

type Party = { tickets: Ticket[]; mmrs: number[]; mean: number; since: number }

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

/** The tickets of one pool (same kind, format and build) as parties: a party's tickets together (at most a team of `half`'s worth each), a solo ticket alone; oldest first. */
const partiesOf = (tickets: readonly Ticket[], half: number): Party[] => {
  const byKey = new Map<string, Ticket[]>()
  for (const t of tickets) {
    const key = t.party === null ? `t:${t.conn}` : `p:${t.party}`
    byKey.set(key, [...(byKey.get(key) ?? []), t])
  }
  const parties: Party[] = []
  for (const group of byKey.values()) {
    for (let i = 0; i < group.length; i += half) {
      const ts = group.slice(i, i + half)
      const mmrs = ts.map((t) => t.mmr ?? ARENA_RANKED.mmr.start)
      parties.push({ tickets: ts, mmrs, mean: mean(mmrs), since: Math.min(...ts.map((t) => t.since)) })
    }
  }
  return parties.sort((a, b) => a.since - b.since)
}

/** The most common of the players' location hints (null when none has one); a tie goes to the oldest ticket's. */
const hintOf = (tickets: readonly Ticket[]): string | null => {
  const counts = new Map<string, number>()
  for (const t of [...tickets].sort((a, b) => a.since - b.since)) if (t.hint) counts.set(t.hint, (counts.get(t.hint) ?? 0) + 1)
  let best: string | null = null
  for (const [h, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = h
  return best
}

/**
 * One second of matchmaking. Tickets wait in pools by kind, format and
 * build. The oldest party of a pool anchors a match and takes the nearest
 * parties by MMR within its window (`mmrWindow` of how long it waited) while
 * the teams still split (`splitTeams`); the match goes once it has its
 * format's seats in humans (`arenaPlayers`: 8 in the 4v4, 6 in the 3v3), or
 * once the anchor waited `botsAfter` (bots fill the rest). A
 * ranked match of fewer than `minHumansRanked` humans plays unrated. Every
 * other ticket is told how its match is forming. Tickets without an MMR yet
 * only wait.
 */
export const formMatches = (tickets: readonly Ticket[], now: number): { matches: Match[]; waiting: Waiting[] } => {
  const { minHumansRanked } = ARENA_RANKED.queue
  const seconds = (since: number) => Math.max(0, (now - since) / 1000)
  const matches: Match[] = []
  const waiting: Waiting[] = []
  const wait = (t: Ticket, found: number, anchorSince: number) =>
    waiting.push({ conn: t.conn, kind: t.kind, waited: Math.floor(seconds(t.since)), found, botsIn: Math.max(0, Math.ceil(botsAfter(t.kind) - seconds(anchorSince))) })
  const pools = new Map<string, Ticket[]>()
  for (const t of tickets) {
    if (t.mmr === null) {
      wait(t, 1, t.since)
      continue
    }
    const key = `${t.kind}|${t.format}|${t.build}`
    pools.set(key, [...(pools.get(key) ?? []), t])
  }
  for (const pool of pools.values()) {
    const format = pool[0]!.format
    const size = arenaPlayers(format)
    const half = size / 2
    const parties = partiesOf(pool, half)
    const used = new Set<Party>()
    for (const anchor of parties) {
      if (used.has(anchor)) continue
      const window = mmrWindow(seconds(anchor.since))
      const near = parties
        .filter((p) => p !== anchor && !used.has(p) && Math.abs(p.mean - anchor.mean) <= window)
        .sort((a, b) => Math.abs(a.mean - anchor.mean) - Math.abs(b.mean - anchor.mean) || a.since - b.since)
      const group = [anchor]
      let humans = anchor.tickets.length
      for (const p of near) {
        if (humans + p.tickets.length > size) continue
        if (!splitTeams([...group, p].map((g, i) => ({ id: String(i), mmrs: g.mmrs })), half)) continue
        group.push(p)
        humans += p.tickets.length
        if (humans === size) break
      }
      for (const p of group) used.add(p)
      const kind = anchor.tickets[0]!.kind
      const split = splitTeams(group.map((g, i) => ({ id: String(i), mmrs: g.mmrs })), half)
      if (!split || (humans < size && seconds(anchor.since) < botsAfter(kind))) {
        for (const p of group) for (const t of p.tickets) wait(t, humans, anchor.since)
        continue
      }
      const all = group.flatMap((p) => p.tickets)
      matches.push({
        kind,
        format,
        ranked: kind === 'ranked' && ARENA_FORMATS[format].ranked && humans >= minHumansRanked,
        build: anchor.tickets[0]!.build,
        hint: hintOf(all),
        players: group.flatMap((p, i) => p.tickets.map((t) => ({ conn: t.conn, user: t.user, team: split.teams[i]! }))),
      })
    }
  }
  return { matches, waiting }
}

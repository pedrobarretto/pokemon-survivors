import { ARENA_RANKED, TIER_IDS, type MatchKind, type TierId } from '../data/arenaRanked'
import { isVersusPick, type Team } from '../data/versus'
import { parseArenaFormat } from '../data/arenaFormats'
import { tierOf, type ArenaHistoryEntry, type ArenaLeaderboardRow, type ArenaProfile, type ArenaResult, type Season, type TierView } from '../game/arenaRank'
import { isRecord } from '../game/parse'

/**
 * The Arena's match history and standing as the screens read them, pure: a
 * finished match as one of this player's history entries, the device's own
 * history merged with the API's, the API's answers checked field by field,
 * and the small numbers the hub shows (progress to the next division, the
 * time left in a season). DOM-free, never part of the simulation.
 */

/** Most matches the device keeps (`ps:arenaHistory`). */
export const LOCAL_HISTORY_MAX = 30

/** This player's line of a finished match (`slot`: their seat), as a history entry of `kind`; null when the seat isn't in it. */
export const historyEntry = (result: ArenaResult, slot: number, at: number, kind: MatchKind): ArenaHistoryEntry | null => {
  const seat = result.seats.find((s) => s.slot === slot)
  if (!seat) return null
  return {
    id: `device:${at.toString(36)}`,
    at,
    kind,
    team: seat.team,
    outcome: result.winner === null ? 'draw' : result.winner === seat.team ? 'win' : 'loss',
    score: [result.score[0], result.score[1]],
    starter: seat.starter,
    kos: seat.kos,
    deaths: seat.deaths,
    scored: seat.scored,
    damage: seat.damage,
    rp: null,
    ...(result.format && { format: result.format }),
  }
}

/** Two entries for the same match: the device's practice and the copy the API kept of it (same kind, Pokémon and score, minutes apart). */
const sameMatch = (a: ArenaHistoryEntry, b: ArenaHistoryEntry) =>
  a.kind === b.kind && a.starter === b.starter && a.score[0] === b.score[0] && a.score[1] === b.score[1] && a.team === b.team && Math.abs(a.at - b.at) < 10 * 60_000

/**
 * The API's history with the device's matches it doesn't have (a guest's
 * practice, one that never reached it), newest first. `api` null: the device's alone.
 */
export const mergeHistory = (api: readonly ArenaHistoryEntry[] | null, device: readonly ArenaHistoryEntry[]): ArenaHistoryEntry[] => {
  const server = api ?? []
  const extra = device.filter((d) => !server.some((s) => s.id === d.id || sameMatch(s, d)))
  return [...server, ...extra].sort((a, b) => b.at - a.at)
}

/** Adds a match to the device's history: newest first, the same id once, at most `LOCAL_HISTORY_MAX`. */
export const pushHistory = (list: readonly ArenaHistoryEntry[], entry: ArenaHistoryEntry) =>
  [entry, ...list.filter((e) => e.id !== entry.id)].sort((a, b) => b.at - a.at).slice(0, LOCAL_HISTORY_MAX)

/** Wins, losses and draws of a list of matches. */
export const record = (list: readonly ArenaHistoryEntry[]) => ({
  matches: list.length,
  wins: list.filter((e) => e.outcome === 'win').length,
  losses: list.filter((e) => e.outcome === 'loss').length,
  draws: list.filter((e) => e.outcome === 'draw').length,
})

/** Where `rp` stands inside its division: done of `of` points to the next (Master: its RP past the start, of 0). */
export const divisionProgress = (rp: number) => {
  const view = tierOf(rp)
  return view.next === null ? { done: rp - view.from, of: 0 } : { done: rp - view.from, of: view.next - view.from }
}

/** Each tier's RP range on the ladder, low to high (Master open-ended). */
export const ladder = () =>
  TIER_IDS.map((tier, i) => ({ tier, from: i * 3 * ARENA_RANKED.division, to: tier === 'master' ? null : (i + 1) * 3 * ARENA_RANKED.division - 1 }))

/** Time from `now` to `until` (ms) in whole days, hours and minutes, never negative. */
export const timeLeft = (now: number, until: number) => {
  const minutes = Math.max(0, Math.floor((until - now) / 60_000))
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 }
}

/* ---------------- The API's answers ---------------- */

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const count = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : null)
const team = (x: unknown): Team | null => (x === 0 || x === 1 ? x : null)
const isTier = (x: unknown): x is TierId => typeof x === 'string' && (TIER_IDS as readonly string[]).includes(x)
const KINDS = ['casual', 'ranked', 'room', 'practice'] as const satisfies readonly MatchKind[]
const isKind = (x: unknown): x is MatchKind => typeof x === 'string' && (KINDS as readonly string[]).includes(x)
const OUTCOMES = ['win', 'loss', 'draw'] as const
const isOutcome = (x: unknown): x is ArenaHistoryEntry['outcome'] => typeof x === 'string' && (OUTCOMES as readonly string[]).includes(x)

/** A list in a body: the body itself, or its `key` field. */
const listOf = (body: unknown, key: string): unknown[] => (Array.isArray(body) ? body : isRecord(body) && Array.isArray(body[key]) ? body[key] : [])

/** A tier as the API sends it; the RP's own when it's off. */
const parseTier = (raw: unknown, rp: number): TierView => {
  if (!isRecord(raw) || !isTier(raw.tier)) return tierOf(rp)
  const division = raw.division === 1 || raw.division === 2 || raw.division === 3 ? raw.division : null
  return { tier: raw.tier, division, from: num(raw.from) ?? tierOf(rp).from, next: num(raw.next) }
}

/** One history entry from the wire; null when anything is off. */
export const parseHistoryEntry = (raw: unknown): ArenaHistoryEntry | null => {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isKind(raw.kind) || !isOutcome(raw.outcome) || typeof raw.starter !== 'string' || !isVersusPick(raw.starter)) return null
  const at = num(raw.at)
  const side = team(raw.team)
  const score = Array.isArray(raw.score) ? raw.score.map(count) : []
  const stats = [raw.kos, raw.deaths, raw.scored, raw.damage].map(count)
  if (at === null || side === null || score.length !== 2 || score.some((x) => x === null) || stats.some((x) => x === null)) return null
  const rp = raw.rp === null || raw.rp === undefined ? null : num(raw.rp)
  const format = parseArenaFormat(raw.format)
  return { id: raw.id, at, kind: raw.kind, team: side, outcome: raw.outcome, score: [score[0]!, score[1]!], starter: raw.starter, kos: stats[0]!, deaths: stats[1]!, scored: stats[2]!, damage: stats[3]!, rp, ...(format !== 'standard' && { format }) }
}

/** `GET /arena/history`'s entries (a list, or `{ history }`), the bad ones dropped. */
export const parseHistory = (body: unknown) => listOf(body, 'history').flatMap((e) => parseHistoryEntry(e) ?? [])

/** One board row from the wire; null when anything is off. */
export const parseBoardRow = (raw: unknown): ArenaLeaderboardRow | null => {
  if (!isRecord(raw) || typeof raw.handle !== 'string') return null
  const place = count(raw.place)
  const rp = count(raw.rp)
  if (place === null || rp === null) return null
  const favorite = typeof raw.favorite === 'string' && isVersusPick(raw.favorite) ? raw.favorite : null
  return { place, handle: raw.handle, name: typeof raw.name === 'string' ? raw.name : raw.handle, rp, tier: parseTier(raw.tier, rp), wins: count(raw.wins) ?? 0, matches: count(raw.matches) ?? 0, favorite }
}

/** `GET /arena/leaderboard`'s rows (a list, or `{ rows }`), best first. */
export const parseBoard = (body: unknown) =>
  listOf(body, 'rows')
    .flatMap((r) => parseBoardRow(r) ?? [])
    .sort((a, b) => a.place - b.place)

const parseSeason = (raw: unknown): Season | null => {
  if (!isRecord(raw)) return null
  const id = count(raw.id)
  const startMs = num(raw.startMs)
  const endMs = num(raw.endMs)
  return id === null || startMs === null || endMs === null ? null : { id, startMs, endMs }
}

/** `GET /arena/me`: the profile (or `{ profile }`); null when it isn't one. */
export const parseProfile = (body: unknown): ArenaProfile | null => {
  const raw = isRecord(body) && isRecord(body.profile) ? body.profile : body
  if (!isRecord(raw) || !isRecord(raw.rating) || !isRecord(raw.totals)) return null
  const season = parseSeason(raw.season)
  const r = raw.rating
  const rp = count(r.rp)
  if (!season || rp === null) return null
  const t = raw.totals
  const total = (k: string) => count(t[k]) ?? 0
  const favorites = (Array.isArray(raw.favorites) ? raw.favorites : []).flatMap((f) =>
    isRecord(f) && typeof f.starter === 'string' && isVersusPick(f.starter) ? [{ starter: f.starter, matches: count(f.matches) ?? 0, wins: count(f.wins) ?? 0 }] : [],
  )
  return {
    season,
    rating: { mmr: num(r.mmr) ?? ARENA_RANKED.mmr.start, rp, peak: count(r.peak) ?? rp, games: count(r.games) ?? 0 },
    tier: parseTier(raw.tier, rp),
    place: count(raw.place),
    totals: { matches: total('matches'), wins: total('wins'), losses: total('losses'), draws: total('draws'), kos: total('kos'), scored: total('scored') },
    favorites: favorites.slice(0, 3),
  }
}

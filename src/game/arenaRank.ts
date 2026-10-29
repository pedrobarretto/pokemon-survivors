import { ARENA_RANKED, TIER_IDS, type MatchKind, type TierId } from '../data/arenaRanked'
import { isVersusPick, type Team, type VersusPick } from '../data/versus'
import * as dm from '../engine/dmath'
import { formAt } from './branch'
import { isRecord } from './parse'
import type { Game } from './types'

/**
 * The Arena's ranked rules, pure (`data/arenaRanked.ts` holds the numbers):
 * which season a moment is in, a rating's tier, how a match moves MMR and RP,
 * how the queue splits players into teams, and the result a match reports.
 * The API rates matches with these; the matchmaker splits teams with them;
 * the game shows them. Never part of the simulation.
 */

/* ---------------- Seasons ---------------- */

const DAY_MS = 86_400_000

/** When season 1 starts (ms, 00:00 Brasília on the epoch day). */
const EPOCH_MS = Date.parse(`${ARENA_RANKED.season.epoch}T00:00:00Z`) - ARENA_RANKED.season.utcOffsetHours * 3_600_000

export type Season = { id: number; startMs: number; endMs: number }

/** The season of season number `id` (1 is the first). */
export const seasonById = (id: number): Season => {
  const span = ARENA_RANKED.season.days * DAY_MS
  const startMs = EPOCH_MS + (id - 1) * span
  return { id, startMs, endMs: startMs + span }
}

/** The season running at `ms`, or null before the first one starts. */
export const seasonAt = (ms: number): Season | null => (ms < EPOCH_MS ? null : seasonById(Math.floor((ms - EPOCH_MS) / (ARENA_RANKED.season.days * DAY_MS)) + 1))

/* ---------------- Tiers ---------------- */

/** A rating's place on the ladder: the tier, its division (3 → 1, null in Master), the RP that division starts at and where the next one starts (null in Master). */
export type TierView = { tier: TierId; division: 1 | 2 | 3 | null; from: number; next: number | null }

/** RP where `tier` starts (its division III). */
export const tierFloor = (tier: TierId) => TIER_IDS.indexOf(tier) * 3 * ARENA_RANKED.division

/** Where `rp` stands on the ladder. */
export const tierOf = (rp: number): TierView => {
  const step = ARENA_RANKED.division
  const d = Math.max(0, Math.floor(rp / step))
  const masterAt = (TIER_IDS.length - 1) * 3
  if (d >= masterAt) return { tier: 'master', division: null, from: masterAt * step, next: null }
  const tier = TIER_IDS[Math.floor(d / 3)]!
  const division = (3 - (d % 3)) as 1 | 2 | 3
  return { tier, division, from: d * step, next: (d + 1) * step }
}

/** A match never drops RP below the floor of the tier the player reached this season (`peak`). */
export const clampToFloor = (rp: number, peak: number) => Math.max(rp, tierFloor(tierOf(peak).tier), 0)

/* ---------------- Ratings ---------------- */

/** A player's rating in a season: hidden MMR, visible RP, the best RP reached, matches rated. */
export type Rating = { mmr: number; rp: number; peak: number; games: number }

export const freshRating = (): Rating => ({ mmr: ARENA_RANKED.mmr.start, rp: 0, peak: 0, games: 0 })

/** A new season's starting rating from the last one's: MMR toward the start, RP to the floor one tier below. */
export const seasonReset = (last: Rating): Rating => {
  const { start } = ARENA_RANKED.mmr
  const tier = TIER_IDS.indexOf(tierOf(last.rp).tier)
  const rp = tierFloor(TIER_IDS[Math.max(0, tier - 1)]!)
  return { mmr: Math.round(last.mmr + (start - last.mmr) * ARENA_RANKED.softReset), rp, peak: rp, games: 0 }
}

/** Elo's expected score of a side with mean MMR `a` against one with `b`. */
export const expected = (a: number, b: number) => 1 / (1 + dm.pow(10, (b - a) / ARENA_RANKED.mmr.scale))

/** One seat as rating sees it: a human's rating (null for a bot), their team and their match stats. */
export type RatedSeat = { rating: Rating | null; team: Team; scored: number; kos: number; objective: boolean }

/**
 * Performance in [0, 1]: the seat's share of its team's points and KOs, plus
 * a bit for landing the objective. A seat that carried half of both is 1.
 */
export const performance = (seat: RatedSeat, team: readonly RatedSeat[]) => {
  const sum = (of: (s: RatedSeat) => number) => team.reduce((n, s) => n + of(s), 0)
  const points = sum((s) => s.scored)
  const kos = sum((s) => s.kos)
  const share = (mine: number, all: number) => (all > 0 ? mine / all : 0)
  const raw = share(seat.scored, points) * 1.2 + share(seat.kos, kos) * 0.6 + (seat.objective ? 0.2 : 0)
  return Math.min(1, raw)
}

/** What a rated match changed for one human seat. */
export type RatingChange = { mmr: number; rp: number; before: Rating; after: Rating }

/**
 * Rates a match: team Elo on each side's mean MMR (bots at `mmr.bot`), the
 * winner's side gaining what the other loses, scaled down by the share of
 * bots; RP as a win, loss or draw plus performance, held at the tier floor.
 * Returns one change per seat, null for bots.
 */
export const rateMatch = (seats: readonly RatedSeat[], winner: Team | null): (RatingChange | null)[] => {
  const { mmr: M, rp: RP } = ARENA_RANKED
  const humans = seats.filter((s) => s.rating).length
  const weight = seats.length > 0 ? humans / seats.length : 0
  const mean = (team: Team) => {
    const side = seats.filter((s) => s.team === team)
    return side.reduce((n, s) => n + (s.rating?.mmr ?? M.bot), 0) / Math.max(1, side.length)
  }
  const means = [mean(0), mean(1)] as const
  return seats.map((seat) => {
    const r = seat.rating
    if (!r) return null
    const score = winner === null ? 0.5 : winner === seat.team ? 1 : 0
    const k = r.games < M.settledAfter ? M.kNew : M.kSettled
    const mmr = Math.round(k * (score - expected(means[seat.team], means[seat.team === 0 ? 1 : 0])) * weight)
    const perf = Math.round(performance(seat, seats.filter((s) => s.team === seat.team)) * RP.perfMax)
    const base = winner === null ? RP.draw : winner === seat.team ? RP.win : RP.loss
    const rpRaw = Math.round((base + perf) * weight)
    const rp = clampToFloor(r.rp + rpRaw, r.peak)
    const after: Rating = { mmr: r.mmr + mmr, rp, peak: Math.max(r.peak, rp), games: r.games + 1 }
    return { mmr, rp: rp - r.rp, before: r, after }
  })
}

/* ---------------- The queue ---------------- */

// The queue's rules live import-free beside the wire (the relay's matchmaker runs them).
export { botsAfter, countsForRank, mmrWindow, splitTeams, type QueueGroup, type TeamSplit } from '../net/arenaQueue'

/* ---------------- A match's result ---------------- */

/**
 * One seat's line in a match's result (by slot, the game's player order).
 * `damage` is all it dealt (the wild's too); `dealt`, `taken`, `healed`,
 * `assists` and `interrupts` are the scoreboard's (`VersusSeat`), against and
 * from rival Pokémon.
 */
export type ArenaSeatResult = {
  slot: number
  team: Team
  starter: VersusPick
  form: string
  bot: boolean
  kos: number
  deaths: number
  scored: number
  damage: number
  assists: number
  dealt: number
  taken: number
  healed: number
  interrupts: number
}

/**
 * What a finished match reports: the final score, the winner (null: a draw),
 * how long it ran, the team that surrendered (null: the clock ran out; its
 * rival is the winner, an ordinary win and loss) and every seat's line. Every client builds the same one
 * from the same game, so the relay can count matching reports (opaque to it)
 * and pass the agreed one to the API with its seats' accounts. Still `v: 1`:
 * `surrender` and the seats' scoreboard stats came later and read as null and
 * 0 when absent.
 */
export type ArenaResult = { v: 1; score: [number, number]; winner: Team | null; seconds: number; objective: Team | null; surrender: Team | null; seats: ArenaSeatResult[] }

/** The result of a match that has ended (`g.versus.result` set), else null. `objective`: the team that brought Zapdos down, if one did. */
export const arenaResult = (g: Game, objective: Team | null = null): ArenaResult | null => {
  const s = g.versus
  if (!s?.result) return null
  return {
    v: 1,
    score: [s.score[0], s.score[1]],
    winner: s.result.winner,
    seconds: Math.round(g.time),
    objective,
    surrender: s.result.surrender,
    seats: g.players.flatMap((p) => {
      const v = p.versus
      if (!v || !isVersusPick(p.starter)) return []
      return [
        {
          slot: p.slot,
          team: v.team,
          starter: p.starter,
          form: formAt(p.starter, p.branch, p.stage).name,
          bot: v.bot,
          kos: v.kos,
          deaths: v.deaths,
          scored: v.scored,
          damage: Math.round(Object.values(p.damageByMove).reduce((a, b) => a + (b ?? 0), 0)),
          assists: v.assists,
          dealt: Math.round(v.dealt),
          taken: Math.round(v.taken),
          healed: Math.round(v.healed),
          interrupts: v.interrupts,
        },
      ]
    }),
  }
}

const count = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 1e9 ? x : null)
const team = (x: unknown): Team | null => (x === 0 || x === 1 ? x : null)
/** A field a later build added: 0 when absent (an older client's report), null when malformed. */
const later = (x: unknown) => (x === undefined ? 0 : count(x))

/** A result from the wire (the relay's report), checked field by field; null when anything is off. */
export const parseArenaResult = (raw: unknown): ArenaResult | null => {
  if (!isRecord(raw) || raw.v !== 1 || !Array.isArray(raw.score) || !Array.isArray(raw.seats)) return null
  const score = raw.score.map(count)
  const seconds = count(raw.seconds)
  if (score.length !== 2 || score.some((x) => x === null) || seconds === null) return null
  if (raw.winner !== null && team(raw.winner) === null) return null
  if (raw.objective !== null && team(raw.objective) === null) return null
  const surrender = raw.surrender === undefined || raw.surrender === null ? null : team(raw.surrender)
  if (surrender === null && raw.surrender !== undefined && raw.surrender !== null) return null
  const seats: ArenaSeatResult[] = []
  for (const s of raw.seats) {
    if (!isRecord(s)) return null
    const slot = count(s.slot)
    const side = team(s.team)
    const nums = [s.kos, s.deaths, s.scored, s.damage].map(count)
    const extra = [s.assists, s.dealt, s.taken, s.healed, s.interrupts].map(later)
    if (slot === null || side === null || typeof s.starter !== 'string' || !isVersusPick(s.starter) || typeof s.form !== 'string' || typeof s.bot !== 'boolean' || nums.some((x) => x === null) || extra.some((x) => x === null)) return null
    seats.push({
      slot,
      team: side,
      starter: s.starter,
      form: s.form.slice(0, 24),
      bot: s.bot,
      kos: nums[0]!,
      deaths: nums[1]!,
      scored: nums[2]!,
      damage: nums[3]!,
      assists: extra[0]!,
      dealt: extra[1]!,
      taken: extra[2]!,
      healed: extra[3]!,
      interrupts: extra[4]!,
    })
  }
  if (seats.length === 0 || seats.length > ARENA_RANKED.queue.players) return null
  // A surrender's winner is always the other team.
  if (surrender !== null && raw.winner !== (surrender === 0 ? 1 : 0)) return null
  return { v: 1, score: [score[0]!, score[1]!], winner: raw.winner === null ? null : (raw.winner as Team), seconds, objective: raw.objective === null ? null : (raw.objective as Team), surrender, seats }
}

/* ---------------- What the API serves ---------------- */

/** `GET /arena/me`: the signed-in player's season standing, totals and recent form. */
export type ArenaProfile = {
  season: Season
  rating: Rating
  tier: TierView
  /** Their place on the season's board (null until rated). */
  place: number | null
  totals: { matches: number; wins: number; losses: number; draws: number; kos: number; scored: number }
  /** Their most played Pokémon this season, most first (up to 3). */
  favorites: { starter: VersusPick; matches: number; wins: number }[]
}

/** One match in `GET /arena/history`: the player's own line and the score. */
export type ArenaHistoryEntry = {
  id: string
  at: number
  kind: MatchKind
  team: Team
  outcome: 'win' | 'loss' | 'draw'
  score: [number, number]
  starter: VersusPick
  kos: number
  deaths: number
  scored: number
  damage: number
  /** RP this match moved (null when it wasn't rated). */
  rp: number | null
}

/** A row of `GET /arena/leaderboard?season=N`. */
export type ArenaLeaderboardRow = { place: number; handle: string; name: string; rp: number; tier: TierView; wins: number; matches: number; favorite: VersusPick | null }

/** `GET /arena/leaderboard?season=N`: the season, its top rows and the asker's own row (null for a guest or before they're rated). */
export type ArenaLeaderboard = { season: Season; rows: ArenaLeaderboardRow[]; me: ArenaLeaderboardRow | null }

/**
 * `POST /arena/practice` (signed-in client): a quick match against bots on
 * the in-page relay, for the player's history and totals only. `slot`: the
 * player's own seat (a human one). `key`: optional, the same for a retry, so
 * it lands once.
 */
export type ArenaPracticeRequest = { result: ArenaResult; slot: number; key?: string }

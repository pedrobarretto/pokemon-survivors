import { createRng, seedFrom, weightedPick } from '../engine/rng'
import type { BranchId } from '../data/branches'
import { PLAYABLE_IDS, PLAYABLE, type PlayableId } from '../data/hatchlings'
import { RUN_LENGTH } from '../data/waves'
import { CHALLENGE } from './challenge'
import { brasiliaDay, isDayKey, msSinceDayStart, previousDay, type DayKey } from './day'
import { isDifficulty, type Difficulty } from './difficulty'
import { wonRun } from './meta'
import { isRecord } from './parse'
import { maxKills, RANKED, runBranch, type BoardPeriod } from './ranking'
import type { SupporterTier } from './supporters'
import type { Game } from './types'

/**
 * Co-op boards (Duplas, Trios, Squads) and the Desafio co-op do dia, shared by
 * the game, the relay's report and the API (`server/`). A run-mode room's
 * clients send a `CoopResult` (as JSON) on `over`; the relay posts the one the
 * end's majority agreed on (`CoopReport`, `net/coopReport.ts`) to the API,
 * which parses it here and files the run under its team size, difficulty and,
 * for a challenge run, its day. Boards rank teams (the same set of accounts)
 * by their best run. Pure.
 */

/* ---------------- Team sizes ---------------- */

/** Players who started the run: 2 is a Dupla, 3 a Trio, 4 a Squad. A room of one never reports. */
export const TEAM_SIZES = [2, 3, 4] as const

export type TeamSize = (typeof TEAM_SIZES)[number]

export const isTeamSize = (v: unknown): v is TeamSize => TEAM_SIZES.some((n) => n === v)

/** The size's key in copy and URLs (`?size=duo`). */
export const TEAM_SIZE_KEYS = { 2: 'duo', 3: 'trio', 4: 'squad' } as const satisfies Record<TeamSize, string>

export type TeamSizeKey = (typeof TEAM_SIZE_KEYS)[TeamSize]

/** A size from its key or number (a query string's), or null. */
export const parseTeamSize = (v: unknown): TeamSize | null => {
  const n = typeof v === 'string' && /^\d$/.test(v) ? Number(v) : v
  if (isTeamSize(n)) return n
  const hit = TEAM_SIZES.find((size) => TEAM_SIZE_KEYS[size] === v)
  return hit ?? null
}

/* ---------------- What a run reports ---------------- */

/** `victory`: Mewtwo fell (the endless mode included, as solo); `wipe`: the whole team fainted before. */
export const COOP_OUTCOMES = ['victory', 'wipe'] as const

export type CoopOutcome = (typeof COOP_OUTCOMES)[number]

/** One seat of a finished co-op run: the Pokémon it played, how far it evolved, its level and its faints. */
export type CoopResultPlayer = {
  slot: number
  starter: PlayableId
  stage: number
  branch: BranchId | null
  shiny: boolean
  level: number
  kills: number
}

/**
 * What a run-mode room's clients send on `over` (`TickEntry`-free: read off
 * the ended game, `coopResult`), so every client in step sends the same JSON
 * and the relay can count them. `challenge`: the Desafio co-op do dia's day,
 * null for any other run. `players` by slot, every seat that started (a
 * leaver's Pokémon as it left).
 */
export type CoopResult = {
  v: 1
  difficulty: Difficulty
  challenge: DayKey | null
  /** Seconds the team survived, endless overtime included. */
  time: number
  outcome: CoopOutcome
  /** The team's faints, summed. */
  kills: number
  players: CoopResultPlayer[]
}

/** The result of an ended co-op run (not an Arena match), as every client builds it; null otherwise. */
export const coopResult = (g: Game): CoopResult | null => {
  if (g.coop === null || g.versus) return null
  return {
    v: 1,
    difficulty: g.difficulty,
    challenge: g.coop.challenge,
    time: g.time,
    outcome: wonRun(g) ? 'victory' : 'wipe',
    kills: g.players.reduce((sum, p) => sum + p.record.kills, 0),
    players: g.players.map((p, slot) => ({
      slot,
      starter: p.starter,
      stage: p.stage,
      branch: p.branch,
      shiny: p.shiny,
      level: p.level,
      kills: p.record.kills,
    })),
  }
}

const isWhole = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

const isPlayable = (v: unknown): v is PlayableId => PLAYABLE_IDS.some((id) => id === v)

const parsePlayer = (raw: unknown, slot: number, time: number): CoopResultPlayer | null => {
  if (!isRecord(raw) || raw.slot !== slot || !isPlayable(raw.starter)) return null
  const { starter, stage, level, kills } = raw
  if (!isWhole(stage, 0, PLAYABLE[starter].line.length - 1) || !isWhole(level, 1, RANKED.maxLevel) || !isWhole(kills, 0, maxKills(time))) return null
  return { slot, starter, stage, branch: runBranch(starter, stage, raw.branch), shiny: raw.shiny === true, level, kills }
}

/**
 * A co-op result from an untrusted body for a run `size` players started, or
 * null when its shape is wrong or it can't have been played: another number
 * of seats, a victory before Mewtwo shows up, more faints than the clock allows.
 */
export const parseCoopResult = (raw: unknown, size: number): CoopResult | null => {
  if (!isRecord(raw) || raw.v !== 1 || !isDifficulty(raw.difficulty) || !COOP_OUTCOMES.some((o) => o === raw.outcome)) return null
  const { time, kills, players, challenge } = raw
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > RANKED.maxTime) return null
  if (raw.outcome === 'victory' && time < RUN_LENGTH) return null
  if (challenge !== null && !isDayKey(challenge)) return null
  if (!Array.isArray(players) || players.length !== size) return null
  const parsed = players.map((p, slot) => parsePlayer(p, slot, time))
  if (!parsed.every((p): p is CoopResultPlayer => p !== null)) return null
  if (!isWhole(kills, 0, maxKills(time) * size) || kills !== parsed.reduce((sum, p) => sum + p.kills, 0)) return null
  return { v: 1, difficulty: raw.difficulty, challenge, time, outcome: raw.outcome as CoopOutcome, kills, players: parsed }
}

/* ---------------- Desafio co-op do dia ---------------- */

/**
 * The Desafio co-op do dia: one seed and difficulty per Brasília day, the
 * same for every team; each player brings any Pokémon of theirs, with the
 * Poké Mart's upgrades off (co-op already leaves the Bag, TMs, outbreak and
 * events out, `COOP_LOCKS`). Tries are free: the day's boards keep each
 * team's best run, one board per team size. No ribbons.
 */
export const COOP_CHALLENGE = {
  /** Normal and Hard only: a team of strangers on Nightmare with every upgrade off rarely sees minute 10. */
  difficulty: [['normal', 1], ['hard', 1]] as const satisfies ReadonlyArray<readonly [Difficulty, number]>,
  /** A run that started this long after its day ended still counts for it (the room was set at midnight). */
  graceMs: CHALLENGE.graceMs,
  /** Slack on a reported run's start (`endedAt − time`): the draft, the picks, a slow relay. */
  slackMs: 15 * 60_000,
} as const

export type CoopChallenge = { day: DayKey; seed: number; difficulty: Difficulty }

/** The Desafio co-op do dia of a Brasília day: its own seed and difficulty, never the solo challenge's. */
export const dailyCoopChallenge = (day: DayKey): CoopChallenge => ({
  day,
  seed: seedFrom(`coop-challenge-seed:${day}`),
  difficulty: weightedPick(createRng(seedFrom(`coop-challenge-day:${day}`)), COOP_CHALLENGE.difficulty),
})

/**
 * Whether a challenge run of `day` that ended at `endedAt` (ms) after `time`
 * seconds of play counts for that day: it started on the day (or within the
 * grace after it), give or take `COOP_CHALLENGE.slackMs`, and never in the future.
 */
export const coopChallengeCounts = (day: DayKey, endedAt: number, time: number) => {
  const latest = new Date(endedAt - time * 1000)
  const earliest = new Date(latest.getTime() - COOP_CHALLENGE.slackMs)
  const startedOn = (d: Date) => {
    const today = brasiliaDay(d)
    return today === day || (previousDay(today) === day && msSinceDayStart(d) < COOP_CHALLENGE.graceMs)
  }
  return startedOn(latest) || startedOn(earliest)
}

/* ---------------- Boards ---------------- */

/** A team member as the boards show them: their account's name and the Pokémon they played. */
export type CoopMember = {
  handle: string
  name: string
  starter: PlayableId
  stage: number
  branch: BranchId | null
  shiny: boolean
  /** Their supporter badge (`badgesOf`), null when they have none or hide it, and the OG plate. */
  supporter: SupporterTier | null
  og: boolean
}

/**
 * A team's best run on a board. `at` is when the run ended (ISO); `members`
 * in slot order. `run` is the run's id (to report it). `size` and
 * `difficulty` say which board, `challenge` the day of a challenge run.
 */
export type CoopBoardEntry = {
  rank: number
  run: string
  size: TeamSize
  difficulty: Difficulty
  time: number
  outcome: CoopOutcome
  at: string
  members: CoopMember[]
}

/**
 * The top of a co-op board (`BOARD_SIZE` teams), plus the asking player's
 * best team on it (null for a guest or off it). `GET /coop/boards/:difficulty?size=&period=&friends=`.
 */
export type CoopBoard = { size: TeamSize; difficulty: Difficulty; period: BoardPeriod; entries: CoopBoardEntry[]; me: CoopBoardEntry | null }

/**
 * A day's Desafio co-op board for one team size: the day's difficulty, every
 * team once with its best run, how many teams played it. `GET /coop/challenge/:day?size=&friends=`.
 */
export type CoopChallengeBoard = { day: DayKey; size: TeamSize; difficulty: Difficulty; total: number; entries: CoopBoardEntry[]; me: CoopBoardEntry | null }

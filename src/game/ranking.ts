import type { TitleId } from '../data/achievements'
import { BRANCHES, isBranch, type BranchId } from '../data/branches'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { isLegend } from '../data/legends'
import { RUN_LENGTH } from '../data/waves'
import { DAY_TIME_ZONE, isDayKey, type DayKey } from './day'
import { isDifficulty, type Difficulty } from './difficulty'
import { wonRun } from './meta'
import { isRecord } from './parse'
import type { BagItem } from '../data/shop'
import type { RibbonTier } from './ribbons'
import type { SupporterTier } from './supporters'
import type { Game } from './types'

/**
 * Ranking rules shared by the game and the API (`server/`): what a ranked run
 * reports when it ends, the checks the server runs on it, the profile's handle
 * and display name, and the shapes the API answers with. Pure, so both sides agree.
 */

/* ---------------- Runs ---------------- */

export const RUN_OUTCOMES = ['victory', 'death', 'quit'] as const

/** `victory`: Mewtwo fell (endless mode included); `death`: fainted before; `quit`: left from the pause menu. */
export type RunOutcome = (typeof RUN_OUTCOMES)[number]

/** What a ranked run reports when it ends (and again if a victory goes on into endless mode). */
export type RunResult = {
  /** The Pokémon picked: a starter or a hatched family. */
  starter: PlayableId
  /** Evolution stage reached (2 = final), so the boards show the form it ended in. */
  stage: number
  /**
   * The branching evolution it took (Espeon, Gallade…, `data/branches.ts`),
   * null when it took none. An older game sends none: read as null.
   */
  branch: BranchId | null
  difficulty: Difficulty
  /** Seconds survived, endless overtime included. */
  time: number
  outcome: RunOutcome
  level: number
  kills: number
  /** The game build that played it (`__GAME_VERSION__`). */
  version: string
}

/**
 * Limits of a ranked run. The server measures the wall clock from the run's
 * start token; the simulation never runs faster than real time, so a run can't
 * report more seconds than that. `slack` covers the token arriving after the
 * run began (Clerk still loading, a slow network). Pausing only helps the check.
 */
export const RANKED = {
  slack: 30,
  /** Longer than any endless run Arceus allows. */
  maxTime: 4 * 3600,
  /** A sanity bound, not a game rule: long endless runs pass Lv 1000 (Lv 1045 at 169 min), so a cap at 999 refused them as implausible. */
  maxLevel: 9999,
  /**
   * Faints per second at the start, far above anything played. The horde grows
   * with the clock, so the cap rises by `killRateGrowth` every minute (`maxKills`):
   * endless runs average ~47/s by two hours, but a Legend run in Nightmare
   * reached ~152/s by 69 minutes (1.4× the old 40 + 1/min cap, 2026-10-24), so
   * the cap sits at twice that. The re-simulation is what checks the number.
   */
  maxKillRate: 80,
  killRateGrowth: 2,
  /** Run starts one player may ask for per `window` seconds. */
  startsPerWindow: 30,
  window: 10 * 60,
  /** Start tokens never used are dropped after this many days. */
  tokenDays: 7,
  /** Seeds the server deals are in [0, seedSpan): the 32 bits the simulation reads (`createRng`). */
  seedSpan: 2 ** 32,
} as const

export const isPlayable = (v: unknown): v is PlayableId => typeof v === 'string' && Object.hasOwn(PLAYABLE, v)

const isOutcome = (v: unknown): v is RunOutcome => RUN_OUTCOMES.some((o) => o === v)

const isWhole = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/**
 * The branch a run of `starter` that reached `stage` can report: one of its
 * family's, at a stage the run got to. Anything else (another family's, one
 * it hasn't evolved into yet, garbage) reads as none.
 */
export const runBranch = (starter: PlayableId, stage: number, raw: unknown): BranchId | null =>
  isBranch(raw) && BRANCHES[raw].line === starter && stage >= BRANCHES[raw].stage ? raw : null

/** The most faints a run of `time` seconds can report (see `RANKED.maxKillRate`). */
export const maxKills = (time: number) => Math.ceil(time * (RANKED.maxKillRate + (RANKED.killRateGrowth * time) / 60))

/**
 * A run result from an untrusted body, or null when its shape is wrong or it
 * can't have been played: a victory before Mewtwo shows up, more faints than
 * the clock allows, a level out of range.
 */
export const parseRunResult = (raw: unknown): RunResult | null => {
  if (!isRecord(raw)) return null
  const { starter, stage, branch, difficulty, time, outcome, level, kills, version } = raw
  if (!isPlayable(starter) || !isDifficulty(difficulty) || !isOutcome(outcome)) return null
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > RANKED.maxTime) return null
  if (!isWhole(stage, 0, PLAYABLE[starter].line.length - 1) || !isWhole(level, 1, RANKED.maxLevel)) return null
  if (!isWhole(kills, 0, maxKills(time))) return null
  if (outcome === 'victory' && time < RUN_LENGTH) return null
  if (typeof version !== 'string' || version.length === 0 || version.length > 40) return null
  return { starter, stage, branch: runBranch(starter, stage, branch), difficulty, time, outcome, level, kills, version }
}

/** Whether `time` seconds of play fit in `elapsed` seconds of wall clock since the start token. */
export const clockAllows = (elapsed: number, time: number) => time <= elapsed + RANKED.slack

/** What a start token's row holds when its run reports: the seed dealt with it (null on rows from before the server dealt seeds) and what the run reported before, if it did. */
export type IssuedRun = { seed: number | null; reported: Pick<RunResult, 'starter' | 'difficulty' | 'time' | 'outcome'> | null }

/**
 * Why a run's report doesn't fit its start token's row, or null when it does.
 * `seed`: the replay played another seed than the one dealt (a row without
 * one takes any). `mismatch`: the run reported before and this isn't it
 * grown: another Pokémon or difficulty, a shorter run, or a longer one after
 * anything but a victory (only endless mode goes on). So a short run can't
 * keep its seed on hold to grow later.
 */
export const reportProblem = (row: IssuedRun, result: RunResult, seed: number): 'seed' | 'mismatch' | null => {
  if (row.seed !== null && row.seed !== seed) return 'seed'
  const before = row.reported
  if (!before) return null
  if (before.starter !== result.starter || before.difficulty !== result.difficulty || before.time > result.time) return 'mismatch'
  return before.time < result.time && before.outcome !== 'victory' ? 'mismatch' : null
}

/** Quits in the first minute stay off the ranking: they'd only crowd the profile's recent runs. */
export const rankable = (r: RunResult) => r.outcome !== 'quit' || r.time >= 60

/** The result a run reports right now. */
export const runResult = (g: Game, version: string): RunResult => ({
  starter: g.player.starter,
  stage: g.player.stage,
  branch: g.player.branch,
  difficulty: g.difficulty,
  time: g.time,
  outcome: wonRun(g) ? 'victory' : g.phase === 'gameover' ? 'death' : 'quit',
  level: g.player.level,
  kills: g.kills,
  version,
})

/* ---------------- Profile ---------------- */

export const HANDLE = { min: 3, max: 20 } as const

/** Handles that would read as the game speaking. */
const RESERVED = new Set(['admin', 'api', 'me', 'mod', 'moderator', 'null', 'pokemon', 'pokemonsurvivors', 'staff', 'support', 'survivors', 'undefined'])

export type HandleProblem = 'short' | 'long' | 'chars' | 'reserved'

/** What a player typed, as a handle: no `@`, lower case. */
export const normalizeHandle = (raw: string) => raw.trim().replace(/^@/, '').toLowerCase()

/** Why a (normalized) handle can't be used, or null when it can: 3 to 20 of `a-z`, `0-9` and `_`. */
export const handleProblem = (handle: string): HandleProblem | null => {
  if (handle.length < HANDLE.min) return 'short'
  if (handle.length > HANDLE.max) return 'long'
  if (!/^[a-z0-9_]+$/.test(handle)) return 'chars'
  return RESERVED.has(handle) ? 'reserved' : null
}

/** A handle from an untrusted body, normalized, or null when it can't be used. */
export const parseHandle = (raw: unknown) => {
  if (typeof raw !== 'string') return null
  const handle = normalizeHandle(raw)
  return handleProblem(handle) ? null : handle
}

/** A handle made from a name ("Zoë Müller" → "zoemuller"), padded or cut to fit. */
export const suggestHandle = (name: string) => {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, HANDLE.max)
  const handle = base.length >= HANDLE.min ? base : `trainer${base}`
  return RESERVED.has(handle) ? `${handle}_1`.slice(0, HANDLE.max) : handle
}

/** The first free handle among `base`, `base2`, `base3`…, cut so the number fits. Null when all 99 are taken. */
export const freeHandle = (base: string, taken: ReadonlySet<string>) => {
  if (!taken.has(base)) return base
  for (let n = 2; n < 100; n++) {
    const candidate = `${base.slice(0, HANDLE.max - String(n).length)}${n}`
    if (!taken.has(candidate) && !handleProblem(candidate)) return candidate
  }
  return null
}

export const DISPLAY_NAME = { max: 24 } as const

/** A display name from an untrusted body: trimmed, single spaces, no control characters, 1 to 24 characters. */
export const parseDisplayName = (raw: unknown) => {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/\p{Cc}|\p{Cf}/gu, '').replace(/\s+/g, ' ').trim()
  const length = [...name].length
  return length > 0 && length <= DISPLAY_NAME.max ? name : null
}

/** The handle and display name a signed-in player shows on the boards. */
export type ProfileName = { handle: string; name: string }

/* ---------------- Boards ---------------- */

/**
 * Day and week boards follow Brazil's clock (no daylight saving since 2019):
 * most players are there, so the day turns at their midnight and the week on
 * their Monday, like the missions on their devices. The same day as the
 * Surto do dia and the Poké Mart's counter (`game/day.ts`).
 */
export const BOARD_TIME_ZONE = DAY_TIME_ZONE

export const BOARD_PERIODS = ['day', 'week', 'all'] as const

export type BoardPeriod = (typeof BOARD_PERIODS)[number]

export const isBoardPeriod = (v: unknown): v is BoardPeriod => BOARD_PERIODS.some((p) => p === v)

/**
 * The boards' two sides: the regular runs (`standard`) and the Legend mode's
 * (`legend`, a legend played), each split by difficulty. The mode follows the
 * Pokémon played, so a run can't report the wrong one.
 */
export const RUN_MODES = ['standard', 'legend'] as const

export type RunMode = (typeof RUN_MODES)[number]

export const isRunMode = (v: unknown): v is RunMode => RUN_MODES.some((m) => m === v)

/** The boards a run of `starter` goes on. */
export const runMode = (starter: PlayableId): RunMode => (isLegend(starter) ? 'legend' : 'standard')

/** Players shown at the top of a board. */
export const BOARD_SIZE = 50

/**
 * One player's best run on a board. `at` is when the run started (ISO). Runs
 * whose re-simulation failed never show.
 */
export type BoardEntry = ProfileName & {
  rank: number
  starter: PlayableId
  stage: number
  /** The branching evolution the run took (`RunResult.branch`). Missing from an older API. */
  branch?: BranchId | null
  time: number
  outcome: RunOutcome
  at: string
  /** The player's supporter badge (`game/supporters.ts`), null when they have none or hide it, and since when (ISO). Missing from an older API. */
  supporter?: SupporterTier | null
  supporterSince?: string | null
  /** The run's id, to report it (`game/reports.ts`). Missing from an older API. */
  run?: string
  /** The Bag items the run took (`ReplayStart.bag`), for their icons. Missing from an older API. */
  bag?: BagItem[]
}

/** The top of a board, plus the asking player's own line (null if they're not on it). */
export type Board = { entries: BoardEntry[]; me: BoardEntry | null }

/** Where a run's player stands on its difficulty's boards, after it. Null on a board they're not on. */
export type RunRanks = Record<BoardPeriod, number | null>

/* ---------------- Desafio do dia ---------------- */

/**
 * Where a challenge run stands after it (`game/challenge.ts`): whether it was
 * the player's official attempt of `day` (the first finished one), and its
 * place among the `total` players on that day's board (null when it's not
 * on it: practice, or no handle yet).
 */
export type ChallengePlace = { day: DayKey; official: boolean; rank: number | null; total: number }

/**
 * A day's challenge board: every player once, with their official attempt.
 * `attempted`: the asking player has finished theirs (null for a guest).
 */
export type ChallengeBoard = Board & { day: DayKey; total: number; attempted: boolean | null }

/** A challenge place from the API's answer, or null. */
export const parseChallengePlace = (v: unknown): ChallengePlace | null => {
  if (!isRecord(v) || !isDayKey(v.day) || typeof v.total !== 'number') return null
  return { day: v.day, official: v.official === true, rank: typeof v.rank === 'number' ? v.rank : null, total: v.total }
}

/** A run on a public profile (`branch` as on `BoardEntry`). */
export type ProfileRun = {
  starter: PlayableId
  stage: number
  branch?: BranchId | null
  difficulty: Difficulty
  time: number
  outcome: RunOutcome
  at: string
  /** The Bag items the run took (`ReplayStart.bag`). Missing from an older API. */
  bag?: BagItem[]
}

/** What `/profiles/:handle` answers. `followed`: the asking player follows them; `self`: it's the asking player. */
export type PublicProfile = ProfileName & {
  title: TitleId | null
  dex: { seen: number; caught: number }
  records: Partial<Record<Difficulty, ProfileRun>>
  /** The Legend mode's records, by difficulty. Missing from an older API. */
  legendRecords?: Partial<Record<Difficulty, ProfileRun>>
  recent: ProfileRun[]
  followers: number
  following: number
  followed: boolean
  /** Friends this player brought whose invite counted (`game/referral.ts`). Missing from an older API. */
  brought?: number
  /** Desafio do dia ribbons won, by tier (`game/ribbons.ts`). Missing from an older API. */
  ribbons?: Record<RibbonTier, number>
  /** The supporter badge (always one's own, else only if shown) and since when (ISO). Missing from an older API. */
  supporter?: SupporterTier | null
  supporterSince?: string | null
  self: boolean
}

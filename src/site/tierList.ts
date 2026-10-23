import type { Difficulty } from '../game/difficulty'
import { PLAYABLE_IDS } from '../data/hatchlings'
import { TIER_RUNS } from '../data/tierRuns'

/** A regular run's Pokémon: a starter or an egg family (legends play their own mode, outside the tier list). */
export type FamilyId = (typeof PLAYABLE_IDS)[number]

/** One family's runs on one difficulty: how many, how many beat Mewtwo and the average minute reached. */
export type TierCell = { runs: number; wins: number; minute: number }

export type TierRunTable = Partial<Record<FamilyId, Partial<Record<Difficulty, TierCell>>>>

export const TIER_DIFFICULTIES = ['normal', 'hard', 'nightmare'] as const satisfies readonly Difficulty[]

export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const

export type Tier = (typeof TIERS)[number]

/**
 * How the tier list ranks.
 *
 * - `prior`: each difficulty's win rate is smoothed toward that difficulty's
 *   overall rate as if the family had played `prior` extra runs at the average,
 *   so 19 runs with 18 wins can't jump over 400 runs with 300.
 * - `weights`: the score compares each smoothed rate with its difficulty's
 *   average on an odds scale (log-odds), so going from 5% to 10% on Nightmare
 *   counts like going from 55% to 70% on Normal, then averages the three with
 *   these weights. Hard weighs most: it has plenty of runs and is played by
 *   players who already know the game, whatever their Pokémon. Normal is the
 *   most played but beginners crowd the Kanto starters there, and Nightmare is
 *   the toughest test but has the fewest wins, so the noisiest rates.
 * - `minRuns`: a family with fewer runs, all difficulties together, waits in
 *   "not enough data yet" instead of getting a tier.
 * - `cuts`: the tiers by score, read as "odds of beating Mewtwo against the
 *   average Pokémon" (1 = average): S from 1.8× (nearly double), A from 1.3×,
 *   B from 1× (average or better), C from 0.75×, D below.
 */
export const TIER_RULES = {
  prior: 30,
  weights: { normal: 0.3, hard: 0.4, nightmare: 0.3 },
  minRuns: 50,
  cuts: { S: 1.8, A: 1.3, B: 1, C: 0.75 },
} as const satisfies {
  prior: number
  weights: Record<(typeof TIER_DIFFICULTIES)[number], number>
  minRuns: number
  cuts: Record<Exclude<Tier, 'D'>, number>
}

export type TierRules = typeof TIER_RULES

type Diff = (typeof TIER_DIFFICULTIES)[number]

export type RankedFamily = {
  id: FamilyId
  tier: Tier
  /** Odds of beating Mewtwo against the average Pokémon, difficulties weighed (`TIER_RULES`): 1 is average. */
  score: number
  runs: number
  /** Average minute reached, all difficulties together. */
  minute: number
  cells: Record<Diff, TierCell>
}

export type TierList = {
  /** Best first. */
  ranked: readonly RankedFamily[]
  /** Families short of `minRuns`, most played first. */
  unranked: readonly { id: FamilyId; runs: number }[]
  /** Every run counted, ranked or not. */
  runs: number
  /** Each difficulty's overall win rate, the smoothing's anchor. */
  means: Record<Diff, number>
}

const EMPTY: TierCell = { runs: 0, wins: 0, minute: 0 }

const logit = (p: number) => Math.log(p / (1 - p))

/** Keeps a rate off 0 and 1, where its odds are infinite. */
const clampRate = (p: number) => Math.min(0.999, Math.max(0.001, p))

/** Share of a cell's runs that beat Mewtwo, in whole percent. */
export const winPercent = (cell: TierCell) => (cell.runs > 0 ? Math.round((cell.wins / cell.runs) * 100) : 0)

/** A win rate pulled toward `mean` by `prior` runs' worth of average results: tiny samples land near the mean, big ones keep their own rate. */
export const smoothedRate = (wins: number, runs: number, mean: number, prior: number) => (wins + prior * mean) / (runs + prior)

export const tierOf = (score: number, cuts: TierRules['cuts'] = TIER_RULES.cuts): Tier =>
  score >= cuts.S ? 'S' : score >= cuts.A ? 'A' : score >= cuts.B ? 'B' : score >= cuts.C ? 'C' : 'D'

/** Ranks `ids` from their runs in `table` (`TIER_RULES` explains how). */
export const tierList = (table: TierRunTable, ids: readonly FamilyId[] = PLAYABLE_IDS, rules: TierRules = TIER_RULES): TierList => {
  const cellsOf = (id: FamilyId): Record<Diff, TierCell> => {
    const own = table[id]
    return { normal: own?.normal ?? EMPTY, hard: own?.hard ?? EMPTY, nightmare: own?.nightmare ?? EMPTY }
  }
  const families = ids.map((id) => {
    const cells = cellsOf(id)
    const all = TIER_DIFFICULTIES.map((d) => cells[d])
    const runs = all.reduce((n, c) => n + c.runs, 0)
    const minute = runs > 0 ? all.reduce((n, c) => n + c.minute * c.runs, 0) / runs : 0
    return { id, cells, runs, minute }
  })
  const total = (d: Diff, key: 'runs' | 'wins') => families.reduce((n, f) => n + f.cells[d][key], 0)
  const meanOf = (d: Diff) => clampRate(total(d, 'runs') > 0 ? total(d, 'wins') / total(d, 'runs') : 0.5)
  const means = { normal: meanOf('normal'), hard: meanOf('hard'), nightmare: meanOf('nightmare') }
  const scoreOf = (cells: Record<Diff, TierCell>) =>
    Math.exp(
      TIER_DIFFICULTIES.reduce((sum, d) => {
        const rate = smoothedRate(cells[d].wins, cells[d].runs, means[d], rules.prior)
        return sum + rules.weights[d] * (logit(rate) - logit(means[d]))
      }, 0),
    )
  const ranked = families
    .filter((f) => f.runs >= rules.minRuns)
    .map((f): RankedFamily => {
      const score = scoreOf(f.cells)
      return { ...f, score, tier: tierOf(score, rules.cuts) }
    })
    .sort((a, b) => b.score - a.score)
  const unranked = families.filter((f) => f.runs < rules.minRuns).map(({ id, runs }) => ({ id, runs })).sort((a, b) => b.runs - a.runs)
  return { ranked, unranked, runs: families.reduce((n, f) => n + f.runs, 0), means }
}

let current: TierList | null = null

/** The tier list from the committed snapshot (`data/tierRuns.ts`). */
export const currentTierList = (): TierList => (current ??= tierList(TIER_RUNS))

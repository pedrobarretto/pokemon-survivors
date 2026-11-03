import { createRng, seedFrom, weightedPick } from '../engine/rng'
import type { EnemyId } from '../data/enemies'
import { isExclusiveFamily, PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { brasiliaDay, dayNumber, msSinceDayStart, previousDay, type DayKey } from './day'
import type { Difficulty } from './difficulty'
import { NO_RANKS, UPGRADE_IDS } from './meta'
import { isHalloweenDay } from './halloween'
import { outbreakOf } from './outbreak'
import type { ReplayStart } from './replay'

/**
 * Desafio do dia (daily challenge): one run per Brasília day that is the same
 * for everyone, drawn from the date alone: the seed (so the same map, cast
 * and drops), the Pokémon (any playable one, an egg family still unhatched
 * included: a taste of it; the exclusive eggs' families aside) and the difficulty. The Poké Mart's upgrades, the
 * Bag's consumables, the armed TMs, evolution items and Bottle Caps, the Shiny Charm and the first run's lucky egg are
 * off, so the board is clean; the day's outbreak stays on (it's the day's
 * too), and so does the Noite das Bruxas on its days. Only the first finished run of each player counts on the challenge
 * board (the API decides, `server/src/ranking.ts`); the rest are practice.
 * The shell plays it like any run, so replays and their check are the same.
 * Pure; shared with the API.
 */

export const CHALLENGE = {
  /** How often each difficulty is drawn: mostly Normal and Hard, a Nightmare now and then (only until `nightmareUntil`). */
  difficulty: [['normal', 5], ['hard', 4], ['nightmare', 2]] as const satisfies ReadonlyArray<readonly [Difficulty, number]>,
  /**
   * The last day a Nightmare draw plays on Nightmare. With every upgrade off no one won one (0 in ~4.8k runs on
   * 2026-10-26 and 27), so later days play it on Hard. The draw itself stays, so every other day keeps its difficulty.
   */
  nightmareUntil: '2026-10-28',
  /** A challenge run may still start this long after its day ended (the menus were open at midnight). */
  graceMs: 10 * 60_000,
  /** The ribbons of a day go out this long after it ended: runs that started late have finished, and their checks too. */
  settleMs: 3 * 3_600_000,
} as const

export type Challenge = { day: DayKey; seed: number; starter: PlayableId; difficulty: Difficulty; outbreak: EnemyId; halloween: boolean }

/**
 * Who the challenge draws from: every playable Pokémon but the exclusive
 * families, which only their own egg brings (the Haunted Egg's, the Kecleon
 * Egg's; they also joined after the draw began: leaving them out keeps every
 * day's Pokémon where it was).
 */
const POOL = PLAYABLE_IDS.filter((id) => !isExclusiveFamily(id))

/** A seeded shuffle of the pool: one cycle of days gives each one its day. */
const cycleOrder = (cycle: number) => {
  const rng = createRng(seedFrom(`challenge:${cycle}`))
  const order = [...POOL]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return order
}

/** The challenge of a Brasília day. The Pokémon walk through seeded cycles, so none repeats within one; no Nightmare after `CHALLENGE.nightmareUntil`. */
export const dailyChallenge = (day: DayKey): Challenge => {
  const n = dayNumber(day)
  const size = POOL.length
  const rng = createRng(seedFrom(`challenge-day:${day}`))
  const drawn = weightedPick(rng, CHALLENGE.difficulty)
  return {
    day,
    seed: seedFrom(`challenge-seed:${day}`),
    starter: cycleOrder(Math.floor(n / size))[((n % size) + size) % size]!,
    difficulty: drawn === 'nightmare' && day > CHALLENGE.nightmareUntil ? 'hard' : drawn,
    outbreak: outbreakOf(day),
    halloween: isHalloweenDay(day),
  }
}

/** The run a challenge starts: its seed, Pokémon and difficulty, with every upgrade and item off. `shiny` only changes the colors. */
export const challengeStart = (c: Challenge, view: { w: number; h: number }, shiny: boolean): ReplayStart => ({
  seed: c.seed,
  starter: c.starter,
  difficulty: c.difficulty,
  ranks: NO_RANKS,
  shiny,
  luckyEgg: false,
  outbreak: c.outbreak,
  halloween: c.halloween,
  bag: [],
  view: { w: view.w, h: view.h },
})

export type ChallengeProblem = 'seed' | 'starter' | 'difficulty' | 'ranks' | 'items' | 'outbreak' | 'halloween'

/**
 * Why a run's start isn't `day`'s challenge, or null when it is: the same
 * seed, Pokémon, difficulty, outbreak and haunting, no upgrade nor Bottle
 * Cap, no Bag item, armed TM, evolution item nor lucky egg. The shiny colors are free (they don't touch the run).
 */
export const challengeProblem = (start: ReplayStart, day: DayKey): ChallengeProblem | null => {
  const c = dailyChallenge(day)
  if (start.seed !== c.seed) return 'seed'
  if (start.starter !== c.starter) return 'starter'
  if (start.difficulty !== c.difficulty) return 'difficulty'
  if (UPGRADE_IDS.some((id) => start.ranks[id] !== 0) || (start.caps ?? 0) > 0) return 'ranks'
  if (start.bag.length > 0 || (start.tms?.length ?? 0) > 0 || (start.evo?.length ?? 0) > 0 || start.luckyEgg) return 'items'
  if (start.halloween !== c.halloween) return 'halloween'
  return start.outbreak === c.outbreak ? null : 'outbreak'
}

/** Whether a challenge run of `day` may start at `now`: on its day, or just after it ended (`CHALLENGE.graceMs`). */
export const challengeOpen = (day: DayKey, now: Date) => {
  const today = brasiliaDay(now)
  return day === today || (day === previousDay(today) && msSinceDayStart(now) < CHALLENGE.graceMs)
}

/** Whether `day`'s ribbons can go out at `now`: it ended at least `CHALLENGE.settleMs` ago. */
export const ribbonsDue = (day: DayKey, now: Date) => {
  const yesterday = previousDay(brasiliaDay(now))
  return day < yesterday || (day === yesterday && msSinceDayStart(now) >= CHALLENGE.settleMs)
}

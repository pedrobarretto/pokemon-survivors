import { PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { LEGEND_IDS } from '../data/legends'
import { REGIONS, STARTERS } from '../data/starters'
import { DIFFICULTY_IDS, isDifficulty, type Difficulty } from './difficulty'
import type { Lifetime } from './achievements'
import { isRecord } from './parse'
import { isPlayable } from './ranking'
import type { RunSummary } from './tally'

/**
 * Clears: the Pokémon that beat Mewtwo, each with the hardest difficulty it
 * did it on. The Pokédex and the partner select badge them, so players can
 * chase a clear with every partner, the Legend mode's legends too.
 */
export type Clears = Partial<Record<PlayableId, Difficulty>>

/** Every Pokémon that can hold a clear: the regular cast and the legends. */
export const CLEARABLE: readonly PlayableId[] = [...PLAYABLE_IDS, ...LEGEND_IDS]

const rank = (d: Difficulty) => DIFFICULTY_IDS.indexOf(d)

/** The harder of two difficulties (`b` when there's no `a`). */
const harder = (a: Difficulty | undefined, b: Difficulty): Difficulty => (a !== undefined && rank(a) >= rank(b) ? a : b)

const withClear = (clears: Clears, id: PlayableId, d: Difficulty): Clears => ({ ...clears, [id]: harder(clears[id], d) })

/** Adds a run's clear, if Mewtwo fell in it. */
export const addClear = (clears: Clears, s: Pick<RunSummary, 'starter' | 'difficulty' | 'victory'>): Clears =>
  s.victory ? withClear(clears, s.starter, s.difficulty) : clears

/** Two saves' clears in one: every Pokémon cleared on either side, at the harder difficulty. */
export const mergeClears = (a: Clears, b: Clears): Clears =>
  CLEARABLE.reduce((acc, id) => {
    const d = b[id]
    return d ? withClear(acc, id, d) : acc
  }, a)

/** Saved clears, keeping known Pokémon and difficulties only. */
export const parseClears = (raw: unknown): Clears =>
  isRecord(raw)
    ? Object.fromEntries(
        CLEARABLE.flatMap((id) => {
          const d = raw[id]
          return isDifficulty(d) ? [[id, d] as const] : []
        }),
      )
    : {}

/** Each regional starter with its region and base type, for `pastClears`. */
const REGIONAL = REGIONS.flatMap((r) => r.starters.map((id) => ({ id, gen: r.gen, type: STARTERS[id].line[0].types[0]! })))

/**
 * Clears a save from before they were tracked can prove from its records:
 * the regions and base types of the starters that won (`winGens`, `winTypes`)
 * and the starters played. A region's winner is a starter of it that was
 * played and whose type won; when only one fits, it won. The same goes for
 * each type. Hatched families left no trace. The difficulty isn't known: Normal.
 */
export const pastClears = (l: Lifetime): Clears => {
  const fits = REGIONAL.filter((s) => l.starters.includes(s.id) && l.winGens.includes(s.gen) && l.winTypes.includes(s.type))
  const sole = (match: (s: (typeof fits)[number]) => boolean) => {
    const found = fits.filter(match)
    return found.length === 1 ? [found[0]!.id] : []
  }
  const won = [...l.winGens.flatMap((gen) => sole((s) => s.gen === gen)), ...l.winTypes.flatMap((type) => sole((s) => s.type === type))]
  return Object.fromEntries(won.map((id) => [id, 'normal'] as const))
}

/** The clears a list of won runs proves (the API's ranked runs), skipping unknown Pokémon and difficulties. */
export const wonClears = (runs: readonly { starter: string; difficulty: string }[]): Clears =>
  runs.reduce<Clears>((clears, r) => (isPlayable(r.starter) && isDifficulty(r.difficulty) ? withClear(clears, r.starter, r.difficulty) : clears), {})

/** How many Pokémon have a clear. */
export const clearCount = (clears: Clears) => Object.keys(clears).length

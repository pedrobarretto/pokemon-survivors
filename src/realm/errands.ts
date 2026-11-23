import { createRng, seedFrom } from '../engine/rng'
import type { Deed } from '../data/realmStamps'

/**
 * The Recados: three short jobs a day on the plaza's board, the same for
 * everyone, drawn from the Brasília day. Each counts a deed
 * (`data/realmStamps.ts`) and every one can be done alone, since most of the
 * time nobody else is online. Finished ones are collected at the board
 * (`POST /realm/errands/claim`), and the reward lands like a run's ₽.
 *
 * Accounts only, like the Realm itself, so they live apart from the game's
 * daily missions (`game/missions.ts`), which guests get too.
 */

export type Errand = { id: string; deed: Deed; target: number; reward: number }

/** A job and how many of it; `id` is the deed and target, as `game/missions.ts` does. */
const errand = (deed: Deed, target: number, reward = 150): Errand => ({ id: `${deed}:${target}`, deed, target, reward })

/** Each slot draws from its own list, so a day never asks for three of a kind. */
const SLOTS: readonly (readonly Errand[])[] = [
  [errand('game:fishing', 1), errand('game:berryCatch', 1), errand('game:whackDiglett', 1), errand('game:fourInRow', 1), errand('game:typeDuel', 1)],
  [errand('room:pier', 1), errand('room:cafe', 1), errand('room:arcade', 1), errand('room:trail', 1), errand('sit', 2), errand('lagoon', 1)],
  [errand('base:visit', 1), errand('like', 1), errand('say', 3), errand('emote:wave', 1), errand('emote:heart', 1)],
]

/** ₽ on top for finishing the whole day's list (claimed with its last one). */
export const ERRANDS_BONUS = 300

/** The errands of a Brasília day (`YYYY-MM-DD`). */
export const drawErrands = (day: string): Errand[] => {
  const rng = createRng(seedFrom(`realm-errands:${day}`))
  return SLOTS.map((list) => list[Math.floor(rng() * list.length)]!)
}

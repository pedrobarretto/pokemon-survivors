import { PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { LEGEND_IDS } from '../data/legends'
import { isRecord } from './parse'

/**
 * Shiny starters for good: rolling the 1/64 shiny on a starter unlocks its
 * shiny form forever, and the select screen then offers Normal or Shiny.
 * Saved as `{ [id]: picked }`: a key means unlocked, its value whether the
 * next run plays it shiny. A family hatched shiny owns its shiny through
 * `hatched` and keeps its Normal/Shiny pick here too (`pickShinyForm` in
 * `shinyPicks.ts`). A legend's shiny comes from beating it shiny once
 * captured (`capture.ts`). Pure; shared with the API through the save.
 */
export type ShinyStarters = Readonly<Partial<Record<PlayableId, boolean>>>

export const NO_SHINY_STARTERS: ShinyStarters = {}

/** Every Pokémon that can own a shiny here: the regular cast and the legends. */
const OWNERS: readonly PlayableId[] = [...PLAYABLE_IDS, ...LEGEND_IDS]

/** Unlocks `id`'s shiny (picked, since the player just met it shiny). Already unlocked: the pick stays. */
export const unlockShinyStarter = (owned: ShinyStarters, id: PlayableId): ShinyStarters => (id in owned ? owned : { ...owned, [id]: true })

/** Both in one: every key on either side, with `incoming`'s pick when it has one (a setting, like the difficulty), so a shiny hatch switched to Normal stays Normal. */
export const mergeShinyStarters = (base: ShinyStarters, incoming: ShinyStarters): ShinyStarters =>
  Object.fromEntries(OWNERS.flatMap((id) => (id in incoming ? [[id, incoming[id] === true]] : id in base ? [[id, base[id] === true]] : [])))

/** The save's `shinyStarters`: unknown Pokémon and non-boolean picks are dropped. */
export const parseShinyStarters = (raw: unknown): ShinyStarters =>
  isRecord(raw) ? Object.fromEntries(OWNERS.flatMap((id) => (typeof raw[id] === 'boolean' ? [[id, raw[id]]] : []))) : NO_SHINY_STARTERS

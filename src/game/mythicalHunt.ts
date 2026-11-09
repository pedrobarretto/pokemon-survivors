import { createRng, pick, seedFrom } from '../engine/rng'
import { EVENTS, MYTHICAL_PITY, MYTHICALS, type Mythical, type WaveEvent } from '../data/waves'
import { isCaptured } from './capture'
import type { Save } from './meta'
import { isRecord, wholeNumber } from './parse'
import type { Roster } from './roster'

/**
 * The mythicals' bad-luck protection. While a player still misses a mythical,
 * every finale that went by without beating one raises the next finale's
 * chance (`MYTHICAL_PITY`), and the mythical that comes is one they miss.
 *
 * The save holds two counters that only grow, so devices merge them by the
 * larger side and a beaten mythical on one device can't be undone by another:
 * how many finales were played, and how many had been when a mythical last fell.
 */
export type MythicalPity = { finales: number; beaten: number }

export const NO_MYTHICAL_PITY: MythicalPity = { finales: 0, beaten: 0 }

/** What a run brings from the save (`ReplayStart.mythical`): finales since a mythical last fell, and who's still missing. */
export type MythicalHunt = { dry: number; missing: readonly Mythical[] }

/** The chance of the finale's mythical slot after `dry` finales without beating one. */
export const mythicalChance = (base: number, dry: number) =>
  dry >= MYTHICAL_PITY.sure ? 1 : base + Math.max(0, dry - MYTHICAL_PITY.free) * MYTHICAL_PITY.step

/** The hunt a regular run plays, or undefined with every mythical captured (the run then plays the plain odds). */
export const mythicalHunt = ({ legends, mythicalPity }: Pick<Save, 'legends' | 'mythicalPity'>): MythicalHunt | undefined => {
  const missing = MYTHICALS.filter((id) => !isCaptured(legends, id))
  if (missing.length === 0) return undefined
  return { dry: Math.min(Math.max(0, mythicalPity.finales - mythicalPity.beaten), MYTHICAL_PITY.sure), missing }
}

/** A replay's hunt: a known, ordered, non-empty list and a count within the guarantee; null otherwise. */
export const parseHunt = (raw: unknown): MythicalHunt | null => {
  if (!isRecord(raw) || !Array.isArray(raw.missing) || raw.missing.length === 0) return null
  if (typeof raw.dry !== 'number' || !Number.isInteger(raw.dry) || raw.dry < 0 || raw.dry > MYTHICAL_PITY.sure) return null
  const listed = raw.missing as readonly unknown[]
  const missing = MYTHICALS.filter((id) => listed.includes(id))
  return missing.length === listed.length ? { dry: raw.dry, missing } : null
}

/**
 * The roster with the finale's mythical slot taking one the player misses.
 * Drawn from its own stream of the seed, so the run's rng stays in step and the
 * shell streams the right sprites from the roster.
 */
export const withHunt = (roster: Roster, hunt: MythicalHunt | undefined, seed: number, events: readonly WaveEvent[] = EVENTS): Roster => {
  if (!hunt) return roster
  const guest = pick(createRng(seedFrom(`mythical:${seed}`)), hunt.missing)
  return { ...roster, events: roster.events.map((id, i) => (events[i]?.kind === 'boss' && 'mythical' in events[i] ? guest : id)) }
}

/** One more finale played. */
export const countFinale = (pity: MythicalPity): MythicalPity => ({ ...pity, finales: pity.finales + 1 })

/** A mythical fell: the count starts over. */
export const mythicalBeaten = (pity: MythicalPity): MythicalPity => ({ ...pity, beaten: pity.finales })

/** Both sides' counters at the larger value (safe to merge again). */
export const mergeMythicalPity = (a: MythicalPity, b: MythicalPity): MythicalPity => ({
  finales: Math.max(a.finales, b.finales),
  beaten: Math.max(a.beaten, b.beaten),
})

export const parseMythicalPity = (raw: unknown): MythicalPity =>
  isRecord(raw) ? { finales: wholeNumber(raw.finales), beaten: wholeNumber(raw.beaten) } : NO_MYTHICAL_PITY

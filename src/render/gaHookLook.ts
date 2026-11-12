import { hash2 } from '../engine/rng'
import { formAt } from '../game/branch'
import type { Game, Player } from '../game/types'
import { isVivillonPattern, MINIOR_CORE_IDS, MINIOR_DEX, VIVILLON_DEX, VIVILLON_PATTERNS, type MiniorCore, type VivillonPattern } from '../data/vivillon'
import { devicePattern } from '../vivillonRegion'
import type { FormKey } from './sprites'

/**
 * The hook families' looks, the shell's alone (`data/vivillon.ts`): each
 * seat's Vivillon pattern and each Minior's Core color. The simulation never
 * reads them, so they never touch a replay or a co-op hash.
 */

/** Each seat's pattern in a co-op run or a match (`setSeatPatterns`); empty solo, where seat 0 wears this device's. */
let seatPatterns: readonly (VivillonPattern | null)[] = []

/** A room's patterns by seat, from its loadouts (`pattern`, `coop/client.ts`); [] when the game ends or for a solo run. */
export const setSeatPatterns = (bySeat: readonly (VivillonPattern | null)[]) => {
  seatPatterns = bySeat
}

/** A loadout's pattern from the wire, or null (an older build's teammate: Meadow). */
export const parsePattern = (raw: unknown): VivillonPattern | null => (isVivillonPattern(raw) ? raw : null)

/** The pattern a seat's Vivillon wears: this device's solo, the room's in co-op (Meadow when a teammate sent none). */
export const patternOf = (seat: number): VivillonPattern => (seatPatterns.length === 0 ? devicePattern() : (seatPatterns[seat] ?? 'meadow'))

/** A pattern's scale colors, light to dark. */
export const patternColors = (seat: number) => VIVILLON_PATTERNS[patternOf(seat)].colors

/** The Core color a seat's Minior shows this run: drawn from the run's seed and its seat, the same on every screen. */
export const coreOf = (g: Game, seat: number): MiniorCore => MINIOR_CORE_IDS[Math.floor(hash2(g.terrain.seed, seat, MINIOR_DEX) * MINIOR_CORE_IDS.length) % MINIOR_CORE_IDS.length]!

/** Whether `p` shows Minior's Core now (Shields Down broke its shell). */
const coreOpen = (p: Player) => p.kitH?.kind === 'shields' && p.kitH.core

/** The sheets a hook family wears beyond its own: Vivillon's pattern, Minior's Core; undefined for anyone else. */
export const hookForm = (g: Game, p: Player): FormKey | undefined => {
  if (coreOpen(p)) return coreOf(g, p.slot)
  if (p.starter !== 'scatterbug' || formAt(p.starter, p.branch, p.stage).dex !== VIVILLON_DEX) return undefined
  const pattern = patternOf(p.slot)
  return pattern === 'meadow' ? undefined : pattern
}

/** The variants a hook family may soon wear (preloads): its Vivillon from Spewpa on, its Core from the start. */
export const hookVariants = (g: Game, p: Player): { dex: number; shiny: boolean; form?: FormKey }[] => {
  if (p.starter === 'minior') return [{ dex: MINIOR_DEX, shiny: p.shiny, form: coreOf(g, p.slot) }]
  if (p.starter !== 'scatterbug' || p.stage < 1) return []
  const pattern = patternOf(p.slot)
  return [pattern === 'meadow' ? { dex: VIVILLON_DEX, shiny: p.shiny } : { dex: VIVILLON_DEX, shiny: p.shiny, form: pattern }]
}

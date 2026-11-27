import { DIG_BOX_REPEAT, DIG_DIAMOND_REPEAT, type DigLegend } from '../../data/digTreasures'
import { MELTAN } from '../../data/legendPaths'
import { DIANCIE } from '../../data/mythicals'
import type { GiftContent } from '../../game/gifts'

/**
 * The Escavação's legends (Meltan's Mystery Box, Diancie's pink diamond):
 * pure, shared by the API, which rolls every draw, and the dev console's fake
 * mine. A legend's treasure is buried for an account still without the
 * legend and, once it has it, still without its shiny, so the hunt goes on
 * without ever giving up the one caught. Dug out, it brings the legend (shiny
 * by its treasure's chance), or, for an account that has it, its shiny by the
 * same chance and its ₽ otherwise.
 */

/** What a legend's treasure is still for on an account: the legend, its shiny once the legend is owned, or nothing more (it's never buried then). */
export type LegendWant = 'legend' | 'shiny' | null

/** What the account has of a legend: caught (or on its way as a gift), and its shiny owned (or on its way). */
export const legendWant = (has: { legend: boolean; shiny: boolean }): LegendWant => (!has.legend ? 'legend' : !has.shiny ? 'shiny' : null)

/** Each legend's treasure: the chance a wall holds it, the walls after which one surely does, the chance it's shiny, and the ₽ it pays when it brings neither. */
export const DIG_LEGENDS = {
  meltan: { chance: MELTAN.box, every: MELTAN.boxGuarantee, shiny: MELTAN.boxShiny, coins: DIG_BOX_REPEAT },
  diancie: { chance: DIANCIE.jewel, every: DIANCIE.guarantee, shiny: DIANCIE.jewelShiny, coins: DIG_DIAMOND_REPEAT },
} as const satisfies Record<DigLegend, { chance: number; every: number; shiny: number; coins: number }>

/** Whether the account's next wall (after `walls` built) holds the legend's treasure: only while it's still for something, surely every `every` walls, else when `roll` (0 to 1) falls under its chance. */
export const legendDue = (legend: DigLegend, want: LegendWant, walls: number, roll: number) =>
  want !== null && ((walls + 1) % DIG_LEGENDS[legend].every === 0 || roll < DIG_LEGENDS[legend].chance)

/**
 * Which legends' treasures a new wall holds, from what each due one is for
 * (null: not due). Both don't always fit one wall: a legend the account lacks
 * outright goes before a shiny hunt, and between equals Diancie's diamond, the
 * rarer, takes the wall (the box's chance comes back with the next one).
 */
export const wallLegends = (due: Readonly<Record<DigLegend, LegendWant>>): { box: boolean; diamond: boolean } => {
  const diamond = due.diancie !== null && !(due.diancie === 'shiny' && due.meltan === 'legend')
  return { diamond, box: due.meltan !== null && !diamond }
}

/** What a legend's treasure pays: the gift it sends, whether its legend came shiny, and the ₽ when it brought no legend. */
export type LegendPrize = { gift: GiftContent; shiny: boolean; coins: number }

/**
 * A legend's treasure dug out, by what it's for as the wall ends (`want`,
 * read again then) and the shiny roll (0 to 1): the legend, shiny when the
 * roll falls under its chance; for an account that has it, its shiny by the
 * same chance, else ₽; and ₽ when there's nothing left to want.
 */
export const legendPrize = (legend: DigLegend, want: LegendWant, roll: number): LegendPrize => {
  const shiny = want !== null && roll < DIG_LEGENDS[legend].shiny
  if (want === 'legend' || shiny) return { gift: { kind: 'legend', legend, ...(shiny ? { shiny: true as const } : {}) }, shiny, coins: 0 }
  const coins = DIG_LEGENDS[legend].coins
  return { gift: { kind: 'coins', amount: coins }, shiny: false, coins }
}

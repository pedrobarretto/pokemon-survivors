import { DIG_TREASURES, type DigTreasureId } from '../data/digTreasures'
import type { Deed } from '../data/realmStamps'

/**
 * The deeds of the mini games the API runs itself (the claw, the Safári, the
 * Escavação): what an outcome it just settled counts toward the Estampas
 * (`data/realmStamps.ts`). The API reports them from its own decisions, once
 * per outcome (a retried request reads the stored answer back and counts
 * nothing); the fakes count the same, so `ps.realm('fake')` lands the stamps.
 * Empty when the outcome counts nothing.
 */

type Deeds = Map<Deed, number>

/** Only the deeds that happened. */
const counted = (entries: readonly (readonly [Deed, number])[]): Deeds => new Map(entries.filter(([, n]) => n > 0))

/** A drop at the claw machine: a win counts, and a win on a plush with no misses on it yet (`missesBefore` 0, the full grip `CLAW.firstNeed` asks) is a first try. Credits alone count nothing. */
export const clawDeeds = (won: boolean, missesBefore: number): Deeds =>
  counted([
    ['claw:plush', won ? 1 : 0],
    ['claw:firstTry', won && missesBefore === 0 ? 1 : 0],
  ])

/** A ball thrown in the Zona Safári: a catch counts, and a shiny catch counts as a shiny too. */
export const safariDeeds = (caught: boolean, shiny: boolean): Deeds =>
  counted([
    ['safari:catch', caught ? 1 : 0],
    ['safari:shiny', caught && shiny ? 1 : 0],
  ])

/** A wall that ended with `kept` dug out whole: each treasure, each fossil among them, and a golden wall that gave one up. */
export const digDeeds = (golden: boolean, kept: readonly DigTreasureId[]): Deeds =>
  counted([
    ['dig:find', kept.length],
    ['dig:fossil', kept.filter((id) => DIG_TREASURES[id].prize.kind === 'fossil').length],
    ['dig:golden', golden && kept.length > 0 ? 1 : 0],
  ])

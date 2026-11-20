import { canPlay } from './capture'
import { capLevel } from './evoItems'
import { openForms } from './legendPaths'
import { UPGRADE_IDS, type Save } from './meta'
import type { ReplayStart } from './replay'

/**
 * What a ranked run brings from the save that makes it stronger, each a field
 * of its `ReplayStart` the account's stored save must back: the Pokémon itself
 * (a family hatched, a legend captured), the Poké Mart's ranks, its Bottle Caps,
 * the TMs and evolution items it owns, its Shadow (or Purified) self and the
 * forms its legend's path opened. The rest is left out on purpose: what the
 * run used up (Bag items, the Hideout's pass), what only changes colors
 * (shiny) or the map (the temple, the ruins, the legends still to catch), and
 * what the API checks on its own clock (outbreak, haunting, raid, Ultra Beast).
 */
export const LOADOUT_FIELDS = ['starter', 'ranks', 'caps', 'tms', 'evo', 'variant', 'forms'] as const

export type LoadoutField = (typeof LOADOUT_FIELDS)[number]

/** The parts of a save that back a run's loadout. */
export type BackingSave = Pick<Save, 'hatched' | 'legends' | 'ranks' | 'caps' | 'tms' | 'evo' | 'shadows' | 'paths'>

type Loadout = Pick<ReplayStart, 'starter' | 'ranks' | 'caps' | 'tms' | 'evo' | 'variant' | 'forms'>

/**
 * The fields of a regular ranked run's loadout (not a Desafio do dia's, which
 * plays the day's own) that `save` doesn't back, in `LOADOUT_FIELDS` order;
 * empty when it backs them all. Every check asks only that the save holds at
 * least what the run brought, since a save only grows after the run started
 * (a Shadow purified since still backs its Shadow run). The one exception is a
 * refund of the Poké Mart's ranks after the run, which reads as `ranks`.
 */
export const unbackedLoadout = (start: Loadout, save: BackingSave): LoadoutField[] => {
  const { starter } = start
  const backed: Record<LoadoutField, boolean> = {
    starter: canPlay(save, starter),
    ranks: UPGRADE_IDS.every((id) => start.ranks[id] <= save.ranks[id]),
    caps: (start.caps ?? 0) <= capLevel(save.caps, starter),
    tms: (start.tms ?? []).every((id) => save.tms.owned.includes(id)),
    evo: (start.evo ?? []).every((id) => save.evo.includes(id)),
    variant: start.variant === undefined || save.shadows[starter] !== undefined,
    forms: (start.forms ?? []).every((id) => openForms(save.paths, starter).includes(id)),
  }
  return LOADOUT_FIELDS.filter((field) => !backed[field])
}

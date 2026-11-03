import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { formAt } from './branch'
import type { Save } from './meta'
import { playsShiny } from './shinyPicks'
import { isSpecialCompanion, SPECIAL_COMPANIONS } from '../data/companions'
import { canWalkWith, type Companion, type SupporterTier } from './supporters'

/**
 * The trainer's face on the Trainer chip and card: the companion when one
 * walks along (a supporter's pick, `tier` being the account's), else the
 * save's `partner` (the last Pokémon picked), at its line's final stage,
 * shiny when the save plays it shiny.
 */
export const trainerAvatar = (save: Save, tier: SupporterTier | null) => {
  const companion = save.companion && canWalkWith(save, save.companion, tier) ? save.companion : null
  const walking = companion?.id
  if (walking !== undefined && isSpecialCompanion(walking)) return { dex: SPECIAL_COMPANIONS[walking].dex, shiny: companion?.shiny === true }
  const id: PlayableId = walking ?? save.partner
  const shiny = companion ? companion.shiny : playsShiny(save, id)
  // A branching family wears the branch it took last (an Espeon trainer stays an Espeon).
  return { dex: formAt(id, save.branches[id] ?? null, PLAYABLE[id].line.length - 1).dex, shiny }
}

/**
 * The Pokémon a supporter stands with on the Hall da Fama (the API reads it
 * from their synced save, `tier` their tier there): a shiny they picked with
 * a ticket (in the form they play it, Shiny unless switched to Normal), else
 * their companion, else their partner, shiny when they play it so.
 */
export const hallPokemon = (save: Save, tier: SupporterTier): Companion => {
  const picked = save.shinyPicks.findLast((p) => p.pick !== null)?.pick
  if (picked) return { id: picked, shiny: save.shinyStarters[picked] !== false }
  if (save.companion && canWalkWith(save, save.companion, tier)) return save.companion
  return { id: save.partner, shiny: playsShiny(save, save.partner) }
}

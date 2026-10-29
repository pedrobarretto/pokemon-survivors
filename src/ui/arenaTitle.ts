import { effectIn, isArenaEffectId } from '../data/arenaEffects'
import { t } from '../i18n'
import { h } from './dom'

/**
 * A player's Arena title (`title` in `data/arenaEffects.ts`) under their
 * name, in its rarity's color: on the scoreboard, the VS splash and the hub's
 * profile. Null without one.
 */
export const titleChip = (id: string | undefined) => {
  const def = effectIn('title', id)
  return def && isArenaEffectId(id) ? h('small', { class: `arena-title ${def.rarity}` }, t().arenaEffects[id]) : null
}

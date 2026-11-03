import { ABILITIES } from '../data/abilities'
import { abilityBoosting } from '../game/abilities'
import type { MoveId } from '../game/moves'
import { localPlayer } from '../game/players'
import type { Game, Player } from '../game/types'
import { t } from '../i18n'
import { abilityIcon } from '../render/abilityArt'
import { h } from './dom'

/**
 * The ability icon a move wears when the player's ability boosts it (Sharpness
 * on slicing moves, Torrent on Water ones…), or nothing. `cls` places it: the
 * HUD's slots, the level-up cards, the pause menu's loadout.
 */
export const abilityMark = (g: Game, id: MoveId, cls: string, owner: Player = localPlayer(g)) => {
  const ability = abilityBoosting(g, owner, id)
  return ability && h('img', { class: `ability-mark ${cls}`, src: abilityIcon(ability), alt: '', title: t().moveCard.boosted(ABILITIES[ability].name) })
}

/** What the marks follow, so a screen that caches them knows when to redraw: the ability in play and the form (whose types Adaptability reads). */
export const abilityMarkKey = (p: Player) => `${p.ability.id}|${p.mega.active > 0}|${p.stage}|${p.branch}|${p.legend?.awakened ?? ''}`

import type { Game } from '../game/types'
import { t } from '../i18n'
import { h, setText } from './dom'

/**
 * Mystery Dungeon's floor card: the screen goes black with the dungeon's name
 * and floor ("Dark Cave", "B1F") while the floor's title card holds the
 * simulation still (`updatePlaceIntro`). A hidden zone gets one on the way in
 * too ("Hidden Grotto", "Hidden zone"). Part of the HUD, so it follows the
 * game's own clock (pausing on it pauses the card).
 */
export const createPlaceCard = () => {
  const name = h('b', {})
  const floor = h('span', {})
  const el = h('div', { class: 'floor-card hidden' }, name, floor)
  let shown = false
  const update = (g: Game) => {
    const inside = g.place.inside
    const show = inside !== null && inside.intro > 0
    if (show) {
      const m = t().places
      setText(name, m.names[inside.id])
      setText(floor, inside.id === 'cave' ? m.floor(inside.state.floor + 1) : m.hiddenTag)
    }
    if (show === shown) return
    shown = show
    el.classList.toggle('hidden', !show)
  }
  return { el, update }
}

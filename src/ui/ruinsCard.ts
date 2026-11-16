import { ENEMIES } from '../data/enemies'
import { RUINS, RUINS_SIDES } from '../data/forces'
import { RUINS_LEGENDS } from '../data/legends'
import type { MapEventOf } from '../game/mapEvents'
import { localPlayer } from '../game/players'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { portraitUrl } from '../render/sprites'
import { h, setText } from './dom'
import { typeBadge } from './screens'

/** How close to the Ruins (px) the choice's card shows. */
const NEAR = 300

/**
 * The Ruínas da Decisão's card at the foot of the screen (the ruins stand
 * ahead, in the middle) while the player is near
 * them (`game/splitRuins.ts`): the two Regis side by side as their ruins
 * stand (Regieleki's west, Regidrago's east), each with its portrait, name
 * and ruin, "Captured" on one already caught; once one is chosen it lights
 * up waking and the other dims. The choice itself is walking into a ruin,
 * so it reads the same with keys, a stick or a finger.
 */
export const createRuinsCard = () => {
  const hint = h('div', { class: 'ruins-hint' })
  const title = h('div', { class: 'ruins-title' })
  const tiles = RUINS_LEGENDS.map((regi) => {
    const state = h('small', { class: 'ruins-state' })
    const label = h('small', { class: 'ruins-label' })
    const name = h('b', {}, ENEMIES[regi].name)
    const el = h('div', { class: 'ruins-tile', 'data-regi': regi }, h('img', { src: portraitUrl(ENEMIES[regi].dex), alt: '' }), h('span', { class: 'ruins-words' }, h('span', { class: 'ruins-name' }, name, typeBadge(RUINS_SIDES[regi].type)), label, state))
    return { regi, el, state, label }
  })
  const row = h('div', { class: 'ruins-row' }, ...tiles.toSorted((a, b) => RUINS_SIDES[a.regi].side - RUINS_SIDES[b.regi].side).map((tile) => tile.el))
  const el = h('div', { class: 'ruins-card box hidden' }, title, hint, row)
  let key = ''
  const update = (g: Game) => {
    const ev = g.mapEvents.list.find((e): e is MapEventOf<'splitRuins'> => e.kind === 'splitRuins' && e.gone < 0)
    const p = localPlayer(g)
    const on = ev !== undefined && !ev.state.out && ev.age >= RUINS.rise && (p.x - ev.x) ** 2 + (p.y - ev.y) ** 2 < NEAR * NEAR
    el.classList.toggle('hidden', !on)
    if (!on || !ev) return
    const { free, pick } = ev.state
    const next = `${free.join(',')}|${pick ?? ''}`
    if (next === key) return
    key = next
    const m = t().regisForces.ruins.card
    setText(title, m.title)
    setText(hint, m.hint)
    for (const tile of tiles) {
      const open = free.includes(tile.regi)
      setText(tile.label, m[tile.regi])
      setText(tile.state, !open ? m.caught : pick === tile.regi ? m.waking : '')
      tile.el.classList.toggle('caught', !open)
      tile.el.classList.toggle('chosen', pick === tile.regi)
      tile.el.classList.toggle('sealed', pick !== null && pick !== tile.regi)
    }
    hint.classList.toggle('hidden', pick !== null)
  }
  return { el, update }
}

import { formatTime } from '../engine/math'
import { GRAVEYARD } from '../data/places'
import { overtime } from '../game/endless'
import { entranceShown } from '../game/place'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { h, setText } from './dom'

type Pill = { text: string; kind: 'portal' | 'arena' | 'endless' | 'reaper' | 'place'; urgent: boolean } | null

/** A place the player is in: the dungeon's floor and wind, the keystone's spirits or the dawn, the wings and the calm, the Audino caught, the glints dug. */
const insidePill = (g: Game): Pill => {
  const inside = g.place.inside
  if (!inside || inside.loot !== null) return null
  const m = t().places
  const time = formatTime(Math.ceil(Math.max(0, inside.left)))
  const urgent = inside.left < 10
  switch (inside.id) {
    case 'cave':
      return { text: m.hudCave(m.floor(inside.state.floor + 1), time), kind: 'place', urgent }
    case 'graveyard': {
      const s = inside.state
      return { text: s.bossId === null ? m.hudSpirits(s.spirits, GRAVEYARD.spirits, time) : m.hudDawn(time), kind: 'place', urgent }
    }
    case 'sky':
      return { text: m.hudSky(inside.state.got, time), kind: 'place', urgent }
    case 'grotto':
      return { text: m.hudGrotto(inside.state.dwellers.caught, time), kind: 'place', urgent }
    case 'underground':
      return { text: m.hudDig(inside.state.dug, time), kind: 'place', urgent }
  }
}

/** What the pill under the timer says: the place the player is in, an open rift, the arena's collapse, an open entrance, or the endless clock and Arceus. */
const pillFor = (g: Game): Pill => {
  const m = t().rifts
  const { portal, arena } = g.rift
  if (g.place.inside) return insidePill(g)
  if (arena?.domain) {
    const d = arena.domain
    if (arena.fall !== null) return null
    if (d.act === 'crossing') return { text: m.hudCrossing, kind: 'arena', urgent: d.front - (g.player.y - arena.y) < 70 }
    if (d.act !== 'battle') return null
    return { text: m.hudArena(formatTime(Math.ceil(arena.left))), kind: 'arena', urgent: arena.left < 15 }
  }
  if (arena) {
    if (arena.loot !== null || arena.fall !== null) return null
    return { text: m.hudArena(formatTime(Math.ceil(arena.left))), kind: 'arena', urgent: arena.left < 10 }
  }
  if (portal) return { text: m.hudPortal(formatTime(Math.ceil(portal.left))), kind: 'portal', urgent: portal.left < 8 }
  const ent = g.place.entrance
  // A hidden zone's entrance says nothing until found.
  if (ent?.open && entranceShown(ent)) {
    const p = t().places
    return { text: p.hudOpen(p.hudNames[ent.id], formatTime(Math.ceil(ent.left))), kind: 'place', urgent: ent.left < 8 }
  }
  const s = g.endless
  if (!s) return null
  if (s.reaperId !== null) return { text: m.hudHunting, kind: 'reaper', urgent: true }
  const until = s.reaperAt - g.time
  if (until < 60) return { text: m.hudReaper(formatTime(Math.ceil(until))), kind: 'reaper', urgent: until < 10 }
  return { text: m.hudEndless(formatTime(overtime(g.time))), kind: 'endless', urgent: false }
}

/** Small status pill under the run timer for places, rifts and the endless mode. Part of the HUD. */
export const createRiftHud = () => {
  const el = h('div', { class: 'rift-pill box hidden' })
  let cls = ''
  const update = (g: Game) => {
    const pill = pillFor(g)
    const next = pill ? `rift-pill box rift-${pill.kind}${pill.urgent ? ' urgent' : ''}` : 'rift-pill box hidden'
    if (next !== cls) el.className = cls = next
    if (pill) setText(el, pill.text)
  }
  return { el, update }
}

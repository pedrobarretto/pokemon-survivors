import { playSfx } from '../engine/audio'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { h } from './dom'
import { mapGoodFor } from './screens'

/**
 * The run's map archetype on screen (`data/mapArchetypes.ts`): a wooden sign
 * like a landmark's (`ui/landmarks.ts`) slides in as the run starts, naming
 * the map, the places from the games it looks like and what it's good for.
 * The pause menu keeps it (`mapPanel` in `ui/screens.ts`).
 */

/** The runs whose sign was shown: once per run, whatever the game object (co-op swaps it on a heal). */
const announced = new WeakSet<object>()

/** Whether a game plays on an archetype's map: not an Arena match, the Dojo nor Hoopa's Rings (always the classic route). */
export const onArchetypeMap = (g: Game) => !g.versus && g.training === null && g.rush === null

/** Slides the map's sign in, once per `run`. */
export const announceMap = (root: HTMLElement, run: object, g: Game) => {
  if (announced.has(run) || !onArchetypeMap(g)) return
  announced.add(run)
  dropMapSign(root)
  const m = t().maps
  const id = g.terrain.archetype
  const sign = h('div', { class: 'landmark-sign map-sign', 'aria-live': 'polite' }, h('b', {}, m.names[id]), h('small', {}, m.flavor[id]), mapGoodFor(id))
  // Its slide ends hidden (`steps(1) both`): from then on it no longer holds the news back (`afterMapSign`).
  sign.addEventListener('animationend', () => sign.classList.add('done'), { once: true })
  root.append(sign)
  playSfx('select')
}

/**
 * Runs `show` once the map's sign is off the screen, at once when none is up:
 * a big line that comes as the run starts (an Ultra Wormhole's or a rift's
 * omen) waits its turn instead of landing over the sign.
 */
export const afterMapSign = (root: HTMLElement, show: () => void) => {
  const sign = root.querySelector<HTMLElement>(':scope > .map-sign:not(.done)')
  if (!sign) return show()
  let shown = false
  const once = () => {
    if (shown) return
    shown = true
    observer.disconnect()
    show()
  }
  sign.addEventListener('animationend', once, { once: true })
  // Taken down early (a landmark's sign, a new run): the line goes out then.
  const observer = new MutationObserver(() => {
    if (!sign.isConnected) once()
  })
  observer.observe(root, { childList: true })
}

/** Takes the map's sign down (a landmark's sign takes its place, a new run brings its own). */
export const dropMapSign = (root: HTMLElement) => root.querySelector(':scope > .map-sign')?.remove()

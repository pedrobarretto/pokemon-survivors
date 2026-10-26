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

/** Slides the map's sign in, once per `run`. */
export const announceMap = (root: HTMLElement, run: object, g: Game) => {
  if (announced.has(run)) return
  announced.add(run)
  dropMapSign(root)
  const m = t().maps
  const id = g.terrain.archetype
  root.append(h('div', { class: 'landmark-sign map-sign', 'aria-live': 'polite' }, h('b', {}, m.names[id]), h('small', {}, m.flavor[id]), mapGoodFor(id)))
  playSfx('select')
}

/** Takes the map's sign down (a landmark's sign takes its place, a new run brings its own). */
export const dropMapSign = (root: HTMLElement) => root.querySelector(':scope > .map-sign')?.remove()

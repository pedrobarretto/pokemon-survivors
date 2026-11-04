import type { Input } from '../engine/input'
import type { Screen } from './screens'

/**
 * Bibarel's carpentry sheet over the plaza's north-east (the furniture
 * catalog, `data/furniture.ts`). STUB: the secret bases PR
 * (`feat/realm-bases`) brings the real sheet with this signature; until it
 * lands, the lobby walks to Bibarel, hears its hello and comes straight back.
 */
export const openCarpentry = (_root: HTMLElement, _input: Input, close: () => void): Screen => {
  const el = document.createElement('div')
  queueMicrotask(close)
  return { el, dispose: () => el.remove() }
}

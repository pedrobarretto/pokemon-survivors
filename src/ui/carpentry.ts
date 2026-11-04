import type { Input } from '../engine/input'
import { h } from './dom'
import type { Screen } from './screens'

/** STUB (feat/realm-client): the bases PR (`feat/realm-bases`) replaces this with Bibarel's carpentry. */
export const openCarpentry = (root: HTMLElement, _input: Input, close: () => void): Screen => {
  const el = h('div', { class: 'screen dim' }, h('button', { class: 'box', type: 'button', onclick: close }, '← Carpentry (stub)'))
  root.append(el)
  return { el, dispose: () => el.remove() }
}

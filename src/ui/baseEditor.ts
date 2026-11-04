import type { Input } from '../engine/input'
import { h } from './dom'
import type { Screen } from './screens'

/** STUB (feat/realm-client): the bases PR (`feat/realm-bases`) replaces this with the grid editor. */
export const openBaseEditor = (root: HTMLElement, _input: Input, close: () => void): Screen => {
  const el = h('div', { class: 'screen dim' }, h('button', { class: 'box', type: 'button', onclick: close }, '← Base (stub)'))
  root.append(el)
  return { el, dispose: () => el.remove() }
}

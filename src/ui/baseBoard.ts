import type { Input } from '../engine/input'
import { h } from './dom'
import type { Screen } from './screens'

/** STUB (feat/realm-client): the bases PR (`feat/realm-bases`) replaces this with the trail's board of bases; `visit` walks into one. */
export const openBaseBoard = (root: HTMLElement, _input: Input, opts: { visit: (handle: string) => void; close: () => void }): Screen => {
  const el = h('div', { class: 'screen dim' }, h('button', { class: 'box', type: 'button', onclick: () => opts.visit('misty') }, '@misty (stub)'), h('button', { class: 'box', type: 'button', onclick: opts.close }, '←'))
  root.append(el)
  return { el, dispose: () => el.remove() }
}

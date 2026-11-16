import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { closeIcon } from '../render/art'
import { t } from '../i18n'
import { h, later } from './dom'
import type { Screen } from './screens'
import { nearestInDirection, type Direction } from './spatial'

/** A row in a lobby sheet: `icon`, a label, an optional line and whatever goes at the end (`extra`: a count, a prize); a `locked` one shows but only says no. */
export type SheetEntry = { icon: Node; label: string; sub?: string; extra?: Node | null; locked?: boolean; run: () => void }

const STEPS: Partial<Record<string, Direction>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' }

/**
 * The sheet the lobby opens for what has no room on screen (the Comunidade, a
 * phone's bottom tabs): a bottom sheet on phones, a centered panel elsewhere.
 * Arrows move, Enter presses, Esc, a tap outside or the ✕ close it. A press
 * closes the sheet first and runs the entry after the dispatch.
 */
export const lobbySheet = (root: HTMLElement, input: Input, opts: { title: string; entries: readonly SheetEntry[]; close: () => void }): Screen => {
  let at = 0
  let closed = false

  const dispose = () => {
    closed = true
    off()
    el.remove()
  }
  const close = () => {
    if (closed) return
    dispose()
    later(opts.close)
  }
  const pick = (entry: SheetEntry) => {
    if (closed) return
    if (entry.locked) return playSfx('denied')
    dispose()
    later(() => (opts.close(), entry.run()))
  }

  const rows = opts.entries.map((entry) =>
    h(
      'button',
      { class: entry.locked ? 'arc-card lobby-sheet-row locked' : 'arc-card lobby-sheet-row', type: 'button', 'aria-disabled': entry.locked && 'true', onclick: () => pick(entry) },
      entry.icon,
      h('span', { class: 'lobby-sheet-text' }, h('b', {}, entry.label), entry.sub ? h('small', {}, entry.sub) : null),
      entry.extra ?? null,
    ),
  )
  const paint = () => rows.forEach((row, i) => row.classList.toggle('arc-cursor', i === at))
  const closeButton = h('button', { class: 'arc-icon-btn', type: 'button', 'aria-label': t().shell.back, title: t().shell.back, onclick: () => (playSfx('select'), close()) }, h('img', { class: 'ink-icon', src: closeIcon(), alt: '' }))
  const panel = h(
    'div',
    { class: 'lobby-sheet-panel', role: 'dialog', 'aria-label': opts.title },
    h('header', { class: 'lobby-sheet-head' }, h('h2', { class: 'arc-outline' }, opts.title), closeButton),
    h('div', { class: 'lobby-sheet-rows' }, ...rows),
  )
  const el = h('div', { class: 'screen lobby-sheet' }, panel)
  el.addEventListener('click', (e) => e.target === el && (playSfx('select'), close()))

  const off = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace') return (playSfx('select'), close())
    if (key === 'Enter' || key === 'Space') return void rows[at]?.click()
    const dir = STEPS[key]
    if (!dir) return
    const next = nearestInDirection(rows.map((r) => r.getBoundingClientRect()), at, dir)
    if (next !== at) playSfx('move')
    at = next
    paint()
    rows[at]?.scrollIntoView({ block: 'nearest' })
  })

  paint()
  root.append(el)
  return { el, dispose, dim: 0 }
}

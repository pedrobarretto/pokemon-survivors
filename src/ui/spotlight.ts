import { playSfx } from '../engine/audio'
import type { Input, RawPress } from '../engine/input'
import type { Emotion, Speaker } from './dialogue'
import { h } from './dom'
import { uiDpr, uiZoom } from './uiScale'
import './spotlight.css'

/**
 * Coach marks: the screen dims around a hole on one element (rounded, pulsing),
 * and a guide's card (portrait, name, the line typed out, a step counter)
 * stands beside it, on the side with the most room, never over it, inside the
 * safe area. The hole and the card follow their element every frame, so a
 * layout rebuilt under them (a rotation, a sync) or a scroll never leaves them
 * drifting. A tap anywhere, Enter, Space or E (A on a pad) finishes the line,
 * then moves on; → and ← step, Esc or Backspace (B) and the skip button end
 * it. While it runs it takes every press: nothing under it hears one.
 */

/** One stop of the tour. */
export type CoachStop = {
  /** What it points at, asked every frame (a rebuilt layout is found again); null: nothing, the card stands in the middle. */
  target: () => HTMLElement | null
  line: string
  emotion?: Emotion
  /** Shown under the line (a moving picture); `tick` runs every frame while its stop shows. */
  extra?: { el: HTMLElement; tick: (time: number) => void }
}

/** How a tour ended: every stop read (`done`) or skipped, and the stop it ended on (1 is the first). */
export type CoachEnd = { how: 'done' | 'skipped'; stop: number }

export type CoachWords = { title: string; counter: (at: number, of: number) => string; next: string; done: string; skip: string }

/** Letters per second of the typewriter (the dialogue box's). */
const CPS = 45
/** Room around the element inside the hole, and between the hole and the card (CSS px). */
const PAD = 6
const GAP = 12
/** Portrait art px (SpriteCollab's), and about how tall it shows on big screens and on phones (CSS px). */
const PORTRAIT = { art: 40, wide: 56, narrow: 44 }
/** Frames without the screen it points into before the tour gives up (it was replaced under it). */
const GONE_FRAMES = 45

type Box = { left: number; top: number; right: number; bottom: number }
const SIDES = ['below', 'above', 'right', 'left'] as const
type Side = (typeof SIDES)[number]

const PAD_PRESS: Partial<Record<number, string>> = { 0: 'Enter', 1: 'Escape', 9: 'Enter', 14: 'ArrowLeft', 15: 'ArrowRight' }

/** A press as the key it means here: a pad's buttons as the keys they stand for. */
const keyOf = (press: RawPress) => (press.device === 'key' ? press.code : PAD_PRESS[press.button])

const sizePortrait = (img: HTMLElement) => {
  const dpr = uiDpr()
  const want = matchMedia('(max-width: 759px), (max-height: 500px)').matches ? PORTRAIT.narrow : PORTRAIT.wide
  const css = `${(PORTRAIT.art * Math.max(1, Math.round((want * dpr) / PORTRAIT.art))) / dpr}px`
  img.style.width = css
  img.style.height = css
  return img
}

/**
 * Slides a sideways row (Hoje's cards on a phone) until `el` shows, and only that row: the browser's
 * `scrollIntoView` would also nudge the screen around it, which then stays off by a few px.
 */
const reveal = (el: HTMLElement) => {
  for (let row = el.parentElement; row && !row.classList.contains('screen'); row = row.parentElement) {
    const { overflowX } = getComputedStyle(row)
    if ((overflowX !== 'auto' && overflowX !== 'scroll') || row.scrollWidth <= row.clientWidth) continue
    const r = el.getBoundingClientRect()
    const box = row.getBoundingClientRect()
    const by = r.left < box.left ? r.left - box.left : r.right > box.right ? r.right - box.right : 0
    if (by !== 0) row.scrollBy({ left: (by + Math.sign(by) * 8) / uiZoom(), behavior: 'smooth' })
    return
  }
}

/** A rectangle in `#ui`'s own px (its CSS zoom taken out). */
const localBox = (r: DOMRect, zoom: number): Box => ({ left: r.left / zoom, top: r.top / zoom, right: r.right / zoom, bottom: r.bottom / zoom })

/**
 * Where the card goes beside `hole` inside `safe`: on the side with the most
 * room left once it's there (a tall column gets it beside, a wide bar above or
 * below), held inside `safe` even if no side has the room and it then overlaps.
 * No hole: the middle.
 */
export const placeCard = (hole: Box | null, safe: Box, w: number, h: number): { x: number; y: number } => {
  const clampX = (x: number) => Math.max(safe.left, Math.min(safe.right - w, x))
  const clampY = (y: number) => Math.max(safe.top, Math.min(safe.bottom - h, y))
  if (!hole) return { x: clampX((safe.left + safe.right - w) / 2), y: clampY((safe.top + safe.bottom - h) / 2) }
  const room: Record<Side, number> = {
    below: safe.bottom - hole.bottom - GAP - h,
    above: hole.top - safe.top - GAP - h,
    right: safe.right - hole.right - GAP - w,
    left: hole.left - safe.left - GAP - w,
  }
  const side = SIDES.reduce((best, s) => (room[s] > room[best] ? s : best))
  const cx = (hole.left + hole.right - w) / 2
  const cy = (hole.top + hole.bottom - h) / 2
  if (side === 'below') return { x: clampX(cx), y: clampY(hole.bottom + GAP) }
  if (side === 'above') return { x: clampX(cx), y: clampY(hole.top - GAP - h) }
  if (side === 'right') return { x: clampX(hole.right + GAP), y: clampY(cy) }
  return { x: clampX(hole.left - GAP - w), y: clampY(cy) }
}

/** Starts the tour over `root`; `onEnd` runs once, as it ends or is skipped. `gone`: the screen it points into is no longer up (the tour ends, skipped). */
export const coachMarks = (
  root: HTMLElement,
  input: Input,
  opts: { speaker: Speaker; stops: readonly CoachStop[]; words: CoachWords; onEnd: (end: CoachEnd) => void; gone?: () => boolean },
) => {
  const { speaker, stops, words } = opts
  let at = 0
  let shown = 0
  let startedAt = performance.now()
  let ended = false
  let goneFor = 0
  let frame = 0
  /** Styles last written, to touch the page only when something moved. */
  let holeKey = ''
  let cardKey = ''
  /** Moves glide, but not the first placement nor a jump the card makes as it changes stop. */
  let glide = false

  const hole = h('div', { class: 'coach-hole hidden', 'aria-hidden': 'true' })
  const safe = h('div', { class: 'coach-safe', 'aria-hidden': 'true' })
  const portrait = h('span', { class: 'dialogue-portrait coach-portrait' })
  const count = h('span', { class: 'coach-count' })
  const typed = h('span', {})
  const rest = h('span', { class: 'dialogue-rest', 'aria-hidden': 'true' })
  const text = h('p', { class: 'coach-text', 'aria-live': 'polite' }, typed, rest)
  const extra = h('div', { class: 'coach-extra' })
  const skip = h('button', { class: 'coach-skip', type: 'button' }, h('span', {}, words.skip), h('span', { class: 'key-hint' }, 'ESC'))
  const nextLabel = h('span', { class: 'arc-outline' })
  const next = h('button', { class: 'arc-btn arc-btn-small coach-next', type: 'button' }, nextLabel, h('span', { class: 'key-hint' }, 'ENTER'))
  const name = h('b', { class: 'coach-name', style: `color:${speaker.color}` }, speaker.name)
  const card = h(
    'div',
    { class: 'arc-card coach-card' },
    h('div', { class: 'coach-head' }, portrait, h('div', { class: 'coach-body' }, h('div', { class: 'coach-who' }, name, count), text)),
    extra,
    h('div', { class: 'coach-foot' }, skip, next),
  )
  const layer = h('div', { class: 'coach-layer', role: 'dialog', 'aria-modal': 'true', 'aria-label': words.title }, hole, card, safe)

  const stop = () => stops[at]!
  const letters = () => [...stop().line]

  const paintText = () => {
    const all = letters()
    typed.textContent = all.slice(0, shown).join('')
    // The untyped rest keeps its room, so the card never grows as the line types.
    rest.textContent = all.slice(shown).join('')
  }

  /** Shows stop `i`: its counter, face and line (typed from nothing), its picture, and its element brought into view. */
  const show = (i: number) => {
    at = i
    const s = stop()
    count.textContent = words.counter(at + 1, stops.length)
    portrait.replaceChildren(sizePortrait(speaker.portrait(s.emotion ?? 'Normal')))
    nextLabel.textContent = at === stops.length - 1 ? words.done : words.next
    extra.replaceChildren(...(s.extra ? [s.extra.el] : []))
    extra.hidden = !s.extra
    shown = 0
    startedAt = performance.now()
    paintText()
    const target = s.target()
    if (target) reveal(target)
    glide = false
    layout()
  }

  const end = (how: CoachEnd['how']) => {
    if (ended) return
    ended = true
    dispose()
    opts.onEnd({ how, stop: at + 1 })
  }

  /** Finishes the line being typed, else goes to the next stop (or ends). */
  const advance = () => {
    const total = letters().length
    if (shown < total) {
      shown = total
      startedAt = -Infinity
      return paintText()
    }
    step(1)
  }

  const step = (by: 1 | -1) => {
    const to = at + by
    if (to < 0) return
    playSfx(by > 0 ? 'select' : 'move')
    if (to >= stops.length) return end('done')
    show(to)
  }

  const skipTour = () => {
    playSfx('select')
    end('skipped')
  }

  // The layer takes every tap: one on the lobby under it advances the tour instead.
  layer.addEventListener('click', advance)
  skip.addEventListener('click', (e) => (e.stopPropagation(), skipTour()))
  next.addEventListener('click', (e) => (e.stopPropagation(), step(1)))

  // Every key and button is the tour's: the screen under it hears none.
  const release = input.capture((press) => {
    const key = keyOf(press)
    if (key === 'Enter' || key === 'NumpadEnter' || key === 'Space' || key === 'KeyE') advance()
    else if (key === 'ArrowRight' || key === 'KeyD') step(1)
    else if (key === 'ArrowLeft' || key === 'KeyA') step(-1)
    else if (key === 'Escape' || key === 'Backspace') skipTour()
  })

  /** Measures the element, the safe area and the card, and moves the hole and the card where they belong. */
  function layout() {
    const zoom = uiZoom()
    const target = stop().target()
    const r = target?.getBoundingClientRect()
    const area = localBox(safe.getBoundingClientRect(), zoom)
    const box =
      r && r.width > 0 && r.height > 0
        ? {
            left: Math.max(0, r.left / zoom - PAD),
            top: Math.max(0, r.top / zoom - PAD),
            right: Math.min(window.innerWidth / zoom, r.right / zoom + PAD),
            bottom: Math.min(window.innerHeight / zoom, r.bottom / zoom + PAD),
          }
        : null
    const nextHole = box ? `${Math.round(box.left)},${Math.round(box.top)},${Math.round(box.right - box.left)},${Math.round(box.bottom - box.top)}` : 'none'
    if (nextHole !== holeKey) {
      holeKey = nextHole
      hole.classList.toggle('hidden', !box)
      layer.classList.toggle('coach-dim', !box)
      if (box) {
        hole.style.left = `${Math.round(box.left)}px`
        hole.style.top = `${Math.round(box.top)}px`
        hole.style.width = `${Math.round(box.right - box.left)}px`
        hole.style.height = `${Math.round(box.bottom - box.top)}px`
      }
    }
    const { x, y } = placeCard(box, area, card.offsetWidth, card.offsetHeight)
    const nextCard = `${Math.round(x)},${Math.round(y)}`
    if (nextCard !== cardKey) {
      cardKey = nextCard
      card.classList.toggle('coach-glide', glide)
      card.style.left = `${Math.round(x)}px`
      card.style.top = `${Math.round(y)}px`
    }
    layer.classList.toggle('coach-glide', glide)
    glide = true
  }

  const tick = (time: number) => {
    frame = requestAnimationFrame(tick)
    if (opts.gone?.()) {
      if (++goneFor >= GONE_FRAMES) end('skipped')
      return
    }
    goneFor = 0
    layout()
    stop().extra?.tick(time / 1000)
    const total = letters().length
    if (shown >= total) return
    const now = Math.min(total, Math.floor(((performance.now() - startedAt) / 1000) * CPS))
    if (now === shown) return
    if (now % 2 === 0) playSfx('talk', 50)
    shown = now
    paintText()
  }

  function dispose() {
    cancelAnimationFrame(frame)
    release()
    layer.remove()
  }

  root.append(layer)
  show(0)
  card.classList.add('pop')
  frame = requestAnimationFrame(tick)
  return { dispose: () => end('skipped') }
}

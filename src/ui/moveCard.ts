import { evolutionOf, evolvedFrom } from '../data/evolutions'
import { ITEMS } from '../data/items'
import { maxMoveLevel, MOVES, type MoveDef, type MoveId } from '../game/moves'
import { moveSheet, type SheetRow } from '../game/moveSheet'
import type { Game } from '../game/types'
import { formatDecimal, t } from '../i18n'
import { itemIcon, moveIcon } from '../render/art'
import { h } from './dom'
import { typeBadge } from './screens'

/** How long a finger rests on a move before its card opens. */
const HOLD_MS = 280
/** A finger that drifts further than this (px) is scrolling, not holding. */
const HOLD_SLOP = 10
/** Gap (px) between the card and what it describes, and from the screen edges. */
const GAP = 8
/** Room (px) kept around a fingertip, so it doesn't hide the card. */
const FINGER_GAP = 32

type CardOptions = {
  /** Level the card describes (a level-up offer shows the level it grants). */
  level: number
  /** Level the stats are compared with (a level-up upgrade shows what it adds). */
  from?: number
  /** Adds the move's description (the level-up cards already show it). */
  describe?: boolean
}

const formatRow = ({ stat, value }: Pick<SheetRow, 'stat' | 'value'>) => {
  const c = t().moveCard
  switch (stat) {
    case 'damage':
      return formatDecimal(value)
    case 'cooldown':
    case 'duration':
      return c.seconds(formatDecimal(value, 2))
    case 'area':
      return `×${formatDecimal(value, 2)}`
    case 'status':
      return `${Math.round(value * 100)}%`
    case 'amount':
    case 'pierce':
      return String(value)
  }
}

const rowLabel = (row: SheetRow, def: MoveDef) => {
  const m = t()
  if (row.stat === 'status') return def.status ? m.moveCard.status[def.status.kind] : ''
  return row.stat === 'pierce' ? m.moveCard.pierce : m.stats[row.stat]
}

/** "[Ember] Lv 8 + [Charcoal] → [Flamethrower]", each requirement lit once met. */
const evolutionLine = (g: Game, id: MoveId, level: number) => {
  const m = t()
  const from = evolvedFrom(id)
  if (from) {
    return h(
      'div',
      { class: 'card-evo' },
      h('span', { class: 'card-evo-label' }, m.moveCard.evolvedFrom),
      h('span', { class: 'card-req met' }, h('img', { src: moveIcon(from.from), alt: '' }), MOVES[from.from].name),
      '+',
      h('span', { class: 'card-req met' }, h('img', { src: itemIcon(from.item), alt: '' }), ITEMS[from.item].name),
    )
  }
  const evo = evolutionOf(id)
  if (!evo) return null
  const maxed = level >= maxMoveLevel(id)
  const held = g.player.items.some((i) => i.id === evo.item)
  return h(
    'div',
    { class: 'card-evo' },
    h('span', { class: 'card-evo-label' }, m.moveCard.evolves, maxed && held && h('b', {}, m.levelUp.ready)),
    h('span', { class: maxed ? 'card-req met' : 'card-req' }, m.level(maxMoveLevel(id))),
    '+',
    h('span', { class: held ? 'card-req met' : 'card-req' }, h('img', { src: itemIcon(evo.item), alt: '' }), ITEMS[evo.item].name),
    h('span', { class: 'card-evo-to' }, '→', h('span', { class: 'card-req to' }, h('img', { src: moveIcon(evo.to), alt: '' }), MOVES[evo.to].name)),
  )
}

/** The card's content: name, type, level, the stats with the player's modifiers and how the move evolves. */
export const moveCard = (g: Game, id: MoveId, { level, from, describe = false }: CardOptions) => {
  const m = t()
  const def: MoveDef = MOVES[id]
  const evolved = evolvedFrom(id) !== undefined
  return h(
    'div',
    { class: 'move-card box' },
    h(
      'div',
      { class: 'card-head' },
      h('img', { src: moveIcon(id), alt: '' }),
      h('div', { class: 'card-title' }, h('b', {}, def.name), h('span', { class: 'tag' }, evolved ? m.moveCard.evolved : m.moveCard.level(level, maxMoveLevel(id)))),
      typeBadge(def.type),
    ),
    describe && h('p', { class: 'card-desc' }, m.moves[id].description),
    h(
      'div',
      { class: 'card-stats' },
      ...moveSheet(id, level, g.player.stats, from).flatMap((row) => [
        h('span', {}, rowLabel(row, def)),
        h(
          'b',
          { class: row.before !== undefined ? 'up' : undefined },
          row.before !== undefined && h('s', {}, formatRow({ stat: row.stat, value: row.before })),
          row.before !== undefined && ' → ',
          formatRow(row),
        ),
      ]),
    ),
    evolutionLine(g, id, level),
  )
}

/* ---------------- The floating card ---------------- */

/** The one card on screen, if any, and the element it points at. */
let open: { card: HTMLElement; anchor: HTMLElement; frame: number } | null = null

/** Closes the card on screen. */
export const hideMoveCard = () => {
  if (!open) return
  cancelAnimationFrame(open.frame)
  open.card.remove()
  open = null
}

/** Where the card points: the anchor's box, or the fingertip on a touch hold (`below` is how far clear of it the card must stay). */
type Target = { top: number; bottom: number; left: number; right: number; below: number }

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(min, v), max)

/** Above the target, else below it, else beside it (landscape phones have no room either way), clamped to the screen. */
const place = (card: HTMLElement, t: Target) => {
  const w = card.offsetWidth
  const hgt = card.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight
  const centered = clamp((t.left + t.right) / 2 - w / 2, GAP, vw - GAP - w)
  const at = (x: number, y: number) => (card.style.transform = `translate(${Math.round(x)}px, ${Math.round(clamp(y, GAP, vh - GAP - hgt))}px)`)
  if (t.top - GAP - hgt >= GAP) return at(centered, t.top - GAP - hgt)
  if (t.bottom + t.below + hgt <= vh - GAP) return at(centered, t.bottom + t.below)
  const middle = (t.top + t.bottom) / 2 - hgt / 2
  if (t.right + t.below + w <= vw - GAP) return at(t.right + t.below, middle)
  if (t.left - t.below - w >= GAP) return at(t.left - t.below - w, middle)
  at(centered, t.bottom + t.below)
}

/**
 * Shows `card` by `anchor` (or by the fingertip at `finger`), until `hideMoveCard`
 * or the anchor leaves the screen (a menu closing, the HUD redrawing its slots).
 */
const show = (anchor: HTMLElement, card: HTMLElement, finger?: { x: number; y: number }) => {
  hideMoveCard()
  card.classList.add('floating')
  document.body.append(card)
  const r = anchor.getBoundingClientRect()
  place(
    card,
    finger
      ? { top: finger.y - FINGER_GAP, bottom: finger.y, left: finger.x, right: finger.x, below: FINGER_GAP }
      : { top: r.top, bottom: r.bottom, left: r.left, right: r.right, below: GAP },
  )
  const watch = () => {
    if (!open) return
    if (!anchor.isConnected || anchor.getClientRects().length === 0) return hideMoveCard()
    open.frame = requestAnimationFrame(watch)
  }
  open = { card, anchor, frame: requestAnimationFrame(watch) }
}

/**
 * Opens the card from `build` while the mouse is over `hover`, or while a
 * finger holds `press` (the whole level-up card is easier to hold than its icon).
 * A hold never counts as a tap: the click it ends with is swallowed before
 * the menu sees it, so attach this before `menu()` binds its clicks.
 */
export const withMoveCard = (press: HTMLElement, build: () => HTMLElement, hover: HTMLElement = press) => {
  hover.classList.add('has-card')
  hover.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && show(hover, build()))
  hover.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && open?.anchor === hover && hideMoveCard())

  let timer = 0
  let start = { x: 0, y: 0 }
  let held = false
  const release = () => {
    clearTimeout(timer)
    if (open?.anchor === press) hideMoveCard()
  }
  press.addEventListener('pointerdown', (e) => {
    held = false
    if (e.pointerType === 'mouse') return
    start = { x: e.clientX, y: e.clientY }
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      held = true
      show(press, build(), start)
    }, HOLD_MS)
  })
  press.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && !held && Math.hypot(e.clientX - start.x, e.clientY - start.y) > HOLD_SLOP) clearTimeout(timer)
  })
  press.addEventListener('pointerup', release)
  press.addEventListener('pointercancel', release)
  press.addEventListener(
    'click',
    (e) => {
      if (!held) return
      held = false
      e.preventDefault()
      e.stopImmediatePropagation()
    },
    { capture: true },
  )
  // Android opens a context menu on a long press.
  press.addEventListener('contextmenu', (e) => e.preventDefault())
}

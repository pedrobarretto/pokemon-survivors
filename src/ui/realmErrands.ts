import { isStampId, type StampId } from '../data/realmStamps'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { createCanvas, context2d } from '../engine/pixelart'
import { formatNumber, t } from '../i18n'
import type { ErrandView, RealmBook } from '../net/realmApi'
import { claimErrand, fetchBook, isFailure } from '../realm/api'
import { ERRANDS_BONUS } from '../realm/errands'
import { coinIcon } from '../render/art'
import { iconCanvas, stampArtReady, SHEET_ORDER } from '../render/stampArt'
import { h } from './dom'
import type { Screen } from './screens'
import { depositPokeDollars } from './save'
import { toast } from './toasts'
import './realmBook.css'

/**
 * The plaza's board (`board` spot): the day's three Recados
 * (`realm/errands.ts`) pinned up with how far along each is and its ₽, a
 * button to collect the finished ones (`claimErrand`: the ₽ lands like a
 * run's), and the town's notices it always showed.
 */

type SheetCell = (typeof SHEET_ORDER)[number]

/** A Recado's picture, by deed; a room is the map's, a line anything that talks. */
const ICON_OF: Readonly<Record<string, SheetCell>> = {
  'game:fishing': 'goneFishing',
  'game:berryCatch': 'flawless',
  'game:whackDiglett': 'dugtrioDay',
  'game:fourInRow': 'tableTalk',
  'game:typeDuel': 'perfectDuel',
  sit: 'benchWarmer',
  lagoon: 'wetFeet',
  'base:visit': 'neighbor',
  like: 'fanMail',
  say: 'hello',
  'emote:wave': 'hello',
  'emote:heart': 'fanMail',
}

export const errandIcon = (deed: string): SheetCell => ICON_OF[deed] ?? (deed.startsWith('room:') ? 'tourist' : 'errandRunner')

/** What a Recado asks, in the player's language. */
export const errandText = (deed: string, target: number) => {
  const tasks: Readonly<Record<string, (n: number) => string>> = t().realm.errands.tasks
  return Object.hasOwn(tasks, deed) ? tasks[deed]!(target) : t().realm.errands.other(target)
}

/** How many of a book's Recados are finished and waiting to be collected. */
export const errandsReady = (book: RealmBook) => book.errands.filter((e) => !e.claimed && e.progress >= e.target).length

const corkTile = (): string => {
  const c = createCanvas(16, 16)
  const ctx = context2d(c)
  ctx.fillStyle = '#c99a62'
  ctx.fillRect(0, 0, 16, 16)
  ctx.fillStyle = '#b5844c'
  for (const [x, y] of [[1, 2], [6, 0], [10, 4], [14, 1], [3, 7], [8, 9], [12, 11], [1, 13], [5, 14], [15, 9]] as const) ctx.fillRect(x, y, 1, 1)
  ctx.fillStyle = '#dcb07a'
  for (const [x, y] of [[4, 3], [9, 2], [13, 7], [2, 10], [7, 12], [11, 15]] as const) ctx.fillRect(x, y, 1, 1)
  return c.toDataURL()
}

export type ErrandsBoardOpts = {
  close: () => void
  /** A claim landed: how many are still waiting, and the stamps it earned (the day's last can). */
  claimed?: (ready: number, earned: readonly StampId[]) => void
}

export const openErrandsBoard = (root: HTMLElement, input: Input, opts: ErrandsBoardOpts): Screen => {
  const m = () => t().realm.errands
  const notes = h('div', { class: 'rboard-notes' })
  const bonus = h('p', { class: 'rboard-bonus' })
  const close = h('button', { class: 'rboard-close', type: 'button', 'aria-label': t().realm.trainer.close, onclick: () => opts.close() }, '×')
  const panel = h(
    'div',
    { class: 'rboard', style: `--cork:url(${corkTile()})` },
    h('header', { class: 'rboard-head' }, h('h2', {}, m().title), close),
    h('p', { class: 'rboard-hint' }, m().hint),
    notes,
    bonus,
    h('div', { class: 'rboard-paper' }, h('h3', {}, t().realm.board.title), ...t().realm.board.lines.map((line) => h('p', {}, line))),
  )
  const el = h('div', { class: 'screen rboard-screen' }, panel)
  root.append(el)

  let book: RealmBook | null = null
  let busy = false
  let closed = false

  /** One Recado's note: its picture, what it asks, pips for how far along, the ₽ and the button. */
  const note = (e: ErrandView, i: number) => {
    const done = e.progress >= e.target
    const button = h(
      'button',
      { class: `rboard-claim${e.claimed ? ' claimed' : ''}`, type: 'button', disabled: !done || e.claimed || busy, onclick: () => void claim(e) },
      e.claimed ? m().claimed : done ? m().claim : `${Math.min(e.progress, e.target)}/${e.target}`,
    )
    return h(
      'article',
      { class: `rboard-note${e.claimed ? ' claimed' : done ? ' ready' : ''}`, style: `--tilt:${i}` },
      h('span', { class: 'rboard-pin', 'aria-hidden': 'true' }),
      h('div', { class: 'rboard-icon' }, iconCanvas(errandIcon(e.deed))),
      h('p', { class: 'rboard-task' }, errandText(e.deed, e.target)),
      e.target > 1 ? h('div', { class: 'rboard-pips', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': e.target, 'aria-valuenow': Math.min(e.progress, e.target) }, ...Array.from({ length: e.target }, (_, n) => h('i', { class: n < e.progress ? 'on' : '' }))) : null,
      h('p', { class: 'rboard-pay' }, h('img', { src: coinIcon(1), alt: '' }), formatNumber(e.reward)),
      button,
    )
  }

  const render = () => {
    if (!book) return
    notes.replaceChildren(...book.errands.map(note))
    const claimed = book.errands.filter((e) => e.claimed).length
    bonus.replaceChildren(
      h('img', { src: coinIcon(2), alt: '' }),
      book.errands.length > 0 && claimed === book.errands.length ? m().bonusPaid(formatNumber(ERRANDS_BONUS)) : m().bonus(formatNumber(ERRANDS_BONUS)),
    )
  }

  const claim = async (e: ErrandView) => {
    if (busy || !book) return
    busy = true
    render()
    const before = new Set(book.stamps.map((s) => s.id))
    const res = await claimErrand(e.id)
    busy = false
    if (closed) return
    if (isFailure(res)) {
      render()
      return void toast(root, res.error === 'offline' ? m().offline : m().failed, 3000, 'realmErrands')
    }
    book = res.book
    if (res.coins > 0) depositPokeDollars(res.coins)
    playSfx('buy')
    toast(root, m().paid(formatNumber(res.coins)), 2400, 'realmErrands')
    render()
    opts.claimed?.(errandsReady(res.book), res.book.stamps.flatMap((s) => (!before.has(s.id) && isStampId(s.id) ? [s.id] : [])))
  }

  const load = async () => {
    notes.replaceChildren(h('p', { class: 'rboard-loading' }, m().loading))
    const [got] = await Promise.all([fetchBook(), stampArtReady()])
    if (closed) return
    if (!got) return void notes.replaceChildren(h('p', { class: 'rboard-loading' }, m().offline))
    book = got
    render()
  }

  void load()
  const off = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace') opts.close()
  })
  return { el, dispose: () => ((closed = true), off(), el.remove()) }
}

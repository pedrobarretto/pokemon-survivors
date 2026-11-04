import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { BASE_ROOM } from '../data/realmMap'
import { context2d } from '../engine/pixelart'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatNumber, t } from '../i18n'
import type { CityId } from '../net/realm'
import type { BaseCard, BaseView } from '../net/realmApi'
import { fetchBase, isFailure, likeBase, listBases, reportTrainer } from '../realm/api'
import { drawBaseRoom } from '../render/base'
import { portraitUrl } from '../render/sprites'
import { h, later, setText } from './dom'
import { confirmDialog, hint, type Screen } from './screens'

/**
 * The trail's board of secret bases (`openBaseBoard`): the public ones by
 * likes, the newest, and the friends' a player may enter (`listBases`), each
 * a card with its owner's partner, its look and counts, and Visitar, a like
 * (a second tap takes it back) and a report. In the realm, Visitar walks
 * into the base (`visit`, the relay's `go` to `base:<handle>`); anywhere
 * else (the dev hooks, a screen without a realm) it shows the base right on
 * the board. Laid out as the shop's sheet (`.shop-sheet`).
 */

const SORTS = ['top', 'new', 'friends'] as const
type Sort = (typeof SORTS)[number]

/** `visit`: walks into a base in the realm (null: the board shows it). `city`: where a report was made. */
export type BaseBoardOpts = { close: () => void; visit: ((handle: string) => void) | null; city: CityId | null }

const isPlayable = (id: string): id is PlayableId => Object.hasOwn(PLAYABLE, id)

/** A base owner's partner as a portrait (the first stage of its line), or a Poké Ball's stand-in for one the game doesn't know. */
const face = (partner: string, shiny: boolean) =>
  h('img', { class: 'base-card-face', src: isPlayable(partner) ? portraitUrl(PLAYABLE[partner].line[0].dex, shiny) : portraitUrl(25), alt: '', width: 40, height: 40 })

export const openBaseBoard = (root: HTMLElement, input: Input, opts: BaseBoardOpts): Screen => {
  const m = t().bases.board
  const el = h('div', { class: 'shop-layer base-board-layer' })
  root.append(el)

  let sort: Sort = 'top'
  let cards: BaseCard[] | null = null
  let failed = false
  /** The likes changed on this board, and whether this player likes it now (`listBases` doesn't say). */
  const liked = new Map<string, { likes: number; on: boolean }>()
  const reported = new Set<string>()
  let shown: { view: BaseView | null; handle: string; why: string | null } | null = null
  let sub: Screen | null = null
  let closed = false
  let asked = 0

  const tabs = SORTS.map((id) => h('button', { class: 'shop-tab base-board-tab', type: 'button', role: 'tab', onclick: () => switchSort(id) }, m.tabs[id]))
  const body = h('div', { class: 'base-board-body', tabIndex: -1 })
  const back = h('button', { class: 'btn shop-back', type: 'button', 'aria-label': t().mart.back, onclick: () => goBack() }, '◀', h('span', { class: 'shop-back-label' }, ` ${t().mart.back}`))
  const title = h('h2', { class: 'shop-title' }, m.title)
  const nav = h('nav', { class: 'shop-tabs', role: 'tablist' }, ...tabs)
  el.append(
    h(
      'section',
      { class: 'shop-sheet box base-board-sheet', 'aria-label': m.title },
      h('header', { class: 'shop-head' }, back, title),
      nav,
      body,
      h('footer', { class: 'shop-foot' }, hint(m.hintKeys, m.hintTouch)),
    ),
  )

  /* ---------- Cards ---------- */

  /** Likes a base, or takes the like back (`wasOn`: whether this player liked it before). */
  const like = async (handle: string, wasOn: boolean, button: HTMLElement) => {
    button.toggleAttribute('disabled', true)
    const done = await likeBase(handle)
    if (closed) return
    button.toggleAttribute('disabled', false)
    if (isFailure(done)) return playSfx('denied')
    const on = !wasOn
    playSfx(on ? 'select' : 'move')
    liked.set(handle, { likes: done.likes, on })
    if (shown?.view?.handle === handle) shown = { ...shown, view: { ...shown.view, likes: done.likes, liked: on } }
    paint()
  }

  const report = (handle: string) => {
    if (sub || reported.has(handle)) return
    sub = confirmDialog(
      root,
      input,
      m.reportConfirm(handle),
      (yes) => {
        sub?.dispose()
        sub = null
        if (!yes) return
        reported.add(handle)
        paint()
        void reportTrainer({ handle, reason: 'base', city: opts.city })
      },
      { class: 'shop-confirm' },
    )
  }

  const likeButton = (handle: string, likes: number, on: boolean) => {
    const b = h('button', { class: `btn base-like${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), title: on ? m.liked : m.like }, `♥ ${formatNumber(likes)}`)
    b.addEventListener('click', () => void like(handle, on, b))
    return b
  }

  const card = (c: BaseCard) => {
    const mine = liked.get(c.handle)
    const likes = mine?.likes ?? c.likes
    const flagged = reported.has(c.handle)
    return h(
      'article',
      { class: `base-card ${c.exterior}` },
      face(c.partner, c.shiny),
      h(
        'div',
        { class: 'base-card-info' },
        h('b', { class: 'base-card-handle' }, `@${c.handle}`),
        h('span', { class: 'base-card-place' }, t().bases.editor.exteriors[c.exterior]),
        h('span', { class: 'base-card-stats' }, `${m.visits(c.visits)} · ${m.items(c.items)}`),
      ),
      h(
        'div',
        { class: 'base-card-actions' },
        h('button', { class: 'btn confirm base-visit', type: 'button', onclick: () => visit(c.handle) }, m.visit),
        likeButton(c.handle, likes, mine?.on ?? false),
        h('button', { class: 'btn base-report', type: 'button', 'aria-label': m.report, title: flagged ? m.reported : m.report, disabled: flagged, onclick: () => report(c.handle) }, '⚑'),
      ),
    )
  }

  /* ---------- A base shown on the board ---------- */

  const canvas = h('canvas', { class: 'base-canvas base-preview-canvas', width: BASE_ROOM.w, height: BASE_ROOM.h })
  const ctx = context2d(canvas)
  let raf = 0
  const frame = (now: number) => {
    if (closed || !shown?.view) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawBaseRoom(ctx, shown.view, 0, 0, now / 1000)
    raf = requestAnimationFrame(frame)
  }

  const visit = (handle: string) => {
    playSfx('select')
    if (opts.visit) {
      const go = opts.visit
      dispose()
      return later(() => go(handle))
    }
    shown = { view: null, handle, why: null }
    paint()
    void fetchBase(handle).then((view) => {
      if (closed || shown?.handle !== handle) return
      shown = isFailure(view) ? { view: null, handle, why: view.status === 403 ? m.private : view.status === 404 ? m.missing : m.failed } : { view, handle, why: null }
      paint()
      if (shown.view) raf = requestAnimationFrame(frame)
    })
  }

  const showBase = () => {
    if (!shown) return
    const v = shown.view
    if (!v) return body.replaceChildren(h('p', { class: 'base-empty' }, shown.why ?? m.loading))
    const mine = liked.get(v.handle)
    body.replaceChildren(
      h(
        'div',
        { class: 'base-preview' },
        h('div', { class: 'base-preview-stage' }, canvas),
        h(
          'div',
          { class: 'base-preview-foot' },
          face(v.partner, v.shiny),
          h('span', { class: 'base-card-stats' }, m.visits(v.visits)),
          likeButton(v.handle, mine?.likes ?? v.likes, mine?.on ?? v.liked),
        ),
      ),
    )
  }

  /* ---------- Painting ---------- */

  const paint = () => {
    if (closed) return
    tabs.forEach((b, i) => {
      const on = SORTS[i] === sort
      b.classList.toggle('on', on)
      b.setAttribute('aria-selected', String(on))
    })
    nav.hidden = shown !== null
    setText(title, shown ? m.owner(shown.handle) : m.title)
    if (shown) return showBase()
    if (failed) return body.replaceChildren(h('p', { class: 'base-empty' }, m.failed))
    if (!cards) return body.replaceChildren(h('p', { class: 'base-empty' }, m.loading))
    body.replaceChildren(...(cards.length > 0 ? cards.map(card) : [h('p', { class: 'base-empty' }, m.empty[sort])]))
  }

  const load = () => {
    const ask = ++asked
    cards = null
    failed = false
    paint()
    void listBases(sort).then((list) => {
      if (closed || ask !== asked) return
      cards = list?.bases ?? null
      failed = list === null
      paint()
    })
  }

  function switchSort(id: Sort) {
    if (id === sort || shown) return
    playSfx('move')
    sort = id
    body.scrollTop = 0
    load()
  }

  function goBack() {
    if (sub) return
    if (shown) {
      playSfx('move')
      cancelAnimationFrame(raf)
      shown = null
      return paint()
    }
    playSfx('select')
    dispose()
    later(opts.close)
  }

  const off = input.onKey((key) => {
    if (closed || sub) return
    const at = SORTS.indexOf(sort)
    if (key === 'KeyQ' || key === 'ArrowLeft') switchSort(SORTS[(at + SORTS.length - 1) % SORTS.length]!)
    else if (key === 'KeyE' || key === 'ArrowRight') switchSort(SORTS[(at + 1) % SORTS.length]!)
    else if (key === 'ArrowUp' || key === 'ArrowDown') body.scrollBy({ top: key === 'ArrowUp' ? -80 : 80 })
    else if (key === 'Escape' || key === 'Backspace') goBack()
  })

  function dispose() {
    if (closed) return
    closed = true
    cancelAnimationFrame(raf)
    off()
    sub?.dispose()
    el.remove()
  }

  load()
  return { el, dispose }
}

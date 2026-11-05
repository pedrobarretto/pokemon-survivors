import { coinsFor, MINIGAMES, type MinigameId, type SoloGameId, type TableGameId } from '../../data/minigames'
import { playSfx } from '../../engine/audio'
import { t } from '../../i18n'
import type { RealmAct } from '../../net/realm'
import type { TableView } from '../../net/realmTables'
import { h } from '../../ui/dom'
import { depositPokeDollars } from '../../ui/save'
import type { Screen } from '../../ui/screens'
import { claimGame, isFailure } from '../api'
import { pieceName } from '../furniture'

/**
 * The Poké Realm's mini game frame: an overlay holding the game's canvas at
 * its own low resolution, scaled up by whole steps (pixel art, like the
 * world), with one pointer (mouse or a finger) and the keys mapped into it,
 * a close button and the end sheet (the score, the ₽ the API paid, the
 * trophies earned, play again). Every game, solo or at a table, draws
 * through it, so they all look and behave alike on a phone and a desktop.
 *
 * A game is plain functions over its own state (`SoloGame`, `TableUi`):
 * `step` with the frame's input, `draw` on the canvas. The frame runs its own
 * animation loop, so a game opens the same from the realm and from the dev
 * console (`ps.minigame(id)`).
 */

/** The pointer in the game's own pixels: where it is, whether it's down, and whether it went down or up this step. */
export type Pointer = { x: number; y: number; down: boolean; pressed: boolean; released: boolean }

/** What a game reads each step: the pointer and the keys (`KeyboardEvent.code`s), held or pressed this step. */
export type GameInput = { pointer: Pointer; held: (code: string) => boolean; pressed: (code: string) => boolean }

/** How a solo game ended: its score and the feats it hit (ids of its `feats`). */
export type SoloEnd = { score: number; feats: readonly string[] }

/** What the frame gives a solo game: the player's partner (to draw it), and a way to tell the room about a feat as it happens. */
export type SoloCtx = { partner: string; shiny: boolean; brag: (feat: string) => void }

/** A solo game in progress. `step`'s `dt` is in seconds (capped, so a hidden tab doesn't jump). */
export type GameRun = {
  step: (dt: number, input: GameInput) => void
  draw: (g: CanvasRenderingContext2D, time: number) => void
  /** Non-null once the game is over: the frame then claims it and shows the end sheet. */
  over: () => SoloEnd | null
  dispose?: () => void
}

/**
 * A solo game: its canvas size (whole px; pick one that fits a phone held
 * either way, about 240 × 200) and how to start a round.
 */
export type SoloGame = { size: { w: number; h: number }; start: (ctx: SoloCtx) => GameRun }

/**
 * Where a table's state comes from: the realm relay's table (sat at with
 * others) or a match against the bot on this device (`localTable`). `table`
 * is the latest view (null before the first), `seat` this player's seat in
 * it (null while only watching).
 */
export type TableSource = {
  vs: 'human' | 'bot'
  table: () => TableView | null
  seat: () => number | null
  play: (move: unknown) => void
  ready: () => void
  /** Called every frame (the local table moves its bot and its clock here). */
  frame: (now: number) => void
  /** Stands up and lets go of the table. */
  leave: () => void
}

/** What a table game's screen gets: the source of its table. */
export type TableCtx = { source: TableSource; partner: string; shiny: boolean }

/** A table game's screen in progress: the table drawn and played from `source.table()`, moves sent with `source.play`. */
export type TableRun = {
  step: (dt: number, input: GameInput) => void
  draw: (g: CanvasRenderingContext2D, time: number) => void
  dispose?: () => void
}

/**
 * A table game's screen: its canvas size, how to start it, and the feats a
 * finished match earned `seat` (ids of its `feats`), read from the table's
 * last view: claimed with the result and bragged to the room.
 */
export type TableUi = { size: { w: number; h: number }; start: (ctx: TableCtx) => TableRun; feats?: (table: TableView, seat: number) => readonly string[] }

/** What opening a game needs from where it opens (the realm, or the dev console). */
export type FrameOpts = {
  partner: string
  shiny: boolean
  /** Sends what the trainer is busy at and its brags to the room; null outside the realm. */
  realm: { act: (act: RealmAct | null) => void; brag: (game: MinigameId, feat: string) => void } | null
  close: () => void
}

/** Seconds a step may last at most. */
const MAX_DT = 0.05

/** The act a game shows its trainer busy at. */
const actOf = (game: MinigameId): RealmAct => (MINIGAMES[game].kind === 'table' ? 'table' : game === 'fishing' ? 'fishing' : 'arcade')

type Shell = {
  el: HTMLElement
  canvas: HTMLCanvasElement
  g: CanvasRenderingContext2D
  sheet: HTMLElement
  input: () => GameInput
  endStep: () => void
  dispose: () => void
}

/** The overlay, its canvas fitted to the screen by whole steps, and the input mapped into the game's pixels. */
const shell = (root: HTMLElement, game: MinigameId, size: { w: number; h: number }, close: () => void): Shell => {
  const m = t().minigames
  const canvas = h('canvas', { class: 'minigame-canvas', width: size.w, height: size.h })
  const sheet = h('div', { class: 'minigame-sheet box hidden' })
  const el = h(
    'div',
    { class: 'screen minigame-screen' },
    h('header', { class: 'minigame-head' }, h('h2', {}, m.games[game].name), h('button', { class: 'minigame-close box', type: 'button', 'aria-label': m.close, onclick: close }, '×')),
    h('div', { class: 'minigame-stage' }, canvas, sheet),
  )
  root.append(el)
  const g = canvas.getContext('2d')
  if (!g) throw new Error('no 2d context')
  g.imageSmoothingEnabled = false

  const fit = () => {
    const stage = canvas.parentElement
    if (!stage) return
    const s = Math.min(stage.clientWidth / size.w, stage.clientHeight / size.h)
    const scale = s >= 1 ? Math.floor(s) : s
    canvas.style.width = `${size.w * scale}px`
    canvas.style.height = `${size.h * scale}px`
  }
  const resize = new ResizeObserver(fit)
  resize.observe(el)
  fit()

  const pointer: Pointer = { x: -1, y: -1, down: false, pressed: false, released: false }
  const toGame = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    pointer.x = Math.floor(((e.clientX - r.left) / r.width) * size.w)
    pointer.y = Math.floor(((e.clientY - r.top) / r.height) * size.h)
  }
  const onDown = (e: PointerEvent) => {
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    toGame(e)
    pointer.down = true
    pointer.pressed = true
  }
  const onMove = (e: PointerEvent) => toGame(e)
  const onUp = (e: PointerEvent) => {
    toGame(e)
    if (pointer.down) pointer.released = true
    pointer.down = false
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  const held = new Set<string>()
  const pressed = new Set<string>()
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') return close()
    if (!held.has(e.code)) pressed.add(e.code)
    held.add(e.code)
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
  }
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.code)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  const input = (): GameInput => ({ pointer: { ...pointer }, held: (c) => held.has(c), pressed: (c) => pressed.has(c) })
  const endStep = () => {
    pointer.pressed = false
    pointer.released = false
    pressed.clear()
  }
  const dispose = () => {
    resize.disconnect()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    el.remove()
  }
  return { el, canvas, g, sheet, input, endStep, dispose }
}

/** Runs `frame(dt, now)` every animation frame until the returned stop. */
const loop = (frame: (dt: number, now: number) => void) => {
  let last = performance.now()
  let id = requestAnimationFrame(function tick(now) {
    frame(Math.min(MAX_DT, Math.max(0, (now - last) / 1000)), now)
    last = now
    id = requestAnimationFrame(tick)
  })
  return () => cancelAnimationFrame(id)
}

/**
 * Claims a finished game and fills the end sheet: the ₽ paid (added to the
 * wallet), the day's cap reached, the trophies earned, or that it couldn't
 * be paid now. A game that pays nothing as played (too short, or an outcome
 * that doesn't fit, `coinsFor`) isn't claimed: the sheet says it was too
 * short, as it does when the API refuses the outcome. `again` restarts,
 * `leave` closes.
 */
const endSheet = async (sheet: HTMLElement, headline: string, claim: Parameters<typeof claimGame>[0], again: () => void, leave: () => void) => {
  const m = t().minigames
  const paid = h('p', { class: 'minigame-paid' }, m.end.claiming)
  sheet.replaceChildren(
    h('h3', {}, headline),
    paid,
    h('div', { class: 'minigame-actions' }, h('button', { class: 'box', type: 'button', onclick: again }, m.end.again), h('button', { class: 'box', type: 'button', onclick: leave }, m.end.leave)),
  )
  sheet.classList.remove('hidden')
  if (coinsFor(claim.game, claim.outcome, claim.ms) === null) {
    paid.textContent = m.end.tooShort
    return
  }
  const res = await claimGame(claim)
  if (!sheet.isConnected) return
  if (isFailure(res)) {
    paid.textContent = res.status === 400 && res.error === 'outcome' ? m.end.tooShort : m.end.unpaid
    return
  }
  if (res.coins > 0) depositPokeDollars(res.coins)
  paid.textContent = res.coins > 0 ? m.end.paid(res.coins) : m.end.capped
  for (const id of res.trophies) paid.after(h('p', { class: 'minigame-trophy' }, m.end.trophy(pieceName(id))))
  if (res.trophies.length > 0) playSfx('select')
}

/** Opens a solo game in the frame: plays rounds until closed, claiming each finished one. */
export const openSoloGame = (root: HTMLElement, game: SoloGameId, def: SoloGame, opts: FrameOpts): Screen => {
  const m = t().minigames
  let stop = () => {}
  let closed = false
  /** Idempotent: the realm's own dispose may call it again. */
  const close = () => {
    if (closed) return
    closed = true
    stop()
    run?.dispose?.()
    opts.realm?.act(null)
    s.dispose()
    opts.close()
  }
  const s = shell(root, game, def.size, close)
  const ctx: SoloCtx = { partner: opts.partner, shiny: opts.shiny, brag: (feat) => opts.realm?.brag(game, feat) }
  let run: GameRun | null = null
  let startedAt = 0
  let ended = false
  let clock = 0
  const start = () => {
    run?.dispose?.()
    run = def.start(ctx)
    startedAt = performance.now()
    ended = false
    s.sheet.classList.add('hidden')
  }
  opts.realm?.act(actOf(game))
  start()
  stop = loop((dt) => {
    if (!run) return
    clock += dt
    if (!ended) run.step(dt, s.input())
    s.endStep()
    run.draw(s.g, clock)
    const end = ended ? null : run.over()
    if (end) {
      ended = true
      void endSheet(s.sheet, m.end.score(end.score), { game, outcome: { score: end.score }, ms: performance.now() - startedAt, feats: end.feats }, start, close)
    }
  })
  return { el: s.el, dispose: close }
}

/** Opens a table game's screen over a table source; a match this player sat through is claimed when it ends. */
export const openTableGame = (root: HTMLElement, game: TableGameId, ui: TableUi, source: TableSource, opts: FrameOpts): Screen => {
  const m = t().minigames
  let stop = () => {}
  let closed = false
  /** Idempotent: the realm's own dispose may call it again. */
  const close = () => {
    if (closed) return
    closed = true
    stop()
    run.dispose?.()
    source.leave()
    opts.realm?.act(null)
    s.dispose()
    opts.close()
  }
  const s = shell(root, game, ui.size, close)
  const run = ui.start({ source, partner: opts.partner, shiny: opts.shiny })
  opts.realm?.act(actOf(game))
  let clock = 0
  let phase: TableView['phase'] | null = null
  let startedAt = performance.now()
  stop = loop((dt, now) => {
    clock += dt
    source.frame(now)
    const table = source.table()
    const seat = source.seat()
    if (table && table.phase !== phase) {
      if (table.phase === 'playing') {
        startedAt = performance.now()
        s.sheet.classList.add('hidden')
      }
      if (table.phase === 'over' && phase === 'playing' && seat !== null && table.result) {
        const w = table.result.winner
        const result = w === null ? 'draw' : w === seat ? 'win' : 'loss'
        const feats = ui.feats?.(table, seat) ?? []
        for (const feat of feats) opts.realm?.brag(game, feat)
        void endSheet(s.sheet, m.end[result], { game, outcome: { result, vs: source.vs }, ms: performance.now() - startedAt, feats }, () => source.ready(), close)
      }
      phase = table.phase
    }
    run.step(dt, s.input())
    s.endStep()
    run.draw(s.g, clock)
  })
  return { el: s.el, dispose: close }
}

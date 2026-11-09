import { coinsFor, hasBoard, MINIGAMES, type MinigameId, type SoloGameId, type TableGameId } from '../../data/minigames'
import { playSfx } from '../../engine/audio'
import type { Input } from '../../engine/input'
import { t } from '../../i18n'
import type { BusyAct } from '../../net/realm'
import type { TableView } from '../../net/realmTables'
import { h } from '../../ui/dom'
import { depositPokeDollars } from '../../ui/save'
import type { Screen } from '../../ui/screens'
import { claimGame, isFailure } from '../api'
import { syncSave } from '../../account'
import { HATCHLING_IDS, HATCHLINGS } from '../../data/hatchlings'
import { openGameBoard } from './board'
import { pieceName } from '../furniture'

/**
 * The Poké Realm's mini game frame: an overlay holding the game's canvas at
 * its own low resolution, scaled up by whole device pixels (pixel art, like
 * the world), with one pointer (mouse or a finger) and the keys mapped into it,
 * a close button, the game's Placar (`board.ts`, from the header and the
 * end sheet) and the end sheet (the score, the ₽ the API paid, the trophies
 * earned, play again). Every game, solo or at a table, draws
 * through it, so they all look and behave alike on a phone and a desktop.
 *
 * A game is plain functions over its own state (`SoloGame`, `TableUi`):
 * `step` with the frame's input, `draw` on the canvas. The frame runs its own
 * animation loop, so a game opens the same from the realm and from the dev
 * console (`ps.minigame(id)`).
 */

/** The pointer in the game's own pixels: where it is, whether it's down, and whether it went down or up this step. */
export type Pointer = { x: number; y: number; down: boolean; pressed: boolean; released: boolean }

/**
 * What a game reads each step: the pointer, every finger (or the mouse)
 * pressed on the canvas now, oldest first (for on-screen pads held while
 * another finger moves), and the keys (`KeyboardEvent.code`s), held or
 * pressed this step.
 */
export type GameInput = { pointer: Pointer; pointers: readonly { x: number; y: number }[]; held: (code: string) => boolean; pressed: (code: string) => boolean }

/** A line of a solo game's log on the end sheet: an icon (an image URL, or null), what it was, how many and the points they made. */
export type LogLine = { icon: string | null; label: string; count: number; points: number }

/**
 * How a solo game ended: its score, the feats it hit (ids of its `feats`)
 * and, optionally, a log the end sheet lists under its title (what a round
 * of fishing caught).
 */
export type SoloEnd = { score: number; feats: readonly string[]; log?: { title: string; lines: readonly LogLine[] } }

/**
 * What the frame gives a solo game: the player's partner (to draw it), a way
 * to tell the room about a feat as it happens, the stage over its canvas (for
 * words the in-world font can't write) and what a scene of the shell needs
 * (a root over the game, and the input).
 */
export type SoloCtx = { partner: string; shiny: boolean; brag: (feat: string) => void; stage: HTMLElement; root: HTMLElement; input: Input }

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
 * either way, about 240 × 200) and how to start a round. `fluid` makes the
 * canvas follow the stage instead: given the stage's CSS size it answers the
 * size to use, asked again whenever the stage changes (a phone turned), and
 * the game lays itself out from its canvas every frame.
 */
export type SoloGame = { size: { w: number; h: number }; fluid?: (stageW: number, stageH: number) => { w: number; h: number }; start: (ctx: SoloCtx) => GameRun }

/**
 * Where a seat at a relay table stands, for the frame's word over the game
 * (`TableSource.lobby`): waiting for an opponent (it offers the bot
 * meanwhile), playing that bot, an opponent just sat down (back to the
 * table), watching a full table, or watching one with a seat free.
 */
export type TableLobby = 'opponent' | 'bot' | 'arrived' | 'watching' | 'seatFree'

/**
 * Where a table's state comes from: the realm relay's table (sat at with
 * others, `relayTable`) or a match against the bot on this device
 * (`localTable`). `table` is the latest view (null before the first), `seat`
 * this player's seat in it (null while only watching). A relay table also
 * says where its seat stands (`lobby`), plays the bot while it waits
 * (`playBot`) and sits down at a seat that frees up (`takeSeat`).
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
  lobby?: () => TableLobby | null
  playBot?: () => void
  takeSeat?: () => void
}

/** Who sits in a seat, as the table's screen draws them: the trainer's @handle and partner. */
export type Sitter = { handle: string; partner: string; shiny: boolean }

/**
 * What a table game's screen gets: the source of its table, the player's
 * partner, and who an avatar id of a seat is (null: unknown here, like the
 * local table's bot, whose ids are negative).
 */
export type TableCtx = { source: TableSource; partner: string; shiny: boolean; who: (avatar: number) => Sitter | null }

/** A table game's screen in progress: the table drawn and played from `source.table()`, moves sent with `source.play`. */
export type TableRun = {
  step: (dt: number, input: GameInput) => void
  draw: (g: CanvasRenderingContext2D, time: number) => void
  dispose?: () => void
}

/**
 * A table game's screen: its canvas size, how it starts, how long (s) its
 * end plays before the end sheet covers it (a winning line, a last reveal),
 * and the feats a finished match earned `seat` (ids of its `feats`), read
 * from the table's last view: claimed with the result and bragged to the room.
 */
export type TableUi = {
  size: { w: number; h: number }
  start: (ctx: TableCtx) => TableRun
  outro?: number
  feats?: (table: TableView, seat: number) => readonly string[]
}

/** What opening a game needs from where it opens (the realm, or the dev console). */
export type FrameOpts = {
  partner: string
  shiny: boolean
  /** Sends what the trainer is busy at and its brags to the room; null outside the realm. */
  realm: { act: (act: BusyAct | null) => void; brag: (game: MinigameId, feat: string) => void; who: (avatar: number) => Sitter | null } | null
  input: Input
  close: () => void
}

/** Seconds a step may last at most. */
const MAX_DT = 0.05

/** The act a game shows its trainer busy at. */
const actOf = (game: MinigameId): BusyAct => (MINIGAMES[game].kind === 'table' ? 'table' : game === 'fishing' ? 'fishing' : 'arcade')

type Shell = {
  el: HTMLElement
  stage: HTMLElement
  canvas: HTMLCanvasElement
  g: CanvasRenderingContext2D
  sheet: HTMLElement
  input: () => GameInput
  endStep: () => void
  /** Opens the game's Placar over the frame (`after` first: a claim on its way, so the board shows it). */
  board: (after?: Promise<unknown>) => void
  /** Whether the Placar covers the game now (a solo game holds still under it). */
  covered: () => boolean
  dispose: () => void
}

/** The overlay, its canvas fitted to the screen by whole device pixels, and the input mapped into the game's pixels. */
const shell = (root: HTMLElement, game: MinigameId, size: { w: number; h: number }, close: () => void, fluid?: SoloGame['fluid']): Shell => {
  const m = t().minigames
  const canvas = h('canvas', { class: 'minigame-canvas', width: size.w, height: size.h })
  const sheet = h('div', { class: 'minigame-sheet box hidden' })
  const stage = h('div', { class: 'minigame-stage' }, canvas, sheet)
  let boardOpen: Screen | null = null
  const board = (after?: Promise<unknown>) => {
    if (boardOpen) return
    playSfx('select')
    boardOpen = { el: h('div'), dispose: () => {} }
    void (after ?? Promise.resolve()).then(() => {
      if (!el.isConnected) return void (boardOpen = null)
      boardOpen = openGameBoard(root, [game], { close: () => (boardOpen = null) })
    })
  }
  const el = h(
    'div',
    { class: 'screen minigame-screen' },
    h(
      'header',
      { class: 'minigame-head' },
      h('h2', {}, m.games[game].name),
      hasBoard(game) && h('button', { class: 'minigame-board box', type: 'button', onclick: () => board() }, m.board.open),
      h('button', { class: 'minigame-close box', type: 'button', 'aria-label': m.close, onclick: close }, '×'),
    ),
    stage,
  )
  root.append(el)
  const g = canvas.getContext('2d')
  if (!g) throw new Error('no 2d context')
  g.imageSmoothingEnabled = false

  const fit = () => {
    const stage = canvas.parentElement
    if (!stage) return
    const wanted = fluid?.(stage.clientWidth, stage.clientHeight)
    if (wanted && (wanted.w !== size.w || wanted.h !== size.h)) {
      size.w = canvas.width = wanted.w
      size.h = canvas.height = wanted.h
      g.imageSmoothingEnabled = false
    }
    // Whole device pixels per game pixel, so a phone's 1.9 is ×5/3 on a 3× screen rather than ×1.
    const s = Math.min(stage.clientWidth / size.w, stage.clientHeight / size.h)
    const dpr = window.devicePixelRatio || 1
    const scale = s * dpr >= 1 ? Math.floor(s * dpr) / dpr : s
    canvas.style.width = `${size.w * scale}px`
    canvas.style.height = `${size.h * scale}px`
  }
  const resize = new ResizeObserver(fit)
  resize.observe(el)
  fit()

  const pointer: Pointer = { x: -1, y: -1, down: false, pressed: false, released: false }
  /** The pointers pressed now, by id, in the order they went down. */
  const pressing = new Map<number, { x: number; y: number }>()
  const toGame = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    pointer.x = Math.floor(((e.clientX - r.left) / r.width) * size.w)
    pointer.y = Math.floor(((e.clientY - r.top) / r.height) * size.h)
    if (pressing.has(e.pointerId)) pressing.set(e.pointerId, { x: pointer.x, y: pointer.y })
  }
  const onDown = (e: PointerEvent) => {
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    pressing.set(e.pointerId, { x: 0, y: 0 })
    toGame(e)
    pointer.down = true
    pointer.pressed = true
  }
  const onMove = (e: PointerEvent) => toGame(e)
  const onUp = (e: PointerEvent) => {
    toGame(e)
    pressing.delete(e.pointerId)
    if (pointer.down && pressing.size === 0) pointer.released = true
    pointer.down = pressing.size > 0
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

  const input = (): GameInput => ({ pointer: { ...pointer }, pointers: [...pressing.values()], held: (c) => held.has(c), pressed: (c) => pressed.has(c) })
  const endStep = () => {
    pointer.pressed = false
    pointer.released = false
    pressed.clear()
  }
  const dispose = () => {
    boardOpen?.dispose()
    resize.disconnect()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    el.remove()
  }
  return { el, stage, canvas, g, sheet, input, endStep, board, covered: () => boardOpen !== null, dispose }
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

/** A solo game's log as the end sheet lists it: icon, name, how many, points. */
const logList = (log: NonNullable<SoloEnd['log']>) =>
  h(
    'div',
    { class: 'minigame-log' },
    h('h4', {}, log.title),
    h(
      'ul',
      {},
      ...log.lines.map((l) =>
        h('li', {}, l.icon ? h('img', { src: l.icon, alt: '', width: 24, height: 24 }) : h('span', {}), h('span', { class: 'minigame-log-name' }, l.label), h('span', {}, `×${l.count}`), h('b', {}, `${l.points}`)),
      ),
    ),
  )

/**
 * Claims a finished game and fills the end sheet: the ₽ paid (added to the
 * wallet), the day's cap reached, the trophies earned, or that it couldn't
 * be paid now. A game that pays nothing as played (too short, or an outcome
 * that doesn't fit, `coinsFor`) isn't claimed: the sheet says it was too
 * short, as it does when the API refuses the outcome. `again` restarts,
 * `leave` closes.
 */
const endSheet = async (s: Shell, headline: string, claim: Parameters<typeof claimGame>[0] | null, again: () => void, leave: () => void, log?: SoloEnd['log']) => {
  const m = t().minigames
  const sheet = s.sheet
  const paid = h('p', { class: 'minigame-paid' }, m.end.claiming)
  /** The claim on its way: "Ver placar" waits for it, so the board shows this game. */
  let claimed: Promise<unknown> = Promise.resolve()
  sheet.replaceChildren(
    h('h3', {}, headline),
    ...(log && log.lines.length > 0 ? [logList(log)] : []),
    paid,
    h('div', { class: 'minigame-actions' }, h('button', { class: 'box', type: 'button', onclick: again }, m.end.again), h('button', { class: 'box', type: 'button', onclick: leave }, m.end.leave)),
    h('button', { class: 'minigame-see-board', type: 'button', onclick: () => s.board(claimed) }, m.board.see),
  )
  sheet.classList.remove('hidden')
  if (claim === null) {
    paid.textContent = m.end.forfeit
    return
  }
  if (coinsFor(claim.game, claim.outcome, claim.ms) === null) {
    paid.textContent = m.end.tooShort
    return
  }
  const asked = claimGame(claim)
  claimed = asked
  const res = await asked
  if (!sheet.isConnected) return
  if (isFailure(res)) {
    paid.textContent = res.status === 400 && res.error === 'outcome' ? m.end.tooShort : m.end.unpaid
    return
  }
  if (res.coins > 0) depositPokeDollars(res.coins)
  paid.textContent = res.coins > 0 ? m.end.paid(res.coins) : m.end.capped
  for (const id of res.trophies) paid.after(h('p', { class: 'minigame-trophy' }, m.end.trophy(pieceName(id))))
  if (res.trophies.length > 0) playSfx('select')
  // A family comes as a gift from the API: a sync brings it to the lobby's box.
  const family = HATCHLING_IDS.find((id) => id === res.family)
  if (family) {
    paid.after(h('p', { class: 'minigame-trophy' }, t().seasonUnlocks.fishingFamily(HATCHLINGS[family].name)))
    playSfx('unlock')
    void syncSave()
  }
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
  const s = shell(root, game, { ...def.size }, close, def.fluid)
  const ctx: SoloCtx = { partner: opts.partner, shiny: opts.shiny, brag: (feat) => opts.realm?.brag(game, feat), stage: s.stage, root: s.el, input: opts.input }
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
    // Under the Placar a round holds still (its clock too), so a look at the board costs nothing.
    if (s.covered()) return void s.endStep()
    if (!ended) run.step(dt, s.input())
    s.endStep()
    run.draw(s.g, clock)
    const end = ended ? null : run.over()
    if (end) {
      ended = true
      void endSheet(s, m.end.score(end.score), { game, outcome: { score: end.score }, ms: performance.now() - startedAt, feats: end.feats }, start, close, end.log)
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
    clearTimeout(outro)
    run.dispose?.()
    source.leave()
    opts.realm?.act(null)
    s.dispose()
    opts.close()
  }
  const s = shell(root, game, ui.size, close)
  const run = ui.start({ source, partner: opts.partner, shiny: opts.shiny, who: (id) => opts.realm?.who(id) ?? null })
  const lobby = lobbyBar(s, source)
  opts.realm?.act(actOf(game))
  let clock = 0
  let phase: TableView['phase'] | null = null
  let startedAt = performance.now()
  /** The end sheet waiting for the game's outro. */
  let outro: ReturnType<typeof setTimeout> | undefined
  stop = loop((dt, now) => {
    clock += dt
    source.frame(now)
    const table = source.table()
    const seat = source.seat()
    if (table && table.phase !== phase) {
      if (table.phase === 'playing') {
        startedAt = performance.now()
        clearTimeout(outro)
        s.sheet.classList.add('hidden')
      }
      if (table.phase === 'over' && phase === 'playing' && seat !== null && table.result) {
        const w = table.result.winner
        const result = w === null ? 'draw' : w === seat ? 'win' : 'loss'
        // Again: ready for the next match (a person's table may wait for the other's ready: the game says so).
        const again = () => (source.ready(), s.sheet.classList.add('hidden'))
        const feats = ui.feats?.(table, seat) ?? []
        for (const feat of feats) opts.realm?.brag(game, feat)
        // A match this seat forfeited (its clock ran out, it stood up) pays nothing: idling at a table isn't playing.
        const claim: Parameters<typeof claimGame>[0] | null = table.result.forfeit === seat ? null : { game, outcome: { result, vs: source.vs }, ms: performance.now() - startedAt, feats }
        outro = setTimeout(() => void endSheet(s, m.end[result], claim, again, close), (ui.outro ?? 0) * 1000)
      }
      phase = table.phase
    }
    lobby()
    run.step(dt, s.input())
    s.endStep()
    run.draw(s.g, clock)
  })
  return { el: s.el, dispose: close }
}

/**
 * The word over a relay table's game (`TableSource.lobby`), kept in step
 * every frame: a card over the game while the seat waits for an opponent
 * (with the bot meanwhile), and a slim tag in the header while the bot plays,
 * a trainer only watches (with a free seat to take) or an opponent just sat.
 */
const lobbyBar = (shell: Shell, source: TableSource) => {
  const m = t().minigames.tables
  const card = h('div', { class: 'minigame-lobby box hidden' })
  const tag = h('div', { class: 'minigame-tag hidden' })
  shell.sheet.before(card)
  shell.el.querySelector('.minigame-board')?.before(tag)
  let shown: TableLobby | null = null
  const button = (text: string, act: (() => void) | undefined) => h('button', { class: 'box', type: 'button', onclick: () => (playSfx('select'), act?.()) }, text)
  return () => {
    const now = source.lobby?.() ?? null
    if (now === shown) return
    shown = now
    if (now === 'arrived') playSfx('select')
    card.classList.toggle('hidden', now !== 'opponent')
    if (now === 'opponent') card.replaceChildren(h('b', {}, m.waiting), h('small', {}, m.waitingHint), button(m.playBot, source.playBot))
    tag.className = now && now !== 'opponent' ? `minigame-tag minigame-tag-${now} box` : 'minigame-tag hidden'
    tag.replaceChildren(
      ...(now === 'bot' ? [m.botMeanwhile] : now === 'arrived' ? [m.arrived] : now === 'watching' ? [m.watching] : now === 'seatFree' ? [m.watching, button(m.takeSeat, source.takeSeat)] : []),
    )
  }
}

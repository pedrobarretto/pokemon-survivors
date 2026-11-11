import { playSfx } from '../../engine/audio'
import { formatNumber, t } from '../../i18n'
import type { CornerState, CornerSweep } from '../../net/realmApi'
import { SWEEP_ART, tokenIcon } from '../../render/cornerArt'
import { h } from '../../ui/dom'
import { isFailure } from '../api'
import { bankSweep, dealSweep, fetchCorner, flipTile } from '../cornerApi'
import { arcadeSize, burst, drawFx, drawText, plate, stepFx, type Particle, type Popup } from './arcadeKit'
import { CORNER, SWEEP, sweepPay, type Tile } from './corner.rules'
import type { GameInput, GameRun, SoloCtx, SoloGame } from './frame'
import { callout, gameSheet, sheetTitle } from './gameSheet'

/**
 * Koffing Sweep (`MINIGAMES.sweep`), the Rocket Game Corner's table game: a
 * 5 × 5 board of cards hiding coin piles and Koffing, each row and column
 * telling its coins and its Koffing. The API deals the board and turns each
 * card (`cornerApi.ts`, `corner.rules.ts`): a client never knows a card it
 * hasn't flipped. Words live in the kit's sheet; the canvas only counts.
 *
 * Touch: tap a card to flip it; with Mark on, a tap marks it as a Koffing
 * instead. Keys: arrows to move, Space or Enter to flip, M to mark.
 */

const SIZES = { tall: { w: 176, h: 256 }, wide: { w: 300, h: 160 } } as const

const N = SWEEP.size
const CARD = 22
const GAP = 2

const DARK = '#140810'
const FELT = '#1c6038'
const FELT_HI = '#2a7848'
const GOLD = '#f8c838'

/** A Koffing face for the hints and a turned Koffing card: our own little gas ball. */
const KOFFING = ['...1111...', '..122221..', '.12222221.', '1223223221', '1224224221', '1222222221', '1222552221', '.12222221.', '..122221..', '...1111...']
/** The hints' little Koffing. */
const MINI = ['.111.', '12221', '13231', '12221', '.111.']
const KOFFING_PAL: Record<string, string> = { 1: '#381848', 2: '#9068b0', 3: '#ffffff', 4: '#201020', 5: '#e0d070' }

const SIZE = () => arcadeSize(SIZES.tall, SIZES.wide)
let shown: { w: number; h: number } = SIZE()

const layoutOf = ({ w, h: ch }: { w: number; h: number }) => {
  const tall = ch > w
  const step = CARD + GAP
  const board = tall ? { x: 8, y: 8 } : { x: 8, y: 8 }
  return { tall, step, board, hintCol: { x: board.x + N * step, y: board.y }, hintRow: { x: board.x, y: board.y + N * step }, pot: tall ? { x: 8, y: 158 } : { x: 166, y: 8 } }
}

const start = (ctx: SoloCtx): GameRun => {
  const size = shown
  const L = layoutOf(size)
  const m = () => t().rocket.sweep
  const c = () => t().rocket.corner
  const sheet = gameSheet(ctx.stage, size, L.tall ? { x: 176, y: 186, hug: true } : { x: 164, y: 160 })
  const say = sheet.show

  let state: CornerState | null = null
  let board: CornerSweep | null = null
  let busy = false
  let marking = false
  let disposed = false
  let clock = 0
  let cursor = 12
  let lastPaid = 0
  const marks = new Set<number>()
  /** When each card turned (clock), for its flip. */
  const turned = new Map<number, number>()
  const parts: Particle[] = []
  const pops: Popup[] = []

  const face = (at: number): Tile | null => board?.flipped.find((f) => f.at === at)?.tile ?? null

  const tokensLine = () => h('p', { class: 'mg-lead corner-tokens' }, h('img', { src: tokenIcon(), alt: '', width: 14, height: 14 }), ` ${c().balance(formatNumber(state?.tokens ?? 0))} · ${m().roundsLeft(formatNumber(Math.max(0, CORNER.roundsDaily - (state?.rounds ?? 0))))}`)

  const payNow = () => (board ? sweepPay(board.pot, board.level, false) : 0)

  const playing = () => {
    if (!board) return
    // Upright the banner sits under the table; sideways the dock stands beside it, the tokens with it.
    say(L.tall ? 'banner' : 'dock', [h('p', { class: 'mg-lead' }, `${m().level(board.level)} · ${m().payout(formatNumber(payNow()))}`), !L.tall && tokensLine()], [
      { label: marking ? `✓ ${m().mark}` : m().mark, run: () => ((marking = !marking), playing()) },
      { label: m().bank, run: bank, primary: true },
    ])
  }

  const between = (lead: HTMLElement) =>
    say('dock', [sheetTitle(m().name, c().name), lead, h('p', { class: 'mg-small' }, m().rule), tokensLine()], [{ label: m().again, run: deal, primary: true }])

  const trouble = (error: string) => {
    busy = false
    const e = c().errors
    between(callout(error === 'cap' ? e.cap : error === 'profile' ? e.profile : error === 'offline' || error === 'guest' ? e.guest : e.failed))
  }

  const take = (sweep: CornerSweep) => {
    for (const f of sweep.flipped) if (!turned.has(f.at)) turned.set(f.at, clock)
    board = sweep
  }

  const load = async () => {
    const got = await fetchCorner()
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    state = got
    if (got.sweep) {
      take(got.sweep)
      playing()
    } else between(h('p', { class: 'mg-lead' }, m().blurb))
  }

  const deal = async () => {
    if (busy) return
    busy = true
    sheet.hide()
    const got = await dealSweep()
    if (disposed) return
    busy = false
    if (isFailure(got)) return trouble(got.error)
    turned.clear()
    marks.clear()
    marking = false
    take(got.sweep)
    if (state) state = { ...state, tokens: got.tokens, won: got.won, rounds: got.rounds, level: got.level }
    playSfx('select')
    playing()
  }

  const ended = (paid: number) => {
    if (!board) return
    lastPaid = paid
    const cx = L.board.x + (N * L.step) / 2
    const cy = L.board.y + (N * L.step) / 2
    if (board.over === 'koffing') {
      playSfx('hit')
      burst(parts, cx, cy, ['#9068b0', '#c0a8d8', '#584070'], 40, 70, -40)
      between(callout(m().boom))
    } else {
      playSfx(board.over === 'clear' ? 'unlock' : 'item')
      burst(parts, cx, cy, [GOLD, '#ffffff', '#e84040'], board.over === 'clear' ? 50 : 24, 90)
      pops.push({ x: cx, y: cy, text: `+${paid}`, color: GOLD, age: 0, big: board.over === 'clear' })
      if (board.over === 'clear' && board.level >= SWEEP.levels.length) ctx.brag('level5')
      between(h('p', { class: 'mg-lead hot' }, board.over === 'clear' ? `${m().clear} ${m().banked(formatNumber(paid))}` : m().banked(formatNumber(paid))))
    }
  }

  const flip = async (at: number) => {
    if (!board || board.over || busy || face(at) !== null) return
    if (marking) {
      if (marks.has(at)) marks.delete(at)
      else marks.add(at)
      playSfx('move')
      return
    }
    busy = true
    const got = await flipTile(board.id, at)
    if (disposed) return
    busy = false
    if (isFailure(got)) return trouble(got.error)
    take(got.sweep)
    if (state) state = { ...state, tokens: got.tokens, won: got.won, level: got.level }
    const tile = face(at)
    if (tile !== null && tile > 1 && !got.sweep.over) playSfx('coin')
    if (got.sweep.over) ended(got.paid)
    else {
      if (tile === 1) playSfx('select')
      playing()
    }
  }

  const bank = async () => {
    if (!board || board.over || busy) return
    busy = true
    const got = await bankSweep(board.id)
    if (disposed) return
    busy = false
    if (isFailure(got)) return trouble(got.error)
    take(got.sweep)
    if (state) state = { ...state, tokens: got.tokens, won: got.won, level: got.level }
    ended(got.paid)
  }

  const cardAt = (x: number, y: number) => {
    const cx = Math.floor((x - L.board.x) / L.step)
    const cy = Math.floor((y - L.board.y) / L.step)
    return cx >= 0 && cy >= 0 && cx < N && cy < N ? cy * N + cx : null
  }

  const step = (dt: number, input: GameInput) => {
    clock += dt
    stepFx(parts, pops, dt)
    const p = input.pointer
    if (p.pressed) {
      const at = cardAt(p.x, p.y)
      if (at !== null) {
        cursor = at
        void flip(at)
      }
    }
    const move = (dx: number, dy: number) => {
      const x = Math.min(N - 1, Math.max(0, (cursor % N) + dx))
      const y = Math.min(N - 1, Math.max(0, Math.floor(cursor / N) + dy))
      cursor = y * N + x
    }
    if (input.pressed('ArrowLeft') || input.pressed('KeyA')) move(-1, 0)
    if (input.pressed('ArrowRight') || input.pressed('KeyD')) move(1, 0)
    if (input.pressed('ArrowUp') || input.pressed('KeyW')) move(0, -1)
    if (input.pressed('ArrowDown') || input.pressed('KeyS')) move(0, 1)
    if (input.pressed('Space') || input.pressed('Enter')) {
      if (board && !board.over) void flip(cursor)
      else if (!busy) void deal()
    }
    if (input.pressed('KeyM') && board && !board.over) {
      marking = !marking
      playing()
    }
  }

  /* ---------- Drawing ---------- */

  const koffing = (g: CanvasRenderingContext2D, x: number, y: number) => {
    for (let r = 0; r < KOFFING.length; r++)
      for (let k = 0; k < KOFFING[r]!.length; k++) {
        const ch = KOFFING[r]![k]!
        if (ch === '.') continue
        g.fillStyle = KOFFING_PAL[ch]!
        g.fillRect(x + k, y + r, 1, 1)
      }
  }

  const coins = (g: CanvasRenderingContext2D, n: number, x: number, y: number) => {
    const art = SWEEP_ART.coin()
    for (let i = 0; i < n; i++) g.drawImage(art, x + 8 - (n - 1) * 3 + i * 6 - 2, y + 6 + (i % 2 === 0 ? 0 : -2))
  }

  const drawCard = (g: CanvasRenderingContext2D, at: number) => {
    const x = L.board.x + (at % N) * L.step
    const y = L.board.y + Math.floor(at / N) * L.step
    const tile = face(at)
    const since = clock - (turned.get(at) ?? -9)
    // A card turning: it narrows to its edge, then opens on its face.
    const k = tile === null ? 1 : Math.min(1, since / 0.18)
    const w = Math.max(2, Math.round(CARD * Math.abs(1 - 2 * Math.min(1, k))))
    const showFace = tile !== null && k >= 0.5
    const left = x + Math.round((CARD - w) / 2)
    g.fillStyle = DARK
    g.fillRect(left, y, w, CARD)
    if (!showFace) {
      g.fillStyle = '#c02028'
      g.fillRect(left + 1, y + 1, w - 2, CARD - 2)
      if (w >= CARD - 1) g.drawImage(SWEEP_ART.back(), x + 3, y + 4)
      if (marks.has(at)) {
        g.fillStyle = 'rgba(20,8,16,0.55)'
        g.fillRect(x + 1, y + 1, CARD - 2, CARD - 2)
        koffing(g, x + 6, y + 6)
      }
    } else {
      const boom = tile === 0
      g.fillStyle = boom ? '#3a2048' : '#f4ecd8'
      g.fillRect(left + 1, y + 1, w - 2, CARD - 2)
      if (w >= CARD - 1) {
        if (boom) koffing(g, x + 6, y + 6)
        else coins(g, tile!, x, y)
      }
    }
    if (at === cursor && board && !board.over && Math.floor(clock * 3) % 2 === 0) {
      g.fillStyle = GOLD
      g.fillRect(x - 1, y - 1, CARD + 2, 1)
      g.fillRect(x - 1, y + CARD, CARD + 2, 1)
      g.fillRect(x - 1, y - 1, 1, CARD + 2)
      g.fillRect(x + CARD, y - 1, 1, CARD + 2)
    }
  }

  /** A hint card: the coins of its line on top (a coin beside the count), its Koffing under (a little Koffing beside theirs). */
  const drawHint = (g: CanvasRenderingContext2D, x: number, y: number, coinsN: number, koffingN: number) => {
    g.fillStyle = DARK
    g.fillRect(x, y, CARD, CARD)
    g.fillStyle = '#f8e8b0'
    g.fillRect(x + 1, y + 1, CARD - 2, 10)
    g.fillStyle = '#4a3058'
    g.fillRect(x + 1, y + 11, CARD - 2, CARD - 12)
    g.drawImage(SWEEP_ART.coin(), x + 2, y + 3)
    drawText(g, String(coinsN), x + CARD - 3, y + 3, '#402808', 'right')
    for (let r = 0; r < MINI.length; r++)
      for (let k = 0; k < MINI[r]!.length; k++) {
        const ch = MINI[r]![k]!
        if (ch === '.') continue
        g.fillStyle = KOFFING_PAL[ch]!
        g.fillRect(x + 2 + k, y + 13 + r, 1, 1)
      }
    drawText(g, String(koffingN), x + CARD - 3, y + 13, '#ffffff', 'right')
  }

  const draw = (g: CanvasRenderingContext2D) => {
    sheet.track()
    g.fillStyle = '#0c0608'
    g.fillRect(0, 0, size.w, size.h)
    // The table: green felt in a gold-trimmed wooden rim.
    const tw = (N + 1) * L.step + 6
    g.fillStyle = '#3a1810'
    g.fillRect(L.board.x - 6, L.board.y - 6, tw + 4, tw + 4)
    g.fillStyle = GOLD
    g.fillRect(L.board.x - 4, L.board.y - 4, tw, tw)
    g.fillStyle = FELT
    g.fillRect(L.board.x - 3, L.board.y - 3, tw - 2, tw - 2)
    for (let y = L.board.y - 3; y < L.board.y + tw - 5; y += 4) {
      g.fillStyle = FELT_HI
      g.fillRect(L.board.x - 3, y, tw - 2, 1)
    }
    if (board) {
      for (let i = 0; i < N; i++) {
        const row = board.hints.rows[i]!
        const col = board.hints.cols[i]!
        drawHint(g, L.hintCol.x, L.hintCol.y + i * L.step, row.coins, row.koffing)
        drawHint(g, L.hintRow.x + i * L.step, L.hintRow.y, col.coins, col.koffing)
      }
      for (let at = 0; at < N * N; at++) drawCard(g, at)
    } else {
      for (let at = 0; at < N * N; at++) {
        const x = L.board.x + (at % N) * L.step
        const y = L.board.y + Math.floor(at / N) * L.step
        g.fillStyle = 'rgba(0,0,0,0.25)'
        g.fillRect(x, y, CARD, CARD)
      }
    }
    // The readouts: the level, the pot (what banking now pays) and the tokens held.
    const p = L.pot
    const w = L.tall ? 160 : 126
    plate(g, p.x, p.y, w, 22)
    drawText(g, `LV ${board?.level ?? state?.level ?? 1}`, p.x + 4, p.y + 4, GOLD)
    g.drawImage(SWEEP_ART.token(), p.x + 4, p.y + 11)
    drawText(g, String(state?.tokens ?? 0), p.x + 17, p.y + 13, '#ffffff')
    const pay = board && !board.over ? payNow() : lastPaid
    drawText(g, `+${pay}`, p.x + w - 4, p.y + 8, board?.over === 'koffing' ? '#a080c0' : GOLD, 'right', 1)
    drawFx(g, parts, pops)
  }

  void load()

  return {
    step,
    draw,
    over: () => null,
    dispose: () => {
      disposed = true
      sheet.dispose()
    },
  }
}

/** Koffing Sweep (`MINIGAMES.sweep`); the table fits the way the phone is held. */
export const sweep: SoloGame = {
  get size() {
    return (shown = SIZE())
  },
  start,
}

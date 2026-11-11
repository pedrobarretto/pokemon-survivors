import { playSfx } from '../../engine/audio'
import { formatNumber, t } from '../../i18n'
import type { CornerState, CornerSweep } from '../../net/realmApi'
import { SWEEP_ART, tokenIcon } from '../../render/cornerArt'
import { h } from '../../ui/dom'
import { isFailure } from '../api'
import { bankSweep, dealSweep, fetchCorner, flipTile } from '../cornerApi'
import { burst, drawFx, drawText, shakeOffset, stepFx, textWidth, type Particle, type Popup } from './arcadeKit'
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
 * The table fills the stage whichever way the phone is held (`fluid`): a
 * green felt in a gold-trimmed rim on the Game Corner's carpet, the level's
 * lamps and the pot over it, the kit's sheet under it upright and beside it
 * sideways. A Koffing turned over bursts in a puff of gas and shakes the
 * table; coins clink and sparkle.
 *
 * Touch: tap a card to flip it; with Mark on, a tap marks it as a Koffing
 * instead. Keys: arrows to move, Space or Enter to flip, M to mark.
 */

const N = SWEEP.size
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

/** The header over the table (the level's lamps, the tokens and the pot), the table's rim round the cards and the strip under it (the 2s and 3s still hidden). */
const HEAD = 24
const RIM = 8
const STRIP = 22
/** The big pot over the header, when there's room for it. */
const POT = 34

/**
 * Where the table stands in the part of the canvas the sheet leaves free
 * (`area`): the cards as big as fit (a whole px each), the header over them.
 */
const layoutOf = (area: { x: number; y: number; w: number; h: number }, room: number) => {
  const span = Math.min(area.w - RIM * 2 - 8, room - HEAD - STRIP - RIM * 2 - 10)
  const card = Math.max(18, Math.min(40, Math.floor(span / (N + 1)) - GAP))
  const step = card + GAP
  const tw = (N + 1) * step - GAP
  const x = area.x + Math.floor((area.w - tw) / 2)
  // With room to spare over it (a phone held upright), the pot shows big over the header.
  const pot = area.h - (HEAD + tw + RIM * 2 + STRIP) >= POT + 24 ? POT : 0
  const y = area.y + Math.max(4, Math.floor((area.h - (pot + HEAD + tw + RIM * 2 + STRIP)) / 2)) + pot + HEAD + RIM
  const board = { x, y }
  return {
    card,
    step,
    tw,
    board,
    hintCol: { x: board.x + N * step, y: board.y },
    hintRow: { x: board.x, y: board.y + N * step },
    head: { x: x - RIM, y: y - RIM - HEAD, w: tw + RIM * 2 },
    strip: { x: x - RIM, y: y + tw + RIM + 4, w: tw + RIM * 2 },
    pot: pot > 0 ? { x: x + Math.floor(tw / 2), y: y - RIM - HEAD - pot } : null,
  }
}

type Layout = ReturnType<typeof layoutOf>

/** A puff of Koffing's gas: a round cloud swelling and thinning as it drifts up. */
type Puff = { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number }

const start = (ctx: SoloCtx): GameRun => {
  const view = { w: 0, h: 0 }
  let L: Layout = layoutOf({ x: 0, y: 0, w: 200, h: 300 }, 300)
  /** Where the table's middle eases to as the sheet under it grows and shrinks (upright). */
  let lift = -1
  const m = () => t().rocket.sweep
  const c = () => t().rocket.corner
  const sheet = gameSheet(ctx.stage, view, { x: 0, y: 0 })
  const say = sheet.show
  const tall = () => view.h > view.w
  /** The most the sheet took off the canvas (game px): the table is sized for it, so it never grows or shrinks as the sheet changes. */
  let taken = 0
  let shake = 0
  const puffs: Puff[] = []

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
    // Under the table upright, beside it sideways (the tokens with it).
    say('dock', [h('p', { class: 'mg-lead' }, `${m().level(board.level)} · ${m().payout(formatNumber(payNow()))}`), !tall() && tokensLine()], [
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
      shake = 0.5
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        puffs.push({ x: cx, y: cy, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 10, r: 4 + (i % 3) * 2, age: 0, life: 1 + (i % 4) * 0.2 })
      }
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
    const x = L.board.x + (at % N) * L.step + L.card / 2
    const y = L.board.y + Math.floor(at / N) * L.step + L.card / 2
    if (tile === 0) {
      // A Koffing: it pops out in a puff of gas.
      playSfx('sweepPuff')
      shake = Math.max(shake, 0.3)
      for (let i = 0; i < 7; i++) puffs.push({ x, y, vx: (i - 3) * 9, vy: -14 - (i % 3) * 8, r: 3 + (i % 3), age: 0, life: 0.8 + (i % 3) * 0.15 })
    } else if (tile !== null) {
      playSfx(tile > 1 ? 'sweepClink' : 'coin')
      burst(parts, x, y, ['#f8c838', '#fff0a0', '#ffffff'], 6 + tile * 5, 50 + tile * 12)
      if (tile > 1) pops.push({ x, y: y - 6, text: `X${tile}`, color: '#f8c838', age: 0, big: false })
    }
    if (got.sweep.over) ended(got.paid)
    else playing()
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
    shake = Math.max(0, shake - dt)
    stepFx(parts, pops, dt)
    let k = 0
    for (const p of puffs) {
      p.age += dt
      if (p.age >= p.life) continue
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - dt * 1.5
      p.vy -= 6 * dt
      puffs[k++] = p
    }
    puffs.length = k
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

  const fill = (g: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, hh: number) => {
    g.fillStyle = color
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh))
  }

  /** Pixel rows in a palette at (x, y), each pixel `k` px. */
  const rows = (g: CanvasRenderingContext2D, art: readonly string[], pal: Record<string, string>, x: number, y: number, k: number) => {
    for (let r = 0; r < art.length; r++)
      for (let i = 0; i < art[r]!.length; i++) {
        const ch = art[r]![i]!
        if (ch !== '.') fill(g, pal[ch]!, x + i * k, y + r * k, k, k)
      }
  }

  /** How big the art on a card is drawn: twice its pixels once the cards are big enough. */
  const artK = () => (L.card >= 24 ? 2 : 1)

  const coins = (g: CanvasRenderingContext2D, n: number, x: number, y: number) => {
    const art = SWEEP_ART.coin()
    const k = artK()
    const w = art.width * k
    const spread = n > 1 ? Math.min(6 * k, Math.floor((L.card - w - 4) / (n - 1))) : 0
    for (let i = 0; i < n; i++) {
      const cx = x + L.card / 2 - w / 2 + (i - (n - 1) / 2) * spread
      const cy = y + L.card / 2 - w / 2 + (i % 2 === 0 ? 1 : -2) * k
      g.drawImage(art, Math.round(cx), Math.round(cy), w, art.height * k)
    }
  }

  const drawCard = (g: CanvasRenderingContext2D, at: number) => {
    const C = L.card
    const x = L.board.x + (at % N) * L.step
    const y = L.board.y + Math.floor(at / N) * L.step
    const tile = face(at)
    const since = clock - (turned.get(at) ?? -9)
    // A card turning: it narrows to its edge, then opens on its face.
    const k = tile === null ? 1 : Math.min(1, since / 0.18)
    const w = Math.max(2, Math.round(C * Math.abs(1 - 2 * Math.min(1, k))))
    const showFace = tile !== null && k >= 0.5
    const left = x + Math.round((C - w) / 2)
    // Its shadow on the felt, then the card.
    fill(g, '#0e3a20', left + 1, y + 2, w, C)
    fill(g, DARK, left, y, w, C)
    const ak = artK()
    if (!showFace) {
      fill(g, '#c02028', left + 1, y + 1, w - 2, C - 2)
      fill(g, '#e84048', left + 1, y + 1, w - 2, 1)
      if (w >= C - 1) {
        // Its back: a gold frame inset, and a gold diamond with a bright heart in the middle, sized to the card.
        fill(g, '#e84048', x + 3, y + 3, C - 6, 1)
        fill(g, '#e84048', x + 3, y + C - 4, C - 6, 1)
        fill(g, '#e84048', x + 3, y + 3, 1, C - 6)
        fill(g, '#e84048', x + C - 4, y + 3, 1, C - 6)
        const r = Math.floor((C - 10) / 2)
        const mid = Math.floor(C / 2)
        for (let dy = -r; dy <= r; dy++) {
          const span = r - Math.abs(dy)
          fill(g, '#a06008', x + mid - span - 1, y + mid + dy, span * 2 + 2, 1)
          if (span > 0) fill(g, Math.abs(dy) + 1 < r / 2 ? '#fff0a0' : GOLD, x + mid - span, y + mid + dy, span * 2, 1)
        }
      }
      if (marks.has(at)) {
        fill(g, '#2a1030', x + 1, y + 1, C - 2, C - 2)
        rows(g, KOFFING, KOFFING_PAL, x + Math.round((C - 10 * ak) / 2), y + Math.round((C - 10 * ak) / 2), ak)
        fill(g, '#f8c838', x + C - 5, y + 2, 3, 3)
      }
    } else {
      const boom = tile === 0
      fill(g, boom ? '#3a2048' : '#f4ecd8', left + 1, y + 1, w - 2, C - 2)
      fill(g, boom ? '#5a3a70' : '#fffaf0', left + 1, y + 1, w - 2, 1)
      if (w >= C - 1) {
        if (boom) {
          // The Koffing bobs on its card, a wisp of gas off its top.
          const bob = Math.floor(clock * 3 + at) % 2
          rows(g, KOFFING, KOFFING_PAL, x + Math.round((C - 10 * ak) / 2), y + Math.round((C - 10 * ak) / 2) + bob, ak)
        } else coins(g, tile!, x, y)
      }
    }
    if (at === cursor && board && !board.over && Math.floor(clock * 3) % 2 === 0) {
      fill(g, GOLD, x - 1, y - 1, C + 2, 1)
      fill(g, GOLD, x - 1, y + C, C + 2, 1)
      fill(g, GOLD, x - 1, y - 1, 1, C + 2)
      fill(g, GOLD, x + C, y - 1, 1, C + 2)
    }
  }

  /** A hint card: the coins of its line on top (a coin beside the count), its Koffing under (a little Koffing beside theirs). */
  const drawHint = (g: CanvasRenderingContext2D, x: number, y: number, coinsN: number, koffingN: number) => {
    const C = L.card
    const half = Math.floor(C / 2)
    const tk = C >= 26 ? 2 : 1
    fill(g, '#0e3a20', x + 1, y + 2, C, C)
    fill(g, DARK, x, y, C, C)
    fill(g, '#f8e8b0', x + 1, y + 1, C - 2, half - 1)
    fill(g, '#4a3058', x + 1, y + half, C - 2, C - half - 1)
    const coin = SWEEP_ART.coin()
    const ck = C >= 30 ? 2 : 1
    g.drawImage(coin, x + 3, y + Math.round((half - coin.height * ck) / 2), coin.width * ck, coin.height * ck)
    // A two-digit count drops to the small digits where the big ones would run into the coin.
    const ctk = textWidth(String(coinsN), tk) > C - 8 - coin.width * ck ? 1 : tk
    drawText(g, String(coinsN), x + C - 3, y + Math.round((half - 5 * ctk) / 2), '#402808', 'right', ctk, '#f8e8b0')
    rows(g, MINI, KOFFING_PAL, x + 3, y + half + Math.round((C - half - 5 * ck) / 2), ck)
    drawText(g, String(koffingN), x + C - 3, y + half + Math.round((C - half - 5 * tk) / 2), '#ffffff', 'right', tk, '#4a3058')
  }

  /** The Game Corner's carpet under it all, its gold coins scattered. */
  const drawFloor = (g: CanvasRenderingContext2D, w: number, hh: number) => {
    fill(g, '#64121e', 0, 0, w, hh)
    for (let y = 0; y < hh; y += 2) for (let x = (y / 2) % 2; x < w; x += 4) fill(g, '#6c1622', x, y, 1, 1)
    for (let ty = 0; ty < hh; ty += 22)
      for (let tx = (ty / 22) % 2 ? 11 : 0; tx < w; tx += 22) {
        fill(g, '#a87024', tx + 9, ty + 8, 3, 1)
        fill(g, '#a87024', tx + 8, ty + 9, 5, 3)
        fill(g, '#a87024', tx + 9, ty + 12, 3, 1)
        fill(g, '#c8902c', tx + 10, ty + 10, 1, 1)
      }
  }

  const drawTable = (g: CanvasRenderingContext2D, dx: number, dy: number) => {
    const x = L.board.x - RIM + dx
    const y = L.board.y - RIM + dy
    const s = L.tw + RIM * 2
    // A shadow, the wooden rim, its gold inlay and the felt, a fine weave on it.
    fill(g, 'rgba(0,0,0,0.35)', x + 4, y + 6, s, s)
    fill(g, DARK, x - 1, y - 1, s + 2, s + 2)
    fill(g, '#6a3018', x, y, s, s)
    fill(g, '#8a4422', x, y, s, 2)
    fill(g, '#4a2010', x, y + s - 2, s, 2)
    fill(g, GOLD, x + 4, y + 4, s - 8, 1)
    fill(g, '#a87010', x + 4, y + s - 5, s - 8, 1)
    fill(g, GOLD, x + 4, y + 4, 1, s - 8)
    fill(g, '#a87010', x + s - 5, y + 4, 1, s - 8)
    fill(g, FELT, x + 5, y + 5, s - 10, s - 10)
    for (let ry = y + 5; ry < y + s - 5; ry += 3) fill(g, FELT_HI, x + 5, ry, s - 10, 1)
    // The tokens on its corners.
    const token = SWEEP_ART.token()
    for (const [cx, cy] of [[x - 3, y - 3], [x + s - 8, y - 3], [x - 3, y + s - 8], [x + s - 8, y + s - 8]] as const) g.drawImage(token, cx, cy)
  }

  /** Over the table: the level's five lamps, the tokens held and what banking now pays. */
  const drawHead = (g: CanvasRenderingContext2D) => {
    const hd = L.head
    fill(g, DARK, hd.x, hd.y, hd.w, HEAD - 4)
    fill(g, '#241418', hd.x + 1, hd.y + 1, hd.w - 2, HEAD - 6)
    fill(g, '#a87010', hd.x + 1, hd.y + HEAD - 6, hd.w - 2, 1)
    const level = board?.level ?? state?.level ?? 1
    drawText(g, 'LV', hd.x + 5, hd.y + 4, GOLD)
    for (let i = 0; i < SWEEP.levels.length; i++) {
      const lx = hd.x + 18 + i * 7
      fill(g, DARK, lx - 1, hd.y + 4, 6, 7)
      fill(g, i < level ? GOLD : '#4a2a10', lx, hd.y + 5, 4, 5)
      if (i < level) fill(g, '#fff0a0', lx, hd.y + 5, 1, 1)
    }
    const token = SWEEP_ART.token()
    const tx = hd.x + 18 + SWEEP.levels.length * 7 + 6
    g.drawImage(token, tx, hd.y + 3)
    drawText(g, String(state?.tokens ?? 0), tx + 13, hd.y + 5, '#ffffff')
    const pay = board && !board.over ? payNow() : lastPaid
    const color = board?.over === 'koffing' ? '#a080c0' : GOLD
    if (!L.pot) return drawText(g, `+${pay}`, hd.x + hd.w - 5, hd.y + 5, color, 'right')
    // The pot big over it all: what banking now pays.
    const text = `+${pay}`
    const tw = textWidth(text, 3)
    const tk = token.width * 2
    const x0 = L.pot.x - Math.round((tk + 6 + tw) / 2)
    g.drawImage(token, x0, L.pot.y + 6, tk, token.height * 2)
    drawText(g, text, x0 + tk + 6, L.pot.y + 5, color, 'left', 3, '#3a0810')
  }

  /** Under the table: a coin pile for every 2 and 3 on the board, lit once turned (all lit clears it). */
  const drawStrip = (g: CanvasRenderingContext2D) => {
    const level = SWEEP.levels[(board?.level ?? state?.level ?? 1) - 1]!
    const found = (n: number) => board?.flipped.filter((f) => f.tile === n).length ?? 0
    const piles = [...Array.from({ length: level.twos }, (_, i) => ({ n: 2, lit: i < found(2) })), ...Array.from({ length: level.threes }, (_, i) => ({ n: 3, lit: i < found(3) }))]
    const st = L.strip
    const cw = 16
    const x0 = st.x + Math.floor((st.w - piles.length * (cw + 2)) / 2)
    const coin = SWEEP_ART.coin()
    piles.forEach((p, i) => {
      const x = x0 + i * (cw + 2)
      fill(g, DARK, x, st.y, cw, 14)
      fill(g, p.lit ? '#f4ecd8' : '#3a1018', x + 1, st.y + 1, cw - 2, 12)
      for (let c = 0; c < p.n; c++) {
        const cx = x + Math.round(cw / 2 - 2 + (c - (p.n - 1) / 2) * 4)
        const cy = st.y + 4 + (c % 2 ? -1 : 1)
        if (p.lit) g.drawImage(coin, cx - 1, cy)
        else fill(g, '#6a3020', cx, cy + 1, 3, 3)
      }
    })
  }

  /** A filled round of radius `r` at (x, y), row by row. */
  const disc = (g: CanvasRenderingContext2D, color: string, x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) {
      const span = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)))
      fill(g, color, x - span, y + dy, span * 2, 1)
    }
  }

  /** Koffing's gas: each puff a lumpy cloud of three rounds swelling, paling and shrinking away. */
  const drawPuffs = (g: CanvasRenderingContext2D) => {
    for (const p of puffs) {
      const k = p.age / p.life
      const r = Math.max(1, Math.round(p.r * (1 + k * 1.6) * (k > 0.75 ? 1 - (k - 0.75) * 3 : 1)))
      const base = k < 0.35 ? '#9068b0' : k < 0.7 ? '#7a5898' : '#6a5080'
      const lit = k < 0.35 ? '#c8b4e0' : '#a890c8'
      const x = Math.round(p.x)
      const y = Math.round(p.y)
      disc(g, base, x - Math.round(r * 0.6), y + Math.round(r * 0.3), Math.round(r * 0.7))
      disc(g, base, x + Math.round(r * 0.6), y + Math.round(r * 0.25), Math.round(r * 0.65))
      disc(g, base, x, y, r)
      disc(g, lit, x - Math.round(r / 3), y - Math.round(r / 3), Math.round(r * 0.5))
    }
  }

  const draw = (g: CanvasRenderingContext2D) => {
    const w = g.canvas.width
    const hh = g.canvas.height
    const k = g.canvas.clientWidth / Math.max(1, w) || 2
    view.w = w
    view.h = hh
    sheet.track()
    // Upright the sheet docks under the table; sideways beside it, a fixed width off the right.
    if (hh > w) {
      const now = hh - sheet.free().h
      taken = Math.max(taken, Math.ceil(150 / k), now)
      // Sized for the tallest sheet, centered over the one showing now (easing there as it changes).
      const target = hh - Math.max(now, Math.ceil(120 / k))
      lift = lift < 0 ? target : lift + (target - lift) * Math.min(1, 0.2)
      L = layoutOf({ x: 0, y: 0, w, h: Math.round(lift) }, hh - taken)
    } else {
      const right = Math.min(Math.floor(w * 0.5), Math.ceil(260 / k))
      L = layoutOf({ x: 0, y: 0, w: w - right, h: hh }, hh)
      sheet.setKeep({ x: w - right, y: 0 })
    }
    drawFloor(g, w, hh)
    const { x: dx, y: dy } = shakeOffset(shake, 3)
    drawTable(g, dx, dy)
    drawHead(g)
    g.save()
    g.translate(Math.round(dx), Math.round(dy))
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
        fill(g, '#165030', x, y, L.card, L.card)
      }
    }
    g.restore()
    drawStrip(g)
    drawPuffs(g)
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

/** The canvas for a stage of this CSS size: as large a pixel as the table allows, whole device pixels. */
const fluid = (stageW: number, stageH: number) => {
  const dpr = window.devicePixelRatio || 1
  const tall = stageH > stageW
  const need = tall ? { w: 180, h: 300 } : { w: 330, h: 190 }
  const raw = Math.min(stageW / need.w, stageH / need.h, 4)
  const k = Math.max(1, Math.floor(raw * dpr) / dpr)
  return { w: Math.floor(stageW / k), h: Math.floor(stageH / k) }
}

/** Koffing Sweep (`MINIGAMES.sweep`); the table fills the screen whichever way the phone is held. */
export const sweep: SoloGame = {
  size: { w: 196, h: 360 },
  fluid,
  start,
}

import { playSfx } from '../../engine/audio'
import { formatNumber, t } from '../../i18n'
import type { CornerState } from '../../net/realmApi'
import { SWEEP_ART, slotSymbol, symbolIcon, tokenIcon } from '../../render/cornerArt'
import { h } from '../../ui/dom'
import { isFailure } from '../api'
import { fetchCorner, spinSlots } from '../cornerApi'
import { arcadeSize, burst, drawFx, drawText, plate, stepFx, textWidth, type Particle, type Popup } from './arcadeKit'
import { BETS, CORNER, LINES, ORAN_LEFT, PAYS, STRIP, SYMBOLS, spinCost, spinWins, type Bet, type LineWin } from './corner.rules'
import type { GameInput, GameRun, SoloCtx, SoloGame } from './frame'
import { callout, gameSheet, sheetTitle } from './gameSheet'

/**
 * The Rocket Game Corner's slots (`MINIGAMES.slots`): three reels, a bet of
 * 1, 2 or 3 playing one, three or five lines. The API rolls every spin
 * (`cornerApi.ts`, `corner.rules.ts`); this spins the reels and lands them
 * where it said. Numbers are drawn on the machine, words live in the kit's
 * sheet (the paytable, a win, why it can't spin).
 *
 * Touch: tap BET to change the bet, the red button to spin. Keys: 1 2 3 or
 * ← → for the bet, Space or Enter to spin.
 */

const SIZES = { tall: { w: 176, h: 256 }, wide: { w: 300, h: 160 } } as const

/** A reel square, the window's top-left and the reels' gap. */
const CELL = { w: 30, h: 26 } as const
const GAP = 4

/** Reel speed while spinning (symbols a second), when each reel stops after the answer and how long it settles. */
const SPEED = 22
const STOP_AT = [0.55, 0.9, 1.25] as const
const SETTLE = 0.42

type Reel = { pos: number; spinning: boolean; from: number; to: number; t: number; settling: boolean }

const DARK = '#1c0c10'
const RED = '#b81c24'
const RED_HI = '#e84048'
const GOLD = '#f8c838'
const GOLD_LO = '#a87010'

const SIZE = () => arcadeSize(SIZES.tall, SIZES.wide)
let shown: { w: number; h: number } = SIZE()

/** Where the machine's parts stand: the window, the bet lamps, the readouts and the two buttons. */
const layoutOf = ({ w, h: ch }: { w: number; h: number }) => {
  const tall = ch > w
  const win = { x: tall ? 26 : 22, y: tall ? 40 : 30 }
  const ww = CELL.w * 3 + GAP * 2
  return {
    tall,
    win,
    ww,
    wh: CELL.h * 3,
    body: tall ? { x: 6, y: 6, w: 164, h: 170 } : { x: 6, y: 4, w: 144, h: 152 },
    readout: tall ? { x: 18, y: 126 } : { x: 14, y: 118 },
    bet: tall ? { x: 44, y: 212, r: 18 } : { x: 196, y: 108, r: 18 },
    spin: tall ? { x: 128, y: 212, r: 22 } : { x: 262, y: 108, r: 22 },
  }
}

const start = (ctx: SoloCtx): GameRun => {
  const size = shown
  const L = layoutOf(size)
  const m = () => t().rocket.slots
  const c = () => t().rocket.corner
  const sheet = gameSheet(ctx.stage, size, L.tall ? { x: 176, y: 180, hug: true } : { x: 152, y: 160 })
  const say = sheet.show

  let state: CornerState | null = null
  let bet: Bet = 1
  let busy = false
  let disposed = false
  let clock = 0
  let since = 0
  let answer: { stops: [number, number, number]; paid: number; wins: LineWin[] } | null = null
  let shownWins: LineWin[] = []
  let winAge = 0
  let betHeld = false
  let spinHeld = false
  const reels: Reel[] = [0, 1, 2].map((i) => ({ pos: i * 7, spinning: false, from: 0, to: 0, t: 0, settling: false }))
  const parts: Particle[] = []
  const pops: Popup[] = []

  const tokensLine = () => h('p', { class: 'mg-lead corner-tokens' }, h('img', { src: tokenIcon(), alt: '', width: 14, height: 14 }), ` ${c().balance(formatNumber(state?.tokens ?? 0))} · ${m().spinsLeft(formatNumber(Math.max(0, CORNER.spinsDaily - (state?.spins ?? 0))))}`)

  /** The paytable: three of each symbol, and the Oran on the left. */
  const paytable = () =>
    h(
      'div',
      { class: 'corner-paytable' },
      ...SYMBOLS.map((s) => h('span', {}, h('img', { src: symbolIcon(s), alt: '' }), h('img', { src: symbolIcon(s), alt: '' }), h('img', { src: symbolIcon(s), alt: '' }), h('b', {}, `×${PAYS[s]}`))),
      h('span', { class: 'corner-oran' }, h('img', { src: symbolIcon('oran'), alt: '' }), m().oran, h('b', {}, `×${ORAN_LEFT}`)),
    )

  const idle = (lead?: HTMLElement) =>
    say('dock', [sheetTitle(m().name, c().name), lead ?? h('p', { class: 'mg-lead' }, m().blurb), tokensLine()], [{ label: m().table, run: () => say('card', [sheetTitle(m().table), paytable()], [], { label: t().minigames.close, run: () => idle(lead) }) }])

  const trouble = (error: string) => {
    busy = false
    const e = c().errors
    const text = error === 'tokens' ? m().noTokens : error === 'cap' ? e.cap : error === 'profile' ? e.profile : error === 'offline' || error === 'guest' ? e.guest : e.failed
    idle(callout(text))
  }

  const load = async () => {
    const got = await fetchCorner()
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    state = got
    idle()
  }

  const setBet = (next: Bet) => {
    if (busy || next === bet) return
    bet = next
    playSfx('move')
  }

  const spin = () => {
    if (busy || !state) return
    if (state.tokens < spinCost(bet)) return trouble('tokens')
    busy = true
    answer = null
    shownWins = []
    since = 0
    state = { ...state, tokens: state.tokens - spinCost(bet) }
    for (const r of reels) Object.assign(r, { spinning: true, settling: false })
    playSfx('coin')
    sheet.hide()
    void spinSlots(bet).then((got) => {
      if (disposed) return
      if (isFailure(got)) {
        for (const r of reels) r.spinning = false
        if (state) state = { ...state, tokens: state.tokens + spinCost(bet) }
        return trouble(got.error)
      }
      answer = { stops: got.stops, paid: got.paid, wins: spinWins(got.stops, bet) }
      if (state) state = { ...state, tokens: got.tokens - got.paid, won: got.won, spins: got.spins }
      since = 0
    })
  }

  /** Lands reel `i` on `stop`: one more turn round the strip and an ease that overshoots a little. */
  const stopReel = (r: Reel, stop: number) => {
    const n = STRIP.length
    const ahead = (((stop - r.pos) % n) + n) % n
    r.from = r.pos
    r.to = r.pos + ahead + n
    r.t = 0
    r.settling = true
    r.spinning = false
  }

  const finish = () => {
    if (!answer || !state) return
    const paid = answer.paid
    state = { ...state, tokens: state.tokens + paid }
    shownWins = paid > 0 ? answer.wins : []
    winAge = 0
    busy = false
    const jackpot = answer.wins.some((w) => w.symbol === 'seven')
    if (jackpot) ctx.brag('jackpot')
    if (paid > 0) {
      playSfx(jackpot ? 'unlock' : 'item')
      const cx = L.win.x + L.ww / 2
      burst(parts, cx, L.win.y + L.wh / 2, [GOLD, '#ffffff', RED_HI], jackpot ? 60 : 24, jackpot ? 120 : 80)
      pops.push({ x: cx, y: L.win.y + L.wh / 2 - 8, text: `+${paid}`, color: GOLD, age: 0, big: jackpot })
      idle(h('p', { class: jackpot ? 'mg-lead hot' : 'mg-lead' }, jackpot ? `${m().jackpot} ${m().win(formatNumber(paid))}` : m().win(formatNumber(paid))))
    } else {
      const capped = answer.wins.length > 0 && (state.won ?? 0) >= CORNER.wonDaily
      idle(capped ? callout(m().capped) : h('p', { class: 'mg-lead' }, m().lose))
    }
    answer = null
  }

  const hit = (x: number, y: number, b: { x: number; y: number; r: number }) => (x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + 4) ** 2

  const step = (dt: number, input: GameInput) => {
    clock += dt
    since += dt
    winAge += dt
    stepFx(parts, pops, dt)
    const p = input.pointer
    betHeld = p.down && hit(p.x, p.y, L.bet)
    spinHeld = p.down && hit(p.x, p.y, L.spin)
    if (p.pressed && hit(p.x, p.y, L.bet)) setBet(BETS[(BETS.indexOf(bet) + 1) % BETS.length]!)
    if (p.pressed && hit(p.x, p.y, L.spin)) spin()
    if (input.pressed('Digit1')) setBet(1)
    if (input.pressed('Digit2')) setBet(2)
    if (input.pressed('Digit3')) setBet(3)
    if (input.pressed('ArrowRight') || input.pressed('KeyD')) setBet(BETS[Math.min(BETS.length - 1, BETS.indexOf(bet) + 1)]!)
    if (input.pressed('ArrowLeft') || input.pressed('KeyA')) setBet(BETS[Math.max(0, BETS.indexOf(bet) - 1)]!)
    if (input.pressed('Space') || input.pressed('Enter')) spin()
    reels.forEach((r, i) => {
      if (r.spinning) {
        r.pos = (r.pos + SPEED * dt) % STRIP.length
        if (answer && since >= STOP_AT[i]!) {
          stopReel(r, answer.stops[i]!)
          playSfx('move')
        }
      } else if (r.settling) {
        r.t += dt
        const k = Math.min(1, r.t / SETTLE)
        // Ease out with a small overshoot back.
        const e = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2
        r.pos = r.from + (r.to - r.from) * e
        if (k >= 1) {
          r.pos = r.to % STRIP.length
          r.settling = false
          if (i === 2) finish()
        }
      }
    })
  }

  /* ---------- Drawing ---------- */

  const bulb = (g: CanvasRenderingContext2D, x: number, y: number, on: boolean) => {
    g.fillStyle = DARK
    g.fillRect(x - 1, y - 1, 4, 4)
    g.fillStyle = on ? '#fff0a0' : '#704818'
    g.fillRect(x, y, 2, 2)
  }

  const button = (g: CanvasRenderingContext2D, b: { x: number; y: number; r: number }, color: string, hi: string, down: boolean) => {
    const off = down ? 2 : 0
    for (let dy = -b.r; dy <= b.r; dy++) {
      const span = Math.round(Math.sqrt(Math.max(0, b.r ** 2 - dy ** 2)))
      g.fillStyle = DARK
      g.fillRect(b.x - span - 1, b.y + dy + 3, span * 2 + 2, 1)
    }
    for (let dy = -b.r; dy <= b.r; dy++) {
      const span = Math.round(Math.sqrt(Math.max(0, b.r ** 2 - dy ** 2)))
      g.fillStyle = Math.abs(dy) === b.r ? DARK : dy < -b.r / 2 ? hi : color
      g.fillRect(b.x - span, b.y + dy + off, span * 2, 1)
    }
  }

  const drawReel = (g: CanvasRenderingContext2D, i: number) => {
    const r = reels[i]!
    const x = L.win.x + i * (CELL.w + GAP)
    const y = L.win.y
    g.fillStyle = '#f8f0e0'
    g.fillRect(x, y, CELL.w, L.wh)
    g.fillStyle = '#e8dcc8'
    g.fillRect(x, y, CELL.w, 3)
    g.fillRect(x, y + L.wh - 3, CELL.w, 3)
    g.save()
    g.beginPath()
    g.rect(x, y, CELL.w, L.wh)
    g.clip()
    const base = Math.floor(r.pos)
    const frac = r.pos - base
    for (let row = -1; row <= 3; row++) {
      const sym = STRIP[(((base + row - 1) % STRIP.length) + STRIP.length) % STRIP.length]!
      const art = slotSymbol(sym)
      const cy = Math.round(y + (row - frac) * CELL.h + CELL.h / 2)
      // A moving reel blurs into streaks: every other row of the symbol skipped.
      if (r.spinning) {
        for (let ry = 0; ry < art.height; ry += 2) g.drawImage(art, 0, ry, art.width, 1, Math.round(x + (CELL.w - art.width) / 2), cy - Math.round(art.height / 2) + ry, art.width, 1)
      } else g.drawImage(art, Math.round(x + (CELL.w - art.width) / 2), cy - Math.round(art.height / 2))
    }
    g.restore()
  }

  /** A paying line drawn through its three squares, blinking. */
  const drawLine = (g: CanvasRenderingContext2D, line: number, color: string) => {
    const rows = LINES[3][line]!
    g.fillStyle = color
    for (let i = 0; i < 2; i++) {
      const x0 = L.win.x + i * (CELL.w + GAP) + CELL.w / 2
      const x1 = x0 + CELL.w + GAP
      const y0 = L.win.y + rows[i]! * CELL.h + CELL.h / 2
      const y1 = L.win.y + rows[i + 1]! * CELL.h + CELL.h / 2
      const steps = Math.ceil(x1 - x0)
      for (let s = 0; s <= steps; s++) g.fillRect(Math.round(x0 + s), Math.round(y0 + ((y1 - y0) * s) / steps) - 1, 1, 2)
    }
  }

  const draw = (g: CanvasRenderingContext2D) => {
    sheet.track()
    g.fillStyle = '#140a10'
    g.fillRect(0, 0, size.w, size.h)
    const b = L.body
    // The cabinet: black lacquer with a red front, gold trim and a marquee of bulbs chasing.
    g.fillStyle = DARK
    g.fillRect(b.x, b.y, b.w, b.h)
    g.fillStyle = RED
    g.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4)
    g.fillStyle = RED_HI
    g.fillRect(b.x + 2, b.y + 2, b.w - 4, 2)
    g.fillStyle = GOLD
    g.fillRect(b.x + 4, b.y + 18, b.w - 8, 2)
    g.fillStyle = GOLD_LO
    g.fillRect(b.x + 4, b.y + 20, b.w - 8, 1)
    const chase = Math.floor(clock * (busy ? 14 : 5))
    for (let x = b.x + 8, k = 0; x < b.x + b.w - 8; x += 8, k++) bulb(g, x, b.y + 8, (k + chase) % 3 === 0 || shownWins.length > 0)
    // The window: a gold frame round the three reels.
    g.fillStyle = DARK
    g.fillRect(L.win.x - 4, L.win.y - 4, L.ww + 8, L.wh + 8)
    g.fillStyle = GOLD
    g.fillRect(L.win.x - 3, L.win.y - 3, L.ww + 6, L.wh + 6)
    g.fillStyle = DARK
    g.fillRect(L.win.x - 1, L.win.y - 1, L.ww + 2, L.wh + 2)
    for (let i = 0; i < 3; i++) drawReel(g, i)
    // The lines the bet plays, lamps on both sides; the paying ones drawn across, blinking.
    LINES[3].forEach((rows, line) => {
      const on = line < LINES[bet].length
      for (const side of [0, 1]) {
        const lx = side === 0 ? L.win.x - 9 : L.win.x + L.ww + 5
        const ly = L.win.y + (line < 3 ? [1, 0, 2][line]! : line === 3 ? 0.5 : 1.5) * CELL.h + CELL.h / 2 - 2
        g.fillStyle = DARK
        g.fillRect(lx - 1, Math.round(ly) - 1, 5, 5)
        g.fillStyle = on ? GOLD : '#602010'
        g.fillRect(lx, Math.round(ly), 3, 3)
      }
      void rows
    })
    if (shownWins.length > 0 && Math.floor(winAge * 6) % 2 === 0) for (const w of shownWins) drawLine(g, w.line, w.symbol === 'seven' ? '#ffffff' : '#f8f020')
    // The readouts: tokens held and the bet.
    const r = L.readout
    plate(g, r.x, r.y, L.tall ? 140 : 124, 24)
    g.drawImage(SWEEP_ART.token(), r.x + 4, r.y + 7)
    const tokens = formatNumber(state?.tokens ?? 0)
    drawText(g, tokens, r.x + 18, r.y + 9, '#ffffff', 'left')
    const betText = `${spinCost(bet)}`
    drawText(g, betText, r.x + (L.tall ? 136 : 120), r.y + 9, GOLD, 'right')
    g.drawImage(SWEEP_ART.token(), r.x + (L.tall ? 122 : 106) - textWidth(betText), r.y + 7)
    // The controls: BET (cycling 1-3, its lamps) and the big red spin button.
    button(g, L.bet, '#d8a020', '#f8d048', betHeld)
    drawText(g, String(bet), L.bet.x, L.bet.y - 4 + (betHeld ? 2 : 0), DARK, 'center', 2)
    for (const k of BETS) {
      g.fillStyle = k <= bet ? GOLD : '#503010'
      g.fillRect(L.bet.x - 10 + (k - 1) * 8, L.bet.y + L.bet.r + 8, 5, 3)
    }
    button(g, L.spin, busy ? '#803030' : '#e02830', busy ? '#a04848' : '#ff7070', spinHeld || busy)
    drawFx(g, parts, pops)
  }

  void load()

  return {
    step,
    draw,
    // A sitting lasts until it's closed: tokens, not rounds.
    over: () => null,
    dispose: () => {
      disposed = true
      sheet.dispose()
    },
  }
}

/** The Game Corner's slots (`MINIGAMES.slots`); the machine fits the way the phone is held. */
export const slots: SoloGame = {
  get size() {
    return (shown = SIZE())
  },
  start,
}

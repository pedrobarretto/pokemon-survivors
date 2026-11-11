import { playSfx } from '../../engine/audio'
import { createCanvas, context2d, type PixelSprite } from '../../engine/pixelart'
import { formatNumber, t } from '../../i18n'
import type { CornerState } from '../../net/realmApi'
import { SWEEP_ART, slotSymbol } from '../../render/cornerArt'
import { h } from '../../ui/dom'
import { isFailure } from '../api'
import { fetchCorner, spinSlots } from '../cornerApi'
import { burst, drawFx, drawText, image, stepFx, textWidth, type Particle, type Popup } from './arcadeKit'
import { BETS, CORNER, LINES, ORAN_LEFT, PAYS, STRIP, SYMBOLS, spinCost, spinWins, type Bet, type LineWin, type SlotSymbol } from './corner.rules'
import type { GameInput, GameRun, SoloCtx, SoloGame } from './frame'
import { callout, gameSheet } from './gameSheet'

/**
 * The Rocket Game Corner's slots (`MINIGAMES.slots`): three reels, a bet of
 * 1, 2 or 3 playing one, three or five lines. The API rolls every spin
 * (`cornerApi.ts`, `corner.rules.ts`); this spins the reels and lands them
 * where it said.
 *
 * The machine is drawn whole on a canvas that follows the stage (`fluid`):
 * its marquee of chasing bulbs, the three reels behind glass with the pay
 * line and the lines' lamps, the credits, the BET and SPIN buttons on the
 * deck, the lever on its side, a paytable and the tray the tokens pour into.
 * Upright it stands alone; sideways (and on a desktop) the paytable and the
 * credits hang beside it. Only numbers and capitals are drawn: the words
 * (what happened, the tokens left) are the kit's banner at the foot.
 *
 * Touch: tap BET to change the bet; SPIN or the lever to spin. Keys: 1 2 3
 * or ← → for the bet, Space or Enter to spin.
 */

/** Reel speed at full spin (symbols a second), when each reel starts stopping after the answer and how long it settles. */
const SPEED = 22
const STOP_AT = [0.55, 0.95, 1.4] as const
const SETTLE = 0.42
/** Seconds a reel takes to reach full speed once the lever drops (the three start one after another). */
const SPIN_UP = 0.22

type Reel = { pos: number; spinning: boolean; from: number; to: number; t: number; settling: boolean; bump: number }

type Box = { x: number; y: number; w: number; h: number }
type Round = { x: number; y: number; r: number }

const C = {
  ink: '#140a0e',
  wall: '#1c1218',
  brick: '#261a20',
  mortar: '#120a0e',
  red: '#b81c24',
  redHi: '#e84048',
  redLo: '#7a1018',
  gold: '#f8c838',
  goldHi: '#fff0a0',
  goldLo: '#a87010',
  chrome: '#d8d8e0',
  chromeLo: '#8a8a98',
  reel: '#f8f0e0',
  reelLo: '#d8ccb4',
  lcd: '#0c0608',
  bulbOff: '#6a3c10',
  bulbOn: '#fff4b0',
} as const

/** The rainbow a jackpot's bulbs run through. */
const RAINBOW = ['#ff5a5a', '#f8c838', '#78e070', '#4ae0f0', '#c070ff'] as const

/**
 * Where the machine's parts stand on a canvas of `w` × `h` game px whose
 * foot `foot` px the kit's banner covers. Upright: the cabinet alone,
 * paytable on its belly. Sideways: the cabinet on the left of the middle,
 * the paytable and credits on a lit panel to its right.
 */
const layoutOf = (w: number, h: number, foot: number) => {
  const tall = h > w * 1.15
  const room = h - foot
  if (tall) {
    const cw = Math.min(w - 32, 168)
    const big = room >= 300
    const rowH = big ? 30 : 26
    const cellW = big ? 36 : 32
    const scale = big ? 2 : 1
    const marqueeH = 34
    const winH = rowH * 3
    const parts = marqueeH + 6 + winH + 10 + 18 + 6 + 46 + 66 + 22
    const top = Math.max(4, Math.floor((room - parts) / 2))
    // The lever hangs off the right side: the cabinet stands a little left of the middle to leave it room.
    const x = Math.floor((w - cw - 12) / 2)
    const winW = cellW * 3 + 4
    const win = { x: x + Math.floor((cw - winW) / 2), y: top + marqueeH + 10, w: winW, h: winH }
    const readout = { x: x + 12, y: win.y + winH + 10, w: cw - 24, h: 18 }
    const deckY = readout.y + readout.h + 6
    const pay = { x: x + 10, y: deckY + 50, w: cw - 20, h: 60 }
    return {
      tall,
      cab: { x, y: top, w: cw, h: pay.y + pay.h + 22 - top },
      marquee: { x: x + 6, y: top, w: cw - 12, h: marqueeH },
      win,
      rowH,
      cellW,
      scale,
      readout,
      bet: { x: x + 38, y: deckY + 22, r: 15 },
      spin: { x: x + cw - 44, y: deckY + 22, r: 19 },
      lever: { x: x + cw + 2, y: win.y + winH / 2 + 6, len: 30 },
      pay,
      side: null as Box | null,
      tray: { x: x + 18, y: pay.y + pay.h + 6, w: cw - 36, h: 12 },
    }
  }
  const rowH = room >= 200 ? 30 : room >= 168 ? 26 : 22
  const cellW = rowH + 6
  const scale = rowH >= 30 ? 2 : 1
  const marqueeH = rowH >= 26 ? 30 : 24
  const winW = cellW * 3 + 4
  const cw = winW + 40
  const parts = marqueeH + 6 + rowH * 3 + 8 + 44 + 18
  const top = Math.max(2, Math.floor((room - parts) / 2))
  const sideW = Math.min(150, Math.max(116, w - cw - 70))
  const x = Math.floor((w - (cw + 26 + sideW)) / 2)
  const win = { x: x + Math.floor((cw - winW) / 2), y: top + marqueeH + 8, w: winW, h: rowH * 3 }
  const deckY = win.y + win.h + 8
  const sideH = Math.min(room - 8, 146)
  const side = { x: x + cw + 26, y: Math.max(4, top + Math.floor((parts - sideH) / 2)), w: sideW, h: sideH }
  return {
    tall,
    cab: { x, y: top, w: cw, h: parts },
    marquee: { x: x + 6, y: top, w: cw - 12, h: marqueeH },
    win,
    rowH,
    cellW,
    scale,
    readout: { x: side.x + 8, y: side.y + 8, w: side.w - 16, h: 18 },
    bet: { x: x + 34, y: deckY + 20, r: 15 },
    spin: { x: x + cw - 40, y: deckY + 20, r: 18 },
    lever: { x: x + cw + 2, y: win.y + win.h / 2 + 4, len: Math.min(30, win.h / 2 + 4) },
    pay: { x: side.x + 8, y: side.y + 32, w: side.w - 16, h: side.h - 62 },
    side: side as Box | null,
    tray: { x: x + 16, y: deckY + 44, w: cw - 32, h: 10 },
  }
}

type Layout = ReturnType<typeof layoutOf>

/** A symbol smeared for a reel at full spin: stretched down, every third row left out, so it reads as a streak. */
const smears = new Map<SlotSymbol, PixelSprite>()
const smearOf = (s: SlotSymbol) => {
  let out = smears.get(s)
  if (out) return out
  const art = slotSymbol(s)
  out = createCanvas(art.width, art.height * 2)
  const g = context2d(out)
  for (let y = 0; y < out.height; y++) if (y % 3 !== 2) g.drawImage(art, 0, Math.floor(y / 2), art.width, 1, 0, y, art.width, 1)
  smears.set(s, out)
  return out
}

const start = (ctx: SoloCtx): GameRun => {
  const m = () => t().rocket.slots
  const c = () => t().rocket.corner
  const view = { w: 0, h: 0 }
  const sheet = gameSheet(ctx.stage, view, { x: 0, y: 0 })
  const say = (lines: readonly (HTMLElement | false)[]) => sheet.show('banner', lines)

  let L: Layout = layoutOf(200, 340, 30)
  /** The foot the kit's banner covers (game px): the most it ever took, so the machine doesn't hop as the banner comes and goes. */
  let foot = 0
  let state: CornerState | null = null
  let bet: Bet = 1
  let busy = false
  let disposed = false
  let clock = 0
  let since = 0
  let answer: { stops: [number, number, number]; paid: number; wins: LineWin[] } | null = null
  let shownWins: LineWin[] = []
  let lastWin = 0
  let jackpot = false
  let winAge = 99
  let betHeld = false
  let spinHeld = false
  /** The lever's pull: 0 at rest, 1 pulled all the way, its clock since pulled. */
  let pulled = 99
  /** Coins left to pour into the tray, and how full it looks (0..1). */
  let pour = 0
  let pourClock = 0
  let pile = 0
  const reels: Reel[] = [0, 1, 2].map((i) => ({ pos: i * 7, spinning: false, from: 0, to: 0, t: 0, settling: false, bump: 0 }))
  const parts: Particle[] = []
  const pops: Popup[] = []
  /** Tokens falling from the chute into the tray. */
  const coins: { x: number; y: number; vy: number; vx: number; landed: number }[] = []

  const tokensLine = () => h('p', { class: 'mg-small corner-tokens' }, `${c().balance(formatNumber(state?.tokens ?? 0))} · ${m().spinsLeft(formatNumber(Math.max(0, CORNER.spinsDaily - (state?.spins ?? 0))))}`)

  const idle = (lead?: HTMLElement) => say([lead ?? h('p', {}, m().blurb), tokensLine()])

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
    playSfx('select')
  }

  const spin = () => {
    if (busy || !state) return
    if (state.tokens < spinCost(bet)) return trouble('tokens')
    busy = true
    answer = null
    shownWins = []
    jackpot = false
    since = 0
    pulled = 0
    state = { ...state, tokens: state.tokens - spinCost(bet) }
    reels.forEach((r) => Object.assign(r, { spinning: true, settling: false, t: 0 }))
    playSfx('slotLever')
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

  /** Lands reel `r` on `stop`: one more turn round the strip and an ease that overshoots a little. */
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
    lastWin = paid
    jackpot = paid > 0 && answer.wins.some((w) => w.symbol === 'seven')
    if (jackpot) ctx.brag('jackpot')
    if (paid > 0) {
      playSfx(jackpot ? 'slotJackpot' : 'slotWin')
      pour += Math.min(jackpot ? 60 : 30, Math.max(4, paid))
      const cx = L.win.x + L.win.w / 2
      burst(parts, cx, L.win.y + L.win.h / 2, [C.gold, '#ffffff', C.redHi], jackpot ? 70 : 26, jackpot ? 130 : 85)
      idle(h('p', { class: 'hot' }, jackpot ? `${m().jackpot} ${m().win(formatNumber(paid))}` : m().win(formatNumber(paid))))
    } else {
      const capped = answer.wins.length > 0 && (state.won ?? 0) >= CORNER.wonDaily
      idle(capped ? callout(m().capped) : h('p', {}, m().lose))
    }
    answer = null
  }

  const inRound = (x: number, y: number, b: Round, pad = 4) => (x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + pad) ** 2
  /** The lever's knob, where it is now. */
  const knob = () => {
    const pull = leverPull()
    return { x: L.lever.x + 6, y: Math.round(L.lever.y - L.lever.len * (1 - 2 * pull)), r: 6 }
  }
  /** How far down the lever is (0..1): a quick pull, then a spring back. */
  const leverPull = () => (pulled < 0.12 ? pulled / 0.12 : pulled < 0.5 ? 1 - (pulled - 0.12) / 0.38 : 0)

  const step = (dt: number, input: GameInput) => {
    clock += dt
    since += dt
    winAge += dt
    pulled += dt
    stepFx(parts, pops, dt)
    const p = input.pointer
    betHeld = p.down && inRound(p.x, p.y, L.bet)
    spinHeld = p.down && inRound(p.x, p.y, L.spin)
    if (p.pressed && inRound(p.x, p.y, L.bet)) setBet(BETS[(BETS.indexOf(bet) + 1) % BETS.length]!)
    if (p.pressed && (inRound(p.x, p.y, L.spin) || inRound(p.x, p.y, knob(), 10))) spin()
    if (input.pressed('Digit1')) setBet(1)
    if (input.pressed('Digit2')) setBet(2)
    if (input.pressed('Digit3')) setBet(3)
    if (input.pressed('ArrowRight') || input.pressed('KeyD')) setBet(BETS[Math.min(BETS.length - 1, BETS.indexOf(bet) + 1)]!)
    if (input.pressed('ArrowLeft') || input.pressed('KeyA')) setBet(BETS[Math.max(0, BETS.indexOf(bet) - 1)]!)
    if (input.pressed('Space') || input.pressed('Enter')) spin()
    reels.forEach((r, i) => {
      r.bump = Math.max(0, r.bump - dt * 14)
      if (r.spinning) {
        r.t += dt
        const ramp = Math.min(1, Math.max(0, (r.t - i * 0.07) / SPIN_UP))
        // A wind-up: the reel rocks back a hair before it runs.
        r.pos = (r.pos + (ramp > 0 ? SPEED * ramp * dt : -2 * dt) + STRIP.length) % STRIP.length
        if (answer && since >= STOP_AT[i]! && r.t > SPIN_UP + 0.2) stopReel(r, answer.stops[i]!)
      } else if (r.settling) {
        r.t += dt
        const k = Math.min(1, r.t / SETTLE)
        // Ease out with a small overshoot back.
        const e = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2
        r.pos = r.from + (r.to - r.from) * e
        if (k >= 1) {
          r.pos = r.to % STRIP.length
          r.settling = false
          r.bump = 2
          playSfx('slotStop')
          if (i === 2) finish()
        }
      }
    })
    // Tokens pour from the chute while there are some to pour, a clink as each lands.
    pourClock += dt
    while (pour > 0 && pourClock > 0.045) {
      pourClock -= 0.045
      pour--
      coins.push({ x: L.tray.x + L.tray.w / 2 + (Math.random() - 0.5) * 6, y: L.tray.y - 10, vx: (Math.random() - 0.5) * 50, vy: 10 + Math.random() * 30, landed: 0 })
    }
    if (pour <= 0) pourClock = 0
    let k = 0
    for (const coin of coins) {
      if (coin.landed > 0) {
        coin.landed += dt
        if (coin.landed < 0.6) coins[k++] = coin
        continue
      }
      coin.vy += 420 * dt
      coin.x += coin.vx * dt
      coin.y += coin.vy * dt
      coin.x = Math.min(L.tray.x + L.tray.w - 8, Math.max(L.tray.x + 2, coin.x))
      const floor = L.tray.y + L.tray.h - 6 - pile * 3
      if (coin.y >= floor) {
        coin.y = floor
        coin.landed = 0.001
        pile = Math.min(1, pile + 0.035)
        playSfx('coin', 90)
      }
      coins[k++] = coin
    }
    coins.length = k
    if (pour <= 0 && coins.length === 0) pile = Math.max(0, pile - dt * 0.08)
  }

  /* ---------- Drawing ---------- */

  const fill = (g: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, hh: number) => {
    g.fillStyle = color
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh))
  }

  /** A box with its corners cut by `r` px, a dark outline round it. */
  const panel = (g: CanvasRenderingContext2D, b: Box, color: string, r = 2, outline: string = C.ink) => {
    for (let i = 0; i < b.h; i++) {
      const cut = i < r ? r - i : i >= b.h - r ? i - (b.h - r) + 1 : 0
      fill(g, outline, b.x + cut, b.y + i, b.w - cut * 2, 1)
      if (i > 0 && i < b.h - 1) fill(g, color, b.x + cut + 1, b.y + i, b.w - cut * 2 - 2, 1)
    }
  }

  const bulb = (g: CanvasRenderingContext2D, x: number, y: number, color: string | null) => {
    fill(g, C.ink, x - 1, y - 1, 4, 4)
    fill(g, color ?? C.bulbOff, x, y, 2, 2)
    if (color) fill(g, '#ffffff', x, y, 1, 1)
  }

  /** What color bulb `i` of a ring burns now: chasing at rest, racing while the reels spin, all blinking on a win, a rainbow on the jackpot. */
  const bulbColor = (i: number, n: number): string | null => {
    const winning = winAge < 3.2 && shownWins.length > 0
    if (winning && jackpot) return RAINBOW[(i + Math.floor(clock * 14)) % RAINBOW.length]!
    if (winning) return (i + Math.floor(clock * 10)) % 2 === 0 ? C.bulbOn : C.gold
    const head = Math.floor(clock * (busy ? 18 : 6))
    return ((head - i) % n + n) % n % 5 < (busy ? 2 : 1) ? C.bulbOn : null
  }

  const drawBackdrop = (g: CanvasRenderingContext2D, w: number, hh: number) => {
    // The Game Corner's black brick wall, its red and gold tubes, and the carpet at the foot.
    fill(g, C.wall, 0, 0, w, hh)
    for (let y = 0; y < hh; y += 6) {
      fill(g, C.mortar, 0, y, w, 1)
      for (let x = (y / 6) % 2 ? -8 : 0; x < w; x += 16) fill(g, C.mortar, x, y, 1, 6)
    }
    const carpet = Math.round(hh * 0.78)
    fill(g, '#5a1018', 0, carpet, w, hh - carpet)
    for (let x = 0; x < w; x += 2) fill(g, '#64121e', x + ((carpet / 2) % 2), carpet + 1 + (x % 4 === 0 ? 2 : 0), 1, 1)
    fill(g, C.ink, 0, carpet - 3, w, 3)
    fill(g, C.goldLo, 0, carpet - 4, w, 1)
    for (const [y, core, glow] of [[10, '#ffd0c8', '#f03030'], [22, '#fff4c0', '#f8b818']] as const) {
      fill(g, glow, 0, y - 1, w, 3)
      fill(g, core, 0, y, w, 1)
    }
    // Other machines down the row, in the dark either side.
    const art = image('realm/corner/slot-red')
    const art2 = image('realm/corner/slot-purple')
    if (art && art2) {
      g.globalAlpha = 0.35
      const s = 2
      for (let i = 1; i < 6; i++) {
        for (const dir of [-1, 1]) {
          const x = Math.round(L.cab.x + L.cab.w / 2 + dir * (L.cab.w / 2 + 14 + (i - 0.5) * 60) - 27)
          const img = i % 2 ? art2 : art
          if (x > w || x + 54 < 0 || (L.side && x + 54 > L.side.x - 4 && x < L.side.x + L.side.w + 4)) continue
          g.drawImage(img, x, carpet - img.height * s + 6, img.width * s, img.height * s)
        }
      }
      g.globalAlpha = 1
    }
  }

  const drawCabinet = (g: CanvasRenderingContext2D) => {
    const b = L.cab
    // A shadow on the carpet, then the body: lacquered red with gold trim and chrome edges.
    fill(g, 'rgba(0,0,0,0.35)', b.x + 4, b.y + b.h - 2, b.w, 5)
    panel(g, { x: b.x, y: b.y + 10, w: b.w, h: b.h - 10 }, C.red, 3)
    fill(g, C.redHi, b.x + 3, b.y + 12, 2, b.h - 16)
    fill(g, C.redLo, b.x + b.w - 5, b.y + 12, 2, b.h - 16)
    // Columns of bulbs down both sides.
    const n = Math.floor((b.h - 30) / 7)
    for (let i = 0; i < n; i++) {
      bulb(g, b.x + 7, b.y + 22 + i * 7, bulbColor(i + 40, n + 40))
      bulb(g, b.x + b.w - 9, b.y + 22 + i * 7, bulbColor(i + 40, n + 40))
    }
    // The marquee: an arch of bulbs round a dark panel, sevens (or the win) in it.
    const mq = L.marquee
    panel(g, mq, C.goldLo, 6)
    panel(g, { x: mq.x + 3, y: mq.y + 3, w: mq.w - 6, h: mq.h - 6 }, '#1a0a10', 4, C.goldLo)
    fill(g, C.gold, mq.x + 6, mq.y + 1, mq.w - 12, 1)
    const ring: [number, number][] = []
    for (let x = mq.x + 8; x < mq.x + mq.w - 8; x += 6) ring.push([x, mq.y + 1])
    for (let y = mq.y + 7; y < mq.y + mq.h - 4; y += 6) ring.push([mq.x + mq.w - 3, y])
    for (let x = mq.x + mq.w - 10; x > mq.x + 6; x -= 6) ring.push([x, mq.y + mq.h - 3])
    for (let y = mq.y + mq.h - 9; y > mq.y + 4; y -= 6) ring.push([mq.x + 1, y])
    ring.forEach(([x, y], i) => bulb(g, x, y, bulbColor(i, ring.length)))
    const cx = mq.x + mq.w / 2
    const cy = mq.y + mq.h / 2
    if (shownWins.length > 0 && winAge < 3.2) {
      if (Math.floor(winAge * 6) % 4 !== 3) {
        const text = `+${lastWin}`
        const k = textWidth(text, 2) < mq.w - 20 ? 2 : 1
        drawText(g, text, cx, cy - (k === 2 ? 6 : 3), jackpot ? RAINBOW[Math.floor(clock * 8) % RAINBOW.length]! : C.gold, 'center', k)
      }
    } else {
      const seven = slotSymbol('seven')
      const glow = Math.floor(clock * 3) % 3
      for (let i = -1; i <= 1; i++) {
        const sx = Math.round(cx + i * (seven.width + 4) - seven.width / 2)
        const sy = Math.round(cy - seven.height / 2) - (glow === i + 1 ? 1 : 0)
        g.drawImage(seven, sx, sy)
      }
    }
    // The R badge between the marquee and the glass.
    const badgeY = mq.y + mq.h + 1
    fill(g, C.ink, cx - 5, badgeY, 10, 7)
    fill(g, C.gold, cx - 4, badgeY + 1, 8, 5)
    drawText(g, 'R', cx, badgeY, C.red, 'center', 1, C.gold)
  }

  const symbolAt = (pos: number, row: number) => STRIP[(((Math.floor(pos) + row - 1) % STRIP.length) + STRIP.length) % STRIP.length]!

  const drawReels = (g: CanvasRenderingContext2D) => {
    const W = L.win
    // The window: a chrome bezel, then gold, then the glass.
    panel(g, { x: W.x - 6, y: W.y - 6, w: W.w + 12, h: W.h + 12 }, C.chromeLo, 3)
    fill(g, C.chrome, W.x - 5, W.y - 5, W.w + 10, 1)
    fill(g, C.chrome, W.x - 5, W.y - 5, 1, W.h + 10)
    panel(g, { x: W.x - 3, y: W.y - 3, w: W.w + 6, h: W.h + 6 }, C.gold, 1)
    fill(g, C.ink, W.x - 1, W.y - 1, W.w + 2, W.h + 2)
    const scale = L.scale
    reels.forEach((r, i) => {
      const x = W.x + i * (L.cellW + 2)
      const y = W.y + (r.bump > 1 ? 1 : 0)
      fill(g, C.reel, x, W.y, L.cellW, W.h)
      g.save()
      g.beginPath()
      g.rect(x, W.y, L.cellW, W.h)
      g.clip()
      const base = Math.floor(r.pos)
      const frac = r.pos - base
      const fast = r.spinning && r.t > SPIN_UP + i * 0.07
      for (let row = -1; row <= 3; row++) {
        const sym = symbolAt(base, row)
        const art = fast ? smearOf(sym) : slotSymbol(sym)
        const dw = art.width * scale
        const dh = art.height * scale
        const cy = Math.round(y + (row - frac) * L.rowH + L.rowH / 2)
        g.drawImage(art, Math.round(x + (L.cellW - dw) / 2), Math.round(cy - dh / 2), dw, dh)
      }
      g.restore()
      // The reel's curve: darker toward its top and bottom edges.
      fill(g, 'rgba(60,30,20,0.28)', x, W.y, L.cellW, 3)
      fill(g, 'rgba(60,30,20,0.14)', x, W.y + 3, L.cellW, 3)
      fill(g, 'rgba(60,30,20,0.28)', x, W.y + W.h - 3, L.cellW, 3)
      fill(g, 'rgba(60,30,20,0.14)', x, W.y + W.h - 6, L.cellW, 3)
      if (i < 2) fill(g, C.ink, x + L.cellW, W.y, 2, W.h)
    })
    // The glass's shine: a pale stripe across the upper corner.
    g.fillStyle = 'rgba(255,255,255,0.16)'
    for (let k = 0; k < 10; k++) g.fillRect(W.x + 4 + k * 2, W.y + 2 + Math.max(0, 9 - k * 2), 2, 2)
    // The pay line across the middle row, and the lines the bet plays on lamps either side.
    const mid = W.y + L.rowH + Math.floor(L.rowH / 2)
    fill(g, 'rgba(232,40,48,0.55)', W.x, mid, W.w, 1)
    const lampY = (line: number) => (line === 0 ? mid : line === 1 || line === 3 ? W.y + Math.floor(L.rowH / 2) : W.y + W.h - Math.floor(L.rowH / 2))
    LINES[3].forEach((_, line) => {
      const on = line < LINES[bet].length
      const won = shownWins.some((wn) => wn.line === line) && Math.floor(winAge * 8) % 2 === 0
      const lit = won ? '#ffffff' : on ? C.gold : '#4a1810'
      // The diagonals' lamps sit beside the straight lines' they share a row with.
      const ly = lampY(line) + (line >= 3 ? (line === 3 ? 9 : -9) : 0)
      const ry = line >= 3 ? lampY(line === 3 ? 2 : 1) + (line === 3 ? -9 : 9) : ly
      for (const [lx, yy] of [[W.x - 13, ly], [W.x + W.w + 7, ry]] as const) {
        fill(g, C.ink, lx - 1, yy - 4, 8, 9)
        fill(g, lit, lx, yy - 3, 6, 7)
        drawText(g, String(line + 1), lx + 3, yy - 3, on || won ? C.ink : '#7a3020', 'center', 1, lit)
      }
    })
    // A winning line drawn through its squares, blinking.
    if (shownWins.length > 0 && Math.floor(winAge * 6) % 2 === 0)
      for (const wn of shownWins) {
        const rows = LINES[3][wn.line]!
        const color = wn.symbol === 'seven' ? '#ffffff' : '#f8f020'
        for (let i = 0; i < 3; i++) {
          const x = W.x + i * (L.cellW + 2)
          const y = W.y + rows[i]! * L.rowH
          g.strokeStyle = color
          g.lineWidth = 1
          g.strokeRect(x + 1.5, y + 1.5, L.cellW - 3, L.rowH - 3)
        }
        g.fillStyle = color
        for (let i = 0; i < 2; i++) {
          const x0 = W.x + i * (L.cellW + 2) + L.cellW / 2
          const x1 = x0 + L.cellW + 2
          const y0 = W.y + rows[i]! * L.rowH + L.rowH / 2
          const y1 = W.y + rows[i + 1]! * L.rowH + L.rowH / 2
          const steps = Math.ceil(x1 - x0)
          for (let s = 0; s <= steps; s++) g.fillRect(Math.round(x0 + s), Math.round(y0 + ((y1 - y0) * s) / steps) - 1, 1, 2)
        }
      }
  }

  const drawReadout = (g: CanvasRenderingContext2D) => {
    const r = L.readout
    panel(g, r, C.lcd, 2, C.goldLo)
    g.drawImage(SWEEP_ART.token(), r.x + 4, r.y + 4)
    drawText(g, state ? String(state.tokens) : '...', r.x + 18, r.y + 6, '#ffffff', 'left')
    // The last win, in gold.
    if (lastWin > 0) drawText(g, `+${lastWin}`, r.x + r.w - 5, r.y + 6, C.gold, 'right')
  }

  /** A round button with a rim under it that it sinks into when pressed. */
  const button = (g: CanvasRenderingContext2D, b: Round, color: string, hi: string, lo: string, down: boolean) => {
    const sink = down ? 3 : 0
    const circle = (cx: number, cy: number, r: number, paint: (dy: number) => string) => {
      for (let dy = -r; dy <= r; dy++) {
        const span = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)))
        fill(g, paint(dy), cx - span, cy + dy, span * 2, 1)
      }
    }
    circle(b.x, b.y + 4, b.r + 2, () => C.ink)
    circle(b.x, b.y + 4, b.r + 1, () => '#3a1c10')
    circle(b.x, b.y + sink, b.r + 1, () => C.ink)
    circle(b.x, b.y + sink, b.r, (dy) => (dy < -b.r / 2 ? hi : dy > b.r / 2 ? lo : color))
    fill(g, '#ffffff', b.x - Math.round(b.r / 2), b.y + sink - Math.round(b.r * 0.6), 3, 2)
    return sink
  }

  const drawDeck = (g: CanvasRenderingContext2D) => {
    const y = L.bet.y - L.bet.r - 7
    // The deck: a sloped black panel with a chrome lip.
    panel(g, { x: L.cab.x + 12, y, w: L.cab.w - 24, h: L.bet.r * 2 + 16 }, '#241418', 2)
    fill(g, C.chrome, L.cab.x + 13, y + 1, L.cab.w - 26, 1)
    // BET: gold, a token per line group on it, its three lamps under it.
    const sink = button(g, L.bet, '#d8a020', '#f8d048', '#a06c10', betHeld)
    g.drawImage(SWEEP_ART.token(), L.bet.x - 14, L.bet.y - 5 + sink)
    drawText(g, String(spinCost(bet)), L.bet.x + 5, L.bet.y - 6 + sink, '#5a3008', 'center', 2, '#f8d048')
    BETS.forEach((k) => fill(g, k <= bet ? C.gold : '#503010', L.bet.x - 9 + (k - 1) * 7, L.bet.y + L.bet.r + 5, 5, 2))
    // SPIN: red, a white arrow; it glows while it waits.
    const ready = !busy && (state?.tokens ?? 0) >= spinCost(bet)
    const s2 = button(g, L.spin, busy ? '#802028' : '#e02830', busy ? '#a04048' : ready && Math.floor(clock * 2) % 2 ? '#ff9090' : '#ff6a6a', '#901820', spinHeld || busy)
    for (let i = 0; i < 8; i++) fill(g, '#ffffff', L.spin.x - 3 + i, L.spin.y - 8 + i + s2, 1, 16 - i * 2)
  }

  const drawLever = (g: CanvasRenderingContext2D) => {
    const lv = L.lever
    // Its housing on the cabinet's side, then the rod (shorter as it swings toward us) and the red ball.
    panel(g, { x: lv.x - 3, y: lv.y - 7, w: 9, h: 14 }, C.chromeLo, 2)
    fill(g, C.chrome, lv.x - 2, lv.y - 6, 1, 12)
    const k = knob()
    const top = Math.min(lv.y, k.y)
    const bottom = Math.max(lv.y, k.y)
    fill(g, C.ink, lv.x + 4, top, 4, bottom - top + 1)
    fill(g, C.chrome, lv.x + 5, top, 2, bottom - top + 1)
    fill(g, '#ffffff', lv.x + 5, top, 1, bottom - top + 1)
    for (let dy = -k.r; dy <= k.r; dy++) {
      const span = Math.round(Math.sqrt(k.r * k.r - dy * dy))
      fill(g, C.ink, k.x - span - 1, k.y + dy, span * 2 + 2, 1)
      fill(g, dy < -2 ? C.redHi : C.red, k.x - span, k.y + dy, span * 2, 1)
    }
    fill(g, '#ffd0d0', k.x - 3, k.y - 3, 2, 2)
  }

  const drawPaytable = (g: CanvasRenderingContext2D) => {
    const p = L.pay
    panel(g, p, '#1a0a10', 2, C.goldLo)
    fill(g, C.gold, p.x + 2, p.y + 1, p.w - 4, 1)
    // Seven rows of three of a kind and the Oran on the left, in two columns when it's wide enough.
    const rows: { sym: SlotSymbol; n: number; pay: number }[] = [...SYMBOLS.map((s) => ({ sym: s, n: 3, pay: PAYS[s] })), { sym: 'oran', n: 1, pay: ORAN_LEFT }]
    const cols = p.w >= 120 ? 2 : 1
    const per = Math.ceil(rows.length / cols)
    const rowH = Math.max(9, Math.min(14, Math.floor((p.h - 6) / per)))
    const colW = Math.floor((p.w - 6) / cols)
    const mini = rowH >= 13 ? 1 : 0.5
    rows.forEach((r, i) => {
      const cx = p.x + 3 + Math.floor(i / per) * colW
      const cy = p.y + 4 + (i % per) * rowH
      const art = slotSymbol(r.sym)
      const s = mini === 1 ? 1 : 0.5
      const aw = Math.ceil(art.width * s)
      const ah = Math.ceil(art.height * s)
      for (let k = 0; k < 3; k++) {
        const ax = cx + k * (aw + 1)
        if (k < r.n) g.drawImage(art, ax, cy + Math.round((rowH - 1 - ah) / 2), aw, ah)
        else fill(g, '#5a3a40', ax + Math.floor(aw / 2) - 1, cy + Math.round(rowH / 2) - 1, 3, 1)
      }
      const hot = shownWins.some((wn) => wn.symbol === r.sym && (r.n === 3 ? wn.tokens === PAYS[r.sym] : wn.tokens === ORAN_LEFT)) && Math.floor(winAge * 8) % 2 === 0
      drawText(g, String(r.pay), cx + colW - 4, cy + Math.round((rowH - 7) / 2), hot ? '#ffffff' : C.gold, 'right')
    })
  }

  const drawTray = (g: CanvasRenderingContext2D) => {
    const tr = L.tray
    // The chute's mouth over the tray, then the tray (chrome, dark inside) and its pile of tokens.
    panel(g, { x: tr.x + tr.w / 2 - 9, y: tr.y - 7, w: 18, h: 7 }, '#120a0e', 2, C.chromeLo)
    panel(g, tr, '#241418', 2, C.chromeLo)
    fill(g, C.chrome, tr.x + 2, tr.y + 1, tr.w - 4, 1)
    const token = SWEEP_ART.token()
    const heaped = Math.round(pile * 14)
    for (let i = 0; i < heaped; i++) {
      const x = tr.x + 4 + ((i * 37) % Math.max(1, tr.w - 16))
      const y = tr.y + tr.h - 9 - (i % 3) - Math.floor(i / 6)
      g.drawImage(token, Math.round(x), Math.round(y))
    }
    for (const coin of coins) g.drawImage(token, Math.round(coin.x), Math.round(coin.y))
  }

  const drawSide = (g: CanvasRenderingContext2D) => {
    if (!L.side) return
    // Sideways: a lit panel on the wall beside the machine with the credits and the paytable.
    const s = L.side
    panel(g, { x: s.x - 2, y: s.y - 2, w: s.w + 4, h: s.h + 4 }, C.goldLo, 3)
    panel(g, s, '#140a10', 2, C.gold)
    // Under the paytable, the five lines as little grids, lit as the bet plays them.
    const n = LINES[3].length
    const gw = 13
    const gap = Math.floor((s.w - 16 - n * gw) / (n - 1))
    LINES[3].forEach((rows, line) => {
      const gx = s.x + 8 + line * (gw + gap)
      const gy = s.y + s.h - 22
      const on = line < LINES[bet].length
      const won = shownWins.some((wn) => wn.line === line) && Math.floor(winAge * 8) % 2 === 0
      panel(g, { x: gx, y: gy, w: gw, h: gw }, '#2a1418', 1, on ? C.goldLo : '#3a2024')
      rows.forEach((row, reel) => fill(g, won ? '#ffffff' : on ? C.gold : '#5a3a30', gx + 2 + reel * 3, gy + 2 + row * 3, 3, 3))
      drawText(g, String(line + 1), gx + gw / 2, gy + gw + 1, on ? C.gold : '#5a3a30', 'center')
    })
  }

  const draw = (g: CanvasRenderingContext2D) => {
    const w = g.canvas.width
    const hh = g.canvas.height
    const k = g.canvas.clientWidth / Math.max(1, w) || 2
    view.w = w
    view.h = hh
    sheet.track()
    foot = Math.max(foot, Math.ceil(56 / k), hh - sheet.free().h)
    L = layoutOf(w, hh, foot)
    drawBackdrop(g, w, hh)
    drawSide(g)
    drawCabinet(g)
    drawReels(g)
    drawReadout(g)
    drawDeck(g)
    drawLever(g)
    drawPaytable(g)
    drawTray(g)
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

/** The canvas for a stage of this CSS size: as large a pixel as the machine allows, whole device pixels. */
const fluid = (stageW: number, stageH: number) => {
  const dpr = window.devicePixelRatio || 1
  const tall = stageH > stageW * 1.15
  const need = tall ? { w: 186, h: 330 } : { w: 330, h: 200 }
  const raw = Math.min(stageW / need.w, stageH / need.h, 4)
  const k = Math.max(1, Math.floor(raw * dpr) / dpr)
  return { w: Math.floor(stageW / k), h: Math.floor(stageH / k) }
}

/** The Game Corner's slots (`MINIGAMES.slots`); the machine fills the screen whichever way the phone is held. */
export const slots: SoloGame = {
  size: { w: 196, h: 360 },
  fluid,
  start,
}

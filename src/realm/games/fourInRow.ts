import { PLAYABLE } from '../../data/hatchlings'
import { playSfx, type Sfx } from '../../engine/audio'
import type { Dir8 } from '../../engine/math'
import { blitPacked, context2d, createCanvas, fromStrings, textSprite, type PixelSprite } from '../../engine/pixelart'
import { locale, t } from '../../i18n'
import { TABLE, type TableView } from '../../net/realmTables'
import { drawPokemon, loadSpecies, sprites } from '../../render/sprites'
import type { Sitter, TableCtx, TableRun, TableUi } from './frame'
import { COLS, ROWS, cellOf, fourInRowRules, landing, type FourState } from './fourInRow.rules'

/**
 * Four in a Row's screen (`MINIGAMES.fourInRow`): the café's wooden stand on
 * a table, Poké Balls (seat 0) against Great Balls (seat 1), the two
 * partners sitting at the table's corners, and the players' chips on top
 * (whose turn, the turn clock).
 *
 * Touch first: press anywhere over a column to hold a token over it, slide to
 * change it, lift to drop (a tap drops at once); with a mouse the token
 * follows the pointer; ←/→ and Space/Enter/↓ on a keyboard. A drop falls
 * behind the stand's holes and bounces as it lands (a hit pause, dust, a
 * knock); the winning line flashes and confetti flies. The screen moves its
 * own token as soon as it's dropped and keeps it once the table agrees.
 *
 * 184 × 152: twice that fits a phone held either way (safe areas and the
 * frame's header included).
 */

const W = 184
const H = 152
const CELL = 16
/** The stand: its holes' area, and its wooden rim around them. */
const RIM = 4
const BOARD_X = (W - COLS * CELL) / 2
const BOARD_Y = 38
const BOARD_W = COLS * CELL
const BOARD_H = ROWS * CELL
/** Where a token waits over the stand before it's dropped (its center). */
const HOVER_Y = BOARD_Y - RIM - 8
/** The table's edge the stand stands on. */
const TABLE_Y = BOARD_Y + BOARD_H + RIM + 2

/** The drop: px/s² down, how much of its speed a bounce keeps, and the bounce that settles it. */
const FALL = { gravity: 1500, bounce: 0.28, rest: 40 }
const HIT_PAUSE = 0.05
const SHAKE = 0.14

/* ---------------- Art ---------------- */

const WOOD = { out: '#2d2923', light: '#d39365', mid: '#b47c52', dark: '#996947', deep: '#634328', back: '#292520' }

/** The tokens, 12 × 12: Poké Ball (seat 0) and Great Ball (seat 1). */
const BALL = [
  '....kkkk....',
  '..kkttttkk..',
  '.kttttthhtk.',
  '.kttsttthtk.',
  'kTttsttttttk',
  'kTTTkkkkTTTk',
  'kkkkkwwkkkkk',
  'kwwwkwwkwwgk',
  '.kwwwkkwwwgk',
  '.kgwwwwwwggk',
  '..kkggggkk..',
  '....kkkk....',
]
const BALL_PALETTES = [
  { k: '#202028', t: '#e83830', T: '#a82018', h: '#ffa090', s: '#e83830', w: '#f8f8f8', g: '#c0c0cc' },
  { k: '#202028', t: '#3874e0', T: '#1c4aa8', h: '#a0c8ff', s: '#e83830', w: '#f8f8f8', g: '#c0c0cc' },
] as const

type Art = { tokens: readonly [PixelSprite, PixelSprite]; stand: PixelSprite; room: PixelSprite; ring: PixelSprite }

let art: Art | null = null

/** A filled pixel disc of diameter `d` (whole px, hard-edged) as a mask test. */
const inDisc = (x: number, y: number, d: number) => {
  const r = d / 2
  return (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r
}

/** The wooden stand: its rim, the holes cut out (a shadow on their top-left, light on their bottom-right) and its two feet. */
const buildStand = (): PixelSprite => {
  const w = BOARD_W + RIM * 2
  const h = BOARD_H + RIM * 2 + 4
  const canvas = createCanvas(w, h)
  const g = context2d(canvas)
  const px = (x: number, y: number, c: string) => {
    g.fillStyle = c
    g.fillRect(x, y, 1, 1)
  }
  const fh = BOARD_H + RIM * 2
  g.fillStyle = WOOD.out
  g.fillRect(0, 0, w, fh)
  g.fillStyle = WOOD.mid
  g.fillRect(1, 1, w - 2, fh - 2)
  g.fillStyle = WOOD.light
  g.fillRect(1, 1, w - 2, 1)
  g.fillRect(1, 1, 1, fh - 2)
  g.fillStyle = WOOD.dark
  g.fillRect(1, fh - 2, w - 2, 1)
  g.fillRect(w - 2, 1, 1, fh - 2)
  // The grain: a light streak down each column's divider.
  for (let c = 1; c < COLS; c++) {
    g.fillStyle = WOOD.light
    g.fillRect(RIM + c * CELL - 1, RIM, 1, BOARD_H)
    g.fillStyle = WOOD.dark
    g.fillRect(RIM + c * CELL, RIM, 1, BOARD_H)
  }
  const d = 13
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ox = RIM + c * CELL + 1
      const oy = RIM + r * CELL + 1
      for (let y = -1; y <= d; y++)
        for (let x = -1; x <= d; x++) {
          if (inDisc(x, y, d)) {
            g.clearRect(ox + x, oy + y, 1, 1)
            continue
          }
          // The hole's lip: dark where it turns away from the light, light where it faces it.
          const nearHole = inDisc(x - 1, y, d) || inDisc(x + 1, y, d) || inDisc(x, y - 1, d) || inDisc(x, y + 1, d)
          if (!nearHole) continue
          px(ox + x, oy + y, x + y < d ? WOOD.deep : WOOD.light)
        }
    }
  // The feet.
  for (const fx of [6, w - 14]) {
    g.fillStyle = WOOD.out
    g.fillRect(fx, fh - 1, 8, 5)
    g.fillStyle = WOOD.dark
    g.fillRect(fx + 1, fh, 6, 3)
  }
  return canvas
}

/** The café behind the stand: its striped wall, the wainscot, and the table top the stand stands on. */
const buildRoom = (): PixelSprite => {
  const canvas = createCanvas(W, H)
  const g = context2d(canvas)
  for (let x = 0; x < W; x += 8) {
    g.fillStyle = '#f1e2bd'
    g.fillRect(x, 0, 4, TABLE_Y)
    g.fillStyle = '#e7d2a6'
    g.fillRect(x + 4, 0, 4, TABLE_Y)
  }
  g.fillStyle = '#c99a66'
  g.fillRect(0, TABLE_Y - 34, W, 34)
  g.fillStyle = '#b48455'
  for (let x = 6; x < W; x += 22) g.fillRect(x, TABLE_Y - 30, 14, 24)
  g.fillStyle = '#9a6c42'
  g.fillRect(0, TABLE_Y - 35, W, 2)
  // The table top, its front edge and planks.
  g.fillStyle = WOOD.out
  g.fillRect(0, TABLE_Y - 1, W, 1)
  g.fillStyle = '#f1b071'
  g.fillRect(0, TABLE_Y, W, H - TABLE_Y)
  g.fillStyle = '#d39365'
  g.fillRect(0, TABLE_Y + 7, W, 1)
  for (let x = 30; x < W; x += 58) g.fillRect(x, TABLE_Y, 1, 7)
  for (let x = 4; x < W; x += 58) g.fillRect(x, TABLE_Y + 8, 1, H - TABLE_Y - 8)
  g.fillStyle = '#ffd09a'
  g.fillRect(0, TABLE_Y, W, 1)
  return canvas
}

/** A ring round a token of the winning line (it blinks). */
const buildRing = (): PixelSprite => {
  const canvas = createCanvas(16, 16)
  const g = context2d(canvas)
  g.fillStyle = '#fff6a0'
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inDisc(x, y, 16) && !inDisc(x - 1, y - 1, 14)) g.fillRect(x, y, 1, 1)
  return canvas
}

const artOf = (): Art =>
  (art ??= {
    tokens: [fromStrings(BALL, BALL_PALETTES[0]), fromStrings(BALL, BALL_PALETTES[1])],
    stand: buildStand(),
    room: buildRoom(),
    ring: buildRing(),
  })

/* ---------------- Text ---------------- */

const texts = new Map<string, PixelSprite>()

/**
 * A line of the player's language in the game's pixel font (Cubic 11 for
 * Chinese), every pixel fully on or off, with a dark outline: cached once
 * the font has loaded (drawn with a stand-in before).
 */
const label = (text: string, color: string): PixelSprite => {
  const cjk = locale() === 'zh'
  const size = cjk ? 12 : 8
  const font = `${size}px "Press Start 2P", "Cubic 11", monospace`
  const key = `${font}|${color}|${text}`
  const hit = texts.get(key)
  if (hit) return hit
  const probe = context2d(createCanvas(1, 1))
  probe.font = font
  const tw = Math.ceil(probe.measureText(text).width)
  const mask = createCanvas(tw + 2, size + 4)
  const mg = mask.getContext('2d', { willReadFrequently: true })
  const out = createCanvas(tw + 4, size + 6)
  if (!mg) return out
  mg.font = font
  mg.textBaseline = 'top'
  mg.fillStyle = '#fff'
  mg.fillText(text, 1, cjk ? 1 : 2)
  const img = mg.getImageData(0, 0, mask.width, mask.height)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! >= 110 ? 255 : 0
  mg.putImageData(img, 0, 0)
  const g = context2d(out)
  const tinted = (c: string) => {
    const s = createCanvas(mask.width, mask.height)
    const sg = context2d(s)
    sg.drawImage(mask, 0, 0)
    sg.globalCompositeOperation = 'source-in'
    sg.fillStyle = c
    sg.fillRect(0, 0, s.width, s.height)
    return s
  }
  const edge = tinted('#202028')
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [2, 2]] as const) g.drawImage(edge, dx, dy)
  g.drawImage(tinted(color), 1, 1)
  if (document.fonts.check(font, text)) texts.set(key, out)
  return out
}

const centered = (g: CanvasRenderingContext2D, s: PixelSprite, x: number, y: number) => g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2))

/* ---------------- The screen ---------------- */

/** A token on its way down: its cell, seat, height (center y) and speed; `sure` once the table shows it. */
type Fall = { cell: number; seat: 0 | 1; y: number; vy: number; bounced: boolean; sure: boolean; age: number }

type Bit = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }

/** The bot's stand-in look: Porygon, the computer's own Pokémon. */
const BOT: Sitter = { handle: '', partner: 'porygon', shiny: false }
const BOT_DEX = 137

/** The most of a handle a chip shows (8 px a letter). */
const NAME_MAX = 8

const dexOf = (partner: string) => (Object.hasOwn(PLAYABLE, partner) ? PLAYABLE[partner as keyof typeof PLAYABLE].line[0].dex : partner === 'porygon' ? BOT_DEX : 25)

const centerX = (col: number) => BOARD_X + col * CELL + CELL / 2
const centerY = (row: number) => BOARD_Y + row * CELL + CELL / 2

const start = (ctx: TableCtx): TableRun => {
  const { source } = ctx
  const ft = () => t().minigames.fourInRow
  let raw: unknown = undefined
  let state: FourState | null = null
  let board: readonly number[] = []
  let fall: Fall | null = null
  let bits: Bit[] = []
  let hover = 3
  let pressed = false
  let pause = 0
  let shake = 0
  let clock = 0
  let nudge = 0
  /** When the line was first seen (s), for the flash and the confetti. */
  let wonAt: number | null = null
  let turnAt: number | null = null
  let ticked = -1
  let lastPhase: TableView['phase'] | null = null
  const loaded = new Set<number>()

  const sound = (s: Sfx) => playSfx(s)

  const sitter = (tb: TableView | null, seat: number): Sitter | null => {
    const id = tb?.seats[seat] ?? null
    if (id === null) return null
    if (id < 0) return BOT
    const mine = source.seat() === seat
    return ctx.who(id) ?? (mine ? { handle: '', partner: ctx.partner, shiny: ctx.shiny } : null)
  }

  /** A seat's name on its chip: the trainer's handle (cut to fit), "you" on this device's own table, or the bot. */
  const nameOf = (tb: TableView | null, seat: number): PixelSprite | null => {
    const who = sitter(tb, seat)
    if (!who) return null
    const name = who === BOT ? ft().bot : who.handle ? (who.handle.length > NAME_MAX ? `${who.handle.slice(0, NAME_MAX - 1)}.` : who.handle) : ft().you
    return label(name, '#f8f8f8')
  }


  const dust = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++)
      bits.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 40 - 10, life: 0.35 + Math.random() * 0.2, color: i % 2 ? '#f8e8c8' : '#c89868', size: 1 })
  }

  const confetti = (line: readonly number[]) => {
    const colors = ['#e83830', '#3874e0', '#f8d030', '#f8f8f8', '#58c058']
    for (const cell of line)
      for (let i = 0; i < 9; i++)
        bits.push({
          x: centerX(cell % COLS),
          y: centerY(Math.floor(cell / COLS)),
          vx: (Math.random() - 0.5) * 160,
          vy: -Math.random() * 150 - 40,
          life: 0.9 + Math.random() * 0.7,
          color: colors[(i + cell) % colors.length]!,
          size: 1 + (i % 2),
        })
  }

  /** Reads the table's state when it changes: a new drop by anyone but us falls, our own is kept, a new match clears. */
  const read = (tb: TableView | null) => {
    if (!tb || tb.view === raw) return
    raw = tb.view
    const next = tb.view === null ? null : fourInRowRules.parseView(tb.view)
    const before = board
    state = next
    board = next ? next.board : []
    if (!next || next.moves === 0) {
      fall = null
      wonAt = null
      return
    }
    if (fall && board[fall.cell] === fall.seat) fall.sure = true
    else if (fall && !fall.sure) fall = null
    const fresh = board.flatMap((v, i) => (v !== -1 && before[i] === -1 ? [i] : []))
    if (fresh.length === 1 && before.length > 0 && fresh[0] !== fall?.cell) {
      const cell = fresh[0]!
      const seat = board[cell] === 1 ? 1 : 0
      fall = { cell, seat, y: HOVER_Y, vy: 0, bounced: false, sure: true, age: 0 }
    }
  }

  const myTurn = () => {
    const tb = source.table()
    const seat = source.seat()
    return tb !== null && tb.phase === 'playing' && seat !== null && tb.pending.includes(seat) && fall?.seat !== seat
  }

  /** Our drop down `col`: it falls at once, and goes to the table. */
  const dropAt = (col: number) => {
    const seat = source.seat()
    if (!state || !myTurn() || (seat !== 0 && seat !== 1)) return
    const row = landing(state.board, col)
    if (row < 0) {
      nudge = 0.25
      return sound('denied')
    }
    sound('move')
    fall = { cell: cellOf(row, col), seat, y: HOVER_Y, vy: 0, bounced: false, sure: false, age: 0 }
    source.play(col)
  }

  const colAt = (x: number) => Math.max(0, Math.min(COLS - 1, Math.floor((x - BOARD_X) / CELL)))

  const step = (dt: number, input: Parameters<TableRun['step']>[1]) => {
    clock += dt
    const tb = source.table()
    read(tb)
    const seat = source.seat()
    // The partners' sprites, once.
    for (const s of [0, 1]) {
      const who = sitter(tb, s)
      const dex = who ? dexOf(who.partner) : null
      if (dex !== null && !loaded.has(dex)) {
        loaded.add(dex)
        void loadSpecies(dex, who?.shiny ?? false).catch(() => {})
      }
    }
    // A new match, a new turn, the clock's last seconds.
    if (tb && tb.phase !== lastPhase) {
      if (tb.phase === 'playing') wonAt = null
      lastPhase = tb.phase
    }
    if (myTurn()) {
      if (turnAt === null) {
        turnAt = clock
        sound('select')
      }
      const left = Math.ceil((tb?.leftMs ?? TABLE.turnMs) / 1000)
      if (left <= 5 && left !== ticked) {
        ticked = left
        sound('move')
      }
    } else turnAt = null

    // Input: the pointer holds the token over a column, the lift drops it; the keys move it.
    const p = input.pointer
    const over = p.x >= BOARD_X - 8 && p.x < BOARD_X + BOARD_W + 8 && p.y >= 0 && p.y < H
    if (over && (p.down || p.pressed || !pressed)) hover = colAt(p.x)
    if (p.pressed && over) pressed = true
    if (p.released && pressed) {
      pressed = false
      if (over) dropAt(colAt(p.x))
    }
    if (input.pressed('ArrowLeft') || input.pressed('KeyA')) hover = Math.max(0, hover - 1)
    if (input.pressed('ArrowRight') || input.pressed('KeyD')) hover = Math.min(COLS - 1, hover + 1)
    if (input.pressed('Space') || input.pressed('Enter') || input.pressed('ArrowDown') || input.pressed('KeyS')) dropAt(hover)

    // The fall, with its hit pause and knock.
    nudge = Math.max(0, nudge - dt)
    shake = Math.max(0, shake - dt)
    if (pause > 0) pause -= dt
    else if (fall) {
      fall.age += dt
      const target = centerY(Math.floor(fall.cell / COLS))
      fall.vy += FALL.gravity * dt
      fall.y += fall.vy * dt
      if (fall.y >= target) {
        fall.y = target
        if (!fall.bounced && fall.vy > FALL.rest) {
          fall.bounced = true
          fall.vy = -fall.vy * FALL.bounce
          pause = HIT_PAUSE
          shake = SHAKE
          dust(centerX(fall.cell % COLS), target + 6, 7)
          sound('hit')
        } else if (fall.sure) fall = null
        else fall.vy = 0
      }
      // A drop the table never took (refused, or lost) goes after a while.
      if (fall && !fall.sure && fall.age > 2.5) fall = null
    }
    // The end: the line flashes once its last token has landed.
    if (state?.line && !fall && wonAt === null) {
      wonAt = clock
      confetti(state.line)
      sound(state.winner === seat ? 'levelUp' : seat === null ? 'coin' : 'denied')
    } else if (tb?.phase === 'over' && !state?.line && !fall && wonAt === null && tb.result) {
      wonAt = clock
      sound(tb.result.forfeit !== null && tb.result.winner === seat ? 'levelUp' : 'move')
    }
    bits = bits.filter((b) => {
      b.life -= dt
      b.vy += 300 * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      return b.life > 0
    })
  }

  /** A player's chip on top: the token, the name (handle or "you"/"Bot"), and the turn clock under it when it's theirs. */
  const chip = (g: CanvasRenderingContext2D, tb: TableView | null, seat: number, right: boolean, time: number) => {
    const a = artOf()
    const cw = 88
    const x0 = right ? W - cw - 2 : 2
    const active = tb?.phase === 'playing' && tb.pending.includes(seat)
    g.fillStyle = '#202028'
    g.fillRect(x0 + 1, 1, cw - 2, 16)
    g.fillRect(x0, 2, cw, 14)
    g.fillStyle = active ? '#3c4870' : '#2c3048'
    g.fillRect(x0 + 1, 2, cw - 2, 14)
    if (active) {
      g.fillStyle = '#5868a0'
      g.fillRect(x0 + 1, 2, cw - 2, 1)
    }
    const tokenX = right ? x0 + cw - 8 : x0 + 8
    const bob = active ? Math.round(Math.sin(time * 6)) : 0
    centered(g, a.tokens[seat === 0 ? 0 : 1], tokenX, 9 + bob)
    const named = nameOf(tb, seat)
    const nx = right ? x0 + cw - 15 : x0 + 15
    if (named) g.drawImage(named, right ? nx - named.width : nx, 9 - Math.floor(named.height / 2))
    else {
      const dots = textSprite('.'.repeat(1 + (Math.floor(time * 3) % 3)), '#a0a8c0')
      blitPacked(g, dots, right ? nx - 6 : nx + 6, 9)
    }
    if (active && tb?.leftMs !== null && tb?.leftMs !== undefined) {
      const share = Math.max(0, Math.min(1, tb.leftMs / TABLE.turnMs))
      const bw = Math.round((cw - 4) * share)
      g.fillStyle = '#202028'
      g.fillRect(x0 + 2, 17, cw - 4, 3)
      g.fillStyle = share > 0.5 ? '#58c058' : share > 0.2 ? '#f8c830' : Math.floor(time * 6) % 2 ? '#f85838' : '#f8a088'
      g.fillRect(right ? x0 + 2 + (cw - 4 - bw) : x0 + 2, 18, bw, 1)
    }
  }

  /** A partner at the table's corner, facing the stand: it hops when its seat wins and winces when it loses. */
  const partner = (g: CanvasRenderingContext2D, tb: TableView | null, seat: number, right: boolean, time: number) => {
    const who = sitter(tb, seat)
    if (!who) return
    const s = sprites(dexOf(who.partner), who.shiny)
    const won = wonAt !== null && tb?.result?.winner === seat
    const lost = wonAt !== null && tb?.result && tb.result.winner !== null && tb.result.winner !== seat
    const hop = won ? Math.round(Math.abs(Math.sin((time - (wonAt ?? 0)) * 9)) * 5) : 0
    const dir: Dir8 = right ? 6 : 2
    drawPokemon(g, s, lost && time - (wonAt ?? 0) < 1.2 ? 'Hurt' : 'Idle', dir, time, right ? W - 15 : 15, H - 2 - hop)
  }

  const draw = (g: CanvasRenderingContext2D, time: number) => {
    const a = artOf()
    const tb = source.table()
    const seat = source.seat()
    const left = seat === 1 ? 1 : 0
    g.drawImage(a.room, 0, 0)
    const sy = shake > 0 ? (Math.floor(time * 40) % 2 === 0 ? 1 : 0) : 0
    // Behind the holes: the dark back, the tokens, the one falling.
    g.fillStyle = WOOD.back
    g.fillRect(BOARD_X, BOARD_Y + sy, BOARD_W, BOARD_H)
    const flash = wonAt !== null && Math.floor((time - wonAt) * 6) % 2 === 0
    const line = new Set(state?.line ?? [])
    for (let i = 0; i < board.length; i++) {
      const v = board[i]
      if (v === -1 || v === undefined || i === fall?.cell) continue
      centered(g, a.tokens[v === 1 ? 1 : 0], centerX(i % COLS), centerY(Math.floor(i / COLS)) + sy)
    }
    if (fall) centered(g, a.tokens[fall.seat], centerX(fall.cell % COLS), Math.round(fall.y) + sy)
    g.drawImage(a.stand, BOARD_X - RIM, BOARD_Y - RIM + sy)
    // The winning line: rings blinking round its tokens.
    if (wonAt !== null && !fall) for (const cell of line) if (flash) centered(g, a.ring, centerX(cell % COLS), centerY(Math.floor(cell / COLS)) + sy)

    // Over the stand: the token held, and a column's glow, on our turn.
    if (myTurn() && state) {
      const x = centerX(hover) + (nudge > 0 ? (Math.floor(time * 30) % 2 ? 2 : -2) : 0)
      const full = landing(state.board, hover) < 0
      g.globalAlpha = full ? 0.35 : 0.22
      g.fillStyle = full ? '#f85838' : '#fff8d8'
      g.fillRect(BOARD_X + hover * CELL + 1, BOARD_Y, CELL - 2, BOARD_H)
      g.globalAlpha = 1
      centered(g, a.tokens[seat === 1 ? 1 : 0], x, HOVER_Y + Math.round(Math.sin(time * 5)))
    }

    partner(g, tb, left, false, time)
    partner(g, tb, 1 - left, true, time)
    chip(g, tb, left, false, time)
    chip(g, tb, 1 - left, true, time)

    for (const b of bits) {
      g.fillStyle = b.color
      g.fillRect(Math.round(b.x), Math.round(b.y), b.size, b.size)
    }

    // The word of the moment: your turn (as it comes), the four, waiting on the other's rematch.
    const banner = (text: string, color: string, y: number) => centered(g, label(text, color), W / 2, y)
    if (turnAt !== null && time - turnAt < 1.4 && Math.floor((time - turnAt) * 8) % 8 !== 7) banner(ft().yourTurn, '#f8e070', BOARD_Y + BOARD_H / 2 - Math.max(0, Math.round((0.12 - (time - turnAt)) * 80)))
    if (wonAt !== null && state?.line && time - wonAt < 1.6) banner(ft().four, '#f8e070', BOARD_Y + BOARD_H / 2)
    if (wonAt !== null && tb?.phase === 'over' && !state?.line && tb.result?.winner === null && time - wonAt < 1.6) banner(ft().draw, '#f8f8f8', BOARD_Y + BOARD_H / 2)
    if (tb?.phase === 'over' && seat !== null && tb.seats[seat] !== null && tb.ready.includes(tb.seats[seat]!)) {
      const other = sitter(tb, 1 - seat)
      if (other) banner(ft().waitingReady(other === BOT ? ft().bot : other.handle ? `@${other.handle}` : ft().you), '#f8f8f8', BOARD_Y + BOARD_H / 2)
    }
    if (myTurn() && state && state.moves < 2 && (turnAt === null || time - turnAt >= 1.4)) banner(ft().tap, '#f8f8f8', TABLE_Y + 9)
  }

  return { step, draw }
}

export const fourInRow: TableUi = { size: { w: W, h: H }, start, outro: 1.8 }

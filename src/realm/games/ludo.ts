import { playSfx } from '../../engine/audio'
import type { Dir8 } from '../../engine/math'
import { canvasCache, context2d, createCanvas, fromStrings, lazy, type PixelSprite } from '../../engine/pixelart'
import { t } from '../../i18n'
import type { TableView } from '../../net/realmTables'
import { drawPokemon, sprites } from '../../render/sprites'
import { INK, SEAT_COLORS, balls, box, burst, button, centered, clip, drawBits, wrap, fluidSize, inside, label, loadSeated, miniBalls, seatedAt, stepBits, tableTop, type Bit, type Rect, type Seated } from './cafeKit'
import type { GameInput, TableCtx, TableRun, TableUi } from './frame'
import { GOAL, LUDO, YARD, isSafe, legalPieces, ludoRules, target, type LudoEvent, type LudoView } from './ludo.rules'
import { CENTER, LANE0, SIZE, TRACK, YARD0, cellAt, rotate, yardOf, type Cell } from './ludoBoard'

/**
 * Ludo's screen (`MINIGAMES.ludo`, rules in `ludo.rules.ts`, board in
 * `ludoBoard.ts`): the board turned so your yard is bottom left, each yard
 * holding its seat's Pokémon (the trainer's partner, or a bot's) and its two
 * Poké Balls, and a dock beside the board (below it on a phone held upright)
 * with the die, the Roll button, what to do now and the four seats.
 *
 * Tap Rolar (or the die, or Space) to roll; with two pieces that can move,
 * tap the one to move (anywhere near it or the square it would land on; keys
 * 1 and 2); with one, it moves by itself. The screen plays the table's
 * events (`LudoView.events`) one by one, a beat behind: the die tumbling,
 * the piece hopping square by square, a rival knocked back to its yard. The
 * canvas follows the stage (`fluidSize`), laid out every frame.
 */

/** Seconds: a die's tumble, a hop, a knocked piece's flight home, a stuck roll's pause, a note's life. */
const BEAT = { tumble: 0.5, hop: 0.11, home: 0.38, stuck: 0.45, note: 1.4, auto: 0.35 } as const

/* ---------------- Layout ---------------- */

type Layout = { cell: number; board: Rect; dock: Rect; wide: boolean }

/** The board as big as fits (beside the dock when the canvas is wide, above it when tall). */
const layoutOf = (w: number, h: number): Layout => {
  const wide = w > h * 1.15
  if (wide) {
    const cell = Math.floor((h - 6) / SIZE)
    const side = cell * SIZE
    const dockW = Math.min(184, w - side - 12)
    const x = Math.floor((w - side - dockW - 6) / 2)
    return { wide, cell, board: { x, y: Math.floor((h - side) / 2), w: side, h: side }, dock: { x: x + side + 6, y: 4, w: dockW, h: h - 8 } }
  }
  const cell = Math.floor(Math.min((w - 6) / SIZE, (h * 0.6) / SIZE))
  const side = cell * SIZE
  const y = 4
  return { wide, cell, board: { x: Math.floor((w - side) / 2), y, w: side, h: side }, dock: { x: 4, y: y + side + 5, w: w - 8, h: h - (y + side + 5) - 3 } }
}

/* ---------------- Art ---------------- */

const BOARD = { paper: '#f4ead2', line: '#c8b48c', edge: '#8c7454', square: '#fbf6ea', shade: '#e2d4b4' } as const

/** A 5 × 5 star for the safe start squares. */
const STAR = ['..w..', '.www.', 'wwwww', '.www.', '.w.w.']
const stars = lazy(() => fromStrings(STAR, { w: '#fffbe8' }))

/** The die's pips, on a 3 × 3 grid, for each face. */
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}

/** A die face, 22 × 22: white, lit top left, its pips in the seat's color. */
const dice = canvasCache<string, PixelSprite>()
const die = (face: number, seat: number) => {
  const key = `${face}|${seat}`
  const hit = dice.get(key)
  if (hit) return hit
  const c = createCanvas(22, 22)
  const g = context2d(c)
  box(g, 0, 0, 22, 22, INK)
  box(g, 1, 1, 20, 20, '#d8d0c0')
  box(g, 1, 1, 20, 18, '#fbf8f0')
  g.fillStyle = '#ffffff'
  g.fillRect(3, 2, 15, 1)
  const col = SEAT_COLORS[seat]!
  for (const [px, py] of PIPS[face] ?? []) {
    const x = 4 + px * 5
    const y = 3 + py * 5
    g.fillStyle = col.dark
    g.fillRect(x, y, 4, 4)
    g.fillStyle = face === 6 ? col.mid : col.dark
    g.fillRect(x, y, 3, 3)
  }
  dice.set(key, c)
  return c
}

/**
 * The board for a cell size and a turn of the view: paper, the yards in
 * their seats' colors, the squares round (the starts colored and starred),
 * the lanes, and the goal's four triangles.
 */
const boards = canvasCache<string, PixelSprite>()
const boardArt = (cell: number, view: number) => {
  const key = `${cell}|${view}`
  const hit = boards.get(key)
  if (hit) return hit
  const side = cell * SIZE
  const c = createCanvas(side + 2, side + 4)
  const g = context2d(c)
  // Paper, its edge and a shadow under it.
  box(g, 0, 2, side + 2, side + 2, '#00000055')
  box(g, 0, 0, side + 2, side + 2, BOARD.edge)
  box(g, 1, 1, side, side, BOARD.paper)
  const at = (cl: Cell) => rotate(cl, view)
  const sq = (cl: Cell, fill: string, edge: string) => {
    const [x, y] = at(cl)
    const px = 1 + x * cell
    const py = 1 + y * cell
    box(g, px + 1, py + 1, cell - 2, cell - 2, edge)
    box(g, px + 2, py + 2, cell - 4, cell - 4, fill)
    g.fillStyle = '#ffffff66'
    g.fillRect(px + 3, py + 2, cell - 6, 1)
  }
  // The yards.
  for (let seat = 0; seat < LUDO.seats; seat++) {
    const col = SEAT_COLORS[seat]!
    const [yc, yr] = yardOf(seat + view)
    const x = 1 + yc * cell
    const y = 1 + yr * cell
    const s = YARD0.size * cell
    box(g, x + 2, y + 2, s - 4, s - 4, col.dark)
    box(g, x + 3, y + 3, s - 6, s - 6, col.mid)
    box(g, x + 5, y + 5, s - 10, s - 10, col.pale)
    g.fillStyle = col.light
    g.fillRect(x + 6, y + 6, s - 12, 1)
  }
  for (const [i, cl] of TRACK.entries()) {
    if (isSafe(i)) {
      const col = SEAT_COLORS[i / LUDO.spacing]!
      sq(cl, col.mid, col.dark)
      const [x, y] = at(cl)
      centered(g, stars(), 1 + x * cell + cell / 2, 1 + y * cell + cell / 2)
    } else sq(cl, BOARD.square, BOARD.line)
  }
  for (let seat = 0; seat < LUDO.seats; seat++) {
    const col = SEAT_COLORS[seat]!
    for (const cl of LANE0) sq(rotate(cl, seat), col.light, col.dark)
  }
  // The goal: a triangle per seat, pointing in from its lane's side.
  const [gx, gy] = at(CENTER)
  const ox = 1 + gx * cell
  const oy = 1 + gy * cell
  box(g, ox, oy, cell, cell, BOARD.edge)
  for (let y = 1; y < cell - 1; y++)
    for (let x = 1; x < cell - 1; x++) {
      // Which edge is nearest: bottom, left, top, right (seat 0's lane comes up from the bottom).
      const d = [cell - 1 - y, x, y, cell - 1 - x]
      const side = d.indexOf(Math.min(...d))
      const seat = (((side - view) % 4) + 4) % 4
      g.fillStyle = SEAT_COLORS[seat]!.mid
      g.fillRect(ox + x, oy + y, 1, 1)
    }
  boards.set(key, c)
  return c
}

/* ---------------- The screen ---------------- */

/** A piece hopping, or knocked home: what's moving and its clock (s). */
type Playing = { e: LudoEvent; t: number; done: Set<string> }

const parse = (tb: TableView | null): LudoView | null => (tb && tb.view !== null ? ludoRules.parseView(tb.view) : null)

/** The board before a match (a table gathering, or the first view on its way): every piece in its yard. */
const BEFORE: LudoView = {
  pieces: Array.from({ length: LUDO.seats }, () => Array.from({ length: LUDO.pieces }, () => YARD)),
  turn: 0,
  phase: 'roll',
  roll: null,
  tries: 0,
  winner: null,
  moves: 0,
  events: [],
  lost: Array.from({ length: LUDO.seats }, () => 0),
}

/** The match's end for `seat`: won without losing a piece is `untouchable`. */
const featsOf = (tb: TableView, seat: number): readonly string[] => {
  const v = parse(tb)
  return v && v.winner === seat && v.lost[seat] === 0 ? ['untouchable'] : []
}

/** Whether a seat has nothing out on the board (its 6 tries count). */
const nothingOut = (v: LudoView, seat: number) => v.pieces[seat]!.every((p) => p === YARD || p === GOAL)

const start = (ctx: TableCtx): TableRun => {
  const { source } = ctx
  const words = () => t().minigames.cafe.ludo
  let W = 0
  let H = 0
  let clock = 0
  let lay: Layout = layoutOf(320, 200)
  /** The pieces as drawn (they trail the table while events play). */
  let shown: number[][] = []
  let queue: LudoEvent[] = []
  let playing: Playing | null = null
  let lastN = -1
  let lastMoves = -1
  /** The die as last shown: whose, which face, and since when (s). */
  let face: { seat: number; value: number; at: number } | null = null
  /** Our roll sent and not yet seen; our move sent for this roll. */
  let rolledAt: number | null = null
  let movedFor = -1
  let autoAt: number | null = null
  let note: { text: string; at: number } | null = null
  let bits: Bit[] = []
  let shake = 0
  let wonAt: number | null = null
  let help = false
  let pressedRoll = false
  let hoverPiece: number | null = null
  let ticked = -1
  const loaded = new Set<string>()

  const mySeat = () => source.seat()
  /** The seat drawn bottom left: our own, or seat 0 for a spectator. */
  const viewSeat = () => mySeat() ?? 0
  /** Quarter turns from seat 0's frame to the screen. */
  const turns = () => (LUDO.seats - viewSeat()) % LUDO.seats

  const seatedList = (tb: TableView | null): (Seated | null)[] => Array.from({ length: LUDO.seats }, (_, s) => seatedAt(ctx, tb, s, words().you))

  /* ----- Where things are on the screen ----- */

  const cellCenter = (cl: Cell) => {
    const [c, r] = rotate(cl, turns())
    return { x: lay.board.x + 1 + c * lay.cell + lay.cell / 2, y: lay.board.y + 1 + r * lay.cell + lay.cell / 2 }
  }
  const yardRect = (seat: number): Rect => {
    const [c, r] = yardOf(seat + turns())
    const s = YARD0.size * lay.cell
    return { x: lay.board.x + 1 + c * lay.cell, y: lay.board.y + 1 + r * lay.cell, w: s, h: s }
  }
  /** A yard slot's center: the two balls side by side in the yard's upper part. */
  const slotAt = (seat: number, piece: number) => {
    const y = yardRect(seat)
    return { x: y.x + Math.round(y.w * (piece === 0 ? 0.3 : 0.7)), y: y.y + Math.round(lay.cell * 1.05) }
  }
  /** Where a piece at `p` is drawn (stacked pieces of a square spread a little; the goal holds them by seat). */
  const placeOf = (seat: number, piece: number, p: number) => {
    if (p === YARD) return slotAt(seat, piece)
    const cl = cellAt(seat, p)!
    const c = cellCenter(cl)
    if (p === GOAL) {
      const k = Math.max(2, Math.floor(lay.cell / 5))
      const quarter = (seat + turns()) % 4
      const [dx, dy] = ([[0, 1], [-1, 0], [0, -1], [1, 0]] as const)[quarter]!
      return { x: c.x + dx * k + (piece === 0 ? -1 : 1) * (dy !== 0 ? 2 : 0), y: c.y + dy * k + (piece === 0 ? -1 : 1) * (dx !== 0 ? 2 : 0) }
    }
    return c
  }

  /* ----- The dock ----- */

  /** The dock's parts: the line on top, the die (twice its size when the dock has room) and Rolar, the seats, the rules' button. */
  const dockParts = () => {
    const d = lay.dock
    const k = d.h >= 150 ? 2 : 1
    const size = 22 * k
    const rollW = Math.min(112, d.w - size - 24)
    const left = d.x + Math.floor((d.w - rollW - size - 8) / 2)
    const dieY = d.y + 24
    const rowsY = dieY + size + 8
    const rowH = Math.max(12, Math.min(16, Math.floor((d.h - (rowsY - d.y) - 24) / LUDO.seats)))
    const rules = helpLines(d.w - 12)
    const rulesFit = rules.length * 10 + 8 <= d.y + d.h - (rowsY + LUDO.seats * rowH + 4)
    const helpW = Math.min(d.w - 12, label(words().howTo).width + 10)
    return {
      k,
      die: { x: left, y: dieY, w: size, h: size },
      roll: { x: left + size + 8, y: dieY, w: rollW, h: size },
      rows: { x: d.x, y: rowsY, w: d.w, h: LUDO.seats * rowH },
      rowH,
      rules: rulesFit ? rules : null,
      help: { x: d.x + Math.floor((d.w - helpW) / 2), y: d.y + d.h - 20, w: helpW, h: 16 },
    }
  }

  /* ----- Reading the table ----- */

  const read = (tb: TableView | null) => {
    const v = parse(tb)
    if (!v) return
    // A fresh match: everything back where the view says, no history replayed.
    if (v.moves < lastMoves || lastMoves < 0) {
      shown = v.pieces.map((row) => [...row])
      queue = []
      playing = null
      lastN = v.events.reduce((n, e) => Math.max(n, e.n), -1)
      face = null
      wonAt = null
      rolledAt = null
      movedFor = -1
      if (v.moves === 0 && tb?.phase === 'playing') playSfx('select')
    }
    lastMoves = v.moves
    for (const e of v.events)
      if (e.n > lastN) {
        queue.push(e)
        lastN = e.n
      }
  }

  const settle = (v: LudoView) => {
    if (!playing && queue.length === 0) shown = v.pieces.map((row) => [...row])
  }

  /** Plays the next event on: the die, a hop, a knock home. */
  const advance = (dt: number, v: LudoView) => {
    if (!playing && queue.length > 0) playing = { e: queue.shift()!, t: 0, done: new Set() }
    if (!playing) return
    // Behind by more than a move: hurry.
    const speed = 1 + queue.length * 0.6
    playing.t += dt * speed
    const p = playing
    const once = (key: string, fn: () => void) => {
      if (!p.done.has(key)) (p.done.add(key), fn())
    }
    const e = p.e
    if (e.k === 'roll') {
      // Our own roll tumbled while it was on its way: only a short beat left.
      const tumble = rolledAt !== null && e.seat === mySeat() ? Math.max(0.12, BEAT.tumble - (clock - rolledAt)) : BEAT.tumble
      once('start', () => playSfx('roll'))
      if (p.t >= tumble)
        once('land', () => {
          face = { seat: e.seat, value: e.roll, at: clock }
          rolledAt = null
          playSfx(e.roll === 6 ? 'shing' : 'tick')
          if (e.stuck) note = { text: words().stuck, at: clock }
        })
      if (p.t >= tumble + (e.stuck ? BEAT.stuck : 0.05)) playing = null
      return
    }
    const hops = e.from === YARD ? 1 : Math.max(1, e.to - e.from)
    const hopEnd = hops * BEAT.hop
    for (let i = 1; i <= hops; i++) if (p.t >= i * BEAT.hop) once(`hop${i}`, () => playSfx('move', 20))
    if (p.t >= hopEnd)
      once('land', () => {
        shown[e.seat]![e.piece] = e.to
        const at = placeOf(e.seat, e.piece, e.to)
        const col = SEAT_COLORS[e.seat]!
        if (e.sent.length > 0) {
          playSfx('hit')
          shake = 0.22
          burst(bits, at.x, at.y, 16, ['#fff8c0', col.light, col.mid])
          const mine = mySeat()
          const victim = e.sent[0]!
          note = { text: mine !== null && victim.seat === mine ? words().sentYou : words().sent(seatedList(source.table())[victim.seat]?.name ?? '?'), at: clock }
        } else if (e.to === GOAL) {
          playSfx('coin')
          burst(bits, at.x, at.y, 14, ['#f8e070', '#ffffff', col.light])
          note = { text: words().home, at: clock }
        }
      })
    const homeEnd = hopEnd + (e.sent.length > 0 ? BEAT.home : 0)
    if (p.t >= homeEnd) {
      for (const s of e.sent) shown[s.seat]![s.piece] = YARD
      playing = null
    }
    void v
  }

  /** Where a moving piece is drawn now (between squares, a little up), or null when it isn't moving. */
  const moving = (seat: number, piece: number): { x: number; y: number } | null => {
    const p = playing
    if (!p || p.e.k !== 'move') return null
    const e = p.e
    const hops = e.from === YARD ? 1 : Math.max(1, e.to - e.from)
    const hopEnd = hops * BEAT.hop
    if (e.seat === seat && e.piece === piece && p.t < hopEnd) {
      const i = Math.min(hops - 1, Math.floor(p.t / BEAT.hop))
      const f = (p.t - i * BEAT.hop) / BEAT.hop
      const from = e.from === YARD ? YARD : Math.min(GOAL, e.from + i)
      const to = e.from === YARD ? 0 : Math.min(GOAL, e.from + i + 1)
      const a = placeOf(seat, piece, from)
      const b = placeOf(seat, piece, to)
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * 4 }
    }
    const knocked = e.sent.find((s) => s.seat === seat && s.piece === piece)
    if (knocked && p.t >= hopEnd) {
      const f = Math.min(1, (p.t - hopEnd) / BEAT.home)
      const a = placeOf(seat, piece, knocked.from)
      const b = slotAt(seat, piece)
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * 14 }
    }
    return null
  }

  /* ----- Our moves ----- */

  const idle = () => playing === null && queue.length === 0
  const canRoll = (tb: TableView | null, v: LudoView | null) => {
    const seat = mySeat()
    return !!tb && !!v && tb.phase === 'playing' && seat !== null && v.turn === seat && v.phase === 'roll' && v.winner === null && rolledAt === null && idle()
  }
  const legalNow = (tb: TableView | null, v: LudoView | null): number[] => {
    const seat = mySeat()
    if (!tb || !v || tb.phase !== 'playing' || seat === null || v.turn !== seat || v.phase !== 'move' || v.roll === null || !idle() || movedFor === v.moves) return []
    return legalPieces(v, seat, v.roll)
  }
  const doRoll = () => {
    rolledAt = clock
    pressedRoll = false
    source.play('roll')
  }
  const doMove = (v: LudoView, piece: number) => {
    movedFor = v.moves
    autoAt = null
    source.play(piece)
  }

  /** The legal piece nearest the pointer (by where it stands or where it would land). */
  const pieceNear = (v: LudoView, legal: readonly number[], x: number, y: number) => {
    const seat = mySeat()!
    let best: number | null = null
    let dist = Infinity
    for (const piece of legal) {
      const from = placeOf(seat, piece, v.pieces[seat]![piece]!)
      const to = placeOf(seat, piece, target(v.pieces[seat]![piece]!, v.roll ?? 1) ?? 0)
      const d = Math.min(Math.hypot(from.x - x, from.y - y), Math.hypot(to.x - x, to.y - y))
      if (d < dist) (dist = d), (best = piece)
    }
    return dist <= lay.cell * 2.2 ? best : null
  }

  const step = (dt: number, input: GameInput) => {
    clock += dt
    const tb = source.table()
    read(tb)
    const v = parse(tb)
    const seated = seatedList(tb)
    loadSeated(seated, loaded)
    shake = Math.max(0, shake - dt)
    bits = stepBits(bits, dt)
    if (!v) return
    advance(dt, v)
    settle(v)

    // The end: confetti from the winner's yard once its last piece is home.
    if (v.winner !== null && idle() && wonAt === null) {
      wonAt = clock
      const y = yardRect(v.winner)
      const col = SEAT_COLORS[v.winner]!
      for (let i = 0; i < 3; i++) burst(bits, y.x + y.w / 2, y.y + y.h / 2, 18, ['#f8e070', '#ffffff', col.light, col.mid], 170)
      const seat = mySeat()
      playSfx(seat === v.winner ? 'levelUp' : seat === null ? 'coin' : 'denied')
    }

    // The turn's last seconds tick.
    const seat = mySeat()
    if (seat !== null && v.turn === seat && tb?.phase === 'playing' && tb.leftMs !== null) {
      const left = Math.ceil(tb.leftMs / 1000)
      if (left <= 4 && left !== ticked) (ticked = left), playSfx('tick')
    } else ticked = -1

    const p = input.pointer
    const parts = dockParts()
    if (!parts.rules && p.pressed && inside(parts.help, p.x, p.y)) {
      help = !help
      playSfx('select')
      return
    }
    if (help && p.pressed) help = false
    const rollable = canRoll(tb, v)
    if (rollable) {
      if (p.pressed && (inside(parts.roll, p.x, p.y) || inside(parts.die, p.x, p.y) || inside(yardRect(seat!), p.x, p.y))) pressedRoll = true
      if (p.released && pressedRoll) doRoll()
      if (input.pressed('Space') || input.pressed('Enter')) doRoll()
    } else pressedRoll = false

    const legal = legalNow(tb, v)
    hoverPiece = legal.length > 1 && p.x >= 0 ? pieceNear(v, legal, p.x, p.y) : null
    if (legal.length === 1) {
      // One piece can move: it goes by itself after a beat.
      if (autoAt === null) autoAt = clock + BEAT.auto
      if (clock >= autoAt) doMove(v, legal[0]!)
    } else if (legal.length > 1) {
      autoAt = null
      if (p.released) {
        const piece = pieceNear(v, legal, p.x, p.y)
        if (piece !== null) doMove(v, piece)
      }
      for (const [k, piece] of [['Digit1', 0], ['Digit2', 1]] as const) if (input.pressed(k) && legal.includes(piece)) doMove(v, piece)
    } else autoAt = null
  }

  /* ----- Drawing ----- */

  /** What the dock says now: the end, our turn's step, whose turn it is, or a note that just happened. */
  const statusOf = (tb: TableView | null, v: LudoView | null, seated: readonly (Seated | null)[]) => {
    const w = words()
    if (!tb || !v) return ''
    if (v.winner !== null && wonAt !== null) return seated[v.winner]?.you ? w.youWin : w.wins(seated[v.winner]?.name ?? '?')
    if (note && clock - note.at < BEAT.note) return note.text
    const seat = mySeat()
    if (tb.phase !== 'playing' || !idle()) return ''
    if (seat !== null && v.turn === seat) {
      if (v.phase === 'move') return legalPieces(v, seat, v.roll ?? 1).length > 1 ? w.pick : ''
      if (nothingOut(v, seat)) return w.needSix(LUDO.tries - v.tries)
      const last = v.events.at(-1)
      return last?.k === 'move' && last.seat === seat && v.events.some((e) => e.k === 'roll' && e.seat === seat && e.roll === 6 && e.n === last.n - 1) ? w.again : w.yourRoll
    }
    return w.rolling(seated[v.turn]?.name ?? '?')
  }

  /** Text that fits `width`: split at spaces into at most two lines. */
  const lines = (text: string, width: number): string[] => wrap(text, width).slice(0, 2)

  const drawYardMons = (g: CanvasRenderingContext2D, tb: TableView | null, v: LudoView, seated: readonly (Seated | null)[], time: number) => {
    for (let seat = 0; seat < LUDO.seats; seat++) {
      const who = seated[seat]
      if (!who) continue
      const y = yardRect(seat)
      const s = sprites(who.dex, who.shiny)
      const won = wonAt !== null && v.winner === seat
      const hop = won ? Math.round(Math.abs(Math.sin((time - (wonAt ?? 0)) * 9)) * 4) : 0
      const left = y.x + y.w / 2 < lay.board.x + lay.board.w / 2
      const dir: Dir8 = left ? 1 : 7
      g.save()
      g.beginPath()
      g.rect(y.x + 5, y.y + 5, y.w - 10, y.h - 10)
      g.clip()
      drawPokemon(g, s, 'Idle', dir, time + seat * 0.37, Math.round(y.x + y.w / 2), Math.round(y.y + y.h - 6 - hop))
      g.restore()
      // The seat on turn: its yard's rim pulses.
      if (tb?.phase === 'playing' && v.turn === seat && v.winner === null) {
        const col = SEAT_COLORS[seat]!
        g.globalAlpha = 0.55 + 0.45 * Math.sin(time * 6)
        g.strokeStyle = '#fff8c0'
        g.lineWidth = 1
        g.strokeRect(y.x + 2.5, y.y + 2.5, y.w - 5, y.h - 5)
        g.strokeStyle = col.light
        g.strokeRect(y.x + 3.5, y.y + 3.5, y.w - 7, y.h - 7)
        g.globalAlpha = 1
      }
    }
  }

  const drawPieces = (g: CanvasRenderingContext2D, v: LudoView, time: number) => {
    const legal = legalNow(source.table(), v)
    const me = mySeat()
    const sprites: { x: number; y: number; seat: number; piece: number; lift: number }[] = []
    // Pieces sharing a square spread a little.
    const taken = new Map<string, number>()
    for (let seat = 0; seat < LUDO.seats; seat++)
      for (let piece = 0; piece < LUDO.pieces; piece++) {
        const p = shown[seat]?.[piece] ?? YARD
        const live = moving(seat, piece)
        const at = live ?? placeOf(seat, piece, p)
        let x = at.x
        let y = at.y
        if (!live && p !== YARD && p !== GOAL) {
          const key = `${Math.round(x)},${Math.round(y)}`
          const n = taken.get(key) ?? 0
          taken.set(key, n + 1)
          x += n * 3
          y -= n * 3
        }
        const pick = me === seat && legal.includes(piece)
        const lift = pick ? Math.round(Math.abs(Math.sin(time * 5 + piece)) * 2) + (hoverPiece === piece ? 1 : 0) : 0
        sprites.push({ x, y, seat, piece, lift })
      }
    sprites.sort((a, b) => a.y - b.y)
    for (const s of sprites) {
      const pick = me === s.seat && legal.includes(s.piece)
      if (pick) {
        // Where it would land: a ghost ring on that square.
        const to = target(v.pieces[s.seat]![s.piece]!, v.roll ?? 1)
        if (to !== null) {
          const at = placeOf(s.seat, s.piece, to)
          g.globalAlpha = hoverPiece === null || hoverPiece === s.piece ? 0.85 : 0.35
          g.strokeStyle = '#fff8c0'
          g.strokeRect(Math.round(at.x) - 6.5, Math.round(at.y) - 6.5, 13, 13)
          g.globalAlpha = 1
        }
        g.fillStyle = '#fff8c0'
        g.fillRect(Math.round(s.x) - 4, Math.round(s.y) + 6, 8, 1)
      }
      g.fillStyle = '#00000044'
      g.fillRect(Math.round(s.x) - 4, Math.round(s.y) + 5, 8, 2)
      centered(g, balls()[s.seat]!, s.x, s.y - 1 - s.lift)
    }
  }

  const drawDock = (g: CanvasRenderingContext2D, tb: TableView | null, v: LudoView, seated: readonly (Seated | null)[], time: number) => {
    const parts = dockParts()
    const d = lay.dock
    box(g, d.x, d.y, d.w, d.h, INK)
    box(g, d.x + 1, d.y + 1, d.w - 2, d.h - 2, '#2a3048')
    // What to do now.
    const text = statusOf(tb, v, seated)
    const ls = lines(text, d.w - 8)
    ls.forEach((l, i) => centered(g, label(l, i === 0 && note && clock - note.at < BEAT.note ? '#f8e070' : '#f8f8f8'), d.x + d.w / 2, d.y + (ls.length === 1 ? 12 : 7 + i * 11)))
    // The die: tumbling while a roll plays, else the last face.
    const p = playing
    const tumbling = (p?.e.k === 'roll' && !p.done.has('land')) || rolledAt !== null
    const dseat = tumbling ? (p?.e.k === 'roll' ? p.e.seat : (mySeat() ?? v.turn)) : (face?.seat ?? v.turn)
    const value = tumbling ? 1 + (Math.floor(time * 17) % 6) : (face?.value ?? 6)
    const jig = tumbling ? Math.round(Math.sin(time * 40) * 1.5) : face && time - face.at < 0.15 ? -2 : 0
    const dr = parts.die
    g.fillStyle = '#00000044'
    g.fillRect(dr.x + 2, dr.y + dr.h - 1, dr.w - 2, 3)
    g.drawImage(die(value, dseat), dr.x + jig * parts.k, dr.y + (tumbling ? -Math.abs(jig) : jig) * parts.k, dr.w, dr.h)
    // Roll, when it's ours to press.
    const rollable = canRoll(tb, v)
    button(g, parts.roll, label(words().roll, rollable ? '#ffffff' : '#9098b0'), rollable ? { fill: '#e05040', light: '#f8a090', dark: '#982818', down: pressedRoll, glow: 0.4 + 0.4 * Math.sin(time * 5) } : { fill: '#40465e', light: '#545a74', dark: '#2a2e40' })
    // The seats: ball, name, pieces home, the turn clock under the one on turn.
    const rows = parts.rows
    const rowH = parts.rowH
    const order = Array.from({ length: LUDO.seats }, (_, i) => (viewSeat() + i) % LUDO.seats)
    order.forEach((seat, i) => {
      const who = seated[seat]
      const y = rows.y + i * rowH
      const on = tb?.phase === 'playing' && v.turn === seat && v.winner === null
      if (on) {
        box(g, rows.x + 3, y, rows.w - 6, rowH - 1, '#3c4870')
        g.fillStyle = '#5868a0'
        g.fillRect(rows.x + 4, y, rows.w - 8, 1)
      }
      centered(g, miniBalls()[seat]!, rows.x + 10, y + rowH / 2)
      const home = v.pieces[seat]!.filter((q) => q === GOAL).length
      const name = label(clip(who?.name ?? '...', Math.max(4, Math.floor((rows.w - 52) / 8))), who?.bot ? '#a8b0c8' : who?.you ? '#f8e070' : '#f8f8f8')
      g.drawImage(name, rows.x + 17, Math.round(y + rowH / 2 - name.height / 2))
      for (let k = 0; k < LUDO.pieces; k++) {
        const x = rows.x + rows.w - 22 + k * 8
        box(g, x, y + rowH / 2 - 3, 6, 6, INK)
        box(g, x + 1, y + rowH / 2 - 2, 4, 4, k < home ? '#f8d030' : '#4a5070')
      }
      if (on && tb?.leftMs !== null && tb?.leftMs !== undefined) {
        const share = Math.max(0, Math.min(1, tb.leftMs / (ludoRules.open?.turnMs ?? 15_000)))
        g.fillStyle = share > 0.5 ? '#58c058' : share > 0.25 ? '#f8c830' : Math.floor(time * 6) % 2 ? '#f85838' : '#f8a088'
        g.fillRect(rows.x + 17, y + rowH - 2, Math.round((rows.w - 21) * share), 1)
      }
    })
    // The rules: written out under the seats when they fit, else behind a "?".
    const rules = parts.rules
    if (rules) {
      const top = d.y + d.h - rules.length * 10 - 6
      g.fillStyle = '#3a4260'
      g.fillRect(d.x + 6, top - 4, d.w - 12, 1)
      rules.forEach((l, i) => g.drawImage(label(l, '#a8b0c8'), d.x + 5, top + i * 10))
      return
    }
    const hr = parts.help
    box(g, hr.x, hr.y, hr.w, hr.h, help ? '#f8e070' : '#4a5070')
    centered(g, label(words().howTo, help ? INK : '#f8f8f8', help ? '#f8e070' : INK), hr.x + hr.w / 2, hr.y + hr.h / 2)
  }

  /** The rules' lines, wrapped to `width`. */
  const helpLines = (width: number) => words().help.flatMap((l) => wrap(l, width))

  const drawHelp = (g: CanvasRenderingContext2D) => {
    const all = helpLines(Math.min(W - 24, 260) - 8)
    const w = Math.min(W - 16, 268)
    const h = all.length * 11 + 12
    const x = Math.floor((W - w) / 2)
    const y = Math.floor((H - h) / 2)
    box(g, x - 1, y - 1, w + 2, h + 2, INK)
    box(g, x, y, w, h, '#2a3048')
    box(g, x + 1, y + 1, w - 2, h - 2, '#343c5a')
    all.forEach((l, i) => g.drawImage(label(l), x + 5, y + 5 + i * 11))
  }

  const draw = (g: CanvasRenderingContext2D, time: number) => {
    const cw = g.canvas.width
    const ch = g.canvas.height
    if (cw !== W || ch !== H) {
      W = cw
      H = ch
      lay = layoutOf(W, H)
    }
    const tb = source.table()
    const v = parse(tb) ?? BEFORE
    const seated = seatedList(tb)
    tableTop(g, W, H)
    const sx = shake > 0 ? (Math.floor(time * 40) % 2 === 0 ? 1 : -1) : 0
    g.save()
    g.translate(sx, 0)
    g.drawImage(boardArt(lay.cell, turns()), lay.board.x, lay.board.y)
    if (v) {
      drawYardMons(g, tb, v, seated, time)
      drawPieces(g, v, time)
    }
    g.restore()
    drawBits(g, bits)
    if (v) drawDock(g, tb, v, seated, time)
    // The end's banner over the board.
    if (v && v.winner !== null && wonAt !== null) {
      const w = words()
      const text = seated[v.winner]?.you ? w.youWin : w.wins(seated[v.winner]?.name ?? '?')
      const s = label(text, '#f8e070')
      const bw = s.width + 16
      const bx = Math.round(lay.board.x + lay.board.w / 2 - bw / 2)
      // High on the board: the end sheet covers its middle.
      const by = Math.round(lay.board.y + lay.cell * 4 + lay.cell / 2 - 9)
      box(g, bx, by, bw, 18, INK)
      box(g, bx + 1, by + 1, bw - 2, 16, SEAT_COLORS[v.winner]!.dark)
      centered(g, s, bx + bw / 2, by + 9)
    }
    if (help) drawHelp(g)
  }

  return { step, draw }
}

export const ludo: TableUi = {
  size: { w: 330, h: 200 },
  fluid: fluidSize(150, 330),
  start,
  outro: 2.4,
  feats: featsOf,
}

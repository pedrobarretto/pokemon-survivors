import { TIER_COLORS, TIER_IDS } from '../data/arenaRanked'
import { dir8, type Dir8, type Vec } from '../engine/math'
import { blitCentered, blitPacked, context2d, createCanvas, drawable, ellipse, fromStrings, lazy, type Palette } from '../engine/pixelart'
import { EMOTES } from './art'
import { shadow } from './draw'
import { drawMarker, edgeSpot, markerCard, type MarkerLook, type Piece, type ViewBox } from './plaza'
import { drawPokemon, loadedSprites, loadSpecies } from './sprites'

/**
 * The Estádio: the lobby's Arena, a place in the meadow south of the
 * partner's home (the Kecleon plaza is east, the Dojo west). Ninjask, the
 * judge, keeps the gate; a chalk battle court lies on the paved forecourt, and
 * five signboards around it lead to the Arena's screens: Jogar, Ranking,
 * Temporada, Histórico and Regras. Pennants in the four ranked tiers' colors
 * (`TIER_COLORS`) fly from the stands' rim. The forecourt, the boards and the
 * pennants are drawn in code (and cached); the stadium is a PixelLab PNG
 * (`public/assets/stadium/`) standing on the forecourt by the bottom center of
 * what it paints. Pure presentation, like the rest of the lobby.
 */

export const JUDGE = { dex: 291, name: 'Ninjask' } as const
/** The species the Estádio draws, for the menus' sprite stream to keep. */
export const STADIUM_DEX = [JUDGE.dex] as const

/** Where the stadium's feet stand from home (the lobby's resting view center), world px: below a desktop's bottom edge. */
export const STADIUM_OFFSET = { x: 0, y: 340 } as const

/** The forecourt's signboards, each a way into the Arena: Jogar its screen, the rest a tab of its hub. */
export const BOARD_IDS = ['play', 'ranking', 'season', 'history', 'rules'] as const
export type BoardId = (typeof BOARD_IDS)[number]
/** Who the partner talks to at the Estádio: Ninjask or a board. */
export type StadiumNpc = 'judge' | BoardId

export const isBoard = (who: string): who is BoardId => BOARD_IDS.some((b) => b === who)

/** Where everyone and everything stands, relative to the stadium's feet (world px). */
const SPOTS = {
  judge: { x: 0, y: 18, dir: 0 },
  /** Where the partner stands to talk to Ninjask: the court's center spot, facing it. */
  partner: { x: 0, y: 42 },
  boards: {
    play: { x: 34, y: 14 },
    ranking: { x: -82, y: 30 },
    season: { x: -58, y: 64 },
    history: { x: 58, y: 64 },
    rules: { x: 82, y: 30 },
  },
  /**
   * The pennants' poles, standing on the stands' rim (offsets into the stadium's PNG from its feet), low to high
   * tier left to right. Like the boards, within the narrowest phone's view (±97 px), so a portrait screen frames them all.
   */
  pennants: [
    { x: -68, y: -113 },
    { x: -42, y: -120 },
    { x: 42, y: -120 },
    { x: 68, y: -112 },
  ],
} as const satisfies { boards: Record<BoardId, Vec> } & Record<string, unknown>

/** The forecourt: a paved ellipse before the gate, with a chalk court. */
const COURT_FLOOR = { x: 0, y: 36, rx: 134, ry: 48 } as const
/** The chalk court's box (forecourt px from its center) and its center circle. */
const COURT = { left: -42, right: 42, top: -16, bottom: 22, circle: { rx: 11, ry: 6 } } as const

const ART_FILES = { stadium: 'stadium' } as const
type ArtId = keyof typeof ART_FILES
type Art = { img: HTMLImageElement; w: number; h: number }
const arts = new Map<ArtId, Art>()
let asked = false

/** Starts loading the stadium's PNG and Ninjask's sheets (once): they show up as they arrive. */
const loadStadiumArt = () => {
  if (asked) return
  asked = true
  void loadSpecies(JUDGE.dex).catch(() => {})
  for (const id of Object.keys(ART_FILES) as ArtId[]) {
    const img = new Image()
    img.src = `${import.meta.env.BASE_URL}assets/stadium/${ART_FILES[id]}.png`
    const landed = () => void (drawable(img) && arts.set(id, { img, w: img.width, h: img.height }))
    void img.decode().then(landed, landed)
  }
}

export type Stadium = {
  x: number
  y: number
  /** Scene time Ninjask last nodded (a greeting) and its facing. */
  hopAt: number
  dir: Dir8
  /** The edge marker as last drawn (world px), for taps. */
  marker: { x: number; y: number; shown: boolean }
}

export const createStadium = (home: Vec): Stadium => {
  loadStadiumArt()
  return { x: home.x + STADIUM_OFFSET.x, y: home.y + STADIUM_OFFSET.y, hopAt: -9, dir: 0, marker: { x: 0, y: 0, shown: false } }
}

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const
const PAVE = ['#d4ccb8', '#cbc3ae', '#dad3c1', '#c4bca6'].map(rgb)
const PAVE_EDGE = rgb('#aea48c')
const SEAM = rgb('#b8af98')
const CHALK = rgb('#f6f4ea')

/** A hash of a pixel, 0..1, so the paving's grain is the same every visit. */
const grain = (x: number, y: number) => {
  const n = Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296
}

/** Whether forecourt px (dx, dy) from its center is on a chalk line: the court's box, its halfway line or its center circle. */
const chalk = (dx: number, dy: number) => {
  const { left, right, top, bottom, circle } = COURT
  const inX = dx >= left && dx <= right
  const inY = dy >= top && dy <= bottom
  if (inY && (dx === left || dx === right || dx === 0)) return true
  if (inX && (dy === top || dy === bottom)) return true
  const r = Math.hypot(dx / circle.rx, dy / circle.ry)
  return Math.abs(r - 1) < 0.09
}

/** The forecourt's pixels, made once: big paving slabs with a darker rim and the chalk court. */
const forecourt = lazy(() => {
  const { rx, ry } = COURT_FLOOR
  const w = rx * 2 + 1
  const h = ry * 2 + 1
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(w, h)
  const courtY = SPOTS.partner.y - COURT_FLOOR.y
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - rx) / rx
      const dy = (y - ry) / ry
      const d = dx * dx + dy * dy
      if (d > 1 - grain(x, y) * 0.04) continue
      // Slabs 16×8, every other row staggered half a slab.
      const row = Math.floor(y / 8)
      const sx = (x + (row % 2) * 8) % 16
      const seam = y % 8 === 0 || sx === 0
      const slab = PAVE[Math.floor(grain(Math.floor((x + (row % 2) * 8) / 16), row) * PAVE.length)]!
      const c = chalk(x - rx, y - ry - courtY) ? CHALK : d > 0.88 ? PAVE_EDGE : seam ? SEAM : slab
      const i = (y * w + x) * 4
      img.data[i] = c[0]
      img.data[i + 1] = c[1]
      img.data[i + 2] = c[2]
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}, 'lobby')

/* ---------------- The boards and pennants ---------------- */

/** Each board's icon (9×9): a Poké Ball, a trophy, a calendar, a scroll of past matches and the rule book. */
const ICONS = {
  play: {
    rows: ['...111...', '.1122211.', '.1222221.', '122212221', '111343111', '133313331', '.1333331.', '.1133311.', '...111...'],
    palette: { 1: '#283040', 2: '#e83838', 3: '#f8f8f8', 4: '#c8c8d0' },
  },
  ranking: {
    rows: ['111111111', '122222321', '122222321', '.1222231.', '..12221..', '...121...', '...121...', '..11211..', '.1111111.'],
    palette: { 1: '#684810', 2: '#f0b828', 3: '#fff0a0' },
  },
  season: {
    rows: ['..1...1..', '111111111', '122222221', '111111111', '133333331', '131313131', '133333331', '131313131', '111111111'],
    palette: { 1: '#283040', 2: '#e05038', 3: '#f8f8f0' },
  },
  history: {
    rows: ['11111111.', '133333311', '132222331', '133333331', '132223331', '133333331', '132222331', '133333331', '111111111'],
    palette: { 1: '#283040', 2: '#7890b0', 3: '#f8f0d8' },
  },
  rules: {
    rows: ['111111111', '122222221', '122232221', '122232221', '122232221', '122222221', '122232221', '144444441', '111111111'],
    palette: { 1: '#182858', 2: '#3878e8', 3: '#f8f8f8', 4: '#f0e8d0' },
  },
} as const satisfies Record<BoardId, { rows: readonly string[]; palette: Palette }>

/** A board's woods: Jogar's is painted red, the others are plain timber. */
const WOODS = {
  plain: { line: '#3a2818', wood: '#a87038', hi: '#d09858', post: '#70482a' },
  play: { line: '#4a1410', wood: '#c83830', hi: '#f06048', post: '#70482a' },
} as const

/** Board size, px: a 17×15 panel on two posts. */
const BOARD = { w: 17, h: 24, panel: 15 } as const

/** A signboard (made once per board): a framed light panel with its icon, on two posts; its feet at the bottom center. */
const boardArt = (id: BoardId) => {
  const c = createCanvas(BOARD.w, BOARD.h)
  const ctx = context2d(c)
  const wood = id === 'play' ? WOODS.play : WOODS.plain
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  // Posts, outlined.
  for (const x of [3, 12]) {
    rect(wood.line, x - 1, BOARD.panel - 1, 4, BOARD.h - BOARD.panel + 1)
    rect(wood.post, x, BOARD.panel - 1, 2, BOARD.h - BOARD.panel)
  }
  // The panel: outline, wood frame lit on top, light face.
  rect(wood.line, 1, 0, BOARD.w - 2, BOARD.panel)
  rect(wood.line, 0, 1, BOARD.w, BOARD.panel - 2)
  rect(wood.wood, 1, 1, BOARD.w - 2, BOARD.panel - 2)
  rect(wood.hi, 2, 1, BOARD.w - 4, 1)
  rect('#f2e8cc', 3, 3, BOARD.w - 6, BOARD.panel - 6)
  rect('#d8ccb0', 3, BOARD.panel - 4, BOARD.w - 6, 1)
  const icon = ICONS[id]
  ctx.drawImage(fromStrings(icon.rows, icon.palette), 4, 2)
  return c
}

const BOARDS = lazy(() => Object.fromEntries(BOARD_IDS.map((id) => [id, boardArt(id)])) as Record<BoardId, HTMLCanvasElement>, 'lobby')

/** Pennant size, px: a pole with a gold knob and a flag at its top. */
const PENNANT = { w: 12, h: 32, flag: 7 } as const

/** A tier's pennant in one of its two flutter frames (made once each): a triangle in the tier's color, rimmed in its rim color. */
const pennantArt = (tier: (typeof TIER_IDS)[number], frame: 0 | 1) => {
  const c = createCanvas(PENNANT.w, PENNANT.h)
  const ctx = context2d(c)
  const { top, rim } = TIER_COLORS[tier]
  ctx.fillStyle = '#283040'
  ctx.fillRect(0, 1, 3, PENNANT.h - 1)
  ctx.fillRect(1, 0, 1, 1)
  ctx.fillStyle = '#c8c8d0'
  ctx.fillRect(1, 2, 1, PENNANT.h - 2)
  ctx.fillStyle = '#f8c830'
  ctx.fillRect(1, 1, 1, 1)
  // The flag: rows grow then shrink, its tip a pixel longer on the second frame.
  const tip = PENNANT.w - 3 - (frame === 0 ? 1 : 0)
  for (let r = 0; r < PENNANT.flag; r++) {
    const len = Math.max(1, Math.round(tip * (1 - Math.abs(r - (PENNANT.flag - 1) / 2) / (PENNANT.flag / 2))))
    ctx.fillStyle = rim
    ctx.fillRect(3, 2 + r, len, 1)
    if (r > 0 && r < PENNANT.flag - 1 && len > 2) {
      ctx.fillStyle = top
      ctx.fillRect(3, 2 + r, len - 1, 1)
    }
  }
  return c
}

const PENNANTS = lazy(() => TIER_IDS.map((tier) => [pennantArt(tier, 0), pennantArt(tier, 1)] as const), 'lobby')

/* ---------------- Drawing ---------------- */

const SHADOW = 'rgba(30,40,30,0.3)'

/** Draws `art` with the bottom center of its box at (x, y), screen px. */
const put = (ctx: CanvasRenderingContext2D, art: { width: number; height: number } & CanvasImageSource, x: number, y: number) =>
  ctx.drawImage(art, Math.round(x - art.width / 2), Math.round(y - art.height))

/** The stadium's box from its feet, world px (a guess until its PNG is in). */
const stadiumBox = (s: Stadium) => {
  const art = arts.get('stadium')
  const w = art?.w ?? 180
  const h = art?.h ?? 140
  return { left: s.x - w / 2, right: s.x + w / 2, top: s.y - h, bottom: s.y }
}

/** Draws the forecourt and the pieces' shadows under everyone, when it's in view. */
export const drawStadiumGround = (ctx: CanvasRenderingContext2D, s: Stadium, camX: number, camY: number, w: number, h: number) => {
  const box = stadiumBox(s)
  const floor = { left: s.x - COURT_FLOOR.rx, right: s.x + COURT_FLOOR.rx, bottom: s.y + COURT_FLOOR.y + COURT_FLOOR.ry }
  if (floor.right - camX < 0 || floor.left - camX > w || floor.bottom - camY < 0 || box.top - camY > h) return
  blitCentered(ctx, forecourt(), s.x + COURT_FLOOR.x - camX, s.y + COURT_FLOOR.y - camY)
  const art = arts.get('stadium')
  if (art) blitPacked(ctx, ellipse(Math.round(art.w * 0.46), 9, SHADOW), s.x - camX, s.y - camY)
  for (const id of BOARD_IDS) {
    const b = SPOTS.boards[id]
    blitPacked(ctx, ellipse(9, 3, SHADOW), s.x + b.x - camX, s.y + b.y - camY)
  }
}

/** Height (px) of Ninjask's greeting `since` seconds in: two quick, high darts. */
const nod = (since: number) => (since < 0 || since >= 0.5 ? 0 : Math.round(Math.abs(Math.sin((Math.PI * since) / 0.25)) * 4))

/** Ninjask nods at scene time `time`, a note over its head. */
export const greetJudge = (s: Stadium, time: number) => {
  s.hopAt = time
}

/** Turns Ninjask to the partner when it comes close. */
export const stepStadium = (s: Stadium, partner: Vec | null) => {
  const x = s.x + SPOTS.judge.x
  const y = s.y + SPOTS.judge.y
  s.dir = partner && Math.hypot(partner.x - x, partner.y - y) < 70 ? dir8(partner.x - x, partner.y - y) : SPOTS.judge.dir
}

/** The stadium, its boards and pennants and Ninjask, for the meadow to sort among the wanderers by their feet. */
export const stadiumPieces = (s: Stadium): Piece[] => {
  const pieces: Piece[] = []
  const art = arts.get('stadium')
  if (art) pieces.push({ y: s.y, draw: (ctx, camX, camY) => put(ctx, art.img, s.x - camX, s.y - camY) })
  const boards = BOARDS()
  for (const id of BOARD_IDS) {
    const b = SPOTS.boards[id]
    pieces.push({ y: s.y + b.y, draw: (ctx, camX, camY) => put(ctx, boards[id], s.x + b.x - camX, s.y + b.y - camY) })
  }
  // The pennants fly from the rim, so they draw just after the stadium (whatever their feet's y).
  const pennants = PENNANTS()
  if (art) {
    SPOTS.pennants.forEach((p, i) => {
      pieces.push({
        y: s.y + 0.5,
        // Each flag flutters on its own beat.
        draw: (ctx, camX, camY, time) => ctx.drawImage(pennants[i]![Math.floor(time * 2.5 + i * 0.7) % 2]!, s.x + p.x - camX - 1, s.y + p.y - camY - PENNANT.h),
      })
    })
  }
  const j = SPOTS.judge
  pieces.push({
    y: s.y + j.y,
    draw: (ctx, camX, camY, time) => {
      const sprite = loadedSprites(JUDGE.dex)
      if (!sprite) return
      const x = s.x + j.x - camX
      const y = s.y + j.y - camY
      const since = time - s.hopAt
      const lift = nod(since)
      shadow(ctx, x, y, sprite.bodyW)
      // Ninjask never sits still: its idle buzzes faster than the meadow's.
      drawPokemon(ctx, sprite, 'Idle', s.dir, time * 1.4, x, y - lift)
      if (since >= 0 && since < 1.6) blitCentered(ctx, EMOTES().note, x, y - sprite.bodyH - lift - 8 - (Math.floor(since * 3) % 2))
    },
  })
  return pieces
}

/** Where the partner stands to talk to Ninjask, world px, for the stadium's feet at `s`. */
export const judgeSpot = (s: Vec): Vec => ({ x: s.x + SPOTS.partner.x, y: s.y + SPOTS.partner.y })

/** Where a board's feet stand, world px, for the stadium's feet at `s`. */
export const boardSpot = (s: Vec, id: BoardId): Vec => ({ x: s.x + SPOTS.boards[id].x, y: s.y + SPOTS.boards[id].y })

/** How close (world px) the partner must stand to Ninjask, or to a board, to talk to it or read it. */
const TALK_RANGE = { judge: 26, board: 18 } as const

/**
 * Who the partner (feet at `p`) stands close enough to talk to at the
 * Estádio, and above its head (world px): Ninjask first, else the nearest
 * board in reach; null for none. Pure, so it's tested (`stadium.test.ts`).
 */
export const stadiumTalk = (at: Vec, p: Vec): (Vec & { who: StadiumNpc }) | null => {
  const j = { x: at.x + SPOTS.judge.x, y: at.y + SPOTS.judge.y }
  if (Math.hypot(p.x - j.x, p.y - j.y) < TALK_RANGE.judge) return { x: j.x, y: j.y - 36, who: 'judge' }
  let best: (Vec & { who: StadiumNpc; d: number }) | null = null
  for (const id of BOARD_IDS) {
    const b = { x: at.x + SPOTS.boards[id].x, y: at.y + SPOTS.boards[id].y }
    const d = Math.hypot(p.x - b.x, p.y - b.y)
    if (d < TALK_RANGE.board && (!best || d < best.d)) best = { x: b.x, y: b.y - BOARD.h - 4, who: id, d }
  }
  return best && { x: best.x, y: best.y, who: best.who }
}

/** Whether a tap at `at` (world px) is for the Estádio, and whom: a board, Ninjask, the stadium or its edge marker (both Ninjask's). */
export const stadiumTapped = (s: Stadium, at: Vec): StadiumNpc | null => {
  const m = s.marker
  if (m.shown && Math.abs(at.x - m.x) <= 18 && Math.abs(at.y - m.y) <= 15) return 'judge'
  for (const id of BOARD_IDS) {
    const b = SPOTS.boards[id]
    if (Math.abs(at.x - s.x - b.x) <= BOARD.w / 2 + 2 && at.y <= s.y + b.y + 2 && at.y >= s.y + b.y - BOARD.h - 2) return id
  }
  const j = { x: s.x + SPOTS.judge.x, y: s.y + SPOTS.judge.y }
  if (Math.abs(at.x - j.x) <= 12 && at.y <= j.y + 3 && at.y >= j.y - 34) return 'judge'
  const box = stadiumBox(s)
  return arts.has('stadium') && at.x >= box.left && at.x <= box.right && at.y >= box.top && at.y <= box.bottom + 4 ? 'judge' : null
}

/** How close (world px) a walker may come to Ninjask's feet or a board. */
const ROOM = 11

/** Pushes feet at `v` off Ninjask and the boards and out of the stadium's footprint (and the ground behind it), so walkers go around (mutates `v`). */
export const pushOutStadium = (s: Stadium, v: Vec) => {
  for (const k of [SPOTS.judge, ...Object.values(SPOTS.boards)]) {
    const dx = v.x - s.x - k.x
    const dy = v.y - s.y - k.y
    const dist = Math.hypot(dx, dy)
    if (dist >= ROOM) continue
    v.x = s.x + k.x + (dist > 1e-6 ? (dx / dist) * ROOM : ROOM)
    v.y = s.y + k.y + (dist > 1e-6 ? (dy / dist) * ROOM : 0)
  }
  if (!arts.has('stadium')) return
  const box = stadiumBox(s)
  const half = (box.right - box.left) / 2 + 8
  // Well clear of the flags: feet just under them read as standing on the stands.
  const top = skyline(s) - 6
  const bottom = s.y + 6
  if (v.y > top && v.y < bottom && Math.abs(v.x - s.x) < half) {
    const side = half - Math.abs(v.x - s.x)
    const up = v.y - top
    const down = bottom - v.y
    if (up < side && up < down) v.y = top
    else if (down < side) v.y = bottom
    else v.x = s.x + Math.sign(v.x - s.x || 1) * half
  }
}

/** The top of the stadium and its pennants' tips, world px. */
const skyline = (s: Stadium) => Math.min(stadiumBox(s).top, s.y + Math.min(...SPOTS.pennants.map((p) => p.y)) - PENNANT.h)

/**
 * Where the camera (its top-left, world px) frames the Estádio for a `w`×`h`
 * view: the pennants' tips near the view's top, the forecourt and its boards
 * below. A short view (a phone held sideways) drops until Ninjask and the
 * partner before it stand clear of the dialogue box, the flags out of view.
 */
export const stadiumFrame = (s: Stadium, w: number, h: number): Vec => {
  const top = skyline(s) - Math.min(8, h * 0.03)
  const partner = s.y + SPOTS.partner.y + 10 - h * 0.72
  return { x: Math.round(s.x - w / 2), y: Math.round(Math.max(top, partner)) }
}

const MARKER: MarkerLook = { card: '#dce6f8', arrow: '#3878e8', headDy: 0 }
/** How far (px) the stadium must reach into the view to count as on screen. */
const INSET = 16

/**
 * A card at the edge of the view with an arrow, pointing down at the Estádio
 * (Ninjask's head) while the stadium is off screen, like the plaza's and the
 * Dojo's. On a phone's lobby (`inside`, the open meadow around the partner)
 * it stands at that box's lower left corner, over the Dojo's card (the
 * middle is the partner's name plate). It remembers where it was drawn
 * (`marker`) so a tap on it leads there.
 */
export const drawStadiumMarker = (ctx: CanvasRenderingContext2D, s: Stadium, camX: number, camY: number, w: number, h: number, time: number, show: boolean, inside: ViewBox | null) => {
  s.marker.shown = false
  const box = stadiumBox(s)
  const seen = box.right > camX + INSET && box.left < camX + w - INSET && box.bottom > camY + INSET && box.top < camY + h - INSET
  if (!show || seen || !arts.has('stadium')) return
  const card = markerCard(JUDGE.dex, MARKER)
  if (!card) return
  const bob = Math.floor(time * 3) % 2
  const target = { x: s.x - camX, y: s.y - 30 - camY }
  const at = inside
    ? { x: Math.round(Math.min(w - 18, Math.max(18, inside.left + 18))), y: Math.round(Math.min(h - 17, Math.max(11, inside.bottom - 37))) + bob, dir: { x: 0, y: 1 } }
    : edgeSpot(target, w, h, bob, null)
  drawMarker(ctx, card, at, MARKER.arrow)
  Object.assign(s.marker, { x: at.x + camX, y: at.y + camY, shown: true })
}

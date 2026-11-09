import { TIER_COLORS, TIER_IDS } from '../data/arenaRanked'
import { dir8, type Dir8, type Vec } from '../engine/math'
import { blitCentered, blitPacked, context2d, createCanvas, drawable, ellipse, lazy } from '../engine/pixelart'
import { EMOTES } from './art'
import { shadow } from './draw'
import type { Piece } from './plaza'
import { drawPokemon, loadedSprites, loadSpecies } from './sprites'

/**
 * The Estádio: the lobby's Arena, a place in the meadow south of the
 * partner's home (the Kecleon plaza is east, the Dojo west). Ninjask, the
 * judge, keeps the gate; a chalk battle court lies on the paved forecourt.
 * Pennants in the four ranked tiers' colors (`TIER_COLORS`) fly from the stands'
 * rim. The forecourt and the pennants are drawn in code (and cached); the stadium is a PixelLab PNG
 * (`public/assets/stadium/`) standing on the forecourt by the bottom center of
 * what it paints. Pure presentation, like the rest of the lobby.
 */

export const JUDGE = { dex: 291, name: 'Ninjask' } as const
/** The species the Estádio draws, for the menus' sprite stream to keep. */
export const STADIUM_DEX = [JUDGE.dex] as const

/** Where the stadium's feet stand from home (the lobby's resting view center), world px: below a desktop's bottom edge. */
export const STADIUM_OFFSET = { x: 0, y: 340 } as const

/** Where everyone and everything stands, relative to the stadium's feet (world px). */
const SPOTS = {
  judge: { x: 0, y: 18, dir: 0 },
  /** Where the partner stands to talk to Ninjask: the court's center spot, facing it. */
  partner: { x: 0, y: 42 },
  /**
   * The pennants' poles, standing on the stands' rim (offsets into the stadium's PNG from its feet), low to high
   * tier left to right. Within the narrowest phone's view (±97 px), so a portrait screen frames them all.
   */
  pennants: [
    { x: -68, y: -113 },
    { x: -42, y: -120 },
    { x: 42, y: -120 },
    { x: 68, y: -112 },
  ],
} as const

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
}

export const createStadium = (home: Vec): Stadium => {
  loadStadiumArt()
  return { x: home.x + STADIUM_OFFSET.x, y: home.y + STADIUM_OFFSET.y, hopAt: -9, dir: 0 }
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

/* ---------------- The pennants ---------------- */

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

/** The stadium, its pennants and Ninjask, for the meadow to sort among the wanderers by their feet. */
export const stadiumPieces = (s: Stadium): Piece[] => {
  const pieces: Piece[] = []
  const art = arts.get('stadium')
  if (art) pieces.push({ y: s.y, draw: (ctx, camX, camY) => put(ctx, art.img, s.x - camX, s.y - camY) })
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

/** How close (world px) a walker may come to Ninjask's feet. */
const ROOM = 11

/** Pushes feet at `v` off Ninjask and out of the stadium's footprint (and the ground behind it), so walkers go around (mutates `v`). */
export const pushOutStadium = (s: Stadium, v: Vec) => {
  const k = SPOTS.judge
  const dx = v.x - s.x - k.x
  const dy = v.y - s.y - k.y
  const dist = Math.hypot(dx, dy)
  if (dist < ROOM) {
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
 * view: the pennants' tips near the view's top, the forecourt
 * below. A short view (a phone held sideways) drops until Ninjask and the
 * partner before it stand clear of the dialogue box, the flags out of view.
 */
export const stadiumFrame = (s: Stadium, w: number, h: number): Vec => {
  const top = skyline(s) - Math.min(8, h * 0.03)
  const partner = s.y + SPOTS.partner.y + 10 - h * 0.72
  return { x: Math.round(s.x - w / 2), y: Math.round(Math.max(top, partner)) }
}

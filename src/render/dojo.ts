import { dir8, type Dir8, type Vec } from '../engine/math'
import { blitCentered, blitPacked, context2d, createCanvas, drawable, ellipse, lazy } from '../engine/pixelart'
import { EMOTES } from './art'
import { shadow } from './draw'
import { drawMarker, edgeSpot, markerCard, type MarkerLook, type Piece, type ViewBox } from './plaza'
import { drawPokemon, loadedSprites, loadSpecies } from './sprites'

/**
 * The Dojo: the lobby's training hall, a place in the meadow west of the
 * partner's home (the Kecleon plaza is east). Machoke keeps it by the
 * door; Wobbuffet, the punching bag that takes it all, bounces in the yard
 * between the straw posts. Talking to Machoke (or the lobby's Dojo tile)
 * opens the training (`game/training.ts`). The yard is drawn in code (and
 * cached); the hall and the posts are PixelLab PNGs (`public/assets/dojo/`),
 * standing on the yard by the bottom center of what they paint, each with a
 * soft shadow. Pure presentation, like the rest of the lobby.
 */

export const SENSEI = { dex: 67, name: 'Machoke' } as const
const WOBBUFFET_DEX = 202
/** The species the Dojo draws, for the menus' sprite stream to keep. */
export const DOJO_DEX = [SENSEI.dex, WOBBUFFET_DEX] as const

/** Where the hall's feet stand from home (the lobby's resting view center), world px: off a desktop's left edge, as the plaza is off its right. */
export const DOJO_OFFSET = { x: -500, y: 130 } as const

/** The hall's PNGs, by id. */
const ART_FILES = { hall: 'dojo', post: 'dummy', banner: 'banner' } as const
type ArtId = keyof typeof ART_FILES
type Art = { img: HTMLImageElement; w: number; h: number }
const arts = new Map<ArtId, Art>()
let asked = false

/** Starts loading the hall's PNGs and its two residents' sheets (once): they show up as they arrive. */
const loadDojoArt = () => {
  if (asked) return
  asked = true
  void loadSpecies(SENSEI.dex).catch(() => {})
  void loadSpecies(WOBBUFFET_DEX).catch(() => {})
  for (const id of Object.keys(ART_FILES) as ArtId[]) {
    const img = new Image()
    img.src = `${import.meta.env.BASE_URL}assets/dojo/${ART_FILES[id]}.png`
    const landed = () => void (drawable(img) && arts.set(id, { img, w: img.width, h: img.height }))
    void img.decode().then(landed, landed)
  }
}

/** Where everyone stands, relative to the hall's feet (world px). */
const SPOTS = {
  sensei: { x: 30, y: 14, dir: 0 },
  wobbuffet: { x: -104, y: 40, dir: 1 },
  /** Where the partner stands to talk, facing Machoke. */
  partner: { x: 30, y: 42 },
  posts: [
    { x: -136, y: 26 },
    { x: -70, y: 50 },
  ],
  banners: [
    { x: -96, y: 2 },
    { x: 96, y: 2 },
  ],
} as const

/** The yard: a packed-earth ellipse around the hall's front. */
const YARD = { x: -24, y: 24, rx: 140, ry: 44 } as const

export type Dojo = {
  x: number
  y: number
  /** Scene time Machoke last hopped (a greeting) and its facing. */
  hopAt: number
  dir: Dir8
  /** The edge marker as last drawn (world px), for taps. */
  marker: { x: number; y: number; shown: boolean }
}

export const createDojo = (home: Vec): Dojo => {
  loadDojoArt()
  return { x: home.x + DOJO_OFFSET.x, y: home.y + DOJO_OFFSET.y, hopAt: -9, dir: 0, marker: { x: 0, y: 0, shown: false } }
}

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const
const EARTH = ['#d8b880', '#d0ae74', '#ddc08a', '#c9a66c'].map(rgb)
const EARTH_EDGE = rgb('#b89060')
const STRAW = rgb('#e8cc70')
const STRAW_LO = rgb('#b8943c')

/** A hash of a pixel, 0..1, so the yard's grain is the same every visit. */
const grain = (x: number, y: number) => {
  const n = Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296
}

/** The yard's pixels, made once: packed earth with a darker rim, a straw ring where the dummies stand. */
const yard = lazy(() => {
  const w = YARD.rx * 2 + 1
  const h = YARD.ry * 2 + 1
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(w, h)
  const ring = { x: SPOTS.wobbuffet.x + 16 - YARD.x, y: SPOTS.wobbuffet.y - 6 - YARD.y, rx: 46, ry: 19 }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - YARD.rx) / YARD.rx
      const dy = (y - YARD.ry) / YARD.ry
      const d = dx * dx + dy * dy
      // A ragged edge where the grass takes over.
      if (d > 1 - grain(x, y) * 0.06) continue
      const rx = (x - YARD.rx - ring.x) / ring.rx
      const ry = (y - YARD.ry - ring.y) / ring.ry
      const r = Math.sqrt(rx * rx + ry * ry)
      const c = Math.abs(r - 1) < 0.045 ? STRAW : Math.abs(r - 1.06) < 0.03 ? STRAW_LO : d > 0.86 ? EARTH_EDGE : EARTH[Math.floor(grain(x + 7, y * 3) * EARTH.length)]!
      const i = (y * w + x) * 4
      img.data[i] = c[0]
      img.data[i + 1] = c[1]
      img.data[i + 2] = c[2]
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
})

const SHADOW = 'rgba(30,40,30,0.3)'

/** Draws `art` with the bottom center of its box at (x, y), screen px. */
const put = (ctx: CanvasRenderingContext2D, art: Art, x: number, y: number) => ctx.drawImage(art.img, Math.round(x - art.w / 2), Math.round(y - art.h))

/** The hall's box from its feet, world px (a guess until its PNG is in). */
const hallBox = (d: Dojo) => {
  const hall = arts.get('hall')
  const w = hall?.w ?? 170
  const h = hall?.h ?? 130
  return { left: d.x - w / 2, right: d.x + w / 2, top: d.y - h, bottom: d.y }
}

/** Draws the yard and the pieces' shadows under everyone, when it's in view. */
export const drawDojoGround = (ctx: CanvasRenderingContext2D, d: Dojo, camX: number, camY: number, w: number, h: number) => {
  const box = hallBox(d)
  if (box.right + 40 - camX < 0 || d.x + YARD.x - YARD.rx - camX > w || d.y + YARD.y + YARD.ry - camY < 0 || box.top - camY > h) return
  blitCentered(ctx, yard(), d.x + YARD.x - camX, d.y + YARD.y - camY)
  const hall = arts.get('hall')
  if (hall) blitPacked(ctx, ellipse(Math.round(hall.w * 0.46), 9, SHADOW), d.x - camX + 2, d.y - camY)
  for (const p of SPOTS.posts) blitPacked(ctx, ellipse(7, 3, SHADOW), d.x + p.x - camX, d.y + p.y - camY)
}

const hop = (since: number, count: number, height: number) => (since < 0 || since >= 0.3 * count ? 0 : Math.round(Math.sin((Math.PI * (since % 0.3)) / 0.3) * height))

/** Machoke hops at scene time `time`, a note over its head. */
export const greetSensei = (d: Dojo, time: number) => {
  d.hopAt = time
}

/** Turns Machoke to the partner when it comes close. */
export const stepDojo = (d: Dojo, partner: Vec | null) => {
  const x = d.x + SPOTS.sensei.x
  const y = d.y + SPOTS.sensei.y
  d.dir = partner && Math.hypot(partner.x - x, partner.y - y) < 70 ? dir8(partner.x - x, partner.y - y) : SPOTS.sensei.dir
}

/** The hall, its posts and banners and its residents, for the meadow to sort among the wanderers by their feet. */
export const dojoPieces = (d: Dojo): Piece[] => {
  const pieces: Piece[] = []
  const hall = arts.get('hall')
  if (hall) pieces.push({ y: d.y, draw: (ctx, camX, camY) => put(ctx, hall, d.x - camX, d.y - camY) })
  const post = arts.get('post')
  if (post) for (const p of SPOTS.posts) pieces.push({ y: d.y + p.y, draw: (ctx, camX, camY) => put(ctx, post, d.x + p.x - camX, d.y + p.y - camY) })
  const banner = arts.get('banner')
  if (banner) for (const p of SPOTS.banners) pieces.push({ y: d.y + p.y, draw: (ctx, camX, camY) => put(ctx, banner, d.x + p.x - camX, d.y + p.y - camY) })
  const s = SPOTS.sensei
  pieces.push({
    y: d.y + s.y,
    draw: (ctx, camX, camY, time) => {
      const sprite = loadedSprites(SENSEI.dex)
      if (!sprite) return
      const x = d.x + s.x - camX
      const y = d.y + s.y - camY
      const lift = hop(time - d.hopAt, 2, 4)
      shadow(ctx, x, y, sprite.bodyW)
      drawPokemon(ctx, sprite, 'Idle', d.dir, time, x, y - lift)
      const since = time - d.hopAt
      if (since >= 0 && since < 1.4) blitCentered(ctx, EMOTES().note, x, y - sprite.bodyH - lift - 8 - (Math.floor(since * 4) % 2))
    },
  })
  const wb = SPOTS.wobbuffet
  pieces.push({
    y: d.y + wb.y,
    draw: (ctx, camX, camY, time) => {
      const sprite = loadedSprites(WOBBUFFET_DEX)
      if (!sprite) return
      const x = d.x + wb.x - camX
      const y = d.y + wb.y - camY
      shadow(ctx, x, y, sprite.bodyW)
      // A slow bounce, as if it just took a hit and swayed back.
      drawPokemon(ctx, sprite, 'Idle', wb.dir, time * 0.8, x, y - (Math.floor(time * 1.6) % 4 === 0 ? 1 : 0))
    },
  })
  return pieces
}

/** Where the partner stands to talk to Machoke, world px. */
export const senseiSpot = (d: Dojo): Vec => ({ x: d.x + SPOTS.partner.x, y: d.y + SPOTS.partner.y })

/** How close (world px) the partner must stand to Machoke to talk. */
const TALK_RANGE = 26

/** Above Machoke's head when the partner (feet at `p`) stands close enough to talk, world px; null otherwise. */
export const senseiTalk = (d: Dojo, p: Vec): Vec | null => {
  const x = d.x + SPOTS.sensei.x
  const y = d.y + SPOTS.sensei.y
  return Math.hypot(p.x - x, p.y - y) < TALK_RANGE ? { x, y: y - 30 } : null
}

/** Whether a tap at `at` (world px) is for the Dojo: Machoke, the hall or its edge marker. */
export const dojoTapped = (d: Dojo, at: Vec) => {
  const m = d.marker
  if (m.shown && Math.abs(at.x - m.x) <= 18 && Math.abs(at.y - m.y) <= 15) return true
  const s = { x: d.x + SPOTS.sensei.x, y: d.y + SPOTS.sensei.y }
  if (Math.abs(at.x - s.x) <= 12 && at.y <= s.y + 3 && at.y >= s.y - 30) return true
  const box = hallBox(d)
  return arts.has('hall') && at.x >= box.left && at.x <= box.right && at.y >= box.top && at.y <= box.bottom + 4
}

/** How close (world px) a walker may come to a resident's feet or a post. */
const ROOM = 11

/** Pushes feet at `v` off the residents and posts and out of the hall's footprint (and the ground behind it), so walkers go around (mutates `v`). */
export const pushOutDojo = (d: Dojo, v: Vec) => {
  for (const k of [SPOTS.sensei, SPOTS.wobbuffet, ...SPOTS.posts]) {
    const dx = v.x - d.x - k.x
    const dy = v.y - d.y - k.y
    const dist = Math.hypot(dx, dy)
    if (dist >= ROOM) continue
    v.x = d.x + k.x + (dist > 1e-6 ? (dx / dist) * ROOM : ROOM)
    v.y = d.y + k.y + (dist > 1e-6 ? (dy / dist) * ROOM : 0)
  }
  if (!arts.has('hall')) return
  const box = hallBox(d)
  const half = (box.right - box.left) / 2 + 8
  const top = box.top - 20
  const bottom = d.y + 6
  if (v.y > top && v.y < bottom && Math.abs(v.x - d.x) < half) {
    const side = half - Math.abs(v.x - d.x)
    const up = v.y - top
    const down = bottom - v.y
    if (up < side && up < down) v.y = top
    else if (down < side) v.y = bottom
    else v.x = d.x + Math.sign(v.x - d.x || 1) * half
  }
}

/** Where the camera (its top-left, world px) frames the Dojo for a `w`×`h` view: the hall's roof near the top, the yard and Machoke below it, clear of the dialogue box. */
export const dojoFrame = (d: Dojo, w: number, h: number): Vec => {
  const box = hallBox(d)
  return { x: Math.round(d.x - w / 2), y: Math.round(box.top - Math.min(24, h * 0.05)) }
}

const MARKER: MarkerLook = { card: '#f8e0c8', arrow: '#e05038', headDy: 0 }
/** How far (px) the hall must reach into the view to count as on screen. */
const INSET = 16

/**
 * A card at the edge of the view with an arrow, pointing at the Dojo
 * (Machoke's head) while the hall is off screen, like the plaza's. It
 * remembers where it was drawn (`marker`) so a tap on it leads there.
 */
export const drawDojoMarker = (ctx: CanvasRenderingContext2D, d: Dojo, camX: number, camY: number, w: number, h: number, time: number, show: boolean, inside: ViewBox | null) => {
  d.marker.shown = false
  const box = hallBox(d)
  const seen = box.right > camX + INSET && box.left < camX + w - INSET && box.bottom > camY + INSET && box.top < camY + h - INSET
  if (!show || seen || !arts.has('hall')) return
  const card = markerCard(SENSEI.dex, MARKER)
  if (!card) return
  const at = edgeSpot({ x: d.x - camX, y: d.y - 30 - camY }, w, h, Math.floor(time * 3) % 2, inside)
  drawMarker(ctx, card, at, MARKER.arrow)
  Object.assign(d.marker, { x: at.x + camX, y: at.y + camY, shown: true })
}

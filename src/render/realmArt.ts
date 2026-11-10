import { canvasCache, context2d, createCanvas, drawable, readPixels } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { BASE_GRID, BASE_ROOM, REALM_ROOMS, type Point, type Shape, type TownRoomId } from '../data/realmMap'
import type { BaseExterior } from '../data/secretBases'
import type { Piece } from './plaza'
import { ENTRANCE_ART, TOWN_ART, TOWN_FPS, TOWN_FRAMES, TOWN_LAYOUT, type Host, type Prop, type Surface, type TownArt } from './realmLayout'
import { drawPokemon, loadSpecies, loadedSprites } from './sprites'

/** Every Pokémon standing in a town room: the hosts at their spots and the ones standing for show (`figures`). */
const townFigures = (room: TownRoomId): readonly Host[] => [...(TOWN_LAYOUT[room].hosts ?? []), ...(TOWN_LAYOUT[room].figures ?? [])]

/**
 * The Poké Realm's town, drawn like the lobby: grass in the meadow's palette
 * with its tufts and flowers, the plaza's cobblestones and curb, PixelLab
 * pieces (`public/assets/realm/`, plus the lobby's own benches, lamps and
 * trees) standing on their feet and casting their silhouette as a shadow.
 * Where everything stands is `render/realmLayout.ts`; what blocks walking is
 * `REALM_ROOMS` (`data/realmMap.ts`), which matches it.
 *
 * Three layers, as the lobby's plaza: `drawTownGround` under everyone (the
 * room's painted ground, built once and cached, the pieces' shadows, the
 * water's glints), `townPieces` sorted by their feet among the walkers, and
 * `drawTownOverhead` over them (the dust in the café's sunbeams). Base interiors
 * (`baseShell`) are painted the same way, one per exterior.
 *
 * The trail's `mine` piece is the player's own secret base entrance: the
 * caller passes the exterior their base wears (`exterior`, the cave until
 * it's known) and it draws that one (`ENTRANCE_ART`).
 */

type Rgb = readonly [number, number, number]

const rgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
const shades = (...hexes: string[]) => hexes.map(rgb)

/* ---------------- Art ---------------- */

/** A loaded PNG and the box of its painted pixels, so a piece stands on its real feet whatever padding the image has. */
type Art = { img: HTMLImageElement; minX: number; maxY: number; w: number; h: number; minY: number }
const arts = new Map<TownArt, Art>()
let loading = false

/** The alpha bounding box of an image (pixels above a faint alpha); the whole picture when it can't be read back. */
const measure = (img: HTMLImageElement): Art => {
  const canvas = createCanvas(img.width, img.height)
  const ctx = context2d(canvas)
  ctx.drawImage(img, 0, 0)
  const data = readPixels(ctx, 0, 0, img.width, img.height)?.data
  if (!data) return { img, minX: 0, minY: 0, maxY: img.height - 1, w: img.width, h: img.height }
  let minX = img.width
  let maxX = -1
  let minY = img.height
  let maxY = -1
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3]! <= 40) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  return { img, minX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

const loadArt = (id: TownArt, tries = 3) => {
  const img = new Image()
  img.src = `${import.meta.env.BASE_URL}assets/${TOWN_ART[id]}.png`
  const landed = () => {
    if (drawable(img)) arts.set(id, measure(img))
    else if (tries > 1) setTimeout(() => loadArt(id, tries - 1), 5000)
  }
  void img.decode().then(landed, landed)
}

/** An exterior's entrance PNG (the grove's centerpiece), for the base editor's exterior picker. */
export const entranceUrl = (exterior: BaseExterior) => `${import.meta.env.BASE_URL}assets/${TOWN_ART[ENTRANCE_ART[exterior].art]}.png`

/** Starts loading the town's PNGs (once): pieces show up as they arrive. */
export const loadTownArt = () => {
  if (loading) return
  loading = true
  for (const id of Object.keys(TOWN_ART) as TownArt[]) loadArt(id)
}

/** Draws `art` with the bottom middle of its painted box at (x, y), mirrored when `flip`. */
const put = (ctx: CanvasRenderingContext2D, art: Art, x: number, y: number, flip = false) => {
  const dy = Math.round(y - art.maxY - 1)
  if (!flip) return ctx.drawImage(art.img, Math.round(x - (art.minX + art.w / 2)), dy)
  // Mirrored, the painted box's middle lands `width - middle` from the image's left.
  const left = Math.round(x - (art.img.width - (art.minX + art.w / 2)))
  ctx.save()
  ctx.scale(-1, 1)
  ctx.drawImage(art.img, -(left + art.img.width), dy)
  ctx.restore()
}

/* ---------------- Ground ---------------- */

/** What a ground pixel is made of, the later surfaces painting over the earlier. */
const M = { grass: 0, paving: 1, path: 2, sand: 3, water: 4, pool: 5, boards: 6, floor: 7, wall: 8, mat: 9, carpet: 10, ballRug: 11 } as const
type Material = (typeof M)[keyof typeof M]

/** The meadow's grass (`render/world.ts`), its dense zones, the paths' dirt, the beach's sand. */
const GRASS = shades('#8fd068', '#88c862', '#80c05c')
const GRASS_ALT = shades('#74b452', '#6eac4e', '#67a448')
const DIRT = shades('#d8c088', '#d0b880', '#c8b078')
const SAND = shades('#f0dca8', '#f6e4b4', '#e8d29c')
const WET_SAND = shades('#dcc28c', '#e2c894', '#d4b884')
const SEA = shades('#4c9ad8', '#5aa6e0', '#4290d0')
const SEA_DEEP = shades('#3c86c8', '#4690d0', '#367cc0')
const LAGOON = shades('#6cc4e4', '#7ccce8', '#62bcdc')
/** The lagoon's water going deeper from its shore: the shallows over sand, then the lagoon, then its middle. */
const SHALLOWS = shades('#9ce0e8', '#a8e6ec', '#8cd6e0')
const LAGOON_DEEP = shades('#4cb0d8', '#56b8dc', '#44a6d0')
/** The bank the lagoon's north shore drops by, its sand darker. */
const BANK = shades('#c8aa74', '#c0a26c', '#d0b27c')
const FOAM = rgb('#eef8fc')

/** The plaza's cobblestones (`render/plaza.ts`), the band of darker ones inside the curb, and the curb. */
const STONES = { stones: shades('#d8c8a0', '#cfbd94', '#e0d2ac', '#c8b68c', '#d4c49a'), mortar: rgb('#a89470'), hi: rgb('#ebe0c0'), lo: rgb('#bca880') }
const BAND = { stones: shades('#c4a77e', '#bb9d74', '#cbb088', '#b69670', '#c0a27a'), mortar: rgb('#8e7656'), hi: rgb('#d8c09a'), lo: rgb('#a68a62') }
const CURB = { lip: rgb('#e3dac3'), seam: rgb('#968568'), line: rgb('#5f5446'), face: rgb('#b8a988'), face2: rgb('#968568') }
const BAND_W = 8

/** Planks: the boardwalk's (across) and the café's floor (along), the gaps between them, and the boardwalk's edge. */
const PLANKS = { wood: shades('#b98a58', '#c4945e', '#ad7f50'), gap: rgb('#6e4a2c'), edge: rgb('#4a3020'), hi: rgb('#d4a874') }
const FLOOR = { wood: shades('#c99a64', '#d2a46e', '#bf905c', '#cb9f6a'), gap: rgb('#8a5f38'), hi: rgb('#deb482') }
const WALL = { paper: shades('#f2e6c8', '#ece0c0'), stripe: rgb('#e6d6b0'), wood: rgb('#9a6a3e'), woodHi: rgb('#b8844e'), woodLo: rgb('#6e4828'), line: rgb('#4a3020') }
/** The arcade: its carpet (a night blue strewn with neon shapes, as arcade carpets are), its plum brick wall and its neon tubes. */
const CARPET = { base: shades('#2a2450', '#2e2856', '#26204a'), shapes: shades('#ff5ab4', '#4ae0f0', '#f8d848', '#78e070') }
const NEON_WALL = { brick: shades('#46305e', '#4c3466', '#402a56'), mortar: rgb('#2c1e3e'), top: rgb('#1e1430'), panel: rgb('#30203f'), trim: rgb('#c84898'), trimHi: rgb('#f070c0'), line: rgb('#140c20') }
const TUBES = [
  { y: 16, core: rgb('#ffd0ec'), glow: rgb('#ff5ab4') },
  { y: 40, core: rgb('#d8fcff'), glow: rgb('#4ae0f0') },
] as const

/** The carpet's shapes, one maybe per 20 px tile: a star, a zigzag, a ring, a dot cluster. */
const CARPET_SHAPES = [
  ['..1..', '.111.', '11111', '.1.1.'],
  ['1...1', '.1.1.', '..1..'],
  ['.11.', '1..1', '1..1', '.11.'],
  ['1.1', '...', '.1.'],
] as const

const WINDOW = { frame: rgb('#6e4828'), sky: rgb('#9ad4f4'), skyHi: rgb('#c8ecfc'), sill: rgb('#b8844e') }

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Bilinear value noise in [0, 1) (the meadow's). */
const noise = (x: number, y: number, scale: number, seed: number) => {
  const gx = x / scale
  const gy = y / scale
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = smooth(gx - x0)
  const ty = smooth(gy - y0)
  const a = hash2(x0, y0, seed)
  const b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed)
  const d = hash2(x0 + 1, y0 + 1, seed)
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

/** Mostly the first shade, with sparse lighter and darker pixels, as the meadow dithers. */
const dither = (pal: readonly Rgb[], x: number, y: number, seed = 1): Rgb => {
  const r = hash2(x, y, seed)
  return pal[r < 0.7 ? 0 : r < 0.9 ? 1 : 2]!
}

const inShape = (s: Shape, x: number, y: number) =>
  s.kind === 'rect' ? x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h : ((x + 0.5 - s.x) / s.rx) ** 2 + ((y + 0.5 - s.y) / s.ry) ** 2 <= 1

/** How far (px) (x, y) lies from the segment a–b. */
const toSegment = (x: number, y: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy)
}

/** How far (px, ±`reach`) the sea's edge (or a lagoon's, nearer) wanders from its shape at (a, b): a coast, never a ruler's line. */
const SHORE = 9
const shore = (a: number, b: number, seed: number, reach = SHORE, scale = 46) => Math.round((noise(a, b, scale, seed) - 0.5) * 2 * reach)

/** Which material each pixel of a `w`×`h` room is: grass, then every surface in order over it. */
const materials = (w: number, h: number, ground: readonly Surface[]) => {
  const mat = new Uint8Array(w * h)
  for (const s of ground) {
    if (s.kind === 'wall') {
      for (let y = 0; y < Math.min(h, s.h); y++) mat.fill(M.wall, y * w, y * w + w)
      continue
    }
    const value: Material = s.kind === 'water' && s.pool ? M.pool : s.kind === 'dirt' ? M.path : M[s.kind]
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // A path's edge wobbles a pixel, as the meadow's do.
        const hit =
          s.kind === 'path' ? s.points.slice(1).some((b, i) => toSegment(x, y, s.points[i]!, b) < s.r + (hash2(x >> 2, y >> 2, 9) < 0.3 ? 1 : 0))
          : s.kind === 'water' && !s.pool ? inShape(s.shape, x + shore(y, x, 31), y + shore(x, y, 32))
          : s.kind === 'water' || s.kind === 'dirt' ? inShape(s.shape, x + shore(y, x, 33, 5, 22), y + shore(x, y, 34, 4, 22))
          : inShape(s.shape, x, y)
        if (hit) mat[y * w + x] = value
      }
    }
  }
  return mat
}

/**
 * How far (px, up to `max`) every pixel lies from the nearest pixel not
 * `of` (a chamfer pass); pixels past the room's edge count as `of`, so a
 * paved road runs on out of the room without a curb across it.
 */
const depthMap = (mat: Uint8Array, w: number, h: number, of: (m: number) => boolean, max: number) => {
  const d = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) d[i] = of(mat[i]!) ? max : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? max : d[y * w + x]!)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[y * w + x]) d[y * w + x] = Math.min(d[y * w + x]!, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1, at(x + 1, y - 1) + 1)
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) if (d[y * w + x]) d[y * w + x] = Math.min(d[y * w + x]!, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1, at(x - 1, y + 1) + 1)
  return d
}

/** Staggered `sw`×`sh` stones with mortar, a lit top row and a shaded bottom one. */
const stoneAt = (pave: typeof STONES, x: number, y: number, sw = 10, sh = 6) => {
  const row = Math.floor(y / sh)
  const offset = (row % 2) * (sw >> 1)
  const ly = y % sh
  const lx = (x + offset) % sw
  const stone = pave.stones[(Math.floor((x + offset) / sw) * 31 + row * 17) % pave.stones.length]!
  return lx === 0 || ly === 0 ? pave.mortar : ly === 1 && lx < sw - 1 ? pave.hi : ly === sh - 1 || lx === sw - 1 ? pave.lo : stone
}

/** A meadow tile's decor (`render/world.ts`), as pixel rows. */
const TUFT = ['.1...1.', '121.121', '1221221', '.12221.']
const BLADES = ['1.1', '.1.']
const FLOWER = ['.1.', '121', '.1.']
const PETALS = shades('#ffffff', '#f8e048', '#f87890', '#a8c8f8')

/** Paints a decor sprite's rows at (x, y) where the ground is still grass. */
const stamp = (set: (x: number, y: number, c: Rgb) => void, grass: (x: number, y: number) => boolean, rows: readonly string[], colors: Record<string, Rgb>, x: number, y: number) => {
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => colors[ch] && grass(x + dx, y + dy) && set(x + dx, y + dy, colors[ch]!)))
}

/**
 * A town room's ground, painted once into a canvas: the meadow's grass
 * (dense zones, tufts, blades and flowers) under the room's surfaces, each
 * with its edge: the curb round the paving (its stone face and shadow on the
 * south side), the foam on the shore, the stone rim round the lagoon, the
 * boardwalk's dark edge and its shadow on the water, the café's back wall
 * with its windows and wainscot and its shadow on the floor.
 */
const paintRoom = (room: TownRoomId) => {
  const { w, h } = REALM_ROOMS[room]
  const { ground } = TOWN_LAYOUT[room]
  const mat = materials(w, h, ground)
  const m = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : mat[y * w + x]!)
  // The curb runs where the paving meets anything but a path: a path arriving opens it.
  const paved = depthMap(mat, w, h, (v) => v === M.paving || v === M.path, 20)
  const wet = depthMap(mat, w, h, (v) => v === M.water || v === M.pool, 16)
  // How far from the water and from the grass the sand lies: wet near the sea and the lagoon, dithering into the grass at its edge.
  const dry = depthMap(mat, w, h, (v) => v !== M.water && v !== M.pool, 6)
  const ungrassed = depthMap(mat, w, h, (v) => v !== M.grass, 3)
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const image = ctx.createImageData(w, h)
  const px = image.data
  const set = (x: number, y: number, c: Rgb, alpha = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    if (alpha === 255) {
      px[i] = c[0]
      px[i + 1] = c[1]
      px[i + 2] = c[2]
    } else {
      const k = alpha / 255
      px[i] = Math.round(px[i]! * (1 - k) + c[0] * k)
      px[i + 1] = Math.round(px[i + 1]! * (1 - k) + c[1] * k)
      px[i + 2] = Math.round(px[i + 2]! * (1 - k) + c[2] * k)
    }
    px[i + 3] = 255
  }
  const wall = ground.find((s) => s.kind === 'wall')
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = mat[y * w + x]!
      if (v === M.grass) set(x, y, dither(noise(x, y, 96, 1996) > 0.55 ? GRASS_ALT : GRASS, x, y))
      else if (v === M.path) set(x, y, dither(DIRT, x, y, 3))
      else if (v === M.sand) {
        const edge = ungrassed[y * w + x]!
        if (edge <= 2 && hash2(x, y, 14) < (edge === 1 ? 0.5 : 0.22)) set(x, y, dither(GRASS, x, y))
        else set(x, y, dither(dry[y * w + x]! <= 5 ? WET_SAND : SAND, x, y, 5))
      }
      else if (v === M.water || v === M.pool) {
        const d = wet[y * w + x]!
        const pool = v === M.pool
        // The lagoon's north shore is a bank: the sand drops a couple of px into the water, seen from above.
        const bank = pool && d <= 3 && [1, 2, 3].some((k) => { const u = m(x, y - k); return u !== M.pool && u !== M.water })
        if (bank) set(x, y, d === 1 && m(x, y - 1) !== M.pool ? BANK[1]! : dither(BANK, x, y, 7))
        else if (pool && d <= 3) set(x, y, d === 1 || (d === 2 && hash2(x >> 1, y, 8) < 0.5) ? FOAM : dither(SHALLOWS, x, y, 6))
        else if (pool && d <= 9) set(x, y, dither(d <= 5 && hash2(x, y, 15) < 0.4 ? SHALLOWS : LAGOON, x, y, 6))
        else if (!pool && d <= 2) set(x, y, d === 1 ? FOAM : dither(LAGOON, x, y, 6))
        else {
          // Wave crests: short light dashes along rows, drifting with the noise.
          const crest = (y + Math.floor(noise(x, y, 30, 5) * 8)) % 13 === 0 && hash2(x >> 3, y, 4) < 0.28
          set(x, y, crest ? FOAM : dither(pool ? (d > 14 ? LAGOON_DEEP : LAGOON) : noise(x, y, 60, 8) > 0.55 ? SEA_DEEP : SEA, x, y, 6))
        }
      } else if (v === M.paving) {
        const d = paved[y * w + x]!
        if (d === 1) set(x, y, m(x, y + 1) !== M.paving && m(x, y - 1) === M.paving ? CURB.lip : CURB.line)
        else if (d === 2) set(x, y, CURB.lip)
        else if (d === 3) set(x, y, CURB.seam)
        else if (d < 3 + BAND_W) set(x, y, stoneAt(BAND, x, y, 8, 4))
        else set(x, y, stoneAt(STONES, x, y))
      } else if (v === M.boards) {
        // Planks across the walk, 6 px wide, with a dark edge along each side (and its ends inside the room: a platform's sides).
        const top = m(x, y - 1) !== M.boards
        const bottom = m(x, y + 1) !== M.boards
        const end = (m(x - 1, y) !== M.boards && m(x - 1, y) !== -1) || (m(x + 1, y) !== M.boards && m(x + 1, y) !== -1)
        const lx = x % 6
        set(x, y, top || bottom || end ? PLANKS.edge : lx === 0 ? PLANKS.gap : y % 14 === 3 && lx === 3 ? PLANKS.edge : lx === 1 ? PLANKS.hi : PLANKS.wood[(Math.floor(x / 6) * 7) % 3]!)
      } else if (v === M.floor) {
        const row = Math.floor(y / 8)
        const lx = (x + (row % 3) * 21) % 48
        const ly = y % 8
        set(x, y, ly === 0 || lx === 0 ? FLOOR.gap : ly === 1 ? FLOOR.hi : FLOOR.wood[(Math.floor((x + (row % 3) * 21) / 48) + row) % 4]!)
      } else if (v === M.carpet) {
        // Night blue, and in some 20 px tiles a neon shape in one of four colors.
        const tx = Math.floor(x / 20)
        const ty = Math.floor(y / 20)
        const pick = hash2(tx, ty, 51)
        const shape = CARPET_SHAPES[Math.floor(hash2(tx, ty, 52) * CARPET_SHAPES.length)]!
        const ox = tx * 20 + 3 + Math.floor(hash2(tx, ty, 53) * 10)
        const oy = ty * 20 + 3 + Math.floor(hash2(tx, ty, 54) * 10)
        const row = shape[y - oy]
        const on = pick < 0.62 && row !== undefined && row[x - ox] === '1'
        set(x, y, on ? CARPET.shapes[Math.floor(hash2(tx, ty, 55) * CARPET.shapes.length)]! : dither(CARPET.base, x, y, 56))
      } else if (v === M.ballRug) {
        // A Poké Ball: the rim dark, the top half red, the bottom white, a dark band across with the button in its middle.
        const rug = ground.find((g) => g.kind === 'ballRug')
        const o = rug && rug.kind === 'ballRug' && rug.shape.kind === 'oval' ? rug.shape : { x, y, rx: 1, ry: 1 }
        const edge = m(x - 1, y) !== M.ballRug || m(x + 1, y) !== M.ballRug || m(x, y - 1) !== M.ballRug || m(x, y + 1) !== M.ballRug
        const dy = y + 0.5 - o.y
        const button = ((x + 0.5 - o.x) / 9) ** 2 + (dy / 5) ** 2
        // Its weave: every few rows a slightly darker one.
        const weave = y % 3 === 0
        set(x, y, edge || (Math.abs(dy) < 2 && button > 1) || (button > 0.6 && button <= 1) ? rgb('#281c30') : button <= 0.6 ? rgb('#f4f0f8') : dy < 0 ? rgb(weave ? '#c83038' : '#d83840') : rgb(weave ? '#d4d0dc' : '#e4e0ec'))
      } else if (v === M.mat) {
        // A woven doormat: red with a cream border, its weave in rows.
        const edge = m(x - 1, y) !== M.mat || m(x + 1, y) !== M.mat || m(x, y - 1) !== M.mat
        const rim = m(x - 2, y) !== M.mat || m(x + 2, y) !== M.mat || m(x, y - 2) !== M.mat
        set(x, y, edge ? WALL.line : rim ? rgb('#f0e0b8') : (x + y) % 3 === 0 ? rgb('#a83a30') : rgb('#c84a3a'))
      } else if (v === M.wall && wall?.kind === 'wall' && wall.neon) {
        // Plum bricks under a dark cornice, two neon tubes along them, a dark panel with a magenta trim at the foot.
        const tube = TUBES.find((t) => Math.abs(y - t.y) <= 1)
        const course = Math.floor(y / 6)
        const lx = (x + (course % 2) * 8) % 16
        if (y >= wall.h - 2) set(x, y, NEON_WALL.line)
        else if (y < 4) set(x, y, NEON_WALL.top)
        else if (tube) set(x, y, y === tube.y ? tube.core : tube.glow)
        else if (y >= wall.h - 14) set(x, y, y === wall.h - 14 ? NEON_WALL.trimHi : y === wall.h - 13 ? NEON_WALL.trim : x % 24 === 0 ? NEON_WALL.line : NEON_WALL.panel)
        else set(x, y, y % 6 === 0 || lx === 0 ? NEON_WALL.mortar : NEON_WALL.brick[(Math.floor((x + (course % 2) * 8) / 16) + course) % 3]!)
        // The tubes' glow on the bricks round them.
        for (const t of TUBES) if (Math.abs(y - t.y) >= 2 && Math.abs(y - t.y) <= 4 && !tube && y < wall.h - 14) set(x, y, t.glow, 70 - Math.abs(y - t.y) * 12)
      } else if (v === M.wall && wall?.kind === 'wall') {
        const wainscot = y >= wall.h - 18
        const win = wall.windows.find((wx) => x >= wx - 18 && x < wx + 18 && y >= 12 && y < 38)
        if (y >= wall.h - 2) set(x, y, WALL.line)
        else if (win !== undefined) {
          const lx = x - (win - 18)
          const ly = y - 12
          const frame = lx < 2 || lx > 33 || ly < 2 || ly > 23 || lx === 17 || ly === 12
          set(x, y, ly >= 23 ? WINDOW.sill : frame ? WINDOW.frame : (lx + ly) % 11 < 2 ? WINDOW.skyHi : WINDOW.sky)
        } else if (wainscot) set(x, y, y === wall.h - 18 ? WALL.woodHi : x % 16 === 0 ? WALL.woodLo : y === wall.h - 3 ? WALL.woodLo : WALL.wood)
        else set(x, y, x % 12 < 6 ? WALL.paper[0]! : WALL.stripe)
      }
    }
  }
  // Below a curb's south edge: its stone face, its outline, then a shadow on what lies below.
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (m(x, y) === M.paving || m(x, y) === M.path) continue
      const up = m(x, y - 1) === M.paving ? 1 : m(x, y - 2) === M.paving ? 2 : m(x, y - 3) === M.paving ? 3 : m(x, y - 4) === M.paving ? 4 : 0
      if (up === 1) set(x, y, CURB.face)
      else if (up === 2) set(x, y, CURB.face2)
      else if (up === 3) set(x, y, CURB.line)
      else if (up === 4) set(x, y, [0, 0, 0], 56)
      else if ((m(x - 1, y) === M.paving || m(x + 1, y) === M.paving) && m(x, y) !== M.path) set(x, y, CURB.line)
    }
  }
  // Indoors: side walls down the edges, and sunlight through the back wall's windows slanting onto the floor.
  if (wall?.kind === 'wall') {
    for (let y = wall.h; y < h; y++) {
      for (const x of [0, 1, 2, 3, 4, 5, w - 6, w - 5, w - 4, w - 3, w - 2, w - 1]) {
        const k = Math.min(x, w - 1 - x)
        if (wall.neon) set(x, y, k === 5 ? NEON_WALL.line : k === 4 ? NEON_WALL.trim : NEON_WALL.panel)
        else set(x, y, k === 5 ? WALL.line : k === 4 ? WALL.woodHi : WALL.wood)
      }
      for (const wx of wall.windows) {
        const run = y - wall.h
        if (run > 70) continue
        for (let x = Math.round(wx - 16 + run * 0.45); x < wx + 16 + run * 0.45; x++) if (m(x, y) === M.floor) set(x, y, [255, 244, 200], Math.round(70 * (1 - run / 70)))
      }
    }
  }
  // The boardwalk's shadow on the water, and the wall's on the floor.
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = m(x, y)
      if ((v === M.water || v === M.pool) && (m(x, y - 1) === M.boards || m(x, y - 2) === M.boards || m(x, y - 3) === M.boards)) set(x, y, [10, 40, 80], 90)
      if ((v === M.floor || v === M.carpet) && (m(x, y - 1) === M.wall || m(x, y - 2) === M.wall || m(x, y - 3) === M.wall)) set(x, y, [40, 20, 10], 60)
    }
  }
  // The meadow's decor on the grass, one roll per 16 px tile, kept off everything else.
  const grass = (x: number, y: number) => m(x, y) === M.grass
  for (let ty = 0; ty < h; ty += 16) {
    for (let tx = 0; tx < w; tx += 16) {
      const roll = hash2(tx, ty, 2)
      const jx = tx + Math.floor(hash2(tx, ty, 4) * 10)
      const jy = ty + Math.floor(hash2(tx, ty, 5) * 10)
      if (!grass(jx, jy) || !grass(jx + 6, jy + 4)) continue
      if (roll < 0.06) {
        const petal = PETALS[Math.floor(hash2(tx, ty, 6) * PETALS.length)]!
        stamp(set, grass, FLOWER, { 1: petal, 2: rgb('#f8b030') }, jx, jy)
        stamp(set, grass, FLOWER, { 1: petal, 2: rgb('#f8b030') }, jx + 5, jy + 4)
      } else if (roll < 0.1) stamp(set, grass, TUFT, { 1: rgb('#2f7a3a'), 2: rgb('#4f9e48') }, jx, jy)
      else if (roll < 0.26) stamp(set, grass, BLADES, { 1: rgb('#5a9a40') }, jx, jy)
    }
  }
  ctx.putImageData(image, 0, 0)
  // Where the water glints, a pixel picked every so often.
  const glints: { x: number; y: number; phase: number }[] = []
  for (let y = 0; y < h; y += 7) for (let x = (y * 5) % 13; x < w; x += 13) if (wet[y * w + x]! > 4 && hash2(x, y, 12) < 0.35) glints.push({ x, y, phase: hash2(x, y, 13) * 6 })
  return { canvas, glints }
}

const grounds = canvasCache<TownRoomId, ReturnType<typeof paintRoom>>()

const groundOf = (room: TownRoomId) => {
  let g = grounds.get(room)
  if (!g) grounds.set(room, (g = paintRoom(room)))
  return g
}

/**
 * How far (px, up to `max`) each sand pixel of `room` lies from the water, 0
 * anywhere else: what the Hora do Realm's tide floods (`render/realmHours.ts`).
 */
export const sandByWater = (room: TownRoomId, max: number) => {
  const { w, h } = REALM_ROOMS[room]
  const mat = materials(w, h, TOWN_LAYOUT[room].ground)
  const depth = depthMap(mat, w, h, (v) => v !== M.water && v !== M.pool, max)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      // The lagoon's north bank (the sand `paintRoom` draws in its top rows) goes under first.
      const bank = mat[i] === M.pool && [1, 2, 3].some((k) => y >= k && mat[i - k * w] !== M.pool && mat[i - k * w] !== M.water)
      depth[i] = bank ? 1 : mat[i] === M.sand ? depth[i]! : 0
    }
  }
  return { w, h, depth }
}

/* ---------------- The arcade's lights ---------------- */

/**
 * The arcade's neon signs on its back wall, each a glyph of tube (`1`, its
 * core lighter `2`) with a halo: a berry over the Berry Rain cabinets, a
 * mallet over the Whack-a-Diglett ones, a Poké Ball between the cabinets and
 * the prize counter. They hum (a slow pulse) and now and then one flickers.
 */
const NEON_SIGNS = [
  { x: 72, y: 21, color: '#ff5ab4', core: '#ffd0ec', rows: ['......1.11...', '......11..1..', '....1111111..', '...1.......1.', '..1.2.......1', '..1.2.......1', '..1.........1', '..1.........1', '...1.......1.', '....1111111..'] },
  { x: 152, y: 22, color: '#f8d848', core: '#fff8c8', rows: ['1111111......', '1.....1......', '1.2...11111111', '1.....1......1', '1.....11111111', '1.....1......', '1111111......'] },
  { x: 228, y: 20, color: '#4ae0f0', core: '#d8fcff', rows: ['....11111....', '..11.....11..', '.1.........1.', '.1.2.......1.', '1....111....1', '11111.2.11111', '1....111....1', '.1.........1.', '.1.........1.', '..11.....11..', '....11111....'] },
] as const

/** A sign's art: its tube on a halo of its color, two px round. */
const neonSign = (sign: (typeof NEON_SIGNS)[number]) => {
  const w = Math.max(...sign.rows.map((r) => r.length)) + 6
  const h = sign.rows.length + 6
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const plot = (color: string, alpha: number, dx: number, dy: number) => {
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    sign.rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && ctx.fillRect(x + 3 + dx, y + 3 + dy, 1, 1)))
  }
  for (let r = 2; r >= 1; r--) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]] as const) plot(sign.color, r === 2 ? 0.12 : 0.25, dx, dy)
  plot(sign.color, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.fillStyle = sign.core
  sign.rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '2' && ctx.fillRect(x + 3, y + 3, 1, 1)))
  return canvas
}
const neonSigns = canvasCache<number, HTMLCanvasElement>()

/** The cabinets' screens throw their light on the carpet in front of them: where, and the screen's color. */
const SCREEN_GLOW = [
  { x: 52, color: '255,120,140' },
  { x: 92, color: '255,150,120' },
  { x: 132, color: '140,240,140' },
  { x: 172, color: '120,220,255' },
] as const

/** Draws the arcade's lights over its painted ground: the neon signs humming and the screens' glow pooling on the carpet. */
const drawArcadeLights = (ctx: CanvasRenderingContext2D, camX: number, camY: number, time: number) => {
  NEON_SIGNS.forEach((sign, i) => {
    let art = neonSigns.get(i)
    if (!art) neonSigns.set(i, (art = neonSign(sign)))
    // A flicker: each sign, once in a while, blinks off for a beat or two.
    const beat = Math.floor(time * 10)
    const off = hash2(beat, i, 61) < 0.025 || (hash2(Math.floor(beat / 2), i, 62) < 0.012 && beat % 2 === 0)
    if (off) return
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(time * 2.3 + i * 1.7)
    ctx.drawImage(art, Math.round(sign.x - art.width / 2 - camX), Math.round(sign.y - 3 - camY))
    ctx.globalAlpha = 1
  })
  for (const [i, g] of SCREEN_GLOW.entries()) {
    // A pool of light in steps (no gradient), brightest at the cabinet's foot, flickering with the game on screen.
    const flicker = 0.75 + 0.25 * Math.sin(time * 7.3 + i * 2.1) * Math.sin(time * 3.1 + i)
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = `rgba(${g.color},${((0.3 - k * 0.08) * flicker).toFixed(3)})`
      ctx.fillRect(Math.round(g.x - 9 - k * 2 - camX), Math.round(101 + k * 4 - camY), 18 + k * 4, 4)
    }
  }
}

/* ---------------- Shadows ---------------- */

const SHADOW = 'rgba(30,40,30,0.3)'
const SQUASH = 0.28

/** A piece's silhouette shadow: its painted rows squashed flat and tinted. Cached per art. */
const silhouettes = canvasCache<Art, HTMLCanvasElement>()
const silhouette = (art: Art) => {
  let s = silhouettes.get(art)
  if (s) return s
  s = createCanvas(art.img.width, Math.max(1, Math.round(art.h * SQUASH)))
  const ctx = context2d(s)
  ctx.drawImage(art.img, 0, art.minY, art.img.width, art.h, 0, 0, s.width, s.height)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = SHADOW
  ctx.fillRect(0, 0, s.width, s.height)
  silhouettes.set(art, s)
  return s
}

/** Pieces lying flat or hanging on the wall cast no shadow. */
const FLAT: ReadonlySet<TownArt> = new Set(['shelf', 'boat', 'beachball', 'prizeShelf'])

/** What a prop draws and where its art's middle stands: the player's own entrance follows their base's exterior. */
const resolve = (p: Prop, exterior: BaseExterior): { art: TownArt; x: number } => {
  if (!p.mine) return { art: p.art, x: p.x }
  const e = ENTRANCE_ART[exterior]
  return { art: e.art, x: p.x + e.dx }
}

/**
 * Draws a town room's ground under everyone: the painted ground, the pieces'
 * shadows and, on the water, glints that come and go. `exterior`: the one
 * the player's own base entrance wears (the trail's `mine` piece).
 */
export const drawTownGround = (ctx: CanvasRenderingContext2D, room: TownRoomId, camX: number, camY: number, _w: number, _h: number, time: number, exterior: BaseExterior = 'cave') => {
  loadTownArt()
  const g = groundOf(room)
  ctx.drawImage(g.canvas, -Math.round(camX), -Math.round(camY))
  if (room === 'arcade') drawArcadeLights(ctx, camX, camY, time)
  for (const p of TOWN_LAYOUT[room].props) {
    const { art: id, x } = resolve(p, exterior)
    const art = arts.get(id)
    if (!art || FLAT.has(id)) continue
    const mask = silhouette(art)
    ctx.drawImage(mask, Math.round(x - camX - (art.minX + art.w / 2)) + 2, Math.round(p.y - camY - mask.height) + 2)
  }
  for (const host of townFigures(room)) {
    ctx.fillStyle = 'rgba(30,40,30,0.3)'
    ctx.beginPath()
    ctx.ellipse(Math.round(host.x - camX), Math.round(host.y - camY), 8, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#eef8fc'
  for (const s of g.glints) if ((time * 1.3 + s.phase) % 6 < 0.6) ctx.fillRect(Math.round(s.x - camX), Math.round(s.y - camY), 2, 1)
}

/* ---------------- Pieces ---------------- */

const pieceCache = new Map<string, { count: number; pieces: Piece[] }>()

/**
 * A town room's standing pieces, each sorted by its feet among the walkers
 * (like `plazaPieces`); only those whose PNG is in, so the list grows as the
 * art arrives. The room's hosts (Pokémon standing at their spot, idling)
 * come along. `exterior`: the one the player's own entrance wears.
 */
export const townPieces = (room: TownRoomId, exterior: BaseExterior = 'cave'): readonly Piece[] => {
  loadTownArt()
  const key = `${room}:${exterior}`
  const cached = pieceCache.get(key)
  if (cached?.count === arts.size) return cached.pieces
  const pieces = TOWN_LAYOUT[room].props.flatMap((p): Piece[] => {
    const { art: id, x } = resolve(p, exterior)
    const art = arts.get(id)
    if (!art) return []
    const frames = (TOWN_FRAMES[id] ?? []).map((f) => arts.get(f) ?? art)
    // The boat and the towel lie flat: they sort under everyone.
    return [
      {
        y: id === 'boat' || id === 'beachball' ? -1 : p.y,
        draw: (ctx, camX, camY, time) => put(ctx, frames.length ? frames[Math.floor(time * TOWN_FPS) % frames.length]! : art, x - camX, p.y - camY, p.flip),
      },
    ]
  })
  for (const host of townFigures(room)) {
    void loadSpecies(host.dex).catch(() => {})
    pieces.push({
      y: host.y,
      draw: (ctx, camX, camY, time) => {
        const s = loadedSprites(host.dex)
        if (s) drawPokemon(ctx, s, 'Idle', host.facing, time, Math.round(host.x - camX), Math.round(host.y - camY))
      },
    })
  }
  pieceCache.set(key, { count: arts.size, pieces })
  return pieces
}

/** How far (px) above a spot its label floats when no piece stands behind it. */
const LABEL_LIFT = 34

/**
 * Where a label over a spot (or a door) at `at` floats: just over the top of
 * the piece it belongs to (the nearest standing piece behind it, a host
 * Pokémon too), else a little over the spot. World px, the label's bottom.
 */
export const labelTop = (room: TownRoomId, at: Point, exterior: BaseExterior = 'cave'): number => {
  let best: { d: number; top: number } | null = null
  for (const p of TOWN_LAYOUT[room].props) {
    const { art: id, x } = resolve(p, exterior)
    const art = arts.get(id)
    if (!art || FLAT.has(id) || p.y > at.y + 4 || at.y - p.y > 64 || Math.abs(x - at.x) > Math.max(24, art.w / 2)) continue
    const d = Math.hypot(x - at.x, p.y - at.y)
    if (!best || d < best.d) best = { d, top: p.y - art.h - 3 }
  }
  for (const host of townFigures(room)) {
    const d = Math.hypot(host.x - at.x, host.y - at.y)
    if (d < 32 && (!best || d < best.d)) best = { d, top: host.y - 40 }
  }
  return best?.top ?? at.y - LABEL_LIFT
}

/* ---------------- Overhead ---------------- */

/** Motes of dust drifting in the café's sunbeams: where each starts (room px) and its pace. */
const MOTES = Array.from({ length: 14 }, (_, i) => ({ x: [60, 340][i % 2]! - 14 + hash2(i, 1, 41) * 40, y: 70 + hash2(i, 2, 41) * 60, speed: 2 + hash2(i, 3, 41) * 3, phase: hash2(i, 4, 41) * 9 }))

/**
 * Draws over everyone in a town room: in the café, motes of dust drifting
 * down its sunbeams; outdoors nothing (the pieces' own tops are already
 * sorted over the walkers behind them).
 */
export const drawTownOverhead = (ctx: CanvasRenderingContext2D, room: TownRoomId, camX: number, camY: number, _w: number, _h: number, time: number) => {
  if (room !== 'cafe') return
  ctx.fillStyle = 'rgba(255,248,214,0.8)'
  for (const m of MOTES) {
    const k = ((time * m.speed + m.phase * 7) % 60) / 60
    const x = m.x + k * 26 + Math.sin(time * 0.8 + m.phase) * 3
    const y = m.y + k * 50
    if ((time + m.phase) % 4 < 3) ctx.fillRect(Math.round(x - camX), Math.round(y - camY), 1, 1)
  }
}

/* ---------------- Base interiors ---------------- */

/** Each exterior's walls (light to dark, then a crack or seam color) and floor (dithered shades, then a speck color). */
const SHELLS = {
  cave: { wall: shades('#9c7a56', '#8a6a4a', '#7a5c3e', '#4a3624'), floor: shades('#b8946a', '#c09c72', '#ac8a60', '#8a6a48') },
  tree: { wall: shades('#9a6a40', '#8c5e38', '#764e2e', '#4e321c'), floor: shades('#d0a46c', '#d8ac76', '#c49862', '#a87c4a') },
  bush: { wall: shades('#5aa850', '#4a9a44', '#3a823a', '#24562a'), floor: shades('#8fd068', '#88c862', '#80c05c', '#5a9a40') },
  sand: { wall: shades('#e8cc90', '#d8b878', '#c8a462', '#a8844a'), floor: shades('#f0dca8', '#f6e4b4', '#e8d29c', '#cdb382') },
} as const satisfies Record<BaseExterior, { wall: readonly Rgb[]; floor: readonly Rgb[] }>

/** A wall's pixel at (x, y) for an exterior: rock with cracks, bark in vertical strips, leaf clusters, sandstone in layers. */
const wallAt = (exterior: BaseExterior, x: number, y: number): Rgb => {
  const shade = SHELLS[exterior].wall
  const [hi, mid, lo, dark] = [shade[0]!, shade[1]!, shade[2]!, shade[3]!]
  const r = hash2(x, y, 21)
  if (exterior === 'cave') {
    const n = noise(x, y, 14, 3)
    if (Math.abs(n - 0.5) < 0.025) return dark
    return n > 0.62 ? hi : n < 0.38 ? lo : r < 0.15 ? lo : mid
  }
  if (exterior === 'tree') {
    const strip = Math.floor((x + Math.floor(noise(x, y, 18, 4) * 6)) / 5)
    const edge = (x + Math.floor(noise(x, y, 18, 4) * 6)) % 5 === 0
    return edge ? dark : strip % 3 === 0 ? hi : strip % 3 === 1 ? mid : lo
  }
  if (exterior === 'bush') {
    // Clumps of foliage: the noise's peaks lit, its valleys in shadow, a leaf's edge here and there.
    const n = noise(x, y, 9, 7) * 0.7 + noise(x, y, 3, 8) * 0.3
    return n > 0.62 ? hi : n > 0.47 ? (r < 0.1 ? hi : mid) : n > 0.36 ? lo : dark
  }
  const band = Math.floor((y + Math.floor(noise(x, y, 40, 6) * 6)) / 6)
  return (y + Math.floor(noise(x, y, 40, 6) * 6)) % 6 === 0 ? lo : r < 0.05 ? dark : band % 3 === 0 ? hi : band % 3 === 1 ? mid : lo
}

/** A floor's pixel at (x, y) for an exterior: dithered ground and, now and then, a pebble or a leaf. */
const floorAt = (exterior: BaseExterior, x: number, y: number): Rgb => {
  const f = SHELLS[exterior].floor
  if (exterior === 'tree') {
    // Boards of the hollow trunk's floor, their grain wandering, a darker seam between them.
    const row = Math.floor(y / 12)
    const grain = Math.abs(noise(x, y * 4, 24, 25 + row) - 0.5) < 0.03
    return y % 12 === 0 ? f[3]! : grain && hash2(x, y, 26) < 0.7 ? f[2]! : dither(f, x, y, 23)
  }
  return hash2(x >> 1, y >> 1, 24) < 0.012 ? f[3]! : dither(f, x, y, 23)
}

const shells = canvasCache<BaseExterior, HTMLCanvasElement>()

/**
 * A secret base's interior for an exterior (`BASE_EXTERIORS`), `BASE_ROOM`'s
 * size: its back wall over the top `BASE_GRID.wallRows` rows (a dark top
 * edge, a lit lip at its foot and its shadow on the floor), the floor, the
 * side walls' dark edges and the way out on the bottom row's middle tile
 * (`DOOR` in `data/secretBases.ts`). Wallpaper and flooring furniture paint
 * over the wall and the floor (`furnitureImage`, one tile repeated).
 */
export const baseShell = (exterior: BaseExterior): HTMLCanvasElement => {
  const hit = shells.get(exterior)
  if (hit) return hit
  const { w, h } = BASE_ROOM
  const wallH = BASE_GRID.wallRows * BASE_GRID.tile
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const image = ctx.createImageData(w, h)
  const px = image.data
  const set = (x: number, y: number, c: Rgb, alpha = 255) => {
    const i = (y * w + x) * 4
    const k = alpha / 255
    px[i] = Math.round(px[i]! * (1 - k) + c[0] * k)
    px[i + 1] = Math.round(px[i + 1]! * (1 - k) + c[1] * k)
    px[i + 2] = Math.round(px[i + 2]! * (1 - k) + c[2] * k)
    px[i + 3] = 255
  }
  const dark = SHELLS[exterior].wall[3]!
  const door = { x: Math.floor(BASE_GRID.cols / 2) * BASE_GRID.tile, y: (BASE_GRID.rows - 1) * BASE_GRID.tile }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < wallH) set(x, y, y < 2 ? dark : y >= wallH - 2 ? SHELLS[exterior].wall[0]! : wallAt(exterior, x, y))
      else set(x, y, floorAt(exterior, x, y))
      // The wall darkens toward the top, the floor at the sides.
      if (y < wallH && y < 10) set(x, y, [0, 0, 0], (10 - y) * 9)
      const side = Math.min(x, w - 1 - x)
      if (side < 6) set(x, y, [0, 0, 0], (6 - side) * 14)
      if (y >= wallH && y < wallH + 4) set(x, y, [0, 0, 0], (wallH + 4 - y) * 16)
    }
  }
  // The way out: a dark opening on the bottom row's middle tile, lit at its sill.
  for (let y = door.y + 6; y < h; y++) {
    for (let x = door.x + 3; x < door.x + BASE_GRID.tile - 3; x++) {
      // An arch: its top corners rounded off.
      const k = Math.min(x - door.x - 3, door.x + BASE_GRID.tile - 4 - x)
      const top = door.y + 6 + (k === 0 ? 3 : k === 1 ? 1 : 0)
      if (y < top) continue
      set(x, y, y === top ? SHELLS[exterior].wall[0]! : dark, y === top ? 255 : 230)
    }
  }
  ctx.putImageData(image, 0, 0)
  shells.set(exterior, canvas)
  return canvas
}

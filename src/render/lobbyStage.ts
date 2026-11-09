import { dir8, type Dir8 } from '../engine/math'
import { context2d, createCanvas, lazy, onCanvasReset } from '../engine/pixelart'
import { createRng, range, type Rng } from '../engine/rng'
import { shadow } from './draw'
import { detail } from './quality'
import { drawPokemon, loadedSprites, loadSpecies, type Dex } from './sprites'

/**
 * The rest screen's stage ("press any key"), side on: sky, clouds, hills, grass,
 * the raised round platform and the Pokémon living around it, drawn on the game's
 * canvas. Everything hangs from `StageAnchor` (the platform's middle and its feet
 * line), so a wider or taller view only shows more sky and grass at the sides,
 * never stretched. Whatever walks here is either behind the terrain's crest (the
 * ridge walkers), in the sky (the flocks) or on a lane in the grass (the
 * roamers), and a roamer whose lane doesn't fit a view isn't drawn at all. The
 * lobby and the menus stand on the top-down meadow (`render/titleScene.ts`).
 * Presentation only.
 */

/** Where the stage stands in view px; `standing` is the ranges (from `x`) a walker on the ridge keeps out of, so nobody peeks from behind the logo. */
export type StageAnchor = { x: number; feet: number; standing: readonly StageSpan[] }

/** A stretch of the view, in view px from the stage's middle. */
export type StageSpan = { from: number; to: number }

/** A wild Pokémon around the platform and the side it keeps to; `air` hovers over its shadow. */
type Wild = { dex: Dex; side: -1 | 1; air?: number }

/** Who roams around the platform. */
const WILD: readonly Wild[] = [
  { dex: 19, side: -1 },
  { dex: 41, side: -1, air: 15 },
  { dex: 66, side: -1 },
  { dex: 92, side: 1, air: 11 },
  { dex: 19, side: 1 },
  { dex: 16, side: 1 },
  { dex: 25, side: -1 },
  { dex: 133, side: 1 },
]

/** The small species that walk the ridge behind the grass: tiny so they read as far away. */
const RIDGE: readonly Dex[] = [10, 13, 43, 69]
/** The flocks that cross the sky: SpriteCollab's `Fly` sheets by day; after dark Zubat and Crobat, whose walk already flaps. */
const FLOCK_DAY: readonly Dex[] = [16, 21, 276, 333]
const FLOCK_NIGHT: readonly Dex[] = [41, 169]

/** The species the stage draws around the platform, on the ridge and in the sky: the menus' sprite stream keeps these while it shows. */
export const stageDex = (): Dex[] => [...new Set([...WILD.map((w) => w.dex), ...RIDGE, ...FLOCK_DAY, ...FLOCK_NIGHT])]

/** Starts loading what the stage shows (swept like any other menu sprite once it's gone). */
export const loadStage = () => {
  for (const dex of stageDex()) void loadSpecies(dex).catch(() => {})
}

/** A roamer: `x` from the platform's middle, `y` from the feet line (world px), walking to (`tx`, `ty`) or waiting. */
type Roamer = { wild: Wild; x: number; y: number; tx: number; ty: number; wait: number; dir: Dir8; placed: boolean; shown: boolean; phase: number }

/** A walker on the ridge: `sink` is how far under the crest it is, so it comes up and goes down behind the hill. */
type RidgeWalker = { dex: Dex; x: number; way: -1 | 1; sink: number; state: 'rise' | 'walk' | 'pause' | 'set' | 'away'; timer: number }

/** A flock crossing the sky: `n` birds in a loose V around (`x`, `y`). */
type Flock = { dex: Dex; x: number; y: number; way: -1 | 1; n: number; speed: number; phase: number }

export type LobbyStage = {
  time: number
  rng: Rng
  roamers: Roamer[]
  ridge: RidgeWalker[]
  flock: Flock | null
  /** Seconds until the next flock sets off. */
  flockIn: number
}

const ridgeWalker = (): RidgeWalker => ({ dex: RIDGE[0]!, x: 0, way: 1, sink: 0, state: 'away', timer: 0 })

export const createLobbyStage = (): LobbyStage => ({
  time: 0,
  rng: createRng(Date.now()),
  roamers: WILD.map(roamerFor),
  ridge: [ridgeWalker(), ridgeWalker(), ridgeWalker()],
  flock: null,
  flockIn: 1.5,
})

/* ---------------- The backdrop ---------------- */

/** How far over the feet line the horizon sits, and how far over the horizon the hills reach (world px). */
const HORIZON_RISE = 26
const HILLS_FAR = 38
const HILLS_NEAR = 20
/** How much the near ridge's height moves along it (world px), so what walks on it climbs and comes down. */
const NEAR_SWELL = 7

/** The platform: half its width and its top's half height, and how deep its earth shows (world px). */
const PLATFORM = { rx: 62, ry: 12, depth: 7 } as const

type Palette = {
  sky: readonly string[]
  far: string
  near: string
  grass: string
  grassLight: string
  tuft: string
  top: string
  topLight: string
  earth: string
  earthDark: string
  shade: string
}

const DAY: Palette = {
  sky: ['#5db3ec', '#74bff0', '#8ecbf2', '#a8d8f4', '#c0e4f3'],
  far: '#b5dfc0',
  near: '#92cd86',
  grass: '#7cb95c',
  grassLight: '#86c365',
  tuft: '#5f9c47',
  top: '#8bc968',
  topLight: '#9ad477',
  earth: '#a58657',
  earthDark: '#84683f',
  shade: '#6aa44f',
}

/** The Noite das Bruxas: the same stage after dark. */
const NIGHT: Palette = {
  sky: ['#15123a', '#1f1a4c', '#2b2360', '#3a2d70', '#4d3a80'],
  far: '#2e3a66',
  near: '#27405a',
  grass: '#2a4a48',
  grassLight: '#305250',
  tuft: '#1e3838',
  top: '#3a6258',
  topLight: '#467064',
  earth: '#5a4a50',
  earthDark: '#40343c',
  shade: '#223e3c',
}

/** Gentle overlapping waves along the hills, about -1.3 to 1.3. */
const hillWave = (x: number, seed: number) => Math.sin(x / 67 + seed) * 0.55 + Math.sin(x / 29 + seed * 2.3) * 0.28 + Math.sin(x / 151 + seed * 0.7) * 0.5

/** A hill's top at `x`, in steps of 3 px so it reads as pixel art. */
const hillTop = (x: number, seed: number) => Math.round(hillWave(x, seed) * 3) * 3

/** The near ridge's crest at `x`, over the horizon: what its walkers stand on, unstepped so they glide. */
const nearCrest = (x: number, horizon: number) => horizon - HILLS_NEAR + hillWave(x, 4.2) * NEAR_SWELL

const fillRow = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** The sky's bands, each ragged into the next by a row of dither. */
const paintSky = (ctx: CanvasRenderingContext2D, p: Palette, w: number, horizon: number) => {
  const band = Math.max(8, Math.floor(horizon / p.sky.length))
  p.sky.forEach((color, i) => {
    const top = i * band
    fillRow(ctx, color, 0, top, w, i === p.sky.length - 1 ? horizon - top : band)
    if (i === 0) return
    for (let x = i % 2 === 0 ? 0 : 3; x < w; x += 6) fillRow(ctx, color, x, top - 2, 3, 2)
  })
}

const paintFarHills = (ctx: CanvasRenderingContext2D, p: Palette, w: number, horizon: number) => {
  for (let x = 0; x < w; x += 3) {
    const far = horizon - HILLS_FAR + hillTop(x, 1.4)
    fillRow(ctx, p.far, x, far, 3, horizon - far)
  }
}

const paintNearHills = (ctx: CanvasRenderingContext2D, p: Palette, w: number, horizon: number) => {
  for (let x = 0; x < w; x += 3) {
    const near = Math.round(nearCrest(x + 1.5, horizon) / 3) * 3
    fillRow(ctx, p.near, x, near, 3, horizon - near)
  }
}

/** The grass from the horizon down, with its lighter strip and a scatter of tufts on a loose grid. */
const paintGrass = (ctx: CanvasRenderingContext2D, p: Palette, w: number, h: number, horizon: number) => {
  fillRow(ctx, p.grass, 0, horizon, w, h - horizon)
  fillRow(ctx, p.grassLight, 0, horizon, w, 5)
  for (let x = 0; x < w; x += 6) fillRow(ctx, p.grassLight, x, horizon + 5, 3, 2)
  const rng = createRng(7)
  const cell = 26
  for (let y = horizon + 10; y < h; y += cell) {
    for (let x = -cell; x < w; x += cell) {
      const tx = Math.round(x + range(rng, 0, cell))
      const ty = Math.round(y + range(rng, 0, cell - 6))
      if (rng() < 0.35) continue
      fillRow(ctx, p.tuft, tx, ty, 1, 2)
      fillRow(ctx, p.tuft, tx + 2, ty - 1, 1, 3)
      fillRow(ctx, p.tuft, tx + 4, ty, 1, 2)
    }
  }
}

/** Half the row width of an ellipse `y` rows from its middle, stepped to 3 px. */
const stepped = (rx: number, ry: number, y: number) => {
  const k = 1 - (y * y) / (ry * ry)
  return k <= 0 ? 0 : Math.round((rx * Math.sqrt(k)) / 3) * 3
}

/** The raised round platform: its shadow on the grass, its earth and its grassy top. */
const paintPlatform = (ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number) => {
  const { rx, ry, depth } = PLATFORM
  for (let row = -ry; row <= ry; row++) {
    const half = stepped(rx + 6, ry + 2, row)
    fillRow(ctx, p.shade, x - half, y + row + depth + 3, half * 2, 1)
  }
  for (let row = 0; row <= ry; row++) {
    const half = stepped(rx, ry, row)
    fillRow(ctx, p.earthDark, x - half, y + row + depth - 2, half * 2, 3)
    fillRow(ctx, p.earth, x - half, y + row, half * 2, depth - 2)
  }
  for (let row = -ry; row <= ry; row++) {
    const half = stepped(rx, ry, row)
    fillRow(ctx, p.top, x - half, y + row, half * 2, 1)
    const light = stepped(rx - 18, ry - 3, row + 1)
    if (light > 0) fillRow(ctx, p.topLight, x - light, y + row, light * 2, 1)
  }
}

/** Where the platform's middle sits, from the feet line: the cast stands a little behind it. */
const platformY = (feet: number) => feet - 2

/** The still picture behind everything: `sky` (sky and far hills) goes under the ridge walkers, `land` (near ridge, grass, platform) over them. */
type Backdrop = { key: string; sky: HTMLCanvasElement; land: HTMLCanvasElement }

/** Redrawn only when the view or the anchor changes. */
let backdrop: Backdrop | null = null
onCanvasReset(
  () => (backdrop = null),
  () => backdrop && [backdrop.sky, backdrop.land],
  'lobby',
)

const stageBackdrop = (w: number, h: number, at: StageAnchor, night: boolean) => {
  const key = `${w}x${h}:${at.x}:${at.feet}:${night}`
  if (backdrop?.key === key) return backdrop
  const fits = backdrop !== null && backdrop.sky.width === w && backdrop.sky.height === h
  const sky = fits ? backdrop!.sky : createCanvas(w, h)
  const land = fits ? backdrop!.land : createCanvas(w, h)
  const skyCtx = context2d(sky)
  const landCtx = context2d(land)
  landCtx.clearRect(0, 0, w, h)
  const p = night ? NIGHT : DAY
  const horizon = at.feet - HORIZON_RISE
  paintSky(skyCtx, p, w, horizon)
  paintFarHills(skyCtx, p, w, horizon)
  paintNearHills(landCtx, p, w, horizon)
  paintGrass(landCtx, p, w, h, horizon)
  paintPlatform(landCtx, p, at.x, platformY(at.feet))
  backdrop = { key, sky, land }
  return backdrop
}

/* ---------------- Clouds ---------------- */

/** A cloud's outline: rows of [left, width] in 3 px blocks, top to bottom. */
const CLOUD_SHAPES: readonly (readonly (readonly [number, number])[])[] = [
  [[6, 5], [3, 11], [0, 17], [2, 13]],
  [[8, 6], [4, 13], [1, 20], [0, 22], [5, 11]],
]

const clouds = lazy(
  () =>
    CLOUD_SHAPES.map((rows) => {
      const width = Math.max(...rows.map(([l, n]) => l + n))
      const canvas = createCanvas(width * 3, rows.length * 3)
      const ctx = context2d(canvas)
      rows.forEach(([left, n], i) => fillRow(ctx, i === rows.length - 1 ? '#dfeffa' : '#ffffff', left * 3, i * 3, n * 3, 3))
      return canvas
    }),
  'lobby',
)

/** The clouds: drifting one way forever, each wrapping around the view on its own. `x` and `y` are shares of the view and the sky. */
const CLOUDS = [
  { x: 0.08, y: 0.1, shape: 0, speed: 1.4 },
  { x: 0.42, y: 0.2, shape: 1, speed: 0.9 },
  { x: 0.74, y: 0.06, shape: 1, speed: 1.1 },
  { x: 0.9, y: 0.28, shape: 0, speed: 0.7 },
] as const

/** A cloud's left edge at `time` (world px, unrounded). */
const cloudX = (c: (typeof CLOUDS)[number], time: number, w: number) => ((c.x * w + time * c.speed) % (w + 90)) - 90
/** A cloud's top for a sky that ends at `horizon` (world px). */
const cloudY = (c: (typeof CLOUDS)[number], horizon: number) => Math.round(c.y * Math.max(60, horizon - 30))

/** How faint the clouds are after dark. */
const NIGHT_CLOUDS = 0.18

export type StageClouds = {
  /** Goes behind the rest screen's content, over the game's canvas. */
  el: HTMLElement
  /** Places the clouds for this frame: `scale` CSS px per world px, `dpr` the device px per CSS px, `zoom` the UI's. */
  tick: (s: LobbyStage, w: number, horizon: number, scale: number, dpr: number, zoom: number, night: boolean) => void
}

/**
 * The rest screen's clouds as images over the canvas. The
 * canvas can only move them a whole world pixel at a time (3 CSS px on a desktop), which
 * reads as stepping at their slow drift; a CSS transform moves them a device pixel
 * at a time, so they glide while the art keeps its hard edges.
 */
export const createStageClouds = (): StageClouds => {
  const urls = clouds().map((canvas) => canvas.toDataURL())
  const el = document.createElement('div')
  el.className = 'stage-clouds'
  el.setAttribute('aria-hidden', 'true')
  const items = CLOUDS.map((c) => {
    const img = document.createElement('img')
    img.src = urls[c.shape]!
    img.alt = ''
    img.draggable = false
    el.append(img)
    return { c, img, art: clouds()[c.shape]!, x: NaN, y: NaN, width: NaN }
  })
  let opacity = ''
  return {
    el,
    tick: (s, w, horizon, scale, dpr, zoom, night) => {
      const shown = night ? String(NIGHT_CLOUDS) : '1'
      if (shown !== opacity) el.style.opacity = opacity = shown
      for (const item of items) {
        // Whole device pixels, then into `#ui`'s zoomed px.
        const x = Math.round(cloudX(item.c, s.time, w) * scale * dpr) / dpr / zoom
        const y = Math.round(cloudY(item.c, horizon) * scale * dpr) / dpr / zoom
        const width = (item.art.width * scale) / zoom
        if (width !== item.width) {
          item.width = width
          item.img.style.width = `${width}px`
          item.img.style.height = `${(item.art.height * scale) / zoom}px`
        }
        if (x !== item.x || y !== item.y) {
          item.x = x
          item.y = y
          item.img.style.transform = `translate(${x}px, ${y}px)`
        }
      }
    },
  }
}

/* ---------------- Who lives here ---------------- */

/** The platform's sides are this far from its edge; a side narrower than `ZONE_MIN` has no room to roam, and each roamer wants `ROAMER_ROOM` of it. */
const ZONE_GAP = 18
const ZONE_MIN = 18
const ROAMER_ROOM = 30
/** How fast the wild walk (world px/s). */
const WALK_SPEED = 15

/** How far under the horizon a roamer's lane starts (world px): on the grass, under the near ridge's foot. */
const LANE_START = 12

const roamerFor = (wild: Wild, i: number): Roamer => ({ wild, x: 0, y: 0, tx: 0, ty: 0, wait: 0, dir: wild.side > 0 ? 6 : 2, placed: false, shown: false, phase: i * 0.37 })

/** The back rows first. */
const byDepth = (a: Roamer, b: Roamer) => a.y - b.y

/** Walks the roamers on their side of the platform; those a view can't fit don't show. */
const stepRoamers = (s: LobbyStage, w: number, h: number, at: StageAnchor, dt: number) => {
  // Counts a side's roamers, so a tight side sends the extra ones away.
  let left = 0
  let right = 0
  const near = PLATFORM.rx + ZONE_GAP
  for (const r of s.roamers) {
    const sprite = loadedSprites(r.wild.dex)
    const side = r.wild.side
    const nth = side < 0 ? left++ : right++
    r.shown = false
    if (!sprite) continue
    const far = w / 2 - 10 - sprite.bodyW / 2 - 4
    const room = far - near
    if (room < ZONE_MIN || nth >= Math.max(1, Math.floor(room / ROAMER_ROOM))) continue
    const air = r.wild.air ?? 0
    // Up to the near ridge's foot.
    const top = air + LANE_START - HORIZON_RISE
    const bottom = h - at.feet - 10
    if (bottom < top) continue
    const [lo, hi] = side < 0 ? [-far, -near] : [near, far]
    if (!r.placed || r.x < lo - 1 || r.x > hi + 1 || r.y < top - 1 || r.y > bottom + 1) {
      r.x = r.tx = range(s.rng, lo, hi)
      r.y = r.ty = range(s.rng, top, bottom)
      r.wait = range(s.rng, 0, 2.5)
      r.placed = true
    }
    r.shown = true
    if (r.wait > 0) {
      r.wait -= dt
      continue
    }
    const dx = r.tx - r.x
    const dy = r.ty - r.y
    const dist = Math.hypot(dx, dy)
    if (dist < 1) {
      r.tx = range(s.rng, lo, hi)
      r.ty = range(s.rng, top, bottom)
      r.wait = range(s.rng, 0.8, 4.5)
      continue
    }
    const step = Math.min(dist, WALK_SPEED * dt)
    r.x += (dx / dist) * step
    r.y += (dy / dist) * step
    r.dir = dir8(dx, dy)
  }
  s.roamers.sort(byDepth)
}

const drawRoamers = (ctx: CanvasRenderingContext2D, s: LobbyStage, at: StageAnchor) => {
  for (const r of s.roamers) {
    const sprite = loadedSprites(r.wild.dex)
    if (!r.shown || !sprite) continue
    const x = Math.round(at.x + r.x)
    const y = Math.round(at.feet + r.y)
    shadow(ctx, x, y, sprite.bodyW)
    const lift = r.wild.air ? Math.round(r.wild.air + Math.sin(s.time * 2 + r.phase * 8) * 2) : 0
    drawPokemon(ctx, sprite, r.wait > 0 ? 'Idle' : 'Walk', r.dir, s.time + r.phase, x, y - lift)
  }
}

/** How deep under the crest a ridge walker starts and ends (it's hidden there), and how fast it comes up (world px, world px/s). */
const RIDGE_DEEP = 30
const RIDGE_RISE = 16
const RIDGE_SPEED = 10
/** How far over the horizon the heads of the ridge's walkers can reach (world px). */
export const stageRidgeReach = 52
/** Margin from what a walker keeps out of for its body, and how far ahead it looks before going down (world px). */
const RIDGE_CLEAR = 14
const RIDGE_LOOK = 16

/** How many walk the ridge at once: a lean frame keeps one. */
const ridgeCount = () => (detail.lean ? 1 : 3)

/** Comes up behind the crest, walks along it (stopping to look around) and goes down again, elsewhere next time. */
const stepRidge = (s: LobbyStage, w: number, at: StageAnchor, count: number, dt: number) => {
  const { standing } = at
  const minX = 8
  const maxX = w - 8
  const blocked = (x: number) => {
    for (const span of standing) if (x - at.x > span.from - RIDGE_CLEAR && x - at.x < span.to + RIDGE_CLEAR) return true
    return false
  }
  for (let i = 0; i < s.ridge.length; i++) {
    const r = s.ridge[i]!
    if (i >= count) {
      r.state = 'away'
      r.timer = Math.max(r.timer, 1)
      continue
    }
    r.timer -= dt
    if (r.state === 'away') {
      if (r.timer > 0) continue
      r.dex = RIDGE[Math.floor(s.rng() * RIDGE.length)]!
      r.x = range(s.rng, minX, maxX)
      r.way = s.rng() < 0.5 ? -1 : 1
      // Behind the logo it would only peek out: try again in a moment.
      if (blocked(r.x)) {
        r.timer = 0.4
        continue
      }
      r.sink = RIDGE_DEEP
      r.state = 'rise'
    } else if (r.state === 'rise') {
      r.sink -= RIDGE_RISE * dt
      if (r.sink <= 0) ((r.sink = 0), (r.state = 'walk'), (r.timer = range(s.rng, 1.5, 4)))
    } else if (r.state === 'set') {
      r.sink += RIDGE_RISE * dt
      if (r.sink >= RIDGE_DEEP) ((r.state = 'away'), (r.timer = range(s.rng, 1, 5)))
    } else if (r.state === 'pause') {
      if (r.timer <= 0) {
        // Stopped to look around: walks on, or heads back the way it came.
        if (s.rng() < 0.3) r.state = 'set'
        else ((r.state = 'walk'), (r.timer = range(s.rng, 1.5, 4)), s.rng() < 0.4 && (r.way = r.way < 0 ? 1 : -1))
      }
    } else if (r.timer <= 0) ((r.state = 'pause'), (r.timer = range(s.rng, 0.8, 2)))
    if (r.state === 'rise' || r.state === 'walk' || r.state === 'set') {
      r.x += r.way * RIDGE_SPEED * dt
      // About to reach the logo or the view's edge: goes down the far side instead.
      if (r.state !== 'set' && (blocked(r.x + r.way * RIDGE_LOOK) || r.x < minX || r.x > maxX)) r.state = 'set'
    }
  }
}

const drawRidge = (ctx: CanvasRenderingContext2D, s: LobbyStage, horizon: number) => {
  for (const r of s.ridge) {
    if (r.state === 'away') continue
    const sprite = loadedSprites(r.dex)
    if (!sprite) continue
    const x = Math.round(r.x)
    const anim = r.state === 'pause' ? 'Idle' : 'Walk'
    drawPokemon(ctx, sprite, anim, r.way > 0 ? 2 : 6, s.time + r.x / 30, x, Math.round(nearCrest(r.x, horizon) + r.sink))
  }
}

/** The V a flock flies in (from the leader, world px, flying right; mirrored flying left). */
const FORMATION = [
  [0, 0],
  [-20, -7],
  [-22, 8],
] as const

const stepFlock = (s: LobbyStage, w: number, h: number, at: StageAnchor, night: boolean, dt: number) => {
  // In the sky over the hills, around the logo.
  const low = at.feet - HORIZON_RISE - 44
  const high = h * 0.12
  // Where that leaves no sky there's no flock at all.
  if (low < high) {
    s.flock = null
    return
  }
  if (s.flock) {
    const f = s.flock
    f.x += f.way * f.speed * dt
    // A flock already flying when the view changes keeps to the new band.
    f.y = Math.min(low, Math.max(high, f.y))
    if (f.x < -50 || f.x > w + 50) ((s.flock = null), (s.flockIn = range(s.rng, 3, 9)))
    return
  }
  s.flockIn -= dt
  if (s.flockIn > 0) return
  const flock = night ? FLOCK_NIGHT : FLOCK_DAY
  const way = s.rng() < 0.5 ? -1 : 1
  s.flock = { dex: flock[Math.floor(s.rng() * flock.length)]!, x: way > 0 ? -40 : w + 40, y: range(s.rng, high, low), way, n: detail.lean ? 1 : 1 + Math.floor(s.rng() * FORMATION.length), speed: range(s.rng, 26, 40), phase: s.rng() * 6 }
}

const drawFlock = (ctx: CanvasRenderingContext2D, s: LobbyStage) => {
  const f = s.flock
  if (!f) return
  const sprite = loadedSprites(f.dex)
  if (!sprite) return
  const anim = sprite.anims.Fly ? 'Fly' : 'Walk'
  for (let i = 0; i < f.n; i++) {
    const [ox, oy] = FORMATION[i]!
    const bob = Math.round(Math.sin(s.time * 1.8 + f.phase + i) * 3)
    drawPokemon(ctx, sprite, anim, f.way > 0 ? 2 : 6, s.time + i * 0.17, Math.round(f.x + ox * f.way), Math.round(f.y + oy + bob))
  }
}

/* ---------------- The whole stage ---------------- */

/** Advances the stage by `dt` seconds and draws it for a `w`×`h` view; the clouds go over it, as images (`createStageClouds`). */
export const drawLobbyStage = (ctx: CanvasRenderingContext2D, s: LobbyStage, w: number, h: number, at: StageAnchor, night: boolean, dt: number) => {
  s.time += dt
  const horizon = at.feet - HORIZON_RISE
  stepRoamers(s, w, h, at, dt)
  stepRidge(s, w, at, ridgeCount(), dt)
  stepFlock(s, w, h, at, night, dt)
  const { sky, land } = stageBackdrop(w, h, at, night)
  ctx.drawImage(sky, 0, 0)
  drawFlock(ctx, s)
  drawRidge(ctx, s, horizon)
  ctx.drawImage(land, 0, 0)
  drawRoamers(ctx, s, at)
}

/** How far (world px) the horizon stands over the feet line. */
export const stageHorizonRise = HORIZON_RISE

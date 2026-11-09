import { REALM_ROOMS, type TownRoomId } from '../data/realmMap'
import type { RealmHour } from '../data/realmEvents'
import { canvasCache, context2d, createCanvas, drawable, fromStrings } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { LANTERN, LANTERN_COLORS } from './realmHourIcons'
import { detail, safeShare } from './quality'
import { sandByWater } from './realmArt'
import { drawPokemon, loadSpecies, loadedSprites } from './sprites'

/**
 * What the Hora do Realm does to its room while it runs (`data/realmEvents.ts`),
 * drawn in code over the town and only on the screen: the tide comes up the
 * pier's sand and shoals of Magikarp leap, fruit rains in the arcade under
 * chasing lights, paper lanterns light the café. Two passes, as the town has
 * (`drawHourGround` under everyone, `drawHourOverhead` over them). Whatever
 * costs is built once and cached; a lean frame (`render/quality.ts`) sheds
 * the extras and a device in safe mode draws fewer of the rest.
 */

/** The room's bottom and top of what shows, to skip what's off screen. */
type View = { camX: number; camY: number; w: number; h: number; time: number; now: number }

/** How long (ms) the tide takes to come in and to go out again, the rise of the first and the last moments of the hour. */
const TIDE_RISE_MS = 40_000
/** How far up the sand (px) the high tide reaches, and the swash on top of it. */
const TIDE_REACH = 18
const TIDE_SWASH = 2

/** The share of optional things this frame draws. */
const share = () => (detail.lean ? 0.5 : 1) * safeShare(detail.safe)

/* ---------------- The tide ---------------- */

const FLOOD_COLORS = ['#6cc4e4', '#9ce0e8', '#eef8fc'] as const

/** Each flood level's runs, one list per color: `[y, x, len, y, x, len…]`. */
type Flood = readonly Int16Array[]

/** The flood at every reach, in runs of a row: nothing to compose per frame but a few hundred rectangles. */
const buildFloods = (room: TownRoomId): Flood[] => {
  const { w, h, depth } = sandByWater(room, TIDE_REACH + TIDE_SWASH + 3)
  const floods: Flood[] = []
  for (let reach = 0; reach <= TIDE_REACH + TIDE_SWASH; reach++) {
    const runs: number[][] = FLOOD_COLORS.map(() => [])
    for (let y = 0; y < h; y++) {
      let color = -1
      let from = 0
      for (let x = 0; x <= w; x++) {
        const d = x < w ? depth[y * w + x]! : 0
        // Foam at the water's edge (wobbling a pixel), the shallows behind it, the deeper flood nearest the sea.
        const edge = reach + (hash2(x >> 1, y, 77) < 0.3 ? 1 : 0)
        const c = d === 0 || d > edge ? -1 : d >= edge - 1 ? 2 : d > reach * 0.55 ? 1 : 0
        if (c === color) continue
        if (color >= 0) runs[color]!.push(y, from, x - from)
        color = c
        from = x
      }
    }
    floods.push(runs.map((r) => Int16Array.from(r)))
  }
  return floods
}

const floods = new Map<TownRoomId, Flood[]>()

const drawFlood = (ctx: CanvasRenderingContext2D, reach: number, v: View) => {
  let levels = floods.get('pier')
  if (!levels) floods.set('pier', (levels = buildFloods('pier')))
  const flood = levels[Math.max(0, Math.min(levels.length - 1, reach))]!
  const top = v.camY - 1
  const bottom = v.camY + v.h
  flood.forEach((runs, c) => {
    ctx.fillStyle = FLOOD_COLORS[c]!
    for (let i = 0; i < runs.length; i += 3) {
      const y = runs[i]!
      if (y < top || y > bottom) continue
      ctx.fillRect(runs[i + 1]! - v.camX, y - v.camY, runs[i + 2]!, 1)
    }
  })
}

/** A Magikarp's back at the surface: `1` the dark line, `2` orange, `3` its light. */
const FISH_BACK = ['..11....', '.12211.1', '1323321.', '.12211.1', '..11....']
const FISH_PALETTE = { 1: '#8a2c14', 2: '#f07830', 3: '#ffc890' }

const fishRight = canvasCache<'r' | 'l', HTMLCanvasElement>()
const fishSprite = (right: boolean) => {
  const key = right ? 'r' : 'l'
  let s = fishRight.get(key)
  if (!s) fishRight.set(key, (s = fromStrings(FISH_BACK, FISH_PALETTE, { mirror: right })))
  return s
}

/** The shoals: each swims round its oval, all of it inside the water (the lagoon's pools, the sea round the jetty, the south shore). */
const SHOALS = [
  { x: 340, y: 300, rx: 46, ry: 24, n: 7, speed: 0.34 },
  { x: 394, y: 324, rx: 34, ry: 16, n: 5, speed: -0.5 },
  { x: 320, y: 460, rx: 280, ry: 7, n: 8, speed: 0.08 },
  { x: 610, y: 360, rx: 16, ry: 70, n: 6, speed: 0.22 },
  { x: 606, y: 80, rx: 18, ry: 62, n: 5, speed: -0.2 },
] as const

/** How often a shoal has one leap (s), and for how long of it. */
const LEAP_EVERY = 2.6
const LEAP = 0.95
const LEAP_HEIGHT = 26

const MAGIKARP = 129
let karpAsked = false

const drawShoals = (ctx: CanvasRenderingContext2D, v: View) => {
  if (!karpAsked) {
    karpAsked = true
    void loadSpecies(MAGIKARP).catch(() => (karpAsked = false))
  }
  const karp = loadedSprites(MAGIKARP)
  const count = Math.ceil(SHOALS.length * share())
  for (let s = 0; s < count; s++) {
    const shoal = SHOALS[s]!
    const beat = Math.floor(v.time / LEAP_EVERY + s * 0.37)
    const k = v.time / LEAP_EVERY + s * 0.37 - beat
    const leaping = k * LEAP_EVERY < LEAP ? Math.floor(hash2(beat, s, 71) * shoal.n) : -1
    for (let i = 0; i < shoal.n; i++) {
      const angle = v.time * shoal.speed + s * 2 - i * (0.5 / (shoal.rx > 100 ? 8 : 1)) * 0.5
      const x = shoal.x + Math.cos(angle) * shoal.rx + (hash2(i, s, 72) - 0.5) * 10
      const y = shoal.y + Math.sin(angle) * shoal.ry + (hash2(i, s, 73) - 0.5) * 8
      const sx = Math.round(x - v.camX)
      const sy = Math.round(y - v.camY)
      if (sx < -30 || sy < -40 || sx > v.w + 30 || sy > v.h + 30) continue
      const heading = -Math.sin(angle) * shoal.speed
      if (i === leaping && karp) {
        const p = (k * LEAP_EVERY) / LEAP
        const up = Math.round(Math.sin(p * Math.PI) * LEAP_HEIGHT)
        // The splash where it left and where it lands, a ring of foam.
        if (p < 0.2 || p > 0.8) {
          ctx.fillStyle = '#eef8fc'
          const r = 3 + Math.round((p < 0.5 ? p : 1 - p) * 20)
          for (const [dx, dy] of [[-r, 0], [r, 0], [-r + 2, -2], [r - 2, -2], [-r + 2, 1], [r - 2, 1]] as const) ctx.fillRect(sx + dx, sy + dy, 2, 1)
        }
        drawPokemon(ctx, karp, 'Walk', heading >= 0 ? 2 : 6, v.time, sx, sy - up)
        continue
      }
      ctx.drawImage(fishSprite(heading >= 0), sx - 4, sy - 2)
      // The little wake, off its tail.
      if (!detail.lean && Math.floor(v.time * 3 + i) % 3 === 0) {
        ctx.fillStyle = '#eef8fc'
        ctx.fillRect(sx + (heading >= 0 ? -7 : 6), sy, 2, 1)
      }
    }
  }
}

/* ---------------- The arcade's fruit storm ---------------- */

const BERRY_KINDS = ['oran', 'pecha', 'razz', 'sitrus', 'golden'] as const
const berries: HTMLImageElement[] = []
let berriesAsked = false

const loadBerries = () => {
  if (berriesAsked) return
  berriesAsked = true
  for (const kind of BERRY_KINDS) {
    const img = new Image()
    img.src = `${import.meta.env.BASE_URL}assets/realm/arcade/berry-${kind}.png`
    void img.decode().then(() => void (drawable(img) && berries.push(img)), () => {})
  }
}

/** The fruits in the air at once (the golden is one in five). */
const FRUIT = 18
/** How long a fruit sits on the carpet after it lands (s), and how long its bounce is. */
const REST = 0.6
const BOUNCE = 0.16
/** Where fruit can land: the carpet in front of the cabinets and the counter. */
const LAND = { x0: 16, x1: 384, y0: 132, y1: 288 } as const

/** Falls, in order: a dark mark grows where it'll land, the fruit comes down, bounces, sinks. */
const drawFruitRain = (ctx: CanvasRenderingContext2D, v: View) => {
  loadBerries()
  if (berries.length === 0) return
  const count = Math.ceil(FRUIT * share())
  // Kept to the room: a small room sits centered on a dark screen.
  ctx.save()
  ctx.beginPath()
  ctx.rect(-v.camX, -v.camY, REALM_ROOMS.arcade.w, REALM_ROOMS.arcade.h)
  ctx.clip()
  for (let i = 0; i < count; i++) {
    const speed = 150 + hash2(i, 1, 81) * 70
    const land = LAND.y0 + hash2(i, 2, 81) * (LAND.y1 - LAND.y0)
    const fall = (land + 24) / speed
    const life = fall + REST + hash2(i, 3, 81)
    const phase = hash2(i, 4, 81) * life
    const lived = (v.time + phase) % life
    const round = Math.floor((v.time + phase) / life)
    const x = LAND.x0 + hash2(i, round, 82) * (LAND.x1 - LAND.x0)
    if (lived > fall + REST) continue
    const img = berries[Math.floor(hash2(i, round, 83) * berries.length)]!
    const sx = Math.round(x - v.camX - img.width / 2)
    if (sx < -24 || sx > v.w + 4) continue
    if (lived < fall) {
      // The shadow tightens as it comes down.
      const k = lived / fall
      ctx.fillStyle = `rgba(10,6,30,${(0.15 + k * 0.3).toFixed(2)})`
      const half = 3 + Math.round(k * 4)
      ctx.fillRect(Math.round(x - v.camX) - half, Math.round(land - v.camY) - 1, half * 2, 2)
      ctx.drawImage(img, sx, Math.round(land - (fall - lived) * speed - img.height - v.camY))
    } else {
      const since = lived - fall
      const up = since < BOUNCE ? Math.round(Math.sin((since / BOUNCE) * Math.PI) * 5) : 0
      // It blinks out, as the game's pickups do.
      if (since < REST - 0.25 || Math.floor(since * 16) % 2 === 0) ctx.drawImage(img, sx, Math.round(land - up - img.height - v.camY))
    }
  }
  ctx.restore()
}

const DISCO = ['#ff5ab4', '#4ae0f0', '#f8d848'] as const

/** A pool of colored light on the carpet: three bands of an oval, no gradient. */
const poolArt = canvasCache<string, HTMLCanvasElement>()
const lightPool = (color: string, rx: number, ry: number) => {
  const key = `${color}:${rx}:${ry}`
  let c = poolArt.get(key)
  if (c) return c
  c = createCanvas(rx * 2, ry * 2)
  const g = context2d(c)
  g.fillStyle = color
  for (let y = 0; y < ry * 2; y++) {
    for (let x = 0; x < rx * 2; x++) {
      const d = ((x + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2
      if (d > 1) continue
      g.globalAlpha = d < 0.3 ? 0.42 : d < 0.65 ? 0.26 : 0.14
      g.fillRect(x, y, 1, 1)
    }
  }
  poolArt.set(key, c)
  return c
}

/** The room goes dark, three colored pools sweep the carpet and a row of bulbs chases along the wall. */
const drawArcadeParty = (ctx: CanvasRenderingContext2D, v: View) => {
  ctx.fillStyle = 'rgba(14,6,44,0.38)'
  ctx.fillRect(6 - v.camX, 64 - v.camY, 388, 236)
  const pools = detail.lean ? 2 : DISCO.length
  for (let i = 0; i < pools; i++) {
    const art = lightPool(DISCO[i]!, 46, 22)
    const x = 200 + Math.sin(v.time * (0.7 + i * 0.23) + i * 2.1) * 150
    const y = 196 + Math.sin(v.time * (0.53 + i * 0.17) + i) * 62
    ctx.drawImage(art, Math.round(x - 46 - v.camX), Math.round(y - 22 - v.camY))
  }
  const step = Math.floor(v.time * 7)
  for (let i = 0; i < 33; i++) {
    const bx = 8 + i * 12
    const lit = (i + step) % 3 !== 0
    ctx.fillStyle = lit ? DISCO[(i + step) % DISCO.length]! : '#3a2a4e'
    ctx.fillRect(bx - v.camX, 56 - v.camY, 3, 3)
    if (lit) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(bx - v.camX, 56 - v.camY, 1, 1)
    }
  }
}

/* ---------------- The café's lanterns ---------------- */

/**
 * The strings of lanterns: from where to where, how far they sag and how many
 * lanterns hang off them. Two on the back wall, either side of the shelf, and
 * one across the room over the floor (`floor`: its lanterns light the boards).
 */
const STRINGS = [
  { x0: 8, x1: 132, y: 40, sag: 12, n: 4, floor: false },
  { x0: 268, x1: 392, y: 40, sag: 12, n: 4, floor: false },
  { x0: 8, x1: 392, y: 156, sag: 26, n: 9, floor: true },
] as const

type LanternString = (typeof STRINGS)[number]

const stringY = (s: LanternString, x: number) => {
  const k = (x - s.x0) / (s.x1 - s.x0)
  return s.y + Math.round(4 * k * (1 - k) * s.sag)
}

const stringArt = canvasCache<number, HTMLCanvasElement>()
const stringCanvas = (i: number) => {
  let c = stringArt.get(i)
  if (c) return c
  const s = STRINGS[i]!
  c = createCanvas(s.x1 - s.x0, s.sag + 3)
  const g = context2d(c)
  g.fillStyle = '#4a3020'
  for (let x = s.x0; x < s.x1; x++) g.fillRect(x - s.x0, stringY(s, x) - s.y, 1, 1)
  stringArt.set(i, c)
  return c
}

const lanternArt = canvasCache<number, HTMLCanvasElement>()
const lantern = (i: number) => {
  const color = i % LANTERN_COLORS.length
  let c = lanternArt.get(color)
  if (!c) lanternArt.set(color, (c = fromStrings(LANTERN, LANTERN_COLORS[color]!)))
  return c
}

/** Dusk through a café window: bands of sky toward the sunset, two stars (the window's own frame stays). */
const duskArt = canvasCache<'dusk', HTMLCanvasElement>()
const dusk = () => {
  let c = duskArt.get('dusk')
  if (c) return c
  c = createCanvas(30, 21)
  const g = context2d(c)
  const bands = ['#1e1c50', '#2c2460', '#4a2c70', '#8a3c70', '#e07050', '#f0b060'] as const
  bands.forEach((color, i) => {
    g.fillStyle = color
    g.fillRect(0, Math.floor((i * 21) / bands.length), 30, Math.ceil(21 / bands.length))
  })
  g.fillStyle = '#fff4c0'
  g.fillRect(6, 3, 1, 1)
  g.fillRect(21, 5, 1, 1)
  duskArt.set('dusk', c)
  return c
}

/** Where a string's `j`th lantern hangs. */
const lanternAt = (s: LanternString, j: number) => {
  const x = s.x0 + ((j + 0.5) * (s.x1 - s.x0)) / s.n
  return { x: Math.round(x), y: stringY(s, x) }
}

const WARM = '#ffb860'

/** Under everyone: the dusk in the windows, the lanterns' light on the floor. */
const drawCafeGround = (ctx: CanvasRenderingContext2D, v: View) => {
  const sky = dusk()
  for (const wx of [60, 340]) {
    // The four panes, around the window's own bars.
    ctx.drawImage(sky, 0, 0, 15, 10, wx - 16 - v.camX, 14 - v.camY, 15, 10)
    ctx.drawImage(sky, 15, 0, 15, 10, wx + 1 - v.camX, 14 - v.camY, 15, 10)
    ctx.drawImage(sky, 0, 11, 15, 10, wx - 16 - v.camX, 25 - v.camY, 15, 10)
    ctx.drawImage(sky, 15, 11, 15, 10, wx + 1 - v.camX, 25 - v.camY, 15, 10)
  }
  const art = lightPool(WARM, 24, 10)
  const every = detail.lean ? 2 : 1
  STRINGS.forEach((s, i) => {
    if (!s.floor) return
    for (let j = 0; j < s.n; j += every) {
      const at = lanternAt(s, j)
      ctx.globalAlpha = Math.floor(v.time * 3 + j + i) % 7 === 0 ? 0.7 : 1
      ctx.drawImage(art, at.x - 24 - v.camX, at.y + 26 - v.camY)
    }
  })
  ctx.globalAlpha = 1
}

/** Over everyone: the evening's dim, then the strings and their lanterns, swaying a pixel. */
const drawCafeOverhead = (ctx: CanvasRenderingContext2D, v: View) => {
  ctx.fillStyle = 'rgba(52,26,84,0.2)'
  ctx.fillRect(-v.camX, -v.camY, REALM_ROOMS.cafe.w, REALM_ROOMS.cafe.h)
  STRINGS.forEach((s, i) => {
    ctx.drawImage(stringCanvas(i), s.x0 - v.camX, s.y - v.camY)
    for (let j = 0; j < s.n; j++) {
      const at = lanternAt(s, j)
      const sway = Math.round(Math.sin(v.time * 1.3 + j + i * 2))
      const art = lantern(j + i)
      if (!detail.lean) {
        const halo = lightPool(WARM, 11, 11)
        ctx.drawImage(halo, at.x - 11 + sway - v.camX, at.y + 2 - v.camY)
      }
      ctx.drawImage(art, at.x - 4 + sway - v.camX, at.y + 1 - v.camY)
    }
  })
}

/* ---------------- The passes ---------------- */

/** How high the tide stands at `now`: it comes in over the hour's first moments and leaves over its last. */
const tideReach = (hour: RealmHour, now: number, time: number) => {
  const k = Math.max(0, Math.min(1, Math.min(now - hour.start, hour.end - now) / TIDE_RISE_MS))
  return Math.round(k * (TIDE_REACH + Math.sin(time * 0.8) * TIDE_SWASH))
}

/** The hour's part under everyone in its room; call it after the room's ground. */
export const drawHourGround = (ctx: CanvasRenderingContext2D, hour: RealmHour, camX: number, camY: number, w: number, h: number, time: number) => {
  const v: View = { camX, camY, w, h, time, now: Date.now() }
  if (hour.kind === 'tide') {
    drawFlood(ctx, tideReach(hour, v.now, time), v)
    drawShoals(ctx, v)
  } else if (hour.kind === 'storm') drawArcadeParty(ctx, v)
  else drawCafeGround(ctx, v)
}

/** The hour's part over everyone in its room; call it after the room's overhead. */
export const drawHourOverhead = (ctx: CanvasRenderingContext2D, hour: RealmHour, camX: number, camY: number, w: number, h: number, time: number) => {
  const v: View = { camX, camY, w, h, time, now: 0 }
  if (hour.kind === 'storm') drawFruitRain(ctx, v)
  else if (hour.kind === 'tables') drawCafeOverhead(ctx, v)
}
